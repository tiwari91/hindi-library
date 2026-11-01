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
	// Each book has a prebuilt index (data/search/<book>.json, from tools/build_search.py): the same folded
	// spelling as fold() below, and the English meaning, per verse. The main books are searched by default;
	// the Puranas (far larger) when asked. Verses are loaded only for the results shown.
	const IDX = {};
	async function bookIndex(b) {
		if (!IDX[b.id]) IDX[b.id] = getJSON("data/search/" + b.id + ".json").then((d) => d.rows.map((r) => ({ b, n: r[0], id: r[1], lat: " " + r[2] + " ", en: r[3] ? " " + r[3] : "" }))).catch(() => []);
		return IDX[b.id];
	}
	const searchable = (all) => HL.books().filter((b) => !b.link && !b.hidden && (all || !b.no_search));
	// the matched word marked in a snippet, where it appears as typed (Devanagari, or an English word)
	function marked(text, q) {
		const t = String(text), qq = String(q || "").trim();
		if (!qq) return t;
		const i = isDev(qq) ? t.indexOf(qq) : t.toLowerCase().indexOf(qq.toLowerCase());
		if (i < 0) return t;
		return h("span", null, t.slice(0, i), h("mark", null, t.slice(i, i + qq.length)), t.slice(i + qq.length));
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
				? "Search the verses, transliteration and English meanings of every book; the Puranas too, if you ask. Type a word in English letters, such as dharma, krishna or mind."
				: "हर ग्रंथ में खोजें; चाहें तो पुराणों में भी। Search every book; the Puranas too if you ask. Type in Devanagari (धर्म) or in English letters (dharma, krishna).")), form, status, out);
		if (!q0) { input.focus(); return; }
		const all = /[?&]all=1/.test(location.hash);
		const dq = isDev(q0) ? fold(q0).trim() : null;
		const lq = fold(q0).trim();
		if (lq.length < 2) { status.textContent = "Type at least two letters."; return; }
		// English words in the meanings match as typed; Sanskrit and Hindi words through the folded spelling
		const eq = " " + q0.toLowerCase().trim();
		const list = searchable(all), hits = [];
		let shown = 0;
		const more = h("p", { class: "note" });
		view.append(more);
		let only = null;   // a book chosen from the filter chips
		const chips = h("p", { class: "result-books" });
		out.before(chips);
		const pool = () => (only ? hits.filter((x) => x.b.id === only) : hits);
		const drawChips = () => {
			const per = new Map();
			for (const x of hits) per.set(x.b, (per.get(x.b) || 0) + 1);
			if (per.size < 2) { chips.replaceChildren(); return; }
			const chip = (id, label, n) => { const c = h("button", { class: "chip", type: "button", "aria-pressed": String(only === id) }, label + " · " + n); c.addEventListener("click", async () => { only = id; shown = 0; out.replaceChildren(); drawChips(); await draw(); }); return c; };
			chips.replaceChildren(chip(null, T("सभी · All", "All"), hits.length), ...[ ...per ].sort((a, b) => b[1] - a[1]).map(([ b, n ]) => chip(b.id, bTitle(b), n)));
		};
		const draw = async () => {
			// the verse text for the results on screen, a chapter at a time (each chapter is cached)
			const next = pool().slice(shown, 200);
			shown += next.length;
			for (const x of next) {
				const ch = await chapter(x.b, x.n);
				const it = ch && ch.doc.items.find((i) => i.id === x.id);
				if (!it) continue;
				const t = await toc(x.b), c = t.chapters.find((cc) => String(cc.n) === String(x.n)) || {};
				const y = { b: x.b, n: x.n, c, ct: c.title || "", it };
				out.append(h("li", null, h("a", { href: verseUrl(x.b, x.n, x.id) },
					h("span", { class: "rb" }, bTitle(x.b), " · ", en ? cTitle(c) : y.ct, it.n ? " · " + label(it.n) : ""),
					h("span", { class: "rt" }, marked(en ? snippetEn(y, q0) : snippet(it.text || it.p || it.poem, q0), q0)))));
			}
		};
		out.replaceChildren();
		let done = 0;
		for (const b of list) {
			status.textContent = T("खोज रहे हैं… ", "Searching… ") + (++done) + "/" + list.length + " · " + hits.length + " results";
			const rows = await bookIndex(b);
			for (const x of rows) { if (x.lat.includes(" " + (dq || lq)) || (!dq && x.en && x.en.includes(eq))) hits.push(x); }
			if (shown < 30 && hits.length > shown) await draw();
			if (location.hash.indexOf("#/search/") !== 0) return;   // the reader moved on
		}
		await draw();
		drawChips();
		status.textContent = hits.length ? hits.length + " results" + (hits.length > 200 ? " (showing the first 200)" : "") : "";
		if (!all) {
			const a2 = h("a", { href: "#/search/" + encodeURIComponent(q0) + "?all=1", class: "chip" }, T("पुराणों में भी खोजें · Search the Puranas too", "Search the Puranas too"));
			more.replaceChildren(a2, " ", en ? "(about 13 MB: best on Wi-Fi)" : "(लगभग 13 MB · Wi-Fi पर बेहतर)");
		}
		if (!hits.length) {
			out.replaceChildren(h("li", { class: "empty" }, en
				? "Nothing found for “" + q0 + "”. Try a shorter word, a different spelling (krishna or krsna), or a word from the English meaning."
				: "कुछ नहीं मिला · Nothing found for “" + q0 + "”. छोटा शब्द या दूसरी वर्तनी आज़माएँ · Try a shorter word or another spelling."));
		}
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

	// ---------- sharing a verse: the phone's share sheet, or the text and link copied; WhatsApp as well ----------
	function shareVerse(title, text, hash) {
		const url = location.origin + location.pathname + hash;
		const body = text + "\n\n" + title + "\n" + url;
		if (navigator.share) { navigator.share({ title, text: text + "\n\n" + title, url }).catch(() => {}); return; }
		const done = () => toast(T("कॉपी हो गया · Copied", "Copied: paste it anywhere"));
		if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(body).then(done, () => prompt("Copy:", body));
		else prompt("Copy:", body);
	}
	function shareRow(title, text, hash) {
		const url = location.origin + location.pathname + hash;
		const b1 = h("button", { class: "chip", type: "button" }, T("साझा करें · Share", "Share"));
		b1.addEventListener("click", () => shareVerse(title, text, hash));
		const wa = h("a", { class: "chip", href: "https://wa.me/?text=" + encodeURIComponent(text + "\n\n" + title + "\n" + url), target: "_blank", rel: "noopener" }, "WhatsApp");
		return h("p", { class: "share-row" }, b1, " ", wa);
	}
	HL.shareRow = shareRow;
	// a share button on every verse, beside save and read aloud
	const SHARE_ICON = '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>';
	toolMakers.push((b, n, it) => {
		const main = it.text || it.p || it.poem;
		if (!main) return null;
		const btn = h("button", { class: "ibtn share", title: T("साझा करें · Share", "Share this verse"), "aria-label": "Share this verse" }, svg(SHARE_ICON));
		btn.addEventListener("click", () => {
			const en = EN(), title = bTitle(b) + " " + (en ? String(n) : dev(n)) + (it.n ? "." + label(it.n) : "");
			shareVerse(title, en ? (it.tr || iast(main)) + (it.en ? "\n\n" + it.en : "") : main + (it.hi ? "\n\n" + it.hi : ""), verseUrl(b, n, it.id));
		});
		return btn;
	});

	// ---------- offline reading and install (sw.js) ----------
	if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "127.0.0.1" || location.hostname === "localhost")) { navigator.serviceWorker.register("sw.js").catch(() => {}); }
	// ---------- companion apps: the stotras and festivals that live in their own apps ----------
	homeExtras.push(async () => {
		const en = EN();
		const card = (href, t1, t2, d) => h("a", { class: "comp-card", href }, h("b", null, t1), h("span", null, t2), h("small", null, d));
		return h("section", { class: "companions" },
			h("p", { class: "eyebrow" }, T("साथी ऐप · Companion apps", "Companion apps")),
			h("div", { class: "comp-row" },
				card("https://tiwari91.github.io/stotra-reader/", T("स्तोत्र पाठ", "Stotra Reader"), "Hanuman Chalisa · Vishnu Sahasranama", en ? "Recite with a mala counter" : "माला के साथ पाठ"),
				card("https://tiwari91.github.io/utsav-sadhana/", T("उत्सव साधना", "Utsav Sadhana"), en ? "Festival-by-festival sadhana" : "त्योहार अनुसार साधना", en ? "Daily checklist, mantras, calendar" : "दैनिक सूची, मंत्र, पंचांग")));
	});

	// ---------- reading plans: a book in a set number of days, today's reading on the home page ----------
	const PLANS = [
		{ id: "gita18", book: "gita", days: 18, hi: "भगवद्गीता १८ दिन में", en: "Bhagavad Gita in 18 days" },
		{ id: "devi13", book: "devi-mahatmya", days: 13, hi: "दुर्गा सप्तशती १३ दिन में", en: "Devi Mahatmya in 13 days" },
		{ id: "bal12", book: "manas-bal", days: 12, hi: "बालकाण्ड १२ दिन में", en: "Balakanda in 12 days" },
		{ id: "chanakya15", book: "chanakya-niti", days: 15, hi: "चाणक्य नीति १५ दिन में", en: "Chanakya Niti in 15 days" },
		{ id: "kalki35", book: "kalki-purana", days: 35, hi: "कल्कि पुराण ३५ दिन में", en: "Kalki Purana in 35 days" }
	];
	const istDay = () => { const d = new Date(Date.now() + 5.5 * 3600e3); return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 864e5); };
	homeExtras.push(async () => {
		const en = EN(), P = S.plan && PLANS.find((p) => p.id === S.plan.id), sec = h("section", { class: "plan-box" });
		if (!P) {
			const row = h("p", { class: "plan-pick" });
			for (const p of PLANS) {
				if (!bookById(p.book)) continue;
				const b = h("button", { class: "chip", type: "button" }, en ? p.en : p.hi);
				b.addEventListener("click", () => { S.plan = { id: p.id, start: istDay() }; save(); HL.route ? HL.route() : location.reload(); });
				row.append(b);
			}
			sec.append(h("p", { class: "eyebrow" }, T("पाठ योजना · Reading plan", "Reading plan")), h("p", { class: "note" }, T("रोज़ थोड़ा पढ़ें: एक योजना चुनें, आज का पाठ यहीं दिखेगा।", "Read a little every day: choose a plan and today's reading appears here.")), row);
			return sec;
		}
		const b = bookById(P.book), t = await toc(b), ch = t.chapters, nCh = ch.length;
		const day = Math.min(P.days, Math.max(1, istDay() - S.plan.start + 1));
		const upto = Math.ceil(nCh * day / P.days), from = Math.ceil(nCh * (day - 1) / P.days);   // today's chapters: [from, upto)
		const read = new Set((S.read && S.read[b.id]) || []), done = ch.filter((c) => read.has(String(c.n))).length;
		const today = ch.slice(from, upto), left = today.filter((c) => !read.has(String(c.n)));
		const behind = ch.slice(0, from).filter((c) => !read.has(String(c.n))).length;
		const stop = h("button", { class: "chip", type: "button" }, T("योजना बंद करें · Stop", "Stop plan"));
		stop.addEventListener("click", () => { delete S.plan; save(); HL.route ? HL.route() : location.reload(); });
		const link = (c) => h("a", { class: "chip plan-go", href: "#/" + b.id + "/" + c.n }, (en ? cTitle(c) : c.title) || String(c.n));
		const add = (...xs) => sec.append(...xs.filter(Boolean));
		add(
			h("p", { class: "eyebrow" }, (en ? P.en : P.hi) + " · " + T("दिन " + dev(day) + " / " + dev(P.days), "Day " + day + " of " + P.days)),
			h("p", { class: "plan-today" }, done >= nCh ? T("योजना पूरी हुई। बधाई! 🙏", "Plan complete. Well done! 🙏") : left.length ? T("आज का पाठ:", "Today's reading:") : T("आज का पाठ हो गया ✓", "Today's reading done ✓")),
			left.length && done < nCh ? h("p", { class: "plan-pick" }, ...left.map(link)) : null,
			behind ? h("p", { class: "note" }, T("पिछले दिनों के " + dev(behind) + " अध्याय बाकी हैं।", behind + " chapter" + (behind === 1 ? "" : "s") + " from earlier days still to read.")) : null,
			h("span", { class: "prog-bar plan-bar" }, h("i", { style: "width:" + Math.round(done / nCh * 100) + "%" })),
			h("p", { class: "note" }, T(dev(done) + " / " + dev(nCh) + " पढ़े · ", done + " of " + nCh + " read · "), stop));
		return sec;
	});

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
			h("a", { href: verseUrl(b, c.n, it.id) }, "Bhagavad Gita " + c.n + "." + label(it.n || "") + " →"),
			shareRow("Bhagavad Gita " + c.n + "." + label(it.n || ""), (it.tr || iast(it.text)) + (it.en ? "\n\n" + it.en : ""), verseUrl(b, c.n, it.id)));
		return h("section", { class: "votd" },
			h("p", { class: "eyebrow" }, "आज का श्लोक"),
			h("p", { class: "sa-text" }, it.text),
			it.hi ? h("p", { class: "votd-hi", lang: "hi" }, it.hi) : null,
			h("a", { href: verseUrl(b, c.n, it.id) }, b.title + " " + dev(c.n) + "." + (it.n || "") + " →"),
			shareRow(b.title + " " + dev(c.n) + "." + (it.n || ""), it.text + (it.hi ? "\n\n" + it.hi : ""), verseUrl(b, c.n, it.id)));
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
