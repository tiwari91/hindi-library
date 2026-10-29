"""Fetch Annie Besant's English translation of the Bhagavad Gita (4th edition, 1922) from
English Wikisource (public domain) and save it verse by verse to sources/en-pd/gita-besant.json.

On Wikisource each discourse prints the Sanskrit verse, then the English, which ends with the
verse number in brackets: "... spake these words: (1)". Where Besant translates two or more verses
together the number is a range, "(11-12)". Speaker lines ("Sanjaya said:") and footnote markers
are left out; nothing is reworded.
Output: {"<chapter>.<verse>": {"en": "...", "verses": [first, last]}}
"""
import json, os, re, sys
from html.parser import HTMLParser
sys.path.insert(0, os.path.dirname(__file__))
from wiki import html as page_html, ROOT

HOST = "en.wikisource.org"
TITLE = "Bhagavad-Gita (Besant 4th)/Discourse {}"
EXPECTED = [47, 72, 43, 42, 29, 47, 30, 28, 34, 42, 55, 20, 34, 27, 20, 24, 28, 78]


class Blocks(HTMLParser):
    """Text of block elements, skipping <style>, footnote markers and the page header."""
    def __init__(self):
        super().__init__()
        self.out, self.buf, self.skip = [], [], 0

    def handle_starttag(self, tag, attrs):
        cls = dict(attrs).get("class", "") or ""
        if tag in ("style", "script", "sup") or "ws-noexport" in cls or "wst-header" in cls or "pagenum" in cls or "reference" in cls:
            self.skip += 1
            self._stack_skip = getattr(self, "_stack_skip", []) + [tag]
            return
        if tag in ("p", "div", "br", "dd", "li", "h2", "h3"):
            self.flush()

    def handle_endtag(self, tag):
        st = getattr(self, "_stack_skip", [])
        if self.skip and st and st[-1] == tag:
            st.pop()
            self.skip -= 1
            return
        if tag in ("p", "div", "dd", "li", "h2", "h3"):
            self.flush()

    def handle_data(self, d):
        if not self.skip:
            self.buf.append(d)

    def flush(self):
        t = re.sub(r"\s+", " ", "".join(self.buf)).strip()
        if t:
            self.out.append(t)
        self.buf = []


NUM = re.compile(r"\((\d+)(?:\s*[-–,]\s*(\d+))?\)\s*$")
DEV = re.compile(r"[ऀ-ॿ]")
SAID = re.compile(r"^[A-Z][\w\sâîûêôÂÎÛ'’.-]{0,40} said:?$")


def chapter(c):
    p = Blocks()
    p.feed(page_html(HOST, TITLE.format(c)))
    p.flush()
    out, buf, last, sa_num = {}, [], 0, None
    for t in p.out:
        if DEV.search(t):
            ms = re.search(r"॥\s*([०-९]+)\s*॥", t)
            if ms:
                sa_num = int(ms.group(1).translate(str.maketrans("०१२३४५६७८९", "0123456789")))
            # English that ran up to the next Sanskrit verse without a "(N)" at its end is the
            # verse after the last numbered one (the number was lost in the page's markup)
            if buf:
                text = re.sub(r"^(?:[A-Z][\w\sâîûêôÂÎÛ'’.-]{0,40} said:)\s*", "", " ".join(buf)).strip()
                # the chapter-end colophon ("Thus in the glorious Upanishads ...") is not a verse
                if text and len(text) > 20 and not text.startswith("Thus in the glorious"):
                    last += 1
                    # a broken number such as "(42" or "32)" at the end is the same verse number
                    m = re.search(r"\s*\(?(\d+)\)?\s*$", text)
                    if m and int(m.group(1)) == last:
                        text = text[:m.start()].rstrip()
                    out[f"{c}.{last}"] = {"en": text, "verses": [last, last], "unnumbered": True}
            buf = []
            continue
        t = re.sub(r"\[\d+\]", "", t).strip()
        if not t or SAID.match(t) or re.fullmatch(r"[A-Z\s.]+DISCOURSE\.?", t):
            continue
        buf.append(t)
        m = NUM.search(t)
        if m:
            a = int(m.group(1)); b = int(m.group(2) or a)
            # a few English numbers on Wikisource are typos ("(20)" twice); for a single verse the
            # number printed with the Sanskrit just above it is the one to trust
            if a == b and sa_num and sa_num != b and sa_num == last + 1:
                a = b = sa_num
            text = NUM.sub("", " ".join(buf)).strip()
            # a speaker line can be joined to the verse text when the page has no break between them
            text = re.sub(r"^(?:[A-Z][\w\sâîûêôÂÎÛ'’.-]{0,40} said:)\s*", "", text)
            out[f"{c}.{b}"] = {"en": text, "verses": [a, b]}
            buf, last = [], b
    if c == 13:
        # Besant's chapter 13 starts with an extra verse ("Arjuna said: Matter and Spirit ..."),
        # which this site's Sanskrit text does not have; her verse N is verse N-1 here
        shifted = {}
        for k, v in out.items():
            a, b = v["verses"]
            if b == 1:
                continue
            shifted[f"13.{b - 1}"] = dict(v, verses=[max(1, a - 1), b - 1])
        out = shifted
    return out


def main():
    allv, report = {}, []
    for c in range(1, 19):
        ch = chapter(c)
        covered = set()
        for v in ch.values():
            covered |= set(range(v["verses"][0], v["verses"][1] + 1))
        missing = sorted(set(range(1, EXPECTED[c - 1] + 1)) - covered)
        report.append((c, len(ch), missing))
        allv.update(ch)
    os.makedirs(os.path.join(ROOT, "sources", "en-pd"), exist_ok=True)
    with open(os.path.join(ROOT, "sources", "en-pd", "gita-besant.json"), "w", encoding="utf-8") as f:
        json.dump(allv, f, ensure_ascii=False, indent=0)
    for c, n, miss in report:
        print(f"ch {c:2}: {n} English blocks; missing verses {miss}")


if __name__ == "__main__":
    main()
