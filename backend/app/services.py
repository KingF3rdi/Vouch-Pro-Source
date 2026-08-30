import secrets
import string
from datetime import datetime, timedelta

from sqlalchemy import delete, func, or_, select
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

SHADER_MARKERS = ("shader", "shaders")


def _amounts_equal(a: float, b: float) -> bool:
    return round(float(a), 2) == round(float(b), 2)


def _new_cart_group_id() -> str:
    return secrets.token_hex(8)


def _contains_shader_marker(value: str | None) -> bool:
    if not value:
        return False
    normalized = value.lower().replace("_", "-")
    return any(marker in normalized for marker in SHADER_MARKERS)


def _is_shader_slug(slug: str | None) -> bool:
    if not slug:
        return False
    normalized = slug.lower().strip()
    return normalized in SHADER_MARKERS or _contains_shader_marker(normalized)


def _is_shader_category(category: Category | None) -> bool:
    if not category:
        return False
    return _is_shader_slug(category.slug) or _contains_shader_marker(category.name)


def _is_shader_product(product: Product) -> bool:
    return (
        _contains_shader_marker(product.name)
        or _contains_shader_marker(product.slug)
        or _contains_shader_marker(product.tags)
        or _is_shader_category(product.category)
    )


def _shader_category_filter():
    return or_(
        func.lower(Category.slug).like("%shader%"),
        func.lower(Category.name).like("%shader%"),
    )


def _shader_product_filter():
    return or_(
        func.lower(Product.name).like("%shader%"),
        func.lower(Product.slug).like("%shader%"),
        func.lower(Product.tags).like("%shader%"),
        Product.category_id.in_(select(Category.id).where(_shader_category_filter())),
    )


def _active_product_filters():
    return (
        Product.is_active == True,
        ~_shader_product_filter(),
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
        if _is_shader_slug(category_slug):
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
        .where(~_shader_category_filter())
        .order_by(Category.name)
    )
    categories = list(result.scalars().all())
    if not categories:
        return []

    category_ids = [c.id for c in categories]
    count_result = await db.execute(
        select(Product.category_id, func.count(Product.id))
        .where(
            Product.category_id.in_(category_ids),
            *_active_product_filters(),
        )
        .group_by(Product.category_id)
    )
    counts = {row[0]: row[1] for row in count_result.all()}

    preview_result = await db.execute(
        select(Product.category_id, Product.preview_url)
        .where(
            Product.category_id.in_(category_ids),
            Product.preview_url.isnot(None),
            *_active_product_filters(),
        )
        .order_by(Product.sales_count.desc(), Product.created_at.desc())
    )
    previews: dict[int, str] = {}
    for category_id, preview_url in preview_result.all():
        if category_id not in previews and preview_url:
            previews[category_id] = preview_url

    return [
        {
            "id": c.id,
            "name": c.name,
            "slug": c.slug,
            "product_count": counts.get(c.id, 0),
            "preview_url": previews.get(c.id),
        }
        for c in categories
    ]


async def get_bot_catalog(db: AsyncSession) -> dict:
    """Katalog für Discord-Bot: Kategorien inkl. aktiver Produkte."""
    categories = await get_categories(db)
    catalog: list[dict] = []
    for cat in categories:
        products = await search_products(
            db, category_slug=cat["slug"], limit=200
        )
        catalog.append(
            {
                **cat,
                "products": [
                    {
                        "id": p.id,
                        "name": p.name,
                        "slug": p.slug,
                        "price": float(p.price),
                        "description": p.description or "",
                        "discord_role_id": p.discord_role_id,
                    }
                    for p in products
                ],
            }
        )
    return {"categories": catalog}


