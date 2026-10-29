"""Build Ramcharitmanas kands from the proofread scan pages in sources/manas_pages.json.

Source: Belvedere Press, Prayag (1925), text with the Hindi commentary of Mahavir Prasad
Malviya 'Veer', transcribed and proofread on hi.wikisource.org.

Only pages marked proofread (level 3) or validated (level 4) are used. An unproofread page inside
a kand becomes a visible gap with a link to the scan; nothing is filled in.

For each verse block the first paragraph after it is the meaning (अर्थ); further paragraphs up to
the next verse are the editor's notes (टिप्पणी), shown separately and hidden by default.
Writes data/manas-<kand>/index.json and one JSON file per group of 25 dohas.
"""
import json, os, re, sys, urllib.parse
sys.path.insert(0, os.path.dirname(__file__))
from wiki import ROOT, dev, DEV_DIGITS
from iast import iast

KANDS = {
    "bal": {"title": "बालकाण्ड", "title_tr": "Bālakāṇḍa", "first": 52, "last": 424, "sopan": "प्रथम सोपान"},
    "sundar": {"title": "सुन्दरकाण्ड", "title_tr": "Sundarakāṇḍa", "first": 850, "last": 921, "sopan": "पञ्चम सोपान"},
}
PAGE_URL = "https://hi.wikisource.org/wiki/" + urllib.parse.quote("पृष्ठ:रामचरितमानस.pdf/")
PER_CHAPTER = 25
VERSE_BLOCK = re.compile(r"\{\{\s*[Bb]lock[ _]cent(?:er|re)\s*\|(.*?)\}\}\s*(?=\n|$)", re.S)
DIG = str.maketrans(DEV_DIGITS, "0123456789")


def strip_markup(s):
    s = re.sub(r"<noinclude>.*?</noinclude>", "", s, flags=re.S)
    s = re.sub(r"\{\{\s*[Cc]ss image crop.*?\}\}", "", s, flags=re.S)
    s = re.sub(r"\{\{\s*[Rr]h\|.*?\}\}", "", s, flags=re.S)
    return s


def clean_inline(s):
    s = re.sub(r"\{\{\s*[Gg]ap\s*\}\}", "", s)
    s = re.sub(r"\{\{\s*SIC\|([^|}]*)\|?[^}]*\}\}", r"\1", s)
    s = re.sub(r"<br\s*/?>", "\n", s)
    s = re.sub(r"</?poem>", "", s)
    s = re.sub(r"'''|''", "", s)
    # unwrap formatting templates like {{larger|...}}, {{c|...}}, {{x-larger|...}}
    for _ in range(4):
        s = re.sub(r"\{\{\s*(?:[Xx]+-)?[Ll]arger\s*\|([^{}]*)\}\}", r"\1", s)
        s = re.sub(r"\{\{\s*(?:[Cc]|center|right|left|r)\s*\|([^{}]*)\}\}", r"\1", s)
    s = re.sub(r"\{\{[^{}]*\}\}", "", s)
    s = re.sub(r"[ \t ]+", " ", s)
    return s.strip()


def tokens(text):
    """Split one page into ('verse', lines) / ('head', text) / ('para', text) tokens."""
    text = strip_markup(text)
    out = []
    pos = 0
    # a verse block may be {{block center|<poem>{{larger|...}}</poem>}} or {{Block centre|{{larger|<poem>...</poem>}}}}
    pat = re.compile(r"\{\{\s*[Bb]lock[ _]cent(?:er|re)\s*\|")
    while True:
        m = pat.search(text, pos)
        chunk_end = m.start() if m else len(text)
        for para in re.split(r"\n\s*\n|\n(?=\{\{\s*[Cc]\|)", text[pos:chunk_end]):
            para = para.strip()
            if not para:
                continue
            is_head = re.match(r"\{\{\s*[Cc]\|", para) is not None
            t = clean_inline(para)
            if not t:
                continue
            # meaning paragraphs often follow a verse with a single newline: split them per line group
            out.append(("head" if is_head else "para", t))
        if not m:
            break
        # the block ends at </poem> plus its closing braces; a few source pages have broken
        # markup with no </poem>, so then end at the first verse-number line instead
        nxt = pat.search(text, m.end())
        limit = nxt.start() if nxt else len(text)
        e = text.find("</poem>", m.end(), limit)
        if e >= 0:
            i = e + len("</poem>")
            mm = re.match(r"(\s*\}\})*", text[i:])
            i += mm.end()
        else:
            mm = re.compile(r"॥\s*[०-९0-9]+\s*॥[}'\s]*?(?=\n|$)").search(text, m.end(), limit)
            i = mm.end() if mm else limit
        block = text[m.end():i]
        lines = [clean_inline(l) for l in clean_inline_keep_lines(block)]
        lines = [l for l in lines if l]
        if lines:
            out.append(("verse", lines))
        pos = i
    return out


