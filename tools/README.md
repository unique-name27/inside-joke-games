# tools/ — the generator

Automates turning an `INTAKE.md` response into a deployed game: no manual
config-mapping, no hand-run harness script, no manual tone-gate grep. Zero
npm dependencies — only Node builtins (`fs`, `path`, `crypto`, `vm`).

```
node tools/generate.js <answers.json> [--out=games] [--base-url=https://<pages-domain>]
```

- `<answers.json>` — required. See "The answers schema" below;
  `tools/example-answers.json` is a complete worked example (the same
  content as `examples/test-group.config.js`, expressed as intake
  answers).
- `--out` — output folder, default `games` (so the result lands at
  `games/<slug>/`, exactly `FULFILLMENT.md`'s existing deployment
  location).
- `--base-url` — your GitHub Pages origin (e.g.
  `https://<user>.github.io/inside-joke-games`), used only to print real,
  clickable URLs at the end. Omit it and the script still generates and
  verifies everything — it just prints `<PAGES_DOMAIN>` as a placeholder
  in the two link lines.

## What it does

1. Reads and structurally validates the answers file (missing
   `catchphrase`/`stories`/`title`/`host`/`email` fail fast with a clear
   message — these are `INTAKE.md`'s five required questions).
2. Builds the `CONFIG` object: `game/cfgcodec.js`'s `cfgBuildDefaultConfig()`
   (the same neutral template a shared `#cfg=` link merges onto — see the
   "URL-fragment configs" section of `README.md`) is the base, deep-merged
   with the answers via `cfgDeepMerge` (same codec, reused rather than
   duplicated). Every cast role not answered in Q5 is explicitly left
   `null` (uncast), matching the degradation map.
3. **Verifies before writing anything** — `tools/verify-config.js` runs
   the generated config through: a syntax check, a full headless
   playthrough (Node `vm`, no browser — the same methodology every round
   of this project has used) that drives whatever roles ended up cast all
   the way to the end card, and the tone gate (baseline safety words +
   the config's own `forbiddenWords`, whole-word case-sensitive, plus the
   "FREE" outside "FOR FREE?" rule). **A failing config is never written
   to disk** — the script prints the specific errors and exits non-zero.
4. Writes `games/<slug>/config.js` plus the three shell HTML pages,
   copied fresh off `games/test-group/`'s own current files (not a
   hardcoded template string) with just the `<title>` swapped — the exact
   Phase-C pattern `README.md`'s "How games are added" describes.
5. If `music.songFile` was given, copies it to `games/<slug>/assets/theme.mp3`
   and points `customSongPath` at the correct page-relative path
   (`../assets/theme.mp3` — see "A `FULFILLMENT.md` correction" below).
6. Prints **two** links: the hosted `games/<slug>/` URL (real once
   pushed) and an **instant fragment link** — `/intro/#cfg=<data>` —
   that's playable immediately, no deployment step, using this repo's own
   already-shared engine. "An order can be fulfilled either as a hosted
   folder or an instant link."

## The answers schema

```jsonc
{
  "scene": "dinner",                        // optional, defaults to "dinner" -- "dinner" | "roadtrip" | "office" | "wedding" (see "Story skeletons" in README.md)
  "catchphrase": "FOR FREE?",              // Q1, required
  "stories": ["...", "..."],                // Q2, required — array of 2-4 plain-English sentences, pre-split (one string per story); the generator uppercases + word-wraps each into up to 2 short lines itself
  "title": "The Test Group",                // Q3, required
  "host": "Jordan",                         // Q4, required — first name/nickname
  "cast": {                                 // Q5 — role: name, or null/omitted to skip
    "critic": "Bob",                        //   "The Critic"       -> CONFIG.cast.judge
    "boss": null,                           //   "The Boss"         -> CONFIG.cast.authority
    "savior": null,                         //   "The Savior"       -> CONFIG.cast.savior
    "butterfingers": "Morgan",              //   "Butterfingers"    -> CONFIG.cast.butterfingers
    "builder": "Riley"                      //   "The Builder"      -> CONFIG.cast.builder
  },
  "anecdotes": {                            // Q6 — one per cast role (matching keys above)
    "butterfingers": "Takes 40 photos of every plate.",
    "builder": "Builds something every time we hang out."
  },
  "music": {
    "vibe": "surprise",                     // Q7 — "upbeat" | "spy" | "chase" | "warm" | "sincere" | "surprise" (anything else/omitted behaves like "surprise": no override, stock Wacky Waiting default)
    "songFile": null                        // Q7 — local path to an uploaded song file, or null
  },
  "spellings": [ { "from": "Catherine", "to": "Kathryn" } ], // Q8, optional — literal find/replace over every generated string
  "offLimits": [],                          // Q9, optional — appended to forbiddenWords ON TOP OF the baseline (never replaces it)
  "email": "buyer@example.com",             // Q10, required — delivery contact only, not part of CONFIG
  "lengthPreset": "five_min"                // optional, defaults to 'five_min' per FULFILLMENT.md
}
```

