# SPEC — Story Skeletons (scene templates)

Four settings for the same game: **THE DINNER PARTY** (the original), **THE ROAD
TRIP**, **THE OFFICE PARTY**, **THE WEDDING WEEKEND**. A user picks one in the
wizard; the game re-dresses itself around it. This is the feature that makes the
tool feel limitless instead of well-disguised: the copy already promises "any
group" — this makes the *scene* match the group too.

## The one rule that makes this cheap

**Skeletons are paint and text. Never gameplay.**

Every skeleton uses the IDENTICAL collision geometry: the same center-prop rect
(`TABLE` today: 336,248,288,120), the same four seat positions, the same left
main door, the same elevated right-wall boss door, the same top-wall bathroom
door, the same bottom-right flavor-door rect + glow center. Only the *drawing*
of those things and the *names/strings* around them change. Consequences, all
deliberate:

- Zero retuning: laugh-token scatter, waypoints, chase speeds, napkin arcs,
  every DIFF constant — untouched, byte-identical, for every scene.
- The vm playthrough harness stays valid for all four skeletons as-is.
- The engine diff is surgical: literals → `SKEL.*` lookups, draw-snippet
  extraction, nothing structural.

The beat choreography is already setting-agnostic (people around a thing
telling stories → a critic in an absurd elevated door → a savior with the
{ITEM} → an authority chase → phone-photos epilogue → builder epilogue → tech
support). Do not touch beat logic, timings, degradation map, or DIFF tables.

## Architecture — three layers, two new files' worth of content

1. **Engine** (game/engine.js, intro/engine.js) — choreography, unchanged
   except literal→lookup swaps and draw extraction.
2. **Skeleton** (NEW `game/skeletons.js`) — engine-shipped presentation code:
   per-scene palettes, draw functions, mechanic-flavor strings. Loaded as a
   plain global (`SKELETONS`) by BOTH pages, before engine.js. Browser global +
   `module.exports` guard, same dual-load pattern as cfgcodec.js.
3. **User config** — gains ONE new field: `scene: 'dinner'|'roadtrip'|'office'|'wedding'`.
   Everything else about a config is unchanged.

