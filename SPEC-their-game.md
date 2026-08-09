# SPEC — Their Game (the bespoke direction)

Owner directive (2026-08-09): the whole game must be based on the group's real
people and experiences. Use the full asset library (D:\game assets — Kenney
All-in-1). Scenes change, characters change, and mechanics narrow to fit the
group. Bosses are not archetypes; every boss is a person they know (that
reframing shipped separately).

This spec turns "one template, four paint jobs" into a component system that
ASSEMBLES a game per group — while keeping the three invariants that make the
business work:

1. **Everything a user picks is an enum or capped text** — fragments stay
   whitelist-safe and URL-encodable. Asset choices are picks from shipped
   rosters, never paths.
2. **Every combination auto-verifies** — the vm harness must be able to play
   any assemblage to the end card. Component counts are chosen so the verify
   matrix stays tractable.
3. **Free games cost nothing to host** — everything ships in the repo; the
   config stays a link.

Four phases, each independently shippable. M and C are unambiguous — build
them in order. S is mechanical repetition of the skeleton pattern. X changes
gameplay and gets its own review round before implementation.

---

## Phase M — Music overhaul (answers "the music is awful")

The current experience: one vibe pick swaps only the ambient loop; the other
five beat slots always play the same 6 tracks; music runs loud under
everything. A 5-10 minute game on one jaunty 8-bit loop grates.

1. **Vibes become full sets.** A vibe maps ALL six beat slots
   (dinner/boss/chase/celebration/sad/gameover) to a curated set drawn from
   the 24 available loops (19 in `Music Loops/Loops` + 5 in `Retro`). Ship
   every used track in assets/audio/music (bit-identical copies, CREDITS.txt
   updated). Sets are curated for register coherence — use track length/tempo
   (inspect the files) and name/mood; the wizard's preview button remains the
   user's real chooser. Keep the sad/gameover slots gentle in every set.
2. **Mix discipline.** Default music gain comes DOWN (target: clearly under
   the SFX layer — the comedy reads through speech bubbles and SFX, music is
   bed, not lead). One shared constant, both engines. Ducking behavior
   unchanged.
3. **"Surprise us" rotates.** No-override now picks a random set per load
   (seeded per gameId so a given link always sounds the same — no
   Math.random at runtime; hash the gameId).
4. **Fallback check.** Verify the chiptune scheduler is fully silent whenever
   real tracks are playing (no doubling), and still takes over cleanly when a
   track fails to load.
5. KCK's own uploaded song and the paid tier's upload path are untouched.

Codec: `musicVibe` stays the single enum; its resolver expands to set all six
slots. Old links with a vibe get the new full-set behavior (deliberate — it's
strictly better); links with no vibe get the rotate-by-hash behavior.

## Phase C — Characters are their people

Today every cast member is a fixed Tiny Dungeon tile the user never sees
picked. Their people should LOOK like their people.

1. **Roster.** Curate ~32 character tiles across the Tiny family packs
   (Tiny Dungeon + Tiny Town + Tiny Battle + Tiny Farm + Tiny Ski — same
   16px grid). Copy the needed sheets into assets/. A roster entry =
   {sheet enum, col, row} with a human label ("cook", "beard", "cap",
   "grandma", "dog"...). Include some non-human options (the Animal Pack
   Remastered tiles if grid-compatible; a dog in the group chat is real
   personalization).
2. **Wizard.** In each role card (and the main character + extra friend),
   a compact sprite strip: tap to pick "which one is them?". Default stays
   today's tile so skipping the choice changes nothing.
3. **Config/codec.** Cast entries gain `sprite: <rosterKey>` (enum). The
   existing spriteCol/spriteRow stay as the resolved values for back-compat;
   the enum wins when present. Fragment schema: enum only.
4. **Engine.** Sheet indirection where cast tiles draw (game + intro). The
   savior and authority currently use bespoke tinted rendering — a roster
   pick OVERRIDES the bespoke look when set; absent pick keeps today's
   rendering (KCK regression intact). Boss-bar names already show the real
   person (shipped).
5. **Verify.** Harness never draws tiles, so add a resource check instead:
   every roster entry's sheet ships, and a browser pass samples one drawn
   frame per sheet.

## Phase S — Scenes from the asset library

The skeleton system already carries this. Add 4-6 new skeletons whose
drawCenterProp/drawFlavorDoor/drawWallDecor use actual pack tiles (the intro
already has a drawTile helper pattern to copy) instead of fillRect art:

- the backyard BBQ (Tiny Town), the bar (Roguelike Interior), the campsite
  (Foliage/Tiny Farm upgrade of roadtrip), the ski trip (Tiny Ski), the
  big game / tailgate (Sports Pack), the farm (Tiny Farm).

Same rules as SPEC-skeletons.md: identical collision geometry, paint and
text only, per-scene strings + config text defaults, tone-gated, one entry
in the scene enum and the wizard's setting step (which becomes a scrollable
grid). Verify matrix grows linearly (one generic playthrough per scene).

## Phase X — Mechanics narrowed to their experience (REVIEW BEFORE BUILDING)

The bounded way to make mechanics custom without bespoke code per order:

1. **Boss behavior variants.** Each boss slot gets a wizard question about
   the real person, mapping to one of 2-3 pre-built, harness-verified
   behavior modules:
   - First boss: (a) heckles from on high and throws (today's fight),
     (b) roams the floor and charges (reuses the chase AI inside the boss
     beat's win condition: hit them while they recover from a charge),
     (c) steals the laughs (grabs tokens; you body-block and win them back).
   - Final boss: (a) storm-in chase (today's), (b) the inspection (they
     stalk the room checking things; stay out of their line of sight — reuses
     flee-radius math inverted).
2. **Their objects.** "What would MARCO throw?" — free text label (capped,
   tone-gated) + a sprite pick from a small thrown-object roster (Generic
   Items pack). The boss's projectile and the player's throwable get THEIR
   names ("MARCO THROWS SPREADSHEETS").
3. **Story-driven beat picks.** The stories step gains an optional "where
   did it happen?" tag per story that nudges scene suggestion and which
   optional beats play — suggestion only, never a new mechanic.

Verify cost: variants multiply the matrix (scenes × first-boss × final-boss).
Keep it tractable: variants are scene-independent (paint rule), so the
harness runs scenes × 1 default variant set, PLUS one dinner-scene run per
variant. Each variant module needs its own driver strategy in the harness.

Wizard length: X adds two questions inside existing cards (not new steps).
The free-flow promise stays "about five minutes."

---

## Sequencing and status

- Boss reframing + boss-bar names: DISPATCHED (separate round, in flight).
- M then C: next two rounds, in that order.
- S: after C (scenes can then be verified with roster sprites in them).
- X: spec review with the owner first — it's the only phase that changes
  gameplay, and variant choice deserves a taste check before ~2 sessions of
  build.

Asset licensing: everything named is Kenney CC0 (License.txt ships alongside
each pack); update assets/audio/CREDITS.txt and add an assets/CREDITS note
for the sprite packs as they're copied in.
