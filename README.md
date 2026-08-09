# Karks Cub Kingdom

**▶ Play it: https://unique-name27.github.io/karks-cub-kingdom/**

Plays on phones too — open the link in landscape (portrait shows a rotate
prompt); movement is a floating joystick on the left half of the screen, tap
the right half for the action button.

Jump straight to a later part of the game via `game/?start=<value>` —
`dinner` (default), `boss` (skip to the critic fight), `aram` (skip to the
chase), `ending` (skip to Aram turning good, then the celebration/epilogues/
Beat 5 play out normally), or `techsupport` (skip straight to Beat 5); an
invalid or missing value falls back to `dinner`.

A Zelda-style (SNES-era) comedy game where the player is Chef Gabe, whose only
weapon is the punchline "FOR FREE?". The repo has two pieces:

- `intro/` — a self-running, skippable ~50-second title cinematic, built per
  `SPEC-intro.md`. Its title screen's PRESS START launches the game.
- `game/` — the playable demo (punchline rounds → heart capture → the critic
  boss fight → fake death → wagyu resurrection → unison finale → end card),
  built per `SPEC-game.md`. It reuses `intro/assets/` and the intro's
  palette/pixel-helper/audio-engine style.

The root `index.html` is a meta-refresh redirect to `intro/`.

This section covers the intro; see `## The game` below for `game/index.html`.

Everything is a single self-contained HTML file: `intro/index.html`. All CSS
and JS are inline; sound effects are synthesized live with WebAudio (no audio
files) and the background music is a real looping track
(`assets/music/theme.mp3`) routed through the same WebAudio graph via
`createMediaElementSource` (falls back to the original synthesized chiptune
score automatically if the track can't load). All art is either a
recolored/cropped Kenney tile or drawn programmatically with `fillRect` pixel
art (toque, steak, knife, sparkles, the hand-built KARKS CUB KINGDOM title
font). No build step, no external libraries, no CDN — it just needs to be
served over HTTP (not opened as a `file://` URL, since it loads the tile PNGs
via `fetch`-style `<img>` requests).

## How to run

Launch the `for-free-rpg` preview config (serves this repo root) and open:

```
http://localhost:8807/intro/
```

If you're running it manually instead, any static file server pointed at
this repo root works, e.g.:

```
python -m http.server 8807
```

then visit `http://localhost:8807/intro/`.

On load you'll see a black boot-gate screen ("PRESS ANY BUTTON"). Any
key / click / tap / gamepad button unlocks audio and starts the cinematic.
During the cinematic, Enter / Escape / Space / click / gamepad button skips
straight to the title screen. The title screen attract-loops (replays the
whole cinematic) after 25 seconds of idle input.

## Record mode

Visit `http://localhost:8807/intro/?record=1` instead. After the boot-gate
click, the page captures the canvas (`captureStream(60)`) plus the master
audio bus into a `MediaRecorder` and automatically downloads
`for-free-intro.webm` once it has recorded from Scene 1 through the 4th
second of Scene 5 (~44 seconds total). Skip input is ignored while recording
so the capture is always the full, deterministic cinematic. There is no UI
chrome anywhere in the app (even the boot gate is drawn on-canvas), so the
recording is pure canvas content.

## Assets

Kenney assets (CC0) copied into `intro/assets/`:

- `tiny_town.png` — from Kenney **Tiny Town** (`Tilemap/tilemap_packed.png`),
  used for the Scene 1 rooftop skyline silhouette.
- `tiny_dungeon.png` — from Kenney **Tiny Dungeon**
  (`Tilemap/tilemap_packed.png`), used for interior wall/floor tiles and the
  small 16px character sprites (chef + diners) from the bottom rows of the
  sheet.
- `KENNEY-LICENSE.txt` — Kenney's CC0 license text, copied from the Tiny Town
  pack (identical boilerplate across Kenney packs).

Both `_packed.png` sheets are tightly packed (no gap between tiles, 16px
grid, 12×11 tiles) — the code's tile-lookup math accounts for that (no
inter-tile spacing).

Everything else (chef's toque, wagyu steak, knife, sparkles, the hand-built
5×7-grid "KARKS CUB KINGDOM" title lettering, the speech bubble, table props) is drawn
programmatically with `fillRect` pixel art on the same 16px-grid aesthetic,
per the spec.

## Notes / minor spec interpretations

A few small, deliberate calls made where the spec described intent but not
exact mechanics:

- **Diner "facing up/down"**: the Tiny Dungeon sheet only has one pose per
  character, so "facing up" diners are the same sprite drawn vertically
  flipped rather than unique back-facing art.
- **Scene 4 chef pose**: the sheet has no "arms raised" frame, so the
  item-get pose is the normal idle sprite plus the toque and a separately
  drawn wagyu steak prop held above the head with an orbiting sparkle ring.
