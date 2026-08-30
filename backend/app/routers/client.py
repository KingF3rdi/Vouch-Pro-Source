from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas_client import ClientLinkRedeem, ClientPaymentConfirm
from app import services

router = APIRouter(prefix="/api/client", tags=["client-mod"])


@router.post("/link/redeem")
async def client_redeem_link(body: ClientLinkRedeem, db: AsyncSession = Depends(get_db)):
    """Ingame-Mod: Link-Code mit Spieler-IGN einlösen (ohne Bot-API-Key)."""
    try:
        user = await services.redeem_link_code_ingame(db, body.code.upper(), body.ign)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    info = services.user_display_info(user)
    return {
        "success": True,
        "ign": user.ign,
        "connection_type": info["connection_type"],
        "display_name": info["display_name"],
    }


@router.get("/payment/pending")
async def client_pending_payment(
    ign: str = Query(..., min_length=1, max_length=16),
    db: AsyncSession = Depends(get_db),
):
    """Client-Mod: offene Zahlung inkl. Code für diesen IGN."""
    pending = await services.get_pending_payment_for_ign(db, ign)
    if not pending:
        return {"pending": False}
    return {"pending": True, **pending}


@router.post("/payment/confirm")
async def client_confirm_payment(body: ClientPaymentConfirm, db: AsyncSession = Depends(get_db)):
    """Ingame-Mod: Zahlung melden nach /pay (Spieler-Client, kein Server-Plugin)."""
    orders = await services.confirm_payment(
        db,
        ign=body.ign,
        amount=body.amount,
        payment_reference="client-mod",
        payment_code=body.payment_code,
    )
    if not orders:
        return {"success": False, "message": "Keine passende Bestellung gefunden"}
    primary = orders[0]
    return {
        "success": True,
        "order_id": primary.id,
        "order_ids": [o.id for o in orders],
        "orders_confirmed": len(orders),
    }
