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

# For Supabase/PostgreSQL, keep the URL as is
# For local development, use SQLite as fallback
if "postgresql://" not in DATABASE_URL and "sqlite://" not in DATABASE_URL:
    DATABASE_URL = "sqlite:///./portfolio.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Database Models
# Updated Database Models (Replace in your main.py)
class Investment(Base):
    __tablename__ = "investments"
    
    id = Column(Integer, primary_key=True, index=True)
    asset_type = Column(String, nullable=False)  # Stock, Crypto, Mutual Fund
    ticker = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    units = Column(Float, nullable=False)
    avg_buy_price = Column(Float, nullable=False)  # In original currency (USD for US stocks)
    current_price = Column(Float, default=0.0)  # In original currency
    currency = Column(String, default="INR")  # New field: USD, INR
    investment_thesis = Column(Text)
    conviction_level = Column(String, nullable=False)  # High, Medium, Low
    purchase_date = Column(DateTime, nullable=False)
    last_price_update = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Updated Pydantic Models (Replace in your main.py)
class InvestmentCreate(BaseModel):
    asset_type: str
    ticker: str
    name: str
    units: float
    avg_buy_price: float
    currency: str = "INR"  # New field
    investment_thesis: Optional[str] = ""
    conviction_level: str
    purchase_date: datetime

class InvestmentUpdate(BaseModel):
    units: Optional[float] = None
    avg_buy_price: Optional[float] = None
    currency: Optional[str] = None  # New field
    investment_thesis: Optional[str] = None
    conviction_level: Optional[str] = None