async def remove_shader_content(db: AsyncSession) -> dict:
    """Shader-Kategorien und Shader-Produkte vollständig aus dem Shop entfernen."""
    shader_categories = (
        await db.scalars(select(Category).where(_shader_category_filter()))
    ).all()
    shader_category_ids = [category.id for category in shader_categories]

    shader_conditions = [_shader_product_filter()]
    if shader_category_ids:
        shader_conditions.append(Product.category_id.in_(shader_category_ids))

    shader_products = (
        await db.execute(
            select(Product)
            .options(selectinload(Product.category))
            .where(or_(*shader_conditions))
        )
    ).scalars().all()

    shader_product_ids = list({product.id for product in shader_products})
    removed_products = 0
    removed_categories = 0

    if shader_product_ids:
        await db.execute(
            delete(WishlistItem).where(WishlistItem.product_id.in_(shader_product_ids))
        )
        await db.execute(
            delete(UnlockedProduct).where(UnlockedProduct.product_id.in_(shader_product_ids))
        )
        await db.execute(
            delete(ProductMedia).where(ProductMedia.product_id.in_(shader_product_ids))
        )
        await db.execute(delete(Order).where(Order.product_id.in_(shader_product_ids)))
        await db.execute(delete(Product).where(Product.id.in_(shader_product_ids)))
        removed_products = len(shader_product_ids)

    if shader_category_ids:
        await db.execute(delete(Category).where(Category.id.in_(shader_category_ids)))
        removed_categories = len(shader_category_ids)

    return {"removed_products": removed_products, "removed_categories": removed_categories}


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


async def redeem_link_code_ingame(db: AsyncSession, code: str, ign: str) -> User:
    """Link-Code ingame einlösen (vom MC-Bot). IGN kommt vom Spielernamen."""
    normalized = ign.strip()
    if not normalized:
        raise ValueError("IGN erforderlich")

    result = await db.execute(select(LinkCode).where(LinkCode.code == code.upper()))
    link = result.scalar_one_or_none()
    if not link or link.used or link.expires_at < datetime.utcnow():
        raise ValueError("Ungültiger oder abgelaufener Code")

    if link.code_type == LinkCodeType.discord:
        if not link.discord_id:
            raise ValueError(
                "Code ungültig: Bitte auf der Website mit Discord anmelden und neuen Code erstellen."
            )
        return await redeem_link_code(db, code, ign=normalized, discord_id=link.discord_id)

    if link.code_type == LinkCodeType.ign:
        if link.ign and link.ign.lower() != normalized.lower():
            raise ValueError("Dieser Code gehört zu einem anderen Minecraft-Namen")
        user = await get_or_create_user_by_ign(db, normalized)
        link.used = True
        await db.commit()
        await db.refresh(user)
        return user

    raise ValueError("Unbekannter Code-Typ")


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


async def get_or_create_user_by_ign(db: AsyncSession, ign: str) -> User:
    normalized = ign.strip()
    if not normalized:
        raise ValueError("IGN erforderlich")

    result = await db.execute(select(User).where(User.ign.ilike(normalized)))
    user = result.scalar_one_or_none()
    if user:
        if user.ign != normalized:
            user.ign = normalized
        return user

    user = User(ign=normalized)
    db.add(user)
    await db.flush()
    return user


async def attach_order_to_user(db: AsyncSession, order: Order) -> User | None:
    if order.user_id:
        result = await db.execute(select(User).where(User.id == order.user_id))
        return result.scalar_one_or_none()

    if not order.ign:
        return None

    user = await get_or_create_user_by_ign(db, order.ign)
    order.user_id = user.id
    await db.flush()
    return user


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
    if _is_shader_product(product):
        raise ValueError("Shader-Produkte sind nicht verfügbar")

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
) -> list[Order]:
    """Bestätigt Zahlung — einzelne Order oder ganze Warenkorb-Gruppe (Gesamtbetrag)."""
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
        if not order:
            return []
        await _mark_order_paid(db, order, payment_reference)
        return [order]

    cart_orders = await _find_cart_orders_by_total(db, ign, amount)
    if cart_orders:
        confirmed: list[Order] = []
        for order in cart_orders:
            await _mark_order_paid(db, order, payment_reference)
            confirmed.append(order)
        return confirmed

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
        return []

    await _mark_order_paid(db, order, payment_reference)
    return [order]


