"""Mark a book in data/library.json as having machine-written English chapter summaries.

Adds "en_summaries": true and an "en_note" (shown in English mode) to the book's entry, as text,
so the hand-formatted library.json is not rewritten. Safe to run more than once.
Usage: python3 tools/mark_summaries.py <book> [<book> ...]
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, "data", "library.json")
NOTE = ("Each chapter has a short English summary, written by an AI model (Claude) from the Sanskrit and "
        "not proofread. The verses themselves are shown in Roman transliteration; a free English translation "
        "that lines up with this text is not available.")

for book in sys.argv[1:]:
    s = open(P, encoding="utf-8").read()
    entry = next(b for b in json.loads(s)["books"] if b["id"] == book)
    if entry.get("en_summaries"):
        print(book, "already marked")
        continue
    start = s.index(f'"id": "{book}"')
    at = s.index('"sources":', start)
    add = '"en_summaries": true,\n   '
    if not entry.get("en_note"):
        add += '"en_note": ' + json.dumps(NOTE) + ',\n   '
    s = s[:at] + add + s[at:]
    json.loads(s)
    open(P, "w", encoding="utf-8").write(s)
    print(book, "marked")
