"""Pull Gandhi's Hindi meaning for each Gita verse out of the OCR pages in sources/anasakti_pages.json.

How it works (no text is corrected or invented):
- Each OCR line is compared with the clean Sanskrit text (sources/gita_sa.json). Lines that closely
  match a Sanskrit verse line are treated as Sanskrit and dropped; this also tells us which verse we are at.
- The Hindi text that follows a run of Sanskrit verses is the meaning of those verses
  (Gandhi sometimes explains two or three verses together).
- Gandhi's notes (टिप्पणी), chapter colophons, running headers, page numbers and the bare
  verse-number label at the end of each meaning are removed.
- Hyphen breaks at line ends ("होने-" + "वाले") are joined; other line breaks become spaces.
Writes sources/gita_hi.json and prints a coverage report.
"""
import json, os, re, sys
from difflib import SequenceMatcher
sys.path.insert(0, os.path.dirname(__file__))
from wiki import ROOT

DIG = str.maketrans("०१२३४५६७८९", "0123456789")
FIRST_TEXT_PAGE = 15
NOTE = re.compile(r"^\s*टि[पप्]+[पणनरी]")
COLOPHON = re.compile(r"ॐ\s*तत्स|^\s*इति\s*श्रीमद्|^\s*ॐ\s*शांति")
LABEL = re.compile(r"(?:^|\s)([०-९0-9]{1,2}(?:\s*[-–]\s*[०-९0-9]{1,2})*)\s*$")
JUNK = re.compile(r"^[\s०-९0-9.\-–—,।:'\"()]*$")


def compact(s):
    return re.sub(r"[^ऀ-ॣॱ-ॿ]", "", s)


def canon():
    sa = json.load(open(os.path.join(ROOT, "sources", "gita_sa.json"), encoding="utf-8"))
    flat = []
    for c in range(1, 19):
        for v in sa[str(c)]["verses"]:
            lines = [compact(re.sub(r"॥.*?॥", "", l)) for l in v["sa"].split("\n")]
            whole = "".join(lines)
            flat.append({"c": c, "v": v["v"], "lines": [l for l in lines if l], "whole": whole})
    return flat


HEADER_WORD = re.compile(r"[अमभप]?[ध्भ]्?या[यब]|नासक|ना\s*स\s*क्")
SA_END = re.compile(r"(?:॥|।।|\|\|)\s*([०-९0-9]{1,2})\s*(?:॥|।।|\|\||।)")


def is_header(line):
    t = line.replace(" ", "")
    if len(line) >= 45 or SA_END.search(line):
        return False
    return bool(HEADER_WORD.search(t)) or (":" in line and t.endswith("योग"))


def page_lines(p):
    lines = [l.rstrip() for l in p["text"].split("\n")]
    out = []
    for k, l in enumerate(lines):
        # running header / page number / chapter title lines near the top of a page
        if k < 4 and (not l.strip() or JUNK.match(l) or is_header(l)):
            continue
        if (is_header(l) or ":" in l) and len(l.strip()) < 30:
            continue
        out.append((p["n"], l))
    return out


def sim(a, b):
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b, autojunk=False).ratio()


def match_sanskrit(line, flat, p):
    """Return index of the canonical verse this OCR line belongs to, or None."""
    cl = compact(line)
    if len(cl) < 14 or cl.endswith("योग") or "," in line:
        return None
    scores = {}
    for j in range(max(0, p - 1), min(len(flat), p + 14)):
        best = 0.0
        for l in flat[j]["lines"] + [flat[j]["whole"]]:
            s = sim(cl, l) if len(l) < 2.5 * len(cl) else 0
            # a line may be half of a canonical line or vice versa
            if len(cl) < len(l) * 0.75:
                s = max(s, max((sim(cl, l[k:k + len(cl)]) for k in range(0, max(1, len(l) - len(cl) + 1), 2)), default=0))
            best = max(best, s)
        scores[j] = best
    near = [(s, j) for j, s in scores.items() if j <= p + 1 and s >= 0.78]
    if near:
        return max(near)[1]
    # a jump forward (past a gap in the scan) needs strong evidence
    far = [(s, -j) for j, s in scores.items() if j > p + 1 and s >= 0.88 and len(cl) >= 22]
    if far:
        return -max(far)[1]
    return None


def join(parts):
    out = ""
    prev = ""
    for l in parts:
        l = l.strip()
        if not l:
            continue
        if prev and len(prev) < 25 and prev.endswith("-"):
            # a short speaker line such as "संजयने कहा-" ends with a dash, not a word break
            out = out.rstrip("-").rstrip() + " — " + l
        elif out.endswith("-") and not out.endswith(" -"):
            out = out[:-1] + l
        else:
            out = (out + " " + l) if out else l
        prev = l
    return re.sub(r"\s+", " ", out).strip()


def clean_meaning(buf):
    """buf: list of (page, line). Returns (text, label, first_page)."""
    keep = []
    for pn, l in buf:
        s = l.strip()
        if NOTE.match(s) or COLOPHON.search(s):
            break
        if JUNK.match(s):
            if s.strip():
                keep.append((pn, "\0" + s.strip()))  # a lone number: possible label
            continue
        if re.search(r"(उवाच|वाच)\s*$", s) and len(s) < 30:
            continue
        keep.append((pn, s))
    label = None
    # the label is a lone number line or a number at the end of the last text line
    lines = []
    for pn, s in keep:
        if s.startswith("\0"):
            if lines and label is None:
                label = s[1:]
            continue
        lines.append((pn, s))
    if lines:
        m = LABEL.search(lines[-1][1])
        if m:
            label = m.group(1)
            lines[-1] = (lines[-1][0], lines[-1][1][:m.start()].rstrip())
    text = join([s for _, s in lines])
    text = re.sub(r"\S*नासक्ति\s?योग\S*", "", text)  # stray running header inside a page
    text = re.sub(r"\s+", " ", text).strip()
    return text, label, (lines[0][0] if lines else None)