async def _find_cart_orders_by_total(
    db: AsyncSession,
    ign: str,
    amount: float,
) -> list[Order] | None:
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.product))
        .where(
            Order.ign.ilike(ign),
            Order.cart_group_id.isnot(None),
            Order.cart_total_amount.isnot(None),
            Order.status.in_([OrderStatus.pending, OrderStatus.ticket_open]),
        )
        .order_by(Order.created_at.desc())
    )
    orders = list(result.scalars().all())
    if not orders:
        return None

    groups: dict[str, list[Order]] = {}
    for order in orders:
        groups.setdefault(order.cart_group_id, []).append(order)

    sorted_groups = sorted(
        groups.values(),
        key=lambda group: max(o.created_at for o in group),
        reverse=True,
    )

    for group_orders in sorted_groups:
        total = group_orders[0].cart_total_amount
        if total is None or not _amounts_equal(total, amount):
            continue
        line_sum = round(sum(o.amount for o in group_orders), 2)
        if not _amounts_equal(line_sum, amount):
            continue
        return group_orders

    return None


async def _mark_order_paid(
    db: AsyncSession,
    order: Order,
    payment_reference: str | None,
) -> None:
    await attach_order_to_user(db, order)
    order.mc_confirmed = True
    order.payment_reference = payment_reference
    await finalize_order(db, order)


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
        result = await db.execute(
            select(Product)
            .options(selectinload(Product.category))
            .where(Product.id == product_id)
        )
        product = result.scalar_one_or_none()
    elif product_slug:
        product = await get_product_by_slug(db, product_slug)

    if not product:
        raise ValueError("Produkt nicht gefunden")
    if _is_shader_product(product):
        raise ValueError("Shader-Produkte sind nicht verfügbar")

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
    if _contains_shader_marker(data.get("name")) or _contains_shader_marker(data.get("tags")):
        raise ValueError("Shader-Produkte werden nicht unterstützt")
    if data.get("category_slug") and _is_shader_slug(data["category_slug"]):
        raise ValueError("Shader-Kategorien werden nicht unterstützt")

    slug = slugify(data["name"])
    existing = await get_product_by_slug(db, slug)
    if existing:
        slug = f"{slug}-{secrets.token_hex(3)}"

    category_id = None
    if data.get("category_slug"):
        result = await db.execute(select(Category).where(Category.slug == data["category_slug"]))
        cat = result.scalar_one_or_none()
        if cat and _is_shader_category(cat):
            raise ValueError("Shader-Kategorien werden nicht unterstützt")
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
    if _is_shader_product(product):
        raise ValueError("Shader-Produkte sind nicht verfügbar")

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

    buyer = await attach_order_to_user(db, order)
    if buyer:
        await unlock_product_for_user(db, buyer.id, order.product_id, order.id)

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
    if _is_shader_product(product):
        raise ValueError("Shader-Produkte sind nicht verfügbar")

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


