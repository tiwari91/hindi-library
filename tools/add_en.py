"""Merge English meanings into a book's data files.

English lives in sources/en/<book>/*.json (committed), each file a list of
  {"n": <chapter n>, "id": "<verse id>", "first": "<first line of the original>", "en": "<English>"}
This script copies "en" into data/<book>/NN.json, and refuses any entry whose "first" no longer
matches the verse (so a rebuild that moves verses can never put English on the wrong verse).
Run it again after rebuilding a book.  Usage: python3 tools/add_en.py <book> [<book> ...]
"""
import glob, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def first_line(it):
    return (it.get("text") or "").split("\n")[0].strip()


def merge(book):
    rows = []
    for f in sorted(glob.glob(os.path.join(ROOT, "sources", "en", book, "*.json"))):
        rows += json.load(open(f, encoding="utf-8"))
    want = {(str(r["n"]), r["id"]): r for r in rows}
    toc = json.load(open(os.path.join(ROOT, "data", book, "index.json"), encoding="utf-8"))
    added, bad, verses = 0, [], 0
    for c in toc["chapters"]:
        path = os.path.join(ROOT, "data", book, c["file"])
        doc = json.load(open(path, encoding="utf-8"))
        for it in doc["items"]:
            if "text" not in it:
                continue
            verses += 1
            r = want.pop((str(c["n"]), it["id"]), None)
            if not r:
                continue
            if r["first"].strip() != first_line(it) or not r["en"].strip():
                bad.append((c["n"], it["id"]))
                continue
            it["en"] = r["en"].strip()
            added += 1
        with open(path, "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{book}: English on {added} of {verses} verses; mismatched {len(bad)} {bad[:5]}; unused {len(want)} {list(want)[:5]}")
    return not bad and not want


if __name__ == "__main__":
    ok = all([merge(b) for b in sys.argv[1:]])
    sys.exit(0 if ok else 1)
