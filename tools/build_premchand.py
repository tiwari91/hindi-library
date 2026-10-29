"""Build a Premchand story collection from Hindi Wikisource (मानसरोवर भाग १ और २).

Each story page on Wikisource joins its proofread scan pages. A story is used only when every
scan page it uses is proofread (level 3) or validated (level 4); others are listed as skipped.
The text is taken from the rendered page: paragraphs only, with page numbers and headers removed.
Writes data/premchand/index.json and data/premchand/NN.json.
"""
import json, os, re, sys, urllib.parse
from html.parser import HTMLParser
sys.path.insert(0, os.path.dirname(__file__))
from wiki import api, html as page_html, page_quality, ROOT, _cached

HOST = "hi.wikisource.org"
VOLUMES = ["मानसरोवर १", "मानसरोवर २"]
WIKI = "https://hi.wikisource.org/wiki/"


class Paras(HTMLParser):
    """Collect text of <p> and <poem>/<div class=poem> blocks, skipping page numbers and headers."""
    SKIP_CLASSES = ("pagenum", "ws-pagenum", "headertemplate", "ws-noexport", "mw-editsection", "reference", "noprint")

    def __init__(self):
        super().__init__()
        self.out = []
        self.buf = None
        self.skip = 0
        self.stack = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = a.get("class", "") or ""
        skipping = any(c in cls for c in self.SKIP_CLASSES) or tag in ("style", "script", "sup")
        self.stack.append((tag, skipping))
        if skipping:
            self.skip += 1
            return
        if self.skip:
            return
        if tag in ("p", "h2", "h3", "h4") or (tag == "div" and "poem" in cls):
            self.flush()
            self.buf = {"tag": "poem" if "poem" in cls else tag, "text": ""}
        elif tag == "br" and self.buf is not None:
            self.buf["text"] += "\n"

    def handle_startendtag(self, tag, attrs):
        if tag == "br" and self.buf is not None and not self.skip:
            self.buf["text"] += "\n"

    def handle_endtag(self, tag):
        while self.stack:
            t, sk = self.stack.pop()
            if sk:
                self.skip -= 1
            if t == tag:
                break
        if not self.skip and self.buf is not None and tag in ("p", "h2", "h3", "h4", "div") and self.buf["tag"] in (tag, "poem"):
            if tag == "div" and self.buf["tag"] != "poem":
                return
            self.flush()

    def handle_data(self, data):
        if self.skip or self.buf is None:
            return
        self.buf["text"] += data

    def flush(self):
        if self.buf is not None:
            t = self.buf["text"]
            t = re.sub(r"[ \t ]+", " ", t)
            t = "\n".join(l.strip() for l in t.split("\n")).strip()
            if t:
                self.out.append((self.buf["tag"], t))
        self.buf = None


def stories():
    out = []
    for vol in VOLUMES:
        d = api(HOST, action="query", list="allpages", apprefix=vol + "/", apnamespace=0, aplimit=500)
        for p in d["query"]["allpages"]:
            out.append(p["title"])
    return out


def transcluded_pages(title):
    def fetch():
        d = api(HOST, action="parse", page=title, prop="templates")
        return [t["*"] for t in d["parse"]["templates"] if t["ns"] == 250]
    return _cached(HOST, title, "tpl", fetch)


def main():
    outdir = os.path.join(ROOT, "data", "premchand")
    os.makedirs(outdir, exist_ok=True)
    for f in os.listdir(outdir):
        os.remove(os.path.join(outdir, f))
    titles = stories()
    used, skipped = [], []
    for t in titles:
        name = re.sub(r"^[०-९0-9]+\s*", "", t.split("/", 1)[1]).strip()
        if name in ("विषय-सूची", "भूमिका", "सूची"):
            continue
        pages = transcluded_pages(t)
        q = page_quality(HOST, pages) if pages else {}
        bad = [p for p in pages if q.get(p) not in (3, 4)]
        if not pages or bad:
            skipped.append((name, len(bad), len(pages)))
            continue
        parser = Paras()
        parser.feed(page_html(HOST, t))
        parser.flush()
        blocks = parser.out
        # drop a leading repeat of the title
        if blocks and blocks[0][1].replace(" ", "") == name.replace(" ", ""):
            blocks = blocks[1:]
        items = []
        for k, (tag, text) in enumerate(blocks, 1):
            if tag in ("h2", "h3", "h4") or re.fullmatch(r"\(\s*[०-९0-9]+\s*\)", text):
                items.append({"id": str(k), "h": text})
            elif tag == "poem":
                items.append({"id": str(k), "poem": text})
            else:
                # proofreaders often keep the scan's line breaks; a line ending in "-" continues the word
                t = re.sub(r"-\n", "-", text)
                items.append({"id": str(k), "p": re.sub(r"\s*\n\s*", " ", t)})
        if len(items) < 5:
            skipped.append((name, "too short", len(pages)))
            continue
        used.append((name, t, items))
    used.sort(key=lambda x: x[0])
    toc = []
    for i, (name, t, items) in enumerate(used, 1):
        fname = f"{i:02}.json"
        vol = t.split("/")[0]
        src = WIKI + urllib.parse.quote(t.replace(" ", "_"))
        doc = {"book": "premchand", "n": i, "title": name, "src": src, "note": f"‘{vol}’ (सरस्वती प्रेस, बनारस) से · From {vol} on Hindi Wikisource", "items": items}
        with open(os.path.join(outdir, fname), "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
        words = sum(len((x.get("p") or x.get("poem") or "").split()) for x in items)
        toc.append({"n": i, "file": fname, "title": name, "first": vol, "count": None, "words": words})
    with open(os.path.join(outdir, "index.json"), "w", encoding="utf-8") as f:
        json.dump({"book": "premchand", "chapters": toc}, f, ensure_ascii=False, indent=1)
    print("used", len(used), "stories:", ", ".join(x[0] for x in used))
    print("skipped (not fully proofread):", skipped)


if __name__ == "__main__":
    main()
