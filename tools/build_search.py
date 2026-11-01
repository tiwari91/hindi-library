"""Build the search index: one small file per book, data/search/<book>.json.

The site's search (assets/features.js) used to download every chapter of every book to search them, so
the Puranas (thousands of chapters) were left out. This builds, once, the same "folded" spelling the site
matches against (Devanagari and Roman both brought down to plain letters, so krishna, krsna and कृष्ण meet),
plus the English meaning, for every verse of every book. The site then fetches one compact file per book.

    python3 tools/build_search.py

fold() and roman() here must stay the same as in assets/features.js.
Each file: {"v": 1, "rows": [[chapter n, verse id, folded text, english], ...]}.
"""
import json
import os
import re
import unicodedata

ROOT = os.path.join(os.path.dirname(__file__), "..")
V = {"अ": "a", "आ": "a", "इ": "i", "ई": "i", "उ": "u", "ऊ": "u", "ऋ": "r", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au"}
M = {"ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u", "ृ": "r", "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॉ": "o"}
C = {"क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n", "च": "c", "छ": "ch", "ज": "j", "झ": "jh", "ञ": "n", "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
     "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n", "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m", "य": "y", "र": "r", "ल": "l", "ळ": "l", "व": "v", "श": "s", "ष": "s", "स": "s", "ह": "h"}


def roman(s):
    a = list(unicodedata.normalize("NFC", s).replace("़", ""))
    out = []
    for i, ch in enumerate(a):
        nx = a[i + 1] if i + 1 < len(a) else None
        if ch in C:
            out.append(C[ch] + ("" if (nx in M or nx == "्") else "a"))
        elif ch in M:
            out.append(M[ch])
        elif ch in V:
            out.append(V[ch])
        elif ch in ("ं", "ँ"):
            out.append("n")
        elif ch in ("ः", "्", "ऽ"):
            pass
        else:
            out.append(ch)
    return "".join(out)


def fold(s):
    t = unicodedata.normalize("NFD", roman(str(s)))
    t = re.sub("[̀-ͯ]", "", t).lower()
    t = re.sub(r"[^a-z0-9\s]", " ", t)
    for a, b in (("ksh", "ks"), ("sh", "s"), ("ch", "c"), ("w", "v"), ("ph", "f"), ("ee", "i"), ("oo", "u")):
        t = t.replace(a, b)
    t = re.sub(r"(.)\1", r"\1", t)
    t = t.replace("ri", "r").replace("a", "")
    t = re.sub(r"m(?=\s|$)", "n", t)
    t = re.sub(r"\s+", " ", t)
    return " " + t + " "


def en_text(s):
    return " " + re.sub(r"[^a-z0-9\s]", " ", s.lower()) if s else ""


def main():
    lib = json.load(open(os.path.join(ROOT, "data", "library.json"), encoding="utf-8"))
    os.makedirs(os.path.join(ROOT, "data", "search"), exist_ok=True)
    total = 0
    for b in lib["books"]:
        if b.get("link") or b.get("hidden"):
            continue
        d = os.path.join(ROOT, "data", b.get("data") or b["id"])
        toc = json.load(open(os.path.join(d, "index.json"), encoding="utf-8"))
        rows = []
        for c in toc["chapters"]:
            n = c["n"]
            f = os.path.join(d, c.get("file") or "")
            if not c.get("file") or not os.path.exists(f):
                continue
            doc = json.load(open(f, encoding="utf-8"))
            for it in doc.get("items", []):
                main_t = it.get("text") or it.get("p") or it.get("poem")
                if not main_t:
                    continue
                allt = " \n ".join(x for x in (main_t, it.get("hi"), it.get("en"), it.get("note")) if x)
                rows.append([n, it.get("id"), fold(allt + " " + (it.get("tr") or "")).strip(), en_text(it.get("en")).strip()])
        out = os.path.join(ROOT, "data", "search", b["id"] + ".json")
        with open(out, "w", encoding="utf-8") as fh:
            json.dump({"v": 1, "rows": rows}, fh, ensure_ascii=False, separators=(",", ":"))
        size = os.path.getsize(out)
        total += size
        print("%-24s %6d verses %8.1f KB" % (b["id"], len(rows), size / 1024))
    print("total %.1f MB" % (total / 1e6))


if __name__ == "__main__":
    main()
