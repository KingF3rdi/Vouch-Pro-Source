from fastapi import APIRouter, Cookie, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import LinkCodeType
from app.schemas import (
    CategoryOut,
    DiscountValidateOut,
    DiscountValidateRequest,
    LinkCodeCreate,
    LinkCodeOut,
    LinkRedeemRequest,
    OrderCreate,
    OrderOut,
    ProductListItem,
    ProductOut,
    StatsOut,
    UserOut,
    VouchSummaryOut,
)
from app.routers.user import build_user_out
from app import services

router = APIRouter(prefix="/api", tags=["shop"])


@router.get("/stats", response_model=StatsOut)
async def stats(db: AsyncSession = Depends(get_db)):
    return await services.get_stats(db)


@router.get("/vouches", response_model=VouchSummaryOut)
async def vouches(db: AsyncSession = Depends(get_db)):
    data = await services.get_vouch_summary(db)
    return {"total": data["total"], "examples": data["examples"]}


@router.get("/products/bestsellers", response_model=list[ProductListItem])
async def bestsellers(db: AsyncSession = Depends(get_db)):
    return await services.get_bestsellers(db)


@router.get("/products/new", response_model=list[ProductListItem])
async def new_products(db: AsyncSession = Depends(get_db)):
    return await services.get_new_products(db)


@router.get("/products/search", response_model=list[ProductListItem])
async def search_products(
    q: str = Query(""),
    category: str | None = Query(None),
    tag: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await services.search_products(db, q, category, tag)


@router.get("/products/{slug}", response_model=ProductOut)
async def get_product(slug: str, db: AsyncSession = Depends(get_db)):
    product = await services.get_product_by_slug(db, slug)
    if not product:
        raise HTTPException(status_code=404, detail="Produkt nicht gefunden")
    return product


@router.get("/products/{slug}/similar", response_model=list[ProductListItem])
async def similar_products(slug: str, db: AsyncSession = Depends(get_db)):
    product = await services.get_product_by_slug(db, slug)
    if not product:
        raise HTTPException(status_code=404, detail="Produkt nicht gefunden")
    return await services.get_similar_products(db, product)


@router.get("/categories", response_model=list[CategoryOut])
async def categories(db: AsyncSession = Depends(get_db)):
    return await services.get_categories(db)


@router.post("/link/generate", response_model=LinkCodeOut)
async def generate_link_code(body: LinkCodeCreate, db: AsyncSession = Depends(get_db)):
    code_type = LinkCodeType.discord if body.code_type == "discord" else LinkCodeType.ign
    link = await services.create_link_code(db, code_type)
    return link


@router.post("/link/redeem", response_model=UserOut)
async def redeem_link_code(body: LinkRedeemRequest, response: Response, db: AsyncSession = Depends(get_db)):
    try:
        user = await services.redeem_link_code(db, body.code, body.ign, body.discord_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    token = await services.create_session_for_user(db, user)
    response.set_cookie(key="session_token", value=token, httponly=True, samesite="lax", max_age=60 * 60 * 24 * 30)
    return build_user_out(user)


@router.post("/discount/validate", response_model=DiscountValidateOut)
async def validate_discount(body: DiscountValidateRequest, db: AsyncSession = Depends(get_db)):
    dc = await services.validate_discount(db, body.code)
    if not dc:
        return DiscountValidateOut(valid=False, message="Ungültiger Code")
    return DiscountValidateOut(valid=True, discount_percent=dc.discount_percent, message="Code gültig")


@router.post("/orders", response_model=OrderOut)
async def create_order(
    body: OrderCreate,
    session_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
):
    user = await services.get_user_by_session(db, session_token)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Bitte zuerst Discord verbinden, um zu kaufen.",
        )

    try:
        order = await services.create_purchase_with_ticket(
            db,
            body.product_id,
            user,
            body.ign,
            body.discount_code,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    message = (
        "Discord-Ticket geöffnet! Schließe die Zahlung im Ticket ab."
        if order.ticket_url
        else "Bestellung erstellt — Discord-Ticket konnte nicht automatisch geöffnet werden."
    )

    return OrderOut(
        id=order.id,
        product_id=order.product_id,
        product_name=order.product.name if order.product else None,
        ign=order.ign,
        amount=order.amount,
        status=order.status.value,
        ticket_url=order.ticket_url,
        created_at=order.created_at,
        message=message,
    )
