import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import Base, engine
from app.models import Category, DiscountCode, ShopStats
from app.routers import auth, bot, shop, user

app = FastAPI(title="TxTEmpire Shop API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(settings.upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

app.include_router(shop.router)
app.include_router(bot.router)
app.include_router(user.router)
app.include_router(auth.router)


@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy import func, select

    async with AsyncSession(engine) as db:
        stats_count = await db.scalar(select(func.count()).select_from(ShopStats))
        if not stats_count:
            db.add(ShopStats(total_revenue=0, total_sales=0))

        codes_count = await db.scalar(select(func.count()).select_from(DiscountCode))
        if not codes_count:
            db.add(DiscountCode(code="CREATOR10", discount_percent=10, creator_name="TxTEmpire"))
            db.add(DiscountCode(code="RABATT10", discount_percent=10, creator_name="TxTEmpire"))

        cats_count = await db.scalar(select(func.count()).select_from(Category))
        if not cats_count:
            db.add(Category(name="Texture Packs", slug="texture-packs"))
            db.add(Category(name="Shader", slug="shader"))
            db.add(Category(name="Mods", slug="mods"))

        await db.commit()


@app.get("/api/health")
async def health():
    return {"status": "ok"}
