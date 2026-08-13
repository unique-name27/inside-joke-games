# tools/ — the generator

Automates turning an `INTAKE.md` response into a deployed game, for
whichever template the order picked: no manual config-mapping, no
hand-run harness script, no manual tone-gate grep. Zero npm dependencies
— only Node builtins (`fs`, `path`, `crypto`, `vm`).

```
node tools/generate.js <answers.json> [--out=games] [--base-url=https://<pages-domain>] [--slug=<name>]
```

- `<answers.json>` — required. See "The answers schema" below;
  `tools/example-answers.json` (Hangout), `tools/gallery-sample-answers.json`
  (Gallery), and `tools/flight-sample-answers.json` (Flight) are complete
  worked examples, one per template — `tools/example-answers.json` is the
  same content as `examples/test-group.config.js`, expressed as intake
  answers.
- `--out` — output folder, default `games` (so the result lands at
  `games/<slug>/`, exactly `FULFILLMENT.md`'s existing deployment
  location).
- `--base-url` — your GitHub Pages origin (e.g.
  `https://<user>.github.io/inside-joke-games`), used only to print real,
  clickable URLs at the end. Omit it and the script still generates and
  verifies everything — it just prints `<PAGES_DOMAIN>` as a placeholder
  in the two link lines.
- `--slug` — overrides the default random-suffixed slug. Real orders
  always take the default (a stable, guessable folder name is
  undesirable for someone else's game); this exists for reproducible
  checked-in examples like `games/gallery-sample/`/`games/flight-sample/`
  (see `tools/gallery-sample-answers.json`/`tools/flight-sample-answers.json`),
  the same deterministic-naming spirit as `games/test-group/`'s own
  hand-picked slug.

## What it does

1. Reads and structurally validates the answers file (missing
   `catchphrase`/`title`/`host`/`email` — plus each template's own
   required content field(s), see below — fail fast with a clear
   message).
2. Builds the `CONFIG` object: `game/cfgcodec.js`'s `cfgBuildDefaultConfig()`
   (the same neutral per-template template a shared `#cfg=` link merges
   onto — see the "URL-fragment configs" section of `README.md`) is the
   base, deep-merged with the answers via `cfgDeepMerge` (same codec,
   reused rather than duplicated). Every cast role not answered in Q6 is
   explicitly left `null` (uncast), matching the degradation map.
3. **Verifies before writing anything** — that template's own verify
   driver (`tools/verify-config.js` for Hangout, `tools/verify-gallery.js`
   for Gallery, `tools/verify-flight.js` for Flight) runs the generated
   config through: a syntax check, a full headless playthrough (Node
   `vm`, no browser — the same methodology every round of this project
   has used) that drives whatever roles ended up cast all the way to the
   end card, and the tone gate (this order's own `forbiddenWords`,
   whole-word case-sensitive, and nothing else — no baseline/universal
   word list). **A failing config is never written to disk** — the
   script prints the specific errors and exits non-zero.
4. Writes `games/<slug>/config.js` plus that template's own shell pages:
   **Hangout** gets three HTML pages (`index.html`, `game/index.html`,
   `intro/index.html`), copied fresh off `games/test-group/`'s own
   current files (not a hardcoded template string) with just the
   `<title>` swapped; **Gallery**/**Flight** each get exactly ONE
   `index.html`, copied fresh off `gallery/index.html`/`flight/index.html`
   with five exact-string replacements (title + four script `src`s,
   re-pointed one directory level deeper) — every replacement is
   verified to have actually matched something before it's written (see
   `generate.js`'s `safeReplace()`); a mismatch fails loudly instead of
   silently shipping a shell with the wrong paths. Either shape is the
   exact Phase-C pattern `README.md`'s "How games are added" describes.
5. If `music.songFile` was given (Hangout only today), copies it to
   `games/<slug>/assets/theme.mp3` and points `customSongPath` at the
   correct page-relative path (`../assets/theme.mp3` — see "A
   `FULFILLMENT.md` correction" below).
6. Prints **two** links: the hosted `games/<slug>/` URL (real once
   pushed) and an **instant fragment link** — playable immediately, no
   deployment step, using this repo's own already-shared engine.
   Hangout's instant link is `/intro/#cfg=<data>` (the intro page, same
   as ever); Gallery's is `/gallery/#cfg=<data>`; Flight's is
   `/flight/#cfg=<data>` (each a single page, no separate intro to route
   through). "An order can be fulfilled either as a hosted folder or an
   instant link."

## The answers schema

`template` (INTAKE.md's new Q1, "What's the joke?") picks which of the
three shapes below applies — `"hangout"` (default if omitted),
`"gallery"`, or `"flight"`. The shared fields (`catchphrase`/`title`/
`host`/`cast`/`anecdotes`/`music`/`spellings`/`offLimits`/`email`) are
read identically across all three; each template's own content fields
are template-only (a Hangout answers file never has `targets`/`beats`, a
Gallery one never has `stories`/`scene`, and so on). Q-numbers in the
comments below match INTAKE.md's current numbering (Q1 the joke pick,
Q2 setting [Hangout only], Q3 catchphrase, Q4 the content question
[branches per template], Q5 title, Q6 host, Q7 cast, Q8 anecdotes, Q9
music, Q10 spellings, Q11 off-limits, Q12 email).

**Hangout** (`template` omitted or `"hangout"`):

```jsonc
{
  "scene": "dinner",                        // Q2, optional, defaults to "dinner" -- "dinner" | "roadtrip" | "office" | "wedding" (see "Story skeletons" in README.md)
  "catchphrase": "SO TRUE.",                // Q3, required
  "stories": ["...", "..."],                // Q4, required — array of 2-4 plain-English sentences, pre-split (one string per story); the generator uppercases + word-wraps each into up to 2 short lines itself
  "title": "The Test Group",                // Q5, required
  "host": "Jordan",                         // Q6, required — first name/nickname
  "cast": {                                 // Q7 — role: name, or null/omitted to skip. Boss slots -- every
                                             // boss is a real person the group knows (see README.md's role
                                             // section); "critic"/"boss" are historical key names for what
                                             // the form now calls The First Boss / The Final Boss.
    "critic": "Bob",                        //   "The First Boss"   -> CONFIG.cast.judge
    "boss": null,                           //   "The Final Boss"   -> CONFIG.cast.authority
    "savior": null,                         //   "The Savior"       -> CONFIG.cast.savior
    "butterfingers": "Morgan",              //   "Butterfingers"    -> CONFIG.cast.butterfingers
    "builder": "Riley"                      //   "The Builder"      -> CONFIG.cast.builder
  },
  "anecdotes": { "butterfingers": "Takes 40 photos of every plate.", "builder": "Builds something every time we hang out." }, // Q8
  "music": { "vibe": "warm", "songFile": null },  // Q9
  "spellings": [ { "from": "Catherine", "to": "Kathryn" } ], // Q10, optional
  "offLimits": [],                          // Q11, optional
  "email": "user@example.com",              // Q12, required — delivery contact only, not part of CONFIG
  "lengthPreset": "five_min"                // optional, defaults to 'five_min' per FULFILLMENT.md
}
```

**Gallery** (`"template": "gallery"`) — swaps `scene`/`stories` for
`targets` (+ two optional boss lines), drops `lengthPreset` entirely
(the gallery has no scene skeleton, no length preset):

```jsonc
{
  "template": "gallery",
  "catchphrase": "THAT'S SO ON BRAND.",     // Q3, required
  "targets": [                              // Q4 (Gallery), required — 4-8 short labels, word for word
    "Fantasy draft speeches", "Spreadsheet at brunch", "The parking incident", "Socks with sandals"
  ],
  "firstBossHeckle": "Your aim is as bad as your takes.",       // optional (Q7's cast section) -- THE FIRST BOSS's heckle line; blank -> gallery/engine.js's own neutral fallback pool
  "finalBossQuirk": "Always adjusts their glasses before lying.", // optional (Q7's cast section) -- THE FINAL BOSS's tell
  "title": "The Weekend League", "host": "Jordan",               // Q5/Q6, required
  "cast": { "critic": "The Commissioner", "boss": "The Landlord", "savior": "...", "butterfingers": "...", "builder": "..." }, // Q7
  "anecdotes": { "...": "..." },            // Q8
  "spriteCast": { "critic": "grandma", "boss": "bandana" },      // optional -- roster keys, see below
  "music": { "vibe": "upbeat" },            // Q9
  "spellings": [], "offLimits": [], "email": "user@example.com" // Q10/Q11/Q12
}
```

**Flight** (`"template": "flight"`) — swaps `scene`/`stories` for
`beats` + `hazards` + `planeColor` (+ the same two optional boss lines
as the gallery, reused for THE FIRST BOSS's heckle / THE FINAL BOSS's
quirk):

```jsonc
{
  "template": "flight",
  "catchphrase": "Somehow we always make it down.",              // Q3, required
  "beats": [                                // Q4 (Flight), required — 3-6 trip legs, IN ORDER, typed case KEPT (not uppercased -- see tools/generate.js's wrapLineKeepCase)
    "The rental shop lost the boot sizes.", "Someone packed shorts instead of snow pants.", "The chairlift stopped for forty minutes."
  ],
  "hazards": [ "The ice patch", "The wrong turn", "The gondola line" ], // Q4 (Flight), required — 2-6 short labels, word for word (uppercased, like gallery targets)
  "planeColor": "blue",                     // Q4 (Flight), optional -- "yellow" (default) | "red" | "blue" | "green"
  "firstBossHeckle": "Pizza, not french fries, rookie.",         // optional (Q7's cast section)
  "finalBossQuirk": "Still mad about the wet boots by the fire.", // optional (Q7's cast section)
  "title": "The Powder Day Crew", "host": "Sam",                 // Q5/Q6, required
  "cast": { "critic": "The Ski Instructor", "boss": "The Lodge Manager", "savior": "...", "butterfingers": "...", "builder": "..." }, // Q7
  "anecdotes": { "...": "..." },            // Q8
  "hostSprite": "skigreen", "spriteCast": { "critic": "skipurple" }, // optional -- roster keys, see below
  "music": { "vibe": "chase" },             // Q9
  "spellings": [], "offLimits": [], "email": "user@example.com" // Q10/Q11/Q12
}
```

`music.vibe` picks one of five **curated 6-track sets** (all of `dinner`/
`boss`/`chase`/`celebration`/`sad`/`gameover`, not just the ambient
`dinner` loop) — `upbeat`, `spy`, `chase`, `warm`, `sincere`. Each set's
`dinner` track is the same headline the vibe has always previewed
(Wacky Waiting / Mission Plausible / Time Driving / Farm Frolics / Sad
Descent, respectively); the other five slots are curated for register
coherence, with `sad`/`gameover` always drawn from a gentle pool
regardless of the set. `CFG_VIBE_TRACK_SETS` in `game/cfgcodec.js` is the
authoritative table (full track list documented in a comment there and in
`assets/audio/CREDITS.txt`). Omitted or unrecognized `music.vibe` no
longer means "today's fixed defaults" — `cfgApplyMusicVibe` picks one of
the five sets deterministically, hashing the order's own `gameId` (never
random at runtime), so a given order always sounds the same across
re-reads but different orders spread across the curated options. This
works identically across all three templates.

`scene` (Hangout only) picks one of the four **story skeletons** — THE
DINNER PARTY (default), THE ROAD TRIP, THE OFFICE PARTY, THE WEDDING
WEEKEND — the engine's own presentation code for that setting
(`game/skeletons.js`): different scenery, props, and mechanic-flavor
strings around the exact same beats and collision geometry. This CLI
passes it straight to `cfgBuildDefaultConfig(root, scene)`, which fills
in that scene's own flavor text (intro lines, the lose line, the "worst"
rank name) as the base every other answer still overrides — no bespoke
per-scene wiring needed here. See `README.md`'s "Story skeletons"
section. The Gallery and the Flight have no `scene` answer at all — their
`cfgBuildDefaultConfig(root, undefined, template)` base is its own
separate, smaller object (see `cfgBuildGalleryDefaultConfig`/
`cfgBuildFlightDefaultConfig`).

`hostSprite`/`spriteCast` (all three templates) are optional
`game/roster.js` keys — "which tile is this person?" (see that file's
~26-entry curated roster). Unset/unrecognized silently no-ops (that
slot keeps its default tile); not part of the historically-required
schema above, every existing answers file keeps working byte-identically
without ever setting these.

## What's automated vs. what still needs a human

**Automated by this CLI**: config assembly (names, content, catchphrase,
title, cast, forbidden words) for whichever template was picked, file
deployment (the right shell shape per template), verification (syntax +
full playthrough + tone gate, via that template's own driver), the
shareable link.

**Still requires a human** (`FULFILLMENT.md` step 2, "content review
gate"): whether an order is actually appropriate to fulfill at all —
doesn't target a non-consenting person, isn't hateful/sexual, isn't
doxxing, doesn't punch down. A tone gate can catch specific forbidden
*words*; it cannot judge whether a story is affectionate ribbing or
something crueler. **Read every free-text answer before delivering.**

**Not attempted**: bespoke, witty, hand-written dialogue per order. The
Hangout's supporting dialogue (critique lines, entrance lines, epilogue
captions, etc.) reuses `cfgBuildDefaultConfig`'s generic-but-complete,
already tone-gate-clean template text — the same content a `#cfg=` link
falls back to for anything a user didn't specify (the Gallery's/Flight's
own neutral fallback pools work the same way for their optional boss
lines). Real per-order wit remains `FULFILLMENT.md`'s hand-authored path
(copy `examples/roadtrip.config.js` as the schema reference, write every
line by hand) — this CLI automates getting a *complete, correct,
deployed, verified* game with zero manual steps; making every line of
dialogue funny for *this specific* group is still a person's job.

## A `FULFILLMENT.md` correction

While wiring up per-order song uploads, this round found that
`FULFILLMENT.md`'s existing note — `customSongPath: 'assets/theme.mp3'`
"relative to the config file's own folder" — undercounts a directory
level. `CONFIG.music.*` paths are fetched relative to the **page** that
loaded them (`games/<slug>/game/index.html` / `intro/index.html`, one
level *below* `games/<slug>/config.js`), not relative to `config.js`
itself — confirmed by how `game/engine.js` actually resolves the string
(a plain `fetch(MUSIC_TRACK_SRC)`, no config-relative base) and by how
`games/test-group/config.js`'s own shared-loop paths are written
(`../../../assets/...`, page-relative). The correct path for a per-order
asset at `games/<slug>/assets/theme.mp3` is `'../assets/theme.mp3'` — one
`../` to climb from `games/<slug>/game/` (or `intro/`) back up to
`games/<slug>/`, then into `assets/`. This CLI uses the corrected path;
`FULFILLMENT.md`'s "Assets" note has been corrected to match. (Uploaded-
song support is Hangout-only today — the Gallery/Flight answer schemas
above have no `music.songFile`.)

## `tools/verify-config.js` / `tools/verify-gallery.js` / `tools/verify-flight.js` on their own

Each is also directly runnable against any existing config of its own
template, generated or hand-written — useful for re-checking a config
after a manual edit, or for a human-operated order that skips the
generator entirely:

```
node tools/verify-config.js games/<slug>/config.js    # Hangout
node tools/verify-gallery.js games/<slug>/config.js    # Gallery
node tools/verify-flight.js games/<slug>/config.js     # Flight
```

Prints PASS/FAIL, which phase the playthrough reached, which roles read
as cast, and every tone-gate/error line — exit code 0 on pass, 1 on
fail (2 on a missing argument). `tools/verify-skeletons.js` (no
arguments — run bare) is the third layer: the scene matrix, the roster
resource/default checks, and — for the Gallery and the Flight — a
full-cast + host-only playthrough off each template's own checked-in
sample plus a fragment round-trip proving `template` and every one of
that template's own fields survive encode/sanitize/decode.

## `game/cfgcodec.js` — reused, not reimplemented

Both the fragment-URL mechanism (every template's own `engine.js`) and
this generator share the exact same `game/cfgcodec.js` for compression,
the CONFIG whitelist schema (now three templates' worth), the neutral
default per template, and the deep merge — see that file's own header
comment for the full design, and `README.md`'s "URL-fragment configs"
section for the player-facing mechanism this CLI's instant links plug
into.
