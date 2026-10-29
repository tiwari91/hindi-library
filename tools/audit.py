"""Count verse-text problems in every book, so a clean-up can be checked before and after.

  dup_n     verses whose shown number repeats an earlier one in the same chapter (not counting an
            opening invocation already marked "pre")
  footnote  verses with a number inside a line that is not the verse number (footnote marks)
  danda     verses with "। ।" or "।।" (should be "॥")
  marker    verses whose end number is not written "॥ N ॥" (e.g. "॥ १.१.१० ॥", "। ७४", "॥४७॥")
  speaker   verses whose first line is only "X उवाच" (should be the speaker label)
Usage: python3 tools/audit.py [--json out.json]
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from cleanup import END_MARK, MID_MARK, SPEAKER_LINE, to_ascii

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NUM = r"[०-९0-9]+"
GOOD_END = re.compile(r" ॥ " + NUM + r" ॥$")


def audit_book(b):
    folder = os.path.join(ROOT, "data", b.get("data") or b["id"])
    idx = os.path.join(folder, "index.json")
    if not os.path.exists(idx):
        return None
    toc = json.load(open(idx, encoding="utf-8"))
    c = {"verses": 0, "dup_n": 0, "footnote": 0, "danda": 0, "marker": 0, "speaker": 0, "position_chapters": 0}
    examples = {k: [] for k in c}
    for ch in toc["chapters"]:
        doc = json.load(open(os.path.join(folder, ch["file"]), encoding="utf-8"))
        seen = set()
        by_position = doc.get("numbering") == "position"   # shown by position; repeats are expected
        if by_position:
            c["position_chapters"] = c.get("position_chapters", 0) + 1
        for it in doc["items"]:
            t = it.get("text")
            if not t:
                continue
            c["verses"] += 1
            lines = t.split("\n")
            n = it.get("n")
            if n and not it.get("pre") and not by_position:
                if n in seen:
                    c["dup_n"] += 1; examples["dup_n"].append(it["id"])
                seen.add(n)
            # numbers left after taking away end markers and in-line verse markers
            # ("दो०-", "चौ०-" are the Manas abbreviations for doha and chaupai, not numbers)
            rest = [re.sub(r"^(दो|चौ|सो|छं)[०॰o°]", "", MID_MARK.sub("", END_MARK.sub("", l))) for l in lines]
            if any(re.search(NUM, r) for r in rest):
                c["footnote"] += 1; examples["footnote"].append(it["id"])
            if "।।" in t or re.search(r"।\s+।", t):
                c["danda"] += 1; examples["danda"].append(it["id"])
            last = lines[-1]
            if re.search(NUM + r"\s*[।॥|]*\s*$", last) and not GOOD_END.search(last):
                c["marker"] += 1; examples["marker"].append(it["id"])
            if len(lines) > 1 and SPEAKER_LINE.match(lines[0]):
                c["speaker"] += 1; examples["speaker"].append(it["id"])
    return c, {k: v[:5] for k, v in examples.items() if v}


def main():
    lib = json.load(open(os.path.join(ROOT, "data", "library.json"), encoding="utf-8"))
    out = {}
    for b in lib["books"]:
        if b.get("link") or b.get("kind") == "prose":
            continue
        r = audit_book(b)
        if not r:
            continue
        out[b["id"]] = r[0]
        print(f"{b['id']:24} " + " ".join(f"{k}={v}" for k, v in r[0].items()), r[1] if any(r[0][k] for k in r[0] if k != "verses") else "")
    if "--json" in sys.argv:
        json.dump(out, open(sys.argv[sys.argv.index("--json") + 1], "w"), indent=1)


if __name__ == "__main__":
    main()
