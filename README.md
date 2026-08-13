# Inside Joke Games

A tiny personalized-game studio: pick the shape of your group's inside
joke, tell us your group's real (boring) stories, and get back a
playable, shareable comedy game built around your own people and your
own words.

This repo is the **template engine and builder** — a small catalog of
game *styles* (see "What's the joke?" below), each entirely driven by a
per-order config file (see "How games are added" below). No template
ships a game of its own out of the box: every bare template page has no
file config and redirects to `/build/` unless a `#cfg=` link is present.
Every actual game lives either as a deployed `games/<slug>/` folder or as
an instant `#cfg=` link — see `games/test-group/`, `games/gallery-sample/`,
and `games/flight-sample/` for real, checked-in examples, one per
template.

**▶ Build a game: `/build/`** — once deployed, that's
`https://<this-repo's-pages-domain>/build/`. Locally, see "How to run"
below.

Plays on phones too — open in landscape (portrait shows a rotate prompt).

## What's the joke?

Every inside joke has a shape, and the shape picks the game — that's the
question the builder opens with, before anything else. Five templates
ship today:

- **The Hangout** — *a place you always end up + the stories you
  retell.* A dinner table / road trip / office party / wedding weekend
  (four interchangeable settings, see "Story skeletons" below), the
  original template. Two pages (`game/` + `intro/`). See
  `SPEC-intro.md` / `SPEC-game.md`.
- **The Gallery** — *the things your group can't stop roasting.* A
  carnival shooting stall; their roastables are the targets, word for
  word. One page (`gallery/`). See `SPEC-gallery.md`.
- **The Flight** — *a disaster trip you keep retelling.* A one-button
  flappy-style run; their trip becomes the level, their hazards label
  the gates. One page (`flight/`). See `SPEC-flight.md`.
- **The Defense** — *a recurring annoyance the group defends against.*
  A one-screen tower defense; every cast member stands as a tower doing
  their personality, the waves are the group's own annoyances, word for
  word. One page (`defense/`). See `SPEC-defense.md`.
- **The Mission** — *us against the world.* A vertical squadron shmup;
  the whole cast flies in formation, the enemy swarms are whatever the
  group is up against, and the boss fleet beams the bosses' own lines
  across the screen between volleys. One page (`mission/`). See
  `SPEC-mission.md`.

`SPEC-game-styles.md` is the full catalog, including the templates not
built yet (a longer second-wave list) and
the invariants every template — built or future — has to hold.

## What's in the box

- **`shared/framework.js`** — the subsystems every template shares:
  fitCanvas/DPR/mobile/rotate-prompt, the input layer (keyboard/touch
  joystick/gamepad → move vector + action + pointer events), the audio
  core (sample SFX, the music-set player, ducking, the SpeechSynthesis
  wrapper), the card/tutorial system, typewriter speech bubbles,
  particle helpers, storage helpers, and the chunky/reading text
  renderers. Every template's own `engine.js` loads this ONE file (a
  plain classic `<script>`, before the engine's own — all scripts on a
  page share one global scope) and builds its own game on top of it —
  see that file's own header comment for exactly what deliberately
  stayed local to each engine, and why.
- **`game/` + `intro/`** — THE HANGOUT: a self-running, skippable title
  cinematic (`intro/`) and the playable demo (`game/`), built per
  `SPEC-intro.md` / `SPEC-game.md`. The four-file deploy shape — see
  "How games are added" below.
- **`gallery/`** — THE GALLERY engine + page: a single page, no
  separate intro (a short attract/title screen lives inside
  `gallery/engine.js` itself) — see `SPEC-gallery.md`.
- **`flight/`** — THE FLIGHT engine + page: the same single-page shape
  as the gallery — see `SPEC-flight.md`.
- **`defense/`** — THE DEFENSE engine + page: same single-page shape —
  see `SPEC-defense.md`.
