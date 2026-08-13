# SPEC — The Defense (template #4)

Joke shape: "a recurring annoyance the group defends against." A one-screen
tower defense where EVERY cast member stands as a tower doing their
personality, the waves are the group's actual recurring annoyances typed
verbatim, and the thing they protect is whatever the group actually
protects. The deepest "everyone's in it" template in the catalog (~1.0×).

Same conventions as The Gallery and The Flight — page anatomy, codec
discipline, driver style, degradation rules. Where this spec is silent, do
what `flight/` (the most recent template) does.

## Build plan — three rounds

1. **The Defense game** — `defense/` single page on `shared/framework.js`
   unchanged; assets to `assets/defense/` + CREDITS.txt/License.txt; codec
   groundwork (enum append + `CFG_DEFENSE_SCHEMA` + default builder + a
   defensive `if(!CONFIG.defense)` guard AND the third-arg call);
   hand-authored `examples/defense-sample.config.js` + hand-built
   `games/defense-sample/` for immediate browser play.
2. **Wizard fork + generate.js + `tools/verify-defense.js`** + regenerated
   sample via `tools/defense-sample-answers.json`.
3. **Docs + storefront** — counts to four ("Four games, and counting" /
   "one of four"), catalog table status, INTAKE Q4 branch, FULFILLMENT
   branch, tools/README schema, README template list.

## The game (one screen, ~4-6 minutes)

**Board**: fixed 960×540. Tower Defense pack tiles: grass field, a dirt
S-path entering left edge and ending bottom-right at THE THING — a small
pedestal/shrine drawn from pack tiles with the group's `defending` label
on a plaque, verbatim, uppercased ("GAME NIGHT", "THE THERMOSTAT").
Six tower pads at fixed positions along the path. The pack's tiles are
numbered (towerDefense_tile001–299) — identify what's needed by reading
the tile images / Preview.png directly during the build; document every
chosen tile number in CREDITS.txt. Needed: grass, path straights/corners,
pad, 3–4 visually distinct turret tops, 3–4 enemy units (soldier/vehicle
variety), a projectile or two. Explosions/impacts: procedural puffs +
existing SFX (house style) — don't hunt the pack for VFX.

**Cast as towers** — each placed tower is a pack turret base with the
person's roster face chip above it and their name beneath (the gallery's
face-on-a-stick pattern). Auto-placed at wave start in a fixed seeded
order (zero interaction needed); between waves the player MAY tap a pad
then tap another to swap two towers. Personalities:
- **HOST** (required): the anchor pad beside THE THING; steady mid-range
  fire. Always present.
- **THE FIRST BOSS (judge)**: the sniper — longest range, biggest single
  hit, slowest rate ("of course they do"). On their first kill each wave,
  a heckle bubble: `defense.firstBossHeckle` verbatim if present, else a
  clean engine-side fallback pool. They're on YOUR side in this template
  — still roasting, but roasting the annoyances.
