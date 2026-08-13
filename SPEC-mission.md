# SPEC — The Mission (template #5)

Joke shape: "us-against-the-world absurdism." A vertical squadron shmup:
the whole cast flies in formation with their roster faces in the cockpits,
the mission objective is the group's own absurd quest verbatim ("MISSION:
FIND THE BEST TACO"), the enemy swarms are whatever the group is up
against, and the boss fleet beams the bosses' real lines across the screen
between volleys. Spectacle template (~0.7×).

Same conventions as Gallery/Flight/Defense. Where silent, do what the most
recent template does. Space Shooter Remastered pack (descriptive
filenames, no tile-number hunting needed).

## Build plan — three rounds

1. **The Mission game** — `mission/` single page on the framework; assets
   to `assets/mission/` + CREDITS/License; codec groundwork (enum append +
   `CFG_MISSION_SCHEMA` + `cfgBuildMissionDefaultConfig` + third-arg call +
   defensive guard); hand-authored `examples/mission-sample.config.js` +
   hand-built `games/mission-sample/`.
2. **Wizard fork + generate.js + `tools/verify-mission.js`** + regenerated
   sample via `tools/mission-sample-answers.json`.
3. **Docs + storefront** — counts to five, catalog table, INTAKE/
   FULFILLMENT/tools-README branches.

## The game (~4-5 minutes)

**Screen**: vertical shmup, ship at bottom, seeded scrolling starfield
over one pack background. Movement = framework `getMoveVector()` (WASD/
arrows/stick/touch joystick on the left half — the Hangout's touch
convention, NOT flight's whole-screen tap), clamped to the lower 2/3.
Auto-fire is always on. The action button is reserved for THE BEAM.

**The squadron**: the host's ship (playerShip1 in `mission.shipColor`,
roster face chip on the cockpit, name under it) plus a wingmate per cast
FRIEND role, in fixed formation offsets, each doing their personality:
- **THE SAVIOR**: flies closest; projects the shield — absorbs one hit
  per stage ("{SAVIOR} HAD YOU."), then needs the next stage to recharge.
- **BUTTERFINGERS**: wild scattershot that hits things mostly by luck;
  every ~9s (seeded) fumbles a power-up crate that drifts to the player
  ("OOPS. THAT'S YOURS.") — the game's main charge source.
- **THE BUILDER**: periodically deploys a stationary turret drone that
  fires for a few seconds then expires (a little hammer-tap animation
  first).
- **Extra friend (diner0)**: steady wingman, straight shots.
Uncast → that wingmate simply doesn't fly; stage HP budgets scale with
squadron DPS (host-only stays winnable, harness-proved).

**The bosses are the boss fleet** (antagonists here, unlike The Defense):
- **THE FIRST BOSS (judge)**: the mid-mission ambush — after
  ceil(N/2) stages, their ace fighter (black enemy sprite, jumbo, roster
  face + name banner) cuts across with `mission.firstBossHeckle` beamed
  across the screen verbatim (marquee text, the "beams their lines"
  moment), strafing runs with a seeded pattern. Uncast → the ambush is an
  elite swarm volley instead.
- **THE FINAL BOSS (authority)**: the flagship at the end — big
  multi-part enemy (compose from pack parts), `mission.finalBossQuirk`
  beamed between volleys, 2–3 seeded volley phases. Beaten → turn-good:
  the flagship powers down, they eject in a tiny pod, beam one warm line,
  and join the formation for the victory flyby. Uncast → a grand meteor-
  and-swarm finale volley instead.