def clean_inline_keep_lines(block):
    block = re.sub(r"</?poem>", "\n", block)
    block = re.sub(r"\{\{\s*[Gg]ap\s*\}\}", "", block)
    block = re.sub(r"\{\{\s*SIC\|([^|}]*)\|?[^}]*\}\}", r"\1", block)
    block = re.sub(r"\{\{\s*(?:[Xx]+-)?[Ll]arger\s*\|", "", block)
    block = block.replace("}}", "")
    return [l for l in block.split("\n")]


def join_pages(pages):
    """Concatenate tokens of consecutive pages, merging a paragraph cut by a page break."""
    seq = []
    for p in pages:
        toks = tokens(p["text"])
        for k, (kind, val) in enumerate(toks):
            if k == 0 and kind == "para" and seq and seq[-1][0] == "para" and not re.search(r"[।॥?!\"'”’)\]]\s*$|॥\s*[०-९0-9]+\s*॥\s*$", seq[-1][1]):
                prev = seq[-1][1]
                sep = "" if prev.endswith("-") else " "
                seq[-1] = ("para", (prev[:-1] if prev.endswith("-") else prev) + sep + val, seq[-1][2])
                continue
            seq.append((kind, val, p["n"]))
    return seq


def verse_kind(first_line):
    m = re.match(r"^\s*(चौ[०॰o°]|दो[०॰o°]|सो[०॰o°]|सोरठा|श्लोक|छं[०॰o°]|छन्द|हरिगीतिका)", first_line)
    if not m:
        return None
    k = m.group(1)
    return {"चौ": "चौपाई", "दो": "दोहा", "सो": "सोरठा", "श्": "श्लोक", "छं": "छन्द", "छन": "छन्द", "हर": "छन्द"}.get(k[:2], k)


def end_number(line):
    m = re.search(r"॥\s*([०-९0-9]+)\s*॥\s*$|।।\s*([०-९0-9]+)\s*।।\s*$", line)
    if not m:
        return None
    return int((m.group(1) or m.group(2)).translate(DIG))


def build(kid, cfg, pages_all):
    pages = [p for p in pages_all if cfg["first"] <= p["n"] <= cfg["last"]]
    items, gaps = [], []
    good = []
    for p in pages:
        if p["quality"] in (3, 4) and p["text"]:
            good.append(p)
        else:
            if p["text"] and p["quality"] in (1, 2):
                # flush what we have, then note the gap
                items += make_items(join_pages(good), kid)
                good = []
                items.append({"gap": dev(p["n"]), "src": PAGE_URL + urllib.parse.quote(dev(p["n"]))})
                gaps.append(p["n"])
    items += make_items(join_pages(good), kid)
    # merge consecutive gaps into one notice
    merged = []
    for it in items:
        if "gap" in it and merged and "gap" in merged[-1]:
            merged[-1].setdefault("gap_to", it["gap"])
            merged[-1]["gap_to"] = it["gap"]
            continue
        merged.append(it)
    for k, it in enumerate(merged, 1):
        it["id"] = f"{k}"
    return merged, gaps


