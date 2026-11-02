import json
import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = FastAPI(title="FindAm Unified Postcode Grid API", version="0.9.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("ALLOWED_ORIGIN", "*")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MOCK_FILE = Path(__file__).resolve().parent / "mock_postcodes.json"

@app.get("/health")
def system_health():
    return {
        "status": "OPERATIONAL",
        "mock_fallback_active": os.getenv("USE_MOCK_NIPOST", "true").lower() == "true",
    }

@app.get("/v1/lookup/{code}")
def lookup_postcode_day1_stub(code: str):
    normalized = code.strip().upper().replace(" ", "-")
    with open(MOCK_FILE, "r", encoding="utf-8") as f:
        mock_db = json.load(f)
    if normalized in mock_db:
        return {"source": "mock_cache", "data": mock_db[normalized]}
    raise HTTPException(status_code=404, detail=f"Postcode {normalized} not found in mock cache.")