- **Scene 4 spotlight**: implemented as stepped, semi-transparent concentric
  pixel-circle bands rather than a canvas gradient, so the doorway glow in
  Scene 2 stays the only `createRadialGradient` in the whole piece, per spec.
- **Title knife**: drawn as a staircase of axis-aligned rectangles rather
  than via `ctx.rotate()`, so its edges stay pixel-crisp with smoothing off.
- Typewriter speed (20 chars/sec, beep every 2nd revealed character) and the
  internal sub-timing within each scene (e.g. exactly when the Scene 3 bubble
  starts growing, when the silence beat begins) were chosen to comfortably
  fit the content inside each scene's spec'd time window; the spec gives
  content and beat-sync points but not a literal per-character rate.
- Skipping the cinematic also force-unlocks the drum layer, so the title
  screen always loops with full instrumentation even if you skip before
  reaching Scene 3's slam (where drums normally unlock).

Kenney assets used under CC0 — https://kenney.nl.

## The game (`game/index.html`)

Same technical base as the intro: single file, canvas 960×540, pixel-crisp,
WebAudio-only sound, `../intro/assets/` reused for the dungeon tile sheet.
Open `http://localhost:8807/game/` directly, or click PRESS START on the
intro's title screen.

**Controls**: WASD / arrow keys / gamepad d-pad or stick to move (8-direction,
~220px/s). Space / click / gamepad A is the one action button — it's
context-sensitive: say the punchline when a diner's story finishes, throw a
carried riesling bottle at the boss, or confirm on the retry/end cards.

**Flow**: two punchline rounds with a heart-scatter capture minigame, then the
glasses diner stands up and becomes **THE CRITIC** in an absurd wall-mounted
door — dodge his arcing napkin volleys and throw riesling bottles picked up
off the table to fight back. His first "killing" hit is a fake-out (jingle →
record scratch → "JUST KIDDING." → tougher phase 2); his real death triggers
Beat 3, where the woman brings the wagyu, revives him, and everyone shouts the
punchline in unison for the finale and a stats/rank end card. Losing all
hearts mid-fight dims the screen and offers TRY AGAIN, restarting the boss
encounter with 3 hearts (run stats keep counting).

speechSynthesis speaks "For free?" (rate 0.85, pitch 0.7) using the first
available local voice when the punchline lands, and the boss's critiques
(rate 1.0, pitch 0.6) if that worked; both fail silently with no console
error if the API or voices aren't available, per spec.

### Deviations / interpretation calls

- **Round B's line**: the spec's literal text ("...OF A TWELVE-NOTHING
  GAME.") contains "NOTHING", which collides with the acceptance checklist's
  own grep gate (`COIN|BILL|COST|NOTHING|FREE`, no carve-out for NOTHING the
  way FREE has one for "FOR FREE?"). Changed to "...OF A TWELVE TO ZERO
  GAME." — same mundane baseball-score beat, passes the grep.
- **Rank thresholds**: the spec names three bands (flawless-ish / mid /
  rough) without numbers. Implemented as hits-taken ≤2 → `IMMACULATE`, ≤6 →
  `COMIC TIMING`, else `GUY WHO RUINS DINNERS`.
- **Unison finale headcount**: the spec says bubbles appear over "all four
  diners, the woman, AND the boss," but by Beat 3 one of the four diner seats
  is empty (that diner *is* the boss by then). Implemented as bubbles over
  the 3 remaining seated diners + the woman + the boss (5 simultaneous "FOR
  FREE?" bubbles) rather than double-counting the critic.
- **Critic/boss identity**: no diner sprite in the sheet visibly wears
  glasses, so "the glasses diner" is just a fixed one of the four picks
  (flavor-text only; nothing on-screen literally labels him that).
- **Player facing**: the dungeon sheet has one pose per character (no
  directional frames), so left/right/up use the same trick as the intro's
  diners — horizontal/vertical mirroring of the single front sprite — rather
  than true directional art.
- **Napkin/bottle telegraph**: the arc's landing shadow is drawn at the fixed
  target point for the entire flight (not the projectile's live ground
  position), so the landing spot is readable the instant it's thrown.
- **Audio unlock**: the game has no boot gate; it attempts
  `new AudioContext()` + `resume()` on page load and again on first
  key/click, since navigating from the intro's PRESS START click doesn't
  reliably carry a "user activation" flag to the new document in every
  browser.

### Verification note

No live-browser testing was done for this build (per instruction, no
preview server was started). Verified instead via `node --check` on the
extracted script and a Node `vm`-sandboxed harness (stub canvas/AudioContext/
DOM) that drives the real `update()`/`draw()` functions through a full
playthrough — both punchline rounds, real heart capture, the full boss fight
(pickup → throw → hit/miss/duck resolution → fake death → phase 2 → real
death), the Beat 3 resurrection and unison finale, the end card/rank, and the
game-over → retry path — with zero thrown errors across all 14 phases. Visual
polish, animation feel, hit-box tuning, and audio balance are unverified and
worth a pass in a real browser.
