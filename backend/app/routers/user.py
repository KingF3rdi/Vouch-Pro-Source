from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import UserOut, WishlistItemOut
from app import services

router = APIRouter(prefix="/api/user", tags=["user"])


@router.get("/me", response_model=UserOut | None)
async def get_me(
    session_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
):
    user = await services.get_user_by_session(db, session_token)
    return user


@router.post("/wishlist/{product_id}")
async def toggle_wishlist(
    product_id: int,
    session_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
):
    user = await services.get_user_by_session(db, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Nicht eingeloggt")
    added = await services.toggle_wishlist(db, user.id, product_id)
    return {"added": added}


@router.get("/wishlist", response_model=list[WishlistItemOut])
async def get_wishlist(
    session_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
):
    user = await services.get_user_by_session(db, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Nicht eingeloggt")

    items = await services.get_wishlist(db, user.id)
    return [
        WishlistItemOut(
            id=i["item"].id,
            product=i["item"].product,
            price_at_add=i["item"].price_at_add,
            price_changed=i["price_changed"],
        )
        for i in items
    ]