def main():
    pages = json.load(open(os.path.join(ROOT, "sources", "anasakti_pages.json"), encoding="utf-8"))
    flat = canon()
    lines = []
    for pg in pages:
        if pg["n"] >= FIRST_TEXT_PAGE:
            lines += page_lines(pg)

    p = 0
    group, buf = [], []
    out = {}
    issues = []

    def flush():
        if not group:
            return
        text, label, page = clean_meaning(buf)
        if not text:
            return
        vs = [flat[j] for j in group]
        if label:
            try:
                nums = [int(x.translate(DIG)) for x in re.split(r"\s*[-–]\s*", label)]
                if nums[-1] != vs[-1]["v"]:
                    issues.append(f"{vs[-1]['c']}.{vs[-1]['v']}: label {label} differs (page {page})")
            except ValueError:
                pass
        key = f"{vs[-1]['c']}.{vs[-1]['v']}"
        out[key] = {"c": vs[-1]["c"], "verses": [x["v"] for x in vs], "hi": text, "page": page}

    def by_marker(line):
        """A verse-end marker like ॥१६॥ that fits the expected order identifies the verse."""
        m = SA_END.search(line)
        if not m:
            return None
        v = int(m.group(1).translate(DIG))
        for j in range(max(0, p - 4), min(len(flat), p + 3)):
            if flat[j]["v"] == v:
                return j
        # further ahead only if the line also looks like that verse
        for j in range(p + 3, min(len(flat), p + 14)):
            if flat[j]["v"] == v and sanskrit_fragment(line.split("॥")[0].split("।।")[0], j):
                return j
        return None

    def sanskrit_fragment(line, j):
        cl = compact(line)
        if not cl or len(cl) > len(flat[j]["whole"]):
            return False
        w = flat[j]["whole"]
        best = max((sim(cl, w[k:k + len(cl)]) for k in range(0, max(1, len(w) - len(cl) + 1))), default=0)
        return best >= 0.7

    for pn, line in lines:
        j = by_marker(line)
        if j is None:
            j = match_sanskrit(line, flat, p)
        if j is not None:
            # quarter-verse lines just before this one belong to the Sanskrit, not to the meaning
            while buf and sanskrit_fragment(buf[-1][1], j):
                buf.pop()
            if j not in group:
                if buf and any(compact(l) for _, l in buf):
                    flush()
                    group, buf = [], []
                # keep groups inside one chapter and in order
                if group and (flat[group[-1]]["c"] != flat[j]["c"] or j < group[-1]):
                    group, buf = [], []
                group.append(j)
                buf = []
            p = max(p, j)
            continue
        buf.append((pn, line))
    flush()

    # generic noise removal: Latin-letter scan noise, and stray Sanskrit words at either end
    idx = {(x["c"], x["v"]): x for x in flat}
    for e in out.values():
        t = re.sub(r"(?<!\S)[A-Za-z0-9%=*#@&_~^]+(?!\S)", "", e["hi"])
        sa_whole = "".join(idx[(e["c"], v)]["whole"] for v in e["verses"])
        toks = t.split()
        def stray(tok):
            c = compact(tok)
            return c and (c.endswith("ः") or c.endswith("म्")) and c in sa_whole
        while toks and stray(toks[0]):
            toks.pop(0)
        while toks and stray(toks[-1]):
            toks.pop()
        e["hi"] = " ".join(toks)

    # hand fixes (removals and splits only; see the file for the rules)
    ov = json.load(open(os.path.join(os.path.dirname(__file__), "gita_hi_overrides.json"), encoding="utf-8"))
    for key, strings in ov["remove"].items():
        for s in strings:
            if s not in out[key]["hi"]:
                print(f"note: override remove {s!r} not needed for {key}")
                continue
            out[key]["hi"] = re.sub(r"\s+", " ", out[key]["hi"].replace(s, "", 1)).strip()
    for key, sp in ov["split"].items():
        t = out[key]["hi"]
        a = t.index(sp["after"]) + len(sp["after"])
        b = t.index(sp["skip_to"]) + len(sp["skip_to"])
        out[key]["hi"] = t[:a].strip()
        c = out[key]["c"]
        out[f"{c}.{sp['verse']}"] = {"c": c, "verses": [sp["verse"]], "hi": t[b:].strip(), "page": out[key]["page"]}
    for key, why in ov["drop"].items():
        out.pop(key, None)
        issues.append(f"{key}: dropped — {why}")

    covered = set()
    for e in out.values():
        for v in e["verses"]:
            covered.add((e["c"], v))
    missing = [f"{x['c']}.{x['v']}" for x in flat if (x["c"], x["v"]) not in covered]
    print("groups:", len(out), "covered:", len(covered), "/ 700")
    print("missing:", " ".join(missing))
    print("label mismatches:", len(issues))
    for i in issues[:60]:
        print("  ", i)
    with open(os.path.join(ROOT, "sources", "gita_hi.json"), "w", encoding="utf-8") as f:
        json.dump({"groups": out, "missing": missing, "issues": issues}, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
