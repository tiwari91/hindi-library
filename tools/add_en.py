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


def same_line(a, b, speaker=None):
    """Compare first lines after the shared clean-up (tools/cleanup.py), so English written
    before a clean-up still finds its verse. A first line that was only a speaker ("श्रीभगवानुवाच")
    is now the verse's speaker label, so it matches that."""
    from cleanup import clean_line, SPEAKER_LINE
    a, b = a.strip(), b.strip()
    m = SPEAKER_LINE.match(a)
    if m and speaker and m.group(1).strip() == speaker.strip():
        return True
    return a == b or clean_line(a, True) == clean_line(b, True) or clean_line(a, False) == clean_line(b, False)


def merge(book):
    rows = []
    for f in sorted(glob.glob(os.path.join(ROOT, "sources", "en", book, "*.json"))):
        if os.path.basename(f).startswith("_"):
            continue  # _summaries.json is merged by merge_summaries
        rows += json.load(open(f, encoding="utf-8"))
    if not rows:
        # without a sources/en/<book> folder there is nothing to merge; never wipe a book's English
        print(f"{book}: no English in sources/en/{book}; nothing changed")
        return False
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
            it.pop("en", None)
            sp = it.get("speaker")
            r = want.get((str(c["n"]), it["id"]))
            if not r or not same_line(r["first"], first_line(it), sp):
                # the verse moved (ids are positions): find its English by its first line in this chapter
                r = next((x for k, x in want.items() if k[0] == str(c["n"]) and same_line(x["first"], first_line(it))), None)
            if not r:
                bad.append((c["n"], it["id"]))
                continue
            want.pop((str(r["n"]), r["id"]), None)
            if not r["en"].strip():
                continue
            it["en"] = r["en"].strip()
            added += 1
        with open(path, "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{book}: English on {added} of {verses} verses; mismatched {len(bad)} {bad[:5]}; unused {len(want)} {list(want)[:5]}")
    return not bad and not want


def merge_summaries(book):
    """Copy sources/en/<book>/_summaries.json ({"<chapter file>": {"n": .., "summary": ".."}}) into
    each chapter file as "en_summary"."""
    path = os.path.join(ROOT, "sources", "en", book, "_summaries.json")
    if not os.path.exists(path):
        return True
    sums = json.load(open(path, encoding="utf-8"))
    toc = json.load(open(os.path.join(ROOT, "data", book, "index.json"), encoding="utf-8"))
    files = {c["file"]: c for c in toc["chapters"]}
    bad = [k for k, v in sums.items() if k not in files or str(files[k]["n"]) != str(v["n"])]
    done = 0
    for f, c in files.items():
        fp = os.path.join(ROOT, "data", book, f)
        doc = json.load(open(fp, encoding="utf-8"))
        doc.pop("en_summary", None)
        if f in sums and f not in bad and sums[f]["summary"].strip():
            doc["en_summary"] = sums[f]["summary"].strip()
            done += 1
        with open(fp, "w", encoding="utf-8") as fh:
            json.dump(doc, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"{book}: summaries on {done} of {len(files)} chapters; bad entries {bad[:5]}")
    return not bad


def has_verse_english(book):
    return any(not os.path.basename(f).startswith("_") for f in glob.glob(os.path.join(ROOT, "sources", "en", book, "*.json")))


if __name__ == "__main__":
    ok = all([(merge(b) if has_verse_english(b) else True) & merge_summaries(b) for b in sys.argv[1:]])
    sys.exit(0 if ok else 1)
