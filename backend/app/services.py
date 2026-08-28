import secrets
import string
from datetime import datetime, timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Category,
    DiscountCode,
    LinkCode,
    LinkCodeType,
    Order,
    OrderStatus,
    Product,
    ProductMedia,
    ShopStats,
    UnlockedProduct,
    User,
    Vouch,
    WishlistItem,
)

EXCLUDED_CATEGORY_SLUGS = frozenset({"shader"})


def _shader_category_ids_subquery():
    return select(Category.id).where(Category.slug.in_(EXCLUDED_CATEGORY_SLUGS))


def _active_product_filters():
    return (
        Product.is_active == True,
        or_(
            Product.category_id.is_(None),
            Product.category_id.not_in(_shader_category_ids_subquery()),
        ),
    )


def generate_code(length: int = 8) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def slugify(name: str) -> str:
    slug = name.lower().strip()
    for ch in " /\\&":
        slug = slug.replace(ch, "-")
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug.strip("-")[:200]


async def get_or_create_stats(db: AsyncSession) -> ShopStats:
    result = await db.execute(select(ShopStats))
    stats = result.scalar_one_or_none()
    if not stats:
        stats = ShopStats(total_revenue=0.0, total_sales=0)
        db.add(stats)
        await db.commit()
        await db.refresh(stats)
    return stats


async def get_stats(db: AsyncSession) -> dict:
    stats = await get_or_create_stats(db)
    vouch_count = await db.scalar(select(func.count()).select_from(Vouch))
    return {
        "total_revenue": stats.total_revenue,
        "total_sales": stats.total_sales,
        "total_vouches": vouch_count or 0,
    }


async def get_vouch_summary(db: AsyncSession, limit: int = 3) -> dict:
    total = await db.scalar(select(func.count()).select_from(Vouch)) or 0
    result = await db.execute(
        select(Vouch).where(Vouch.is_positive == True).order_by(Vouch.created_at.desc()).limit(limit)
    )
    examples = result.scalars().all()
    return {"total": total, "examples": examples}


