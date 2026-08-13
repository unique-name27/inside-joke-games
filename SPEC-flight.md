# SPEC — The Flight (template #3)

Joke shape: "a disaster trip you keep retelling." A one-button Tappy Plane
run where the group's trip IS the level: their story beats become the legs,
their typed hazards label the obstacles, and the player relives the disaster
as it's retold around them. Cheapest template in the catalog (~0.3× a
Hangout) and the first with a real score-chase loop for the group chat.

Everything here builds on the conventions proven by The Gallery — same
page anatomy, same codec discipline, same driver style. Where this spec is
silent, do what `gallery/` does.

## Build plan — three rounds

1. **The Flight game** — `flight/` (single page, no separate intro; short
   title/attract inside the page, same as gallery). Built on
   `shared/framework.js` unchanged. Assets copied to `assets/flight/` with
   CREDITS.txt + License.txt (the gallery convention: list what was copied,
   what was skipped and why, what's procedural). ALSO in this round, two
   small repairs discovered during the architecture review:
   - Fix the gallery friend-sprite bug: `gallery/engine.js:1069` draws
     `f.sheet, f.col, f.row` but `buildFriendPool()` stores the resolved
     sprite under `f.sprite` (`gallery/engine.js:404,406`) — friends render
     as bare sticks. Pass `f.sprite.sheet, f.sprite.col, f.sprite.row`.
     Harness can't see draw bugs; verify in the browser.
   - Flight engine must not repeat the redirect-path gap the gallery
     patched defensively: its no-fragment branch calls
     `cfgBuildDefaultConfig(ENGINE_ROOT, undefined, 'flight')` (third arg)
     AND keeps a `if(!CONFIG.flight) CONFIG.flight = {…}` guard.
2. **Wizard fork + codec + generate.js + verify driver** — joke card,
   `flight` enum, trip content step, generator branch, `tools/verify-flight.js`,
   checked-in sample (`examples/flight-sample.config.js` +
   `games/flight-sample/` via generate.js).
3. **Docs catch-up** — the Gallery shipped without doc updates; this round
   makes the docs true for all THREE templates (list at the bottom).

## The game (one button, 3–6 minutes — length comes from their story)

**Core loop**: side-scrolling flappy run at fixed CW=960/CH=540 (CW must
stay 960 — framework VOL_ICON invariant). One input: SPACE / click / tap
anywhere / gamepad A = flap. No move vector, no joystick. Volume UI
pointerdown check comes first, as always.

**The trip = the level.** The user gives 3–6 story beats, in order. Each
beat is one LEG (~30–45s of rock gates). Terrain walks the Tappy Plane
ground/rock variants so the trip gets colder as it gets worse:
3 legs = grass/rock/ice; 4 = grass/dirt/rock/ice; 5 = grass/dirt/rock/
snow/ice; 6 adds a second snow leg. (Dirt legs reuse the plain rock
sprites; each other theme uses its matching rock pair.)

**Leg boundary = breather**: obstacles stop ~4s, the plane auto-cruises,
and the NEXT beat's line types out in an auto-sized speech bubble
(framework `makeTypewriter` + `drawAutoBubble`) — their words verbatim.
Ground/palette crossfades, then gates resume. Reading never competes with
dodging. The current beat also shows as a small top-of-screen chip
("LEG 2 OF 5") so a crash never loses the story thread.

**Gates**: rock (bottom) + rockDown (top) pairs; gap centers/heights
seeded per leg from `gameId` (see Determinism). Gaps start generous
(~240px) and tighten by leg (~190px floor); scroll speed ramps gently.
**Hazard labels**: the user's 2–6 short labels (24-char cap, verbatim,
uppercased) render on small plaques hung on rocks, cycling in seeded
order — "THE RENTAL CAR", "GAS STATION SUSHI".

**Stars**: pack starGold floats in seeded gaps. Collecting 3 charges THE
SHOUT (see Catchphrase). Star pickups also score.

**Cast mapping** (graceful degradation, house rules — uncast = skip, no
substitutes):
- **HOST** (required): pilots. Their roster face (`rosterResolveSprite`,
  fallback 2,7) drawn over the cockpit, slight bob, prop animation from
  the 3 frames. Plane color = config enum (yellow/red/blue/green).
- **THE FIRST BOSS (judge)**: at the midpoint breather they pull alongside
  in the red plane (boss plane is red; if the host picked red, boss flies
  yellow), roster face in the cockpit, and heckle — `flight.firstBossHeckle`
  verbatim if present, else an engine-side neutral fallback pool (authored
  clean; the tone gate never scans engine source). For that one leg they
  lob tumbling thrown objects (seeded arcs, drawn procedurally) as extra
  moving hazards, then peel off.
