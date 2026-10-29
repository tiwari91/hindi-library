/* Hindi Library reader. Plain JavaScript, no build step.
   Routes (hash):  #/  ·  #/<book>  ·  #/<book>/<chapter>[/<verse id>]  ·  #/sources */
(function () {
	"use strict";

	// ---------- saved settings (localStorage may be missing or blocked) ----------
	const KEY = "hl:v1";
	let S = {};
	try { S = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { S = {}; }
	S.hide = S.hide || {};
	S.last = S.last || {};
	S.mala = S.mala || {};
	S.one = S.one || {};
	S.hideEn = S.hideEn || {};
	function save() {
		try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode: keep working without saving */ }
	}

	// ---------- language: "hi" (default, Devanagari with English help) or "en" (English only) ----------
	// a link can carry ?lang=en or ?lang=hi after the route, e.g. #/gita/2?lang=en
	function langFromUrl() {
		const m = location.hash.match(/[?&]lang=(en|hi)\b/);
		if (m) { S.lang = m[1] === "en" ? "en" : undefined; save(); }
	}
	langFromUrl();
	const EN = () => S.lang === "en";
	const T = (hi, en) => (EN() ? en : hi);

	// Devanagari -> IAST, the same fixed rule as tools/iast.py (used for English mode)
	const IV = { "अ": "a", "आ": "ā", "इ": "i", "ई": "ī", "उ": "u", "ऊ": "ū", "ऋ": "ṛ", "ॠ": "ṝ", "ऌ": "ḷ", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au", "ऑ": "ŏ" };
	const IM = { "ा": "ā", "ि": "i", "ी": "ī", "ु": "u", "ू": "ū", "ृ": "ṛ", "ॄ": "ṝ", "ॢ": "ḷ", "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॉ": "ŏ" };
	const IC = { "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "ṅ", "च": "c", "छ": "ch", "ज": "j", "झ": "jh", "ञ": "ñ", "ट": "ṭ", "ठ": "ṭh", "ड": "ḍ", "ढ": "ḍh", "ण": "ṇ",
		"त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n", "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m", "य": "y", "र": "r", "ल": "l", "ळ": "ḷ", "व": "v", "श": "ś", "ष": "ṣ", "स": "s", "ह": "h" };
	const INUK = { "क": "q", "ख": "ḵh", "ग": "ġ", "ज": "z", "ड": "ṛ", "ढ": "ṛh", "फ": "f" };
	// candrabindu as ṁ: the combining m̐ is missing from most fonts
	const IO = { "ं": "ṃ", "ः": "ḥ", "ँ": "ṁ", "ऽ": "'", "॥": "||", "।": "|", "ॐ": "oṃ", "॰": "." };
	// Hindi (not Sanskrit) drops the "a" at the end of a word: "aur", "kar", "premchand"
	function iastHi(s) {
		// per word: a final consonant + "a" loses the "a" when the word has another vowel before it
		// (not after a conjunct: "nitya", "mastiṣka" keep it)
		return iast(s).replace(/\s*\|\|?/g, ".").replace(/[^\s,.;:!?"“”‘’()\-–—|]+/g, (w) => {
			const m = w.match(/^(.*[aāiīuūeoṛṃṁ](?:kh|gh|ch|jh|ṭh|ḍh|th|dh|ph|bh|[^aāiīuūeoṛṃḥṁ'h]))a$/);
			return m ? m[1] : w;
		});
	}
	function iast(s) {
		// NFC keeps nukta letters (क़, ड़) as letter + ़, which the loop below expects
		const a = Array.from(String(s).normalize("NFC"));
		let out = "";
		for (let i = 0; i < a.length; i++) {
			const ch = a[i];
			if (IC[ch]) {
				let base = IC[ch], nx = a[i + 1];
				if (nx === "़") { base = INUK[ch] || base; i++; nx = a[i + 1]; }
				out += base;
				if (nx === "्") { i++; continue; }
				if (IM[nx]) { out += IM[nx]; i++; continue; }
				out += "a";
				continue;
			}
			if (IV[ch]) out += IV[ch];
			else if (IO[ch]) out += IO[ch];
			else if (DEVD.includes(ch)) out += DEVD.indexOf(ch);
			else if (IM[ch]) out += IM[ch];
			else if (ch === "्" || ch === "़" || ch === "‌" || ch === "‍") { /* skip */ }
			else out += ch;
		}
		return out;
	}
	const DEVD = "०१२३४५६७८९";
	const hasDev = (s) => /[ऀ-ॿ]/.test(String(s || ""));
	// common words in titles and labels, then everything else by rule
	const WORDS = [[/अध्यायः?|अध्याय/g, "Chapter"], [/भागः?|भाग/g, "Part"], [/दोहा/g, "Doha"], [/चौपाई/g, "Chaupai"], [/सोरठा/g, "Sortha"], [/छन्द/g, "Chhand"], [/श्लोक/g, "Verse"], [/सूची/g, "Contents"]];
	function toEn(s) {
		if (!hasDev(s)) return s;
		let t = String(s);
		for (const [re, w] of WORDS) t = t.replace(re, w);
		return t.replace(/[ऀ-ॿ‌‍]+(?:[\s\-–—]*[ऀ-ॿ‌‍]+)*/g, (run) => {
			const r = iast(run);
			return r.charAt(0).toUpperCase() + r.slice(1);
		});
	}
	// keep only the English sentences of a mixed Hindi/English note
	function enPart(s) {
		if (!s) return "";
		const parts = String(s).split(/(?<=[.!?।])\s+/).filter((x) => !hasDev(x));
		return parts.join(" ");
	}
	// a book note in English mode: notes about the Hindi meaning do not apply, since no Hindi is shown
	function enNoteFor(b, s) {
		const t = enPart(s);
		return /Hindi meaning|Hindi text|scan page/i.test(t) && b.layers && b.layers.hi ? "" : t;
	}

	// ---------- small helpers ----------
	const $ = (id) => document.getElementById(id);
	const view = $("view");
	const DEV = "०१२३४५६७८९";
	const dev = (n) => String(n).replace(/[0-9]/g, (d) => DEV[d]);
	function h(tag, attrs, ...kids) {
		const el = document.createElement(tag);
		if (attrs) for (const k in attrs) {
			const v = attrs[k];
			if (v == null || v === false) continue;
			if (k === "class") el.className = v;
			else if (k === "text") el.textContent = v;
			else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
			else el.setAttribute(k, v === true ? "" : v);
		}
		for (const kid of kids.flat()) {
			if (kid == null || kid === false) continue;
			el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
		}
		return el;
	}
	function svg(path, extra) {
		const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		s.setAttribute("viewBox", "0 0 24 24");
		s.setAttribute("fill", "none");
		s.setAttribute("stroke", "currentColor");
		s.setAttribute("stroke-width", "1.8");
		s.setAttribute("stroke-linecap", "round");
		s.setAttribute("stroke-linejoin", "round");
		s.setAttribute("aria-hidden", "true");
		s.innerHTML = path + (extra || "");
		return s;
	}
	const ICON = {
		play: '<path d="M8 5.5v13l10-6.5z"/>',
		prev: '<path d="m15 5-7 7 7 7"/>',
		next: '<path d="m9 5 7 7-7 7"/>',
		close: '<path d="M6 6l12 12M18 6 6 18"/>',
		mark: '<path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/>',
		speak: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
		recite: '<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M9 9h6M9 13h6"/>',
		link: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
		list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r=".8"/><circle cx="4" cy="12" r=".8"/><circle cx="4" cy="18" r=".8"/>',
		scroll: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.5 8h7M8.5 11.5h7M8.5 15h4"/>',
		sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
	};
	let toastTimer;
	function toast(msg) {
		let t = document.querySelector(".toast");
		if (!t) { t = h("div", { class: "toast", role: "status" }); document.body.append(t); }
		t.textContent = msg;
		t.hidden = false;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => { t.hidden = true; }, 1800);
	}

	// ---------- data loading with a small cache ----------
	const cache = new Map();
	function getJSON(path) {
		if (!cache.has(path)) {
			cache.set(path, fetch(path).then((r) => {
				if (!r.ok) throw new Error(path + ": " + r.status);
				return r.json();
			}).catch((e) => { cache.delete(path); throw e; }));
		}
		return cache.get(path);
	}
	let LIB = null;
	const books = () => LIB.books;
	const bookById = (id) => LIB.books.find((b) => b.id === id);
	const bookDir = (b) => "data/" + (b.data || b.id) + "/";
	const toc = (b) => getJSON(bookDir(b) + "index.json");
	async function chapter(b, n) {
		const t = await toc(b);
		const c = t.chapters.find((x) => String(x.n) === String(n));
		if (!c) return null;
		const doc = await getJSON(bookDir(b) + c.file);
		return { toc: t, meta: c, doc, index: t.chapters.indexOf(c) };
	}

	// ---------- applying settings ----------
	// which layers (text, tr, hi, en, note) are hidden is remembered per book
	let curBook = null;
	// English mode: no Devanagari text or Hindi meaning; transliteration, English and English notes can be toggled
	const enLayers = (b) => ["tr", "en"].concat(b && b.layers && b.layers.note && b.note_lang === "en" ? ["note"] : []);
	function hidden(b, k) {
		if (EN()) {
			if (k === "text" || k === "hi" || (k === "note" && !(b && b.note_lang === "en"))) return true;
			const he = b && S.hideEn[b.id];
			return !!(he && he[k]);
		}
		const hb = b && S.hide[b.id];
		if (hb && k in hb) return hb[k];
		return !!(b && b.default_hide && b.default_hide.includes(k));
	}
	function setHidden(b, k, v) {
		const store = EN() ? S.hideEn : S.hide;
		(store[b.id] = store[b.id] || {})[k] = v;
	}
	function applyLayers(b) {
		if (b !== undefined) curBook = b;
		for (const k of ["text", "tr", "hi", "en", "note"]) {
			const key = "hide" + k[0].toUpperCase() + k.slice(1);
			if (curBook && hidden(curBook, k)) document.body.dataset[key] = "1";
			else delete document.body.dataset[key];
		}
	}
	function applyTheme() {
		if (S.theme === "light" || S.theme === "dark" || S.theme === "sepia") document.documentElement.setAttribute("data-theme", S.theme);
		else document.documentElement.removeAttribute("data-theme");
	}
	function applySpacing() {
		if (S.lh === "relaxed" || S.lh === "loose") document.documentElement.setAttribute("data-spacing", S.lh);
		else document.documentElement.removeAttribute("data-spacing");
	}
	function applyScale() { document.documentElement.style.setProperty("--scale", S.scale || 1); }
	function applyTap() { if (S.tap) document.body.dataset.tap = "1"; else delete document.body.dataset.tap; }

	// ---------- rendering pieces ----------
	function lines(text, cls) {
		// keep a closing verse number like ॥४७॥ or ||47|| together on one line
		return h("p", { class: cls }, String(text).split("\n").map((l) => {
			const m = l.match(/^(.*?)(\S*)\s*((?:॥|\|\|)[^॥|]*(?:॥|\|\|))\s*$/);
			// the last word and the verse number stay together, so the number never sits alone on a line
			return m ? h("span", { class: "ln" }, m[1], h("span", { class: "nobr" }, m[2] + " ", h("span", { class: "vend" }, m[3]))) : h("span", { class: "ln" }, l);
		}));
	}
	const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
	// a chapter's name in the current language
	function cTitle(c) {
		if (!EN()) return c.title;
		return c.title_en || (c.title_tr ? cap(c.title_tr) : toEn(c.title));
	}
	const bTitle = (b) => (EN() ? b.title_en || toEn(b.title) : b.title);
	const groupLabel = (g) => (EN() && g ? (g.includes(" · ") ? g.split(" · ").slice(1).join(" · ") : toEn(g)) : g);
	function chapterTitle(b, meta) {
		if (EN()) return (b.unit ? "Chapter " + meta.n + " · " : "") + cTitle(meta);
		return (b.unit ? b.unit + " " + dev(meta.n) + " · " : "") + meta.title;
	}
	const verseWord = (b) => (EN() ? (b.verse ? "Verse" : "") : b.verse || "");
	// "Chapter 2 of 18" (stories: "Story 3 of 45")
	function posLabel(b, i, n) {
		if (EN()) return (b.kind === "prose" ? "Story " : b.unit ? "Chapter " : "Part ") + i + " of " + n;
		return (b.kind === "prose" ? "कहानी " : b.unit ? b.unit + " " : "भाग ") + dev(i) + " / " + dev(n) + " · " + (b.kind === "prose" ? "Story " : "Chapter ") + i + " of " + n;
	}
	function verseUrl(b, n, id) { return "#/" + b.id + "/" + n + "/" + encodeURIComponent(id); }

	function renderItem(b, n, it, opts) {
		opts = opts || {};
		if (EN()) return renderItemEn(b, n, it, opts);
		if (it.h) return h("h3", { class: "sec-h", text: it.h });
		if (it.gap) return h("p", { class: "ocr-note gap" },
			"स्कैन पृष्ठ " + it.gap + (it.gap_to ? "–" + it.gap_to : "") + " का पाठ विकिस्रोत पर अभी जाँचा (proofread) नहीं गया है, इसलिए यहाँ छोड़ा गया है। ",
			h("a", { href: it.src, target: "_blank", rel: "noopener" }, "स्कैन देखें"),
			" · These scan pages are not yet proofread on Wikisource, so they are left out.");
		if (it.p != null) return h("p", { id: opts.recite ? null : "v-" + it.id }, it.p);
		if (it.poem != null) return h("div", { class: "poem", id: opts.recite ? null : "v-" + it.id }, it.poem);
		const scriptCls = b.script === "hi" ? "sa-text hi" : "sa-text";
		const head = h("div", { class: "vhead" },
			h("a", { class: "vnum", href: verseUrl(b, n, it.id), "aria-label": "Link to this verse" }, it.n ? (b.verse ? b.verse + " " : "") + it.n : "#"),
			it.speaker ? h("span", { class: "speaker" }, it.speaker) : null,
			opts.recite ? null : h("span", { class: "vtools" }, ...verseTools(b, n, it)),
		);
		const parts = [head];
		if (it.text) parts.push(lines(it.text, scriptCls));
		if (it.tr) parts.push(lines(it.tr, "tr-text"));
		// meanings and notes sit in one box that "Hide meaning until I tap" can fold away
		const mw = h("div", { class: "mwrap" });
		if (it.hi) {
			const lab = [];
			if (it.hi_group) lab.push((b.verse || "") + " " + it.hi_group[0] + "–" + it.hi_group[1] + " का अर्थ");
			if (opts.recite && it.hi_src && b.ocr_note) lab.push("OCR पाठ, जाँचा नहीं · unproofread OCR");
			const m = h("div", { class: "meaning", lang: "hi" });
			if (lab.length || it.hi_src) {
				m.append(h("span", { class: "mlabel" }, lab.join(" "), lab.length && it.hi_src ? " · " : "",
					it.hi_src ? h("a", { href: it.hi_src, target: "_blank", rel: "noopener" }, "स्कैन देखें") : null));
			}
			m.append(it.hi);
			mw.append(m);
		} else if (it.hi_ref) {
			mw.append(h("div", { class: "meaning ref", lang: "hi" }, "अर्थ आगे " + (b.verse || "") + " " + it.hi_ref + " के साथ है।"));
		}
		if (it.en) mw.append(h("div", { class: "meaning en", lang: "en" },
			b.en_source ? h("span", { class: "mlabel" }, "English · " + b.en_source) : b.en_note ? h("span", { class: "mlabel" }, "English · machine translation, not proofread") : null, it.en));
		if (it.note) mw.append(h("p", { class: "note", lang: b.note_lang || "hi" }, it.note));
		if (mw.childNodes.length) {
			const rv = h("button", { class: "chip ghost reveal", type: "button" }, "अर्थ दिखाएँ · Show meaning");
			rv.addEventListener("click", () => { rv.classList.add("done"); mw.classList.add("open"); });
			parts.push(rv, mw);
		}
		return h("article", { class: "verse", id: opts.recite ? null : "v-" + it.id, "data-id": it.id }, parts);
	}

	// English mode: Roman transliteration instead of Devanagari, and the English meaning where one exists
	const NO_EN = "A free English translation of this text is not available yet, so only the transliteration is shown.";
	function enLabel(b) {
		if (b.en_source) return b.en_source;
		if (b.en_note) return "Machine translation, not proofread";
		return "";
	}
	function renderItemEn(b, n, it, opts) {
		const idv = opts.recite ? null : "v-" + it.id;
		if (it.h) return h("h3", { class: "sec-h", lang: "en", text: toEn(it.h) });
		if (it.gap) return h("p", { class: "ocr-note gap", lang: "en" },
			"Scan page " + toAscii(it.gap) + (it.gap_to ? "–" + toAscii(it.gap_to) : "") + " is not yet proofread on Wikisource, so it is left out here. ",
			h("a", { href: it.src, target: "_blank", rel: "noopener" }, "See the scan"));
		const isProse = it.p != null || it.poem != null;
		const orig = it.text || it.p || it.poem || "";
		const tr = it.tr || (orig ? (b.script === "hi" || b.kind === "prose" ? iastHi(orig) : iast(orig)) : "");
		const vl = it.n ? (verseWord(b) ? verseWord(b) + " " : "") + toAscii(toEn(it.n)) : "#";
		const head = isProse ? null : h("div", { class: "vhead" },
			h("a", { class: "vnum", href: verseUrl(b, n, it.id), "aria-label": "Link to this verse" }, vl),
			it.speaker ? h("span", { class: "speaker", lang: "en" }, cap(iast(it.speaker))) : null,
			opts.recite ? null : h("span", { class: "vtools" }, ...verseTools(b, n, it)));
		const parts = head ? [head] : [];
		if (tr) parts.push(isProse ? h("p", { class: "tr-text prose-tr", lang: "sa-Latn" }, tr) : lines(tr, "tr-text"));
		const mw = h("div", { class: "mwrap" });
		if (it.en) {
			const lab = enLabel(b);
			mw.append(h("div", { class: "meaning en", lang: "en" }, lab ? h("span", { class: "mlabel" }, lab) : null, it.en));
		} else if (it.en_ref) {
			mw.append(h("div", { class: "meaning ref", lang: "en" }, "The English meaning is given with verse " + it.en_ref + "."));
		} else if (!isProse && opts.recite) {
			mw.append(h("p", { class: "note", lang: "en" }, NO_EN));
		}
		if (it.note && b.note_lang === "en") mw.append(h("p", { class: "note", lang: "en" }, it.note));
		if (mw.childNodes.length) {
			const rv = h("button", { class: "chip ghost reveal", type: "button" }, "Show meaning");
			rv.addEventListener("click", () => { rv.classList.add("done"); mw.classList.add("open"); });
			parts.push(rv, mw);
		}
		if (isProse) return h("div", { class: "verse prose-en", id: idv, lang: "en" }, parts);
		return h("article", { class: "verse", id: idv, "data-id": it.id, lang: "en" }, parts);
	}

	// verse tool buttons; filled in by features that register themselves
	const toolMakers = [];
	function verseTools(b, n, it) { return toolMakers.map((f) => f(b, n, it)).filter(Boolean); }
	toolMakers.push((b, n, it) => b.recite ? h("button", {
		class: "ibtn", title: T("एक-एक करके पढ़ें · Recite from here", "Recite from here"), "aria-label": "Recite from here",
		onclick: () => openRecite(b, n, it.id),
	}, svg(ICON.recite)) : null);

	// ---------- views ----------
	function setTitle(t) {
		document.title = EN() ? (t ? t + " · Hindi Library" : "Hindi Library") : (t ? t + " · हिन्दी पुस्तकालय" : "हिन्दी पुस्तकालय · Hindi Library");
	}

	const homeExtras = []; // features can add blocks to the home page

	async function viewHome() {
		setTitle("");
		const frag = [];
		view.classList.add("wide");
		try { STATS = STATS || await getJSON("data/stats.json"); } catch (e) { STATS = {}; }
		const en = EN();
		// one clear first step: continue where you left off, or start with the Gita
		const lb = S.lastBook && bookById(S.lastBook);
		let primary;
		if (lb && S.last[lb.id]) {
			const L = S.last[lb.id];
			let where = en ? (lb.unit ? "Chapter " : "Part ") + L.n : (lb.unit || "") + " " + dev(L.n);
			try { const c = (await toc(lb)).chapters.find((x) => String(x.n) === String(L.n)); if (c) where = chapterTitle(lb, c); } catch (e) { /* keep the number */ }
			primary = h("a", { class: "resume", href: L.id ? verseUrl(lb, L.n, L.id) : "#/" + lb.id + "/" + L.n },
				h("span", null, h("small", null, T("जहाँ छोड़ा था वहीं से पढ़ें · Continue where you left off", "Continue where you left off")), h("b", null, bTitle(lb)), h("span", null, where)), h("span", { class: "go", "aria-hidden": "true" }, "→"));
		} else {
			primary = h("a", { class: "resume start", href: "#/gita/1" },
				h("span", null, h("small", null, T("शुरू करें · Start reading", "Start reading")), h("b", null, T("श्रीमद्भगवद्गीता", "Bhagavad Gita")), h("span", null, T("अध्याय १ से · from chapter 1", "from chapter 1"))), h("span", { class: "go", "aria-hidden": "true" }, "→"));
		}
		const q = h("input", { type: "search", name: "q", placeholder: en ? "Search: krishna, dharma, mind…" : "खोजें: कृष्ण, dharma…", "aria-label": T("सभी ग्रंथों में खोजें · Search all books", "Search all books"), autocomplete: "off" });
		const search = h("form", { class: "searchbox home-search", role: "search" }, q, h("button", { class: "chip", type: "submit" }, T("खोजें", "Search")));
		search.addEventListener("submit", (e) => { e.preventDefault(); if (q.value.trim()) location.hash = "#/search/" + encodeURIComponent(q.value.trim()); });
		frag.push(h("section", { class: "hero home" },
			h("h1", null, T("हिन्दी पुस्तकालय", "Hindi Library")),
			h("p", { class: "lede" }, en
				? "A free library of Indian classics to read on any screen: the Bhagavad Gita, the Ramcharitmanas, stotras, the Puranas and Premchand's stories, in Roman letters with English meanings where a free translation exists."
				: "भगवद्गीता, रामचरितमानस, स्तोत्र, पुराण और प्रेमचंद की कहानियाँ — मुक्त स्रोतों से, मूल पाठ में, एक-एक श्लोक करके पढ़ें। A free library of Indian classics, one verse at a time."),
			primary, search));
		const tip = firstTip();
		if (tip) frag.push(tip);
		const top = h("div", { class: "home-top" });
		for (const f of homeExtras) { const el = await f(); if (el) top.append(el); }
		if (top.childNodes.length) frag.push(top);
		const shown = books().filter((b) => !b.purana && !b.hidden);
		for (const [key, hi, enName] of SHELVES) {
			const list = shown.filter((b) => shelfOf(b) === key);
			if (!list.length) continue;
			frag.push(h("h2", { class: "shelf" }, T(hi + " · " + enName, enName)));
			frag.push(h("ul", { class: "books" }, list.map((b) => h("li", null, bookCard(b)))));
		}
		frag.push(h("h2", { class: "shelf" }, T("पुराण · The 18 Mahapuranas", "Puranas · the 18 Mahapuranas")));
		frag.push(h("p", { class: "shelf-note" }, en
			? "Long Sanskrit texts, chapter by chapter, in Roman transliteration."
			: "संस्कृत में, अध्याय-दर-अध्याय · Sanskrit text with Roman transliteration."));
		frag.push(h("ul", { class: "puranas" }, LIB.puranas.map((p) => {
			const b = p.book && bookById(p.book);
			const name = EN() ? h("span", null, p.title_en.replace(/ Purana$/, "")) : h("span", { class: "sa" }, p.title);
			return h("li", null, b
				? h("a", { class: "pchip", href: "#/" + b.id, title: p.title_en + (p.partial ? " (partial: " + p.partial + ")" : "") }, name,
					h("small", null, STATS && STATS[b.id] ? (en ? STATS[b.id].chapters + " chapters" : dev(STATS[b.id].chapters) + " अध्याय") : p.partial ? "partial" : "read"))
				: h("span", { class: "pchip soon", title: p.title_en + " (coming)" }, name, h("small", null, "coming")));
		})));
		view.replaceChildren(...frag);
	}
	// shelves on the home page
	let STATS = null;
	const SHELVES = [["scripture", "ग्रंथ", "Scriptures"], ["stotra", "स्तोत्र और प्रार्थना", "Stotras & prayers"], ["smriti", "स्मृति और नीति", "Smritis & niti"], ["story", "कहानियाँ", "Stories"]];
	function shelfOf(b) {
		if (b.shelf === "stotra") return "stotra";
		if (b.kind === "prose") return "story";
		if (/parashara|niti|smriti/.test(b.id)) return "smriti";
		return "scripture";
	}
	function readTime(min) {
		if (!min) return "";
		if (min < 60) return EN() ? "about " + min + " min" : "लगभग " + dev(min) + " मिनट";
		const hrs = Math.round(min / 60);
		return EN() ? "about " + hrs + (hrs === 1 ? " hour" : " hours") : "लगभग " + dev(hrs) + " घंटे";
	}
	// "18 chapters · 700 verses · about 4 hours"
	function statLine(b) {
		const s = STATS && STATS[b.id];
		if (!s) return "";
		const en = EN(), parts = [];
		if (b.kind === "prose") parts.push(en ? s.chapters + " stories" : dev(s.chapters) + " कहानियाँ");
		else {
			if (s.chapters > 1) parts.push(en ? s.chapters + " chapters" : dev(s.chapters) + " " + (b.unit === "अध्याय" ? "अध्याय" : "भाग"));
			parts.push(en ? s.verses.toLocaleString("en-IN") + " verses" : dev(s.verses) + " " + (b.verse || "पद"));
		}
		parts.push(readTime(s.minutes));
		return parts.join(" · ");
	}
	// a short one-line description: the first sentence of the book's description
	const oneLine = (b) => {
		const d = EN() ? toEn(b.desc || "") : b.desc || "";
		return (d.split(/(?<=[.;])\s/)[0] || "").replace(/[;.]$/, "");
	};
	function bookCard(b) {
		const href = b.link || (b.open ? "#/" + b.open : "#/" + b.id);
		const en = EN();
		const enInfo = !en ? "" : b.link ? "Transliteration, on a separate site" : b.kind === "prose" ? "Roman transliteration" : b.en_source ? "English: " + b.en_source : b.en_note ? "English: machine translation" : "Transliteration only";
		return h("a", { class: "card", href, rel: b.link ? "noopener" : null },
			h("span", { class: "t" + (!en && b.script === "sa" ? " sa" : "") + (en ? " en" : "") }, bTitle(b)),
			h("span", { class: "e" }, en ? enInfo : b.title_en),
			b.desc ? h("span", { class: "d" }, oneLine(b)) : null,
			b.link ? h("span", { class: "m" }, en ? "Opens the Stotra Reader site" : "स्तोत्र रीडर साइट पर खुलता है") : statLine(b) ? h("span", { class: "m" }, statLine(b)) : null);
	}

	// a one-time welcome tip; it can be skipped and does not come back
	function firstTip() {
		if (S.tipDone) return null;
		const box = h("aside", { class: "tip", "aria-label": T("सुझाव · Tips", "How to use this site") },
			h("h2", null, T("इस साइट को कैसे पढ़ें · How to use this site", "How to use this site")),
			h("ol", null,
				h("li", null, T("कोई ग्रंथ चुनें। वह एक-एक श्लोक करके खुलता है; ‹ › बटन, तीर कुंजियाँ या स्वाइप से आगे-पीछे जाएँ।", "Pick a book. It opens one verse at a time: use the big ‹ › buttons, the arrow keys or a swipe to move.")),
				h("li", null, T("ऊपर ‘Aa’ से अक्षर का आकार, पंक्ति की दूरी और रंग बदलें; ‘हिन्दी / English’ से भाषा।", "Use ‘Aa’ at the top for text size, line spacing and colours, and ‘हिन्दी / English’ for the language.")),
				h("li", null, T("बुकमार्क से श्लोक सहेजें, स्पीकर से सुनें, और ऊपर खोज से कुछ भी ढूँढ़ें।", "Tap the bookmark to save a verse, the speaker to hear it read aloud, and the search button to find anything."))),
			h("p", { class: "tip-actions" },
				h("button", { class: "chip", type: "button", onclick: () => { S.tipDone = true; save(); box.remove(); } }, T("समझ गया · Got it", "Got it")),
				h("a", { href: "#/help" }, T("पूरी सहायता · More help", "More help"))));
		return box;
	}

	async function viewBook(b) {
		setTitle(bTitle(b));
		const t = await toc(b);
		const L = S.last[b.id];
		const en = EN();
		const parts = [h("section", { class: "hero" },
			h("p", { class: "eyebrow" }, h("a", { href: "#/" }, T("पुस्तकालय", "Library")), " · ", b.title_en),
			h("h1", { class: !en && b.script === "sa" ? "sa" : null }, bTitle(b)),
			b.by ? h("p", { class: "sub" }, en ? (b.by_en || toEn(b.by)) : b.by) : null,
			b.desc ? h("p", { class: "lede" }, en ? toEn(b.desc) : b.desc) : null,
			en ? enNote(b) : null,
			aboutBox(b))];
		if (L) {
			const c = t.chapters.find((x) => String(x.n) === String(L.n));
			if (c) parts.push(h("a", { class: "resume", href: L.id ? verseUrl(b, L.n, L.id) : "#/" + b.id + "/" + L.n },
				h("span", null, T("जहाँ छोड़ा था वहीं से · Continue: ", "Continue: "), h("b", null, chapterTitle(b, c))), "→"));
		}
		const num = (x) => (en ? String(x) : dev(x));
		parts.push(h("ul", { class: "toc" + (!en && b.script === "sa" ? " sa" : "") + (en ? " en" : "") }, t.chapters.map((c, i) => [c.group && c.group !== (t.chapters[i - 1] || {}).group ? h("li", { class: "grp" }, groupLabel(c.group)) : null, h("li", { class: L && String(L.n) === String(c.n) ? "here" : null },
			h("a", { href: "#/" + b.id + "/" + c.n },
				h("span", { class: "n" }, num(c.label || c.n)),
				en
					? h("span", { class: "nm" }, h("span", { class: "dv" }, cTitle(c)), c.first ? h("span", { class: "tr" }, iast(c.first)) : null)
					: h("span", { class: "nm" }, h("span", { class: "dv" }, c.title), c.first ? h("span", { class: "fl" }, c.first) : null, c.title_tr ? h("span", { class: "tr" }, c.title_tr) : null, c.title_en ? h("span", { class: "tr" }, c.title_en) : null),
				c.count ? h("span", { class: "ct" }, num(c.count) + (b.kind === "prose" ? "" : " " + (en ? (c.count === 1 ? "verse" : "verses") : b.verse || ""))) : null))]).flat()));
		if (b.sources) parts.push(h("p", { class: "note" }, T("स्रोत · Sources: ", "Sources: "), h("a", { href: "#/sources" }, b.sources.map((s) => LIB.sources[s] ? toEn(LIB.sources[s].where.split(" (")[0]) : s).join(", "))));
		view.replaceChildren(...parts);
	}

	// English mode: say where the English comes from, or that there is none yet
	function enNote(b) {
		if (b.kind === "prose") return h("p", { class: "ocr-note", lang: "en" }, "This is Hindi prose. In English mode it is shown in Roman transliteration; a free English translation is not available yet.");
		if (b.en_source) return h("p", { class: "ocr-note", lang: "en" }, "English meaning: " + b.en_source + ". " + (b.en_source_note || ""));
		if (b.en_note) return h("p", { class: "ocr-note", lang: "en" }, b.en_note);
		return h("p", { class: "ocr-note", lang: "en" }, NO_EN);
	}

	function aboutBox(b) {
		if (!b.about) return null;
		const paras = EN() ? b.about.filter((p) => !hasDev(p)) : b.about;
		if (!paras.length) return null;
		return h("details", { class: "about" }, h("summary", null, T("इस ग्रंथ के बारे में · About this text", "About this text")),
			paras.map((p) => h("p", { lang: hasDev(p) ? "hi" : "en" }, p)));
	}

	// "Go to": a chapter list and a box for a verse number such as 3.16, or 16 in this chapter
	const toAscii = (s) => String(s).replace(/[०-९]/g, (d) => DEV.indexOf(d));
	async function goTo(b, curN, raw, inRecite) {
		const v = toAscii(raw).replace(/[।॥|\s]/g, "");
		if (!v) return false;
		const m = v.match(/^(\d+)[.:](.+)$/);
		const n = m ? m[1] : String(curN);
		const want = m ? m[2] : v;
		const ch = await chapter(b, n);
		if (!ch) return false;
		const it = ch.doc.items.find((x) => x.id === n + "." + want || x.id === want && !x.h && !x.gap) ||
			ch.doc.items.find((x) => x.n && toAscii(x.n).split("(")[0] === want);
		if (!it) return false;
		if (inRecite) openRecite(b, n, it.id);
		else location.hash = verseUrl(b, n, it.id);
		return true;
	}
	function goToBox(b, t, curN, inRecite) {
		if (b.kind === "prose") return null;
		const sel = h("select", { "aria-label": T("Chapter · अध्याय", "Chapter") }, t.chapters.map((c) =>
			h("option", { value: c.n, selected: String(c.n) === String(curN) }, (EN() ? String(c.label || c.n) : dev(c.label || c.n)) + ". " + cTitle(c))));
		sel.addEventListener("change", () => {
			if (inRecite) openRecite(b, sel.value, null);
			else location.hash = "#/" + b.id + "/" + sel.value;
		});
		const inp = h("input", { type: "text", inputmode: "decimal", placeholder: EN() ? "Go to verse" : "Go to · " + (b.verse || "verse"), "aria-label": "Go to verse, for example 3.16" });
		inp.addEventListener("keydown", async (e) => {
			if (e.key !== "Enter") return;
			e.preventDefault();
			if (await goTo(b, sel.value, inp.value, inRecite)) { inp.value = ""; inp.blur(); }
			else { inp.select(); inp.setAttribute("aria-invalid", "true"); setTimeout(() => inp.removeAttribute("aria-invalid"), 1200); }
		});
		return h("div", { class: "goto" }, sel, inp);
	}

	// one verse at a time: a per-book choice; some books (b.one) start that way
	const isOne = (b) => !!b.recite && b.kind !== "prose" && (b.id in S.one ? S.one[b.id] : true);

	let observer = null;
	async function viewChapter(b, n, focusId) {
		const ch = await chapter(b, n);
		if (!ch) return viewMissing();
		const { doc, meta, toc: t, index } = ch;
		applyLayers(b);
		setTitle(bTitle(b) + " · " + chapterTitle(b, meta));
		S.lastBook = b.id;
		if (!S.last[b.id] || String(S.last[b.id].n) !== String(n)) S.last[b.id] = { n: meta.n };
		save();

		const en = EN();
		const ocr = en ? enNoteFor(b, b.ocr_note) : b.ocr_note;
		const head = h("header", { class: "chap-head" },
			h("nav", { class: "crumbs", "aria-label": "Breadcrumb" },
				h("a", { href: "#/" }, T("मुखपृष्ठ", "Home")), h("span", { class: "sep", "aria-hidden": "true" }, "›"),
				h("a", { href: "#/" + b.id }, bTitle(b)), h("span", { class: "sep", "aria-hidden": "true" }, "›"),
				h("span", { "aria-current": "page" }, en ? cTitle(meta) : meta.title)),
			h("h1", { class: !en && b.script === "sa" ? "sa" : null }, en ? chapterTitle(b, meta) : doc.title || chapterTitle(b, meta)),
			t.chapters.length > 1 ? h("p", { class: "chap-pos" }, posLabel(b, index + 1, t.chapters.length)) : null,
			t.chapters.length > 1 ? h("div", { class: "chap-progress", role: "progressbar", "aria-valuemin": "1", "aria-valuemax": String(t.chapters.length), "aria-valuenow": String(index + 1), "aria-label": "Position in the book" },
				h("i", { style: "width:" + ((index + 1) / t.chapters.length * 100).toFixed(1) + "%" })) : null,
			!en && meta.title_tr ? h("p", { class: "tr" }, meta.title_tr) : null,
			layerChips(b),
			goToBox(b, t, meta.n, false),
			b.recite ? h("div", { class: "layers" },
				h("button", { class: "chip ghost", onclick: () => { S.one[b.id] = true; save(); openRecite(b, meta.n, null); } },
					T("▶ एक-एक श्लोक · One verse at a time", "▶ One verse at a time") + (b.mala ? " + mala" : ""))) : null,
			ocr && !(en && b.hi_only_ocr) ? h("p", { class: "ocr-note", lang: en ? "en" : "hi" }, ocr) : null,
			en ? enNote(b) : b.en_note ? h("p", { class: "ocr-note", lang: "en" }, b.en_note) : null,
			doc.note ? h("p", { class: "ocr-note" }, en ? toEn(doc.note) : doc.note) : null);
		// in one-verse or page mode the reader covers the screen, so the long list is not built behind it
		const covered = isOne(b) || (b.kind === "prose" && !S.scrollProse);
		const body = covered ? h("div")
			: b.kind === "prose"
			? h("div", { class: "prose", lang: en ? "en" : "hi" }, doc.items.map((it) => renderItem(b, meta.n, it)))
			: h("div", { class: "verses" }, doc.items.map((it) => renderItem(b, meta.n, it)));
		const prev = t.chapters[index - 1], next = t.chapters[index + 1];
		const pager = h("nav", { class: "pager", "aria-label": "Chapters" },
			prev ? h("a", { class: "prev", href: "#/" + b.id + "/" + prev.n }, h("small", null, T("← पिछला", "← Previous")), h("span", null, cTitle(prev))) : null,
			next ? h("a", { class: "next", href: "#/" + b.id + "/" + next.n }, h("small", null, T("अगला →", "Next →")), h("span", null, cTitle(next))) : null);
		const src = doc.src ? h("p", { class: "note" }, T("स्रोत पृष्ठ · Source page: ", "Source page: "), h("a", { href: doc.src, target: "_blank", rel: "noopener" }, en ? toEn(decodeURIComponent(doc.src).replace(/^https:\/\//, "").replace(/_/g, " ")) : decodeURIComponent(doc.src).replace(/^https:\/\//, ""))) : null;
		view.replaceChildren(head, body, pager, src || "");

		// jump to verse, or the saved place
		const target = focusId;
		if (target) {
			const el = document.getElementById("v-" + target);
			if (el) {
				el.scrollIntoView({ block: "start" });
				el.classList.add("flash");
				setTimeout(() => el.classList.remove("flash"), 60);
			}
		} else window.scrollTo(0, 0);

		// remember the verse at the top of the screen
		if (observer) observer.disconnect();
		if ("IntersectionObserver" in window) {
			observer = new IntersectionObserver((entries) => {
				if (RC) return;
				for (const e of entries) {
					if (e.isIntersecting && e.target.id) {
						S.last[b.id] = { n: meta.n, id: e.target.id.slice(2) };
						S.lastBook = b.id;
						save();
						break;
					}
				}
			}, { rootMargin: "-80px 0px -70% 0px" });
			view.querySelectorAll("[id^='v-']").forEach((el) => observer.observe(el));
		}
		if (isOne(b)) await openRecite(b, meta.n, focusId || null);
		else if (b.kind === "prose" && !S.scrollProse) openPages(b, ch);
	}

	function layerChips(b, onChange) {
		if (!b.layers) return null;
		const EN_NAMES = { tr: "Transliteration", en: "English", note: "Notes" };
		const keys = EN() ? enLayers(b).filter((k) => k !== "en" || b.layers.en) : Object.keys(b.layers);
		const label = (k) => (EN() ? EN_NAMES[k] || k : b.layers[k]);
		if (keys.length < 2) return null;
		const group = h("div", { class: "layers", role: "group", "aria-label": "Show or hide" });
		const btns = keys.map((k) => {
			const btn = h("button", { class: "chip", "aria-pressed": hidden(b, k) ? "false" : "true" }, label(k));
			btn.addEventListener("click", () => {
				setHidden(b, k, !hidden(b, k));
				// never hide everything except notes
				if (keys.filter((x) => x !== "note").every((x) => hidden(b, x))) setHidden(b, k, false);
				save(); applyLayers(b);
				btns.forEach((c, i) => c.setAttribute("aria-pressed", hidden(b, keys[i]) ? "false" : "true"));
				if (onChange) onChange();
			});
			return btn;
		});
		group.append(...btns);
		return group;
	}

	function viewSources() {
		setTitle("Sources and licences");
		const en = EN();
		const parts = [h("section", { class: "hero" },
			h("p", { class: "eyebrow" }, T("Sources and licences · स्रोत और लाइसेंस", "About this site")),
			h("h1", null, T("स्रोत और लाइसेंस", "Sources and licences")),
			h("p", { class: "lede" }, "Every text on this site comes from a public-domain or openly licensed source. Nothing is copied from modern copyrighted translations. Where a source is CC BY-SA, this site's content is shared under CC BY-SA 4.0 too, and you may reuse it under the same licence with credit."))];
		const doc = h("div", { class: "doc" });
		for (const b of books()) {
			if (!b.sources || b.hidden) continue;
			doc.append(h("h2", null, en ? bTitle(b) : b.title + " · " + b.title_en));
			for (const sid of b.sources.concat(b.en_sources || [])) {
				const s = LIB.sources[sid];
				if (!s) continue;
				doc.append(h("div", { class: "src" },
					h("h3", null, en ? s.title_en || toEn(s.title) : s.title),
					h("p", null, en ? toEn(s.where) : s.where),
					h("p", null, h("a", { href: s.url, target: "_blank", rel: "noopener" }, "Source link"), " · ",
						s.licence_url ? h("a", { class: "lic", href: s.licence_url, target: "_blank", rel: "noopener" }, s.licence) : h("span", { class: "lic" }, s.licence)),
					s.note ? h("p", null, en ? toEn(s.note) : s.note) : null));
			}
		}
		doc.append(h("h2", null, "This site"),
			h("p", null, "Site code and data are at ", h("a", { href: "https://github.com/tiwari91/hindi-library" }, "github.com/tiwari91/hindi-library"),
				". Text content is shared under ", h("a", { href: "https://creativecommons.org/licenses/by-sa/4.0/" }, "CC BY-SA 4.0"),
				" (share-alike, because the Wikisource texts are CC BY-SA). Roman transliteration is produced by a fixed rule from the Devanagari, not typed by hand."));
		parts.push(doc);
		view.replaceChildren(...parts);
	}
	function viewHelp() {
		const en = EN();
		setTitle(T("सहायता · Help", "Help"));
		const sec = (title, ...ps) => [h("h2", null, title), ...ps.map((p) => h("p", null, p))];
		view.replaceChildren(h("section", { class: "hero" },
			h("p", { class: "eyebrow" }, h("a", { href: "#/" }, T("पुस्तकालय", "Library")), " · ", T("सहायता", "Help")),
			h("h1", null, T("सहायता · How to use this site", "How to use this site")),
			h("p", { class: "lede" }, en ? "Everything works on a phone or a computer, and nothing needs an account." : "सब कुछ फ़ोन और कंप्यूटर पर चलता है; कोई खाता नहीं चाहिए। Everything works on a phone or a computer, and nothing needs an account.")),
		h("div", { class: "doc help" },
			...sec(T("एक-एक श्लोक या पूरा अध्याय · One verse at a time, or the whole chapter", "One verse at a time, or the whole chapter"),
				en ? "Books open one verse at a time, so the verse fills the screen. Move with the big ‹ Previous and Next › buttons at the bottom, the left and right arrow keys, or a swipe. The line at the top shows how far you are, and the counter shows “Verse 12 of 47”."
					: "ग्रंथ एक-एक श्लोक करके खुलते हैं। नीचे के ‹ पिछला / अगला › बटन, तीर कुंजियाँ या स्वाइप से आगे-पीछे जाएँ। Books open one verse at a time; use the ‹ › buttons, the arrow keys or a swipe.",
				en ? "To read a whole chapter as one page, tap the page button at the top right of the verse screen, or choose “Whole chapter” under Aa. Stories open page by page like a book."
					: "पूरा अध्याय एक पन्ने पर पढ़ने के लिए ऊपर दाईं ओर पन्ने वाला बटन दबाएँ, या ‘Aa’ में ‘पूरा अध्याय’ चुनें। कहानियाँ किताब की तरह पन्ना-दर-पन्ना खुलती हैं।"),
			...sec(T("जाएँ · Finding your place", "Finding your place"),
				en ? "Each book has a contents list. On the verse screen, pick a chapter from the list at the top, or type a verse number in “Go to verse” (for example 2.47, or 47 for this chapter). The site remembers where you stopped, and the home page offers “Continue where you left off”."
					: "हर ग्रंथ की सूची है। श्लोक वाले पन्ने पर ऊपर से अध्याय चुनें या ‘Go to’ में संख्या लिखें (जैसे 2.47)। साइट याद रखती है कि आपने कहाँ छोड़ा था।"),
			...sec(T("माला · The mala counter", "The mala counter"),
				en ? "Stotras such as the Vishnu Sahasranama show a 108-bead mala at the bottom. Tap it (or press the space bar) once for each recitation; a full round of 108 is counted as one mala. Reset sets it back to zero."
					: "स्तोत्रों में नीचे १०८ मनकों की माला है। हर जप पर उसे दबाएँ (या स्पेस बार)। १०८ पूरे होने पर एक माला गिनी जाती है।"),
			...sec(T("सहेजें, सुनें, खोजें · Save, listen, search", "Save, listen and search"),
				en ? "The bookmark button saves a verse to “Saved verses” (top of the page). The speaker button reads the verse aloud with your device’s own voice: in English mode it reads the English meaning, or the transliteration. Search looks through all books except the Puranas; type in English letters (krishna, dharma)."
					: "बुकमार्क बटन श्लोक को ‘सहेजे श्लोक’ में रखता है। स्पीकर बटन श्लोक पढ़कर सुनाता है। खोज में देवनागरी या अंग्रेज़ी अक्षरों में लिखें (धर्म, dharma)।"),
			...sec(T("भाषा और अक्षर · Language and text size", "Language and text size"),
				en ? "The हिन्दी / English switch at the top changes the whole site. English mode shows the verses in Roman letters (transliteration) with an English meaning where a free translation exists. Aa sets the text size, line spacing and colours (light, sepia or dark), and can hide the meaning until you tap it, which helps with memorising."
					: "ऊपर ‘हिन्दी / English’ से पूरी साइट की भाषा बदलें। ‘Aa’ से अक्षर का आकार, पंक्ति की दूरी और रंग (दिन, सेपिया, रात) बदलें।"),
			...sec(T("स्रोत · Where the texts come from", "Where the texts come from"),
				h("span", null, en ? "Every text is public domain or openly licensed; see " : "हर पाठ मुक्त स्रोत से है; देखें ", h("a", { href: "#/sources" }, T("स्रोत और लाइसेंस", "Sources and licences")), "."))));
	}
	function viewMissing() {
		setTitle("Not found");
		view.replaceChildren(h("p", { class: "empty" }, T("यह पृष्ठ नहीं मिला। ", "Page not found. "), h("a", { href: "#/" }, T("मुखपृष्ठ पर जाएँ", "Go to the home page"))));
	}

	// ---------- settings sheet ----------
	function openSettings() {
		const scrim = h("div", { class: "scrim" });
		const close = () => { scrim.remove(); sheet.remove(); $("nav-settings").focus(); };
		scrim.addEventListener("click", close);
		const seg = (opts, cur, onpick) => h("div", { class: "seg" }, opts.map(([v, label]) => {
			const b = h("button", { "aria-pressed": String(cur() === v) }, label);
			b.addEventListener("click", () => { onpick(v); b.parentNode.querySelectorAll("button").forEach((x, i) => x.setAttribute("aria-pressed", String(cur() === opts[i][0]))); });
			return b;
		}));
		const sizeOut = h("span", null, Math.round((S.scale || 1) * 100) + "%");
		const setSize = (d) => {
			S.scale = Math.min(1.6, Math.max(0.85, Math.round(((S.scale || 1) + d) * 100) / 100));
			sizeOut.textContent = Math.round(S.scale * 100) + "%";
			applyScale(); save(); refit();
		};
		const r = parseRoute();
		const rb = RC ? RC.b : (r.n && bookById(r.book)) || null;
		const refit = () => { if (RC && RC.fit) RC.fit(); };
		const sheet = h("div", { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": "Reading settings" },
			h("h2", null, T("पढ़ने की सेटिंग · Reading settings", "Reading settings")),
			h("div", { class: "row" }, h("span", null, T("Language · भाषा", "Language")),
				seg([["hi", "हिन्दी"], ["en", "English"]], () => (EN() ? "en" : "hi"), (v) => { close(); setLang(v); })),
			rb && rb.layers ? (() => { const lc = layerChips(rb, refit); return lc ? h("div", { class: "row" }, h("span", null, T("Show · दिखाएँ", "Show")), lc) : null; })() : null,
			rb && rb.recite && rb.kind !== "prose" ? h("div", { class: "row" }, h("span", null, T("Reading · पढ़ने का ढंग", "Reading")),
				seg([["one", T("एक-एक श्लोक · One verse", "One verse")], ["all", T("पूरा अध्याय · Whole chapter", "Whole chapter")]], () => isOne(rb) ? "one" : "all", (v) => {
					S.one[rb.id] = v === "one"; save();
					if (v === "all" && RC) { closeRecite(); close(); route(); }
					else if (v === "one" && !RC) { close(); route(); }
				})) : null,
			rb && rb.kind === "prose" ? h("div", { class: "row" }, h("span", null, T("Reading · पढ़ने का ढंग", "Reading")),
				seg([["pages", T("पन्ने · Pages", "Pages")], ["scroll", T("स्क्रॉल · Scroll", "Scroll")]], () => S.scrollProse ? "scroll" : "pages", (v) => {
					S.scrollProse = v === "scroll"; save(); if (RC) closeRecite(); close(); route();
				})) : null,
			h("div", { class: "row" }, h("span", null, T("Theme · रंग", "Theme")),
				seg([["auto", "Auto"], ["light", T("दिन · Light", "Light")], ["sepia", T("सेपिया · Sepia", "Sepia")], ["dark", T("रात · Dark", "Dark")]], () => S.theme || "auto", (v) => { S.theme = v === "auto" ? undefined : v; applyTheme(); save(); })),
			h("div", { class: "row" }, h("span", null, T("Line spacing · पंक्तियों की दूरी", "Line spacing")),
				seg([["normal", T("सामान्य · Normal", "Normal")], ["relaxed", T("खुली · Wider", "Wider")], ["loose", T("और खुली · Widest", "Widest")]], () => S.lh || "normal", (v) => { S.lh = v === "normal" ? undefined : v; applySpacing(); save(); refit(); })),
			h("div", { class: "row" }, h("span", null, T("Text size · अक्षर का आकार", "Text size")),
				h("div", { class: "seg" },
					h("button", { onclick: () => setSize(-0.1), "aria-label": "Smaller" }, T("अ−", "A−")),
					h("button", { "aria-pressed": "true", disabled: true }, sizeOut),
					h("button", { onclick: () => setSize(0.1), "aria-label": "Larger" }, T("अ+", "A+")))),
			h("div", { class: "row" }, h("span", null, T("Meaning · अर्थ", "Meaning")),
				seg([["show", T("दिखाएँ · Show", "Show")], ["tap", T("टैप पर · Hide until I tap", "Hide until I tap")]], () => S.tap ? "tap" : "show", (v) => { S.tap = v === "tap"; applyTap(); save(); refit(); })),
			h("p", { class: "sheet-help" }, h("a", { href: "#/help", onclick: () => close() }, T("सहायता · How to use this site", "Help: how to use this site"))),
			h("button", { class: "chip", onclick: close }, T("बंद करें · Close", "Close")));
		document.body.append(scrim, sheet);
		sheet.querySelector("button").focus();
		sheet.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
	}
	$("nav-settings").addEventListener("click", openSettings);

	// ---------- recite mode (one verse at a time) with a mala counter ----------
	let RC = null;
	async function openRecite(b, n, fromId) {
		const ch = await chapter(b, n);
		if (!ch) return;
		// gaps stay in, so a reader sees where unproofread scan pages were left out
		const items = ch.doc.items.filter((x) => x.text || x.p || x.poem || x.gap);
		let srcNote = b.note_short || (b.ocr_note ? (b.ocr_note.match(/[A-Z][^.]*\./) || [""])[0] : "");
		// in English mode the Hindi-meaning OCR note does not apply (no Hindi is shown)
		if (EN()) srcNote = enNoteFor(b, srcNote);
		if (!items.length) return;
		let i = 0;
		const saved = S.last[b.id] && S.last[b.id].rc;
		if (fromId) i = Math.max(0, items.findIndex((x) => x.id === fromId));
		else if (saved && String(saved.n) === String(n)) i = Math.max(0, items.findIndex((x) => x.id === saved.id));
		closeRecite();
		RC = { b, ch, items, i };
		const card = h("div", { class: "rc-card", "aria-live": "polite" });
		const bar = h("i");
		const pos = h("span", { class: "rc-pos" });
		const tools = h("span", { class: "rc-tools" });
		const prevBtn = h("button", { class: "rc-nav", "aria-label": T("Previous · पिछला", "Previous"), onclick: () => go(-1) }, svg(ICON.prev), h("span", { class: "w" }, T("पिछला", "Previous")));
		const nextBtn = h("button", { class: "rc-nav", "aria-label": T("Next · अगला", "Next"), onclick: () => go(1) }, h("span", { class: "w" }, T("अगला", "Next")), svg(ICON.next));
		const foot = h("div", { class: "rc-foot" }, prevBtn, h("div", { class: "rc-mid" }, pos, tools, b.mala ? malaWidget(b) : null), nextBtn);
		const body = h("div", { class: "rc-body" }, card);
		const root = h("div", { class: "recite", role: "dialog", "aria-modal": "true", "aria-label": b.title_en + ", one verse at a time" },
			h("div", null,
				h("div", { class: "rc-top" },
					h("a", { class: "ibtn", href: "#/" + b.id, "aria-label": T("Contents · सूची", "Contents"), title: T("Contents · सूची", "Contents") }, svg(ICON.list)),
					h("a", { class: "where", href: "#/" + b.id, title: T("सूची पर जाएँ · Back to contents", "Back to the contents") }, h("b", { class: !EN() && b.script === "sa" ? "sa" : null }, bTitle(b)),
						h("span", null, chapterTitle(b, ch.meta) + (ch.toc.chapters.length > 1 ? " · " + (EN() ? (b.unit ? "Ch. " : "Part ") + (ch.index + 1) + " of " + ch.toc.chapters.length : dev(ch.index + 1) + "/" + dev(ch.toc.chapters.length)) : ""))),
					goToBox(b, ch.toc, n, true),
					h("button", { class: "ibtn", "aria-label": T("Whole chapter · पूरा अध्याय", "Whole chapter"), title: T("Whole chapter · पूरा अध्याय", "Whole chapter"), onclick: toWhole }, svg(ICON.scroll)),
					h("button", { class: "ibtn aa", "aria-label": T("अक्षर, दूरी और रंग · Text size, spacing and colours", "Text size, spacing and colours"), title: T("अक्षर, दूरी और रंग · Text size, spacing and colours", "Text size, spacing and colours"), onclick: openSettings }, "Aa")),
				h("div", { class: "rc-bar" }, bar)),
			body, foot);
		document.body.append(root);
		document.documentElement.style.overflow = "hidden"; document.body.classList.add("rc-open");
		RC.root = root;
		function fit() {
			// shrink a long verse a little so it fits; past that, only the verse panel scrolls
			let z = 1;
			card.style.zoom = "";
			while (body.scrollHeight > body.clientHeight + 1 && z > 0.76) { z -= 0.06; card.style.zoom = String(z); }
		}
		function show() {
			const it = RC.items[RC.i];
			card.replaceChildren(renderItem(b, n, it, { recite: true }), srcNote && !it.gap ? h("p", { class: "rc-src" }, srcNote) : "");
			pos.textContent = (EN() ? "Verse " : "") + (RC.i + 1) + " of " + RC.items.length;
			pos.title = EN() ? "" : dev(RC.i + 1) + " / " + dev(RC.items.length);
			tools.replaceChildren(...toolMakers.slice(1).map((f) => f(b, n, it)).filter(Boolean));
			bar.style.width = ((RC.i + 1) / RC.items.length * 100) + "%";
			prevBtn.disabled = RC.i === 0 && ch.index === 0;
			nextBtn.disabled = RC.i === RC.items.length - 1 && ch.index === ch.toc.chapters.length - 1;
			body.scrollTop = 0;
			fit();
			S.last[b.id] = Object.assign({}, S.last[b.id] || {}, { n: ch.meta.n, id: it.id, rc: { n: ch.meta.n, id: it.id } });
			S.lastBook = b.id;
			save();
			try { history.replaceState(null, "", verseUrl(b, ch.meta.n, it.id)); } catch (e) { /* ignore */ }
		}
		RC.fit = fit;
		async function go(d) {
			const j = RC.i + d;
			if (j >= 0 && j < RC.items.length) { RC.i = j; show(); return; }
			const other = ch.toc.chapters[ch.index + (d > 0 ? 1 : -1)];
			if (!other) return;
			await openRecite(b, other.n, null);
			if (d < 0 && RC) { RC.i = RC.items.length - 1; RC.show(); }
			else if (RC) { RC.i = 0; RC.show(); }
		}
		RC.show = show;
		RC.go = go;
		// swipe left/right
		let x0 = null, y0 = null;
		body.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
		body.addEventListener("touchend", (e) => {
			if (x0 == null) return;
			const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
			if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
			x0 = null;
		});
		show();
		nextBtn.focus();
	}
	// prose (stories): screen-sized pages laid out with CSS columns; ‹ › turn a page, past the end go to the next story
	function openPages(b, ch) {
		closeRecite();
		const { doc, meta, toc: t, index } = ch;
		const cols = h("div", { class: "pg-cols", lang: EN() ? "en" : "hi" }, h("h1", { class: "pg-title" }, EN() ? cTitle(meta) : doc.title || meta.title), doc.items.map((it) => renderItem(b, meta.n, it, { recite: true })));
		const viewport = h("div", { class: "pg-view" }, cols);
		const pos = h("span", { class: "rc-pos" });
		const bar = h("i");
		const prevBtn = h("button", { class: "rc-nav", "aria-label": T("Previous page · पिछला", "Previous page"), onclick: () => go(-1) }, svg(ICON.prev), h("span", { class: "w" }, T("पिछला", "Previous")));
		const nextBtn = h("button", { class: "rc-nav", "aria-label": T("Next page · अगला", "Next page"), onclick: () => go(1) }, h("span", { class: "w" }, T("अगला", "Next")), svg(ICON.next));
		const root = h("div", { class: "recite pages", role: "dialog", "aria-modal": "true", "aria-label": cTitle(meta) + ", page by page" },
			h("div", null,
				h("div", { class: "rc-top" },
					h("a", { class: "ibtn", href: "#/" + b.id, "aria-label": T("Contents · सूची", "Contents"), title: T("Contents · सूची", "Contents") }, svg(ICON.list)),
					h("a", { class: "where", href: "#/" + b.id }, h("b", null, bTitle(b)), h("span", null, cTitle(meta))),
					h("button", { class: "ibtn", "aria-label": T("Scroll view · स्क्रॉल", "Scroll view"), title: T("Scroll view · स्क्रॉल", "Scroll view"), onclick: () => { S.scrollProse = true; save(); closeRecite(); route(); } }, svg(ICON.scroll)),
					h("button", { class: "ibtn aa", "aria-label": T("अक्षर, दूरी और रंग · Text size, spacing and colours", "Text size, spacing and colours"), title: T("अक्षर, दूरी और रंग · Text size, spacing and colours", "Text size, spacing and colours"), onclick: openSettings }, "Aa")),
				h("div", { class: "rc-bar" }, bar)),
			viewport,
			h("div", { class: "rc-foot" }, prevBtn, h("div", { class: "rc-mid" }, pos), nextBtn));
		document.body.append(root);
		document.documentElement.style.overflow = "hidden"; document.body.classList.add("rc-open");
		let page = 0, pages = 1, step = 1;
		const saved = S.last[b.id] && S.last[b.id].pg;
		const startFrac = saved && String(saved.n) === String(meta.n) ? saved.f : 0;
		function layout(frac) {
			const w = viewport.clientWidth;
			step = w;
			cols.style.setProperty("--pw", w + "px");
			pages = Math.max(1, Math.round(cols.scrollWidth / step));
			page = Math.min(pages - 1, Math.max(0, Math.round((frac || 0) * pages)));
			show();
		}
		function show() {
			viewport.scrollLeft = page * step;
			pos.textContent = "Page " + (page + 1) + " of " + pages;
			bar.style.width = ((page + 1) / pages * 100) + "%";
			prevBtn.disabled = page === 0 && index === 0;
			nextBtn.disabled = page === pages - 1 && index === t.chapters.length - 1;
			S.last[b.id] = { n: meta.n, pg: { n: meta.n, f: page / pages } };
			S.lastBook = b.id;
			save();
		}
		function go(d) {
			const p = page + d;
			if (p >= 0 && p < pages) { page = p; show(); return; }
			const other = t.chapters[index + (d > 0 ? 1 : -1)];
			if (!other) return;
			if (d < 0) S.last[b.id] = { n: other.n, pg: { n: other.n, f: 0.999 } };
			location.hash = "#/" + b.id + "/" + other.n;
		}
		RC = { b, ch, items: [], i: 0, root, go, fit: () => layout(page / pages), show };
		let x0 = null, y0 = null;
		viewport.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
		viewport.addEventListener("touchend", (e) => {
			if (x0 == null) return;
			const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
			if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
			x0 = null;
		});
		// fonts change the layout once they load
		requestAnimationFrame(() => layout(startFrac));
		if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (RC && RC.root === root) layout(page / pages); });
		nextBtn.focus();
	}

	// leave one-at-a-time for the whole-chapter scroll view, and remember that choice for this book
	function toWhole() {
		if (!RC) return;
		S.one[RC.b.id] = false;
		save();
		closeRecite();
		route();
	}
	window.addEventListener("resize", () => { if (RC && RC.fit) RC.fit(); });
	function closeRecite() {
		if (!RC) return;
		RC.root.remove();
		document.documentElement.style.overflow = ""; document.body.classList.remove("rc-open");
		const id = RC.items[RC.i] && RC.items[RC.i].id;
		const b = RC.b, n = RC.ch.meta.n;
		RC = null;
		const cur = parseRoute();
		if (cur.book === b.id && String(cur.n) === String(n) && id) {
			const el = document.getElementById("v-" + id);
			if (el) el.scrollIntoView({ block: "start" });
		}
	}
	document.addEventListener("keydown", (e) => {
		if (!RC || document.querySelector(".sheet")) return;
		const tg = e.target;
		if (tg && tg.closest && tg.closest("input, select, textarea, [contenteditable]")) return;
		if (e.key === "Escape") return toWhole();
		if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
		if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); RC.go(1); }
		else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); RC.go(-1); }
		else if ((e.key === " " || e.key === "Enter") && RC.b.mala && !(e.target && e.target.closest && e.target.closest("button:not(.mala-btn)"))) { e.preventDefault(); RC.count && RC.count(); }
	});

	function malaWidget(b) {
		const c = S.mala[b.id] || (S.mala[b.id] = { n: 0, malas: 0 });
		const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		s.setAttribute("viewBox", "0 0 132 132");
		s.setAttribute("aria-hidden", "true");
		let inner = '<circle class="core" cx="66" cy="66" r="44"/>';
		for (let k = 0; k < 108; k++) {
			const a = -Math.PI / 2 + (k + 0.5) * (2 * Math.PI / 108);
			inner += '<circle class="bead" cx="' + (66 + 58 * Math.cos(a)).toFixed(2) + '" cy="' + (66 + 58 * Math.sin(a)).toFixed(2) + '" r="1.55"/>';
		}
		inner += '<circle class="meru" cx="66" cy="5" r="3.4"/>';
		s.innerHTML = inner;
		const num = h("b", null, "0");
		const rounds = h("span");
		const btn = h("button", { class: "mala-btn", "aria-label": "Count one" }, s, h("span", { class: "mala-num" }, num, h("small", null, "of 108")));
		const beads = Array.from(s.querySelectorAll(".bead"));
		function paint() {
			num.textContent = c.n;
			rounds.textContent = c.malas + (c.malas === 1 ? " mala" : " malas");
			beads.forEach((el, k) => el.classList.toggle("on", k < c.n));
			btn.setAttribute("aria-label", "Count one. " + c.n + " of 108, " + c.malas + " malas complete");
		}
		function count() {
			c.n += 1;
			let buzz = 25;
			if (c.n >= 108) { c.n = 0; c.malas += 1; buzz = [60, 50, 60, 50, 120]; toast(T("एक माला पूरी · One mala complete", "One mala complete")); }
			try { if (navigator.vibrate) navigator.vibrate(buzz); } catch (e) { /* no vibration */ }
			paint(); save();
		}
		btn.addEventListener("click", count);
		if (RC) RC.count = count;
		const reset = h("button", { class: "linkish", onclick: () => { if (confirm("Reset the counter to zero?")) { c.n = 0; c.malas = 0; paint(); save(); } } }, "Reset");
		paint();
		return h("div", { class: "mala" }, btn, h("div", { class: "mala-meta" }, rounds, reset));
	}

	// ---------- routing ----------
	function parseRoute() {
		const parts = location.hash.replace(/^#\/?/, "").replace(/\?.*$/, "").split("/").map((x) => { try { return decodeURIComponent(x); } catch (e) { return x; } });
		return { book: parts[0] || "", n: parts[1], id: parts[2] };
	}

	// the page frame (header, footer, html lang) in the current language
	function applyChrome() {
		const en = EN();
		document.documentElement.lang = en ? "en" : "hi";
		document.body.classList.toggle("lang-en", en);
		const brand = document.querySelector(".brand");
		if (brand) brand.replaceChildren(h("b", null, T("हिन्दी पुस्तकालय", "Hindi Library")), en ? "" : h("span", null, "Hindi Library"));
		const set = (id, label) => { const el = $(id); if (el) { el.setAttribute("aria-label", label); el.title = label; } };
		set("nav-search", T("Search · खोजें", "Search"));
		set("nav-saved", T("Saved verses · सहेजे श्लोक", "Saved verses"));
		set("nav-settings", T("अक्षर, दूरी और रंग · Text size, spacing and colours", "Text size, spacing and colours"));
		document.querySelectorAll("#lang-switch button").forEach((btn) => btn.setAttribute("aria-pressed", String((btn.dataset.lang === "en") === en)));
		const f = $("footer");
		if (f) f.replaceChildren(h("p", null, h("a", { href: "#/help" }, T("सहायता · Help", "Help: how to use this site")), " · Texts are public domain or openly licensed; see ",
			h("a", { href: "#/sources" }, T("Sources and licences · स्रोत", "Sources and licences")), ". Site content is shared under ",
			h("a", { href: "https://creativecommons.org/licenses/by-sa/4.0/" }, "CC BY-SA 4.0"), ". ",
			h("a", { href: "https://github.com/tiwari91/hindi-library" }, "Code on GitHub"), "."));
	}
	function setLang(v) {
		S.lang = v === "en" ? "en" : undefined;
		save();
		applyChrome();
		// drop a ?lang= from the address so the choice made here is the one that sticks
		if (/[?&]lang=/.test(location.hash)) {
			try { history.replaceState(null, "", location.hash.replace(/[?&]lang=(en|hi)\b/, "")); } catch (e) { /* ignore */ }
		}
		route();
	}
	document.querySelectorAll("#lang-switch button").forEach((btn) => btn.addEventListener("click", () => setLang(btn.dataset.lang)));
	const routes = {}; // extra pages registered by features: routes[name] = fn
	async function route() {
		const was = S.lang;
		langFromUrl();
		if (was !== S.lang) applyChrome();
		if (RC) closeRecite();
		view.classList.remove("wide");
		const r = parseRoute();
		try {
			if (!r.book) await viewHome();
			else if (r.book === "sources") viewSources();
			else if (r.book === "help") viewHelp();
			else if (routes[r.book]) await routes[r.book](r);
			else {
				const b = bookById(r.book);
				if (!b) viewMissing();
				else if (r.n == null || r.n === "") await viewBook(b);
				else await viewChapter(b, r.n, r.id);
			}
		} catch (e) {
			console.error(e);
			view.replaceChildren(h("p", { class: "empty" }, T("पाठ लोड नहीं हो सका। Could not load this text. ", "Could not load this text. "), h("a", { href: "#/" }, "Home")));
		}
		if (!r.id) {
			if (!(r.n && bookById(r.book))) window.scrollTo(0, 0);
			view.focus({ preventScroll: true });
		}
	}
	window.addEventListener("hashchange", route);

	// expose a tiny API for feature modules
	window.HL = { S, save, h, svg, ICON, dev, toast, getJSON, toc, chapter, bookById, books: () => LIB.books, lib: () => LIB, renderItem, verseUrl, chapterTitle, toolMakers, homeExtras, routes, openRecite, route,
		EN, T, iast, toEn, bTitle, cTitle };

	// ---------- start ----------
	// Left/Right arrow keys move to the previous/next chapter in chapter view
	// (recite mode handles its own keys: previous/next verse)
	document.addEventListener("keydown", (e) => {
		if (RC || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
		const t = e.target;
		if (t && (/^(input|textarea|select)$/i.test(t.tagName) || t.isContentEditable)) return;
		if (document.querySelector(".sheet")) return;
		if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
		const a = view.querySelector(".pager a." + (e.key === "ArrowLeft" ? "prev" : "next"));
		if (a) { e.preventDefault(); location.hash = a.getAttribute("href"); }
	});
	// swipe left/right on the chapter page does the same on phones
	(function () {
		let x0 = null, y0 = null, t0 = 0;
		view.addEventListener("touchstart", (e) => {
			if (e.touches.length !== 1) { x0 = null; return; }
			x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
		}, { passive: true });
		view.addEventListener("touchend", (e) => {
			if (x0 == null || RC) return;
			const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
			x0 = null;
			if (Date.now() - t0 > 600 || Math.abs(dx) < 90 || Math.abs(dx) < Math.abs(dy) * 2) return;
			if (window.getSelection && String(window.getSelection())) return;
			const a = view.querySelector(".pager a." + (dx < 0 ? "next" : "prev"));
			if (a) location.hash = a.getAttribute("href");
		});
	})();

	applyLayers(null);
	applyTap();
	applySpacing();
	applyChrome();
	getJSON("data/library.json").then((lib) => {
		LIB = lib;
		document.dispatchEvent(new CustomEvent("hl:ready"));
		route();
	}).catch(() => {
		view.replaceChildren(h("p", { class: "empty" }, "Could not load the library. Please check your connection and reload."));
	});
})();
