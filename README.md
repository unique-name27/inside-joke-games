# Inside Joke Games

A tiny personalized-game studio: pick your friend group's roles, tell us
your group's real (boring) stories, and get back a playable, shareable
5–10 minute comedy game built around your own inside jokes.

This repo is both the **template engine** (one shared game, entirely
driven by a per-order config file — see "How games are added" below) and
the **flagship game itself**: **Karks Cub Kingdom**, the original, is
config #1 and lives at the repo root.

**▶ Play Karks Cub Kingdom (the flagship): `/intro/`** — once deployed,
that's `https://<this-repo's-pages-domain>/intro/`. Locally, see "How to
run" below.

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
- **`game/config.js`** — Karks Cub Kingdom's own config (config #1). The
  engine plays byte-identically to the original hand-authored build when
  loaded with it.
- **`examples/test-group.config.js`** — a second, intentionally different
  config (different cast, three of six roles left uncast, a shorter length
  preset, no uploaded song) proving the template gracefully handles a much
  smaller cast. Not wired into the shipped pages — it's a reference/testing
  file. `games/test-group/` is this same config, actually deployed, as a
  live worked example of a second game.
- **`games/<slug>/`** — every order's deployed game lives here, one folder
  per order (see "How games are added").
- **`build/`** — the self-serve builder website: a six-step wizard that
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

then visit `http://localhost:8809/intro/` (Karks Cub Kingdom, config #1)
or `http://localhost:8809/games/test-group/` (the second worked example,
with three of six roles uncast and a shorter runtime).

On load you'll see a black boot-gate screen — any key / click / tap /
gamepad button unlocks audio and starts the cinematic. During the
cinematic, Enter / Escape / Space / click / gamepad button skips straight
to the title screen, which attract-loops after 25 seconds idle. PRESS
START launches the game.

Jump straight to a later part of *any* game via `game/?start=<value>` —
`dinner` (default), `boss` (skip to the critic fight — only meaningful if
that role is cast), `aram` (skip to the chase), `ending` (skip to the
celebration/epilogues/Beat 5), or `techsupport` (skip straight to Beat 5);
an invalid or missing value falls back to `dinner`. These are debug
shortcuts and don't respect role-casting the way normal play does — if a
role's uncast, its `?start=` shortcut just plays with placeholder-free
content missing, so treat these as dev tools, not buyer-facing links.

## How games are added

**The engine is never duplicated per game.** `game/engine.js` and
`intro/engine.js` are the *entire* game — one copy of each, shared by
every deployed game. Each game folder only ever contains a tiny HTML shell
and its own `config.js`:

```
games/<slug>/
  index.html        redirect to intro/ (same pattern as the repo root)
  config.js          that order's CONFIG -- see game/config.js for the schema
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
which page loaded the script. A buyer's own uploaded song is the one
per-order asset — see `FULFILLMENT.md`'s "Assets" note for where that
lives. There's also a THIRD shared file, `game/cfgcodec.js`, loaded right
alongside `engine.js` on both page types — see "URL-fragment configs"
below for what it does.

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
generates one entirely client-side — a six-step wizard (group, punchline,
stories, role casting, music vibe, preview & share) that assembles a
config in the browser, validates it through the same whitelist a real
link is checked against, and hands back a playable `#cfg=` link on the
spot. The storefront's "Start your order" leads there.

Mechanics, all in `game/cfgcodec.js` (loaded by both engines, and reused
directly by `tools/generate.js` — see that file's own header comment for
the full design):

- **Codec**: a small, self-contained LZW compressor + an unpadded
  URL-safe base64 encoder (no external "lz-string" dependency, not
  bit-compatible with one — it only ever needs to round-trip with
  itself). Handles arbitrary Unicode (emoji included) via UTF-8.
- **Default + merge**: the decoded fragment deep-merges onto
  `cfgBuildDefaultConfig()` — a neutral, fully-populated template (NOT
  Karks Cub Kingdom's own branding, which stays the *schema* reference in
  `game/config.js`) — so a fragment can supply just a few fields (a host
  name, a punchline) and still get a complete, playable game; anything it
  doesn't specify falls back to generic-but-complete template content.
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

## Assets & credits

All sound effects and music are Kenney (kenney.nl) assets under CC0 — see
`assets/audio/CREDITS.txt` for the exact file-by-file mapping (which sample
became which in-game sound, which loop scores which beat). CC0 means no
attribution is required; it's included anyway.

Character/tile art is Kenney's **Tiny Dungeon** and **Tiny Town** packs
(`intro/assets/`, CC0, license copy included) — everything else (the
chef's toque, the wagyu steak prop, sparkles, the hand-built pixel title
font) is drawn programmatically with `fillRect` pixel art, no external
image files.

The Karplus-Strong jaw-harp "twang" sound and the SpeechSynthesis-spoken
punchline/critiques are the only things still fully synthesized/native —
everything else is a real sample or a real (optionally buyer-uploaded)
music file.

## Docs map

- `SPEC-intro.md` / `SPEC-game.md` — full behavioral spec, including the
  `CONFIG` schema and role-degradation map.
- `INTAKE.md` — the order form.
- `FULFILLMENT.md` — turning an order into a deployed game (now largely
  automated — see "The fast path" at its top).
- `tools/README.md` — the generator CLI's answers-file schema and usage.
