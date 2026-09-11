import uuid
from datetime import datetime, timedelta
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import settings
from ..database import get_db
from ..deps import get_current_user
from ..email_utils import send_reset_email
from ..security import (
    create_access_token,
    generate_reset_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


# ── Register ──────────────────────────────────────────────────────────────
@router.post("/register", response_model=schemas.Token, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    user = models.User(
        name=payload.name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(str(user.id))
    return schemas.Token(access_token=token, user=user)


# ── Login ─────────────────────────────────────────────────────────────────
@router.post("/login", response_model=schemas.Token)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()

    invalid = HTTPException(status_code=401, detail="Incorrect email or password")

    if not user or not user.hashed_password:
        raise invalid
    if not verify_password(payload.password, user.hashed_password):
        raise invalid
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account has been deactivated")

    token = create_access_token(str(user.id))
    return schemas.Token(access_token=token, user=user)


# ── Logout ────────────────────────────────────────────────────────────────
# JWTs are stateless, so "logout" is the client discarding its token.
# This endpoint exists for a consistent API surface and a place to hook in
# a token-blocklist (e.g. Redis) later if you need server-side revocation.
@router.post("/logout", response_model=schemas.MessageResponse)
def logout(current_user: models.User = Depends(get_current_user)):
    return schemas.MessageResponse(message="Logged out successfully")


# ── Current user ──────────────────────────────────────────────────────────
@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user


# ── Forgot / reset password ─────────────────────────────────────────────────
@router.post("/forgot-password", response_model=schemas.MessageResponse)
def forgot_password(payload: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()

    # Always return the same message whether or not the email exists,
    # so the endpoint can't be used to enumerate registered accounts.
    generic_message = schemas.MessageResponse(
        message="If an account exists for that email, a reset link has been sent."
    )

    if not user or not user.hashed_password:
        return generic_message

    token = generate_reset_token()
    reset_row = models.PasswordResetToken(
        user_id=user.id,
        token=token,
        expires_at=datetime.utcnow() + timedelta(minutes=settings.reset_token_expire_minutes),
    )
    db.add(reset_row)
    db.commit()

    reset_link = f"{settings.frontend_url}/reset-password?token={token}"
    send_reset_email(user.email, reset_link)

    return generic_message


@router.post("/reset-password", response_model=schemas.MessageResponse)
def reset_password(payload: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    reset_row = (
        db.query(models.PasswordResetToken)
        .filter(models.PasswordResetToken.token == payload.token)
        .first()
    )

    invalid = HTTPException(status_code=400, detail="This reset link is invalid or has expired")

    if not reset_row or reset_row.used or reset_row.expires_at < datetime.utcnow():
        raise invalid

    user = db.query(models.User).filter(models.User.id == reset_row.user_id).first()
    if not user:
        raise invalid

    user.hashed_password = hash_password(payload.new_password)
    reset_row.used = True
    db.commit()

    return schemas.MessageResponse(message="Password updated. You can now log in.")


# ── Google OAuth ─────────────────────────────────────────────────────────
@router.get("/google/login")
def google_login():
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
    }
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@router.get("/google/callback")
def google_callback(code: str, db: Session = Depends(get_db)):
    token_resp = httpx.post(
        GOOGLE_TOKEN_URL,
        data={
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": settings.google_redirect_uri,
            "grant_type": "authorization_code",
        },
        timeout=10,
    )
    if token_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Google authentication failed")

    google_token = token_resp.json()["access_token"]

    userinfo_resp = httpx.get(
        GOOGLE_USERINFO_URL,
        headers={"Authorization": f"Bearer {google_token}"},
        timeout=10,
    )
    if userinfo_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Could not fetch Google profile")

    profile = userinfo_resp.json()
    google_id = profile["sub"]
    email = profile["email"]
    name = profile.get("name", email.split("@")[0])

    user = db.query(models.User).filter(models.User.google_id == google_id).first()
    if not user:
        user = db.query(models.User).filter(models.User.email == email).first()

    if not user:
        user = models.User(name=name, email=email, google_id=google_id)
        db.add(user)
    elif not user.google_id:
        user.google_id = google_id

    db.commit()
    db.refresh(user)

    app_token = create_access_token(str(user.id))
    redirect_url = f"{settings.frontend_url}/oauth-callback?{urlencode({'token': app_token})}"
    return RedirectResponse(redirect_url)
