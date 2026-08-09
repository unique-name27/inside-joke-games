# Karks Cub Kingdom — Intro Cinematic Spec

A self-running, skippable ~50-second Zelda-style (SNES-era) intro cinematic with
original chiptune music and jaw-harp accents. Doubles as the game's title
screen / attract mode. Single deliverable: `intro/index.html` + `intro/assets/`.

This is the intro for a larger game (top-down comic-timing RPG where the player
is a chef whose only weapon is the punchline "FOR FREE?"). Only the intro is
being built right now.

## Technical base

- Single HTML file, all CSS/JS inline. No external libraries, no CDN.
- `<canvas>` internal resolution **960×540**, CSS-scaled to fit the window
  (letterboxed, black page background). `imageSmoothingEnabled = false`.
  All sprites drawn at integer 4× scale (16 px tiles → 64 px on canvas).
- Pixel font: use a chunky programmatic look — render text with
  `font: "px monospace"` is NOT acceptable for the big title; for body/dialogue
  text use CSS `image-rendering` tricks or draw with a small embedded bitmap
  font. Acceptable shortcut: use Google-font-free approach — draw dialogue text
  in `bold 24px monospace` but at half-res on an offscreen canvas scaled 2× so
  it pixelates. The TITLE must be hand-built chunky pixel letters (see Scene 5).
- 60 fps rAF loop with a scene timeline driven by elapsed time, so the whole
  cinematic is deterministic (this matters for the record mode).
- WebAudio only — every sound is synthesized. No audio files.

## Assets (copy into `intro/assets/`)

