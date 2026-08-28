"""
Seed-Script: Beispiel-Produkte für Demo/Testing
Usage: cd backend && python -m app.seed
"""
import asyncio

from app.database import AsyncSessionLocal, Base, engine
from app.models import Category, DiscountCode, Product, ProductMedia, ShopStats, Vouch
from app.services import slugify


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        stats = await db.get(ShopStats, 1)
        if not stats:
            db.add(ShopStats(total_revenue=1250.0, total_sales=47))

        cat_tp = Category(name="Texture Packs", slug="texture-packs")
        cat_shader = Category(name="Shader", slug="shader")
        db.add_all([cat_tp, cat_shader])
        await db.flush()

        products = [
            Product(
                name="TxTEmpire Realistic HD",
                slug="txtempire-realistic-hd",
                description="TxTEmpire Signature Pack — Ultra-realistisches 256x Texture Pack mit PBR Support.",
                price=9.99,
                preview_url="https://placehold.co/600x400/1a2332/4ade80?text=Realistic+HD",
                discord_role_id="1234567890",
                category_id=cat_tp.id,
                tags="realistic,hd,pbr,256x",
                sales_count=23,
                is_new=False,
            ),
            Product(
                name="TxTEmpire Neon Shader",
                slug="txtempire-neon-shader",
                description="TxTEmpire Neon Shader Pro — Leuchtende Shader mit Custom Lighting und Bloom.",
                price=14.99,
                preview_url="https://placehold.co/600x400/1a2332/fbbf24?text=Neon+Shader",
                discord_role_id="1234567891",
                category_id=cat_shader.id,
                tags="shader,neon,bloom",
                sales_count=18,
                is_new=True,
            ),
            Product(
                name="Medieval Pack Vol.2",
                slug="medieval-pack-vol2",
                description="Mittelalterliches Texture Pack mit 128x Auflösung.",
                price=7.50,
                preview_url="https://placehold.co/600x400/1a2332/8b9cb3?text=Medieval",
                category_id=cat_tp.id,
                tags="medieval,128x,rpg",
                sales_count=6,
                is_new=True,
            ),
        ]
        db.add_all(products)
        await db.flush()

        db.add_all([
            ProductMedia(product_id=products[0].id, url="https://placehold.co/600x400/243044/4ade80?text=Preview+2", sort_order=0),
            ProductMedia(product_id=products[0].id, url="https://placehold.co/600x400/243044/4ade80?text=Preview+3", sort_order=1),
        ])

        db.add_all([
            Vouch(giver_name="MaxMC", message="Super schnelle Lieferung, Pack ist mega!", is_positive=True),
            Vouch(giver_name="CraftKing", message="Beste Shader die ich je hatte, 10/10", is_positive=True),
            Vouch(giver_name="PixelPro", message="Sehr zufrieden, gerne wieder!", is_positive=True),
        ])

        db.add(DiscountCode(code="CREATOR10", discount_percent=10, creator_name="Default"))
        db.add(DiscountCode(code="RABATT10", discount_percent=10, creator_name="Shop"))

        await db.commit()
        print("Seed abgeschlossen!")


if __name__ == "__main__":
    asyncio.run(seed())
