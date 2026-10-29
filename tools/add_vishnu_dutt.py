"""Add M. N. Dutt's English translation of the Vishnu Purana (1896, public domain) to the site,
one passage per chapter, from the Project Gutenberg edition (eBook #66208, kept in
sources/en-pd/raw/pg66208-vishnupuranam.txt).

Dutt's "PART I ... VI" are the six amshas and his "SECTION I, II ..." are the chapters, the same
22/16/18/24/38/8 chapters as the Sanskrit here. Each chapter file gets "en_chapter": a list of
paragraphs. The translator's footnotes and the inline note numbers like [12] are left out; the
wording is not changed.
Usage: python3 tools/add_vishnu_dutt.py
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "sources", "en-pd", "raw", "pg66208-vishnupuranam.txt")
ROMAN = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100}


def roman(s):
    n = 0
    for i, ch in enumerate(s):
        v = ROMAN[ch]
        n += -v if i + 1 < len(s) and ROMAN[s[i + 1]] > v else v
    return n


def parse():
    text = open(SRC, encoding="utf-8").read()
    body = text.split("*** START OF THE PROJECT GUTENBERG EBOOK", 1)[1].split("*** END OF THE PROJECT GUTENBERG EBOOK", 1)[0]
    lines = body.split("\n")
    # the contents list at the front also has "PART I." lines; the text starts at the second "PART I."
    starts = [i for i, l in enumerate(lines) if l.strip() == "PART I."]
    lines = lines[starts[1]:]
    chapters, part, sec, buf = {}, 0, 0, []

    def flush():
        if part and sec:
            paras, cur, in_note = [], [], False
            for l in buf + [""]:
                s = l.strip()
                if not s:
                    if cur and not in_note:
                        paras.append(" ".join(cur))
                    cur, in_note = [], False
                    continue
                if not cur and re.match(r"^\[\d+\]", s):
                    in_note = True   # a footnote paragraph
                cur.append(s)
            paras = [re.sub(r"\s+", " ", re.sub(r"\[\d+\]", "", p)).strip() for p in paras]
            paras = [p for p in paras if p and not re.fullmatch(r"THE END OF PART [IVX]+\.?", p)]
            chapters[(part, sec)] = paras

    for l in lines:
        s = l.strip()
        m = re.fullmatch(r"PART ([IVX]+)[.:]", s)
        if m:
            flush(); buf = []
            part, sec = roman(m.group(1)), 0
            continue
        m = re.fullmatch(r"SECTION ([IVXLC]+)\.?", s)
        if m:
            flush(); buf = []
            sec = roman(m.group(1))
            continue
        buf.append(l)
    flush()
    return chapters


def main():
    ch = parse()
    folder = os.path.join(ROOT, "data", "vishnu-purana")
    toc = json.load(open(os.path.join(folder, "index.json"), encoding="utf-8"))
    done, missing = 0, []
    # the Gutenberg text has no "SECTION XXXVIII." heading in Part V: chapter 38 runs on inside 37
    runs_on = {(5, 37): "This passage also covers chapter 38 (the printed text has no break between them)."}
    for c in toc["chapters"]:
        part, ad = (int(x) for x in c["label"].split("."))
        path = os.path.join(folder, c["file"])
        doc = json.load(open(path, encoding="utf-8"))
        for k in ("en_chapter", "en_chapter_note", "en_chapter_ref"):
            doc.pop(k, None)
        paras = ch.get((part, ad))
        if paras:
            doc["en_chapter"] = paras
            if (part, ad) in runs_on:
                doc["en_chapter_note"] = runs_on[(part, ad)]
            done += 1
        elif (part, ad - 1) in runs_on:
            doc["en_chapter_ref"] = f"{part}.{ad - 1}"
            done += 1
        else:
            missing.append(c["label"])
        with open(path, "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
    extra = sorted(set(ch) - {tuple(int(x) for x in c["label"].split(".")) for c in toc["chapters"]})
    print(f"vishnu-purana: English for {done} of {len(toc['chapters'])} chapters; missing {missing}; unused {extra}")


if __name__ == "__main__":
    main()
