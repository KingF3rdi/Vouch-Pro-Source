from fastapi import Cookie, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import User
from app import services


async def verify_bot_api_key(x_bot_api_key: str = Header(..., alias="X-Bot-Api-Key")):
    if x_bot_api_key != settings.bot_api_key:
        raise HTTPException(status_code=401, detail="Ungültiger Bot API Key")
    return True


async def get_current_user_dep(
    session_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    if not session_token:
        return None
    return await services.get_user_by_session(db, session_token)


async def require_admin_user(user: User | None = Depends(get_current_user_dep)) -> User:
    if not user:
        raise HTTPException(status_code=401, detail="Nicht angemeldet")
    if not settings.is_admin_discord_id(user.discord_id):
        raise HTTPException(status_code=403, detail="Keine Admin-Berechtigung")
    return user
