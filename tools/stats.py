"""Count chapters, verses and words for every book and write data/stats.json.

The home page uses this for the "18 chapters · 700 verses · about 6 hours" line on each card,
so it does not have to download every book's contents to show the counts.
Run after adding or rebuilding a book: python3 tools/stats.py
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")


def main():
    lib = json.load(open(os.path.join(DATA, "library.json"), encoding="utf-8"))
    out = {}
    for b in lib["books"]:
        if b.get("link"):
            continue
        folder = os.path.join(DATA, b.get("data") or b["id"])
        idx = os.path.join(folder, "index.json")
        if not os.path.exists(idx):
            continue
        toc = json.load(open(idx, encoding="utf-8"))
        verses = words = 0
        with_en = 0
        for c in toc["chapters"]:
            doc = json.load(open(os.path.join(folder, c["file"]), encoding="utf-8"))
            for it in doc["items"]:
                main = it.get("text") or it.get("p") or it.get("poem")
                if not main:
                    continue
                if it.get("text"):
                    verses += 1
                if it.get("en"):
                    with_en += 1
                words += len(main.split())
        # reading time: about 3 verses a minute with their meaning, or 150 words a minute for prose
        minutes = round(words / 150) if b.get("kind") == "prose" else round(verses / 3)
        out[b["id"]] = {"chapters": len(toc["chapters"]), "verses": verses, "words": words,
                        "with_en": with_en, "minutes": max(1, minutes)}
    with open(os.path.join(DATA, "stats.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1)
    print(len(out), "books")


if __name__ == "__main__":
    main()
