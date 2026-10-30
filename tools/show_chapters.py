"""Print chapters of a book as plain text, for reading before writing summaries.

Usage: python3 tools/show_chapters.py <book> <from n> <to n>
Prints the chapter file, number and title, then each heading, verse (Devanagari only,
with its speaker) or prose paragraph on one line.
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
book, lo, hi = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
d = os.path.join(ROOT, "data", book)
for c in json.load(open(os.path.join(d, "index.json"), encoding="utf-8"))["chapters"]:
    if not lo <= c["n"] <= hi:
        continue
    doc = json.load(open(os.path.join(d, c["file"]), encoding="utf-8"))
    print(f"=== {c['n']} {c['file']} {c['title']}")
    for it in doc["items"]:
        if it.get("h"):
            print("#", it["h"])
        else:
            t = it.get("text") or it.get("p") or it.get("poem")
            if t:
                print((it.get("speaker") + ": " if it.get("speaker") else "") + t.replace("\n", " "))