- **THE FINAL BOSS (authority)**: the last gate before landing. Their
  plane (jumbo, roster face) storms in mad about something small —
  `flight.finalBossQuirk` typed verbatim on their entry banner — and flies
  a seeded sinusoidal blocking pattern across the approach. Survive the
  pattern (~4 sweep cycles, no gates during it) to reach the runway. On
  the runway they turn good: one warm line + a wave (series signature).
  Uncast → a clear-sky victory lap straight to the runway.
- **THE SAVIOR**: the first fatal crash of the run, they swoop in and
  catch the plane — "{SAVIOR} SHOWED UP." — no heart lost, brief
  invulnerability. Once per run, both modes. Uncast → no free save.
- **BUTTERFINGERS**: fixed gag at the leg-2 boundary — their phone
  tumbles down the screen (harmless, no collision) with a bubble:
  "{BUTTERFINGERS} DROPPED THE PHONE AGAIN." Uncast → skip.
- **THE BUILDER**: end-card credit line ("BUILT BY {NAME}."). Uncast →
  line omitted.

**Catchphrase = THE SHOUT** (invariant #2): charged by 3 stars, once per
run. The moment a collision is imminent while charged (predicted impact
within 0.25s at current velocity — deterministic), it auto-fires: the
punchline slams across the screen in chunky text, is spoken aloud
(`speakLine(CONFIG.punchline, 0.85, 0.7)`), every rock on screen crumbles
to puffs, brief slow-mo + shake. One-button purity: no second input
exists. Independent of the in-run shout, the landing finale always slams
the punchline (text + speech) as the victory beat — the catchphrase is
the win move in every template. Engine sets a `shoutFiredAt` /
`punchlineSaidAt`-style flag the driver can assert.

**Modes** (house two-mode pattern, flight-owned strings — no skeletons):
- **THE FULL TRIP** (default): 3 hearts; a crash costs one and resumes at
  the same scroll position (1.5s invulnerable, the next ~400px of rocks
  puffed away so no instant re-crash). Hearts refill each leg. Out of
  hearts → "THE TRIP STALLS" retry card → retry the current leg
  (attempt++ reseeds that leg's schedule; the gallery's retry-card
  pattern). Everyone reaches the landing; the whole story gets told.
- **ONE TANK** (unlocked by landing once; flag under `skey(...)`): one
  life, no hearts, no retries, shorter breathers (~2s). Score = how far
  into the trip you got, as a percent of total gates; best % persists in
  localStorage and shows on the title + end card. This is the link's
  score-chase loop. Mode select after title once unlocked:
  "CHOOSE YOUR FLIGHT PLAN" / "THE FULL TRIP — EVERYONE LANDS" /
  "ONE TANK — ONE LIFE. HOW FAR CAN YOU GET?"; unlock tease
  "ONE TANK UNLOCKS WHEN YOU LAND"; cleared line "ONE TANK BEST: N%".

**End card**: landed or "HOW FAR INTO THE TRIP: N%", stars, crashes,
medal (pack medals: gold = landed with 0 crashes, silver = landed,
bronze = stalled), a per-beat recap in their words (beat lines listed,
reached ones lit), rank from `rankNames` (landed clean → immaculate,
landed → comicTiming, stalled → worst), builder credit,
"SEND THIS ONE TO THE GROUP CHAT.", replay prompt. Action on the end
card → `resetGame()` (reset `cardsShown`, per gallery).

**Music** (Phase M sets, six frozen slot names re-interpreted):
title/get-ready/legs 1–2 = `dinner`; later legs = `chase`; the breather
before the final boss = `sad`; boss gate = `boss`; landing/celebration/
win end card = `celebration`; stall/retry card = `gameover`. Seed
`setBeatMusic('dinner')` at boot — a template that forgets this plays
silence.

**Mobile**: whole-screen tap = flap (after `handleVolumePointerdown`
swallow check); landscape rotate prompt (engine-local `drawRotatePrompt`
copy, house pattern); copy adapts TAP/SPACE; get-ready screen uses the
pack's tap icon as the hint.

**Assets** (`assets/flight/`, all Kenney Tappy Plane, CC0): planes
(12: 4 colors × 3 prop frames), background.png, ground×5 (grass/dirt/
rock/snow/ice), rock pairs (rock, rockDown, rockGrass, rockGrassDown,
rockIce, rockIceDown, rockSnow, rockSnowDown), puffLarge/puffSmall,
starGold, medalBronze/Silver/Gold, textGetReady/textGameOver, tap/
tapLeft/tapRight. Skip: UI buttons, letters/numbers (house chunky/
reading text renders all verbatim strings), starSilver/starBronze,
spritesheets, vector. SFX: reuse existing `assets/audio/sfx/` samples
(woosh for flap, impact for crash, confirmation for star, jingles for
medal/landing — pick from the 15-key gallery pool style); no new SFX
files. Roster sheets load exactly as gallery does (`ENGINE_ROOT +
ROSTER_SHEETS[k].path`, `rawTile` cache, `drawRosterSprite`).

## Determinism

All gameplay randomness through `makeRng(seedFromString(...))`
(mulberry32 over `cfgHashString`), seeds:
`<gameId>:flight:leg:<index>:<attempt>` (gate heights, star slots, label
rotation, boss lobs), `<gameId>:flight:bossgate:<attempt>`. No
`Math.random` outside cosmetic particle jitter. Same link always flies
the same trip.

## Config / codec / wizard

- `CFG_TEMPLATE_KEYS = ['hangout','gallery','flight']` — APPEND. Never
  reorder existing `CFG_FRAGMENT_SCHEMA` keys (the byte-identity music
  seed); add `flight: cfgObj(CFG_FLIGHT_SCHEMA)` after `gallery`.
- `CFG_FLIGHT_SCHEMA`:
  `beats: cfgArr(6, cfgStr(90))`, `hazards: cfgArr(6, cfgStr(24))`,
  `planeColor: cfgEnum(['yellow','red','blue','green'])`,
  `firstBossHeckle: cfgStr(60)`, `finalBossQuirk: cfgStr(60)`.
  Codec caps ceilings only; the 3-beat / 2-hazard minimums are wizard/
  generator UX, never codec-enforced (house cap philosophy).
- `cfgBuildDefaultConfig(engineRoot, sceneKey, templateKey)` gains
  `if (templateKey === 'flight') return cfgBuildFlightDefaultConfig(engineRoot);`
  — a separate small base (like the gallery's): `template:'flight'`, six
  music loops, `introFallback` for schema parity, neutral default
  `flight.beats` (4 placeholder beats) + `flight.hazards` (4 neutral
  labels) + `planeColor:'yellow'`, no heckle/quirk defaults (engine pools
  cover them). Absent template still returns the byte-identical hangout
  object; unknown enum values sanitize away, never to a default.
- Fragments still may never set `music`, `gameId`, or any path; sprites
  stay roster-key enums. Tone gate is per-group `forbiddenWords` only —
  there is NO universal list and NO `FREE` rule (do not reintroduce;
  SPEC-game-styles.md line 36 is stale on this point).
- **Wizard** (`build/index.html`):
  - `JOKE_DEFS` += `{key:'flight', label:'The Flight', desc:'A disaster
    trip you keep retelling'}` (only built templates get cards).
  - `FLIGHT_STEP_KEYS = ['joke','group','punchline','trip','cast','vibe','preview']`
    — joke stays index 0 in every sequence (hard invariant).
  - **Trip step**: 3–6 beat rows ("Tell the trip in order — one line per
    beat, word for word how the group tells it"), 2–6 hazard rows ("What
    kept getting in the way? Short labels — they get painted on the
    rocks"), plane color pick (4 swatch cards). Add/Remove row pattern
    from the targets step.
  - Boss lines ride the cast cards via the same mechanism as gallery's
    `galleryField`: add `flightField` (heckle 60 on THE FIRST BOSS, quirk
    60 on THE FINAL BOSS) rendered when `state.template === 'flight'`,
    with flight-appropriate `flightDesc` blurbs per role (pilot framing).
  - `buildOverridesFromState`: `template` emits `undefined` for hangout,
    the key otherwise (three-way now); flight branch writes
    `overrides.flight.{beats,hazards,planeColor,firstBossHeckle,finalBossQuirk}`
    (trim/filter/cap; beats keep typed case, hazards uppercase like
    targets); hangout-only fields (`judge.title`/`authority.cardTitle`)
    stay hangout-only.
  - `normalizeWizardState`: migrate old drafts — default
    `beats:['','',''], hazards:['',''], planeColor:'yellow'`, clamp
    lengths/caps, coerce role flight fields to `''`, bounds-check `step`
    against `stepCount(out.template)`.
  - Review card: `trip` row with `showFor:['flight']`; setting/stories
    stay hangout-only, targets gallery-only; Edit resolves by stepKey.
  - Preview gate: ≥3 non-blank beats, ≥2 non-blank hazards, host/
    catchphrase/title, off-limits check over beats/hazards/flight role
    fields (extend `checkStateForbidden`).
  - Share links: `playUrl = shareUrl = ../flight/#cfg=…` (single page).
    Encode `assembled.sanitized`, never `merged`.
- **Page anatomy**: `flight/index.html` script order
  `config.js → ../game/roster.js → ../game/cfgcodec.js →
  ../shared/framework.js → engine.js` (no skeletons), same style/OG/
  favicon block, `<title>The Flight -- Playable Demo</title>`;
  `flight/config.js` = `let CONFIG = null;` stub. Engine boot mirrors
  gallery exactly: ENGINE_ROOT from `document.currentScript.src`,
  fragment load → mutate-or-assign, else redirect to `/build/`;
  `CW/CH` then eager `fitCanvas()`; `STORAGE_PREFIX = frag hash ||
  gameId || 'flight'`; never redeclare a framework global.
- **generate.js**: `isFlight` branch — answers gain `template:'flight'`,
  `beats` (array, ≥3 required), `hazards` (array, ≥2 required),
  `planeColor` (enum, default yellow), optional `firstBossHeckle`/
  `finalBossQuirk`; hangout-only validation stays out of the branch;
  `engineRoot = '../../'` (2-deep, like gallery); deploys exactly two
  files (`config.js` + `index.html` from `flight/index.html` with the
  five exact-string replacements — title + four script srcs; the
  replacement strings MUST match `flight/index.html` byte-for-byte, the
  generator's `String.replace` silently no-ops otherwise); verifier
  dispatch `verifyFlightSource`; prints hosted + `…/flight/#cfg=` links.

## Verification

- `tools/verify-flight.js`, gallery-driver style: reuse `buildSandbox` +
  `toneGateSource`; chain `config + roster + cfgcodec + framework +
  flight/engine + PROBE`, `currentScriptSrc:
  'https://example.test/flight/engine.js'`. PROBE exposes `__tick(dt)`,
  `__flap()`, `__handleAction()`, `__ensureAudio()`, `__probe()` (phase/
  mode/leg/hearts/charge/stars/distancePct/bossState/shoutFired/
  beatsShown/labelsSeen) and a `__gapAt(x)`-style helper that reads the
  engine's own gate data (no duplicated literals — the verify-gallery
  row-Y duplication is the anti-pattern).
- Driver = bang-bang autopilot, not a precomputed schedule: each tick,
  flap when the plane sits below the next gap's center with non-negative
  fall speed. Bounded iterations everywhere.
- Asserts, full-cast config: every beat displayed (beatsShown == beats),
  every hazard label seen at least once, first-boss leg entered +
  survived, star charge reached, SHOUT fired (drive it: once charged,
  withhold flaps until imminent-collision triggers; assert rocks cleared
  + no heart lost + flag set), final boss gate reached + survived,
  landing + turn-good, end card. Then: host-only config (no boss leg, no
  savior/butterfingers/builder, clear-sky finale — degradation-agnostic
  driver, dispatch on probed state, never on which roles "should" exist).
  Then ONE TANK: unlock flag set after landing, one-life run ends at
  first unsaved crash with a distance %, best-% persistence.
- Tone gate over the sample config sources; engine fallback pools
  authored clean by hand (gate never scans engine source).
- Round-trip: `template:'flight'` + all five flight fields survive
  encode → sanitize → decode; unknown template sanitizes away (hangout
  default); oversized beats/hazards arrays clamp.
- `tools/verify-skeletons.js`: add flight groups (full-cast + host-only
  playthroughs off `examples/flight-sample.config.js`, round-trip) beside
  the gallery groups; whole suite green:
  `node tools/verify-config.js games/test-group/config.js`,
  `node tools/verify-gallery.js examples/gallery-sample.config.js`,
  `node tools/verify-flight.js examples/flight-sample.config.js`,
  `node tools/verify-skeletons.js`,
  `node tools/generate.js tools/flight-sample-answers.json --slug=flight-sample`.
- Browser pass before any deploy (server already on :8809): full
  playthrough desktop + `resize_window` mobile pass, zero console
  errors, no 404s; ALSO re-check the gallery friend-sprite fix renders.
  Commit locally; do not push/deploy.

## Docs catch-up (round 3 — make the docs true for all three templates)

- `README.md`: templates section ("What's the joke?" model, three
  styles), `gallery/`+`flight/`+`shared/framework.js` in What's-in-the-
  box, the 2-file single-page deploy layout beside the hangout's 4-file
  layout, wizard step counts per template, "Authoring a new template"
  modeled on the skeleton-authoring section, Docs map += SPEC-gallery/
  SPEC-flight/SPEC-game-styles/SPEC-their-game.
- `tools/README.md`: answers schema += `template`, gallery fields,
  flight fields; per-template shell deployment; verify-gallery/
  verify-flight commands.
- `INTAKE.md`: new Q1 "What's the joke?" (three shapes → template);
  setting question becomes hangout-only; content question branches per
  template (stories / roastables / trip beats + hazards).
- `FULFILLMENT.md`: per-template branch in the playbook (which verify
  command, which shells).
- Storefront `index.html:280` and `example/index.html:197`: "two game
  styles" → three, joke-shape framing.
- `SPEC-game-styles.md`: mark The Flight built; note the retired FREE
  rule (line 36) as per-group-only.
