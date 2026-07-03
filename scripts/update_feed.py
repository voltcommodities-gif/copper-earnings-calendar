#!/usr/bin/env python3
import json
import os
import ssl
import sys
import time
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
STATE_FILE = DATA_DIR / "state.json"

FEEDS = [
    "https://feeds.feedburner.com/Reuters/worldNews",
    "https://feeds.bbci.co.uk/news/world/rss.xml",
    "https://news.google.com/rss/search?q=commodities&hl=pt-BR&gl=BR&ceid=BR:pt-419",
]

COMMODITY_KEYS = ["cobre", "petroleo", "aluminio", "ouro", "platina"]

COMMODITY_TERMS = {
    "cobre": ["copper", "cobre", "copper prices", "copper mining"],
    "petroleo": ["oil", "petroleum", "crude", "oil prices"],
    "aluminio": ["aluminum", "aluminium", "aluminum prices"],
    "ouro": ["gold", "gold prices", "gold mining"],
    "platina": ["platinum", "platina", "platinum prices"],
}

HEADLINE_TEMPLATE = {
    "id": None,
    "company": None,
    "date": None,
    "summary": None,
    "source_type": "news",
    "source_url": None,
    "extra_sources": [],
    "fingerprint": None,
    "added_at": None,
}


def summarize_in_portuguese(text: str, max_chars: int = 300) -> str:
    """Summarize `text` in Portuguese.
    If OPENAI_API_KEY is set in the environment, call OpenAI ChatCompletion API.
    Otherwise, apply a conservative local fallback summarizer.
    """
    text = (text or "").strip()
    if not text:
        return "Resumo (PT): conteúdo não disponível."

    api_key = os.environ.get("OPENAI_API_KEY")
    if api_key:
        try:
            payload = json.dumps({
                "model": "gpt-3.5-turbo",
                "messages": [
                    {"role": "system", "content": "Você é um assistente que resume notícias em português de forma concisa (2-3 frases). Mantenha fatos e não invente."},
                    {"role": "user", "content": f"Resuma o seguinte texto em português em no máximo 2-3 frases:\n\n{text}"},
                ],
                "temperature": 0.2,
                "max_tokens": 200,
            }).encode("utf-8")

            req = urllib.request.Request(
                "https://api.openai.com/v1/chat/completions",
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}",
                    "User-Agent": "update-feed/1.0",
                },
                method="POST",
            )
            ctx = ssl._create_unverified_context()
            with urllib.request.urlopen(req, timeout=20, context=ctx) as resp:
                resp_data = json.load(resp)
            # Navigate response safely
            choices = resp_data.get("choices") or []
            if choices:
                message = choices[0].get("message", {}).get("content", "").strip()
                if message:
                    out = message
                    if len(out) > max_chars:
                        out = out[: max_chars - 3].rstrip() + "..."
                    return out
        except Exception:
            # If API call fails, fall back to local summarizer
            pass

    # Local fallback summarizer: use title + first sentences of text, trimmed.
    # Try to split into sentences by common punctuation.
    s = text.replace("\n", " ").strip()
    # naive sentence split
    for sep in [". ", "? ", "! "]:
        if sep in s:
            parts = s.split(sep)
            if parts:
                first = parts[0].strip()
                rest = sep.join(parts[1:]).strip()
                candidate = first
                if rest:
                    candidate += ". " + rest[: max_chars // 3].strip()
                candidate = candidate.strip()
                if len(candidate) > max_chars:
                    candidate = candidate[: max_chars - 3].rstrip() + "..."
                return f"Resumo (PT): {candidate}"

    # final fallback: trim
    if len(s) > max_chars:
        s = s[: max_chars - 3].rstrip() + "..."
    return f"Resumo (PT): {s}"


def fetch_text(url: str, timeout: int = 20) -> str:
    ctx = ssl._create_unverified_context()
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as response:
        return response.read().decode("utf-8", "ignore")


def parse_feed_entries(feed_url: str):
    text = fetch_text(feed_url)
    root = ET.fromstring(text)
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    entries = []
    for item in root.findall("./channel/item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        desc = (item.findtext("description") or item.findtext("{http://purl.org/rss/1.0/modules/content/}encoded") or "").strip()
        if title:
            entries.append({"title": title, "link": link, "description": desc})
    if not entries:
        for item in root.findall("./entry"):
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            desc = (item.findtext("summary") or "").strip()
            if title:
                entries.append({"title": title, "link": link, "description": desc})
    return entries


def build_headline(commodity: str, entry: dict, now: datetime):
    title = entry.get("title", "")
    link = entry.get("link") or ""
    desc = entry.get("description") or title
    # Combine title and description for summarization
    text_for_summary = f"{title}. {desc}"
    pt_summary = summarize_in_portuguese(text_for_summary, max_chars=320)
    return {
        **HEADLINE_TEMPLATE,
        "id": f"news-{commodity}-{int(now.timestamp())}-{abs(hash(title)) % 100000}",
        "company": f"Major headline · {commodity.title()}",
        "date": now.strftime("%Y-%m-%d"),
        "summary": pt_summary,
        "source_url": link or "https://news.google.com/",
        "fingerprint": f"{commodity}|{now.strftime('%Y-%m-%d')}|{title}",
        "added_at": now.replace(microsecond=0).isoformat().replace('+00:00', 'Z'),
    }


def collect_news(commodity: str):
    terms = COMMODITY_TERMS[commodity]
    candidates = []
    for feed_url in FEEDS:
        try:
            for entry in parse_feed_entries(feed_url):
                text = " ".join([entry.get("title", ""), entry.get("description", "")]).lower()
                if any(term.lower() in text for term in terms):
                    candidates.append(entry)
        except Exception:
            continue
    seen = set()
    unique = []
    for entry in candidates:
        key = (entry.get("title") or "").strip().lower()
        if key and key not in seen:
            seen.add(key)
            unique.append(entry)
    return unique[:8]


def load_json(path: Path):
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def save_json(path: Path, data):
    with path.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write("\n")


def main():
    now = datetime.now(timezone.utc)
    state = {}
    if STATE_FILE.exists():
        with STATE_FILE.open("r", encoding="utf-8") as fh:
            state = json.load(fh)

    for commodity in COMMODITY_KEYS:
        comments_path = DATA_DIR / f"comments-{commodity}.json"
        existing = load_json(comments_path)
        existing = [x for x in existing if x.get("source_type") != "news"]
        headlines = [build_headline(commodity, entry, now) for entry in collect_news(commodity)]
        merged = headlines + existing
        merged = merged[:80]
        save_json(comments_path, merged)
        state[f"last_comments_scan_{commodity}"] = now.replace(microsecond=0).isoformat().replace('+00:00', 'Z')

    save_json(STATE_FILE, state)
    print(json.dumps({"updated": COMMODITY_KEYS, "timestamp": now.isoformat()}, ensure_ascii=False))


if __name__ == "__main__":
    sys.exit(main())
