import os

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import User
from app import services
from sqlalchemy import select

router = APIRouter(prefix="/api/auth/discord", tags=["auth"])


@router.get("/login")
async def discord_login():
    if not settings.discord_client_id:
        raise HTTPException(status_code=503, detail="Discord OAuth nicht konfiguriert")
    params = {
        "client_id": settings.discord_client_id,
        "redirect_uri": settings.discord_redirect_uri,
        "response_type": "code",
        "scope": "identify",
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(f"https://discord.com/api/oauth2/authorize?{query}")


@router.get("/callback")
async def discord_callback(code: str, db: AsyncSession = Depends(get_db)):
    if not settings.discord_client_id or not settings.discord_client_secret:
        raise HTTPException(status_code=503, detail="Discord OAuth nicht konfiguriert")

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://discord.com/api/oauth2/token",
            data={
                "client_id": settings.discord_client_id,
                "client_secret": settings.discord_client_secret,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.discord_redirect_uri,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Discord Auth fehlgeschlagen")
        token_data = token_resp.json()

        user_resp = await client.get(
            "https://discord.com/api/users/@me",
            headers={"Authorization": f"Bearer {token_data['access_token']}"},
        )
        if user_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Discord User abrufen fehlgeschlagen")
        discord_user = user_resp.json()

    discord_id = str(discord_user["id"])
    discord_username = discord_user.get("global_name") or discord_user.get("username", "")

    result = await db.execute(select(User).where(User.discord_id == discord_id))
    user = result.scalar_one_or_none()
    if not user:
        user = User(discord_id=discord_id, discord_username=discord_username)
        db.add(user)
    else:
        user.discord_username = discord_username
        await db.commit()
        await db.refresh(user)

    session_token = await services.create_session_for_user(db, user)
    response = RedirectResponse(f"{settings.frontend_url}/account?linked=discord")
    response.set_cookie(key="session_token", value=session_token, httponly=True, samesite="lax", max_age=60 * 60 * 24 * 30)
    return response
