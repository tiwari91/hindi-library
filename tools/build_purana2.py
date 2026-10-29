"""Build any Purana from Sanskrit Wikisource, part by part.

Each part is (label, prefix). Its chapters are the pages directly under the prefix. They are put
in order by the number in the title ("अध्यायः १२"); when titles are Sanskrit ordinals
("द्वादशोऽध्यायः"), the order of links on the part's contents page is used instead. When one chapter
exists on two pages, the longer page is kept. Words are used as on Wikisource.
Usage: python3 tools/build_purana2.py <book id>
"""
import json, os, re, sys, urllib.parse
sys.path.insert(0, os.path.dirname(__file__))
from wiki import api, wikitext, ROOT
from build_purana import chapter_items, HOST, dev, undev

P = "पुराणम्"
CONFIG = {
    "vamana-purana": [("वामनपुराणम्", "वामनपुराणम्/")],
    "kurma-purana": [("पूर्वभाग · Purva bhaga", "कूर्मपुराणम्-पूर्वभागः/"), ("उत्तरभाग · Uttara bhaga", "कूर्मपुराणम्-उत्तरभागः/")],
    "matsya-purana": [("मत्स्यपुराणम्", "मत्स्यपुराणम्/")],
    "linga-purana": [("पूर्वभाग · Purva bhaga", "लिङ्गपुराणम् - पूर्वभागः/"), ("उत्तरभाग · Uttara bhaga", "लिङ्गपुराणम् - उत्तरभागः/")],
    "narada-purana": [("पूर्वार्ध · Purva ardha", "नारदपुराणम्- पूर्वार्धः/"), ("उत्तरार्ध · Uttara ardha", "नारदपुराणम्- उत्तरार्धः/")],
    "agni-purana": [("अग्निपुराणम्", "अग्निपुराणम्/")],
    "brahmanda-purana": [("पूर्वभाग · Purva bhaga", "ब्रह्माण्डपुराणम्/पूर्वभागः/"), ("मध्यभाग · Madhya bhaga", "ब्रह्माण्डपुराणम्/मध्यभागः/"),
                         ("उत्तरभाग · Uttara bhaga", "ब्रह्माण्डपुराणम्/उत्तरभागः/")],
    "varaha-purana": [("वराहपुराणम्", "वराहपुराणम्/")],
    "brahma-purana": [("ब्रह्मपुराणम्", "ब्रह्मपुराणम्/")],
    "padma-purana": [("सृष्टिखण्ड · Srishti khanda", "पद्मपुराणम्/खण्डः १ (सृष्टिखण्डम्)/"),
                     ("भूमिखण्ड · Bhumi khanda", "पद्मपुराणम्/खण्डः २ (भूमिखण्डः)/"),
                     ("स्वर्गखण्ड · Svarga khanda", "पद्मपुराणम्/खण्डः ३ (स्वर्गखण्डः)/"),
                     ("ब्रह्मखण्ड · Brahma khanda", "पद्मपुराणम्/खण्डः ४ (ब्रह्मखण्डः)/"),
                     ("पातालखण्ड · Patala khanda", "पद्मपुराणम्/खण्डः ५ (पातालखण्डः)/"),
                     ("उत्तरखण्ड · Uttara khanda", "पद्मपुराणम्/खण्डः ६ (उत्तरखण्डः)/"),
                     ("क्रियाखण्ड · Kriya khanda", "पद्मपुराणम्/खण्डः ७ (क्रियाखण्डः)/")],
    "bhavishya-purana": [("ब्राह्मपर्व · Brahma parva", "भविष्यपुराणम् /पर्व १ (ब्राह्मपर्व)/"),
                         ("मध्यमपर्व १ · Madhyama parva 1", "भविष्यपुराणम् /पर्व २ (मध्यमपर्व)/भागः १/"),
                         ("मध्यमपर्व २ · Madhyama parva 2", "भविष्यपुराणम् /पर्व २ (मध्यमपर्व)/भागः २/"),
                         ("मध्यमपर्व ३ · Madhyama parva 3", "भविष्यपुराणम् /पर्व २ (मध्यमपर्व)/भागः ३/"),
                         ("प्रतिसर्गपर्व १ · Pratisarga parva 1", "भविष्यपुराणम् /पर्व ३ (प्रतिसर्गपर्व)/खण्डः १/"),
                         ("प्रतिसर्गपर्व २ · Pratisarga parva 2", "भविष्यपुराणम् /पर्व ३ (प्रतिसर्गपर्व)/खण्डः २/"),
                         ("प्रतिसर्गपर्व ३ · Pratisarga parva 3", "भविष्यपुराणम् /पर्व ३ (प्रतिसर्गपर्व)/खण्डः ३/"),
                         ("प्रतिसर्गपर्व ४ · Pratisarga parva 4", "भविष्यपुराणम् /पर्व ३ (प्रतिसर्गपर्व)/खण्डः ४/"),
                         ("उत्तरपर्व · Uttara parva", "भविष्यपुराणम् /पर्व ४ (उत्तरपर्व)/")],
    "brahmavaivarta-purana": [("ब्रह्मखण्ड · Brahma khanda", "ब्रह्मवैवर्तपुराणम्/खण्डः १ (ब्रह्मखण्डः)/"),
                              ("प्रकृतिखण्ड · Prakriti khanda", "ब्रह्मवैवर्तपुराणम्/खण्डः २ (प्रकृतिखण्डः)/"),
                              ("गणपतिखण्ड · Ganapati khanda", "ब्रह्मवैवर्तपुराणम्/खण्डः ३ (गणपतिखण्डः)/"),
                              ("श्रीकृष्णजन्मखण्ड · Krishna janma khanda", "ब्रह्मवैवर्तपुराणम्/खण्डः ४ (श्रीकृष्णजन्मखण्डः)/")],
}
NUM = re.compile(r"अध्याया?ः\s*([०-९0-9]+)\s*$")