**Stages**: one per `mission.swarms` label (2–6, verbatim, uppercased) —
stage banner "SWARM 2 -- <LABEL>", ~40s each of seeded formation waves
(pack enemy shapes, one color family; boss fleet is black) plus meteor
drifts. The bigger enemies carry mini label plaques (flight's pattern);
small ones don't (readability). Mission % progress bar along the top with
the mission line: "MISSION: <mission.mission>".

**Hearts**: 3 shield pips; a hit costs one (savior absorbs first per
stage); 0 → "THE MISSION STALLS" retry card → retry the stage (attempt++
reseeds, pips refill). House rule: everyone reaches the end.

**Catchphrase = THE BEAM**: 3 power-up crates charge it; action fires it
manually — the punchline slams + is spoken (`speakLine`), a full-screen
beam wipes every enemy/meteor on screen, big shake + slow-mo. Chargeable
once per stage (crates stop dropping while charged). Firing it during a
boss phase deals a big chunk instead of a wipe (bosses shrug it off with
a beamed retort — one line from the fallback pool or their heckle/quirk
reused; keep it in-voice).

**End card**: the mission line + "MISSION ACCOMPLISHED.", per-swarm
downed counts verbatim ("<LABEL> DOWNED: n"), accuracy, pips left,
beams fired, rank from `rankNames` (no pips lost → immaculate; finished →
comicTiming; worst on the retry card only), builder credit, share nudge,
replay → `resetGame()`.

**Music**: title/briefing = `dinner`; stages 1–2 = `dinner`, later =
`chase`; ambush + flagship = `boss`; the lull before the flagship =
`sad`; turn-good + flyby + win card = `celebration`; retry card =
`gameover`. Seed `setBeatMusic('dinner')` at boot.

**Assets** (`assets/mission/`): playerShip1 ×4 colors, 4–5 enemy shapes
in ONE non-black color family + the 5 black ones for the boss fleet, one
ufo for variety, 2–3 laser sprites (player color + enemy red), meteors
(2 sizes × 2 tints), one background, shield effect ×1, fire/engine
effect ×2, 3 power-up icons, License + CREDITS (copied/skipped/
procedural). Damage overlays skipped — procedural flicker instead.

## Determinism

Seeds: `<gameId>:mission:stage:<i>:<attempt>` (waves, meteor drifts,
crate fumbles), `<gameId>:mission:ambush:<attempt>`,
`<gameId>:mission:flagship:<attempt>:<phase>`, starfield
`<gameId>:mission:stars`. No `Math.random` in gameplay.

## Config / codec / wizard

- `CFG_TEMPLATE_KEYS` += `'mission'` (append only);
  `mission: cfgObj(CFG_MISSION_SCHEMA)` after `defense`.
- `CFG_MISSION_SCHEMA`: `mission: cfgStr(40)`,
  `swarms: cfgArr(6, cfgStr(24))`,
  `shipColor: cfgEnum(['blue','green','orange','red'])`,
  `firstBossHeckle: cfgStr(60)`, `finalBossQuirk: cfgStr(60)`.
- `cfgBuildMissionDefaultConfig(engineRoot)`: `template:'mission'`, six
  loops, `introFallback` parity, neutral defaults (`mission:'GET
  EVERYONE HOME'`, 3 neutral swarm labels, `shipColor:'blue'`), no boss
  lines. Hangout base byte-identical.
- Wizard: joke card `{key:'mission', label:'The Mission',
  desc:'Us against the world'}`; `MISSION_STEP_KEYS =
  ['joke','group','punchline','mission','cast','vibe','preview']` (joke
  index 0). **Mission step**: the mission field ("What's the mission?
  The sillier the better — it goes on the banner", 40, required) + 2–6
  swarm rows ("What are you up against? Short labels", min 2,
  uppercased) + 4 ship-color swatches. `missionField`/`missionDesc` on
  the two boss cards (ace-pilot / flagship framing). Template emit goes
  five-way (hangout still → undefined). `normalizeWizardState`
  migration; review `mission` row `showFor:['mission']`; preview gate:
  mission + ≥2 swarms + universals; off-limits check over mission/
  swarms/role fields; play=share=`../mission/#cfg=…`; encode
  `assembled.sanitized`.
- Page anatomy: identical pattern, `<title>The Mission -- Playable
  Demo</title>` (safeReplace anchor).
- generate.js: `isMission` branch — `mission` required, `swarms` ≥2
  required, `shipColor` enum default blue, optional heckle/quirk;
  engineRoot `'../../'`; two-file safeReplace deploy; dispatch
  `verifyMissionSource`; prints hosted + `/mission/#cfg=` links.

## Verification

- `tools/verify-mission.js`: PROBE reads engine state/helpers (no
  duplicated literals). Driver: dodge-autopilot (steer toward the widest
  safe x-corridor computed from the engine's own entity list), auto-fire
  implicit; charge via crates, fire THE BEAM deliberately mid-stage
  (assert wipe + flag + spoken-path flag) and once during the flagship
  (assert chunk + retort shown); ambush survived; flagship phases;
  turn-good + flyby; end card. Forced-stall: no-op policy until 3 hits →
  retry card → resume → end card. Host-only: no wingmates/shield/crates-
  from-butterfingers (crates still drop from a neutral seeded schedule
  at a lower rate so THE BEAM stays reachable — spec decision, encode
  it), elite-volley ambush, finale volley, still winnable. Tone gate on
  samples; round-trips (all five mission fields; oversized swarms clamp;
  unknown template → hangout).
- `verify-skeletons.js`: mission groups added. Full suite + all prior
  sample regens byte-stable.
- Browser pass on :8809; commit locally per round; NO push.
