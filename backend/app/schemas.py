from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class CategoryOut(BaseModel):
    id: int
    name: str
    slug: str

    class Config:
        from_attributes = True


class ProductMediaOut(BaseModel):
    id: int
    url: str
    media_type: str
    sort_order: int

    class Config:
        from_attributes = True


class ProductOut(BaseModel):
    id: int
    name: str
    slug: str
    description: str
    price: float
    preview_url: str | None
    discord_role_id: str | None
    category_id: int | None
    tags: str
    sales_count: int
    is_new: bool
    is_active: bool
    created_at: datetime
    category: CategoryOut | None = None
    media: list[ProductMediaOut] = []

    class Config:
        from_attributes = True


class ProductListItem(BaseModel):
    id: int
    name: str
    slug: str
    price: float
    preview_url: str | None
    sales_count: int
    is_new: bool
    tags: str
    category: CategoryOut | None = None

    class Config:
        from_attributes = True


class StatsOut(BaseModel):
    total_revenue: float
    total_sales: int
    total_vouches: int


class VouchOut(BaseModel):
    id: int
    giver_name: str
    message: str
    is_positive: bool
    created_at: datetime

    class Config:
        from_attributes = True


class VouchSummaryOut(BaseModel):
    total: int
    examples: list[VouchOut]


class LinkCodeCreate(BaseModel):
    code_type: Literal["discord", "ign"]


class LinkCodeOut(BaseModel):
    code: str
    code_type: str
    expires_at: datetime


class LinkRedeemRequest(BaseModel):
    code: str
    ign: str | None = None
    discord_id: str | None = None


class UserOut(BaseModel):
    id: int
    discord_id: str | None
    discord_username: str | None = None
    ign: str | None
    display_name: str | None = None
    connection_type: str | None = None  # discord, minecraft, both
    is_admin: bool = False

    class Config:
        from_attributes = True


class UnlockedProductOut(BaseModel):
    id: int
    product: ProductListItem
    unlocked_at: datetime

    class Config:
        from_attributes = True


class UserProfileOut(BaseModel):
    id: int
    discord_id: str | None
    discord_username: str | None = None
    ign: str | None
    display_name: str | None = None
    connection_type: str | None = None
    unlocked_products: list[UnlockedProductOut] = []

    class Config:
        from_attributes = True


class WishlistItemOut(BaseModel):
    id: int
    product: ProductListItem
    price_at_add: float
    price_changed: bool = False

    class Config:
        from_attributes = True


class DiscountValidateRequest(BaseModel):
    code: str
    product_id: int | None = None


class DiscountValidateOut(BaseModel):
    valid: bool
    discount_percent: int = 0
    message: str = ""


class OrderCreate(BaseModel):
    product_id: int
    ign: str
    discount_code: str | None = None


class CartOrderCreate(BaseModel):
    product_ids: list[int] = Field(min_length=1, max_length=20)
    ign: str
    discount_code: str | None = None


class OrderOut(BaseModel):
    id: int
    product_id: int
    product_name: str | None = None
    ign: str
    amount: float
    status: str
    ticket_url: str | None = None
    created_at: datetime
    message: str | None = None

    class Config:
        from_attributes = True


class CartOrderOut(BaseModel):
    orders: list[OrderOut]
    ticket_url: str | None = None
    total_amount: float
    message: str | None = None


class SearchParams(BaseModel):
    q: str = ""
    category: str | None = None
    tag: str | None = None


# Bot integration schemas
class BotProductCreate(BaseModel):
    name: str
    description: str = ""
    price: float
    preview_url: str | None = None
    discord_role_id: str | None = None
    category_slug: str | None = None
    tags: str = ""
    is_new: bool = True
    media_urls: list[str] = Field(default_factory=list, max_length=5)


class BotSaleSync(BaseModel):
    product_id: int | None = None
    product_slug: str | None = None
    ign: str
    amount: float
    discord_id: str | None = None
    discount_code: str | None = None


class BotVouchSync(BaseModel):
    external_id: int | None = None
    giver_name: str
    message: str
    is_positive: bool = True


class BotPaymentConfirm(BaseModel):
    order_id: int | None = None
    ign: str
    amount: float
    payment_reference: str | None = None


class BotPriceChangeNotify(BaseModel):
    product_id: int
    old_price: float
    new_price: float


class PurchaseConfirmationOut(BaseModel):
    order_id: int
    product_name: str
    buyer_display: str
    amount: float
    confirmed_at: datetime


class DiscordConfigOut(BaseModel):
    invite_url: str


class AdminProductCreate(BaseModel):
    name: str
    description: str = ""
    price: float = Field(gt=0)
    preview_url: str | None = None
    discord_role_id: str | None = None
    category_slug: str | None = None
    tags: str = ""
    is_new: bool = True
    media_urls: list[str] = Field(default_factory=list, max_length=5)


class AdminProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    price: float | None = Field(default=None, gt=0)
    preview_url: str | None = None
    discord_role_id: str | None = None
    category_slug: str | None = None
    tags: str | None = None
    is_new: bool | None = None
    is_active: bool | None = None


class AdminCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str | None = None


class AdminDiscountCodeCreate(BaseModel):
    code: str = Field(min_length=2, max_length=50)
    discount_percent: int = Field(ge=1, le=100)
    creator_name: str | None = None
    creator_discord_id: str | None = None


class AdminDiscountCodeOut(BaseModel):
    id: int
    code: str
    discount_percent: int
    creator_name: str | None
    creator_discord_id: str | None
    is_active: bool
    uses: int

    class Config:
        from_attributes = True


class AdminDiscountCodeUpdate(BaseModel):
    is_active: bool | None = None
    discount_percent: int | None = Field(default=None, ge=1, le=100)
    creator_name: str | None = None
