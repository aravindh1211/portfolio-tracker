import os
import asyncio
from datetime import datetime, timedelta
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, Security, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, JWTError
from pydantic import BaseModel, computed_field
import requests
import yfinance as yf
import pandas as pd
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, ForeignKey, Uuid
from sqlalchemy.orm import sessionmaker, Session, declarative_base, relationship

# --- CONFIGURATION & ENVIRONMENT VARIABLES ---
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./portfolio.db")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY")
JWT_SECRET = os.getenv("JWT_SECRET") # Supabase provides this in API settings

if not JWT_SECRET and SUPABASE_KEY:
    # In Supabase, the public key (anon key) can sometimes be used for basic validation, 
    # but the proper JWT secret is found in Dashboard -> Settings -> API -> JWT Settings
    print("Warning: JWT_SECRET not set. Using SUPABASE_KEY as a fallback. For production, please set the JWT_SECRET from your Supabase project settings.")
    JWT_SECRET = SUPABASE_KEY

# --- DATABASE SETUP ---
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- DATABASE MODELS ---
class Investment(Base):
    __tablename__ = "investments"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Uuid, nullable=False, index=True)
    asset_type = Column(String, nullable=False)
    ticker = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    units = Column(Float, nullable=False)
    currency = Column(String, default="INR", nullable=False)
    avg_buy_price_native = Column(Float, nullable=False)
    current_price_native = Column(Float, default=0.0)
    investment_thesis = Column(Text)
    conviction_level = Column(String, nullable=False)
    purchase_date = Column(DateTime, nullable=False)
    last_price_update = Column(DateTime, default=datetime.utcnow)
    category_id = Column(Integer, ForeignKey("categories.id"))
    subcategory_id = Column(Integer, ForeignKey("subcategories.id"))
    category = relationship("Category")
    subcategory = relationship("SubCategory")

class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Uuid, nullable=False)
    name = Column(String, nullable=False, index=True)
    subcategories = relationship("SubCategory", back_populates="category", cascade="all, delete-orphan")