def make_items(seq, kid):
    items = []
    i = 0
    cur = None
    while i < len(seq):
        kind, val, pn = seq[i]
        if kind == "head":
            items.append({"h": val})
            cur = None
        elif kind == "verse":
            lines = val
            vk = verse_kind(lines[0])
            it = {"text": "\n".join(lines), "page": pn}
            if vk:
                it["kind"] = vk
            n = end_number(lines[-1])
            if n is not None:
                it["num"] = n
            items.append(it)
            cur = it
        elif kind == "para":
            if cur is None:
                # text with no verse before it (e.g. a note continued after a heading) is kept as a note
                if items and "text" in items[-1]:
                    items[-1]["note"] = (items[-1].get("note", "") + "\n\n" + val).strip()
                i += 1
                continue
            if "hi" not in cur:
                # first paragraph is the meaning; may need more paragraphs until it ends with the verse number
                cur["hi"] = val
            else:
                n = cur.get("num")
                if n is not None and end_number(cur["hi"]) != n and end_number(val) == n and "note" not in cur:
                    cur["hi"] += "\n\n" + val
                else:
                    cur["note"] = (cur.get("note", "") + "\n\n" + val).strip()
        i += 1
    return items


def main():
    pages_all = json.load(open(os.path.join(ROOT, "sources", "manas_pages.json"), encoding="utf-8"))
    for kid, cfg in KANDS.items():
        items, gaps = build(kid, cfg, pages_all)
        outdir = os.path.join(ROOT, "data", "manas-" + kid)
        os.makedirs(outdir, exist_ok=True)
        for f in os.listdir(outdir):
            os.remove(os.path.join(outdir, f))
        # split into chapters of PER_CHAPTER dohas (a chapter ends after a doha or sortha)
        chapters, cur, dohas, first_doha = [], [], 0, None
        for it in items:
            cur.append(it)
            if it.get("kind") in ("दोहा", "सोरठा") and it.get("num"):
                dohas += 1
                first_doha = first_doha or it["num"]
                if dohas >= PER_CHAPTER:
                    chapters.append((cur, first_doha, it["num"]))
                    cur, dohas, first_doha = [], 0, None
        if cur:
            last = max([x.get("num", 0) for x in cur if x.get("kind") in ("दोहा", "सोरठा")] or [0])
            chapters.append((cur, first_doha, last or None))
        toc = []
        for ci, (its, a, b) in enumerate(chapters, 1):
            for it in its:
                if "text" in it:
                    it["tr"] = "\n".join(iast(l) for l in it["text"].split("\n"))
                    it["src"] = PAGE_URL + urllib.parse.quote(dev(it.pop("page")))
                    if it.get("kind"):
                        it["n"] = it["kind"] + (" " + dev(it["num"]) if it.get("num") else "")
                    elif it.get("num"):
                        it["n"] = dev(it["num"])
                    it.pop("num", None)
                    it.pop("kind", None)
            # the source's own doha numbers have typos, so a part is named by its first line
            first = next((x["text"].split("\n")[0] for x in its if "text" in x), "")
            first = re.sub(r"^\s*(चौ[०॰o°]|दो[०॰o°]|सो[०॰o°]|सोरठा|श्लोक|छं[०॰o°])\s*[-—–:]*\s*", "", first).strip(" ।॥")
            title = "भाग " + dev(ci)
            fname = f"{ci:02}.json"
            doc = {"book": "manas-" + kid, "n": ci, "title": cfg["title"] + " · " + title, "items": its}
            with open(os.path.join(outdir, fname), "w", encoding="utf-8") as f:
                json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
            toc.append({"n": ci, "file": fname, "title": title, "first": first, "count": sum(1 for x in its if "text" in x)})
        with open(os.path.join(outdir, "index.json"), "w", encoding="utf-8") as f:
            json.dump({"book": "manas-" + kid, "chapters": toc}, f, ensure_ascii=False, indent=1)
        nverse = sum(1 for x in items if "text" in x)
        nhi = sum(1 for x in items if x.get("hi"))
        print(f"{kid}: {nverse} verse blocks, {nhi} with meaning, {len(chapters)} chapters, unproofread pages skipped: {gaps}")


if __name__ == "__main__":
    main()
