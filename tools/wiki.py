"""Small helper for the MediaWiki API (Wikisource). Caches raw pages in sources/."""
import json, os, time, urllib.parse, urllib.request, hashlib

UA = "hindi-library-builder/0.1 (https://github.com/tiwari91/hindi-library)"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "sources", "cache")


def api(host, **params):
    params["format"] = "json"
    url = f"https://{host}/w/api.php"
    body = urllib.parse.urlencode(params).encode()
    err = None
    for i in range(5):
        try:
            # POST keeps long title lists out of the URL (GET hits "414 URI too long")
            req = urllib.request.Request(url, data=body, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.load(r)
            time.sleep(0.25)
            return data
        except Exception as e:  # network hiccup or rate limit
            err = e
            time.sleep(2 * (i + 1))
    raise err


def _cache_path(host, title, kind):
    h = hashlib.sha1(f"{host}|{title}|{kind}".encode()).hexdigest()[:16]
    return os.path.join(CACHE, host.split(".")[0], f"{kind}-{h}.json")


def _cached(host, title, kind, fetch):
    p = _cache_path(host, title, kind)
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            return json.load(f)["body"]
    body = fetch()
    if body is not None:
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "w", encoding="utf-8") as f:
            json.dump({"host": host, "title": title, "body": body}, f, ensure_ascii=False)
    return body


def wikitext(host, title):
    def fetch():
        d = api(host, action="parse", page=title, prop="wikitext", redirects=1)
        return d["parse"]["wikitext"]["*"] if "parse" in d else None
    return _cached(host, title, "wt", fetch)


def html(host, title):
    def fetch():
        d = api(host, action="parse", page=title, prop="text", redirects=1, disableeditsection=1)
        return d["parse"]["text"]["*"] if "parse" in d else None
    return _cached(host, title, "html", fetch)


def page_quality(host, titles):
    """Return {title: proofread level} for Page: titles (batches of 50)."""
    out = {}
    for i in range(0, len(titles), 10):
        d = api(host, action="query", prop="proofread", titles="|".join(titles[i:i + 10]))
        for p in d["query"]["pages"].values():
            out[p["title"]] = p.get("proofread", {}).get("quality")
    return out


def pages_many(host, titles):
    """Fetch wikitext and proofread level for many Page: titles, 50 at a time.
    Returns {title: {"text": str|None, "quality": int|None}}. Cached per batch."""
    out = {}
    for i in range(0, len(titles), 50):
        batch = titles[i:i + 50]

        def fetch():
            d = api(host, action="query", prop="revisions|proofread", rvprop="content", rvslots="main",
                    titles="|".join(batch))
            res = {}
            for p in d["query"]["pages"].values():
                rev = p.get("revisions")
                res[p["title"]] = {
                    "text": rev[0]["slots"]["main"]["*"] if rev else None,
                    "quality": p.get("proofread", {}).get("quality"),
                }
            return res
        out.update(_cached(host, "|".join(batch), "many", fetch))
    return out


DEV_DIGITS ="०१२३४५६७८९"


def dev(n):
    return "".join(DEV_DIGITS[int(c)] for c in str(n))


def undev(s):
    return int("".join(str(DEV_DIGITS.index(c)) if c in DEV_DIGITS else c for c in s))
