"""Build the Sahasranama stotras from Sanskrit Wikisource.

  vishnu-sahasranama  <- sa.wikisource "श्रीविष्णुसहस्रनामस्तोत्रम्‌" (typed page, sections by == headings ==)
  lalita-sahasranama  <- sa.wikisource "श्री ललितासहस्रनामस्तोत्रम्" (typed page, two <poem> blocks)
  shiva-sahasranama   <- sa.wikisource "शिवसहस्रनामस्तोत्रम्" (validated scan pages of बृहत्स्तोत्ररत्नाकरः, 1953)

The words are used exactly as on Wikisource. This script only splits lines into verses
(a verse ends at ॥ or ।।, or after four lines), turns "X उवाच" lines into speakers and
"॥ X ॥" lines into headings, and adds a Roman transliteration made by tools/iast.py.
"""
import json, os, re, sys, urllib.parse
sys.path.insert(0, os.path.dirname(__file__))
from wiki import wikitext, html as page_html, ROOT
from iast import iast
from build_premchand import Paras

HOST = "sa.wikisource.org"
DEV = "०१२३४५६७८९"
dev = lambda n: "".join(DEV[int(c)] for c in str(n))
undev = lambda s: "".join(str(DEV.index(c)) if c in DEV else c for c in s)
END = re.compile(r"(॥|।।)\s*([०-९0-9]*)\s*(॥|।।)?\s*$|॥\s*[०-९0-9]+\s*$")
SPEAKER = re.compile(r"^(.{2,40}?(उवाच|:|ः)\s*[-–—]+|.{2,30}उवाच\s*[-–—:]*)\s*$")
HEAD = re.compile(r"^(॥|।।)\s*([^॥।]{2,60}?)\s*(॥|।।)$")


