from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import List, Optional
import yfinance as yf
import requests
import os
import asyncio
from contextlib import asynccontextmanager

# Environment variables for database
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./portfolio.db")

if "postgresql://" not in DATABASE_URL and "sqlite://" not in DATABASE_URL:
    DATABASE_URL = "sqlite:///./portfolio.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Database Models
class Investment(Base):
    __tablename__ = "investments"
    
    id = Column(Integer, primary_key=True, index=True)
    asset_type = Column(String, nullable=False)  # Stock, Crypto, Mutual Fund
    ticker = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    units = Column(Float, nullable=False)
    avg_buy_price = Column(Float, nullable=False)  # USD for US stocks, INR for crypto/Indian stocks
    current_price = Column(Float, default=0.0)  # Native currency (USD for US stocks, will be converted for crypto)
    currency = Column(String, default="INR")  # Buy price currency
    investment_thesis = Column(Text)
    conviction_level = Column(String, nullable=False)  # High, Medium, Low
    purchase_date = Column(DateTime, nullable=False)
    last_price_update = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Currency Conversion Service
class CurrencyConverter:
    _usd_to_inr_rate = 83.0  # Fallback rate
    _last_updated = None
    
    @classmethod
    def get_usd_to_inr_rate(cls) -> float:
        """Get live USD to INR conversion rate with caching"""
        try:
            now = datetime.utcnow()
            if cls._last_updated is None or (now - cls._last_updated).total_seconds() > 3600:
                
                sources = [
                    cls._get_rate_from_yahoo,
                    cls._get_rate_from_exchange_api,
                    cls._get_rate_from_fixer
                ]
                
                for source in sources:
                    try:
                        rate = source()
                        if rate and rate > 70 and rate < 100:  # Sanity check
                            cls._usd_to_inr_rate = rate
                            cls._last_updated = now
                            print(f"✅ Updated USD/INR rate: {rate:.2f}")
                            break
                    except Exception as e:
                        print(f"❌ Currency rate source failed: {e}")
                        continue
                        
        except Exception as e:
            print(f"❌ Error updating currency rate: {e}")
            
        return cls._usd_to_inr_rate
    
    @staticmethod
    def _get_rate_from_yahoo() -> Optional[float]:
        """Get USD/INR rate from Yahoo Finance"""
        try:
            url = "https://query1.finance.yahoo.com/v8/finance/chart/USDINR=X?interval=1d&range=1d"
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('chart', {}).get('result'):
                    result = data['chart']['result'][0]
                    meta = result.get('meta', {})
                    rate = meta.get('regularMarketPrice')
                    
                    if rate:
                        return float(rate)
                        
        except Exception as e:
            print(f"Yahoo currency rate failed: {e}")
            
        return None
    
    @staticmethod
    def _get_rate_from_exchange_api() -> Optional[float]:
        """Get USD/INR rate from Exchange Rate API (free)"""
        try:
            url = "https://api.exchangerate-api.com/v4/latest/USD"
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                rates = data.get('rates', {})
                inr_rate = rates.get('INR')
                
                if inr_rate:
                    return float(inr_rate)
                    
        except Exception as e:
            print(f"Exchange Rate API failed: {e}")
            
        return None
    
    @staticmethod
    def _get_rate_from_fixer() -> Optional[float]:
        """Get USD/INR rate from Fixer.io (free tier available)"""
        try:
            api_key = os.getenv('FIXER_API_KEY', '')
            if not api_key:
                return None
                
            url = f"http://data.fixer.io/api/latest?access_key={api_key}&base=USD&symbols=INR"
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    rates = data.get('rates', {})
                    inr_rate = rates.get('INR')
                    
                    if inr_rate:
                        return float(inr_rate)
                        
        except Exception as e:
            print(f"Fixer.io failed: {e}")
            
        return None
    
    @classmethod
    def convert_to_inr(cls, amount: float, from_currency: str) -> float:
        """Convert amount from given currency to INR"""
        if from_currency.upper() == "INR":
            return amount
        elif from_currency.upper() == "USD":
            rate = cls.get_usd_to_inr_rate()
            return amount * rate
        else:
            return amount