async def create_cart_purchase_with_ticket(
    db: AsyncSession,
    product_ids: list[int],
    user: User,
    ign: str,
    discount_code: str | None = None,
) -> tuple[list[Order], str | None, float]:
    from app.discord_tickets import create_cart_ticket

    if not user.discord_id:
        raise ValueError("Discord-Verbindung erforderlich für den Kauf. Bitte zuerst Discord verbinden.")

    unique_ids = list(dict.fromkeys(product_ids))
    if not unique_ids:
        raise ValueError("Warenkorb ist leer")

    result = await db.execute(
        select(Product).where(Product.id.in_(unique_ids), *_active_product_filters())
    )
    products = list(result.scalars().all())
    if len(products) != len(unique_ids):
        raise ValueError("Ein oder mehrere Produkte sind nicht verfügbar")

    discount_percent = 0
    dc = None
    if discount_code:
        dc = await validate_discount(db, discount_code)
        if dc:
            discount_percent = dc.discount_percent

    orders: list[Order] = []
    line_items: list[dict] = []
    total_amount = 0.0
    cart_group_id = _new_cart_group_id()

    for product in products:
        amount = product.price
        if discount_percent:
            amount = round(product.price * (1 - discount_percent / 100), 2)

        order = Order(
            product_id=product.id,
            user_id=user.id,
            ign=ign or user.ign or "unknown",
            amount=amount,
            discount_code=discount_code if discount_percent else None,
            status=OrderStatus.pending,
            cart_group_id=cart_group_id,
            cart_total_amount=None,
        )
        db.add(order)
        orders.append(order)
        line_items.append(
            {
                "name": product.name,
                "original_price": product.price,
                "final_amount": amount,
            }
        )
        total_amount += amount

    total_amount = round(total_amount, 2)
    for order in orders:
        order.cart_total_amount = total_amount

    await db.flush()

    if dc and discount_percent:
        dc.uses += 1

    primary_order_id = orders[0].id
    ticket = await create_cart_ticket(
        order_id=primary_order_id,
        discord_user_id=user.discord_id,
        discord_username=user.discord_username or user.discord_id,
        ign=ign or user.ign or "—",
        line_items=line_items,
        total_amount=total_amount,
        discount_code=discount_code,
        discount_percent=discount_percent,
    )

    ticket_url = ticket.get("ticket_url")
    channel_id = ticket.get("channel_id")

    for order in orders:
        order.product = next(p for p in products if p.id == order.product_id)
        if ticket.get("success"):
            order.status = OrderStatus.ticket_open
            order.ticket_channel_id = channel_id
            order.ticket_url = ticket_url
        else:
            order.status = OrderStatus.pending

    await db.commit()
    for order in orders:
        await db.refresh(order)

    return orders, ticket_url if ticket.get("success") else None, total_amount


async def create_cart_purchase_ingame(
    db: AsyncSession,
    product_ids: list[int],
    ign: str,
    discount_code: str | None = None,
) -> tuple[list[Order], float, User]:
    """Ingame checkout: no Discord ticket — payment detected by MC bot."""
    unique_ids = list(dict.fromkeys(product_ids))
    if not unique_ids:
        raise ValueError("Warenkorb ist leer")

    user = await get_or_create_user_by_ign(db, ign)

    result = await db.execute(
        select(Product).where(Product.id.in_(unique_ids), *_active_product_filters())
    )
    products = list(result.scalars().all())
    if len(products) != len(unique_ids):
        raise ValueError("Ein oder mehrere Produkte sind nicht verfügbar")

    discount_percent = 0
    dc = None
    if discount_code:
        dc = await validate_discount(db, discount_code)
        if dc:
            discount_percent = dc.discount_percent

    orders: list[Order] = []
    total_amount = 0.0
    cart_group_id = _new_cart_group_id()

    for product in products:
        amount = product.price
        if discount_percent:
            amount = round(product.price * (1 - discount_percent / 100), 2)

        order = Order(
            product_id=product.id,
            user_id=user.id,
            ign=user.ign or ign.strip(),
            amount=amount,
            discount_code=discount_code if discount_percent else None,
            status=OrderStatus.pending,
            cart_group_id=cart_group_id,
            cart_total_amount=None,
        )
        db.add(order)
        orders.append(order)
        total_amount += amount

    total_amount = round(total_amount, 2)
    for order in orders:
        order.cart_total_amount = total_amount

    await db.flush()

    if dc and discount_percent:
        dc.uses += 1

    await db.commit()
    for order in orders:
        order.product = next(p for p in products if p.id == order.product_id)
        await db.refresh(order)

    return orders, total_amount, user