The `music.vibe` → stock-track mapping (used for the `dinner` loop, the
one ambient register not already tied to a specific story beat):
`upbeat`→Wacky Waiting, `spy`→Mission Plausible, `chase`→Time Driving,
`warm`→Farm Frolics, `sincere`→Sad Descent. `boss`/`chase`/`celebration`/
`sad`/`gameover` keep their own beat-specific stock tracks regardless of
vibe — those are tied to a specific in-story moment, not the group's
overall register.

`scene` picks one of the four **story skeletons** — THE DINNER PARTY
(default), THE ROAD TRIP, THE OFFICE PARTY, THE WEDDING WEEKEND — the
engine's own presentation code for that setting (`game/skeletons.js`):
different scenery, props, and mechanic-flavor strings around the exact
same beats and collision geometry. This CLI passes it straight to
`cfgBuildDefaultConfig(root, scene)`, which fills in that scene's own
flavor text (intro lines, the lose line, the "worst" rank name) as the
base every other answer still overrides — no bespoke per-scene wiring
needed here. See README.md's "Story skeletons" section.

## What's automated vs. what still needs a human

**Automated by this CLI**: config assembly (names, stories, catchphrase,
title, cast, forbidden words), file deployment, verification (syntax +
full playthrough + tone gate), the shareable link.

**Still requires a human** (`FULFILLMENT.md` step 2, "content review
gate"): whether an order is actually appropriate to fulfill at all —
doesn't target a non-consenting person, isn't hateful/sexual, isn't
doxxing, doesn't punch down. A tone gate can catch specific forbidden
*words*; it cannot judge whether a story is affectionate ribbing or
something crueler. **Read every free-text answer before delivering.**

**Not attempted**: bespoke, witty, hand-written dialogue per order. The
supporting dialogue for each cast role (critique lines, entrance lines,
epilogue captions, etc.) reuses `cfgBuildDefaultConfig`'s generic-but-
complete, already tone-gate-clean template text — the same content a
`#cfg=` link falls back to for anything a buyer didn't specify. Real
per-order wit remains `FULFILLMENT.md`'s hand-authored path (copy
`game/config.js` as the schema reference, write every line by hand) —
this CLI automates getting a *complete, correct, deployed, verified*
game with zero manual steps; making every line of dialogue funny for
*this specific* group is still a person's job.

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
`FULFILLMENT.md`'s "Assets" note has been corrected to match.

## `tools/verify-config.js` on its own

Also directly runnable against any existing config, generated or
hand-written — useful for re-checking a config after a manual edit, or
for a human-operated order that skips the generator entirely
(`FULFILLMENT.md`'s original workflow):

```
node tools/verify-config.js games/<slug>/config.js
```

Prints PASS/FAIL, which phase the playthrough reached, which roles read
as cast, and every tone-gate/error line — exit code 0 on pass, 1 on
fail (2 on a missing argument).

## `game/cfgcodec.js` — reused, not reimplemented

Both the fragment-URL mechanism (`game/engine.js`/`intro/engine.js`) and
this generator share the exact same `game/cfgcodec.js` for compression,
the CONFIG whitelist schema, the neutral default template, and the deep
merge — see that file's own header comment for the full design, and
`README.md`'s "URL-fragment configs" section for the player-facing
mechanism this CLI's instant links plug into.