# Updated Pydantic Models
class InvestmentCreate(BaseModel):
    asset_type: str
    ticker: str
    name: str
    units: float
    avg_buy_price: float  # USD for US stocks, INR for crypto/Indian stocks
    currency: str = "INR"  # Currency of the buy price you're inputting
    investment_thesis: Optional[str] = ""
    conviction_level: str
    purchase_date: datetime

class InvestmentUpdate(BaseModel):
    units: Optional[float] = None
    avg_buy_price: Optional[float] = None
    currency: Optional[str] = None
    investment_thesis: Optional[str] = None
    conviction_level: Optional[str] = None

class InvestmentResponse(BaseModel):
    id: int
    asset_type: str
    ticker: str
    name: str
    units: float
    avg_buy_price: float  # As stored (USD for US stocks, INR for crypto)
    current_price: float  # Native price before conversion
    current_price_inr: float  # Current price converted to INR for crypto
    currency: str  # Currency of avg_buy_price
    investment_thesis: str
    conviction_level: str
    purchase_date: datetime
    last_price_update: datetime
    total_value_inr: float  # Always in INR
    total_invested_inr: float  # Always in INR
    unrealized_pnl_inr: float  # Always in INR
    unrealized_pnl_percent: float
    usd_to_inr_rate: Optional[float] = None
    # Formatted display strings
    buy_price_formatted: str  # e.g., "$191.48" or "₹67000"
    current_price_formatted: str  # e.g., "$340.01" or "₹95000"

    class Config:
        from_attributes = True

class PortfolioStats(BaseModel):
    total_invested: float
    current_value: float
    net_return_percent: float
    total_unrealized_pnl: float
    high_conviction_count: int
    medium_conviction_count: int
    low_conviction_count: int
    total_holdings: int

# Enhanced Price fetching service
class PriceFetcher:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
        }
        
    def get_price_yahoo_simple(self, ticker: str) -> Optional[float]:
        """Yahoo Finance - Simple endpoint"""
        try:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1m&range=1d"
            response = requests.get(url, headers=self.headers, timeout=8)
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('chart', {}).get('result'):
                    result = data['chart']['result'][0]
                    meta = result.get('meta', {})
                    current_price = meta.get('regularMarketPrice')
                    
                    if current_price:
                        return float(current_price)
                        
                    quotes = result.get('indicators', {}).get('quote', [{}])
                    if quotes and quotes[0].get('close'):
                        closes = [c for c in quotes[0]['close'] if c is not None]
                        if closes:
                            return float(closes[-1])
                            
        except Exception as e:
            print(f"Yahoo Simple failed for {ticker}: {e}")
            
        return None
    
    def get_crypto_price_coingecko(self, ticker: str) -> Optional[float]:
        """CoinGecko for cryptocurrency prices (returns USD)"""
        try:
            crypto_mapping = {
                'BTC-USD': 'bitcoin',
                'ETH-USD': 'ethereum',
                'ADA-USD': 'cardano',
                'DOT-USD': 'polkadot',
                'MATIC-USD': 'matic-network',
                'SOL-USD': 'solana',
                'AVAX-USD': 'avalanche-2',
                'LINK-USD': 'chainlink',
                'UNI-USD': 'uniswap',
                'ATOM-USD': 'cosmos',
                'XRP-USD': 'ripple',
                'LTC-USD': 'litecoin',
                'BCH-USD': 'bitcoin-cash',
                'DOGE-USD': 'dogecoin'
            }
            
            coin_id = crypto_mapping.get(ticker.upper())
            if not coin_id:
                return None
                
            url = f"https://api.coingecko.com/api/v3/simple/price?ids={coin_id}&vs_currencies=usd"
            response = requests.get(url, timeout=8)
            
            if response.status_code == 200:
                data = response.json()
                if coin_id in data and 'usd' in data[coin_id]:
                    return float(data[coin_id]['usd'])
                    
        except Exception as e:
            print(f"CoinGecko failed for {ticker}: {e}")
            
        return None
    
    def get_price_with_fallbacks(self, ticker: str, asset_type: str = "Stock") -> Optional[float]:
        """Try multiple sources with fast fallbacks"""
        
        # For cryptocurrency, use CoinGecko first
        if asset_type.lower() == "crypto" or ticker.endswith('-USD'):
            crypto_price = self.get_crypto_price_coingecko(ticker)
            if crypto_price:
                print(f"✅ Got crypto price for {ticker}: ${crypto_price:.2f}")
                return crypto_price
        
        # For stocks, try multiple sources
        sources = [
            ("Yahoo Simple", self.get_price_yahoo_simple),
        ]
        
        for source_name, source_func in sources:
            try:
                print(f"Trying {source_name} for {ticker}...")
                price = source_func(ticker)
                
                if price is not None and price > 0:
                    print(f"✅ Got price from {source_name}: ${price:.2f}")
                    return price
                    
            except Exception as e:
                print(f"❌ {source_name} error: {e}")
            
            import time
            time.sleep(0.1)
        
        print(f"❌ All sources failed for {ticker}")
        return 0.0

    @staticmethod
    async def get_price_in_native_currency(asset_type: str, ticker: str) -> tuple[float, str]:
        """Get price in native currency and return (price, currency)"""
        fetcher = PriceFetcher()
        
        if asset_type.lower() == "crypto":
            # Crypto prices are fetched in USD from APIs
            price = fetcher.get_price_with_fallbacks(ticker, "Crypto") or 0.0
            return (price, "USD")
            
        elif ticker.endswith('.NS') or ticker.endswith('.BO'):
            # Indian stocks - price in INR
            price = fetcher.get_price_with_fallbacks(ticker, "Stock") or 0.0
            return (price, "INR")
            
        elif asset_type.lower() == "stock" and not ticker.endswith(('.NS', '.BO')):
            # US stocks - price in USD
            price = fetcher.get_price_with_fallbacks(ticker, "Stock") or 0.0
            return (price, "USD")
            
        else:
            # Default to INR for mutual funds and others
            price = fetcher.get_price_with_fallbacks(ticker, "Stock") or 0.0
            return (price, "INR")

