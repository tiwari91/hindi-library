"""Fetch the Sanskrit Bhagavad Gita from sa.wikisource.org (CC BY-SA 4.0).

Writes sources/gita_sa.json: {chapter: [{"v": n, "speaker": str|None, "sa": "line\nline"}]}
Only the verse text inside <poem> blocks is used; the commentaries on the same pages are skipped.
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from wiki import wikitext, ROOT

HOST = "sa.wikisource.org"
CHAPTERS = [
    "अर्जुनविषादयोगः", "साङ्ख्ययोगः", "कर्मयोगः", "ज्ञानकर्मसंन्यासयोगः", "कर्मसंन्यासयोगः",
    "आत्मसंयमयोगः", "ज्ञानविज्ञानयोगः", "अक्षरब्रह्मयोगः", "राजविद्याराजगुह्ययोगः", "विभूतियोगः",
    "विश्वरूपदर्शनयोगः", "भक्तियोगः", "क्षेत्रक्षेत्रज्ञविभागयोगः", "गुणत्रयविभागयोगः", "पुरुषोत्तमयोगः",
    "दैवासुरसंपद्विभागयोगः", "श्रद्धात्रयविभागयोगः", "मोक्षसंन्यासयोगः",
]
EXPECTED = [47, 72, 43, 42, 29, 47, 30, 28, 34, 42, 55, 20, 35, 27, 20, 24, 28, 78]
DIG = str.maketrans("०१२३४५६७८९", "0123456789")
END = re.compile(r"॥\s*([0-9०-९]+)\s*[-–.]\s*([0-9०-९]+)\s*॥")
SPEAKER = re.compile(r"^'''\s*(.+?वाच)\s*'''$")


def parse(ch, text):
    verses, buf, speaker = [], [], None
    for block in re.findall(r"<poem>(.*?)</poem>", text, flags=re.S):
        for raw in block.split("\n"):
            line = raw.strip()
            if not line:
                continue
            m = SPEAKER.match(line)
            if m:
                speaker = m.group(1).strip()
                buf = []
                continue
            if line.startswith("'''") or "ॐ तत्सदिति" in line or line in ("ॐ", "श्रीपरमात्मने नमः", "अथ श्रीमद्भगवद्गीता"):
                buf = []
                continue
            e = END.search(line)
            buf.append(END.sub("", line).strip())
            if e:
                c, v = int(e.group(1).translate(DIG)), int(e.group(2).translate(DIG))
                if c != ch:
                    print(f"warn: chapter {ch} has marker {c}-{v}", file=sys.stderr)
                last = buf[-1].rstrip(" ।")
                buf[-1] = last + f" ॥{str(v).translate(str.maketrans('0123456789', '०१२३४५६७८९'))}॥"
                verses.append({"v": v, "speaker": speaker, "sa": "\n".join(buf)})
                buf, speaker = [], None
            elif "ॐ तत्सदिति" in line:
                buf = []
    return verses


def main():
    out = {}
    for i, name in enumerate(CHAPTERS, 1):
        title = f"भगवद्गीता/{name}"
        t = wikitext(HOST, title)
        if t is None:
            print(f"FAILED to fetch {title}", file=sys.stderr)
            continue
        vs = parse(i, t)
        nums = [x["v"] for x in vs]
        missing = sorted(set(range(1, max(nums) + 1)) - set(nums))
        dup = sorted({n for n in nums if nums.count(n) > 1})
        print(f"ch {i:2}: {len(vs)} verses (expected {EXPECTED[i-1]}) missing={missing} dup={dup}")
        out[i] = {"title": title, "verses": vs}
    with open(os.path.join(ROOT, "sources", "gita_sa.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
