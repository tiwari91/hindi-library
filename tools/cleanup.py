"""Shared clean-up for verse text taken from Wikisource. Used by every build script
(build_stotras.verses calls it for each verse) and by `python3 tools/cleanup.py <book> ...`
to apply the same rules to a book's data files after a build.

What it changes (only apparatus, never the words of a verse):
- Verse numbers: the number at the end of a verse is always written "॥ N ॥". The many forms on
  Wikisource ("। । १", "॥ १,१.१ ॥", "।।.7 ।।", "।३.००१", "पुनातु१।", "महामुने १ ।") are all read as
  the verse number; a source number like "१.१.१०" keeps only its last part.
- Dandas: "। ।" and "।।" inside a verse become "॥".
- Footnote marks: a number inside a line that is not the verse number is removed, e.g.
  "विमृश्य च १ भृशम्", "२अयं गुरुः", "योज्य३ धर्म", "विप्रेन्द्र १!", "(३)".
- Speaker lines: a first line that is only "X उवाच" (or "X ऊचुः") becomes the verse's speaker.
- Numbering (finish_doc): when a chapter's verse numbers start again from 1 (an opening invocation
  numbered 1-8, then the chapter proper from 1), the verses before the restart get "pre": true and the
  reader calls them "Invocation 1-8". If numbers still repeat after that, the chapter gets
  "numbering": "position" and the reader numbers its verses by position, showing the source's own
  number beside it.
Verse ids are "<chapter n>.<position>" and are not changed here.
After cleaning, the Roman transliteration is made again from the cleaned Devanagari.
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from iast import iast

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEVD = "०१२३४५६७८९"
NUM = r"[०-९0-9]+"
to_ascii = lambda s: "".join(str(DEVD.index(c)) if c in DEVD else c for c in s)
to_dev = lambda s: "".join(DEVD[int(c)] if c.isdigit() else c for c in s)
DEV_RE = re.compile(r"[ऀ-ॿ]")
D = r"[।॥|]"

# end-of-verse number forms, tried in order; group 1 is the number (maybe "1.1.10")
# another edition's number in brackets after the verse number, "॥ ९.६१ ॥ (९.६२)", is a cross-reference
REF = r"(?:\s*\(\s*[0-9०-९.\s]+\))?"
END_FORMS = [
    re.compile(r"\s*(?:" + D + r"\s*)+\.?\s*(" + NUM + r"(?:\s*[.,\-–]\s*" + NUM + r")*)\s*(?:" + D + r"\s*)*" + REF + r"\s*$"),  # ॥ १ ॥, । । १, ।।.7 ।।, ।३.००१
    re.compile(r"\s*\(?(" + NUM + r")\)?\s*(?:" + D + r"\s*)+$"),                                               # पुनातु१।, महामुने १ ।
]
END_MARK = END_FORMS[0]
MID_MARK = re.compile(r"॥\s*" + NUM + r"(?:\s*[.,\-]\s*" + NUM + r")*\s*॥")
# "सूत उवाच", and with sandhi "अग्निरुवाच", "सुमन्तुरुवाच", "ऋषय ऊचुः"
SPEAKER_LINE = re.compile(r"^\s*([^\s।॥|0-9०-९]{1,30}(?:\s[^\s।॥|0-9०-९]{1,20})?\s?(?:उवाच|ुवाच|ऊचुः|ूचुः|ऊचतुः|ूचतुः))\s*[।॥|:\-–—]*\s*$")
# editors' notes on variant readings that Wikisource prints among the verses (mostly Agni Purana):
# "टिप्पणी", "... इति ख, ग चिह्नितपुस्तकद्वयपाठः"
NOTE_LINE = re.compile(r"^\s*टिप्पणी\s*[:\-–—]*\s*$|चिह्नित\S*\s*(?:पुस्त\S*\s*)?पाठः|पुस्तकपाठः|पुस्तकद्वयपाठः|पुस्तकत्रयपाठः"
                       r"|\[https?://|^\s*तु\.\s")   # Wikisource comparison notes: "तु. ऐतरेयारण्यकम् [https://...]"


def verse_end(line):
    """If `line` ends with a verse number, return (text before it, number as ASCII digits); else None."""
    for rx in END_FORMS:
        m = rx.search(line)
        if m and DEV_RE.search(line[:m.start()] or ""):
            num = re.split(r"\s*[.,\-–]\s*", m.group(1))[-1]
            return line[:m.start()], str(int(to_ascii(num)))
    return None


def strip_footnotes(s):
    keep = {}

    def protect(mm):
        key = f"\0{len(keep)}\0"
        keep[key] = mm.group(0)
        return key
    s = MID_MARK.sub(protect, s)
    s = re.sub(r"\[\[[^\]]*\]\]", "", s)                                     # Wikisource links to a quoted Vedic mantra "[[...|३६.२४]]"
    s = re.sub(r"\S*\|" + NUM + r"(?:\." + NUM + r")*\]\]", "", s)          # the same, cut in two by a line break
    s = re.sub(r"\{\s*" + NUM + r"\s*\}", "", s)                            # "{१५९}"
    s = re.sub(r"(?<=[ऀ-ॿ])" + NUM + r"(?:\." + NUM + r")*\.+", "", s)     # "काममोहिताः1.23."
    s = re.sub(r"(?<!\S)" + NUM + r"(?:\." + NUM + r")*\.+(?=\s|[।॥|]|$)", "", s)  # "११०." "१२."
    s = re.sub(r"(?<=\s)" + NUM + r"(?=[ऀ-ॿ])", "", s)                      # "विपुलैः १सुकुमारैश्च"
    s = re.sub(r"\(\s*" + NUM + r"(?:\s*\.\s*" + NUM + r")*\s*\)", "", s)   # "(३)", "(1.8.2)"
    s = re.sub(r"(?<!\S)" + NUM + r"(?:\." + NUM + r")+\.?(?!\S)", "", s)    # chapter references "1.1."
    s = re.sub(r"\s*" + NUM + r"\s*(?=[!?,;:।॥|]|$)", "", s)         # "विप्रेन्द्र १!", "प्रयत्नतः ५"
    s = re.sub(r"(?<=\s)" + NUM + r"\s+", "", s)                     # "च १ भृशम्"
    s = re.sub(r"^" + NUM + r"\s*(?=[ऀ-ॿ])", "", s)                  # "२अयं"
    s = re.sub(r"(?<=[ऀ-ॿ])" + NUM + r"(?=\s)", "", s)               # "योज्य३ धर्म"
    for k, v in keep.items():
        s = s.replace(k, v)
    return s


def clean_line(l, last=False):
    """Clean one line of verse text. `last`: the last line of a verse (it may carry the number)."""
    # Kannada digits (೦-೯) sometimes stand in for Devanagari ones in the typed text
    s = re.sub(r"[೦-೯]", lambda m: DEVD[ord(m.group(0)) - 0x0CE6], l)
    s = s.replace("।।", "॥")
    s = re.sub(r"।\s+।", "॥", s)
    end = ""
    ve = verse_end(s)
    if ve and (last or END_MARK.search(s)):
        s, num = ve
        end = " ॥ " + to_dev(num) + " ॥"
    s = strip_footnotes(s)
    s = re.sub(r"\s+", " ", s).strip()
    if end:
        # a danda left just before the verse number ("दक्षिणे ॥ ॥ २० ॥") goes
        s = re.sub(r"[\s।॥|]+$", "", s)
    return (s + end).strip()


def clean_item(it):
    """Clean one verse item in place. Returns True when something changed."""
    if "text" not in it:
        return False
    before = (it.get("text"), it.get("speaker"), it.get("n"))
    lines = [l for l in it["text"].split("\n") if not NOTE_LINE.search(l)]
    if not lines:
        it["_drop"] = True
        return True
    if len(lines) > 1:
        m = SPEAKER_LINE.match(lines[0])
        if m and not it.get("speaker"):
            it["speaker"] = m.group(1)
            lines = lines[1:]
    lines = [clean_line(l, i == len(lines) - 1) for i, l in enumerate(lines)]
    lines = [l for l in lines if l and l not in ("॥", "।")]
    if not lines:
        it["_drop"] = True
        return True
    it["text"] = "\n".join(lines)
    m = re.search(r"॥ (" + NUM + r") ॥$", lines[-1])
    if m:
        it["n"] = m.group(1)
    it["tr"] = "\n".join(iast(l) for l in lines)
    return before != (it.get("text"), it.get("speaker"), it.get("n"))


def finish_doc(doc):
    """Mark an opening invocation run, and number by position when the source's numbers repeat."""
    items = doc["items"]
    for it in items:
        it.pop("pre", None)
    doc.pop("numbering", None)
    vs = [it for it in items if "text" in it]
    nums = [(i, int(to_ascii(it["n"]))) for i, it in enumerate(vs) if it.get("n") and to_ascii(it["n"]).isdigit()]
    peak, restart = 0, None
    for i, n in nums:
        if n == 1 and peak > 1:
            restart = i
            break
        peak = max(peak, n)
    if restart is not None:
        # an opening run only: it must start at the chapter's first verse
        if nums and nums[0][0] == 0:
            for it in vs[:restart]:
                it["pre"] = True
    seen, dup = set(), False
    for it in vs:
        if it.get("pre") or not it.get("n"):
            continue
        if it["n"] in seen:
            dup = True
            break
        seen.add(it["n"])
    if dup:
        doc["numbering"] = "position"
    return doc


def clean_book(book, items_too=True):
    folder = os.path.join(ROOT, "data", book)
    toc = json.load(open(os.path.join(folder, "index.json"), encoding="utf-8"))
    changed = 0
    for c in toc["chapters"]:
        path = os.path.join(folder, c["file"])
        doc = json.load(open(path, encoding="utf-8"))
        if items_too:
            changed += sum(1 for it in doc["items"] if clean_item(it))
            doc["items"] = [it for it in doc["items"] if not it.pop("_drop", False)]
        finish_doc(doc)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
        first = next((x["text"].split("\n")[0] for x in doc["items"] if "text" in x), None)
        if first is not None and "first" in c:
            c["first"] = first[:60]
        c["count"] = sum(1 for x in doc["items"] if "text" in x)
    with open(os.path.join(folder, "index.json"), "w", encoding="utf-8") as f:
        json.dump(toc, f, ensure_ascii=False, indent=1)
    print(f"{book}: {changed} verses cleaned")


if __name__ == "__main__":
    for b in sys.argv[1:]:
        clean_book(b)