# Updated background task for price updates
async def update_all_prices():
    """Background task to update all investment prices"""
    db = SessionLocal()
    try:
        investments = db.query(Investment).all()
        print(f"Updating prices for {len(investments)} investments...")
        
        for investment in investments:
            time_since_update = (datetime.utcnow() - investment.last_price_update).total_seconds()
            if time_since_update > 900:  # 15 minutes
                print(f"Updating price for {investment.ticker}")
                
                # Get price in native currency (USD for crypto/US stocks, INR for Indian)
                new_price, price_currency = await PriceFetcher.get_price_in_native_currency(
                    investment.asset_type, 
                    investment.ticker
                )
                
                if new_price > 0:
                    investment.current_price = new_price
                    investment.last_price_update = datetime.utcnow()
                    print(f"Updated {investment.ticker}: {new_price} {price_currency}")
                else:
                    print(f"Could not fetch price for {investment.ticker}")
        
        db.commit()
        print("Price update completed")
    except Exception as e:
        print(f"Error updating prices: {e}")
        db.rollback()
    finally:
        db.close()

# Lifespan management
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Portfolio Tracker API starting up...")
    
    async def price_update_loop():
        while True:
            await update_all_prices()
            await asyncio.sleep(900)
    
    task = asyncio.create_task(price_update_loop())
    
    yield
    
    task.cancel()
    print("🛑 Portfolio Tracker API shutting down...")

