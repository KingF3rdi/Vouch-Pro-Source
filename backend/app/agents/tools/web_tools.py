"""Web / GitHub research tools for frontier agent quality."""

from __future__ import annotations

from urllib.parse import quote

import httpx

from app.core.config import get_settings


async def web_search(query: str, limit: int = 8) -> dict[str, Any]:
    url = f"https://api.duckduckgo.com/?q={quote(query)}&format=json&no_html=1&skip_disambig=1"
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.get(url, headers={"User-Agent": "HelixAgent/0.5"})
        data = res.json()
    results: list[dict[str, str]] = []
    if data.get("AbstractText") and data.get("AbstractURL"):
        results.append(
            {
                "title": "Abstract",
                "url": data["AbstractURL"],
                "snippet": data["AbstractText"],
            }
        )
    for topic in data.get("RelatedTopics") or []:
        if len(results) >= limit:
            break
        if isinstance(topic, dict) and topic.get("FirstURL") and topic.get("Text"):
            results.append(
                {
                    "title": topic["Text"][:80],
                    "url": topic["FirstURL"],
                    "snippet": topic["Text"],
                }
            )
    return {"query": query, "results": results}


async def web_fetch(url: str, max_chars: int = 0) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=45.0, follow_redirects=True) as client:
        res = await client.get(url, headers={"User-Agent": "HelixAgent/0.5"})
        text = res.text
    # 0 = unlimited (still guard memory with hard 2MB chars)
    hard = 2_000_000 if max_chars <= 0 else max_chars
    truncated = len(text) > hard
    return {
        "url": str(res.url),
        "status": res.status_code,
        "truncated": truncated,
        "content": text[:hard],
        "total_chars": len(text),
    }


async def github_search(query: str, limit: int = 8) -> dict[str, Any]:
    settings = get_settings()
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "HelixAgent/0.5",
    }
    if settings.github_token:
        headers["Authorization"] = f"Bearer {settings.github_token}"
    url = f"https://api.github.com/search/repositories?q={query}&per_page={limit}&sort=stars"
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.get(url, headers=headers)
        if res.status_code >= 400:
            return {"error": f"GitHub search failed: {res.status_code}", "body": res.text[:800]}
        data = res.json()
    return {
        "results": [
            {
                "name": item.get("full_name"),
                "url": item.get("html_url"),
                "description": item.get("description"),
                "stars": item.get("stargazers_count"),
                "language": item.get("language"),
            }
            for item in data.get("items") or []
        ]
    }
