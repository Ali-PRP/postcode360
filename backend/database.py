import os
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path, override=True)

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

print(f"[DB INIT] Loading DATABASE_URL from: {env_path}")
print(f"[DB INIT] Raw URL present: {bool(DATABASE_URL)}")

# Normalize URI to use psycopg (Psycopg 3), which is verified working on Python 3.14
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql+psycopg2://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql+psycopg2://", "postgresql+psycopg://", 1)

engine = None
SessionLocal = None

if DATABASE_URL and "[YOUR-PASSWORD]" not in DATABASE_URL:
    try:
        engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
        )
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        print("[DB INIT] SQLAlchemy engine successfully created!")
    except Exception as e:
        print(f"[DB INIT ERROR] Failed to create engine: {e}")
else:
    print("[DB INIT WARNING] DATABASE_URL is missing or contains placeholder '[YOUR-PASSWORD]'!")


def get_db():
    if SessionLocal is None:
        yield None
        return
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()