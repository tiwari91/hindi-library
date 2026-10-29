"""Build the Markandeya Purana, and the Devi Mahatmya (its adhyayas 81-93), from Sanskrit Wikisource.

The Wikisource pages hold several adhyayas each and some ranges appear twice under different
names. Each page's <poem> text is split at the closing "इति श्रीमार्कण्डेयपुराणे ..." lines; the adhyaya
number is read from the verse numbers (॥८१.१॥); when an adhyaya appears on two pages the copy
with more verses is kept. Words are used as on Wikisource; notes outside <poem> are left out.
"""
import json, os, re, sys, urllib.parse
sys.path.insert(0, os.path.dirname(__file__))
from wiki import api, wikitext, ROOT
from build_stotras import verses, clean_wiki

HOST = "sa.wikisource.org"
BASE = "मार्कण्डेयपुराणम्"
DEV = "०१२३४५६७८९"
dev = lambda n: "".join(DEV[int(c)] for c in str(n))
undev = lambda s: int("".join(str(DEV.index(c)) if c in DEV else c for c in s))
DM = range(81, 94)


def pages():
    d = api(HOST, action="query", list="allpages", apprefix=BASE + "/", aplimit=500)
    return [x["title"] for x in d["query"]["allpages"] if "अध्याय" in x["title"]]


def segments(title):
    w = wikitext(HOST, title) or ""
    body = "\n".join(re.findall(r"<poem>(.*?)</poem>", w, flags=re.S))
    if not body.strip():
        # some pages have no <poem>: drop templates (header, notes) and category links, keep the text
        t = w
        while re.search(r"\{\{[^{}]*\}\}", t):
            t = re.sub(r"\{\{[^{}]*\}\}", "", t)
        body = re.sub(r"\[\[वर्गः:[^\]]*\]\]|^=+.*?=+\s*$", "", t, flags=re.M)
        body = re.sub(r"\[\[[^\]|]*\|([^\]]*)\]\]", r"\1", body)
        body = re.sub(r"\[\[[^\]]*\]\]", "", body)
    seg = []
    for l in clean_wiki(body):
        l = l.strip()
        if not l:
            continue
        seg.append(l)
        if re.match(r"इति\s?श्री", l):
            yield seg
            seg = []
    if seg:
        yield seg


def adhyaya_no(lines):
    for l in lines:
        m = re.search(r"([०-९]+)\s*\.\s*[०-९]+\s*॥", l)
        if m:
            return undev(m.group(1))
    return None


def items_for(lines, cn):
    body, colophon = [], []
    for l in lines:
        if re.match(r"इति\s?श्री", l):
            colophon.append(l)
            continue
        if re.fullmatch(r"\d+\s*\(\d+\)", l) or re.fullmatch(r".{2,30}ऽध्यायः\s*[-–]?\s*[०-९]+\s*।?", l):
            body.append("॥ " + l.rstrip("। ") + " ॥")
            continue
        s = re.sub(r"\s*[।|]+\s*$", "", l)
        if re.search(r"(उवाच|ऊचुः|ऊचतुः|रुवाच)$", s) and len(s) < 45:
            l = s + " —"
        body.append(l)
    items = verses(body, cn, numbered=True)
    if colophon:
        items.append({"id": f"{cn}.end", "h": " ".join(colophon)})
    return items


def write(bid, chapters, label):
    out = os.path.join(ROOT, "data", bid)
    os.makedirs(out, exist_ok=True)
    for f in os.listdir(out):
        os.remove(os.path.join(out, f))
    toc = []
    for k, (ad, lines, src) in enumerate(chapters, 1):
        items = items_for(lines, k)
        fname = f"{ad:03}.json"
        title = f"अध्याय {dev(ad)}" if bid != "devi-mahatmya" else f"अध्याय {dev(ad - 80)} (मार्कण्डेयपुराण {dev(ad)})"
        json.dump({"book": bid, "n": k, "title": title, "src": src, "items": items},
                  open(os.path.join(out, fname), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        first = next((x["text"].split("\n")[0] for x in items if "text" in x), "")
        toc.append({"n": k, "file": fname, "label": str(ad if bid != "devi-mahatmya" else ad - 80), "title": title,
                    "first": first[:60], "count": sum(1 for x in items if "text" in x)})
    json.dump({"book": bid, "chapters": toc}, open(os.path.join(out, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(bid, len(toc), "adhyayas,", sum(c["count"] for c in toc), "verses")


def main():
    best = {}
    for t in pages():
        src = "https://sa.wikisource.org/wiki/" + urllib.parse.quote(t.replace(" ", "_"))
        segs = list(segments(t))
        # the page title gives its range, e.g. "अध्यायः ००१-००५"; use it when the page has that many adhyayas
        m = re.search(r"([०-९]+)\s*[-–]\s*([०-९]+)\s*$", t.replace("‌", ""))
        m1 = re.search(r"अध्यायः\s*([०-९]+)\s*$", t)
        rng = list(range(undev(m.group(1)), undev(m.group(2)) + 1)) if m else ([undev(m1.group(1))] if m1 else [])
        closed = [s for s in segs if re.match(r"इति\s?श्री", s[-1])]
        for j, seg in enumerate(segs):
            ad = adhyaya_no(seg)
            if ad is None and len(closed) == len(rng) and seg in closed:
                ad = rng[closed.index(seg)]
            if ad is None:
                continue
            nv = sum(1 for l in seg if re.search(r"॥\s*$", l))
            if ad not in best or nv > best[ad][0]:
                best[ad] = (nv, seg, src)
    have = sorted(best)
    missing = [a for a in range(1, 135) if a not in best]
    print("adhyayas found:", len(have), "missing:", missing)
    write("markandeya-purana", [(a, best[a][1], best[a][2]) for a in have], "")
    write("devi-mahatmya", [(a, best[a][1], best[a][2]) for a in have if a in DM], "")


if __name__ == "__main__":
    main()
