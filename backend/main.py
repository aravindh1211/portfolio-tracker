import os
import asyncio
from datetime import datetime, timedelta
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, Security, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, computed_field
import requests
import yfinance as yf
import pandas as pd
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, ForeignKey, Uuid
from sqlalchemy.orm import sessionmaker, Session, declarative_base, relationship
from supabase import create_client, Client

# --- CONFIGURATION & ENVIRONMENT VARIABLES ---
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./portfolio.db")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY")

# CORS origins configuration
ALLOWED_ORIGINS = [
    "http://localhost:3000",  # Local development
]

# Add production frontend URL if in production
FRONTEND_URL = os.getenv("FRONTEND_URL")
if FRONTEND_URL:
    ALLOWED_ORIGINS.append(FRONTEND_URL)

# In development, allow all origins
if os.getenv("ENVIRONMENT") == "development":
    ALLOWED_ORIGINS = ["*"]

# --- DATABASE & SUPABASE CLIENT SETUP ---
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Initialize Supabase client
supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

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
        # Use the Supabase client to verify the token and get the user
        user_response = supabase_client.auth.get_user(token)
        user_id = user_response.user.id
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        return User(id=str(user_id))
    except Exception:
        # If get_user fails, the token is invalid
        raise HTTPException(status_code=401, detail="Could not validate credentials")


# --- EXTERNAL API SERVICES ---
class APIService:
    _usdinr_rate = None
    _usdinr_last_update = None

    async def get_usdinr_rate(self) -> float:
        if self._usdinr_rate and self._usdinr_last_update and (datetime.utcnow() - self._usdinr_last_update).seconds < 3600:
            return self._usdinr_rate
        try:
            response = requests.get("https://api.exchangerate-api.com/v4/latest/USD")
            response.raise_for_status()
            self._usdinr_rate = response.json()['rates']['INR']
            self._usdinr_last_update = datetime.utcnow()
            return self._usdinr_rate
        except Exception as e:
            print(f"Error fetching USD/INR rate: {e}. Using fallback rate of 83.0")
            return 83.0

    async def get_price(self, asset_type: str, ticker: str) -> float:
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period="1d")
            if not hist.empty:
                return float(hist['Close'].iloc[-1])
            return 0.0
        except Exception:
            if asset_type.lower() in ["stock", "us equity", "ind equity"] and FINNHUB_API_KEY:
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

# --- PYDANTIC MODELS (unchanged from previous version) ---
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

# ADD CORS MIDDLEWARE AFTER APP IS CREATED
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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

# ... (rest of your routes remain the same)
