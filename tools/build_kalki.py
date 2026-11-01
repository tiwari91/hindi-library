"""Build the Kalki Purana from Sanskrit Wikisource ("कल्किपुराणम्/अध्यायः N", 35 pages).

The Wikisource copy is a study transcription, not a print edition: a verse ends with "))<number>",
")" marks a line break, words are split with "+" and "-", and the typist added metre lines
("– – υ –"), page marks and notes in English and Hindi. This script keeps the Sanskrit words as
typed (the "+" and "-" splits cannot be joined back by rule), turns "))N" into "॥ N ॥", and drops
the metre lines, page marks and notes. Verses are then split as for the other Puranas.
Chapters 1-7 are Amsha 1, 8-14 Amsha 2 and 15-35 Amsha 3.
Usage: python3 tools/build_kalki.py
"""
import json, os, re, sys, urllib.parse
sys.path.insert(0, os.path.dirname(__file__))
from wiki import wikitext, ROOT
from build_stotras import verses, clean_wiki
from build_purana import HOST, dev

BID = "kalki-purana"
BASE = "कल्किपुराणम्/अध्यायः "
AMSHAS = [(1, 7), (2, 7), (3, 21)]   # (amsha, chapters in it), in page order

LATIN = re.compile(r"[A-Za-z]")
METRE = re.compile(r"[υ–]\s*[υ–]")


def clean_line(l):
    l = re.sub(r"«[^»]*»", "", l)                         # Hindi notes: «=नारियल»
    l = re.sub(r"\((?:[^()]*[=A-Za-z:][^()]*|\s*)\)", "", l)   # "(नूपुर= )", "(:1 syllable missing here)", "()"
    l = re.sub(r"page\s*\d+\)?", "", l)
    l = l.replace("’", "ऽ")
    m = re.search(r"\)\)\s*(\d+)", l)
    end = ""
    if m:                                                  # verse end; anything after it is a note
        l, end = l[:m.start()], f" ॥ {dev(int(m.group(1)))} ॥"
    l = re.sub(r"\(([^()]*?)[;?]\)", r"\1", l)             # typist's corrections: "स्वाप्(न्;)असम्मितम्"
    l = re.sub(r"\)+\s+(?=\S)", "\n", l)                   # ")" inside a line = line break
    l = re.sub(r"[()\[\]«»]", "", l).rstrip()                # ")" at the end of a half-verse line, stray "(["
    return [x.strip() for x in (l + end).split("\n")]


def chapter_lines(text):
    """Return (verse lines, colophon, spill). Each page ends with the first verse(s) of the next
    chapter after its closing "इति ... अध्यायः" line; those come back as `spill`."""
    lines, colophon, spill, closed = [], [], [], False
    for raw in clean_wiki(re.sub(r"\{\{.*?\}\}|\[\[[^\]]*\]\]", "", text, flags=re.S)):
        raw = raw.replace("❁", "").strip()
        if not raw or METRE.search(raw) or raw.startswith("("):
            continue                                       # metre lines and the typist's notes
        for l in clean_line(raw):
            if not re.search(r"[\u0900-\u0963\u0971-\u097F]", l) or l in ("श्रीः", "कल्किपुराणम्") or (len(l) < 30 and l.endswith("ंशः")):
                continue
            if "ध्याय" in l and "॥" not in l and len(l) < 60 and not re.match(r"इति[\s-]*श्री", l) and not colophon:
                continue                                   # page headings: "तृतीय+अंशः) प्रथमो ऽध्यायः", "दूसरा अध्याय"
            if closed:
                spill.append(l)
                continue
            if colophon or re.match(r"इति[\s-]*श्री", l):
                colophon.append(re.sub(r"\s*॥\s*[०-९]+\s*॥$|\)+$", "", l))
                closed = "ध्याय" in l
                continue
            if LATIN.search(l):
                l = re.sub(r"\s*[A-Za-z][^॥]*$", "", l)    # English gloss at the end of a line
                if not l or LATIN.search(l):
                    continue
            lines.append(l)
    return lines, " ".join(x for x in colophon if x), spill


def speakers(lines):
    return [l + " —" if re.search(r"(उवाच|ऊचुः|ऊचतुः)$", l) and len(l) < 45 else l for l in lines]


def main():
    out = os.path.join(ROOT, "data", BID)
    os.makedirs(out, exist_ok=True)
    for f in os.listdir(out):
        os.remove(os.path.join(out, f))
    toc, page, total, spill = [], 0, 0, []
    for amsha, count in AMSHAS:
        group = f"अंश {dev(amsha)} · Amsha {amsha}"
        for ad in range(1, count + 1):
            page += 1
            title_page = BASE + dev(page)
            lines, colophon, nxt = chapter_lines(wikitext(HOST, title_page) or "")
            items = verses(speakers(spill + lines), page, numbered=True)
            spill = nxt
            if colophon:
                items.append({"id": f"{page}.end", "h": colophon})
            nv = sum(1 for x in items if "text" in x)
            total += nv
            fname = f"{amsha:02}-{ad:03}.json"
            title = f"अंश {dev(amsha)} · अध्याय {dev(ad)}"
            src = "https://sa.wikisource.org/wiki/" + urllib.parse.quote(title_page.replace(" ", "_"))
            json.dump({"book": BID, "n": page, "title": title, "src": src, "items": items},
                      open(os.path.join(out, fname), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
            first = next((x["text"].split("\n")[0] for x in items if "text" in x), "")
            toc.append({"n": page, "file": fname, "label": f"{amsha}.{ad}", "group": group, "title": title,
                        "first": first[:60], "count": nv})
            print(f"{fname}: {nv} verses")
    json.dump({"book": BID, "chapters": toc}, open(os.path.join(out, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{BID}: {len(toc)} chapters, {total} verses")


if __name__ == "__main__":
    main()
