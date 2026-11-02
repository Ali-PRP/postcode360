import hashlib
import hmac
import os
import time
import uuid
from pathlib import Path
from typing import Optional, Tuple
import jwt
from fastapi import HTTPException, Header
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "findam-super-secret-jwt-signing-key-2026")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_SECONDS = int(os.getenv("JWT_EXPIRY_SECONDS", "1800"))  # 30 minutes
PII_HASH_SALT = os.getenv("PII_HASH_SALT", "findam-pii-hmac-salt-nigeria-2026")

DEFAULT_ALLOWED_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "ALLOWED_ORIGIN",
        "http://localhost:3000,http://localhost:5173,http://localhost:8000,http://127.0.0.1:8000",
    ).split(",")
    if origin.strip()
]

# Origin-bound publishable key registry (maps publishable_key -> allowed origins & merchant metadata)
ORIGIN_BOUND_KEYS = {
    os.getenv("NIPOST_PUBLISHABLE_KEY", "pk_test_findam_abuja_01"): {
        "merchant_id": "merch_findam_default",
        "allowed_origins": DEFAULT_ALLOWED_ORIGINS,
    },
    "pk_test_findam_abuja_01": {
        "merchant_id": "merch_abuja_sandbox",
        "allowed_origins": DEFAULT_ALLOWED_ORIGINS,
    },
}


def hash_user_pii(nin: Optional[str] = None, email: Optional[str] = None) -> Tuple[str, str]:
    """
    Hashes the user's NIN or email using HMAC-SHA256 so raw PII is never exposed in JWTs or logs.
    Returns (identity_type, pii_hash_hex).
    """
    if nin and nin.strip():
        clean_nin = "".join(ch for ch in nin.strip() if ch.isdigit())
        if len(clean_nin) != 11:
            raise HTTPException(
                status_code=422,
                detail="Invalid NIN format. Nigerian NIN must be exactly 11 digits.",
            )
        digest = hmac.new(
            PII_HASH_SALT.encode("utf-8"),
            f"nin:{clean_nin}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return "nin", f"sha256:{digest}"

    if email and email.strip():
        clean_email = email.strip().lower()
        if "@" not in clean_email or "." not in clean_email.split("@")[-1]:
            raise HTTPException(
                status_code=422,
                detail="Invalid email address format.",
            )
        digest = hmac.new(
            PII_HASH_SALT.encode("utf-8"),
            f"email:{clean_email}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return "email", f"sha256:{digest}"

    raise HTTPException(
        status_code=422,
        detail="Either 'nin' or 'email' must be provided to initialize a widget session.",
    )


def verify_origin_bound_key(publishable_key: str, origin: Optional[str]) -> dict:
    """
    Validates that the publishable key exists and the request Origin header is permitted for that key.
    """
    key_record = ORIGIN_BOUND_KEYS.get(publishable_key)
    if not key_record:
        raise HTTPException(
            status_code=401,
            detail="Invalid widget publishable key.",
        )

    if not origin:
        raise HTTPException(
            status_code=403,
            detail="Missing 'Origin' header. Widget session keys are strictly origin-bound.",
        )

    normalized_origin = origin.strip().rstrip("/")
    if normalized_origin not in key_record["allowed_origins"]:
        raise HTTPException(
            status_code=403,
            detail=f"Origin '{normalized_origin}' is not authorized for this publishable key.",
        )

    return {
        "merchant_id": key_record["merchant_id"],
        "bound_origin": normalized_origin,
    }


def create_widget_jwt(
    pii_hash: str,
    identity_type: str,
    bound_origin: str,
    merchant_id: str,
) -> Tuple[str, int]:
    """
    Creates an HS256 JWT containing only the HMAC-SHA256 PII digest and origin binding.
    """
    now = int(time.time())
    exp = now + JWT_EXPIRY_SECONDS
    payload = {
        "jti": str(uuid.uuid4()),
        "sub": pii_hash,
        "id_type": identity_type,
        "merchant_id": merchant_id,
        "origin": bound_origin,
        "scope": "widget:lookup widget:alias",
        "iat": now,
        "exp": exp,
    }
    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return token, JWT_EXPIRY_SECONDS


def verify_widget_jwt(
    authorization: str = Header(..., description="Bearer <session_token>"),
    origin: Optional[str] = Header(default=None),
) -> dict:
    """
    FastAPI dependency to verify a widget JWT and enforce origin binding on protected widget routes.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization header must use Bearer token.")

    token = authorization.split(" ", 1)[1].strip()
    try:
        claims = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Widget session token has expired.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid widget session token.")

    if origin and origin.strip().rstrip("/") != claims.get("origin"):
        raise HTTPException(
            status_code=403,
            detail="Token origin mismatch. Session token cannot be used from a different origin.",
        )

    return claims
