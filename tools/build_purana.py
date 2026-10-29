"""Build a Purana (Sanskrit) from Sanskrit Wikisource chapter pages "<base>/<part>/अध्यायः N".

Words are used as on Wikisource; verses are split at their numbers (see build_stotras.verses),
speaker lines become speakers, the closing "इति ..." line becomes a heading, and a Roman
transliteration is added by tools/iast.py.
Usage: python3 tools/build_purana.py <book id>
"""
import json, os, re, sys, urllib.parse
sys.path.insert(0, os.path.dirname(__file__))
from wiki import api, wikitext, ROOT
from build_stotras import verses, clean_wiki

HOST = "sa.wikisource.org"
DEV = "०१२३४५६७८९"
dev = lambda n: "".join(DEV[int(c)] for c in str(n))
undev = lambda s: int("".join(str(DEV.index(c)) if c in DEV else c for c in s))

PURANAS = {
    "vishnu-purana": {
        "base": "विष्णुपुराणम्",
        "parts": ["प्रथमांशः", "द्वितीयांशः", "तृतीयांशः", "चतुर्थांशः", "पञ्चमांशः", "षष्टांशः"],
        "unit": "अंश", "unit_en": "Amsha",
    },
}


def subpages(base):
    ts, cont = [], {}
    while True:
        d = api(HOST, action="query", list="allpages", apprefix=base + "/", aplimit=500, **cont)
        ts += [x["title"] for x in d["query"]["allpages"]]
        if "continue" not in d:
            return ts
        cont = {"apcontinue": d["continue"]["apcontinue"]}


def chapter_items(title, cn):
    w = wikitext(HOST, title) or ""
    poems = re.findall(r"<poem>(.*?)</poem>", w, flags=re.S)
    body = "\n".join(poems) if poems else re.sub(r"\{\{.*?\}\}|\[\[वर्गः:[^\]]*\]\]", "", w, flags=re.S)
    lines, colophon = [], []
    for l in clean_wiki(body):
        l = l.strip()
        if colophon or re.match(r"इति\s?श्री", l):
            colophon.append(l)
            continue
        s = re.sub(r"\s*[।|]+\s*$", "", l)
        if re.search(r"(उवाच|ऊचुः|ऊचतुः)$", s) and len(s) < 45:
            l = s + " —"
        lines.append(l)
    items = verses(lines, cn, numbered=True)
    if colophon:
        items.append({"id": f"{cn}.end", "h": " ".join(x for x in colophon if x)})
    return items


def main(bid):
    cfg = PURANAS[bid]
    base = cfg["base"]
    rx = re.compile(r"^" + re.escape(base) + r"/(.+?)/अध्यायः\s*([०-९0-9]+)$")
    chs = []
    for t in subpages(base):
        m = rx.match(t)
        if m and m.group(1) in cfg["parts"]:
            chs.append((cfg["parts"].index(m.group(1)) + 1, undev(m.group(2)), t))
    chs.sort()
    out = os.path.join(ROOT, "data", bid)
    os.makedirs(out, exist_ok=True)
    for f in os.listdir(out):
        os.remove(os.path.join(out, f))
    toc, report = [], {}
    for k, (pt, ad, t) in enumerate(chs, 1):
        items = chapter_items(t, k)
        nv = sum(1 for x in items if "text" in x)
        bad = sum(1 for x in items if "text" in x and "n" not in x)
        r = report.setdefault(pt, [0, 0, 0])
        r[0] += 1; r[1] += nv; r[2] += bad
        fname = f"{pt:02}-{ad:03}.json"
        src = "https://sa.wikisource.org/wiki/" + urllib.parse.quote(t.replace(" ", "_"))
        title = f"{cfg['unit']} {dev(pt)} · अध्याय {dev(ad)}"
        json.dump({"book": bid, "n": k, "title": title, "src": src, "items": items},
                  open(os.path.join(out, fname), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        first = next((x["text"].split("\n")[0] for x in items if "text" in x), "")
        toc.append({"n": k, "file": fname, "label": f"{pt}.{ad}", "group": f"{cfg['unit']} {dev(pt)} · {cfg['unit_en']} {pt}",
                    "title": title, "first": first[:60], "count": nv})
    json.dump({"book": bid, "chapters": toc}, open(os.path.join(out, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for pt, (c, v, bad) in sorted(report.items()):
        print(f"{bid} part {pt}: {c} chapters, {v} verses, {bad} without a number")


if __name__ == "__main__":
    main(sys.argv[1])
