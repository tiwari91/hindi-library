# हिन्दी पुस्तकालय · Hindi Library

A free online reader for the Bhagavad Gita, the Ramcharitmanas and other Hindi and Sanskrit
classics. Live at **https://tiwari91.github.io/hindi-library/**.

Every text comes from a public-domain or openly licensed source (mostly Hindi and Sanskrit
Wikisource). Nothing is copied from modern copyrighted translations. Full credits are on the
site's *Sources and licences* page (`#/sources`), which is built from `data/library.json`.

## How the site works

It is a plain static site: no build step, no framework.

- `index.html` – the page shell.
- `assets/app.js` – the reader (home page, book contents, chapter view, recite mode, mala counter,
  settings). `assets/app.css` – styles, light and dark.
- `data/library.json` – the list of books, the Puranas shelf and all source credits.
- `data/<book>/index.json` – the contents of one book (its chapters).
- `data/<book>/NN.json` – one chapter.
- `tools/` – Python scripts that fetch the texts from Wikisource and build the data files.
  Fetched pages are cached in `sources/cache/` (not committed) so a rebuild does not hit
  Wikisource again.

To try it locally: `python3 -m http.server 8000` in this folder, then open
http://localhost:8000/.

## English mode

The हिन्दी / English switch in the header (or a link ending in `?lang=en`, for example
`#/gita/2?lang=en`) shows the whole site in English: the interface, book and chapter names, and
the verses in Roman transliteration instead of Devanagari, with the English meaning where there is
one. Hindi prose (Premchand) is transliterated in the page by `iastHi()` in `assets/app.js`. The
choice is saved in `localStorage`.

English meanings, by source:

- **Bhagavad Gita** – Annie Besant's translation (1922, public domain), verse by verse, from English
  Wikisource: `python3 tools/fetch_besant.py` then `python3 tools/add_en_pd.py gita sources/en-pd/gita-besant.json`.
- **Vishnu Purana** – M. N. Dutt's translation (1896, public domain), one passage per chapter, from
  Project Gutenberg #66208: `python3 tools/add_vishnu_dutt.py`.
- **Parashara Smriti, Chanakya Niti, Bal Kand, Sundarkand and the three Sahasranamas** – machine
  translation written by an AI model (Claude) for this site, kept in `sources/en/` and merged with
  `tools/add_en.py`. The site labels it "machine translation, not proofread". No public-domain
  English was found that lines up verse by verse with these texts.
- **Everything else** (the other Puranas, the Devi Mahatmya, Premchand) – transliteration only, with a
  note that a free English translation is not available yet.

`python3 tools/stats.py` refreshes `data/stats.json` (chapter and verse counts and reading time on the
home page); run it after adding or rebuilding a book.

## How to add a book

1. **Check the licence first.** Use only public-domain texts or texts under an open licence
   (Wikisource CC BY-SA, Project Gutenberg, clearly public-domain archive.org scans). Do not use
   Gita Press, ISKCON/BBT, gitasupersite or any other modern copyrighted translation. Never type
   or invent verse text or meanings.
2. **Make the data files.** Write a script in `tools/` (copy `build_manas.py` or `build_gita.py`
   and use `tools/wiki.py` to call the Wikisource API with caching). It must write:
   - `data/<id>/index.json`:
     ```json
     {"book": "<id>", "chapters": [{"n": 1, "file": "01.json", "title": "…", "count": 47}]}
     ```
   - `data/<id>/01.json`, `02.json`, …:
     ```json
     {"book": "<id>", "n": 1, "title": "…", "src": "<source page URL>", "items": [ … ]}
     ```
     Each item has an `id` and one of these shapes:
     - a verse: `{"id": "1.1", "n": "१", "text": "<original>", "tr": "<Roman>", "hi": "<Hindi meaning>", "note": "…"}`
       (`speaker`, `hi_src` (link to the scan page) and `en` are optional);
     - a heading: `{"id": "5", "h": "…"}`;
     - prose: `{"id": "7", "p": "…"}`, or a poem: `{"id": "8", "poem": "…"}`;
     - a gap where the source is not proofread: `{"id": "9", "gap": "८५०", "src": "<scan URL>"}`.
   - For Roman transliteration use `tools/iast.py` (a fixed rule from the Devanagari).
3. **List it in `data/library.json`** under `books`:
   ```json
   {"id": "<id>", "title": "…", "title_en": "…", "by": "…", "desc": "…",
    "script": "sa" | "hi", "kind": "verse" | "prose",
    "unit": "अध्याय", "verse": "श्लोक",
    "layers": {"text": "संस्कृत", "tr": "Roman", "hi": "हिन्दी अर्थ"},
    "default_hide": ["tr"], "recite": true, "mala": false,
    "sources": ["<source id>"]}
   ```
   - `recite: true` adds the one-verse-at-a-time reading mode; `mala: true` adds the 108-bead
     counter to it (for stotras and names).
   - `data: "<folder>"` lets two entries share one data folder; `open: "<id>/<n>"` makes the home
     card open straight into a chapter.
   - Add the source under `sources` with `title`, `where`, `url`, `licence`, `licence_url` and a
     `note`. It then shows on the Sources page automatically.
4. **English meanings** are kept apart from the generated data, in `sources/en/<book>/*.json`
   (`{"n", "id", "first", "en"}`, where `first` is the first line of the original verse). Run
   `python3 tools/add_en.py <book>` to copy them into the data files; it refuses any entry whose
   first line no longer matches, so rebuilding a book can never put English on the wrong verse.
   Run it again after every rebuild of that book. Add `"en": "English"` to the book's `layers`.
5. Run the site locally, check a chapter at phone and desktop width in light and dark mode, then
   commit and push. GitHub Pages publishes `main` automatically.

## Books imported from other readers

- **Parāśara Smṛti** (`data/parashara/`): all 583 ślokas, copied from the former
  `tiwari91/parashara-smriti` reader at its commit `7636992` with
  `python3 tools/import_parashara.py <clone>`. That repository has since been retired, so this
  copy is now the home of the text; there is nothing upstream to re-sync from. Sanskrit from Sanskrit Wikisource (CC BY-SA
  4.0); the English meanings were written with Claude for that reader and are labelled as such.
  Its reader features live on here for every book: one verse at a time (now the default for
  every verse book; the reader can switch to the whole chapter in settings), "Go to" a chapter or
  verse, "Hide meaning until I tap" (in settings), text size and arrow keys.

- **Puranas** come from Sanskrit Wikisource: `tools/build_bhagavata.py`, `tools/build_purana.py <id>`
  (Vishnu, Garuda, Shiva; add a new one to `PURANAS` in that file) and `tools/build_markandeya.py`
  (which also writes the Devi Mahatmya, adhyayas 81–93). They are large, so search leaves them out.

- **Stotras.** [tiwari91/stotra-reader](https://github.com/tiwari91/stotra-reader) (checked at
  commit `6dbb6f7`) takes its text from sanskritdocuments.org, whose files say they are "not to
  be copied or reposted ... without permission". So its text was **not** copied. Instead the
  Vishnu, Lalita and Shiva Sahasranamas are built from Sanskrit Wikisource
  (`tools/build_stotras.py`), and the Hanuman Chalisa card links to the stotra reader. Its recite
  mode and 108-bead mala counter are reader features here: set `"recite": true, "mala": true`.

## Licence

Text content is shared under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/),
because most texts come from Wikisource under that licence (share-alike). Each source's own
licence is listed on the Sources page. The site code may be reused freely.
