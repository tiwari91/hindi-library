"""Add K. Narayanasvami Aiyar's English translation (1914) to the Garbha Upanishad.

Source: "Thirty Minor Upanishads", Madras 1914, no. 16, as transcribed at sacred-texts.com
(hin/tmu/tmu18.htm), saved in sources/en-pd/raw/tmu18-garbha.htm. Aiyar died in 1918, so it is
public domain. His translation follows a longer version of the Upanishad than the Wikisource
text here, so it cannot sit under single sections: it goes in as one passage for the chapter
("en_chapter", the "English" box), with a note saying so. Page numbers and footnote marks are
left out. Run after tools/build_upanishad.py: python3 tools/add_garbha_aiyar.py
"""
import html, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "sources", "en-pd", "raw", "tmu18-garbha.htm")
NOTE = ("Aiyar translated a longer version of the Garbha Upanishad than the Sanskrit shown here, "
        "so his English has passages that are not in this text. The English under each section "
        "is a machine translation of this exact Sanskrit.")


def paragraphs():
    s = open(RAW, encoding="utf-8").read()
    # the text sits between the "tr. by K. Narayanasvami Aiyar" banner and the footnotes
    banner = "at sacred-texts.com</FONT></P><HR></p>"
    if banner not in s:
        raise SystemExit(f"{RAW}: the sacred-texts banner was not found; the saved page's layout has changed")
    body = s.split(banner, 1)[1].split("<HR>", 1)[0]
    out = []
    for p in re.findall(r"<p>(.*?)</p>", body, flags=re.S | re.I):
        if re.search(r'name="page_\d+"', p, flags=re.I):
            continue                                     # printed page number
        cont = "paragraph continues" in p
        p = re.sub(r'<A NAME="fr_\d+"></A><A HREF="#fn_\d+"><FONT SIZE="1">\d+</FONT></A>', "", p, flags=re.I)
        p = re.sub(r'<span class="contnote">.*?</span>', "", p, flags=re.S | re.I)
        p = html.unescape(re.sub(r"<[^>]+>", "", p)).replace("\xa0", " ")
        p = re.sub(r"\s+", " ", p).strip()
        p = re.sub(r" +([.,;:)\"”])", r"\1", p)              # the space left where a footnote mark was
        if not p or p.startswith("Thirty Minor Upanishads, tr."):
            continue
        if re.fullmatch(r"GARBHA-UPANISHA.*", p):
            continue                                     # the printed title
        # a paragraph broken by a page turn goes on in lower case, or is marked "[paragraph continues]"
        if out and (cont or p[0].islower() or p[0] == "("):
            out[-1] += " " + p
        else:
            out.append(p)
    return out


def main():
    path = os.path.join(ROOT, "data", "garbha-upanishad", "01.json")
    doc = json.load(open(path, encoding="utf-8"))
    doc["en_chapter"] = paragraphs()
    doc["en_chapter_note"] = NOTE
    json.dump(doc, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("garbha-upanishad: Aiyar's English,", len(doc["en_chapter"]), "paragraphs")


if __name__ == "__main__":
    main()
