import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import Base, engine
from app.models import Category, DiscountCode, Product, ShopStats
from app.rate_limit import RateLimitMiddleware
from app.routers import auth, bot, shop, user
from app import services

app = FastAPI(title="TxTEmpire Shop API", version="1.0.0")

app.add_middleware(RateLimitMiddleware)

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
        # SQLite migration für neue Spalten
        migrations = [
            "ALTER TABLE users ADD COLUMN discord_username VARCHAR(100)",
            "ALTER TABLE orders ADD COLUMN ticket_channel_id VARCHAR(32)",
            "ALTER TABLE orders ADD COLUMN ticket_url VARCHAR(200)",
            "ALTER TABLE orders ADD COLUMN confirmation_posted_at DATETIME",
        ]
        for sql in migrations:
            try:
                await conn.execute(__import__("sqlalchemy").text(sql))
            except Exception:
                pass

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
            db.add(Category(name="Mods", slug="mods"))

        await services.deactivate_shader_products(db)
        await db.commit()


@app.get("/api/health")
async def health():
    return {"status": "ok"}
