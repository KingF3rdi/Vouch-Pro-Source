from __future__ import annotations

import math
import re

_SUFFIX_MULT = {
    "k": 1_000,
    "m": 1_000_000,
    "b": 1_000_000_000,
}

_CLEAN_RE = re.compile(r"[\s€$]")


def parse_price(raw: str | float | int | None) -> float:
    """
    Parse prices with optional k/m/b suffixes and comma decimals.

    Examples: 500, 9.99, 9,99, 500k, 1.5m, 2b, 1,5k
    """
    if isinstance(raw, (int, float)):
        value = float(raw)
        if not math.isfinite(value) or value <= 0:
            raise ValueError("invalid price")
        return value

    s = _CLEAN_RE.sub("", str(raw or "")).strip()
    if not s:
        raise ValueError("empty price")

    mult = 1.0
    suffix = s[-1].lower()
    if suffix in _SUFFIX_MULT:
        mult = float(_SUFFIX_MULT[suffix])
        s = s[:-1].strip()
        if not s:
            raise ValueError("empty number")

    if "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):
            # European: 1.234,56
            s = s.replace(".", "").replace(",", ".")
        else:
            # US: 1,234.56
            s = s.replace(",", "")
    elif "," in s:
        s = s.replace(",", ".")

    try:
        value = float(s) * mult
    except ValueError as e:
        raise ValueError("invalid price") from e

    if not math.isfinite(value) or value <= 0:
        raise ValueError("invalid price")
    return value


def format_compact_number(amount: float) -> str:
    """500000 → 500k, 1500000 → 1.5m; small amounts stay decimal."""
    sign = "-" if amount < 0 else ""
    a = abs(float(amount))

    for div, suffix in (
        (1_000_000_000, "b"),
        (1_000_000, "m"),
        (1_000, "k"),
    ):
        if a >= div:
            n = a / div
            if abs(n - round(n)) < 1e-9:
                return f"{sign}{int(round(n))}{suffix}"
            text = f"{n:.2f}".rstrip("0").rstrip(".")
            return f"{sign}{text}{suffix}"

    if abs(a - round(a)) < 1e-9:
        return f"{sign}{int(round(a))}"
    return f"{sign}{a:.2f}".rstrip("0").rstrip(".")