**Security invariant (unchanged from the codec's design):** a fragment/user
config can only ever *pick* a skeleton by enum key. No draw code, no asset
paths, no strings enter from the fragment via this feature. `cfgSanitize`
whitelists `scene` as `cfgEnum(['dinner','roadtrip','office','wedding'])`.

**Back-compat invariant:** `CONFIG.scene` absent/invalid → `'dinner'`,
everywhere (engine, intro, codec defaults, generate.js). Every existing
fragment link, games/test-group, and KCK itself must play byte-identically to
today. The `music.loops` key literally named `dinner` is an internal beat name
— do NOT rename it.

## game/skeletons.js — shape

```js
'use strict';
var SKELETONS = {
  dinner: {
    key: 'dinner',
    label: 'THE DINNER PARTY',
    palette: { /* named accent overrides read by the arena renderer:
      floorA, floorB, wallTop, propBase, propTop, doorGlow, decor... —
      dinner's values are EXACTLY the PAL entries the arena uses today */ },
    drawCenterProp(ctx, t, H){ /* dinner: today's two fillRects, moved verbatim */ },
    drawFlavorDoor(ctx, t, H){ /* dinner: today's kitchen doorway + warm glow, verbatim */ },
    drawWallDecor(ctx, t, H){ /* dinner: nothing (empty fn) */ },
    projectile: { draw(ctx, x, y, H){ /* crumpled napkin ball, today's pixels verbatim */ } },
    throwable:  { draw(ctx, x, y, H){ /* green riesling bottle 14x6, verbatim */ } },
    strings: {
      startCardTitle: 'DINNER IS SERVED',
      startCardBody: ['THE GUYS TELL THEIR STORIES.','WAIT FOR THE LAST WORD...','THEN HIT SPACE.',"DON'T LET THE LAUGHTER DIE."],
      modeSelectTitle: 'CHOOSE YOUR SEATING',
      modeRowNormal: 'FIRST SEATING  --  A NICE DINNER',
      modeRowHard: 'SECOND SEATING  --  MUCH HARDER. YOU CAN LOSE.',
      hardUnlockLine: 'SECOND SEATING AWAITS AT THE START',
      hardClearedLine: 'SECOND SEATING CLEARED',
    },
  },
  roadtrip: { ... }, office: { ... }, wedding: { ... },
};
if (typeof module !== 'undefined') module.exports = { SKELETONS };
```

`H` is a small helpers bag the engine passes (PAL, drawPixelCircle,
drawChunkyText — whatever the extracted dinner code already used; keep it
minimal). `t` is elapsed time for animation (campfire flames, DJ-booth pulse).
Engine resolves once at boot: `const SKEL = SKELETONS[CONFIG.scene] || SKELETONS.dinner;`
(intro/engine.js does the same). Uncast/absent scene → dinner.

Each new skeleton's draw functions are modest pixel-rect art in the existing
style (the dinner table is literally two fillRects — match that economy, ~30
lines per prop max). Animation allowed but cheap: campfire flicker = 2–3
alternating flame rects on a time step; string lights = a dotted row with a
slow color cycle; vending machine = static + subtle glow; DJ booth = glow
pulse on the music duck level if trivially available, else slow sine.

**"CATCH THE LAUGHS!"**, laugh tokens, hearts, the `HA` particles, and stat
label `LAUGHS CAUGHT:` are UNIVERSAL (laughter is the currency in every
scene) — they stay hardcoded in the engine. `HARD MODE UNLOCKED` stays
universal too; only the lines quoted in `strings` above move.

## The four skeletons (authored content — implement exactly)

Tone gate applies to every string below and to all of skeletons.js: never
COIN/BILL/COST/NOTHING, and FREE only inside a literal `FOR FREE?`.

### dinner — THE DINNER PARTY (parity skeleton)
Every value = today's literal, moved verbatim. This skeleton is the regression
proof: extraction is correct when KCK plays byte-identically. (Known quirk,
accepted: the start card says `THE GUYS TELL THEIR STORIES.` for every
dinner-scene user, as it already does today.)

### roadtrip — THE ROAD TRIP
- Scene: a night pull-off / rest stop. Floor: dirt-and-grass tones. Top wall:
  night treeline/stars (`drawWallDecor`: sparse star pixels).
- Center prop (same rect): a campfire ring — stone circle, two log benches
  along the long edges, animated flame at center. Warm light halo (reuse the
  glow helper, small radius).
- Flavor door (same rect + glow center): the parked van, headlights making
  the warm glow.
- Projectile: crumpled maps (pale paper tint, same crumple pixels).
- Throwable: the thermos (steel gray + red cap, 14×6).
- strings: `THE FIRE IS LIT` /
  `['THE CREW TELLS THEIR STORIES.','WAIT FOR THE LAST WORD...','THEN HIT SPACE.',"DON'T LET THE LAUGHTER DIE."]` /
  `CHOOSE YOUR ROUTE` / `SCENIC ROUTE  --  A NICE DRIVE` /
  `WHITE-KNUCKLE ROUTE  --  MUCH HARDER. YOU CAN LOSE.` /
  `WHITE-KNUCKLE ROUTE AWAITS AT THE START` / `WHITE-KNUCKLE ROUTE CLEARED`

### office — THE OFFICE PARTY
- Scene: the break room after hours. Floor: carpet-tile checker (two muted
  grays). Top wall: a window strip with city-night pixels (`drawWallDecor`).
- Center prop: break-room table (cool gray top) with a coffee pot and a tiny
  potted plant on it.
- Flavor door: a humming vending machine (its light is the glow).
- Projectile: crumpled memos (white/blue tint).
- Throwable: the red stapler (14×6).
- strings: `THE PARTY HAS STARTED` /
  `['THE OFFICE TELLS ITS STORIES.','WAIT FOR THE LAST WORD...','THEN HIT SPACE.',"DON'T LET THE LAUGHTER DIE."]` /
  `CHOOSE YOUR SHIFT` / `DAY SHIFT  --  A NICE PARTY` /
  `NIGHT SHIFT  --  MUCH HARDER. YOU CAN LOSE.` /
  `NIGHT SHIFT AWAITS AT THE START` / `NIGHT SHIFT CLEARED`

### wedding — THE WEDDING WEEKEND
- Scene: the reception hall. Floor: warm parquet tones. Top wall: a string of
  lights (dot row, slow warm color cycle) (`drawWallDecor`).
- Center prop: a white-clothed table with a small tiered cake at center.
- Flavor door: the DJ booth (speaker boxes, pulsing glow).
- Projectile: crumpled toasts (cream paper tint).
- Throwable: the bouquet (pink bloom + green stems, 14×6) — the bouquet toss
  is the player attack.
- strings: `THE RECEPTION BEGINS` /
  `['THE WEDDING PARTY TELLS ITS STORIES.','WAIT FOR THE LAST WORD...','THEN HIT SPACE.',"DON'T LET THE LAUGHTER DIE."]` /
  `CHOOSE YOUR DANCE` / `FIRST DANCE  --  A NICE RECEPTION` /
  `LAST DANCE  --  MUCH HARDER. YOU CAN LOSE.` /
  `LAST DANCE AWAITS AT THE START` / `LAST DANCE CLEARED`

## Engine changes (game/engine.js)

1. Boot: resolve `SKEL` as above.
2. Arena renderer: floor/wall tints read `SKEL.palette`; the table draw call →
   `SKEL.drawCenterProp`; kitchen doorway/glow draw → `SKEL.drawFlavorDoor`;
   add one `SKEL.drawWallDecor` call in the arena background pass. Collision
   rects/constants (`TABLE`, `KITCHEN_DOOR`, `KITCHEN_GLOW`, seats, doors) stay
   the engine's own — skeletons never define geometry.
3. Napkin + bottle sprite draws → `SKEL.projectile.draw` / `SKEL.throwable.draw`
   (physics, shadows, arcs, pickup/respawn logic untouched).
4. Hardcoded strings → `SKEL.strings.*`: start card title/body (engine ~3983),
   mode-select title + two rows (~4026, 4046), `SECOND SEATING AWAITS AT THE
   START` (~3880), `SECOND SEATING CLEARED` (~3872). The `FOR FREE?` slam
   position keeps using the glow-center constant (engine-owned) — unchanged.
5. Nothing else. `?start=` debug entries, localStorage keys, DIFF/LENGTH_DIFF,
   mobile/touch — untouched.

## Intro changes (intro/engine.js, intro/index.html)

- intro/index.html loads `../game/skeletons.js` before its engine (mirroring
  its existing `../game/config.js` load).
- Scene 3 (the flashback around the table): `drawTable(ctx)` →
  `SKEL.drawCenterProp` and apply `SKEL.palette` accents; the four
  `drawDiner` seats stay. Scene 1/2/4 visuals stay generic (night sky /
  doorway / item-get) — text already comes from CONFIG.
- Same `SKELETONS[CONFIG.scene] || SKELETONS.dinner` resolution.

## Codec changes (game/cfgcodec.js)

1. `CFG_FRAGMENT_SCHEMA` += `scene: cfgEnum(['dinner','roadtrip','office','wedding'])`.
2. `cfgBuildDefaultConfig(engineRoot, sceneKey)` — second arg optional,
   default `'dinner'`. For `'dinner'` the returned object is BYTE-IDENTICAL to
   today's (old links regress perfectly). For other scenes, a small
   `CFG_SCENE_DEFAULTS` table (text only — it lives in cfgcodec.js so the
   codec keeps zero dependency on skeletons.js) overrides exactly these
   defaults, user answers still win over all of them:
   - roadtrip: `introStory.scene1Lines: ['NOT LONG AGO,','{HOST} TOOK THE CREW ON A DRIVE.','THE STORIES THEY TOLD WERE VERY ORDINARY.']`,
     `scene2Lines: ['THEY SAY {HOST} IS STILL AT THE WHEEL...','LISTENING.']`,
     `loseLine: 'THE TRIP IS RUINED.'`, `rankNames.worst: 'FRIEND WHO RUINS ROAD TRIPS'`
   - office: `scene1Lines: ['NOT LONG AGO,','{HOST} THREW A PARTY FOR THE OFFICE.','THE STORIES THEY TOLD WERE VERY ORDINARY.']`,
     `scene2Lines: ['THEY SAY {HOST} STILL WAITS BY THE PRINTER...','LISTENING.']`,
     `loseLine: 'THE PARTY IS RUINED.'`, `rankNames.worst: 'COWORKER WHO RUINS PARTIES'`
   - wedding: `scene1Lines: ['NOT LONG AGO,','{HOST} GOT EVERYONE TOGETHER FOR A WEDDING.','THE STORIES THEY TOLD WERE VERY ORDINARY.']`,
     `scene2Lines: ['THEY SAY {HOST} IS STILL ON THE DANCE FLOOR...','LISTENING.']`,
     `loseLine: 'THE RECEPTION IS RUINED.'`, `rankNames.worst: 'GUEST WHO RUINS WEDDINGS'`
3. The assembled/sanitized config carries `scene` through encode/decode;
   `gameId` hashing and the music rules are untouched.

## Wizard changes (build/index.html)

- New FIRST step: **THE SETTING** — four tap-to-select cards (same
  selected-state pattern as the vibe cards), default `dinner`:
  - THE DINNER PARTY — "A table, some stories, one unforgettable question."
  - THE ROAD TRIP — "A campfire at the rest stop, stories from the road."
  - THE OFFICE PARTY — "The break room, after hours."
  - THE WEDDING WEEKEND — "A reception hall, a DJ booth, and the toasts."
- `WIZARD_STEP_COUNT` 6→7, `STEP_NAMES` updated, `state.scene` in the
  persisted draft (validated against the enum on restore), `assembleConfig`
  passes it into the overrides so the fragment encodes it.
- Grep build/index.html AND root index.html for any literal "six"/"6 steps"
  copy and update to seven where it refers to the wizard's step count.

## Generator + docs

- tools/generate.js: answers schema gains optional `scene` (enum, default
  `'dinner'`, validation error message lists the four keys); pass through to
  the built CONFIG and to `cfgBuildDefaultConfig`. tools/example-answers.json
  gains `"scene"`. tools/README.md documents it.
- INTAKE.md: new first question — the setting, four options, dinner default.
- FULFILLMENT.md: one paragraph — scene key, where it flows, and that
  skeleton strings are pre-cleared for tone (an operator never edits
  skeletons.js per order).
- README.md: short "Story skeletons" section — the paint-and-text rule, the
  fixed-geometry invariant, how to author a fifth skeleton.
- Root index.html (storefront): add the settings as a first-class feature —
  a "Four settings" card or hero line ("A dinner party. A road trip. The
  office. A wedding weekend. Same roles, whole new room."). Keep the existing
  visual system; no redesign.

## Verification (all must pass before done)

1. **KCK parity**: extend the harness's literal-parity assertions — the dinner
   skeleton's strings equal the old hardcoded literals, and KCK's full
   playthrough (both modes) passes unchanged with no `scene` field in its
   config.
2. **test-group** degraded playthrough passes unchanged (proves absent-scene →
   dinner default through the shell/codec path).
3. **Scene matrix** (new `tools/verify-skeletons.js`, zero-dep, vm-harness like
   verify-config.js): for EACH of the four scene keys, build
   `cfgBuildDefaultConfig(root, scene)` + a representative cast (all roles
   cast) and run the full generic playthrough; also run each skeleton's
   strings + the whole of skeletons.js source through the tone gate
   (baseline words + the FREE rule).
4. **Round-trip**: encode a config with each scene key via
   `cfgEncodeConfigFragment` → decode → `scene` survives and sanitizes;
   an unknown/absent scene sanitizes to absent (→ dinner at resolve time).
5. **New example**: `examples/roadtrip.config.js` — scene `roadtrip`,
   different cast mix (leave one role uncast), `five_min`, no custom song —
   verified by tools/verify-config.js.
6. `node tools/verify-config.js game/config.js` and
   `node tools/verify-config.js examples/test-group.config.js` still pass.

Shell pages: game/index.html, intro/index.html, and BOTH games/test-group
shell pages gain the `skeletons.js` script tag (test-group's shells are the
live template generate.js copies — updating them propagates to future orders).

Do not push/deploy — commit locally; browser verification of all four scenes,
the wizard flow, and a fragment link happens before any deploy.
