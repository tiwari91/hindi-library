"""Put a public-domain English translation into a book's data files.

Input: a JSON file {"<verse id>": {"en": "...", "verses": [first, last]}} made by a fetch script
(for example tools/fetch_besant.py). The English goes on the verse with that id; when a translator
renders several verses together, the earlier verses get "en_ref" (pointing to the last one) so the
reader shows "The English meaning is given with verse N". Any earlier English on the book (such as
the machine-written meanings) is replaced. Nothing is reworded.
Usage: python3 tools/add_en_pd.py <book> <file.json>
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main(book, src):
    rows = json.load(open(src, encoding="utf-8"))
    folder = os.path.join(ROOT, "data", book)
    toc = json.load(open(os.path.join(folder, "index.json"), encoding="utf-8"))
    used, verses, ref = set(), 0, {}
    # verses covered by a group point to the group's last verse
    for key, r in rows.items():
        a, b = r["verses"]
        prefix = key.rsplit(".", 1)[0] + "." if "." in key else ""
        for v in range(a, b):
            ref[prefix + str(v)] = str(b)
    for c in toc["chapters"]:
        path = os.path.join(folder, c["file"])
        doc = json.load(open(path, encoding="utf-8"))
        for it in doc["items"]:
            if "text" not in it:
                continue
            verses += 1
            it.pop("en", None)
            it.pop("en_ref", None)
            r = rows.get(it["id"])
            if r:
                it["en"] = r["en"]
                used.add(it["id"])
            elif it["id"] in ref:
                it["en_ref"] = ref[it["id"]]
        with open(path, "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
    unused = [k for k in rows if k not in used]
    print(f"{book}: English on {len(used)} of {verses} verses; {len(ref)} verses point to a group; unused rows {unused[:10]}")
    return not unused


if __name__ == "__main__":
    sys.exit(0 if main(sys.argv[1], sys.argv[2]) else 1)
