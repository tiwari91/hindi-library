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
	function save() {
		try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode: keep working without saving */ }
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
	function applyLayers() {
		for (const k of ["text", "tr", "hi", "en", "note"]) {
			if (S.hide[k]) document.body.dataset["hide" + k[0].toUpperCase() + k.slice(1)] = "1";
			else delete document.body.dataset["hide" + k[0].toUpperCase() + k.slice(1)];
		}
	}
	function applyTheme() {
		if (S.theme === "light" || S.theme === "dark") document.documentElement.setAttribute("data-theme", S.theme);
		else document.documentElement.removeAttribute("data-theme");
	}
	function applyScale() { document.documentElement.style.setProperty("--scale", S.scale || 1); }

	// ---------- rendering pieces ----------
	function lines(text, cls) {
		// keep a closing verse number like ॥४७॥ or ||47|| together on one line
		return h("p", { class: cls }, String(text).split("\n").map((l) => {
			const m = l.match(/^(.*?)\s*((?:॥|\|\|)[^॥|]*(?:॥|\|\|))\s*$/);
			return m ? h("span", { class: "ln" }, m[1] + " ", h("span", { class: "vend" }, m[2])) : h("span", { class: "ln" }, l);
		}));
	}
	function chapterTitle(b, meta) {
		return (b.unit ? b.unit + " " + dev(meta.n) + " · " : "") + meta.title;
	}
	function verseUrl(b, n, id) { return "#/" + b.id + "/" + n + "/" + encodeURIComponent(id); }

	function renderItem(b, n, it, opts) {
		opts = opts || {};
		if (it.h) return h("h3", { class: "sec-h", text: it.h });
		if (it.p != null) return h("p", { id: opts.recite ? null : "v-" + it.id }, it.p);
		if (it.poem != null) return h("div", { class: "poem", id: opts.recite ? null : "v-" + it.id }, it.poem);
		const scriptCls = b.script === "hi" ? "sa-text hi" : "sa-text";
		const head = h("div", { class: "vhead" },
			it.n ? h("a", { class: "vnum", href: verseUrl(b, n, it.id), "aria-label": (b.verse || "Verse") + " " + it.n }, (b.verse ? b.verse + " " : "") + it.n) : null,
			it.speaker ? h("span", { class: "speaker" }, it.speaker) : null,
			opts.recite ? null : h("span", { class: "vtools" }, ...verseTools(b, n, it)),
		);
		const parts = [head];
		if (it.text) parts.push(lines(it.text, scriptCls));
		if (it.tr) parts.push(lines(it.tr, "tr-text"));
		if (it.hi) {
			const lab = [];
			if (it.hi_group) lab.push((b.verse || "") + " " + it.hi_group[0] + "–" + it.hi_group[1] + " का अर्थ");
			const m = h("div", { class: "meaning", lang: "hi" });
			if (lab.length || it.hi_src) {
				m.append(h("span", { class: "mlabel" }, lab.join(" "), lab.length && it.hi_src ? " · " : "",
					it.hi_src ? h("a", { href: it.hi_src, target: "_blank", rel: "noopener" }, "स्कैन देखें") : null));
			}
			m.append(it.hi);
			parts.push(m);
		} else if (it.hi_ref) {
			parts.push(h("div", { class: "meaning ref", lang: "hi" }, "अर्थ आगे " + (b.verse || "") + " " + it.hi_ref + " के साथ है।"));
		}
		if (it.en) parts.push(h("div", { class: "meaning en", lang: "en" }, it.en));
		if (it.note) parts.push(h("p", { class: "note", lang: b.note_lang || "hi" }, it.note));
		return h("article", { class: "verse", id: opts.recite ? null : "v-" + it.id, "data-id": it.id }, parts);
	}

	// verse tool buttons; filled in by features that register themselves
	const toolMakers = [];
	function verseTools(b, n, it) { return toolMakers.map((f) => f(b, n, it)).filter(Boolean); }
	toolMakers.push((b, n, it) => b.recite ? h("button", {
		class: "ibtn", title: "एक-एक करके पढ़ें · Recite from here", "aria-label": "Recite from here",
		onclick: () => openRecite(b, n, it.id),
	}, svg(ICON.recite)) : null);

	// ---------- views ----------
	function setTitle(t) { document.title = t ? t + " · हिन्दी पुस्तकालय" : "हिन्दी पुस्तकालय · Hindi Library"; }

	const homeExtras = []; // features can add blocks to the home page

	async function viewHome() {
		setTitle("");
		const frag = [];
		frag.push(h("section", { class: "hero" },
			h("p", { class: "eyebrow" }, "Hindi Library · हिन्दी पुस्तकालय"),
			h("h1", null, "पढ़िए, अध्याय-दर-अध्याय"),
			h("p", { class: "lede" }, "भगवद्गीता, रामचरितमानस, प्रेमचंद की कहानियाँ और दूसरे ग्रंथ — मुक्त स्रोतों से, मूल पाठ में। Classic Hindi and Sanskrit texts from public-domain and openly licensed sources.")));
		const lb = S.lastBook && bookById(S.lastBook);
		if (lb && S.last[lb.id]) {
			const L = S.last[lb.id];
			frag.push(h("a", { class: "resume", href: L.id ? verseUrl(lb, L.n, L.id) : "#/" + lb.id + "/" + L.n },
				h("span", null, "पढ़ना जारी रखें · Continue: ", h("b", null, lb.title), " — ", (lb.unit || "") + " " + dev(L.n)), "→"));
		}
		for (const f of homeExtras) { const el = await f(); if (el) frag.push(el); }
		const groups = [["ग्रंथ · Books", books().filter((b) => !b.purana && !b.hidden)]];
		for (const [label, list] of groups) {
			frag.push(h("h2", { class: "shelf" }, label));
			frag.push(h("ul", { class: "books" }, list.map((b) => h("li", null, bookCard(b)))));
		}
		frag.push(h("h2", { class: "shelf" }, "पुराण · The 18 Mahapuranas"));
		frag.push(h("ul", { class: "puranas" }, LIB.puranas.map((p) => {
			const b = p.book && bookById(p.book);
			return h("li", null, b
				? h("a", { class: "card", href: "#/" + b.id }, h("span", { class: "t sa" }, p.title), h("span", { class: "e" }, p.title_en))
				: h("div", { class: "card soon" }, h("span", { class: "t sa" }, p.title), h("span", { class: "e" }, p.title_en, h("span", { class: "pill" }, "coming"))));
		})));
		view.replaceChildren(...frag);
	}
	function bookCard(b) {
		const href = b.open ? "#/" + b.open : "#/" + b.id;
		return h("a", { class: "card", href },
			h("span", { class: "t" + (b.script === "sa" ? " sa" : "") }, b.title),
			h("span", { class: "go", "aria-hidden": "true" }, "→"),
			h("span", { class: "e" }, b.title_en, b.by ? " · " + b.by : ""),
			b.desc ? h("span", { class: "d" }, b.desc) : null);
	}

	async function viewBook(b) {
		setTitle(b.title);
		const t = await toc(b);
		const L = S.last[b.id];
		const parts = [h("section", { class: "hero" },
			h("p", { class: "eyebrow" }, h("a", { href: "#/" }, "पुस्तकालय"), " · ", b.title_en),
			h("h1", { class: b.script === "sa" ? "sa" : null }, b.title),
			b.by ? h("p", { class: "sub" }, b.by) : null,
			b.desc ? h("p", { class: "lede" }, b.desc) : null)];
		if (L) {
			const c = t.chapters.find((x) => String(x.n) === String(L.n));
			if (c) parts.push(h("a", { class: "resume", href: L.id ? verseUrl(b, L.n, L.id) : "#/" + b.id + "/" + L.n },
				h("span", null, "जहाँ छोड़ा था वहीं से · Continue: ", h("b", null, chapterTitle(b, c))), "→"));
		}
		parts.push(h("ul", { class: "toc" + (b.script === "sa" ? " sa" : "") }, t.chapters.map((c) => h("li", { class: L && String(L.n) === String(c.n) ? "here" : null },
			h("a", { href: "#/" + b.id + "/" + c.n },
				h("span", { class: "n" }, dev(c.label || c.n)),
				h("span", { class: "nm" }, h("span", { class: "dv" }, c.title), c.title_tr ? h("span", { class: "tr" }, c.title_tr) : null, c.title_en ? h("span", { class: "tr" }, c.title_en) : null),
				c.count ? h("span", { class: "ct" }, dev(c.count) + (b.kind === "prose" ? "" : " " + (b.verse || ""))) : null)))));
		if (b.sources) parts.push(h("p", { class: "note" }, "स्रोत · Sources: ", h("a", { href: "#/sources" }, b.sources.map((s) => LIB.sources[s] ? LIB.sources[s].where.split(" (")[0] : s).join(", "))));
		view.replaceChildren(...parts);
	}

	let observer = null;
	async function viewChapter(b, n, focusId) {
		const ch = await chapter(b, n);
		if (!ch) return viewMissing();
		const { doc, meta, toc: t, index } = ch;
		setTitle(b.title + " · " + chapterTitle(b, meta));
		S.lastBook = b.id;
		if (!S.last[b.id] || String(S.last[b.id].n) !== String(n)) S.last[b.id] = { n: meta.n };
		save();

		const head = h("header", { class: "chap-head" },
			h("p", { class: "crumbs" }, h("a", { href: "#/" + b.id }, b.title), " · ", h("a", { href: "#/" + b.id }, "सूची")),
			h("h1", { class: b.script === "sa" ? "sa" : null }, doc.title || chapterTitle(b, meta)),
			meta.title_tr ? h("p", { class: "tr" }, meta.title_tr) : null,
			layerChips(b),
			b.recite ? h("div", { class: "layers" }, h("button", { class: "chip ghost", onclick: () => openRecite(b, meta.n, null) }, "▶ एक-एक करके पढ़ें · Recite mode" + (b.mala ? " + mala" : ""))) : null,
			b.ocr_note ? h("p", { class: "ocr-note", lang: "hi" }, b.ocr_note) : null,
			doc.note ? h("p", { class: "ocr-note" }, doc.note) : null);
		const body = b.kind === "prose"
			? h("div", { class: "prose", lang: "hi" }, doc.items.map((it) => renderItem(b, meta.n, it)))
			: h("div", { class: "verses" }, doc.items.map((it) => renderItem(b, meta.n, it)));
		const prev = t.chapters[index - 1], next = t.chapters[index + 1];
		const pager = h("nav", { class: "pager", "aria-label": "Chapters" },
			prev ? h("a", { class: "prev", href: "#/" + b.id + "/" + prev.n }, h("small", null, "← पिछला"), h("span", null, prev.title)) : null,
			next ? h("a", { class: "next", href: "#/" + b.id + "/" + next.n }, h("small", null, "अगला →"), h("span", null, next.title)) : null);
		const src = doc.src ? h("p", { class: "note" }, "स्रोत पृष्ठ · Source page: ", h("a", { href: doc.src, target: "_blank", rel: "noopener" }, decodeURIComponent(doc.src).replace(/^https:\/\//, ""))) : null;
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
	}

	function layerChips(b) {
		if (!b.layers) return null;
		const keys = Object.keys(b.layers);
		if (keys.length < 2) return null;
		return h("div", { class: "layers", role: "group", "aria-label": "Show or hide" }, keys.map((k) => {
			const btn = h("button", { class: "chip", "aria-pressed": S.hide[k] ? "false" : "true" }, b.layers[k]);
			btn.addEventListener("click", () => {
				S.hide[k] = !S.hide[k];
				// never hide everything
				if (keys.every((x) => S.hide[x])) S.hide[k] = false;
				save(); applyLayers();
				document.querySelectorAll(".layers").forEach((g) => g.querySelectorAll(".chip[aria-pressed]").forEach((c, i) => {
					if (keys[i]) c.setAttribute("aria-pressed", S.hide[keys[i]] ? "false" : "true");
				}));
			});
			return btn;
		}));
	}

	function viewSources() {
		setTitle("Sources and licences");
		const parts = [h("section", { class: "hero" },
			h("p", { class: "eyebrow" }, "Sources and licences · स्रोत और लाइसेंस"),
			h("h1", null, "स्रोत और लाइसेंस"),
			h("p", { class: "lede" }, "Every text on this site comes from a public-domain or openly licensed source. Nothing is copied from modern copyrighted translations. Where a source is CC BY-SA, this site's content is shared under CC BY-SA 4.0 too, and you may reuse it under the same licence with credit."))];
		const doc = h("div", { class: "doc" });
		for (const b of books()) {
			if (!b.sources || b.hidden) continue;
			doc.append(h("h2", null, b.title + " · " + b.title_en));
			for (const sid of b.sources) {
				const s = LIB.sources[sid];
				if (!s) continue;
				doc.append(h("div", { class: "src" },
					h("h3", null, s.title),
					h("p", null, s.where),
					h("p", null, h("a", { href: s.url, target: "_blank", rel: "noopener" }, "Source link"), " · ",
						s.licence_url ? h("a", { class: "lic", href: s.licence_url, target: "_blank", rel: "noopener" }, s.licence) : h("span", { class: "lic" }, s.licence)),
					s.note ? h("p", null, s.note) : null));
			}
		}
		doc.append(h("h2", null, "This site"),
			h("p", null, "Site code and data are at ", h("a", { href: "https://github.com/tiwari91/hindi-library" }, "github.com/tiwari91/hindi-library"),
				". Text content is shared under ", h("a", { href: "https://creativecommons.org/licenses/by-sa/4.0/" }, "CC BY-SA 4.0"),
				" (share-alike, because the Wikisource texts are CC BY-SA). Roman transliteration is produced by a fixed rule from the Devanagari, not typed by hand."));
		parts.push(doc);
		view.replaceChildren(...parts);
	}
	function viewMissing() {
		setTitle("Not found");
		view.replaceChildren(h("p", { class: "empty" }, "यह पृष्ठ नहीं मिला। ", h("a", { href: "#/" }, "मुखपृष्ठ पर जाएँ")));
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
			applyScale(); save();
		};
		const sheet = h("div", { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": "Reading settings" },
			h("h2", null, "पढ़ने की सेटिंग · Reading settings"),
			h("div", { class: "row" }, h("span", null, "Theme · रंग"),
				seg([["auto", "Auto"], ["light", "दिन · Light"], ["dark", "रात · Dark"]], () => S.theme || "auto", (v) => { S.theme = v === "auto" ? undefined : v; applyTheme(); save(); })),
			h("div", { class: "row" }, h("span", null, "Text size · अक्षर का आकार"),
				h("div", { class: "seg" },
					h("button", { onclick: () => setSize(-0.1), "aria-label": "Smaller" }, "अ−"),
					h("button", { "aria-pressed": "true", disabled: true }, sizeOut),
					h("button", { onclick: () => setSize(0.1), "aria-label": "Larger" }, "अ+"))),
			h("button", { class: "chip", onclick: close }, "बंद करें · Close"));
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
		const items = ch.doc.items.filter((x) => x.text || x.p || x.poem);
		if (!items.length) return;
		let i = 0;
		const saved = S.last[b.id] && S.last[b.id].rc;
		if (fromId) i = Math.max(0, items.findIndex((x) => x.id === fromId));
		else if (saved && String(saved.n) === String(n)) i = Math.max(0, items.findIndex((x) => x.id === saved.id));
		closeRecite();
		RC = { b, ch, items, i };
		const card = h("div", { class: "rc-card", "aria-live": "polite" });
		const bar = h("i");
		const where = h("span", { class: "where" });
		const prevBtn = h("button", { class: "rc-nav", "aria-label": "Previous · पिछला", onclick: () => go(-1) }, svg(ICON.prev));
		const nextBtn = h("button", { class: "rc-nav", "aria-label": "Next · अगला", onclick: () => go(1) }, svg(ICON.next));
		const foot = h("div", { class: "rc-foot" }, prevBtn, b.mala ? malaWidget(b) : null, nextBtn);
		const body = h("div", { class: "rc-body" }, card);
		const root = h("div", { class: "recite", role: "dialog", "aria-modal": "true", "aria-label": "Recite mode" },
			h("div", null,
				h("div", { class: "rc-top" },
					h("button", { class: "ibtn", "aria-label": "Close recite mode", onclick: closeRecite }, svg(ICON.close)),
					where,
					h("button", { class: "ibtn", "aria-label": "Settings", onclick: openSettings }, "अ")),
				h("div", { class: "rc-bar" }, bar)),
			body, foot);
		document.body.append(root);
		document.documentElement.style.overflow = "hidden";
		RC.root = root;
		function show() {
			const it = RC.items[RC.i];
			card.replaceChildren(renderItem(b, n, it, { recite: true }));
			where.textContent = b.title + " · " + chapterTitle(b, ch.meta) + " · " + dev(RC.i + 1) + "/" + dev(RC.items.length);
			bar.style.width = ((RC.i + 1) / RC.items.length * 100) + "%";
			prevBtn.disabled = RC.i === 0 && ch.index === 0;
			nextBtn.disabled = RC.i === RC.items.length - 1 && ch.index === ch.toc.chapters.length - 1;
			body.scrollTop = 0;
			S.last[b.id] = Object.assign({}, S.last[b.id] || {}, { n: ch.meta.n, id: it.id, rc: { n: ch.meta.n, id: it.id } });
			S.lastBook = b.id;
			save();
		}
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
	function closeRecite() {
		if (!RC) return;
		RC.root.remove();
		document.documentElement.style.overflow = "";
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
		if (!RC) return;
		if (e.target && /input|textarea/i.test(e.target.tagName)) return;
		if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); RC.go(1); }
		else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); RC.go(-1); }
		else if (e.key === "Escape") closeRecite();
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
			if (c.n >= 108) { c.n = 0; c.malas += 1; buzz = [60, 50, 60, 50, 120]; toast("एक माला पूरी · One mala complete"); }
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
		const parts = location.hash.replace(/^#\/?/, "").split("/").map((x) => { try { return decodeURIComponent(x); } catch (e) { return x; } });
		return { book: parts[0] || "", n: parts[1], id: parts[2] };
	}
	const routes = {}; // extra pages registered by features: routes[name] = fn
	async function route() {
		if (RC) closeRecite();
		const r = parseRoute();
		try {
			if (!r.book) await viewHome();
			else if (r.book === "sources") viewSources();
			else if (routes[r.book]) await routes[r.book](r);
			else {
				const b = bookById(r.book);
				if (!b) viewMissing();
				else if (r.n == null || r.n === "") await viewBook(b);
				else await viewChapter(b, r.n, r.id);
			}
		} catch (e) {
			console.error(e);
			view.replaceChildren(h("p", { class: "empty" }, "पाठ लोड नहीं हो सका। Could not load this text. ", h("a", { href: "#/" }, "Home")));
		}
		if (!r.id) {
			if (!(r.n && bookById(r.book))) window.scrollTo(0, 0);
			view.focus({ preventScroll: true });
		}
	}
	window.addEventListener("hashchange", route);

	// expose a tiny API for feature modules
	window.HL = { S, save, h, svg, ICON, dev, toast, getJSON, toc, chapter, bookById, books: () => LIB.books, lib: () => LIB, renderItem, verseUrl, chapterTitle, toolMakers, homeExtras, routes, openRecite, route };

	// ---------- start ----------
	applyLayers();
	getJSON("data/library.json").then((lib) => {
		LIB = lib;
		document.dispatchEvent(new CustomEvent("hl:ready"));
		route();
	}).catch(() => {
		view.replaceChildren(h("p", { class: "empty" }, "Could not load the library. Please check your connection and reload."));
	});
})();