# FastAPI app
app = FastAPI(
    title="Personal Investment Portfolio Tracker",
    description="Track your investments with proper currency handling",
    version="2.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# UPDATED helper function with correct currency logic
def calculate_metrics(investment: Investment) -> dict:
    """Calculate investment metrics with corrected currency handling"""
    
    usd_to_inr_rate = CurrencyConverter.get_usd_to_inr_rate()
    
    # Ensure valid numeric values
    units = float(investment.units) if investment.units else 0.0
    current_price = float(investment.current_price) if investment.current_price else 0.0
    avg_buy_price = float(investment.avg_buy_price) if investment.avg_buy_price else 0.0
    currency = getattr(investment, 'currency', 'INR') or 'INR'
    
    # Determine asset type behavior
    if investment.asset_type.lower() == "crypto":
        # CRYPTO: Buy price in INR, Current price fetched in USD → convert to INR
        current_price_inr = current_price * usd_to_inr_rate  # Convert USD to INR
        buy_price_inr = avg_buy_price  # Already in INR
        
        # Format for display
        buy_price_formatted = f"₹{avg_buy_price:,.2f}"
        current_price_formatted = f"₹{current_price_inr:,.2f}"
        
    elif investment.ticker.endswith('.NS') or investment.ticker.endswith('.BO'):
        # INDIAN STOCKS: Everything in INR
        current_price_inr = current_price  # Already in INR
        buy_price_inr = avg_buy_price  # Already in INR
        
        buy_price_formatted = f"₹{avg_buy_price:,.2f}"
        current_price_formatted = f"₹{current_price:,.2f}"
        
    else:
        # US STOCKS: Buy price in USD, Current price in USD, but totals in INR
        current_price_inr = current_price  # Keep USD for display
        buy_price_inr = avg_buy_price  # Keep USD for calculations
        
        buy_price_formatted = f"${avg_buy_price:,.2f}"
        current_price_formatted = f"${current_price:,.2f}"
    
    # Calculate totals in INR
    if investment.asset_type.lower() == "crypto":
        # For crypto: buy price is INR, current price converted to INR
        total_invested_inr = units * buy_price_inr  # INR
        total_value_inr = units * current_price_inr  # INR
    elif investment.ticker.endswith('.NS') or investment.ticker.endswith('.BO'):
        # For Indian stocks: everything in INR
        total_invested_inr = units * buy_price_inr  # INR
        total_value_inr = units * current_price_inr  # INR
    else:
        # For US stocks: convert both to INR
        total_invested_inr = units * buy_price_inr * usd_to_inr_rate  # USD → INR
        total_value_inr = units * current_price_inr * usd_to_inr_rate  # USD → INR
    
    # Calculate P&L in INR
    unrealized_pnl_inr = total_value_inr - total_invested_inr
    unrealized_pnl_percent = (unrealized_pnl_inr / total_invested_inr * 100) if total_invested_inr > 0 else 0
    
    # NaN protection
    total_value_inr = total_value_inr if not (total_value_inr != total_value_inr) else 0.0
    total_invested_inr = total_invested_inr if not (total_invested_inr != total_invested_inr) else 0.0
    unrealized_pnl_inr = unrealized_pnl_inr if not (unrealized_pnl_inr != unrealized_pnl_inr) else 0.0
    unrealized_pnl_percent = unrealized_pnl_percent if not (unrealized_pnl_percent != unrealized_pnl_percent) else 0.0
    current_price_inr = current_price_inr if not (current_price_inr != current_price_inr) else 0.0
    
    return {
        "total_value_inr": total_value_inr,
        "total_invested_inr": total_invested_inr,
        "unrealized_pnl_inr": unrealized_pnl_inr,
        "unrealized_pnl_percent": unrealized_pnl_percent,
        "current_price_inr": current_price_inr,  # For crypto display
        "usd_to_inr_rate": usd_to_inr_rate,
        "buy_price_formatted": buy_price_formatted,
        "current_price_formatted": current_price_formatted
    }

# API Routes
@app.get("/")
async def root():
    return {
        "message": "Personal Investment Portfolio Tracker API", 
        "version": "2.1.0", 
        "status": "running",
        "currency_logic": "US stocks: USD prices, INR totals | Crypto: INR buy price, INR display | Indian: All INR"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# UPDATED get_investments endpoint
@app.get("/api/investments", response_model=List[InvestmentResponse])
async def get_investments(db: Session = Depends(get_db)):
    """Get all investments with corrected currency handling"""
    investments = db.query(Investment).all()
    result = []
    
    for investment in investments:
        metrics = calculate_metrics(investment)
        
        result.append(InvestmentResponse(
            id=investment.id,
            asset_type=investment.asset_type,
            ticker=investment.ticker,
            name=investment.name,
            units=investment.units,
            avg_buy_price=investment.avg_buy_price,
            current_price=investment.current_price,
            current_price_inr=metrics["current_price_inr"],  # For crypto
            currency=getattr(investment, 'currency', 'INR'),
            investment_thesis=investment.investment_thesis or "",
            conviction_level=investment.conviction_level,
            purchase_date=investment.purchase_date,
            last_price_update=investment.last_price_update,
            **{k: v for k, v in metrics.items() if k != "current_price_inr"}
        ))
    
    return result

# UPDATED create investment endpoint
@app.post("/api/investments", response_model=InvestmentResponse)
async def create_investment(investment: InvestmentCreate, db: Session = Depends(get_db)):
    try:
        print(f"Creating investment: {investment.ticker}")
        
        # Determine currency logic
        if investment.ticker.endswith('.NS') or investment.ticker.endswith('.BO'):
            currency = "INR"  # Indian stocks
        elif investment.asset_type.lower() == "crypto":
            currency = "INR"  # You input crypto buy prices in INR
        elif investment.asset_type.lower() == "stock":
            currency = "USD"  # US stocks buy price in USD
        else:
            currency = investment.currency or "INR"
        
        # Fetch current price in native currency
        current_price, price_currency = await PriceFetcher.get_price_in_native_currency(
            investment.asset_type, 
            investment.ticker
        )
        print(f"Fetched price for {investment.ticker}: {current_price} {price_currency}")
        
        db_investment = Investment(
            asset_type=investment.asset_type,
            ticker=investment.ticker,
            name=investment.name,
            units=float(investment.units),
            avg_buy_price=float(investment.avg_buy_price),  # As you input it
            currency=currency,  # Currency of your buy price input
            current_price=float(current_price) if current_price else 0.0,
            investment_thesis=investment.investment_thesis,
            conviction_level=investment.conviction_level,
            purchase_date=investment.purchase_date,
            last_price_update=datetime.utcnow()
        )
        
        db.add(db_investment)
        db.commit()
        db.refresh(db_investment)
        
        print(f"Investment created successfully: {investment.ticker}")
        
        metrics = calculate_metrics(db_investment)
        return InvestmentResponse(
            id=db_investment.id,
            asset_type=db_investment.asset_type,
            ticker=db_investment.ticker,
            name=db_investment.name,
            units=db_investment.units,
            avg_buy_price=db_investment.avg_buy_price,
            current_price=db_investment.current_price,
            current_price_inr=metrics["current_price_inr"],
            currency=db_investment.currency,
            investment_thesis=db_investment.investment_thesis or "",
            conviction_level=db_investment.conviction_level,
            purchase_date=db_investment.purchase_date,
            last_price_update=db_investment.last_price_update,
            **{k: v for k, v in metrics.items() if k != "current_price_inr"}
        )
    except Exception as e:
        db.rollback()
        print(f"Error creating investment: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create investment: {str(e)}")

# Rest of the endpoints remain the same...
@app.put("/api/investments/{investment_id}", response_model=InvestmentResponse)
async def update_investment(
    investment_id: int, 
    investment_update: InvestmentUpdate, 
    db: Session = Depends(get_db)
):
    db_investment = db.query(Investment).filter(Investment.id == investment_id).first()
    if not db_investment:
        raise HTTPException(status_code=404, detail="Investment not found")
    
    for field, value in investment_update.dict(exclude_unset=True).items():
        if field in ['units', 'avg_buy_price'] and value is not None:
            setattr(db_investment, field, float(value))
        else:
            setattr(db_investment, field, value)
    
    db_investment.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_investment)
    
    metrics = calculate_metrics(db_investment)
    
    return InvestmentResponse(
        id=db_investment.id,
        asset_type=db_investment.asset_type,
        ticker=db_investment.ticker,
        name=db_investment.name,
        units=db_investment.units,
        avg_buy_price=db_investment.avg_buy_price,
        current_price=db_investment.current_price,
        current_price_inr=metrics["current_price_inr"],
        currency=getattr(db_investment, 'currency', 'INR'),
        investment_thesis=db_investment.investment_thesis or "",
        conviction_level=db_investment.conviction_level,
        purchase_date=db_investment.purchase_date,
        last_price_update=db_investment.last_price_update,
        **{k: v for k, v in metrics.items() if k != "current_price_inr"}
    )

@app.delete("/api/investments/{investment_id}")
async def delete_investment(investment_id: int, db: Session = Depends(get_db)):
    db_investment = db.query(Investment).filter(Investment.id == investment_id).first()
    if not db_investment:
        raise HTTPException(status_code=404, detail="Investment not found")
    
    db.delete(db_investment)
    db.commit()
    return {"message": "Investment deleted successfully"}

@app.get("/api/portfolio/stats", response_model=PortfolioStats)
async def get_portfolio_stats(db: Session = Depends(get_db)):
    """Get portfolio statistics - all calculations in INR"""
    investments = db.query(Investment).all()
    
    total_invested_inr = 0.0
    current_value_inr = 0.0
    conviction_counts = {"High": 0, "Medium": 0, "Low": 0}
    
    for investment in investments:
        metrics = calculate_metrics(investment)
        total_invested_inr += metrics["total_invested_inr"]
        current_value_inr += metrics["total_value_inr"]
        conviction_counts[investment.conviction_level] += 1
    
    total_unrealized_pnl_inr = current_value_inr - total_invested_inr
    net_return_percent = (total_unrealized_pnl_inr / total_invested_inr * 100) if total_invested_inr > 0 else 0
    
    # NaN protection
    total_invested_inr = total_invested_inr if not (total_invested_inr != total_invested_inr) else 0.0
    current_value_inr = current_value_inr if not (current_value_inr != current_value_inr) else 0.0
    total_unrealized_pnl_inr = total_unrealized_pnl_inr if not (total_unrealized_pnl_inr != total_unrealized_pnl_inr) else 0.0
    net_return_percent = net_return_percent if not (net_return_percent != net_return_percent) else 0.0
    
    return PortfolioStats(
        total_invested=total_invested_inr,
        current_value=current_value_inr,
        net_return_percent=net_return_percent,
        total_unrealized_pnl=total_unrealized_pnl_inr,
        high_conviction_count=conviction_counts["High"],
        medium_conviction_count=conviction_counts["Medium"], 
        low_conviction_count=conviction_counts["Low"],
        total_holdings=len(investments)
    )

@app.post("/api/refresh-prices")
async def refresh_prices(db: Session = Depends(get_db)):
    """Manually refresh all investment prices"""
    try:
        await update_all_prices()
        return {"message": "Prices refreshed successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to refresh prices: {str(e)}")

# Database migration for existing data
def migrate_existing_data():
    """Fix currency assignments for existing investments"""
    db = SessionLocal()
    try:
        investments = db.query(Investment).all()
        for inv in investments:
            # Fix currency assignment based on new logic
            if inv.ticker.endswith('.NS') or inv.ticker.endswith('.BO'):
                inv.currency = "INR"  # Indian stocks
            elif inv.asset_type.lower() == "crypto":
                inv.currency = "INR"  # Crypto buy prices in INR
            elif inv.asset_type.lower() == "stock":
                inv.currency = "USD"  # US stocks buy prices in USD
            else:
                inv.currency = "INR"  # Default
            
            # Ensure numeric fields are properly typed
            if inv.units is not None:
                inv.units = float(inv.units)
            if inv.avg_buy_price is not None:
                inv.avg_buy_price = float(inv.avg_buy_price)
            if inv.current_price is not None:
                inv.current_price = float(inv.current_price)
        
        db.commit()
        print(f"Migrated {len(investments)} existing investments")
    except Exception as e:
        print(f"Migration error: {e}")
        db.rollback()
    finally:
        db.close()

# Call migration on startup
Base.metadata.create_all(bind=engine)
migrate_existing_data()

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting server on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
