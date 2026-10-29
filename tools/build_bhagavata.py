"""Build the Bhagavata Purana (Sanskrit) from Sanskrit Wikisource.

Pages: "श्रीमद्भागवतपुराणम्/स्कन्धः N/अध्यायः M" (skandha 10 adds /पूर्वार्धः or /उत्तरार्धः).
Words are used as on Wikisource; this script only splits verses (each ends with a numbered ॥),
marks "X उवाच" lines as speakers, keeps metre labels and the closing colophon as headings,
and adds a Roman transliteration made by tools/iast.py.
Usage: python3 tools/build_bhagavata.py [skandha numbers...]   (default: all 12)
"""
import json, os, re, sys, urllib.parse
sys.path.insert(0, os.path.dirname(__file__))
from wiki import api, wikitext, ROOT
from build_stotras import verses, clean_wiki

HOST = "sa.wikisource.org"
BASE = "श्रीमद्भागवतपुराणम्/"
DEV = "०१२३४५६७८९"
dev = lambda n: "".join(DEV[int(c)] for c in str(n))
undev = lambda s: int("".join(str(DEV.index(c)) if c in DEV else c for c in s))


def all_titles():
    ts, cont = [], {}
    while True:
        d = api(HOST, action="query", list="allpages", apprefix=BASE + "स्कन्धः", aplimit=500, **cont)
        ts += [x["title"] for x in d["query"]["allpages"]]
        if "continue" not in d:
            return ts
        cont = {"apcontinue": d["continue"]["apcontinue"]}


def chapter_items(title, cn):
    w = wikitext(HOST, title) or ""
    poems = re.findall(r"<poem>(.*?)</poem>", w, flags=re.S)
    body = "\n".join(poems) if poems else re.sub(r"\{\{.*?\}\}", "", w, flags=re.S)
    lines, colophon = [], []
    for l in clean_wiki(body):
        l = l.strip()
        if colophon or l.startswith("इति श्रीमद्"):
            colophon.append(l)
            continue
        if re.fullmatch(r"\(.{2,30}\)", l):          # metre label such as (अनुष्टुप्)
            lines.append("॥ " + l.strip("() ") + " ॥")
            continue
        s = re.sub(r"\s*[।|]+\s*$", "", l)
        if re.search(r"(उवाच|ऊचुः|ऊचतुः)$", s) and len(s) < 45:
            l = s + " —"
        lines.append(l)
    items = verses(lines, cn, numbered=True)
    if colophon:
        items.append({"id": f"{cn}.end", "h": " ".join(x for x in colophon if x)})
    return items


def main(want):
    titles = all_titles()
    rx = re.compile(r"^" + re.escape(BASE) + r"स्कन्धः ([०-९]+)/(?:(पूर्वार्धः|उत्तरार्धः)/)?अध्यायः ([०-९]+)$")
    chs = []
    for t in titles:
        m = rx.match(t)
        if m and undev(m.group(1)) in want:
            chs.append((undev(m.group(1)), undev(m.group(3)), t))
    chs.sort()
    out = os.path.join(ROOT, "data", "bhagavata")
    os.makedirs(out, exist_ok=True)
    toc, report = [], {}
    for k, (sk, ad, t) in enumerate(chs, 1):
        items = chapter_items(t, k)
        nums = [undev(x["n"]) for x in items if "n" in x and re.fullmatch(r"[०-९]+", x["n"])]
        verses_n = sum(1 for x in items if "text" in x)
        bad = verses_n - len(nums)
        r = report.setdefault(sk, [0, 0, 0])
        r[0] += 1; r[1] += verses_n; r[2] += bad
        fname = f"{sk:02}-{ad:03}.json"
        src = "https://sa.wikisource.org/wiki/" + urllib.parse.quote(t.replace(" ", "_"))
        json.dump({"book": "bhagavata", "n": k, "title": f"स्कन्ध {dev(sk)} · अध्याय {dev(ad)}", "src": src, "items": items},
                  open(os.path.join(out, fname), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        first = next((x["text"].split("\n")[0] for x in items if "text" in x), "")
        toc.append({"n": k, "file": fname, "label": f"{sk}.{ad}", "group": f"स्कन्ध {dev(sk)} · Skandha {sk}",
                    "title": f"स्कन्ध {dev(sk)} · अध्याय {dev(ad)}", "first": first[:60], "count": verses_n})
    json.dump({"book": "bhagavata", "chapters": toc}, open(os.path.join(out, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for sk, (c, v, bad) in sorted(report.items()):
        print(f"skandha {sk}: {c} chapters, {v} verses, {bad} without a number")


if __name__ == "__main__":
    main([int(x) for x in sys.argv[1:]] or list(range(1, 13)))
