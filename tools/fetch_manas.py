"""Download the scan pages of Ramcharitmanas (Belvedere Press, Prayag, 1925, with the Hindi
commentary of Mahavir Prasad Malviya 'Veer') from hi.wikisource.org.

Writes sources/manas_pages.json: [{n, title, quality, sopan, text}] for the given page range.
`sopan` is read from each page's running header ({{rh|...|प्रथम सोपान, बालकाण्ड।|...}}).
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from wiki import pages_many, dev, ROOT

HOST = "hi.wikisource.org"
INDEX = "रामचरितमानस.pdf"
FIRST, LAST = 52, 1223


def main():
    titles = [f"पृष्ठ:{INDEX}/{dev(n)}" for n in range(FIRST, LAST + 1)]
    got = pages_many(HOST, titles)
    out = []
    for n, t in enumerate(titles, FIRST):
        p = got.get(t) or {}
        text = p.get("text")
        sopan = None
        if text:
            m = re.search(r"\{\{rh\|[^}]*?([^|{}]*सोपान[^|{}]*)\|", text)
            if m:
                sopan = m.group(1).strip()
        out.append({"n": n, "title": t, "quality": p.get("quality"), "sopan": sopan, "text": text})
    with open(os.path.join(ROOT, "sources", "manas_pages.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=0)
    # print where each sopan (kand) appears
    seen = {}
    for p in out:
        if p["sopan"]:
            k = p["sopan"].split(",")[0].split("।")[0].strip()
            seen.setdefault(k, [p["n"], p["n"]])[1] = p["n"]
    for k, (a, b) in seen.items():
        print(f"{k}: pages {a}-{b}")
    from collections import Counter
    print(Counter(p["quality"] for p in out))


if __name__ == "__main__":
    main()