async def get_bestsellers(db: AsyncSession, limit: int = 8):
    result = await db.execute(
        select(Product)
        .options(selectinload(Product.category))
        .where(*_active_product_filters())
        .order_by(Product.sales_count.desc(), Product.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()


async def get_new_products(db: AsyncSession, limit: int = 8):
    result = await db.execute(
        select(Product)
        .options(selectinload(Product.category))
        .where(*_active_product_filters(), Product.is_new == True)
        .order_by(Product.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()


async def search_products(
    db: AsyncSession,
    q: str = "",
    category_slug: str | None = None,
    tag: str | None = None,
    limit: int = 50,
):
    query = (
        select(Product)
        .options(selectinload(Product.category))
        .where(*_active_product_filters())
    )

    if q:
        like = f"%{q.lower()}%"
        query = query.where(
            or_(
                func.lower(Product.name).like(like),
                func.lower(Product.description).like(like),
                func.lower(Product.tags).like(like),
            )
        )

    if category_slug:
        if category_slug in EXCLUDED_CATEGORY_SLUGS:
            return []
        query = query.join(Category).where(Category.slug == category_slug)

    if tag:
        query = query.where(func.lower(Product.tags).like(f"%{tag.lower()}%"))

    result = await db.execute(query.order_by(Product.sales_count.desc()).limit(limit))
    return result.scalars().all()


async def get_product_by_slug(db: AsyncSession, slug: str) -> Product | None:
    result = await db.execute(
        select(Product)
        .options(selectinload(Product.category), selectinload(Product.media))
        .where(Product.slug == slug, *_active_product_filters())
    )
    return result.scalar_one_or_none()


async def get_similar_products(db: AsyncSession, product: Product, limit: int = 4):
    """Zuerst gleiche Kategorie, dann Tag-Fallback."""
    similar: list[Product] = []

    if product.category_id:
        result = await db.execute(
            select(Product)
            .options(selectinload(Product.category))
            .where(
                Product.id != product.id,
                *_active_product_filters(),
                Product.category_id == product.category_id,
            )
            .order_by(Product.sales_count.desc(), Product.created_at.desc())
            .limit(limit)
        )
        similar = list(result.scalars().all())

    if len(similar) < limit and product.tags:
        tags = [t.strip() for t in product.tags.split(",") if t.strip()]
        for tag in tags:
            tag_result = await db.execute(
                select(Product)
                .options(selectinload(Product.category))
                .where(
                    Product.id != product.id,
                    *_active_product_filters(),
                    func.lower(Product.tags).like(f"%{tag.lower()}%"),
                )
                .order_by(Product.sales_count.desc())
                .limit(limit)
            )
            for p in tag_result.scalars().all():
                if p not in similar:
                    similar.append(p)
                if len(similar) >= limit:
                    break
            if len(similar) >= limit:
                break

    return similar[:limit]


async def get_categories(db: AsyncSession):
    result = await db.execute(
        select(Category)
        .where(Category.slug.not_in(EXCLUDED_CATEGORY_SLUGS))
        .order_by(Category.name)
    )
    return result.scalars().all()


async def deactivate_shader_products(db: AsyncSession):
    shader_ids = (
        await db.scalars(select(Category.id).where(Category.slug.in_(EXCLUDED_CATEGORY_SLUGS)))
    ).all()
    if not shader_ids:
        return
    result = await db.execute(
        select(Product).where(Product.category_id.in_(shader_ids), Product.is_active == True)
    )
    for product in result.scalars().all():
        product.is_active = False


async def create_link_code(
    db: AsyncSession,
    code_type: LinkCodeType,
    discord_id: str | None = None,
    ign: str | None = None,
) -> LinkCode:
    code = generate_code()
    link = LinkCode(
        code=code,
        code_type=code_type,
        discord_id=discord_id,
        ign=ign,
        expires_at=datetime.utcnow() + timedelta(minutes=15),
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return link


async def redeem_link_code(
    db: AsyncSession,
    code: str,
    ign: str | None = None,
    discord_id: str | None = None,
) -> User:
    result = await db.execute(select(LinkCode).where(LinkCode.code == code.upper()))
    link = result.scalar_one_or_none()
    if not link or link.used or link.expires_at < datetime.utcnow():
        raise ValueError("Ungültiger oder abgelaufener Code")

    user: User | None = None

    if link.code_type == LinkCodeType.discord:
        if not ign:
            raise ValueError("IGN erforderlich zum Verknüpfen")
        if not link.discord_id and not discord_id:
            raise ValueError("Discord-ID fehlt")
        target_discord = link.discord_id or discord_id
        result = await db.execute(select(User).where(User.discord_id == target_discord))
        user = result.scalar_one_or_none()
        if not user:
            user = User(discord_id=target_discord)
            db.add(user)
        user.ign = ign
        link.used = True

    elif link.code_type == LinkCodeType.ign:
        if not discord_id:
            raise ValueError("Discord-ID erforderlich zum Verknüpfen")
        if not link.ign:
            raise ValueError("IGN im Code fehlt")
        result = await db.execute(select(User).where(User.discord_id == discord_id))
        user = result.scalar_one_or_none()
        if not user:
            user = User(discord_id=discord_id)
            db.add(user)
        user.ign = link.ign
        link.used = True

    await db.commit()
    if user:
        await db.refresh(user)
    return user


async def get_user_by_session(db: AsyncSession, token: str | None) -> User | None:
    if not token:
        return None
    result = await db.execute(select(User).where(User.session_token == token))
    return result.scalar_one_or_none()


async def create_session_for_user(db: AsyncSession, user: User) -> str:
    token = secrets.token_urlsafe(32)
    user.session_token = token
    await db.commit()
    return token


async def validate_discount(db: AsyncSession, code: str) -> DiscountCode | None:
    result = await db.execute(
        select(DiscountCode).where(
            func.lower(DiscountCode.code) == code.lower(),
            DiscountCode.is_active == True,
        )
    )
    return result.scalar_one_or_none()


async def create_order(
    db: AsyncSession,
    product_id: int,
    ign: str,
    user_id: int | None = None,
    discount_code: str | None = None,
) -> Order:
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise ValueError("Produkt nicht gefunden")

    amount = product.price
    if discount_code:
        dc = await validate_discount(db, discount_code)
        if dc:
            amount = round(product.price * (1 - dc.discount_percent / 100), 2)
            dc.uses += 1

    order = Order(
        product_id=product.id,
        user_id=user_id,
        ign=ign,
        amount=amount,
        discount_code=discount_code,
        status=OrderStatus.pending,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return order


async def confirm_payment(
    db: AsyncSession,
    ign: str,
    amount: float,
    order_id: int | None = None,
    payment_reference: str | None = None,
) -> Order | None:
    if order_id:
        result = await db.execute(
            select(Order)
            .options(selectinload(Order.product))
            .where(
                Order.id == order_id,
                Order.status.in_([OrderStatus.pending, OrderStatus.ticket_open]),
            )
        )
        order = result.scalar_one_or_none()
    else:
        result = await db.execute(
            select(Order)
            .options(selectinload(Order.product))
            .where(
                Order.ign.ilike(ign),
                Order.amount == amount,
                Order.status.in_([OrderStatus.pending, OrderStatus.ticket_open]),
            )
            .order_by(Order.created_at.desc())
        )
        order = result.scalar_one_or_none()

    if not order:
        return None

    order.mc_confirmed = True
    order.payment_reference = payment_reference
    await finalize_order(db, order)
    return order


async def sync_sale_from_bot(
    db: AsyncSession,
    ign: str,
    amount: float,
    product_id: int | None = None,
    product_slug: str | None = None,
    discord_id: str | None = None,
    discount_code: str | None = None,
) -> Order:
    product: Product | None = None
    if product_id:
        result = await db.execute(select(Product).where(Product.id == product_id))
        product = result.scalar_one_or_none()
    elif product_slug:
        product = await get_product_by_slug(db, product_slug)

    if not product:
        raise ValueError("Produkt nicht gefunden")

    user_id = None
    if discord_id:
        result = await db.execute(select(User).where(User.discord_id == discord_id))
        user = result.scalar_one_or_none()
        if user:
            user_id = user.id

    order = await create_order(db, product.id, ign, user_id, discount_code)
    order.status = OrderStatus.paid
    order.discord_confirmed = True
    order.paid_at = datetime.utcnow()
    await db.flush()
    await finalize_order(db, order)
    return order


async def create_product_from_bot(db: AsyncSession, data: dict) -> Product:
    slug = slugify(data["name"])
    existing = await get_product_by_slug(db, slug)
    if existing:
        slug = f"{slug}-{secrets.token_hex(3)}"

    category_id = None
    if data.get("category_slug"):
        result = await db.execute(select(Category).where(Category.slug == data["category_slug"]))
        cat = result.scalar_one_or_none()
        if not cat:
            cat = Category(name=data["category_slug"].title(), slug=data["category_slug"])
            db.add(cat)
            await db.flush()
        category_id = cat.id

    product = Product(
        name=data["name"],
        slug=slug,
        description=data.get("description", ""),
        price=data["price"],
        preview_url=data.get("preview_url"),
        discord_role_id=data.get("discord_role_id"),
        category_id=category_id,
        tags=data.get("tags", ""),
        is_new=data.get("is_new", True),
    )
    db.add(product)
    await db.flush()

    for i, url in enumerate(data.get("media_urls", [])[:5]):
        db.add(ProductMedia(product_id=product.id, url=url, sort_order=i))

    await db.commit()
    await db.refresh(product)
    return product


async def sync_vouch(db: AsyncSession, data: dict) -> Vouch:
    if data.get("external_id"):
        result = await db.execute(select(Vouch).where(Vouch.external_id == data["external_id"]))
        existing = result.scalar_one_or_none()
        if existing:
            return existing

    vouch = Vouch(
        external_id=data.get("external_id"),
        giver_name=data["giver_name"],
        message=data["message"],
        is_positive=data.get("is_positive", True),
    )
    db.add(vouch)
    await db.commit()
    await db.refresh(vouch)
    return vouch


async def toggle_wishlist(db: AsyncSession, user_id: int, product_id: int) -> bool:
    result = await db.execute(
        select(WishlistItem).where(
            WishlistItem.user_id == user_id,
            WishlistItem.product_id == product_id,
        )
    )
    item = result.scalar_one_or_none()
    if item:
        await db.delete(item)
        await db.commit()
        return False

    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise ValueError("Produkt nicht gefunden")

    db.add(WishlistItem(user_id=user_id, product_id=product_id, price_at_add=product.price))
    await db.commit()
    return True


async def get_wishlist(db: AsyncSession, user_id: int):
    result = await db.execute(
        select(WishlistItem)
        .options(selectinload(WishlistItem.product).selectinload(Product.category))
        .where(WishlistItem.user_id == user_id)
    )
    items = result.scalars().all()
    output = []
    for item in items:
        output.append(
            {
                "item": item,
                "price_changed": item.product.price != item.price_at_add,
            }
        )
    return output


def user_display_info(user: User) -> dict:
    has_discord = bool(user.discord_id)
    has_ign = bool(user.ign)
    if has_discord and has_ign:
        connection_type = "both"
        display_name = user.discord_username or user.ign
    elif has_discord:
        connection_type = "discord"
        display_name = user.discord_username or f"User#{user.discord_id}"
    elif has_ign:
        connection_type = "minecraft"
        display_name = user.ign
    else:
        connection_type = None
        display_name = None
    return {"display_name": display_name, "connection_type": connection_type}


async def unlock_product_for_user(
    db: AsyncSession, user_id: int, product_id: int, order_id: int | None = None
) -> UnlockedProduct:
    result = await db.execute(
        select(UnlockedProduct).where(
            UnlockedProduct.user_id == user_id,
            UnlockedProduct.product_id == product_id,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    unlocked = UnlockedProduct(user_id=user_id, product_id=product_id, order_id=order_id)
    db.add(unlocked)
    await db.flush()
    return unlocked


async def finalize_order(db: AsyncSession, order: Order) -> Order:
    """Bestellung abschließen: Stats updaten, Produkt freischalten."""
    if order.status == OrderStatus.confirmed:
        return order

    if not order.product:
        result = await db.execute(select(Product).where(Product.id == order.product_id))
        order.product = result.scalar_one()

    product = order.product
    product.sales_count += 1

    stats = await get_or_create_stats(db)
    stats.total_sales += 1
    stats.total_revenue += order.amount

    order.status = OrderStatus.confirmed
    order.paid_at = datetime.utcnow()

    if order.user_id:
        await unlock_product_for_user(db, order.user_id, order.product_id, order.id)

    await db.commit()
    await db.refresh(order)

    # Kaufbestätigung in Discord (Log, Ticket, DM)
    if not order.confirmation_posted_at:
        user_result = await db.execute(select(User).where(User.id == order.user_id))
        buyer = user_result.scalar_one_or_none()
        from app.discord_notify import post_purchase_confirmation

        await post_purchase_confirmation(
            order_id=order.id,
            product_name=product.name,
            amount=order.amount,
            ign=order.ign,
            discord_user_id=buyer.discord_id if buyer else None,
            discord_username=buyer.discord_username if buyer else None,
            discount_code=order.discount_code,
            ticket_channel_id=order.ticket_channel_id,
        )
        order.confirmation_posted_at = datetime.utcnow()
        await db.commit()
        await db.refresh(order)

    return order


async def create_purchase_with_ticket(
    db: AsyncSession,
    product_id: int,
    user: User,
    ign: str,
    discount_code: str | None = None,
) -> Order:
    from app.discord_tickets import create_purchase_ticket

    if not user.discord_id:
        raise ValueError("Discord-Verbindung erforderlich für den Kauf. Bitte zuerst Discord verbinden.")

    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise ValueError("Produkt nicht gefunden")

    amount = product.price
    discount_percent = 0
    if discount_code:
        dc = await validate_discount(db, discount_code)
        if dc:
            discount_percent = dc.discount_percent
            amount = round(product.price * (1 - dc.discount_percent / 100), 2)
            dc.uses += 1

    order = Order(
        product_id=product.id,
        user_id=user.id,
        ign=ign or user.ign or "unknown",
        amount=amount,
        discount_code=discount_code if discount_percent else None,
        status=OrderStatus.pending,
    )
    db.add(order)
    await db.flush()

    ticket = await create_purchase_ticket(
        order_id=order.id,
        discord_user_id=user.discord_id,
        discord_username=user.discord_username or user.discord_id,
        ign=ign or user.ign or "—",
        product_name=product.name,
        product_price=product.price,
        final_amount=amount,
        discount_code=discount_code,
        discount_percent=discount_percent,
    )

    if ticket.get("success"):
        order.status = OrderStatus.ticket_open
        order.ticket_channel_id = ticket.get("channel_id")
        order.ticket_url = ticket.get("ticket_url")
    else:
        order.status = OrderStatus.pending

    await db.commit()
    await db.refresh(order)
    order.product = product
    return order


async def get_user_profile(db: AsyncSession, user_id: int):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return None

    unlocked_result = await db.execute(
        select(UnlockedProduct)
        .options(selectinload(UnlockedProduct.product).selectinload(Product.category))
        .where(UnlockedProduct.user_id == user_id)
        .order_by(UnlockedProduct.unlocked_at.desc())
    )
    unlocked = unlocked_result.scalars().all()
    return user, unlocked


async def get_recent_purchases(db: AsyncSession, limit: int = 8):
    from app.models import OrderStatus

    result = await db.execute(
        select(Order)
        .options(selectinload(Order.product), selectinload(Order.user))
        .where(Order.status == OrderStatus.confirmed)
        .order_by(Order.paid_at.desc())
        .limit(limit)
    )
    orders = result.scalars().all()
    output = []
    for o in orders:
        display = o.ign
        if o.user and o.user.discord_username:
            display = o.user.discord_username
        output.append(
            {
                "order_id": o.id,
                "product_name": o.product.name if o.product else "Pack",
                "buyer_display": display,
                "amount": o.amount,
                "confirmed_at": o.paid_at or o.created_at,
            }
        )
    return output


async def update_product_price(db: AsyncSession, product_id: int, new_price: float) -> Product:
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise ValueError("Produkt nicht gefunden")

    old_price = product.price
    product.price = new_price
    product.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(product)
    return product, old_price
