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
lives.

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
- `FULFILLMENT.md` — turning an order into a deployed game.
