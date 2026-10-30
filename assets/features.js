/* Features for every book: search, saved verses, verse of the day, read aloud.
   Uses the small API that app.js puts on window.HL. */
(function () {
	"use strict";
	const HL = window.HL;
	if (!HL) return;
	const { S, save, h, svg, ICON, dev, toast, getJSON, toc, chapter, bookById, verseUrl, toolMakers, homeExtras, routes, EN, T, iast, toEn, bTitle, cTitle } = HL;
	const num = (x) => (EN() ? String(x) : dev(x));
	const label = (n) => (EN() ? toEn(String(n || "")).replace(/[०-९]/g, (d) => "०१२३४५६७८९".indexOf(d)) : n);
	const view = document.getElementById("view");
	const readable = () => HL.books().filter((b) => !b.link && !b.hidden && !b.no_search);
	document.getElementById("nav-search").hidden = false;
	document.getElementById("nav-saved").hidden = false;

	// ---------- text folding so "krishna", "kṛṣṇa" and "कृष्ण" can meet ----------
	const V = { "अ": "a", "आ": "a", "इ": "i", "ई": "i", "उ": "u", "ऊ": "u", "ऋ": "r", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au" };
	const M = { "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u", "ृ": "r", "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॉ": "o" };
	const C = { "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n", "च": "c", "छ": "ch", "ज": "j", "झ": "jh", "ञ": "n", "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
		"त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n", "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m", "य": "y", "र": "r", "ल": "l", "ळ": "l", "व": "v", "श": "s", "ष": "s", "स": "s", "ह": "h" };
	function roman(s) {
		// rough Devanagari -> Latin, only for matching (the shown text is never changed)
		let out = "";
		const a = Array.from(s.normalize("NFC").replace(/़/g, ""));
		for (let i = 0; i < a.length; i++) {
			const ch = a[i], nx = a[i + 1];
			if (C[ch]) out += C[ch] + (M[nx] || nx === "्" ? "" : "a");
			else if (M[ch]) out += M[ch];
			else if (V[ch]) out += V[ch];
			else if (ch === "ं" || ch === "ँ") out += "n";
			else if (ch === "ः" || ch === "्" || ch === "ऽ") out += "";
			else out += ch;
		}
		return out;
	}
	function fold(s) {
		return " " + roman(String(s)).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
			.replace(/[^a-z0-9\s]/g, " ")
			.replace(/ksh/g, "ks").replace(/sh/g, "s").replace(/ch/g, "c").replace(/w/g, "v").replace(/ph/g, "f")
			.replace(/ee/g, "i").replace(/oo/g, "u").replace(/(.)\1/g, "$1").replace(/ri/g, "r")
			.replace(/a/g, "").replace(/m(?=\s|$)/g, "n").replace(/\s+/g, " ") + " ";
	}
	const isDev = (s) => /[ऀ-ॿ]/.test(s);
	const plainDev = (s) => String(s).normalize("NFC").replace(/[‌‍।॥|]/g, "").replace(/\s+/g, " ");

	// ---------- search ----------
	let INDEX = null;
	async function buildIndex(onProgress) {
		if (INDEX) return INDEX;
		const rows = [];
		const list = readable();
		let done = 0;
		for (const b of list) {
			const t = await toc(b);
			await Promise.all(t.chapters.map(async (c) => {
				const ch = await chapter(b, c.n);
				for (const it of ch.doc.items) {
					const main = it.text || it.p || it.poem;
					if (!main) continue;
					const all = [main, it.hi, it.en, it.note].filter(Boolean).join(" \n ");
					rows.push({ b, n: c.n, ct: c.title, c, it, dv: plainDev(all), lat: fold(all + " " + (it.tr || "")), en: it.en ? " " + it.en.toLowerCase().replace(/[^a-z0-9\s]/g, " ") : "" });
				}
			}));
			onProgress && onProgress(++done, list.length);
		}
		INDEX = rows;
		return rows;
	}
	function snippet(text, q) {
		const s = String(text).replace(/\s+/g, " ");
		const i = q && isDev(q) ? plainDev(s).indexOf(plainDev(q)) : -1;
		if (i < 0) return s.length > 160 ? s.slice(0, 160) + "…" : s;
		const from = Math.max(0, i - 60);
		return (from ? "…" : "") + s.slice(from, from + 170) + (from + 170 < s.length ? "…" : "");
	}
	routes.search = async (r) => {
		document.title = T("Search · हिन्दी पुस्तकालय", "Search · Hindi Library");
		const en = EN();
		const q0 = r.n || "";
		const input = h("input", { type: "search", value: q0, placeholder: en ? "krishna, dharma, mind…" : "कृष्ण, krishna, dharma…", "aria-label": "Search all books", autocomplete: "off" });
		const status = h("p", { class: "note", role: "status" });
		const out = h("ol", { class: "results" });
		const form = h("form", { class: "searchbox", role: "search" }, input, h("button", { class: "chip", type: "submit" }, T("खोजें · Search", "Search")));
		form.addEventListener("submit", (e) => { e.preventDefault(); location.hash = "#/search/" + encodeURIComponent(input.value.trim()); });
		view.replaceChildren(h("section", { class: "hero" },
			h("p", { class: "eyebrow" }, h("a", { href: "#/" }, T("पुस्तकालय", "Library")), " · Search"),
			h("h1", null, T("खोजें · Search", "Search")),
			h("p", { class: "lede" }, en
				? "Search the verses, transliteration and English meanings of every book except the Puranas (too large to search on a phone). Type a word in English letters, such as dharma, krishna or mind."
				: "Search every book (except the Puranas, which are too large to search on a phone). Type in Devanagari (धर्म) or in English letters (dharma, krishna).")), form, status, out);
		if (!q0) { input.focus(); return; }
		status.textContent = T("खोज रहे हैं… Searching…", "Searching…");
		const rows = await buildIndex((d, n) => { status.textContent = "Loading books " + d + "/" + n + "…"; });
		const dq = isDev(q0) ? plainDev(q0) : null;
		const lq = fold(q0).trim();
		if (!dq && lq.length < 2) { status.textContent = "Type at least two letters."; return; }
		// English words in the meanings match as typed; Sanskrit words match through the folded spelling
		const eq = " " + q0.toLowerCase().trim();
		const hits = rows.filter((x) => dq ? x.dv.includes(dq) : x.lat.includes(" " + lq) || (x.en && x.en.includes(eq)));
		status.textContent = hits.length ? hits.length + " results" + (hits.length > 200 ? " (showing the first 200)" : "") : "";
		if (!hits.length) {
			out.replaceChildren(h("li", { class: "empty" }, en
				? "Nothing found for “" + q0 + "”. Try a shorter word, a different spelling (krishna or krsna), or a word from the English meaning."
				: "कुछ नहीं मिला · Nothing found for “" + q0 + "”. छोटा शब्द या दूसरी वर्तनी आज़माएँ · Try a shorter word or another spelling."));
			return;
		}
		out.replaceChildren(...hits.slice(0, 200).map((x) => h("li", null,
			h("a", { href: verseUrl(x.b, x.n, x.it.id) },
				h("span", { class: "rb" }, bTitle(x.b), " · ", en ? cTitle(x.c) : x.ct, x.it.n ? " · " + label(x.it.n) : ""),
				h("span", { class: "rt" }, en
					? snippetEn(x, q0)
					: snippet(x.it.text || x.it.p || x.it.poem, q0))))));
	};
	function snippetEn(x, q) {
		const it = x.it;
		const s = it.en && it.en.toLowerCase().includes(q.toLowerCase()) ? it.en : (it.tr || iast(it.text || it.p || it.poem || ""));
		const t = String(s).replace(/\s+/g, " ");
		return t.length > 170 ? t.slice(0, 170) + "…" : t;
	}

	// ---------- saved verses (bookmarks) ----------
	S.marks = Array.isArray(S.marks) ? S.marks : [];
	const markKey = (b, n, id) => b.id + "/" + n + "/" + id;
	const isMarked = (k) => S.marks.some((m) => m.k === k);
	toolMakers.push((b, n, it) => {
		const k = markKey(b, n, it.id);
		const btn = h("button", { class: "ibtn mark", "aria-pressed": String(isMarked(k)), title: T("सहेजें · Save this verse", "Save this verse"), "aria-label": "Save this verse" }, svg(ICON.mark));
		btn.addEventListener("click", () => {
			if (isMarked(k)) S.marks = S.marks.filter((m) => m.k !== k);
			else S.marks.unshift({ k, b: b.id, n, id: it.id, vn: it.n || "", t: String(it.text || it.p || it.poem || "").split("\n")[0].slice(0, 120), at: Date.now() });
			save();
			btn.setAttribute("aria-pressed", String(isMarked(k)));
			toast(isMarked(k) ? T("सहेजा गया · Saved", "Saved") : T("हटाया गया · Removed", "Removed"));
		});
		return btn;
	});
	routes.saved = () => {
		document.title = T("Saved verses · हिन्दी पुस्तकालय", "Saved verses · Hindi Library");
		const en = EN();
		const list = h("ol", { class: "results" });
		function paint() {
			const marks = S.marks.filter((m) => bookById(m.b));
			list.replaceChildren(...marks.map((m) => {
				const b = bookById(m.b);
				const rm = h("button", { class: "linkish", type: "button" }, T("हटाएँ · Remove", "Remove"));
				rm.addEventListener("click", () => { S.marks = S.marks.filter((x) => x.k !== m.k); save(); paint(); });
				return h("li", null, h("a", { href: verseUrl(b, m.n, m.id) },
					h("span", { class: "rb" }, bTitle(b), " · ", en ? (b.unit ? "Chapter " : "Part ") + m.n : (b.unit ? b.unit + " " : "") + dev(m.n), m.vn ? " · " + label(m.vn) : ""),
					h("span", { class: "rt" }, en ? iast(m.t) : m.t)), rm);
			}));
			if (!marks.length) list.replaceChildren(h("li", { class: "empty" }, en
				? "Nothing saved yet. While reading, tap the bookmark button next to a verse to keep it here."
				: "अभी कुछ सहेजा नहीं गया। Nothing saved yet: tap the bookmark next to any verse."));
		}
		paint();
		view.replaceChildren(h("section", { class: "hero" },
			h("p", { class: "eyebrow" }, h("a", { href: "#/" }, T("पुस्तकालय", "Library")), " · Saved"),
			h("h1", null, T("सहेजे श्लोक · Saved verses", "Saved verses")),
			h("p", { class: "lede" }, "Saved on this device only.")), list);
	};

	// ---------- verse of the day (same for everyone on a date, by Indian time) ----------
	homeExtras.push(async () => {
		const b = bookById("gita");
		if (!b) return null;
		const t = await toc(b);
		const ist = new Date(Date.now() + 5.5 * 3600e3);
		const day = Math.floor(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) / 864e5);
		const total = t.chapters.reduce((a, c) => a + (c.count || 0), 0);
		let k = ((day * 337) % total + total) % total; // 337 is prime to 700, so every verse comes round
		let c = t.chapters[0];
		for (const x of t.chapters) { if (k < x.count) { c = x; break; } k -= x.count; }
		const ch = await chapter(b, c.n);
		const verses = ch.doc.items.filter((x) => x.text);
		const it = verses[Math.min(k, verses.length - 1)];
		if (!it) return null;
		if (EN()) return h("section", { class: "votd", lang: "en" },
			h("p", { class: "eyebrow" }, "Verse of the day"),
			h("p", { class: "tr-text votd-tr" }, it.tr || iast(it.text)),
			it.en ? h("p", { class: "votd-hi votd-en" }, it.en) : null,
			h("a", { href: verseUrl(b, c.n, it.id) }, "Bhagavad Gita " + c.n + "." + label(it.n || "") + " →"));
		return h("section", { class: "votd" },
			h("p", { class: "eyebrow" }, "आज का श्लोक"),
			h("p", { class: "sa-text" }, it.text),
			it.hi ? h("p", { class: "votd-hi", lang: "hi" }, it.hi) : null,
			h("a", { href: verseUrl(b, c.n, it.id) }, b.title + " " + dev(c.n) + "." + (it.n || "") + " →"));
	});

	// ---------- read aloud ----------
	const synth = window.speechSynthesis;
	if (synth && window.SpeechSynthesisUtterance) {
		let voices = [];
		const loadVoices = () => { try { voices = synth.getVoices() || []; } catch (e) { voices = []; } };
		loadVoices();
		if ("onvoiceschanged" in synth) synth.addEventListener("voiceschanged", loadVoices);
		const pick = () => voices.find((v) => /^sa/i.test(v.lang)) || voices.find((v) => /^hi/i.test(v.lang)) || voices.find((v) => /^(mr|ne)/i.test(v.lang)) || null;
		let speaking = null;
		const pickEn = () => voices.find((v) => /^en-IN/i.test(v.lang)) || voices.find((v) => /^en-GB/i.test(v.lang)) || voices.find((v) => /^en/i.test(v.lang)) || null;
		// English mode: read the English meaning, or the transliteration without accents so an English voice can say it
		const plainLatin = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/'/g, "");
		toolMakers.push((b, n, it) => {
			const en = EN();
			const text = en ? it.en || plainLatin(it.tr || iast(it.text || it.hi || "")) : it.text || it.hi || it.en;
			if (!text) return null;
			const btn = h("button", { class: "ibtn speak", title: T("सुनें · Read aloud", "Read aloud"), "aria-label": "Read aloud" }, svg(ICON.speak));
			btn.addEventListener("click", () => {
				if (speaking === btn) { synth.cancel(); speaking = null; btn.removeAttribute("aria-pressed"); return; }
				synth.cancel();
				document.querySelectorAll(".ibtn.speak[aria-pressed]").forEach((x) => x.removeAttribute("aria-pressed"));
				const u = new SpeechSynthesisUtterance(String(text).replace(/[॥|]+\s*[०-९0-9.]*\s*[॥|]*/g, ". ").replace(/।/g, ","));
				const v = en ? pickEn() : it.text || it.hi ? pick() : null;
				if (v) { u.voice = v; u.lang = v.lang; } else u.lang = en ? "en-IN" : it.text || it.hi ? "hi-IN" : "en-IN";
				u.rate = 0.85;
				u.onend = u.onerror = () => { if (speaking === btn) { speaking = null; btn.removeAttribute("aria-pressed"); } };
				speaking = btn;
				btn.setAttribute("aria-pressed", "true");
				synth.speak(u);
				if (!v && !en && (it.text || it.hi)) toast("No Hindi voice on this device; using the default voice.");
			});
			return btn;
		});
		window.addEventListener("hashchange", () => { try { synth.cancel(); } catch (e) { /* ignore */ } });
	}
})();