async def get_user_orders(db: AsyncSession, user_id: int, limit: int = 20):
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.product))
        .where(Order.user_id == user_id)
        .order_by(Order.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()


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
    if _is_shader_product(product):
        raise ValueError("Shader-Produkte sind nicht verfügbar")

    old_price = product.price
    product.price = new_price
    product.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(product)
    return product, old_price


async def list_products_admin(db: AsyncSession):
    result = await db.execute(
        select(Product)
        .options(selectinload(Product.category), selectinload(Product.media))
        .where(~_shader_product_filter())
        .order_by(Product.created_at.desc())
    )
    return result.scalars().all()


async def update_product_admin(db: AsyncSession, product_id: int, data: dict) -> Product:
    result = await db.execute(
        select(Product)
        .options(selectinload(Product.category), selectinload(Product.media))
        .where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise ValueError("Produkt nicht gefunden")
    if _is_shader_product(product):
        raise ValueError("Shader-Produkte sind nicht verfügbar")

    if data.get("name"):
        if _contains_shader_marker(data["name"]):
            raise ValueError("Shader-Produkte werden nicht unterstützt")
        product.name = data["name"]
    if data.get("description") is not None:
        product.description = data["description"]
    if data.get("price") is not None:
        product.price = data["price"]
    if data.get("preview_url") is not None:
        product.preview_url = data["preview_url"]
    if data.get("discord_role_id") is not None:
        product.discord_role_id = data["discord_role_id"]
    if data.get("tags") is not None:
        if _contains_shader_marker(data["tags"]):
            raise ValueError("Shader-Produkte werden nicht unterstützt")
        product.tags = data["tags"]
    if data.get("is_new") is not None:
        product.is_new = data["is_new"]
    if data.get("is_active") is not None:
        product.is_active = data["is_active"]

    if data.get("category_slug") is not None:
        slug = data["category_slug"]
        if slug:
            if _is_shader_slug(slug):
                raise ValueError("Shader-Kategorien werden nicht unterstützt")
            cat_result = await db.execute(select(Category).where(Category.slug == slug))
            cat = cat_result.scalar_one_or_none()
            if not cat:
                cat = Category(name=slug.replace("-", " ").title(), slug=slug)
                db.add(cat)
                await db.flush()
            product.category_id = cat.id
        else:
            product.category_id = None

    product.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(product)
    return product


async def deactivate_product_admin(db: AsyncSession, product_id: int) -> Product:
    return await update_product_admin(db, product_id, {"is_active": False})


async def create_category_admin(db: AsyncSession, name: str, slug: str | None = None) -> Category:
    slug_value = slug or slugify(name)
    if _is_shader_slug(slug_value) or _contains_shader_marker(name):
        raise ValueError("Shader-Kategorien werden nicht unterstützt")
    existing = await db.execute(select(Category).where(Category.slug == slug_value))
    if existing.scalar_one_or_none():
        raise ValueError("Kategorie existiert bereits")

    category = Category(name=name.strip(), slug=slug_value)
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


async def list_discount_codes_admin(db: AsyncSession):
    result = await db.execute(select(DiscountCode).order_by(DiscountCode.code))
    return result.scalars().all()


async def create_discount_code_admin(
    db: AsyncSession,
    code: str,
    discount_percent: int,
    creator_name: str | None = None,
    creator_discord_id: str | None = None,
) -> DiscountCode:
    normalized = code.strip().upper()
    existing = await db.execute(
        select(DiscountCode).where(func.lower(DiscountCode.code) == normalized.lower())
    )
    if existing.scalar_one_or_none():
        raise ValueError("Code existiert bereits")

    dc = DiscountCode(
        code=normalized,
        discount_percent=discount_percent,
        creator_name=creator_name,
        creator_discord_id=creator_discord_id,
    )
    db.add(dc)
    await db.commit()
    await db.refresh(dc)
    return dc


async def update_discount_code_admin(db: AsyncSession, code_id: int, data: dict) -> DiscountCode:
    result = await db.execute(select(DiscountCode).where(DiscountCode.id == code_id))
    dc = result.scalar_one_or_none()
    if not dc:
        raise ValueError("Code nicht gefunden")

    if data.get("is_active") is not None:
        dc.is_active = data["is_active"]
    if data.get("discount_percent") is not None:
        dc.discount_percent = data["discount_percent"]
    if data.get("creator_name") is not None:
        dc.creator_name = data["creator_name"]

    await db.commit()
    await db.refresh(dc)
    return dc