Source packs live under `D:\game assets\`. Use Glob to find exact paths:

- `2D assets\Tiny Town\...\tilemap_packed.png` — overworld town tiles (16 px grid).
- `2D assets\Tiny Dungeon\...\tilemap_packed.png` — interior/dungeon tiles + tiny characters (rows of small humanoids near the bottom of the sheet — use these for the chef and diners).
- `2D assets\UI assets\UI Pixel Pack` spritesheet — optional, for the PRESS START button frame.
- Copy Kenney `License.txt` from one pack into `intro/assets/` as `KENNEY-LICENSE.txt` (CC0).

If a specific tile you want is hard to identify from the sheet, drawing a small
sprite programmatically (fillRect pixel art) is allowed and encouraged — chef
toque, wagyu steak, sparkles, knife. Keep everything on the 16px-grid aesthetic.

## Controls

- Any key / click / tap on the boot gate starts audio + cinematic.
- During cinematic: Enter, Escape, Space, click → skip to Scene 5 (title).
- On title screen: 25 s idle → replay cinematic from Scene 1 (attract loop).
- Gamepad: poll Gamepad API; any button acts as the same "advance/skip" input.

## Storyboard (timeline from t=0 when audio unlocks)

**Scene 0 — boot gate (before t=0).** Black screen, small blinking cream text:
`PRESS ANY BUTTON`. Needed for the audio-context unlock. Nothing else.

**Scene 1 — the legend (t=0 → 10 s).** Night sky full of twinkling 2×2 px
stars, big pixel moon. Bottom quarter: silhouetted Tiny Town rooftops (draw
the town tiles tinted near-black against the sky). Slow upward star drift.
Text types out letter-by-letter (typewriter beep per char), centered, cream,
three lines appearing in sequence:

> LONG AGO, IN A KINGDOM OF MODEST ANECDOTES,
> A FEAST WAS PREPARED. NO COIN WAS ASKED.
> NO BILL EVER CAME.

Music: intro section (see Music § — drone + sparse triangle arpeggio).

**Scene 2 — the chef (10 → 20 s).** Cut to interior: dark dining room drawn
with Tiny Dungeon tiles. On the right, a doorway filled with warm yellow-orange
glow (the ONE gradient allowed in the whole piece) casting a light cone into
the room. In the doorway: the chef, backlit silhouette wearing a white toque
(2-frame idle sway, 0.8 s period). Text below, typewriter:

> THEY SAY CHEF GABE STILL WAITS IN THE DOORWAY...
> LISTENING.

Music: main theme A enters (square lead). A single jaw-harp twang lands
exactly when "LISTENING." finishes typing.

**Scene 3 — the gameplay vignette (20 → 32 s).** Cut to top-down dinner
scene: terracotta table, four diner sprites seated (two facing up, two facing
down), plates + wine glasses (tiny pixel props). A speech bubble grows above
one diner and types out:

> I FARTED IN AN ELEVATOR
> WITH SOME GUY AT WORK TODAY.

0.7 s beat of total silence (music ducks to near-zero — comic timing IS the
game). Then giant chunky letters **FOR FREE?** slam onto the screen with
screen-shake, a boom (55 Hz sine drop + noise burst), and the music comes back
full with drums + a 2-beat jaw-harp gallop. The four diners bounce with
"HA HA" particles rising for ~2 s.

**Scene 4 — item get (32 → 40 s).** Cut to black, then a spotlight circle:
the chef sprite front-facing, arms up, holding a wagyu steak sprite overhead
(pink/white marbled pixel steak, gentle sparkle rotation around it). Music
ducks; the item-get fanfare plays (see Music §). Text below:

> YOU GOT THE WAGYU!
> IT COSTS... NOTHING.

**Scene 5 — title (40 s → hold).** Starry sky again. Title assembles:

- Huge hand-built chunky pixel letters, two lines: `KARKS CUB` / `KINGDOM` —
  gold (#e8b84b) fill, dark red-brown (#6b2b1f) outline, 3-px drop shadow.
  Build the letterforms from rectangles on an offscreen canvas (5×7 grid per
  letter scaled up, each line independently centered), do not render with a
  system font.
- A pixel chef's knife diagonally behind the logo (where Zelda puts the sword).
- Below, on a terracotta ribbon banner: `FOR FREE?` in cream.
- Bottom: blinking `PRESS START` (1 s period), and tiny footer
  `A DINNER PARTY LEGEND · KENNEY ASSETS · CC0`.
- Stars twinkle; occasional 4-frame sparkle crosses the logo.
- Music: theme loops (A A B A form) at slightly reduced gain.

## Music — all synthesized, original composition

Master chain: everything → soft compressor (DynamicsCompressor defaults) →
master gain 0.8 → destination. Tempo **112 BPM**, beat = quarter ≈ 0.536 s.
Schedule with a lookahead scheduler (25 ms interval, 0.12 s lookahead) — do
not schedule the whole song at t=0, because skip/duck must work live.

Voices:
1. **Lead** — square wave, gain 0.16, short attack, 10 ms release; subtle
   vibrato (5 Hz, ±4 cents) on notes ≥ 2 beats.
2. **Harmony** — square, gain 0.07, plays the lead line a diatonic third below
   during Theme B only.
3. **Bass** — triangle, gain 0.22. Pattern per bar: root eighth-notes, with the
   fifth replacing the root on the off-beats of beats 2 and 4.
4. **Drums** — noise-based. Kick: 120→45 Hz sine drop, 90 ms, on beats 1 & 3.
   Snare: bandpassed noise burst (1.8 kHz, Q 1) 80 ms, on beats 2 & 4.
   Hat: highpassed noise 30 ms on every eighth, gain 0.05. Drums enter at
   Scene 3's "FOR FREE?" slam and stay for the rest.
5. **Jaw harp** — adapt the Karplus-Strong voice from
   `e:\desktop\Documents\codingprojects\jaw-harp-sim\index.html` (search for
   `KS_FEEDBACK_NORMAL`, the delay-line feedback loop, and the formant
   bandpass around line 630-800). Simplified version is fine: noise burst →
   delay line tuned to ~73.42 Hz (D2) with feedback 0.985 → bandpass formant
   swept 400→1600 Hz over 0.3 s per twang → gain 0.5. It must BOING.

Sections (beats are absolute within the loop; 4/4):

**Intro section (Scene 1, ~10 s, before the loop starts):** A2 drone
(triangle, gain 0.12) + sparse arpeggio A3-C4-E4-A4 on beats 0,2,4,6...
(one note per 2 beats, sine, gain 0.1, long 1.5 s release). No drums.

**Theme A — 8 bars (32 beats), key A minor.** Lead `[note, startBeat, durBeats]`:
```
A4 0 1.5 | B4 1.5 0.5 | C5 2 2 | E5 4 3 | D5 7 1 |
C5 8 1 | D5 9 1 | E5 10 1 | G5 11 1 | A5 12 3 (twang on 12) |
G5 16 2 | E5 18 2 | F5 20 1 | E5 21 1 | D5 22 2 |
E5 24 1 | D5 25 1 | C5 26 1 | B4 27 1 | A4 28 3.5 (twang on 28)
```
Bass roots per bar: A2, A2, C3, A2, E2, D2, E2, A2.

**Theme B — 8 bars (32 beats), lift into C major.** Lead:
```
C5 0 1.5 | D5 1.5 0.5 | E5 2 2 | G5 4 3 | E5 7 1 |
F5 8 1 | G5 9 1 | A5 10 2 | G5 12 4 |
E5 16 1.5 | F5 17.5 0.5 | G5 18 2 | C6 20 3 | B5 23 1 |
A5 24 1 | G5 25 1 | E5 26 1 | D5 27 1 | C5 28 3.5 (twang on 28)
```
Bass roots per bar: C3, C3, F2, G2, C3, A2, F2+G2 (half bar each), A2.
Harmony voice active (third below).

Song form after the intro section: **A, A(+drums once unlocked), B, A**, loop.
Scene cuts do not restart the music — it runs continuously; only the two
"duck" moments (Scene 3 silence beat, Scene 4 fanfare) drop the music gain
(to 0.02 over 80 ms, back over 300 ms).

**Item-get fanfare (Scene 4):** lead square, gain 0.2:
`C5 0 0.25 | E5 0.25 0.25 | G5 0.5 0.25 | B5 0.75 0.25 | C6 1 1.5` with
vibrato on the C6. One jaw-harp twang under the C6.

**SFX:** typewriter beep = square 880 Hz, 25 ms, gain 0.05, one per character
(rate-limited to every 2nd char). Text-line-complete ding = sine 1320 Hz 80 ms.
"FOR FREE?" slam = the kick drop + white noise burst 200 ms + screen shake.

Do NOT reproduce any actual Nintendo melody. The composition above is original;
implement it as written.

## Record mode (`?record=1`)

When the URL has `?record=1`: after the boot-gate click, capture
`canvas.captureStream(60)` + a `MediaStreamDestination` tap of the master gain
into a `MediaRecorder` (`video/webm;codecs=vp9,opus`, fall back to vp8/default
if unsupported). Record Scene 1 through the end of Scene 5's 4th second, then
stop and auto-download as `for-free-intro.webm`. Skip inputs are ignored during
recording. No UI chrome in the recording — pure canvas.

## Palette

Cream `#f3e9d2`, terracotta `#c96f4a`, wood `#8a5a30`, night sky `#141428`,
star white `#fff3c9`, doorway glow `#ffb347→#7a4a1e`, gold `#e8b84b`,
outline red-brown `#6b2b1f`. Warm, slightly wonky, nothing photoreal.

## Acceptance checklist

- [ ] Boot gate → cinematic plays start to finish with continuous music, no console errors
- [ ] Typewriter text is synced with beeps; "LISTENING." twang lands on completion
- [ ] Scene 3: real silence beat, then slam with shake + drums entering
- [ ] Item-get fanfare ducks the theme and returns
- [ ] Title screen holds with blinking PRESS START, attract-replays after 25 s idle
- [ ] Skip works from any scene; gamepad button also works
- [ ] `?record=1` downloads a webm of the full cinematic
- [ ] Pixel-crisp at any window size (no smoothing, integer scaling of sprites)
