"""Import the Parashara Smriti from a clone of github.com/tiwari91/parashara-smriti.

Usage: python3 tools/import_parashara.py <path to parashara-smriti clone>
Reads data/sa.json (Sanskrit, from sa.wikisource, CC BY-SA 4.0) and data/translations/out_*.json
(the English meanings written for that reader) and writes data/parashara/index.json and NN.json.
The Roman transliteration is made with that repo's own tools/iast.py, so it matches its reader.
"""
import json, os, re, sys, importlib.util

src = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("ps_iast", os.path.join(src, "tools", "iast.py"))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
iast = mod.iast

CH = ["", "प्रथमोऽध्यायः", "द्वितीयोऽध्यायः", "तृतीयोऽध्यायः", "चतुर्थोऽध्यायः", "पञ्चमोऽध्यायः", "षष्ठोऽध्यायः",
      "सप्तमोऽध्यायः", "अष्टमोऽध्यायः", "नवमोऽध्यायः", "दशमोऽध्यायः", "एकादशोऽध्यायः", "द्वादशोऽध्यायः"]
DEV = "०१२३४५६७८९"
dev = lambda s: re.sub(r"\d", lambda m: DEV[int(m.group())], str(s))

sa = json.load(open(os.path.join(src, "data", "sa.json"), encoding="utf-8"))
tr = {}
for k in "abcd":
    p = os.path.join(src, "data", "translations", f"out_{k}.json")
    if os.path.exists(p):
        for r in json.load(open(p, encoding="utf-8")):
            tr[r["id"]] = r

chapters, seen = {}, set()
for o in sa:
    label = o["v"].replace("[", "").replace("]", "")
    key = f"{o['c']}.{re.split(r'[(]', label)[0]}"
    assert key not in seen, key
    seen.add(key)
    lines = [re.sub(r"\s*।\s*$", "", l).strip() for l in o["t"]]
    end = f"॥ {dev(o['c'])}.{dev(label)} ॥"
    end_tr = f"|| {o['c']}.{label} ||"
    text = "\n".join(l + (" ।" if i < len(lines) - 1 else " " + end) for i, l in enumerate(lines))
    roman = "\n".join(iast(l) + (" |" if i < len(lines) - 1 else " " + end_tr) for i, l in enumerate(lines))
    t = tr.get(o["id"], {})
    en = t.get("en", "")
    if en[:1].islower():
        en = "… " + en
    it = {"id": key, "n": dev(label), "text": text, "tr": roman}
    if en:
        it["en"] = en
    if t.get("note"):
        it["note"] = t["note"]
    chapters.setdefault(o["c"], []).append(it)

out = os.path.join(ROOT, "data", "parashara")
os.makedirs(out, exist_ok=True)
toc = []
for c in sorted(chapters):
    items = chapters[c]
    fname = f"{c:02}.json"
    doc = {"book": "parashara", "n": c, "title": f"अध्याय {dev(c)} · {CH[c]}",
           "src": "https://sa.wikisource.org/wiki/%E0%A4%AA%E0%A4%B0%E0%A4%BE%E0%A4%B6%E0%A4%B0%E0%A4%B8%E0%A5%8D%E0%A4%AE%E0%A5%83%E0%A4%A4%E0%A4%BF%E0%A4%83",
           "items": items}
    json.dump(doc, open(os.path.join(out, fname), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    toc.append({"n": c, "file": fname, "title": CH[c], "title_en": f"Chapter {c}", "count": len(items)})
json.dump({"book": "parashara", "chapters": toc}, open(os.path.join(out, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
total = sum(len(v) for v in chapters.values())
missing = sum(1 for v in chapters.values() for x in v if "en" not in x)
print(f"{total} shlokas in {len(chapters)} chapters, {missing} without English")
