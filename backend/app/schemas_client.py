from pydantic import BaseModel, Field


class ClientLinkRedeem(BaseModel):
    code: str = Field(min_length=4, max_length=12)
    ign: str = Field(min_length=1, max_length=16)


class ClientPaymentConfirm(BaseModel):
    ign: str = Field(min_length=1, max_length=16)
    amount: float = Field(gt=0)
