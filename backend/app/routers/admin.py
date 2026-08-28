from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import require_admin_user
from app.models import User
from app.schemas import (
    AdminCategoryCreate,
    AdminDiscountCodeCreate,
    AdminDiscountCodeOut,
    AdminDiscountCodeUpdate,
    AdminProductCreate,
    AdminProductUpdate,
    CategoryOut,
    ProductOut,
)
from app import services

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/products", response_model=list[ProductOut])
async def admin_list_products(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin_user),
):
    return await services.list_products_admin(db)


@router.post("/products", response_model=ProductOut)
async def admin_create_product(
    body: AdminProductCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin_user),
):
    product = await services.create_product_from_bot(db, body.model_dump())
    return product


@router.patch("/products/{product_id}", response_model=ProductOut)
async def admin_update_product(
    product_id: int,
    body: AdminProductUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin_user),
):
    try:
        return await services.update_product_admin(
            db, product_id, body.model_dump(exclude_unset=True)
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/products/{product_id}", response_model=ProductOut)
async def admin_deactivate_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin_user),
):
    try:
        return await services.deactivate_product_admin(db, product_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/categories", response_model=list[CategoryOut])
async def admin_list_categories(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin_user),
):
    return await services.get_categories(db)


@router.post("/categories", response_model=CategoryOut)
async def admin_create_category(
    body: AdminCategoryCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin_user),
):
    try:
        return await services.create_category_admin(db, body.name, body.slug)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/discount-codes", response_model=list[AdminDiscountCodeOut])
async def admin_list_discount_codes(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin_user),
):
    return await services.list_discount_codes_admin(db)


@router.post("/discount-codes", response_model=AdminDiscountCodeOut)
async def admin_create_discount_code(
    body: AdminDiscountCodeCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin_user),
):
    try:
        return await services.create_discount_code_admin(
            db,
            body.code,
            body.discount_percent,
            body.creator_name,
            body.creator_discord_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/discount-codes/{code_id}", response_model=AdminDiscountCodeOut)
async def admin_update_discount_code(
    code_id: int,
    body: AdminDiscountCodeUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin_user),
):
    try:
        return await services.update_discount_code_admin(
            db, code_id, body.model_dump(exclude_unset=True)
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