class InvestmentResponse(BaseModel):
    id: int
    asset_type: str
    ticker: str
    name: str
    units: float
    avg_buy_price: float  # Original currency
    current_price: float  # Original currency
    currency: str  # New field
    investment_thesis: str
    conviction_level: str
    purchase_date: datetime
    last_price_update: datetime
    total_value_inr: float  # Always in INR
    total_invested_inr: float  # Always in INR
    unrealized_pnl_inr: float  # Always in INR
    unrealized_pnl_percent: float
    usd_to_inr_rate: Optional[float] = None  # Current conversion rate

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
# Enhanced Price fetching service with multiple sources
class PriceFetcher:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
        }
        
        # Get Alpha Vantage API key from environment variable
        self.alpha_vantage_key = os.getenv('ALPHA_VANTAGE_API_KEY', 'demo')
        
    def get_price_yahoo_simple(self, ticker: str) -> Optional[float]:
        """Yahoo Finance - Simple endpoint (least likely to be rate limited)"""
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
                        
                    # Fallback to last close price
                    quotes = result.get('indicators', {}).get('quote', [{}])
                    if quotes and quotes[0].get('close'):
                        closes = [c for c in quotes[0]['close'] if c is not None]
                        if closes:
                            return float(closes[-1])
                            
        except Exception as e:
            print(f"Yahoo Simple failed for {ticker}: {e}")
            
        return None
    
    def get_price_yahoo_search(self, ticker: str) -> Optional[float]:
        """Yahoo Finance - Search endpoint"""
        try:
            url = f"https://query1.finance.yahoo.com/v1/finance/search?q={ticker}"
            response = requests.get(url, headers=self.headers, timeout=8)
            
            if response.status_code == 200:
                data = response.json()
                quotes = data.get('quotes', [])
                
                for quote in quotes:
                    if quote.get('symbol') == ticker:
                        price = quote.get('regularMarketPrice')
                        if price and price > 0:
                            return float(price)
                            
        except Exception as e:
            print(f"Yahoo Search failed for {ticker}: {e}")
            
        return None
    
    def get_price_yfinance_fallback(self, ticker: str) -> Optional[float]:
        """yfinance as fallback (your original method)"""
        try:
            import yfinance as yf
            stock = yf.Ticker(ticker)
            hist = stock.history(period="1d")
            if not hist.empty:
                return float(hist['Close'].iloc[-1])
            
            # Fallback: try current data
            info = stock.info
            if 'currentPrice' in info:
                return float(info['currentPrice'])
            elif 'regularMarketPrice' in info:
                return float(info['regularMarketPrice'])
                
        except Exception as e:
            print(f"yfinance fallback failed for {ticker}: {e}")
            
        return None
    
    def get_price_alpha_vantage(self, ticker: str) -> Optional[float]:
        """Alpha Vantage API"""
        try:
            if self.alpha_vantage_key == 'demo':
                print(f"Skipping Alpha Vantage for {ticker} - no API key")
                return None
                
            url = f"https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol={ticker}&apikey={self.alpha_vantage_key}"
            response = requests.get(url, timeout=8)
            
            if response.status_code == 200:
                data = response.json()
                quote = data.get('Global Quote', {})
                price = quote.get('05. price')
                
                if price:
                    return float(price)
                    
        except Exception as e:
            print(f"Alpha Vantage failed for {ticker}: {e}")
            
        return None
    
    def get_crypto_price_coingecko(self, ticker: str) -> Optional[float]:
        """CoinGecko for cryptocurrency prices"""
        try:
            # Convert ticker to CoinGecko ID
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
            ("Yahoo Search", self.get_price_yahoo_search),
            ("yfinance Fallback", self.get_price_yfinance_fallback),
            ("Alpha Vantage", self.get_price_alpha_vantage),
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
            
            # Very short delay between sources
            import time
            time.sleep(0.1)
        
        print(f"❌ All sources failed for {ticker}")
        return 0.0

    # Updated static methods to use the new multi-source fetcher
    @staticmethod
    async def get_stock_price(ticker: str) -> float:
        """Fetch stock price using multi-source fetcher"""
        fetcher = PriceFetcher()
        price = fetcher.get_price_with_fallbacks(ticker, "Stock")
        return price if price is not None else 0.0

    @staticmethod
    async def get_crypto_price(ticker: str) -> float:
        """Fetch crypto price using CoinGecko and fallbacks"""
        fetcher = PriceFetcher()
        price = fetcher.get_price_with_fallbacks(ticker, "Crypto")
        return price if price is not None else 0.0

    @staticmethod
    async def get_mutual_fund_price(ticker: str) -> float:
        """Fetch mutual fund price using multi-source fetcher"""
        fetcher = PriceFetcher()
        price = fetcher.get_price_with_fallbacks(ticker, "Stock")
        return price if price is not None else 0.0

    @staticmethod
    async def get_price(asset_type: str, ticker: str) -> float:
        """Universal price fetcher with multiple fallbacks"""
        fetcher = PriceFetcher()
        
        if asset_type.lower() == "crypto":
            return fetcher.get_price_with_fallbacks(ticker, "Crypto") or 0.0
        elif asset_type.lower() in ["stock", "mutual fund"]:
            return fetcher.get_price_with_fallbacks(ticker, "Stock") or 0.0
        
        return 0.0

    @staticmethod
    async def get_crypto_price(ticker: str) -> float:
        """Fetch crypto price using CoinGecko free API"""
        try:
            # Convert ticker format (BTC-USD -> bitcoin)
            crypto_map = {
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
            
            crypto_id = crypto_map.get(ticker.upper(), ticker.lower().replace('-usd', ''))
            
            url = f"https://api.coingecko.com/api/v3/simple/price?ids={crypto_id}&vs_currencies=usd"
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if crypto_id in data:
                    return float(data[crypto_id]['usd'])
            
            # Fallback: try yfinance for crypto
            return await PriceFetcher.get_stock_price(ticker)
        except Exception as e:
            print(f"Error fetching crypto price for {ticker}: {e}")
            return 0.0

    @staticmethod
    async def get_mutual_fund_price(ticker: str) -> float:
        """Fetch mutual fund price using yfinance"""
        return await PriceFetcher.get_stock_price(ticker)

    @staticmethod
    async def get_price(asset_type: str, ticker: str) -> float:
        """Universal price fetcher with multiple fallbacks"""
        if asset_type.lower() == "crypto":
            return await PriceFetcher.get_crypto_price(ticker)
        elif asset_type.lower() in ["stock", "mutual fund"]:
            return await PriceFetcher.get_stock_price(ticker)
        return 0.0

# Background task for price updates
async def update_all_prices():
    """Background task to update all investment prices"""
    db = SessionLocal()
    try:
        investments = db.query(Investment).all()
        print(f"Updating prices for {len(investments)} investments...")
        
        for investment in investments:
            # Only update if price is older than 15 minutes
            time_since_update = (datetime.utcnow() - investment.last_price_update).total_seconds()
            if time_since_update > 900:  # 15 minutes
                print(f"Updating price for {investment.ticker}")
                new_price = await PriceFetcher.get_price(investment.asset_type, investment.ticker)
                if new_price > 0:
                    investment.current_price = new_price
                    investment.last_price_update = datetime.utcnow()
                    print(f"Updated {investment.ticker}: {new_price}")
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
    # Startup
    print("🚀 Portfolio Tracker API starting up...")
    
    # Create background task for price updates
    async def price_update_loop():
        while True:
            await update_all_prices()
            await asyncio.sleep(900)  # Wait 15 minutes
    
    # Start background task
    task = asyncio.create_task(price_update_loop())
    
    yield
    
    # Shutdown
    task.cancel()
    print("🛑 Portfolio Tracker API shutting down...")

# FastAPI app
app = FastAPI(
    title="Personal Investment Portfolio Tracker",
    description="Track your investments across Indian Stocks, US Stocks, Cryptocurrencies, and Mutual Funds",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware - Allow all origins for cloud deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Helper function to calculate investment metrics
def calculate_metrics(investment: Investment) -> dict:
    total_value = investment.units * investment.current_price
    total_invested = investment.units * investment.avg_buy_price
    unrealized_pnl = total_value - total_invested
    unrealized_pnl_percent = (unrealized_pnl / total_invested * 100) if total_invested > 0 else 0
    
    return {
        "total_value": total_value,
        "unrealized_pnl": unrealized_pnl,
        "unrealized_pnl_percent": unrealized_pnl_percent
    }

# API Routes
@app.get("/")
async def root():
    return {
        "message": "Personal Investment Portfolio Tracker API", 
        "version": "2.0.0", 
        "status": "running",
        "features": ["Real-time price updates", "Multi-asset support", "Dark/Light mode"]
    }

@app.get("/health")
async def health_check():
    """Health check endpoint for cloud deployment"""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

@app.get("/api/investments", response_model=List[InvestmentResponse])
async def get_investments(db: Session = Depends(get_db)):
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
            investment_thesis=investment.investment_thesis or "",
            conviction_level=investment.conviction_level,
            purchase_date=investment.purchase_date,
            last_price_update=investment.last_price_update,
            **metrics
        ))
    
    return result

