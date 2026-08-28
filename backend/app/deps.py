from fastapi import Depends, Header, HTTPException
from app.config import settings


async def verify_bot_api_key(x_bot_api_key: str = Header(..., alias="X-Bot-Api-Key")):
    if x_bot_api_key != settings.bot_api_key:
        raise HTTPException(status_code=401, detail="Ungültiger Bot API Key")
    return True
