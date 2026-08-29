from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.schemas import UserOut, UserProfileOut, UnlockedProductOut, WishlistItemOut, UserOrderOut
from app import services

router = APIRouter(prefix="/api/user", tags=["user"])


def build_user_out(user) -> UserOut:
    info = services.user_display_info(user)
    return UserOut(
        id=user.id,
        discord_id=user.discord_id,
        discord_username=user.discord_username,
        ign=user.ign,
        display_name=info["display_name"],
        connection_type=info["connection_type"],
        is_admin=settings.is_admin_discord_id(user.discord_id),
    )


@router.get("/me", response_model=UserOut | None)
async def get_me(
    session_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
):
    user = await services.get_user_by_session(db, session_token)
    if not user:
        return None
    return build_user_out(user)


@router.get("/profile", response_model=UserProfileOut | None)
async def get_profile(
    session_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
):
    user = await services.get_user_by_session(db, session_token)
    if not user:
        return None

    profile = await services.get_user_profile(db, user.id)
    if not profile:
        return None

    user, unlocked = profile
    info = services.user_display_info(user)
    return UserProfileOut(
        id=user.id,
        discord_id=user.discord_id,
        discord_username=user.discord_username,
        ign=user.ign,
        display_name=info["display_name"],
        connection_type=info["connection_type"],
        unlocked_products=[
            UnlockedProductOut(id=u.id, product=u.product, unlocked_at=u.unlocked_at) for u in unlocked
        ],
    )


@router.get("/orders", response_model=list[UserOrderOut])
async def get_orders(
    session_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
):
    user = await services.get_user_by_session(db, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Nicht angemeldet")

    orders = await services.get_user_orders(db, user.id)
    return [
        UserOrderOut(
            id=o.id,
            product_name=o.product.name if o.product else None,
            amount=o.amount,
            status=o.status.value,
            ign=o.ign,
            created_at=o.created_at,
        )
        for o in orders
    ]


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