- **`mission/`** — THE MISSION engine + page: same single-page shape —
  see `SPEC-mission.md`.
- **`game/config.js` / `gallery/config.js` / `flight/config.js` /
  `defense/config.js` / `mission/config.js`** —
  each a stub (`let CONFIG = null`). None of the bare template pages
  ship a game of their own; see `examples/roadtrip.config.js` (Hangout,
  fully cast), `examples/test-group.config.js` (Hangout, degraded),
  `examples/gallery-sample.config.js` (Gallery),
  `examples/flight-sample.config.js` (Flight),
  `examples/defense-sample.config.js` (Defense), and
  `examples/mission-sample.config.js` (Mission) for the real schema
  references instead.
- **`game/skeletons.js`** — the four Hangout **story skeletons**
  (settings): THE DINNER PARTY, THE ROAD TRIP, THE OFFICE PARTY, THE
  WEDDING WEEKEND. Hangout-only — no other template has a scene
  skeleton of its own. See "Story skeletons" below.
- **`game/roster.js`** — the shared character roster (Phase C): which
  Tiny-family tile a cast slot (or the host) can be pointed at, so a
  cast can actually look like the real people. Framework-level — every
  template draws from it.
- **`game/cfgcodec.js`** — the shared CONFIG codec: compression, the
  whitelist schema (now five templates' worth), the neutral default
  per template, and the deep merge. See "URL-fragment configs" below.
- **`examples/test-group.config.js`** — a second, intentionally
  different Hangout config (different cast, three of six roles left
  uncast, a shorter length preset, no uploaded song) proving the
  template gracefully handles a much smaller cast. Not wired into the
  shipped pages — it's a reference/testing file. `games/test-group/` is
  this same config, actually deployed, as a live worked example.
- **`games/<slug>/`** — every order's deployed game lives here, one
  folder per order (see "How games are added").
- **`build/`** — the self-serve builder website: a "What's the joke?"
  first step picks the template, then a per-template step sequence
  (see "URL-fragment configs" below) assembles a config in-browser and
  hands back an instant playable `#cfg=` link.
- **`INTAKE.md`** — the customer-facing order form content.
- **`FULFILLMENT.md`** — the operator playbook for turning an order into
  a deployed `games/<slug>/`.
- **`SPEC-game-styles.md`** — the template catalog (built + future) and
  the invariants every template holds.
- **`SPEC-intro.md` / `SPEC-game.md`** — THE HANGOUT's full behavioral
  spec, including "Template & roles" (the `CONFIG` schema and the
  graceful-degradation map for uncast roles).
- **`SPEC-gallery.md`** — THE GALLERY's full behavioral spec.
- **`SPEC-flight.md`** — THE FLIGHT's full behavioral spec.
- **`SPEC-defense.md`** — THE DEFENSE's full behavioral spec.
- **`SPEC-skeletons.md`** — the story skeletons (Hangout-only settings)
  spec.
- **`SPEC-their-game.md`** — the founding directive this whole
  multi-template direction (and the Music/Roster/Skeletons/Templates
  phases below it) grew out of.

## How to run

Any static file server pointed at this repo root works — nothing to
build, no npm install:

```
python -m http.server 8809
```

then visit `http://localhost:8809/build/` to build a game, or any of
the checked-in worked examples: `http://localhost:8809/games/test-group/`
(Hangout, three of six roles uncast), `http://localhost:8809/games/gallery-sample/`
(Gallery, fully cast), `http://localhost:8809/games/flight-sample/`
(Flight, fully cast), `http://localhost:8809/games/defense-sample/`
(Defense, fully cast), and `http://localhost:8809/games/mission-sample/`
(Mission, fully cast). Visiting a bare template page directly (`/game/`,
`/intro/`, `/gallery/`, `/flight/`, `/defense/`, `/mission/`) with no
`#cfg=` link redirects to `/build/` — there's no file config to play there.

On load you'll see a black boot-gate screen — any key / click / tap /
gamepad button unlocks audio and starts things off (the Hangout's
cinematic; every other template's own in-page title screen). PRESS
START / SPACE / tap launches the game.

Jump straight to a later part of a *Hangout* game (a `games/<slug>/`
page, or `/game/` with a `#cfg=` link already attached) via
`game/?start=<value>` — `dinner` (default), `boss` (skip to the critic
fight — only meaningful if that role is cast), `finalboss` (skip to the
chase), `ending` (skip to the celebration/epilogues/Beat 5), or
`techsupport` (skip straight to Beat 5); an invalid or missing value
falls back to `dinner`. These are debug shortcuts and don't respect
role-casting the way normal play does — if a role's uncast, its
`?start=` shortcut just plays with placeholder-free content missing, so
treat these as dev tools, not user-facing links. No other template has
`?start=` shortcuts (single-screen games, nothing to skip to).

## How games are added

**The engine is never duplicated per game.** Every template's own
`engine.js` (`game/engine.js` + `intro/engine.js` for the Hangout;
`gallery/engine.js`; `flight/engine.js`; `defense/engine.js`;
`mission/engine.js`) is the *entire* game for that
template — one copy of each, shared by every deployed game that uses
it. Each game folder only ever contains a tiny HTML shell (or two) and
its own `config.js`.

**THE HANGOUT — 4 files** (two pages, an intro + the game):

```
games/<slug>/
  index.html        redirect to intro/ (same pattern as the repo root)
  config.js          that order's CONFIG -- see examples/roadtrip.config.js for the schema
  intro/index.html   <script src="../config.js"> + <script src="../../../intro/engine.js">
  game/index.html    <script src="../config.js"> + <script src="../../../game/engine.js">
```

`games/test-group/` is exactly this, checked in as a real example — copy
its four files as the starting shell for a new Hangout order (see
`FULFILLMENT.md` for the full per-order playbook).

**THE GALLERY / THE FLIGHT / THE DEFENSE / THE MISSION — 2 files** (a
single page, no separate intro):

```
games/<slug>/
  config.js    that order's CONFIG -- see examples/<template>-sample.config.js
  index.html   config.js -> ../../game/roster.js -> ../../game/cfgcodec.js -> ../../shared/framework.js -> ../../<template>/engine.js
```

`games/gallery-sample/`, `games/flight-sample/`, `games/defense-sample/`,
and `games/mission-sample/` are exactly this, checked in as real
examples — `tools/generate.js` deploys either shape automatically
depending on the order's `template` answer (see "The generator" below).

The `<script src>` lines are the whole mechanism: each per-game page
loads its own sibling `config.js` (so `CONFIG` is a plain global by the
time the engine runs) plus the *one* shared engine file the relevant
template ships — resolving to the exact same file the top-level
template page uses, no matter how deep the page that loads it lives.
Every engine's own (non-personalized) asset references — the Kenney SFX
samples, the roster tile sheets, and each template's own art pack —
resolve the same way: `ENGINE_ROOT`, computed once from
`document.currentScript.src` at the top of each engine file, always
points back at this repo's real `assets/` folders regardless of which
page loaded the script. A user's own uploaded song is the one per-order
asset (Hangout only today — see `FULFILLMENT.md`'s "Assets" note for
where that lives).

## The generator (`tools/`)

`node tools/generate.js <answers.json>` turns an `INTAKE.md` response
into a deployed `games/<slug>/`, automatically, for whichever template
the order picked: builds the `CONFIG`, refuses to write anything unless
a full headless playthrough (that template's own driver) and the tone
gate both pass, deploys the right shell shape (four files for Hangout,
two for any other template), and prints a shareable link. See
`tools/README.md` for the answers-file schema and exactly what is (and
isn't) automated — the content-review judgment call in `FULFILLMENT.md`
step 2 still needs a human either way.

## URL-fragment configs (self-serve, no deployment needed)

Every template page understands a `#cfg=<data>` URL fragment as an
alternative to its file `config.js` — appended to that template's own
top-level page (`/game/` or `/intro/` for the Hangout, `/gallery/`,
`/flight/`, `/defense/`, `/mission/` — this repo's own top-level pages, or in principle any page
that loads the matching `engine.js`), it *replaces* the page's CONFIG
entirely for that visit, no `games/<slug>/` folder required at all.
This is what makes an "instant link" possible: `tools/generate.js`
prints one alongside every hosted URL, and the self-serve builder at
**`/build/`** generates one entirely client-side — a "What's the joke?"
first step (always step 1, whichever template you end up on), then a
per-template step sequence:

- **THE HANGOUT** (8 steps): joke, setting, group, punchline, stories,
  cast, vibe, preview & share.
- **THE GALLERY** (7 steps): joke, group, punchline, targets, cast,
  vibe, preview & share.
- **THE FLIGHT** (7 steps): joke, group, punchline, trip, cast, vibe,
  preview & share.
- **THE DEFENSE** (7 steps): joke, group, punchline, annoyance, cast,
  vibe, preview & share.
- **THE MISSION** (7 steps): joke, group, punchline, mission, cast,
  vibe, preview & share.

Every sequence assembles a config in the browser, validates it through
the same whitelist a real link is checked against, and hands back a
playable `#cfg=` link on the spot. The storefront's "Build your game"
leads there.

Mechanics, all in `game/cfgcodec.js` (loaded by every engine, and reused
directly by `tools/generate.js` — see that file's own header comment for
the full design):

- **Codec**: a small, self-contained LZW compressor + an unpadded
  URL-safe base64 encoder (no external "lz-string" dependency, not
  bit-compatible with one — it only ever needs to round-trip with
  itself). Handles arbitrary Unicode (emoji included) via UTF-8.
- **Default + merge**: the decoded fragment deep-merges onto
  `cfgBuildDefaultConfig()` — a neutral, fully-populated template per
  `template` pick (absent → the Hangout's own, deliberately unbranded —
  see `examples/roadtrip.config.js` for the schema reference instead;
  `'gallery'`/`'flight'`/`'defense'` each dispatch to their own smaller,
  separate base object) — so a fragment can supply just a few fields (a host
  name, a punchline) and still get a complete, playable game; anything
  it doesn't specify falls back to generic-but-complete template
  content.
- **Whitelist validation**: the decoded object is sanitized against an
  explicit schema before it ever touches `CONFIG` — unknown keys are
  dropped, strings/arrays are length-capped, and `music`/`gameId`/any
  path are never fragment-settable at all (no link can ever redirect
  the engine's asset `fetch()` calls at an attacker-chosen URL).
  `template` itself is a whitelisted enum (`'hangout'` / `'gallery'` /
  `'flight'` / `'defense'` / `'mission'`, append-only) — an unrecognized value sanitizes away
  entirely, falling back to the Hangout, same as an absent one always
  has. An oversized, corrupt, or malformed fragment fails closed to the
  page's own file `CONFIG`, silently — never a partial or broken
  override.
- **Its own save slot**: a fragment-loaded game has no `gameId` of its
  own, so its `localStorage` prefix is derived from a hash of the
  fragment payload instead — the same link always reuses the same save
  data, and two different links never collide.
- The Hangout's intro↔game page transitions forward `location.hash` so
  the same fragment survives navigating between them (every other
  template is a single page, so this doesn't apply to them).

## The CONFIG schema & role casting

See `SPEC-game.md`'s **"Template & roles"** section for the Hangout's
full schema and the exact graceful-degradation map (`SPEC-gallery.md`/
`SPEC-flight.md`/`SPEC-defense.md` for the others'). Short version, true
across all five templates: every game has a required **HOST** (the
player) and up to five optional roles — **THE FIRST BOSS** (`judge`),
**THE FINAL BOSS** (`authority`), **THE SAVIOR**, **BUTTERFINGERS**,
**THE BUILDER** — each either cast (a name + a few lines of dialogue /
a flavor anecdote) or left out entirely, in which case that role's beat
(and anything narratively downstream of it) is skipped, and the story
still reaches a complete, satisfying ending. `template` itself is a
top-level `CONFIG` field (a whitelisted enum, absent → `'hangout'`) —
see `game/cfgcodec.js`'s `CFG_TEMPLATE_KEYS`. That's the whole product:
`games/test-group/`, and the host-only degradation checks in every
template's own verify suite, are the proof.

## Story skeletons

Hangout-only (no other template has a scene skeleton). Every
Hangout game is set in one of four **settings** — pick via
`CONFIG.scene` (`'dinner'` (default) / `'roadtrip'` / `'office'` /
`'wedding'`), one field alongside everything in the "CONFIG schema"
section above. THE DINNER PARTY is the original; THE ROAD TRIP, THE
OFFICE PARTY, and THE WEDDING WEEKEND are the same game re-dressed
around a different room.

**The one rule that makes this cheap: skeletons are paint and text,
never gameplay.** All four settings share the exact same collision
geometry — the same center-prop rect, the same four seat positions, the
same left main door, the same elevated boss door, the same top-wall
bathroom door, the same bottom-right "flavor door" rect + glow center.
A skeleton (`game/skeletons.js`) only ever supplies a palette, a
handful of draw functions for that geometry, and a few mechanic-flavor
strings (the start card, the mode-select title/rows) — it never touches
a beat, a timing, a collision rect, or the laugh-token/heart/HUD
systems, which stay universal across every setting. That's also the
security invariant: a shared `#cfg=` link or a generated
`games/<slug>/config.js` can only ever *pick* a skeleton by its enum
key (`CFG_FRAGMENT_SCHEMA.scene` in `game/cfgcodec.js`) — no draw code,
asset path, or free string reaches the engine through this field.

**Authoring a fifth skeleton:** add a new entry to the `SKELETONS`
object in `game/skeletons.js` with the same shape as the existing four
(`palette`, `drawCenterProp`, `drawFlavorDoor`, `drawWallDecor`,
`projectile.draw`, `throwable.draw`, `strings`) — draw only within the
fixed geometry above, keep the pixel-rect art in the same economy as
the existing props (roughly 30 lines per prop), and run every string in
it through the tone gate. Then: add the key to `CFG_SCENE_KEYS`/
`CFG_FRAGMENT_SCHEMA.scene` and (optionally) a `CFG_SCENE_DEFAULTS` text
overlay in `game/cfgcodec.js`, a card to `build/index.html`'s setting
step, and a scene matrix entry in `tools/verify-skeletons.js`.

## Authoring a new template

Adding a whole new template (see `SPEC-game-styles.md`'s catalog for
candidates — the second-wave list, further out) is a bigger
lift than a fifth skeleton — it's a new GAME, not a new room — but the
checklist is fixed now, proven four times (The Gallery, The Flight,
The Defense, then The Mission):

1. **Spec it.** Write `SPEC-<name>.md` — the game, the cast mapping
   (graceful degradation for every optional role, uncast = skip, no
   substitutes), the catchphrase mechanic, the modes if any,
   determinism (every random pick seeded off `gameId`, never
   `Math.random`), and a "Config / codec / wizard" section — model it
   on `SPEC-gallery.md`/`SPEC-flight.md`/`SPEC-defense.md`, which exist
   precisely so the next template doesn't have to invent this shape from
   scratch.
2. **Build the engine on `shared/framework.js`.** A single page, no
   separate intro (unless the joke shape genuinely needs one) —
   `<name>/engine.js` + `<name>/index.html` + `<name>/config.js` (a
   `let CONFIG = null` stub). Mirror the existing single-page engines'
   conventions (`gallery/`, `flight/`, `defense/`, `mission/`): `ENGINE_ROOT` from
   `document.currentScript.src`, the fragment-or-redirect boot with the
   template key passed as `cfgBuildDefaultConfig`'s third argument PLUS
   a defensive `if(!CONFIG.<name>)` guard, local `CW`/`CH` (`CW` must
   stay 960 — the shared volume-icon layout depends on it) + an eager
   `fitCanvas()` call right after, `STORAGE_PREFIX`, seeded RNG via
   `cfgHashString` + `mulberry32`, and `setBeatMusic('dinner')` at boot
   (skip that last one and the template plays silent).
3. **Codec.** In `game/cfgcodec.js`: append the new key to
   `CFG_TEMPLATE_KEYS` (append-only — never reorder
   `CFG_FRAGMENT_SCHEMA`'s existing keys, that order is the music-seed
   hash's own stability guarantee); define `CFG_<NAME>_SCHEMA` and add
   `<name>: cfgObj(CFG_<NAME>_SCHEMA)` to `CFG_FRAGMENT_SCHEMA`; write
   `cfgBuild<Name>DefaultConfig(engineRoot)` modeled on
   `cfgBuildGalleryDefaultConfig`/`cfgBuildFlightDefaultConfig`/
   `cfgBuildDefenseDefaultConfig`/`cfgBuildMissionDefaultConfig`
   (its own small base object, not an overlay on the Hangout's) and add
   the dispatch line in `cfgBuildDefaultConfig`. The absent-template
   Hangout object must stay byte-identical — every existing scene-
   matrix/round-trip check in `tools/verify-skeletons.js` is the proof.
4. **Wizard.** In `build/index.html`: a `JOKE_DEFS` card (joke stays
   index 0 of every step sequence — hard invariant); a
   `<NAME>_STEP_KEYS` sequence; the template's own content step;
   `<name>Field`/`<name>Desc` on the boss role cards if the template
   wants boss lines (same mechanism as `galleryField`/`flightField`/
   `defenseField`/`missionField`); a
   branch in `buildOverridesFromState`; `normalizeWizardState`
   migration for old drafts (defaults, caps, step bounds); a
   review-card row with `showFor:['<name>']`; the preview step's
   required-content gate + the off-limits check extended over the new
   fields; play/share both pointing at `../<name>/#cfg=...`.
5. **`tools/generate.js`.** An `is<Name>` branch in `buildOverrides`
   (required content fields validated the same way the existing
   single-page templates' already are); `engineRoot = '../../'` (single
   page, 2-deep); the two-file shell deploy via
   `safeReplace()` (never a blind `.replace()` chain — a template-string
   mismatch between the deploy code and the real `<name>/index.html`
   has to fail loudly at generate time, not silently ship a shell
   pointed at the wrong engine/config paths); a verifier dispatch to
   the new template's own `verify<Name>Source`; the hosted +
   `/<name>/#cfg=` links in the printed output.
6. **Verify driver.** `tools/verify-<name>.js`, house driver
   style: reuse `tools/lib/sandbox.js` + `tools/verify-config.js`'s
   `toneGateSource`; a PROBE that reads the engine's OWN state/data (no
   duplicated literals — re-typing a row/gap position outside the
   engine, rather than reading it off the running sandbox, is the
   anti-pattern every template driver has been told not to repeat); a
   bang-bang or otherwise-deterministic autopilot; asserts a full-cast
   attentive playthrough reaches the end card, a host-only degraded
   playthrough does too, and the catchphrase mechanic actually fires
   with the right side effects (no heart lost, whatever it's supposed
   to clear/win, a flag the driver can read).
7. **`tools/verify-skeletons.js`.** Add the new template's groups
   beside the existing ones: full-cast + host-only playthroughs off a
   checked-in sample, plus a round-trip proving `template:'<name>'` and
   every one of its own fields survive encode/sanitize/decode.
8. **Sample + example.** `examples/<name>-sample.config.js`
   (hand-authored, fully cast, commented like the existing samples) +
   `tools/<name>-sample-answers.json` (the same content, expressed as
   intake answers) + `node tools/generate.js
   tools/<name>-sample-answers.json --slug=<name>-sample` to produce
   the checked-in `games/<name>-sample/` — the generator's output is
   canonical; reconcile any hand-built version to match it (same as
   this repo did for Flight).
9. **Docs.** `README.md` (this section's own list — add the new
   template everywhere the existing ones appear), `tools/README.md`'s
   answers schema, `INTAKE.md`'s Q1 + content question, `FULFILLMENT.md`'s
   per-template branch, the storefront copy (`index.html`,
   `example/index.html`), and mark the template built in
   `SPEC-game-styles.md`'s catalog table.

## Assets & credits

All sound effects and music are Kenney (kenney.nl) assets under CC0 — see
`assets/audio/CREDITS.txt` for the exact file-by-file mapping (which sample
became which in-game sound, which loop scores which beat). CC0 means no
attribution is required; it's included anyway. Each template's own art
pack has its own credits file: `assets/gallery/CREDITS.txt` (Kenney's
Shooting Gallery pack), `assets/flight/CREDITS.txt` (Kenney's Tappy
Plane pack), and `assets/defense/CREDITS.txt` (Kenney's Tower Defense
pack, with the exact tile-number mapping), and
`assets/mission/CREDITS.txt` (Kenney's Space Shooter Remastered pack)
alongside `intro/assets/CREDITS.txt` (the Hangout's roster tile sheets,
shared by every template).

Character/tile art is Kenney's **Tiny Dungeon**, **Tiny Town**, **Tiny
Farm**, **Tiny Ski**, and **Tiny Battle** packs (`intro/assets/`, CC0,
license copies included — see that folder's own `CREDITS.txt`) — a ~26-
entry curated roster (`game/roster.js`) lets every cast slot and the host
pick a tile that actually looks like the real person (or a non-human pick
— a slime, a cow, a snowman). Framework-level: every template draws from
the same roster. Everything else (the gift-steak prop, sparkles, the
hand-built pixel title font, each template's own small procedural props —
see e.g. `gallery/engine.js`'s PLATE_ROWS/PLUSH_ROWS or `flight/engine.js`'s
HEART_ROWS/PHONE_ROWS) is drawn programmatically with `fillRect` pixel
art, no external image files.

The Karplus-Strong jaw-harp "twang" sound and the SpeechSynthesis-spoken
punchline/critiques are the only things still fully synthesized/native —
everything else is a real sample or a real (optionally user-uploaded,
Hangout-only today) music file.

## Docs map

- `SPEC-game-styles.md` — the template catalog (built + future) and the
  invariants every template holds.
- `SPEC-their-game.md` — the founding directive (Music/Roster/Skeletons/
  Templates phases) this whole multi-template direction grew out of.
- `SPEC-intro.md` / `SPEC-game.md` — THE HANGOUT's full behavioral spec,
  including the `CONFIG` schema and role-degradation map.
- `SPEC-gallery.md` — THE GALLERY's full behavioral spec.
- `SPEC-flight.md` — THE FLIGHT's full behavioral spec.
- `SPEC-defense.md` — THE DEFENSE's full behavioral spec.
- `SPEC-mission.md` — THE MISSION's full behavioral spec.
- `SPEC-skeletons.md` — the story skeletons (Hangout-only settings)
  spec: the paint-and-text rule, the fixed-geometry invariant, and every
  string authored for the four built-in skeletons.
- `INTAKE.md` — the order form.
- `FULFILLMENT.md` — turning an order into a deployed game (now largely
  automated — see "The fast path" at its top).
- `tools/README.md` — the generator CLI's answers-file schema and usage,
  per template.