class SubCategory(Base):
    __tablename__ = "subcategories"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Uuid, nullable=False)
    name = Column(String, nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"))
    category = relationship("Category", back_populates="subcategories")

class AllocationGoal(Base):
    __tablename__ = "allocation_goals"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Uuid, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"))
    percentage = Column(Float, nullable=False)
    category = relationship("Category")

# --- AUTHENTICATION ---
security = HTTPBearer()

class User(BaseModel):
    id: str

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"], audience="authenticated")
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        return User(id=user_id)
    except JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    except Exception:
        raise HTTPException(status_code=401, detail="Could not validate credentials")


# --- EXTERNAL API SERVICES ---
class APIService:
    _usdinr_rate = None
    _usdinr_last_update = None

    async def get_usdinr_rate(self) -> float:
        if self._usdinr_rate and self._usdinr_last_update and (datetime.utcnow() - self._usdinr_last_update).seconds < 3600:
            return self._usdinr_rate
        try:
            # Using a reliable free API for exchange rates
            response = requests.get("https://api.exchangerate-api.com/v4/latest/USD")
            response.raise_for_status()
            self._usdinr_rate = response.json()['rates']['INR']
            self._usdinr_last_update = datetime.utcnow()
            return self._usdinr_rate
        except Exception as e:
            print(f"Error fetching USD/INR rate: {e}. Using fallback rate of 83.0")
            return 83.0 # Fallback rate

    async def get_price(self, asset_type: str, ticker: str) -> float:
        try:
            # yfinance is still good for stocks/MFs
            stock = yf.Ticker(ticker)
            hist = stock.history(period="1d")
            if not hist.empty:
                return float(hist['Close'].iloc[-1])
            return 0.0
        except Exception:
            # Fallback for stocks can be Finnhub
            if asset_type.lower() in ["stock", "us equity", "ind equity"]:
                try:
                    res = requests.get(f'https://finnhub.io/api/v1/quote?symbol={ticker}&token={FINNHUB_API_KEY}')
                    res.raise_for_status()
                    return res.json().get('c', 0.0)
                except Exception as e:
                    print(f"Finnhub fallback failed for {ticker}: {e}")
            return 0.0
    
    async def get_news(self, ticker: str) -> List[dict]:
        if not FINNHUB_API_KEY: return []
        today = datetime.now().strftime('%Y-%m-%d')
        one_month_ago = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
        try:
            res = requests.get(f'https://finnhub.io/api/v1/company-news?symbol={ticker}&from={one_month_ago}&to={today}&token={FINNHUB_API_KEY}')
            res.raise_for_status()
            return res.json()
        except Exception as e:
            print(f"Error fetching news for {ticker}: {e}")
            return []

api_service = APIService()

# --- PYDANTIC MODELS ---
class CategoryBase(BaseModel):
    name: str

class CategoryCreate(CategoryBase): pass

class SubCategoryInDB(CategoryBase):
    id: int
    class Config: from_attributes = True

class CategoryInDB(CategoryBase):
    id: int
    subcategories: List[SubCategoryInDB] = []
    class Config: from_attributes = True

class SubCategoryCreate(CategoryBase):
    category_id: int

class AllocationGoalCreate(BaseModel):
    category_id: int
    percentage: float

class AllocationGoalInDB(BaseModel):
    id: int
    category_id: int
    percentage: float
    category_name: str
    class Config: from_attributes = True

class InvestmentBase(BaseModel):
    asset_type: str
    ticker: str
    name: str
    units: float
    currency: str = 'INR'
    avg_buy_price_native: float
    conviction_level: str
    purchase_date: datetime
    investment_thesis: Optional[str] = ""
    category_id: Optional[int] = None
    subcategory_id: Optional[int] = None

class InvestmentCreate(InvestmentBase): pass
class InvestmentUpdate(BaseModel):
    units: Optional[float] = None
    avg_buy_price_native: Optional[float] = None
    conviction_level: Optional[str] = None
    investment_thesis: Optional[str] = None
    category_id: Optional[int] = None
    subcategory_id: Optional[int] = None

class InvestmentResponse(InvestmentBase):
    id: int
    current_price_native: float
    last_price_update: datetime
    
    @computed_field
    @property
    def total_value_inr(self) -> float:
        # This will be calculated on the fly in the endpoint
        return 0.0
    
    @computed_field
    @property
    def unrealized_pnl_inr(self) -> float:
        return 0.0

    @computed_field
    @property
    def unrealized_pnl_percent(self) -> float:
        return 0.0

    class Config: from_attributes = True


# --- BACKGROUND TASK ---
async def update_all_prices():
    db = SessionLocal()
    try:
        investments = db.query(Investment).all()
        for investment in investments:
            if (datetime.utcnow() - investment.last_price_update).seconds > 900: # 15 mins
                new_price = await api_service.get_price(investment.asset_type, investment.ticker)
                if new_price > 0:
                    investment.current_price_native = new_price
                    investment.last_price_update = datetime.utcnow()
        db.commit()
    except Exception as e:
        print(f"Error updating prices: {e}")
        db.rollback()
    finally:
        db.close()

# --- APP LIFESPAN ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("API starting up...")
    async def price_update_loop():
        while True:
            await update_all_prices()
            await asyncio.sleep(900)
    task = asyncio.create_task(price_update_loop())
    yield
    task.cancel()
    print("API shutting down...")

# --- FASTAPI APP ---
app = FastAPI(
    title="Portfolio Tracker API v2.0",
    description="Advanced portfolio tracker with user auth and multi-currency support.",
    version="2.0.0",
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

# --- HELPER FUNCTIONS ---
async def calculate_investment_metrics(investment: Investment, usdinr_rate: float) -> dict:
    current_value_native = investment.units * investment.current_price_native
    total_invested_native = investment.units * investment.avg_buy_price_native
    
    if investment.currency.upper() == 'USD':
        total_value_inr = current_value_native * usdinr_rate
        total_invested_inr = total_invested_native * usdinr_rate
    else: # INR
        total_value_inr = current_value_native
        total_invested_inr = total_invested_native

    unrealized_pnl_inr = total_value_inr - total_invested_inr
    pnl_percent = (unrealized_pnl_inr / total_invested_inr * 100) if total_invested_inr > 0 else 0

    return {
        "total_value_inr": total_value_inr,
        "unrealized_pnl_inr": unrealized_pnl_inr,
        "unrealized_pnl_percent": pnl_percent,
    }

# --- API ROUTES ---

@app.get("/")
def root():
    return {"message": "Portfolio Tracker API v2.0", "status": "running"}

# --- CATEGORIES & SUBCATEGORIES ---
@app.get("/api/categories", response_model=List[CategoryInDB])
def get_categories(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Category).filter(Category.user_id == user.id).all()

@app.post("/api/categories", response_model=CategoryInDB)
def create_category(category: CategoryCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db_category = Category(**category.dict(), user_id=user.id)
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

@app.post("/api/subcategories", response_model=SubCategoryInDB)
def create_subcategory(subcategory: SubCategoryCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db_subcategory = SubCategory(**subcategory.dict(), user_id=user.id)
    db.add(db_subcategory)
    db.commit()
    db.refresh(db_subcategory)
    return db_subcategory

# ... Add PUT/DELETE for categories/subcategories if needed ...

# --- ALLOCATION GOALS ---
@app.get("/api/allocation-goals", response_model=List[AllocationGoalInDB])
def get_allocation_goals(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    goals = db.query(AllocationGoal).filter(AllocationGoal.user_id == user.id).all()
    return [{"id": g.id, "category_id": g.category_id, "percentage": g.percentage, "category_name": g.category.name} for g in goals]

@app.post("/api/allocation-goals")
def set_allocation_goals(goals: List[AllocationGoalCreate], db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # Simple approach: delete old goals, insert new ones
    db.query(AllocationGoal).filter(AllocationGoal.user_id == user.id).delete()
    for goal in goals:
        db_goal = AllocationGoal(user_id=user.id, category_id=goal.category_id, percentage=goal.percentage)
        db.add(db_goal)
    db.commit()
    return {"message": "Allocation goals updated successfully"}

# --- INVESTMENTS ---
@app.get("/api/investments", response_model=List[InvestmentResponse])
async def get_investments(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    investments = db.query(Investment).filter(Investment.user_id == user.id).all()
    usdinr_rate = await api_service.get_usdinr_rate()
    
    response = []
    for inv in investments:
        metrics = await calculate_investment_metrics(inv, usdinr_rate)
        inv_dict = inv.__dict__
        inv_dict.update(metrics)
        response.append(InvestmentResponse.model_validate(inv_dict))
    return response

@app.post("/api/investments", response_model=InvestmentResponse)
async def create_investment(investment: InvestmentCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    current_price = await api_service.get_price(investment.asset_type, investment.ticker)
    db_investment = Investment(
        **investment.dict(), 
        user_id=user.id,
        current_price_native=current_price
    )
    db.add(db_investment)
    db.commit()
    db.refresh(db_investment)

    usdinr_rate = await api_service.get_usdinr_rate()
    metrics = await calculate_investment_metrics(db_investment, usdinr_rate)
    inv_dict = db_investment.__dict__
    inv_dict.update(metrics)
    return InvestmentResponse.model_validate(inv_dict)

@app.put("/api/investments/{investment_id}", response_model=InvestmentResponse)
async def update_investment(investment_id: int, investment_data: InvestmentUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db_investment = db.query(Investment).filter(Investment.id == investment_id, Investment.user_id == user.id).first()
    if not db_investment:
        raise HTTPException(status_code=404, detail="Investment not found")
    
    for key, value in investment_data.model_dump(exclude_unset=True).items():
        setattr(db_investment, key, value)
    
    db.commit()
    db.refresh(db_investment)
    
    usdinr_rate = await api_service.get_usdinr_rate()
    metrics = await calculate_investment_metrics(db_investment, usdinr_rate)
    inv_dict = db_investment.__dict__
    inv_dict.update(metrics)
    return InvestmentResponse.model_validate(inv_dict)

@app.delete("/api/investments/{investment_id}")
def delete_investment(investment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db_investment = db.query(Investment).filter(Investment.id == investment_id, Investment.user_id == user.id).first()
    if not db_investment:
        raise HTTPException(status_code=404, detail="Investment not found")
    db.delete(db_investment)
    db.commit()
    return {"message": "Investment deleted"}

# --- PORTFOLIO STATS & REPORTS ---
@app.get("/api/reports/allocation-analysis")
async def get_allocation_analysis(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    investments = db.query(Investment).filter(Investment.user_id == user.id).all()
    goals = db.query(AllocationGoal).filter(AllocationGoal.user_id == user.id).all()
    usdinr_rate = await api_service.get_usdinr_rate()

    total_portfolio_value = 0
    current_allocation = {}

    for inv in investments:
        metrics = await calculate_investment_metrics(inv, usdinr_rate)
        value_inr = metrics['total_value_inr']
        total_portfolio_value += value_inr
        if inv.category:
            if inv.category.name not in current_allocation:
                current_allocation[inv.category.name] = 0
            current_allocation[inv.category.name] += value_inr
    
    current_allocation_percent = {
        cat: (val / total_portfolio_value * 100) if total_portfolio_value > 0 else 0
        for cat, val in current_allocation.items()
    }

    ideal_allocation = {g.category.name: g.percentage for g in goals}

    return {
        "total_portfolio_value_inr": total_portfolio_value,
        "current_allocation_by_value": current_allocation,
        "current_allocation_by_percent": current_allocation_percent,
        "ideal_allocation_by_percent": ideal_allocation
    }


# --- NEWS & UTILITIES ---
@app.get("/api/news")
async def get_portfolio_news(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    investments = db.query(Investment).filter(Investment.user_id == user.id, Investment.asset_type.not_in(['Crypto', 'Mutual Fund'])).all()
    unique_tickers = list(set([inv.ticker for inv in investments]))
    
    all_news = []
    for ticker in unique_tickers[:10]: # Limit to 10 to avoid rate limits
        news_items = await api_service.get_news(ticker)
        if news_items:
            # Add ticker to each news item for frontend grouping
            for item in news_items[:5]: # Max 5 news per ticker
                item['ticker'] = ticker
                all_news.append(item)
    
    return sorted(all_news, key=lambda x: x['datetime'], reverse=True)

@app.post("/api/investments/bulk-upload")
async def bulk_upload_investments(file: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        df = pd.read_excel(file.file)
        required_columns = ['asset_type', 'ticker', 'name', 'units', 'currency', 'avg_buy_price_native', 'conviction_level', 'purchase_date']
        if not all(col in df.columns for col in required_columns):
            raise HTTPException(status_code=400, detail=f"Missing required columns in Excel file. Required: {required_columns}")

        for _, row in df.iterrows():
            inv_data = InvestmentCreate(
                asset_type=row['asset_type'],
                ticker=row['ticker'],
                name=row['name'],
                units=row['units'],
                currency=row['currency'],
                avg_buy_price_native=row['avg_buy_price_native'],
                conviction_level=row['conviction_level'],
                purchase_date=pd.to_datetime(row['purchase_date'])
            )
            # Create the investment record
            await create_investment(inv_data, db, user)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")

    return {"message": f"Successfully processed {len(df)} records from the uploaded file."}


# --- MAIN EXECUTION ---
if __name__ == "__main__":
    import uvicorn
    # This part is for local development, Render uses the start command directly.
    port = int(os.environ.get("PORT", 8000))
    # Note: Render's start command should be: uvicorn backend.main:app --host 0.0.0.0 --port 8000
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
