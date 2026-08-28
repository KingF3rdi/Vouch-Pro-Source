from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import verify_bot_api_key
from app.schemas import (
    BotPaymentConfirm,
    BotPriceChangeNotify,
    BotProductCreate,
    BotSaleSync,
    BotVouchSync,
    ProductOut,
    UserOut,
    WishlistItemOut,
)
from app import services

router = APIRouter(prefix="/api/bot", tags=["bot-integration"], dependencies=[Depends(verify_bot_api_key)])


@router.post("/products", response_model=ProductOut)
async def bot_create_product(body: BotProductCreate, db: AsyncSession = Depends(get_db)):
    product = await services.create_product_from_bot(db, body.model_dump())
    return product


@router.post("/sales/sync")
async def bot_sync_sale(body: BotSaleSync, db: AsyncSession = Depends(get_db)):
    try:
        order = await services.sync_sale_from_bot(
            db,
            ign=body.ign,
            amount=body.amount,
            product_id=body.product_id,
            product_slug=body.product_slug,
            discord_id=body.discord_id,
            discount_code=body.discount_code,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"success": True, "order_id": order.id}


@router.post("/vouches/sync")
async def bot_sync_vouch(body: BotVouchSync, db: AsyncSession = Depends(get_db)):
    vouch = await services.sync_vouch(db, body.model_dump())
    return {"success": True, "vouch_id": vouch.id}


@router.post("/payments/confirm")
async def bot_confirm_payment(body: BotPaymentConfirm, db: AsyncSession = Depends(get_db)):
    order = await services.confirm_payment(
        db,
        ign=body.ign,
        amount=body.amount,
        order_id=body.order_id,
        payment_reference=body.payment_reference,
    )
    if not order:
        return {"success": False, "message": "Keine passende Bestellung gefunden"}
    return {"success": True, "order_id": order.id, "status": order.status.value}


@router.get("/stats")
async def bot_stats(db: AsyncSession = Depends(get_db)):
    return await services.get_stats(db)


@router.get("/wishlist/price-alerts/{product_id}")
async def bot_price_alerts(product_id: int, db: AsyncSession = Depends(get_db)):
    """Gibt Discord-IDs zurück, die bei Preisänderung benachrichtigt werden sollen."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models import WishlistItem, User

    result = await db.execute(
        select(WishlistItem)
        .options(selectinload(WishlistItem.user))
        .where(WishlistItem.product_id == product_id)
    )
    items = result.scalars().all()
    discord_ids = [i.user.discord_id for i in items if i.user and i.user.discord_id]
    return {"discord_ids": discord_ids}


@router.post("/products/{product_id}/price")
async def bot_update_price(product_id: int, body: BotPriceChangeNotify, db: AsyncSession = Depends(get_db)):
    try:
        product, old_price = await services.update_product_price(db, product_id, body.new_price)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    alerts = await bot_price_alerts(product_id, db)
    return {
        "success": True,
        "old_price": old_price,
        "new_price": product.price,
        "notify_discord_ids": alerts["discord_ids"],
    }