def subpages(prefix):
    ts, cont = [], {}
    while True:
        d = api(HOST, action="query", list="allpages", apprefix=prefix, aplimit=500, **cont)
        ts += [x["title"] for x in d["query"]["allpages"]]
        if "continue" not in d:
            return ts
        cont = {"apcontinue": d["continue"]["apcontinue"]}


def part_chapters(prefix):
    pages = [t for t in subpages(prefix) if "/" not in t[len(prefix):] and "ध्याय" in t and "अनुक्रमणिका" not in t]
    numbered = {t: undev(NUM.search(t).group(1)) for t in pages if NUM.search(t)}
    if len(numbered) >= 0.8 * len(pages):
        order = sorted(numbered.items(), key=lambda x: x[1])
        rest = [t for t in pages if t not in numbered]
    else:
        idx = wikitext(HOST, prefix.rstrip("/")) or ""
        links = []
        for l in re.findall(r"\[\[([^\]|#]+)", idx):
            l = l.strip().replace("_", " ")
            if l.startswith("/"):
                l = prefix.rstrip("/") + l
            if l in pages and l not in links:
                links.append(l)
        ordinal = [t for t in links if t not in numbered]
        order = [(t, i + 1) for i, t in enumerate(ordinal)] + [(t, numbered[t]) for t in links if t in numbered]
        rest = [t for t in pages if t not in links]
    best = {}
    for t, n in order:
        if n not in best or len(wikitext(HOST, t) or "") > len(wikitext(HOST, best[n]) or ""):
            best[n] = t
    return sorted(best.items()), rest


def main(bid):
    parts = CONFIG[bid]
    out = os.path.join(ROOT, "data", bid)
    os.makedirs(out, exist_ok=True)
    for f in os.listdir(out):
        os.remove(os.path.join(out, f))
    toc, k, total = [], 0, 0
    for pt, (label, prefix) in enumerate(parts, 1):
        chs, rest = part_chapters(prefix)
        nums = [n for n, _ in chs]
        missing = [n for n in range(1, max(nums) + 1) if n not in nums] if nums else []
        print(f"{bid} part {pt} ({label}): {len(chs)} chapters; missing numbers {missing[:20]}{'…' if len(missing) > 20 else ''}; unplaced pages {len(rest)}")
        for ad, t in chs:
            k += 1
            items = chapter_items(t, k)
            nv = sum(1 for x in items if "text" in x)
            total += nv
            fname = f"{pt:02}-{ad:03}.json"
            src = "https://sa.wikisource.org/wiki/" + urllib.parse.quote(t.replace(" ", "_"))
            title = (label.split(" · ")[0] + " · " if len(parts) > 1 else "") + f"अध्याय {dev(ad)}"
            json.dump({"book": bid, "n": k, "title": title, "src": src, "items": items},
                      open(os.path.join(out, fname), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
            first = next((x["text"].split("\n")[0] for x in items if "text" in x), "")
            c = {"n": k, "file": fname, "label": f"{pt}.{ad}" if len(parts) > 1 else str(ad), "title": title, "first": first[:60], "count": nv}
            if len(parts) > 1:
                c["group"] = label
            toc.append(c)
    json.dump({"book": bid, "chapters": toc}, open(os.path.join(out, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{bid}: {len(toc)} chapters, {total} verses")


if __name__ == "__main__":
    main(sys.argv[1])
