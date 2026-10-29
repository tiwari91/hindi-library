"""Download the scan pages of Gandhi's अनासक्तियोग (Hindi, Sasta Sahitya Mandal, 6th ed. 1949)
from hi.wikisource.org and save them, in order, to sources/anasakti_pages.json.

The pages are unproofread OCR (proofread level 1). They are stored exactly as Wikisource has them.
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from wiki import wikitext, page_quality, dev, ROOT

HOST = "hi.wikisource.org"
INDEX = "अनासक्तियोग.djvu"
FIRST, LAST = 1, 244


def main():
    titles = [f"पृष्ठ:{INDEX}/{dev(n)}" for n in range(FIRST, LAST + 1)]
    q = page_quality(HOST, titles)
    pages = []
    for n, t in enumerate(titles, FIRST):
        body = wikitext(HOST, t)
        if body is None:
            continue
        body = re.sub(r"<noinclude>.*?</noinclude>", "", body, flags=re.S)
        pages.append({"n": n, "title": t, "quality": q.get(t), "text": body})
    with open(os.path.join(ROOT, "sources", "anasakti_pages.json"), "w", encoding="utf-8") as f:
        json.dump(pages, f, ensure_ascii=False, indent=1)
    print(len(pages), "pages")


if __name__ == "__main__":
    main()