@app.post("/api/investments", response_model=InvestmentResponse)
async def create_investment(investment: InvestmentCreate, db: Session = Depends(get_db)):
    try:
        print(f"Creating investment: {investment.ticker}")
        
        # Fetch current price
        current_price = await PriceFetcher.get_price(investment.asset_type, investment.ticker)
        print(f"Fetched price for {investment.ticker}: {current_price}")
        
        db_investment = Investment(
            **investment.dict(),
            current_price=current_price,
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
            investment_thesis=db_investment.investment_thesis or "",
            conviction_level=db_investment.conviction_level,
            purchase_date=db_investment.purchase_date,
            last_price_update=db_investment.last_price_update,
            **metrics
        )
    except Exception as e:
        db.rollback()
        print(f"Error creating investment: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create investment: {str(e)}")

@app.put("/api/investments/{investment_id}", response_model=InvestmentResponse)
async def update_investment(
    investment_id: int, 
    investment_update: InvestmentUpdate, 
    db: Session = Depends(get_db)
):
    db_investment = db.query(Investment).filter(Investment.id == investment_id).first()
    if not db_investment:
        raise HTTPException(status_code=404, detail="Investment not found")
    
    # Update fields
    for field, value in investment_update.dict(exclude_unset=True).items():
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
        investment_thesis=db_investment.investment_thesis or "",
        conviction_level=db_investment.conviction_level,
        purchase_date=db_investment.purchase_date,
        last_price_update=db_investment.last_price_update,
        **metrics
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
    investments = db.query(Investment).all()
    
    total_invested = 0
    current_value = 0
    conviction_counts = {"High": 0, "Medium": 0, "Low": 0}
    
    for investment in investments:
        total_invested += investment.units * investment.avg_buy_price
        current_value += investment.units * investment.current_price
        conviction_counts[investment.conviction_level] += 1
    
    total_unrealized_pnl = current_value - total_invested
    net_return_percent = (total_unrealized_pnl / total_invested * 100) if total_invested > 0 else 0
    
    return PortfolioStats(
        total_invested=total_invested,
        current_value=current_value,
        net_return_percent=net_return_percent,
        total_unrealized_pnl=total_unrealized_pnl,
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

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting server on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)


