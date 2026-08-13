# SPEC — Game Styles (the catalog)

Owner directive (2026-08-09): the dinner/stories/punchline structure was ONE
group's inside joke. Other groups need genuinely different GAMES, not reskins
of that one. Survey the full asset library, think much bigger.

This spec defines TEMPLATES — distinct playable game styles — above the
existing scene/skeleton layer. A skeleton changes the room; a template changes
the game. The product question the wizard will eventually open with is not
"what's your setting?" but **"what's the joke?"** — because an inside joke has
a shape, and the shape picks the game:

| Joke shape | Template |
|---|---|
| A phrase somebody always says / a place you always end up | The Hangout (today's game) |
| The things your group can't stop roasting | The Gallery (built) |
| A disaster trip you keep retelling | The Flight (built) |
| A recurring annoyance the group defends against | The Defense (built) |
| Us-against-the-world absurdism | The Mission (built) |
| Somebody's escalating spiral | The Climb |
| The vacation crew | The Slope |
| The rec league / fantasy league | The Derby |
| What somebody keeps dragging into the chat | The Catch |

## The invariants (what makes every template an Inside Joke Game)

Every template, no exceptions:

1. **Their people are in it.** The cast system (host + THE FIRST BOSS +
   THE FINAL BOSS + savior/butterfingers/builder where they fit) maps into
   every template. Bosses are always real people, named on screen.
2. **The catchphrase is the win move** — and it's spoken aloud
   (SpeechSynthesis) when it fires.
3. **Their words verbatim.** Whatever content the template asks for (targets,
   obstacles, waves, trash talk) renders word-for-word as typed.
4. **Tone gate** — per-group `forbiddenWords` only. There is no
   universal/baseline word list and no punchline-only "FREE" carve-out
   — that rule is retired repo-wide and must not be reintroduced (see
   `SPEC-flight.md`'s config section, and `tools/verify-config.js`'s
   `toneGateSource`, the one source of truth for this rule).
5. **A game IS a link** — template rides the fragment as a whitelisted enum;
   free games cost nothing to host.
6. **Self-verified** — each template ships a vm-harness driver; a config that
   can't be played to its end card never ships.
7. **Music sets** (Phase M) and the **character roster** (Phase C) are
   framework-level and feed every template.

## Architecture

- **Framework extraction.** The reusable subsystems already exist inside the
  Hangout engine: fitCanvas/DPR/mobile/rotate-prompt, input (keyboard/touch
  joystick/gamepad → move + action), the audio engine (sample SFX, music-set
  player, ducking, speech synthesis), the card/tutorial system, typewriter
  speech bubbles, particles, localStorage conventions, the cfg codec. Extract
  to `shared/framework.js` (one real shared file — the old two-page
  duplication convention stops paying once there are 3+ consumers). The
  Hangout engines migrate to it with byte-identical behavior (harness-
  asserted, same discipline as every extraction so far).
- **A template is a folder**: `gallery/`, `flight/`, `defense/`, `mission/`,
  each with `engine.js` + a SPEC + a verify driver registered with the
  harness. Today's `game/` + `intro/` pair IS the `hangout` template
  (unchanged paths — every existing link keeps working).
- **Config**: top-level `template` enum (absent → `'hangout'`). Each template
  defines which config sections it reads; cast/punchline/music/forbiddenWords
  are universal. Fragment schema: the enum plus per-template capped-text
  content fields (e.g. `gallery.targets[]`), whitelisted like everything else.
- **Wizard**: first step becomes "What's the joke?" — joke-shape cards that
  recommend a template (browse-all available). Shared steps (group, cast,
  catchphrase, vibe) stay; the content step adapts per template (the stories
  step is the Hangout's content step; the Gallery asks for roastables; the
  Flight asks for the trip; the Defense asks for the annoyance). The setting
  step shows only for templates with scenes.
- **Determinism**: all in-game randomness seeds from the gameId hash (rule
  established in Phase M) so links replay identically and harness drivers
  stay deterministic.

## The catalog

Build costs are relative to one Hangout (≈ the KCK engine's scope).

### 1. The Gallery — carnival shooting stall 【Shooting Gallery pack; ~0.4×】
The group's roastables as pop-up targets. Tap/click to shoot — mobile-native,
one screen. Targets carry THEIR labels on plaques ("THE KAYAK", "MARCO'S
6/10"). The group's own faces (roster sprites) pop up as DON'T-shoot targets
— except the bosses: THE FIRST BOSS swings across on a jumbo target heckling
in their own words; THE FINAL BOSS is the last round's whole-stall takeover.
Catchphrase = the special shot: screen-clearing, spoken aloud, earned by a
clean streak. Kenney's stall kit (curtains, ducks, rifle, shot markers) is
purpose-made. End card: per-target stats in their words.
Content asked: 4-8 roastables (short labels), optional per-boss heckle line.

### 2. The Flight — one-button disaster reenactment 【Tappy Plane; ~0.3×】
"The trip" as a flappy run. The host's roster sprite pilots; obstacles are
story-labeled hazards; at distance milestones the story lines appear as
speech bubbles retelling the disaster as you relive it; THE FINAL BOSS swoops
in as the last gate before the landing. Catchphrase = one-per-run shout that
clears the screen. Score = how far into the trip you got; links are
score-chases in the group chat. Smallest build; the pack ships everything
including ground/ceiling variants for trip "legs" (grass/ice/rock/snow —
the trip gets colder as it gets worse).
Content asked: the trip story (3-6 beats, in order), what the hazards were.

### 3. The Defense — everyone defends the thing 【Tower Defense pack; ~1.0×】
The deepest "everyone's in it" template: EVERY cast member stands as a tower
doing their personality — the first boss snipes (of course they do), the
savior heals, butterfingers drops things on enemies by accident, the builder
builds barricades. Waves are the recurring annoyance, typed by the group
("MONDAY MEETINGS", "PARKING TICKETS"), marching on the thing the group
protects. THE FINAL BOSS leads the last wave, then turns good at the end
(the series' signature arc). Catchphrase = the whole-cast rally that
double-rates every tower once per game.
Content asked: what you defend, what keeps coming, who does what (auto-
suggested from roles).

### 4. The Mission — the squadron 【Space Shooter Remastered / Pixel Shmup; ~0.7×】
Us-against-the-world. The cast flies as a squadron (roster faces in the
cockpits), wingmates doing role-flavored support; the boss fleet beams THEIR
lines across the screen between volleys; catchphrase = the super-beam.
Spectacular, classic, and the Remastered pack (enemies, lasers, meteors,
damage states, power-ups, backgrounds) is among Kenney's richest.
Content asked: the mission ("FIND THE BEST TACO"), what the enemy swarm is.

### 5-9. Second wave (specced when reached)
- **The Climb** 【Jumper Pack; ~0.4×】 — doodle-jump up somebody's spiral,
  platforms labeled with the escalating story; bosses knock you down.
- **The Slope** 【Tiny Ski; ~0.4×】 — slalom the vacation, gates = their
  milestones, the yeti wears the final boss's name.
- **The Derby** 【Sports Pack; ~0.5×】 — penalty shootout / home-run derby
  vs. a boss keeper who trash-talks in their own words.
- **The Catch** 【Fish Pack; ~0.4×】 — reel up what they keep dragging into
  the chat; one boss fish.
- **The Paint War** 【Splat Pack; ~0.7×】 — splat-tag rivalry; needs a tone
  pass on aim-at-friends mechanics before committing.

## Build order and why

**Gallery → Flight → Defense → Mission.**

Gallery first: smallest full-quality build, mobile-native input, and the most
literal expression of "their jokes on screen" — every target is a thing the
group actually says. Flight second: cheapest, and the score-chase loop gives
links a reason to bounce around the chat repeatedly (retention the Hangout
doesn't have). Defense third: the most personal (whole cast animated at
once) — worth its full-Hangout cost after two quick wins. Mission fourth:
spectacle and breadth.

Framework extraction happens WITH the Gallery build (extract exactly what the
Gallery needs, prove Hangout parity, extend as later templates demand more —
never a big-bang rewrite).

## What existing work becomes

Nothing is discarded. Skeletons = the Hangout's scene system (and the pattern
for any template with scenes). The roster (Phase C) supplies faces to every
template. Music sets score every template (each template maps its own beats
onto the six slots). Boss framing, tone gate, codec, wizard, verify harness,
INTAKE/FULFILLMENT — all framework-level.

## Verification per template

Each template registers a driver with tools/verify-config.js's harness:
- gallery: deterministic target schedule → simulated shots at known
  positions → final round → end card.
- flight: seeded gap sequence → timed flap inputs → boss gate → landing.
- defense: scripted tower placement → run all waves → last-wave boss → turn-
  good → end card.
- mission: sweep-and-fire strategy → boss fleet → end card.
The scene-matrix principle holds: template mechanics are scene-independent,
so the matrix stays linear (templates + scenes, not templates × scenes).