- **THE SAVIOR**: support — a slow aura around their pad; once per wave,
  the moment THE THING first loses a heart... no. Once per wave, when a
  leaker crosses the last path corner, they teleport to the pad nearest
  THE THING for the rest of the wave ("shows up right when things look
  bad"), with a named flash bubble.
- **BUTTERFINGERS**: chaos — every ~7s (seeded) they fumble-drop
  something on a random-seeded path spot near their pad: big AoE splat,
  "OOPS." bubble. Highest DPS in the cast, completely unaimed.
- **THE BUILDER**: engineer — at each wave start they hammer a barricade
  onto a fixed path segment (temporary HP wall enemies must chew
  through), with a little build animation.
- **Extra friend (diner0)**: steady basic tower.
Uncast roles simply don't exist — fewer towers, and the wave HP budget
scales with placed-tower DPS so a host-only game stays winnable (the
harness proves it). No substitutes, no generic humans.

**Player verbs** (mobile-native, framework input):
- During a wave: tap/click an enemy → PRIORITY TARGET (every tower
  switches to it for 3s, small crosshair marker). Keyboard/gamepad: move
  vector cycles a marker between the frontmost few enemies, action
  confirms. That's the whole loop — the comedy is watching their people
  work; the player conducts.
- Between waves: optional pad-swap (tap pad, tap pad), then action /
  READY button starts the next wave.

**Waves**: 3–6, one per `defense.waves` label, banner verbatim
("WAVE 2 -- PARKING TICKETS"); every enemy in the wave carries a mini
plaque of that label (flight's hazard-plaque pattern). Spawn schedules
seeded `<gameId>:defense:wave:<i>:<attempt>`. Enemy mix escalates
(soldiers → vehicles). A leak reaching THE THING costs one of 3 hearts;
0 hearts → "THE <DEFENDING> FALLS" retry card → retry that wave
(attempt++ reseeds; hearts refill). House checkpoint rule: everyone wins
eventually, the story always completes.

**Catchphrase = THE RALLY**: kills with no leaks charge the meter; when
full, a pulsing SAY IT button (action key / tap it). Firing it: the
punchline slams across the board in chunky text, spoken aloud
(`speakLine`), every tower double-rates for 6s, confetti particles. Once
per game — save it or spend it. (Catalog rule: the rally is the whole
cast answering at once.)

**THE FINAL BOSS (authority) leads the last wave**: jumbo unit, their
roster face and name on a banner, `defense.finalBossQuirk` typed verbatim
as their entrance line ("STILL MAD ABOUT THE TOLLS"), tanky, escorted by
the final annoyance wave. Beaten → turn-good, played out: they dust off,
walk BACK along the path apologetically, take the one empty pad (or
stand beside THE THING if all six are cast) and help shred a short
straggler mini-wave as the strongest tower on the board. Then the
celebration. Uncast → the last wave is a grand rush of the final
annoyance label instead, and the mini-wave is skipped.

**End card**: waves held, hearts left, per-wave downed counts in their
words ("MONDAY MEETINGS DOWNED: 14"), whether/when THE RALLY fired,
rank from `rankNames` (no hearts lost → immaculate; won → comicTiming;
worst only shows on the retry card), builder credit line, "SEND THIS ONE
TO THE GROUP CHAT.", replay → `resetGame()`.

**Music** (six frozen slots): prep/title/between-waves = `dinner`;
waves = `chase`; heart lost / retry card = `sad` sting then `gameover`
on the card itself; final boss wave = `boss`; turn-good + win =
`celebration`. Seed `setBeatMusic('dinner')` at boot.

**Mobile**: tap = priority target / pad swap / buttons; no joystick;
rotate prompt; TAP/SPACE copy adaptation; volume-UI pointerdown first.

## Determinism

All gameplay randomness via `makeRng(seedFromString(...))`:
`<gameId>:defense:wave:<i>:<attempt>` (spawn schedule, butterfingers drop
spots), `<gameId>:defense:placement` (auto-place order). Priority-target
AI, tower targeting (frontmost-in-range, priority override), and
barricade placement are pure functions of state. No `Math.random` in
gameplay.

## Config / codec / wizard

- `CFG_TEMPLATE_KEYS` += `'defense'` (append only; never reorder existing
  `CFG_FRAGMENT_SCHEMA` keys); `defense: cfgObj(CFG_DEFENSE_SCHEMA)`
  added after `flight`.
- `CFG_DEFENSE_SCHEMA`: `defending: cfgStr(24)`,
  `waves: cfgArr(6, cfgStr(24))`, `firstBossHeckle: cfgStr(60)`,
  `finalBossQuirk: cfgStr(60)`.
- `cfgBuildDefenseDefaultConfig(engineRoot)` modeled on the flight's:
  `template:'defense'`, six loops, `introFallback` parity, neutral
  defaults (`defending:'THE COUCH'`, 4 neutral wave labels), no boss-line
  defaults (engine pools cover them). Hangout base stays byte-identical.
- Wizard: `JOKE_DEFS` += `{key:'defense', label:'The Defense', desc:'A
  recurring annoyance the group defends against'}`;
  `DEFENSE_STEP_KEYS = ['joke','group','punchline','annoyance','cast','vibe','preview']`
  (joke stays index 0). **Annoyance step**: one required "What do you
  defend?" field (24) + 3–6 wave-label rows ("What keeps coming? Short
  labels — they march in waves", min 3, uppercased) — targets-step row
  pattern. `defenseField`/`defenseDesc` on the two boss role cards
  (sniper line 60 / mad-about line 60; defense-flavored blurbs — note
  THE FIRST BOSS defends WITH you here). Three-way→four-way template
  emit; `normalizeWizardState` migration (defending:'', waves:['','',''],
  caps, step bounds); review `annoyance` row `showFor:['defense']`;
  preview gate ≥1 defending + ≥3 non-blank waves + universals; off-limits
  check extended over defending/waves/defense role fields; play=share=
  `../defense/#cfg=…`; encode `assembled.sanitized`.
- Page anatomy: identical to flight (script order, no skeletons, stub
  config.js, `<title>The Defense -- Playable Demo</title>`, ENGINE_ROOT
  boot, STORAGE_PREFIX, never redeclare framework globals, CW=960 +
  eager `fitCanvas()`).
- generate.js: `isDefense` branch — `defending` required, `waves` array
  ≥3 required, optional heckle/quirk; engineRoot `'../../'`; two-file
  deploy via `safeReplace` (strings must byte-match defense/index.html);
  dispatch `verifyDefenseSource`; prints hosted + `/defense/#cfg=` links.

## Verification

- `tools/verify-defense.js`, house driver style (buildSandbox +
  toneGateSource, PROBE reads engine state/helpers — no duplicated
  literals). Driver policy: dismiss cards, READY each wave, each tick
  mark the frontmost enemy as priority, fire THE RALLY when charged
  during the final boss wave, let auto-placement stand.
- Asserts, full cast: every wave label banner shown; heckle shown; savior
  teleport occurred (drive one deliberate near-leak: withhold priority
  marks until an enemy passes the last corner, then resume); builder
  barricade existed each wave; ≥1 butterfingers drop; RALLY fired (flag +
  double-rate window observed + no crash); boss wave, turn-good, boss
  tower participated in the mini-wave; end card. Forced-stall path: run
  one wave with a no-op policy until 3 leaks → retry card → resume normal
  policy → still reaches end card (proves retry/reseed).
- Host-only run: no heckle/teleport/barricade/drops, grand-rush finale,
  still winnable with the scaled HP budget, end card reached.
- Tone gate over sample config sources; engine fallback pools authored
  clean. Round-trips: template + all four defense fields survive
  encode/decode; oversized waves clamp to 6; unknown template → hangout.
- `verify-skeletons.js`: defense groups (full-cast, host-only,
  round-trip) beside the flight groups. Full suite + both prior sample
  regens stay green/byte-stable.
- Browser pass on :8809 (console/network clean; visual if the pane is
  displayed); commit locally per round, house-style messages, NO push.
