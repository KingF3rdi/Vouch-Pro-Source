"""Ingame-Preisformatierung: k, m, b (Minecraft Economy)."""


def format_ingame_price(value: float) -> str:
    n = float(value)
    if n >= 1e9:
        return f"{_trim(n / 1e9)}b"
    if n >= 1e6:
        return f"{_trim(n / 1e6)}m"
    if n >= 1e3:
        return f"{_trim(n / 1e3)}k"
    if n == int(n):
        return str(int(n))
    return _trim(n)


def _trim(num: float) -> str:
    fixed = f"{num:.2f}"
    return fixed.rstrip("0").rstrip(".")
