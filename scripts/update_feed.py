#!/usr/bin/env python3
import html
import json
import os
import re
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

# Only Portuguese-language, Brazil-localized search feeds — the old mix of
# Reuters/BBC world-news feeds pulled in English and off-topic blog content
# because "world news" headlines false-matched loosely on commodity terms.
FEED_QUERIES = {
    "cobre": "cobre mineração OR preço",
    "petroleo": "petróleo OR petrobras OR brent",
    "aluminio": "alumínio mineração OR preço",
    "ouro": "ouro mineração OR preço",
    "platina": "platina OR PGM mineração",
}
FEEDS = {
    key: "https://news.google.com/rss/search?" + urllib.parse.urlencode(
        {"q": query, "hl": "pt-BR", "gl": "BR", "ceid": "BR:pt-419"}
    )
    for key, query in FEED_QUERIES.items()
}

COMMODITY_KEYS = ["cobre", "petroleo", "aluminio", "ouro", "platina"]

COMMODITY_TERMS = {
    "cobre": ["cobre", "copper"],
    "petroleo": ["petróleo", "petroleo", "petrobras", "brent", "wti"],
    "aluminio": ["alumínio", "aluminio", "aluminium", "aluminum"],
    "ouro": ["ouro", "gold"],
    "platina": ["platina", "platinum"],  # "pgm" dropped: collides with Procuradoria-Geral do Município
}

# Known false-positive phrases that share a keyword with the commodity term
# but aren't commodity news (place names, unrelated companies, verb forms).
EXCLUDE_PHRASES = {
    "cobre": ["e cobre corte", "e cobre a"],
    "ouro": ["ouro preto", "iphone de ouro"],
    "petroleo": ["rouanet", "seleção pública", "centro tecnológico"],
    "aluminio": [],
    "platina": ["viação platina", "concurso pgm"],
}

TAG_RE = re.compile(r"<[^>]+>")


def clean_text(text: str) -> str:
    """Strip HTML tags/entities that Google News descriptions embed."""
    text = html.unescape(text or "")
    text = TAG_RE.sub(" ", text)
    return re.sub(r"\s+", " ", text).strip()

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


def summarize_in_portuguese(text: str, max_chars: int = 420) -> str:
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

    # Local fallback: no API key available, so just present the (already
    # Portuguese, since feeds are pt-BR) source text as-is, trimmed to length.
    s = text.replace("\n", " ").strip()
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
        title = clean_text(item.findtext("title") or "")
        link = (item.findtext("link") or "").strip()
        desc = clean_text(item.findtext("description") or item.findtext("{http://purl.org/rss/1.0/modules/content/}encoded") or "")
        if title:
            entries.append({"title": title, "link": link, "description": desc})
    if not entries:
        for item in root.findall("./entry"):
            title = clean_text(item.findtext("title") or "")
            link = (item.findtext("link") or "").strip()
            desc = clean_text(item.findtext("summary") or "")
            if title:
                entries.append({"title": title, "link": link, "description": desc})
    return entries


def build_headline(commodity: str, entry: dict, now: datetime):
    title = entry.get("title", "")
    link = entry.get("link") or ""
    # Google News descriptions are just the title re-wrapped in a link with
    # no new information, so summarizing off the title alone avoids duplication.
    pt_summary = summarize_in_portuguese(title, max_chars=420)
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
    exclude = EXCLUDE_PHRASES.get(commodity, [])
    candidates = []
    try:
        for entry in parse_feed_entries(FEEDS[commodity]):
            text = " ".join([entry.get("title", ""), entry.get("description", "")]).lower()
            if any(term.lower() in text for term in terms) and not any(bad in text for bad in exclude):
                candidates.append(entry)
    except Exception:
        pass
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
