"""Join the Sanskrit (sources/gita_sa.json) and Gandhi's Hindi meanings (sources/gita_hi.json)
into the site's data files: data/gita/NN.json (one per chapter)."""
import json, os, sys, urllib.parse
sys.path.insert(0, os.path.dirname(__file__))
from wiki import ROOT, dev
from iast import iast
from fetch_gita_sa import CHAPTERS

HI_PAGE = "https://hi.wikisource.org/wiki/" + urllib.parse.quote("पृष्ठ:अनासक्तियोग.djvu/")
SA_PAGE = "https://sa.wikisource.org/wiki/" + urllib.parse.quote("भगवद्गीता/")


def main():
    sa = json.load(open(os.path.join(ROOT, "sources", "gita_sa.json"), encoding="utf-8"))
    hi = json.load(open(os.path.join(ROOT, "sources", "gita_hi.json"), encoding="utf-8"))["groups"]
    outdir = os.path.join(ROOT, "data", "gita")
    os.makedirs(outdir, exist_ok=True)
    # map each verse to the group that holds its meaning
    owner = {}
    for key, g in hi.items():
        for v in g["verses"]:
            owner[(g["c"], v)] = key
    total = with_hi = 0
    toc = []
    for c in range(1, 19):
        name = CHAPTERS[c - 1]
        items = []
        for v in sa[str(c)]["verses"]:
            total += 1
            it = {"id": f"{c}.{v['v']}", "n": dev(v["v"])}
            if v["speaker"]:
                it["speaker"] = v["speaker"]
            it["text"] = v["sa"]
            it["tr"] = "\n".join(iast(l) for l in v["sa"].split("\n"))
            k = owner.get((c, v["v"]))
            if k:
                g = hi[k]
                with_hi += 1
                if g["verses"][-1] == v["v"]:
                    it["hi"] = g["hi"]
                    if len(g["verses"]) > 1:
                        it["hi_group"] = [dev(g["verses"][0]), dev(g["verses"][-1])]
                    it["hi_src"] = HI_PAGE + urllib.parse.quote(dev(g["page"]))
                else:
                    it["hi_ref"] = dev(g["verses"][-1])
            items.append(it)
        doc = {
            "book": "gita",
            "n": c,
            "title": f"अध्याय {dev(c)} · {name}",
            "title_tr": iast(name),
            "src": SA_PAGE + urllib.parse.quote(name),
            "items": items,
        }
        with open(os.path.join(outdir, f"{c:02}.json"), "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
        toc.append({"n": c, "file": f"{c:02}.json", "title": name, "title_tr": iast(name), "count": len(items)})
    with open(os.path.join(outdir, "index.json"), "w", encoding="utf-8") as f:
        json.dump({"book": "gita", "chapters": toc}, f, ensure_ascii=False, indent=1)
    print(f"wrote 18 chapters, {total} verses, {with_hi} with a Hindi meaning")


if __name__ == "__main__":
    main()
