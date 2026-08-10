# Inside Joke Games

A tiny personalized-game studio: pick your friend group's roles, tell us
your group's real (boring) stories, and get back a playable, shareable
5–10 minute comedy game built around your own inside jokes.

This repo is the **template engine and builder** — one shared game,
entirely driven by a per-order config file (see "How games are added"
below). It ships no game of its own: the bare `/game/` and `/intro/`
pages have no file config (`game/config.js` is a stub) and redirect to
`/build/` unless a `#cfg=` link is present. Every actual game lives either
as a deployed `games/<slug>/` folder or as an instant `#cfg=` link — see
`games/test-group/` for a real, checked-in example.

**▶ Build a game: `/build/`** — once deployed, that's
`https://<this-repo's-pages-domain>/build/`. Locally, see "How to run"
below.

Plays on phones too — open in landscape (portrait shows a rotate prompt);
movement is a floating joystick on the left half of the screen, tap the
right half for the action button.

## What's in the box

- **One shared engine**, two pages: `intro/` (a self-running, skippable
  title cinematic) and `game/` (the playable demo) — built per
  `SPEC-intro.md` and `SPEC-game.md`. Every visible piece of content
  (title, punchline, cast, stories, dialogue, music, and which of six
  optional character roles are even present) comes from a `CONFIG` object,
  not from the engine code itself.
- **`game/config.js`** — a stub (`let CONFIG = null`). The bare `/game/`
  and `/intro/` pages ship no game of their own; see
  `examples/roadtrip.config.js` (fully cast) and
  `examples/test-group.config.js` (degraded) for the real schema
  references instead.
- **`game/skeletons.js`** — the four **story skeletons** (settings): THE
  DINNER PARTY, THE ROAD TRIP, THE OFFICE PARTY, THE WEDDING WEEKEND. See
  "Story skeletons" below.
- **`examples/test-group.config.js`** — a second, intentionally different
  config (different cast, three of six roles left uncast, a shorter length
  preset, no uploaded song) proving the template gracefully handles a much
  smaller cast. Not wired into the shipped pages — it's a reference/testing
  file. `games/test-group/` is this same config, actually deployed, as a
  live worked example of a second game.
- **`games/<slug>/`** — every order's deployed game lives here, one folder
  per order (see "How games are added").
- **`build/`** — the self-serve builder website: a seven-step wizard that
  assembles a config in-browser and hands back an instant playable
  `#cfg=` link (see "URL-fragment configs" below).
- **`INTAKE.md`** — the customer-facing order form content.
- **`FULFILLMENT.md`** — the operator playbook for turning an order into a
  deployed `games/<slug>/`.
- **`SPEC-intro.md` / `SPEC-game.md`** — the full behavioral spec,
  including `SPEC-game.md`'s "Template & roles" section (the `CONFIG`
  schema and the graceful-degradation map for uncast roles).

## How to run

Any static file server pointed at this repo root works — nothing to build,
no npm install:

```
python -m http.server 8809
```

then visit `http://localhost:8809/build/` to build a game, or
`http://localhost:8809/games/test-group/` (the checked-in worked example,
with three of six roles uncast and a shorter runtime). Visiting
`http://localhost:8809/intro/` or `/game/` directly, with no `#cfg=` link,
redirects to `/build/` — there's no file config to play there.

On load you'll see a black boot-gate screen — any key / click / tap /
gamepad button unlocks audio and starts the cinematic. During the
cinematic, Enter / Escape / Space / click / gamepad button skips straight
to the title screen, which attract-loops after 25 seconds idle. PRESS
START launches the game.

Jump straight to a later part of *any real* game (a `games/<slug>/` page,
or `/game/` with a `#cfg=` link already attached) via `game/?start=<value>`
— `dinner` (default), `boss` (skip to the critic fight — only meaningful if
that role is cast), `finalboss` (skip to the chase), `ending` (skip to the
celebration/epilogues/Beat 5), or `techsupport` (skip straight to Beat 5);
an invalid or missing value falls back to `dinner`. These are debug
shortcuts and don't respect role-casting the way normal play does — if a
role's uncast, its `?start=` shortcut just plays with placeholder-free
content missing, so treat these as dev tools, not user-facing links.

## How games are added

**The engine is never duplicated per game.** `game/engine.js` and
`intro/engine.js` are the *entire* game — one copy of each, shared by
every deployed game. Each game folder only ever contains a tiny HTML shell
and its own `config.js`:

