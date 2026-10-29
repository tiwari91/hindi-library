"""Build a Purana (Sanskrit) from Sanskrit Wikisource chapter pages "<base>/<part>/अध्यायः N".

Words are used as on Wikisource; verses are split at their numbers (see build_stotras.verses),
speaker lines become speakers, the closing "इति ..." line becomes a heading, and a Roman
transliteration is added by tools/iast.py.
Usage: python3 tools/build_purana.py <book id>
"""
import json, os, re, sys, urllib.parse
sys.path.insert(0, os.path.dirname(__file__))
from wiki import api, wikitext, ROOT
from build_stotras import verses, clean_wiki

HOST = "sa.wikisource.org"
DEV = "०१२३४५६७८९"
dev = lambda n: "".join(DEV[int(c)] for c in str(n))
undev = lambda s: int("".join(str(DEV.index(c)) if c in DEV else c for c in s))

PURANAS = {
    "vishnu-purana": {
        "base": "विष्णुपुराणम्",
        "parts": ["प्रथमांशः", "द्वितीयांशः", "तृतीयांशः", "चतुर्थांशः", "पञ्चमांशः", "षष्टांशः"],
        "unit": "अंश", "unit_en": "Amsha",
    },
    "garuda-purana": {
        "base": "गरुडपुराणम्",
        "parts": ["आचारकाण्डः", "प्रेतकाण्डः (धर्मकाण्डः)", "ब्रह्मकाण्डः (मोक्षकाण्डः)"],
        "unit": "काण्ड", "unit_en": "Kanda",
    },
    "shiva-purana": {
        "base": "शिवपुराणम्",
        "parts": ["संहिता १ (विश्वेश्वरसंहिता)",
                  "संहिता २ (रुद्रसंहिता)/खण्डः १ (सृष्टिखण्डः)", "संहिता २ (रुद्रसंहिता)/खण्डः २ (सतीखण्डः)",
                  "संहिता २ (रुद्रसंहिता)/खण्डः ३ (पार्वतीखण्डः)", "संहिता २ (रुद्रसंहिता)/खण्डः ४ (कुमारखण्डः)",
                  "संहिता २ (रुद्रसंहिता)/खण्डः ५ (युद्धखण्डः)",
                  "संहिता ३ (शतरुद्रसंहिता)", "संहिता ४ (कोटिरुद्रसंहिता)", "संहिता ५ (उमासंहिता)", "संहिता ६ (कैलाससंहिता)",
                  "संहिता ७ (वायवीयसंहिता)/पूर्व भागः", "संहिता ७ (वायवीयसंहिता)/उत्तर भागः"],
        "labels": ["विद्येश्वरसंहिता · Vidyeshvara Samhita",
                   "रुद्रसंहिता, सृष्टिखण्ड · Rudra Samhita, Srishti", "रुद्रसंहिता, सतीखण्ड · Rudra Samhita, Sati",
                   "रुद्रसंहिता, पार्वतीखण्ड · Rudra Samhita, Parvati", "रुद्रसंहिता, कुमारखण्ड · Rudra Samhita, Kumara",
                   "रुद्रसंहिता, युद्धखण्ड · Rudra Samhita, Yuddha",
                   "शतरुद्रसंहिता · Shatarudra Samhita", "कोटिरुद्रसंहिता · Kotirudra Samhita", "उमासंहिता · Uma Samhita",
                   "कैलाससंहिता · Kailasa Samhita", "वायवीयसंहिता, पूर्वभाग · Vayaviya Samhita, first part",
                   "वायवीयसंहिता, उत्तरभाग · Vayaviya Samhita, second part"],
        "unit": "", "unit_en": "",
    },
}


def subpages(base):
    ts, cont = [], {}
    while True:
        d = api(HOST, action="query", list="allpages", apprefix=base + "/", aplimit=500, **cont)
        ts += [x["title"] for x in d["query"]["allpages"]]
        if "continue" not in d:
            return ts
        cont = {"apcontinue": d["continue"]["apcontinue"]}


def chapter_items(title, cn):
    w = wikitext(HOST, title) or ""
    poems = re.findall(r"<poem>(.*?)</poem>", w, flags=re.S)
    # some pages have only an empty decorative <poem> and the verses outside it
    if poems and len(re.sub(r"<[^>]+>|\s", "", "".join(poems))) < 40:
        poems = []
    body = "\n".join(poems) if poems else re.sub(r"\{\{.*?\}\}|\[\[वर्गः:[^\]]*\]\]", "", w, flags=re.S)
    lines, colophon = [], []
    for l in clean_wiki(body):
        l = l.strip()
        if colophon or re.match(r"इति\s?श्री", l):
            colophon.append(l)
            continue
        s = re.sub(r"\s*[।|]+\s*$", "", l)
        if re.search(r"(उवाच|ऊचुः|ऊचतुः)$", s) and len(s) < 45:
            l = s + " —"
        lines.append(l)
    items = verses(lines, cn, numbered=True)
    if colophon:
        items.append({"id": f"{cn}.end", "h": " ".join(x for x in colophon if x)})
    return items


def main(bid):
    cfg = PURANAS[bid]
    base = cfg["base"]
    rx = re.compile(r"^" + re.escape(base) + r"/(.+)/अध्याया?ः\s*([०-९0-9]+)$")
    found = {}
    for t in subpages(base):
        m = rx.match(t)
        if m and m.group(1) in cfg["parts"]:
            key = (cfg["parts"].index(m.group(1)) + 1, undev(m.group(2)))
            # the same chapter can exist twice ("अध्यायः" and "अध्यायाः"); keep the longer page
            if key not in found or len(wikitext(HOST, t) or "") > len(wikitext(HOST, found[key]) or ""):
                found[key] = t
    chs = sorted((pt, ad, t) for (pt, ad), t in found.items())
    out = os.path.join(ROOT, "data", bid)
    os.makedirs(out, exist_ok=True)
    for f in os.listdir(out):
        os.remove(os.path.join(out, f))
    toc, report = [], {}
    for k, (pt, ad, t) in enumerate(chs, 1):
        items = chapter_items(t, k)
        nv = sum(1 for x in items if "text" in x)
        bad = sum(1 for x in items if "text" in x and "n" not in x)
        r = report.setdefault(pt, [0, 0, 0])
        r[0] += 1; r[1] += nv; r[2] += bad
        fname = f"{pt:02}-{ad:03}.json"
        src = "https://sa.wikisource.org/wiki/" + urllib.parse.quote(t.replace(" ", "_"))
        labels = cfg.get("labels")
        group = labels[pt - 1] if labels else f"{cfg['unit']} {dev(pt)} · {cfg['unit_en']} {pt}"
        title = (labels[pt - 1].split(" · ")[0] if labels else f"{cfg['unit']} {dev(pt)}") + f" · अध्याय {dev(ad)}"
        json.dump({"book": bid, "n": k, "title": title, "src": src, "items": items},
                  open(os.path.join(out, fname), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        first = next((x["text"].split("\n")[0] for x in items if "text" in x), "")
        toc.append({"n": k, "file": fname, "label": f"{pt}.{ad}", "group": group,
                    "title": title, "first": first[:60], "count": nv})
    json.dump({"book": bid, "chapters": toc}, open(os.path.join(out, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for pt, (c, v, bad) in sorted(report.items()):
        print(f"{bid} part {pt}: {c} chapters, {v} verses, {bad} without a number")


if __name__ == "__main__":
    main(sys.argv[1])