def clean_wiki(text):
    text = re.sub(r"<center>|</center>|<br\s*/?>", "\n", text)
    text = re.sub(r"'''(.*?)'''", r"॥ \1 ॥", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("&#32;", " ").replace(" ", " ")
    return [l.strip() for l in text.split("\n")]


NUM_END = re.compile(r"[॥|।]\s*[०-९0-9]+\s*(॥|।।)?\s*$")


def verses(lines, chap, numbered=False):
    """numbered=True: every verse in the source ends with ॥<number>॥, so only that ends a verse."""
    """Group lines into items: headings, speakers (attached to the next verse) and verses."""
    items, buf, speaker = [], [], None
    k = 0

    def flush():
        nonlocal buf, speaker, k
        if not buf:
            return
        k += 1
        text = "\n".join(buf)
        m = re.search(r"([०-९0-9]+)\s*(॥|।।)?\s*$", buf[-1])
        it = {"id": f"{chap}.{k}"}
        if m:
            it["n"] = dev(undev(m.group(1)))
        if speaker:
            it["speaker"] = speaker
        it["text"] = text
        it["tr"] = "\n".join(iast(l) for l in buf)
        items.append(it)
        buf, speaker = [], None

    for l in lines:
        l = re.sub(r"\s+", " ", l).strip()
        if not l or l in ("ॐ", "॥", "।।"):
            continue
        if HEAD.match(l) and not buf:
            k += 1
            items.append({"id": f"{chap}.{k}", "h": HEAD.match(l).group(2).strip()})
            continue
        if SPEAKER.match(l) and len(l) < 45:
            flush()
            speaker = re.sub(r"\s*[-–—:]+$", "", l).strip()
            continue
        buf.append(l)
        if (NUM_END.search(l) or len(buf) >= 6) if numbered else (END.search(l) or len(buf) >= 4):
            flush()
    flush()
    return items


def write_book(bid, chapters, src):
    out = os.path.join(ROOT, "data", bid)
    os.makedirs(out, exist_ok=True)
    for f in os.listdir(out):
        os.remove(os.path.join(out, f))
    toc = []
    for n, (title, items) in enumerate(chapters, 1):
        fname = f"{n:02}.json"
        json.dump({"book": bid, "n": n, "title": title, "src": src, "items": items},
                  open(os.path.join(out, fname), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        count = sum(1 for x in items if "text" in x)
        first = next((x["text"].split("\n")[0] for x in items if "text" in x), "")
        toc.append({"n": n, "file": fname, "title": title, "first": first, "count": count})
    json.dump({"book": bid, "chapters": toc}, open(os.path.join(out, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(bid, [(c["title"], c["count"]) for c in toc], "verses:", sum(c["count"] for c in toc))


def url(title):
    return "https://sa.wikisource.org/wiki/" + urllib.parse.quote(title.replace(" ", "_"))


def vishnu():
    title = "श्रीविष्णुसहस्रनामस्तोत्रम्‌"
    w = wikitext(HOST, title)
    w = w.split("==स्रोतः==")[0]
    w = re.sub(r"^.*?==मूलपाठः==", "==पूर्वपीठिका==", w, flags=re.S)
    parts = re.split(r"^==\s*(.+?)\s*==\s*$", w, flags=re.M)[1:]
    chapters = []
    for i in range(0, len(parts), 2):
        name, body = parts[i].strip(" ‌"), parts[i + 1]
        items = verses(clean_wiki(body), len(chapters) + 1)
        if not any("text" in x for x in items):
            continue
        # the four short nyasa sections read better as one
        if chapters and name.startswith("अथ") and "न्यास" in name and "न्यास" in chapters[-1][0]:
            prev = chapters[-1][1]
            base = len(prev)
            for j, x in enumerate(items, 1):
                x["id"] = f"{len(chapters)}.{base + j}"
            prev.append({"id": f"{len(chapters)}.h{len(prev)}", "h": name.replace("अथ ", "")})
            prev.extend(items)
            continue
        chapters.append((name.replace("अथ ", ""), items))
    write_book("vishnu-sahasranama", chapters, url(title))


def lalita():
    title = "श्री ललितासहस्रनामस्तोत्रम्"
    w = wikitext(HOST, title)
    poems = re.findall(r"<poem>(.*?)</poem>", w, flags=re.S)
    chapters = [("पूर्वभागः", verses(clean_wiki(poems[0]), 1)), ("सहस्रनामस्तोत्रम्", verses(clean_wiki(poems[1]), 2))]
    write_book("lalita-sahasranama", chapters, url(title))


def shiva():
    title = "शिवसहस्रनामस्तोत्रम्"
    p = Paras()
    p.feed(page_html(HOST, title))
    p.flush()
    lines = []
    for tag, text in p.out:
        lines.extend(text.split("\n"))
    # drop the header block (title, author, year) before the opening "॥ श्रीशिवसहस्रनामस्तोत्रम् ॥"
    start = next(i for i, l in enumerate(lines) if "॥ श्रीशिवसहस्रनामस्तोत्रम् ॥" in l)
    lines = lines[start + 1:]
    end_at = next(i for i, l in enumerate(lines) if l.startswith("इति श्रीमन्महाभारते"))
    colophon = " ".join(lines[end_at:]).strip()
    items = verses(lines[:end_at], 1)
    items.append({"id": "1.end", "h": colophon})
    write_book("shiva-sahasranama", [("श्रीशिवसहस्रनामस्तोत्रम्", items)], url(title))


def chanakya():
    title = "चाणक्यनीतिः"
    w = wikitext(HOST, title)
    w = re.sub(r"\[\[वर्गः:[^\]]*\]\]", "", w)
    parts = re.split(r"^==\s*(.+?)\s*==\s*$", w, flags=re.M)[1:]
    chapters = []
    for i in range(0, len(parts), 2):
        chapters.append((parts[i].strip(), verses(clean_wiki(parts[i + 1]), len(chapters) + 1, numbered=True)))
    write_book("chanakya-niti", chapters, url(title))


if __name__ == "__main__":
    for f in sys.argv[1:] or ["vishnu", "lalita", "shiva"]:
        globals()[f]()