```
games/<slug>/
  index.html        redirect to intro/ (same pattern as the repo root)
  config.js          that order's CONFIG -- see examples/roadtrip.config.js for the schema
  intro/index.html   <script src="../config.js"> + <script src="../../../intro/engine.js">
  game/index.html    <script src="../config.js"> + <script src="../../../game/engine.js">
```

`games/test-group/` is exactly this, checked in as a real example — copy
its four files as the starting shell for any new order (see
`FULFILLMENT.md` for the full per-order playbook).

The two `<script src>` lines are the whole mechanism: each per-game page
loads its own sibling `config.js` (so `CONFIG` is a plain global by the
time the engine runs) plus the *one* shared `engine.js` this repo ships —
`../../../game/engine.js` / `../../../intro/engine.js` resolve to the exact
same file the top-level `game/` and `intro/` pages use, no matter how deep
the page that loads it lives. The engine's own (non-personalized) asset
references — the Kenney SFX samples and the dungeon tile sheet, shared by
every game — resolve the same way: `ENGINE_ROOT`, computed once from
`document.currentScript.src` at the top of each engine file, always points
back at this repo's real `assets/`/`intro/assets/` folders regardless of
which page loaded the script. A user's own uploaded song is the one
per-order asset — see `FULFILLMENT.md`'s "Assets" note for where that
lives. There are also two more shared files loaded right alongside
`engine.js` on both page types: `game/cfgcodec.js` (see "URL-fragment
configs" below) and `game/skeletons.js` (see "Story skeletons" below).

## The generator (`tools/`)

`node tools/generate.js <answers.json>` turns an `INTAKE.md` response into
a deployed `games/<slug>/`, automatically: builds the `CONFIG`, refuses to
write anything unless a full headless playthrough and the tone gate both
pass, deploys the shell pages, and prints a shareable link. See
`tools/README.md` for the answers-file schema and exactly what is (and
isn't) automated — the content-review judgment call in `FULFILLMENT.md`
step 2 still needs a human either way.

## URL-fragment configs (self-serve, no deployment needed)

Every game/intro page also understands a `#cfg=<data>` URL fragment as an
alternative to its file `config.js` — appended to `/game/` or `/intro/`
(this repo's own top-level pages, or in principle any page that loads
`game/engine.js`/`intro/engine.js`), it *replaces* the page's CONFIG
entirely for that visit, no `games/<slug>/` folder required at all. This
is what makes an "instant link" possible: `tools/generate.js` prints one
alongside every hosted URL, and the self-serve builder at **`/build/`**
generates one entirely client-side — a seven-step wizard (setting, group,
punchline, stories, role casting, music vibe, preview & share) that
assembles a config in the browser, validates it through the same
whitelist a real link is checked against, and hands back a playable
`#cfg=` link on the spot. The storefront's "Start your order" leads there.

Mechanics, all in `game/cfgcodec.js` (loaded by both engines, and reused
directly by `tools/generate.js` — see that file's own header comment for
the full design):

- **Codec**: a small, self-contained LZW compressor + an unpadded
  URL-safe base64 encoder (no external "lz-string" dependency, not
  bit-compatible with one — it only ever needs to round-trip with
  itself). Handles arbitrary Unicode (emoji included) via UTF-8.
- **Default + merge**: the decoded fragment deep-merges onto
  `cfgBuildDefaultConfig()` — a neutral, fully-populated template, deliberately
  unbranded (see `examples/roadtrip.config.js` for the schema reference
  instead) — so a fragment can supply just a few fields (a host name, a
  punchline) and still get a complete, playable game; anything it doesn't
  specify falls back to generic-but-complete template content.
- **Whitelist validation**: the decoded object is sanitized against an
  explicit schema before it ever touches `CONFIG` — unknown keys are
  dropped, strings/arrays are length-capped, and `music`/`gameId` are
  never fragment-settable at all (no link can ever redirect the engine's
  asset `fetch()` calls at an attacker-chosen URL). An oversized,
  corrupt, or malformed fragment fails closed to the page's own file
  `CONFIG`, silently — never a partial or broken override.
- **Its own save slot**: a fragment-loaded game has no `gameId` of its
  own, so its `localStorage` prefix is derived from a hash of the
  fragment payload instead — the same link always reuses the same save
  data, and two different links never collide.
- The intro↔game page transitions forward `location.hash` so the same
  fragment survives navigating between them.

## The CONFIG schema & role casting

See `SPEC-game.md`'s **"Template & roles"** section for the full schema
and the exact graceful-degradation map. Short version: every game has a
required **HOST** (the player) and up to five optional roles — **Judge**,
**Authority**, **Savior**, **Butterfingers**, **Builder** — each either
cast (a name + a few lines of dialogue) or left out entirely, in which
case that role's beat (and anything narratively downstream of it) is
skipped, and the story still reaches a complete, satisfying ending. That's
the whole product: `games/test-group/` is the proof, with three of the six
roles uncast.

## Story skeletons

Every game is also set in one of four **settings** — pick via `CONFIG.scene`
(`'dinner'` (default) / `'roadtrip'` / `'office'` / `'wedding'`), one field
alongside everything in the "CONFIG schema" section above. THE DINNER
PARTY is the original; THE ROAD TRIP, THE OFFICE PARTY, and THE WEDDING
WEEKEND are the same game re-dressed around a different room.

**The one rule that makes this cheap: skeletons are paint and text, never
gameplay.** All four settings share the exact same collision geometry —
the same center-prop rect, the same four seat positions, the same left
main door, the same elevated boss door, the same top-wall bathroom door,
the same bottom-right "flavor door" rect + glow center. A skeleton
(`game/skeletons.js`) only ever supplies a palette, a handful of draw
functions for that geometry, and a few mechanic-flavor strings (the start
card, the mode-select title/rows) — it never touches a beat, a timing, a
collision rect, or the laugh-token/heart/HUD systems, which stay universal
across every setting. That's also the security invariant: a shared
`#cfg=` link or a generated `games/<slug>/config.js` can only ever *pick*
a skeleton by its enum key (`CFG_FRAGMENT_SCHEMA.scene` in
`game/cfgcodec.js`) — no draw code, asset path, or free string reaches the
engine through this field.

**Authoring a fifth skeleton:** add a new entry to the `SKELETONS` object
in `game/skeletons.js` with the same shape as the existing four
(`palette`, `drawCenterProp`, `drawFlavorDoor`, `drawWallDecor`,
`projectile.draw`, `throwable.draw`, `strings`) — draw only within the
fixed geometry above, keep the pixel-rect art in the same economy as the
existing props (roughly 30 lines per prop), and run every string in it
through the tone gate. Then: add the key to `CFG_SCENE_KEYS`/
`CFG_FRAGMENT_SCHEMA.scene` and (optionally) a `CFG_SCENE_DEFAULTS` text
overlay in `game/cfgcodec.js`, a card to `build/index.html`'s first step,
and a scene matrix entry in `tools/verify-skeletons.js`.

## Assets & credits

All sound effects and music are Kenney (kenney.nl) assets under CC0 — see
`assets/audio/CREDITS.txt` for the exact file-by-file mapping (which sample
became which in-game sound, which loop scores which beat). CC0 means no
attribution is required; it's included anyway.

Character/tile art is Kenney's **Tiny Dungeon**, **Tiny Town**, **Tiny
Farm**, **Tiny Ski**, and **Tiny Battle** packs (`intro/assets/`, CC0,
license copies included — see that folder's own `CREDITS.txt`) — a ~26-
entry curated roster (`game/roster.js`) lets every cast slot and the host
pick a tile that actually looks like the real person (or a non-human pick
— a slime, a cow, a snowman). Everything else (the gift-steak prop,
sparkles, the hand-built pixel title font) is drawn programmatically with
`fillRect` pixel art, no external image files.

The Karplus-Strong jaw-harp "twang" sound and the SpeechSynthesis-spoken
punchline/critiques are the only things still fully synthesized/native —
everything else is a real sample or a real (optionally user-uploaded)
music file.

## Docs map

- `SPEC-intro.md` / `SPEC-game.md` — full behavioral spec, including the
  `CONFIG` schema and role-degradation map.
- `SPEC-skeletons.md` — the story skeletons (settings) spec: the
  paint-and-text rule, the fixed-geometry invariant, and every string
  authored for the four built-in skeletons.
- `INTAKE.md` — the order form.
- `FULFILLMENT.md` — turning an order into a deployed game (now largely
  automated — see "The fast path" at its top).
- `tools/README.md` — the generator CLI's answers-file schema and usage.
