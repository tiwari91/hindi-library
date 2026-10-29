/* Features for every book: search, saved verses, verse of the day, read aloud.
   Uses the small API that app.js puts on window.HL. */
(function () {
	"use strict";
	const HL = window.HL;
	if (!HL) return;
	const { S, save, h, svg, ICON, dev, toast, getJSON, toc, chapter, bookById, verseUrl, toolMakers, homeExtras, routes } = HL;
	const view = document.getElementById("view");
	const readable = () => HL.books().filter((b) => !b.link && !b.hidden);
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
					rows.push({ b, n: c.n, ct: c.title, it, dv: plainDev(all), lat: fold(all + " " + (it.tr || "")) });
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
		document.title = "Search · हिन्दी पुस्तकालय";
		const q0 = r.n || "";
		const input = h("input", { type: "search", value: q0, placeholder: "कृष्ण, krishna, dharma…", "aria-label": "Search all books", autocomplete: "off" });
		const status = h("p", { class: "note", role: "status" });
		const out = h("ol", { class: "results" });
		const form = h("form", { class: "searchbox", role: "search" }, input, h("button", { class: "chip", type: "submit" }, "खोजें · Search"));
		form.addEventListener("submit", (e) => { e.preventDefault(); location.hash = "#/search/" + encodeURIComponent(input.value.trim()); });
		view.replaceChildren(h("section", { class: "hero" },
			h("p", { class: "eyebrow" }, h("a", { href: "#/" }, "पुस्तकालय"), " · Search"),
			h("h1", null, "खोजें · Search"),
			h("p", { class: "lede" }, "Search every book. Type in Devanagari (धर्म) or in English letters (dharma, krishna).")), form, status, out);
		if (!q0) { input.focus(); return; }
		status.textContent = "खोज रहे हैं… Searching…";
		const rows = await buildIndex((d, n) => { status.textContent = "Loading books " + d + "/" + n + "…"; });
		const dq = isDev(q0) ? plainDev(q0) : null;
		const lq = fold(q0).trim();
		if (!dq && lq.length < 2) { status.textContent = "Type at least two letters."; return; }
		const hits = rows.filter((x) => dq ? x.dv.includes(dq) : x.lat.includes(" " + lq));
		status.textContent = hits.length ? hits.length + " results" + (hits.length > 200 ? " (showing the first 200)" : "") : "कुछ नहीं मिला · Nothing found.";
		out.replaceChildren(...hits.slice(0, 200).map((x) => h("li", null,
			h("a", { href: verseUrl(x.b, x.n, x.it.id) },
				h("span", { class: "rb" }, x.b.title, " · ", x.ct, x.it.n ? " · " + x.it.n : ""),
				h("span", { class: "rt" }, snippet(x.it.text || x.it.p || x.it.poem, q0))))));
	};

	// ---------- saved verses (bookmarks) ----------
	S.marks = Array.isArray(S.marks) ? S.marks : [];
	const markKey = (b, n, id) => b.id + "/" + n + "/" + id;
	const isMarked = (k) => S.marks.some((m) => m.k === k);
	toolMakers.push((b, n, it) => {
		const k = markKey(b, n, it.id);
		const btn = h("button", { class: "ibtn mark", "aria-pressed": String(isMarked(k)), title: "सहेजें · Save this verse", "aria-label": "Save this verse" }, svg(ICON.mark));
		btn.addEventListener("click", () => {
			if (isMarked(k)) S.marks = S.marks.filter((m) => m.k !== k);
			else S.marks.unshift({ k, b: b.id, n, id: it.id, vn: it.n || "", t: String(it.text || it.p || it.poem || "").split("\n")[0].slice(0, 120), at: Date.now() });
			save();
			btn.setAttribute("aria-pressed", String(isMarked(k)));
			toast(isMarked(k) ? "सहेजा गया · Saved" : "हटाया गया · Removed");
		});
		return btn;
	});
	routes.saved = () => {
		document.title = "Saved verses · हिन्दी पुस्तकालय";
		const list = h("ol", { class: "results" });
		function paint() {
			const marks = S.marks.filter((m) => bookById(m.b));
			list.replaceChildren(...marks.map((m) => {
				const b = bookById(m.b);
				const rm = h("button", { class: "linkish", type: "button" }, "हटाएँ · Remove");
				rm.addEventListener("click", () => { S.marks = S.marks.filter((x) => x.k !== m.k); save(); paint(); });
				return h("li", null, h("a", { href: verseUrl(b, m.n, m.id) },
					h("span", { class: "rb" }, b.title, " · ", (b.unit ? b.unit + " " : "") + dev(m.n), m.vn ? " · " + m.vn : ""),
					h("span", { class: "rt" }, m.t)), rm);
			}));
			if (!marks.length) list.replaceChildren(h("li", { class: "empty" }, "अभी कुछ सहेजा नहीं गया। Nothing saved yet: tap the bookmark next to any verse."));
		}
		paint();
		view.replaceChildren(h("section", { class: "hero" },
			h("p", { class: "eyebrow" }, h("a", { href: "#/" }, "पुस्तकालय"), " · Saved"),
			h("h1", null, "सहेजे श्लोक · Saved verses"),
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
		return h("section", { class: "votd" },
			h("p", { class: "eyebrow" }, "आज का श्लोक · Verse of the day"),
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
		toolMakers.push((b, n, it) => {
			const text = it.text || it.hi || it.en;
			if (!text) return null;
			const btn = h("button", { class: "ibtn speak", title: "सुनें · Read aloud", "aria-label": "Read aloud" }, svg(ICON.speak));
			btn.addEventListener("click", () => {
				if (speaking === btn) { synth.cancel(); speaking = null; btn.removeAttribute("aria-pressed"); return; }
				synth.cancel();
				document.querySelectorAll(".ibtn.speak[aria-pressed]").forEach((x) => x.removeAttribute("aria-pressed"));
				const u = new SpeechSynthesisUtterance(String(text).replace(/[॥|]+\s*[०-९0-9.]*\s*[॥|]*/g, ". ").replace(/।/g, ","));
				const v = it.text || it.hi ? pick() : null;
				if (v) { u.voice = v; u.lang = v.lang; } else u.lang = it.text || it.hi ? "hi-IN" : "en-IN";
				u.rate = 0.85;
				u.onend = u.onerror = () => { if (speaking === btn) { speaking = null; btn.removeAttribute("aria-pressed"); } };
				speaking = btn;
				btn.setAttribute("aria-pressed", "true");
				synth.speak(u);
				if (!v && (it.text || it.hi)) toast("No Hindi voice on this device; using the default voice.");
			});
			return btn;
		});
		window.addEventListener("hashchange", () => { try { synth.cancel(); } catch (e) { /* ignore */ } });
	}
})();
