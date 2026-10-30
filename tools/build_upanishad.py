"""Build the Garbha Upanishad from Sanskrit Wikisource.

  garbha-upanishad  <- sa.wikisource "गर्भोपनिषद्" (typed page: an opening verse, the peace chant,
                       five prose sections, the peace chant again and the closing line)

The words are used exactly as on Wikisource; tools/build_stotras.py splits them into verses and
adds the Roman transliteration. Run: python3 tools/build_upanishad.py
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from wiki import wikitext, ROOT
from iast import iast
from build_stotras import HOST, clean_wiki, verses, write_book, url


def garbha():
    title = "गर्भोपनिषद्"
    w = wikitext(HOST, title)
    w = w.split("== अधिकाध्ययनाय ==")[0]          # "further reading" links, not part of the text
    w = re.sub(r"\{\{[^}]*\}\}|\[\[[^\]]*\]\]", "", w)
    w = re.sub(r"^:+", "", w, flags=re.M)          # wiki indentation
    w = w.replace("||", "॥")
    lines = clean_wiki(w)
    lines = [l for l in lines if l.strip() != "॥ गर्भोपनिषत् ॥"]   # the title, shown as the chapter name
    items = verses(lines, 1)
    # "ॐ शान्तिः शान्तिः शान्तिः" closes the peace chant above it
    out = []
    for it in items:
        if out and it.get("text", "").startswith("ॐ शान्तिः"):
            out[-1]["text"] += "\n" + it["text"]
            out[-1]["tr"] += "\n" + it["tr"]
        else:
            out.append(it)
    # the source numbers sections 1-4 only; label every item so none shows a bare "#"
    sec = 0
    for k, it in enumerate(out, 1):
        it["id"] = f"1.{k}"
        if "text" not in it:
            continue
        if it["text"].startswith("ॐ सहनाववतु"):
            it["label"], it["label_en"] = "शान्तिपाठ", "Peace chant"
        elif k == 1:
            it["label"], it["label_en"] = "मङ्गलाचरण", "Invocation"
        else:
            sec += 1
            it["label"], it["label_en"] = "खण्ड " + "०१२३४५६७८९"[sec], f"Section {sec}"
        # the prose sections are one long line on Wikisource: one sentence per line reads better
        it["text"] = re.sub(r"\s*।\s+(?=\S)", " ।\n", it["text"])
        it["tr"] = "\n".join(iast(l) for l in it["text"].split("\n"))
    items = out
    write_book("garbha-upanishad", [("पूर्ण पाठ", items)], url(title))
    # the one chapter is the whole text; give it an English name for English mode
    p = os.path.join(ROOT, "data", "garbha-upanishad", "index.json")
    toc = json.load(open(p, encoding="utf-8"))
    toc["chapters"][0]["title_en"] = "Full text"
    json.dump(toc, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    garbha()
