# SPEC — The Gallery (template #2)

Joke shape: "the things our group can't stop roasting." A carnival shooting
stall where the targets are the group's actual roastables, word for word.
First non-Hangout template; ships with the framework extraction.

## Build plan — three rounds

1. **Framework extraction** — `shared/framework.js`: fitCanvas/DPR/mobile/
   rotate-prompt, input layer (keyboard/touch/gamepad → move vector + action
   + pointer events), audio core (sample SFX, music-set player, ducking,
   SpeechSynthesis wrapper), card/tutorial system, typewriter speech bubbles,
   particle helpers, storage helpers (skey/gameId), chunky/reading text
   renderers. game/engine.js and intro/engine.js consume it. Proof of
   correctness = the ENTIRE existing verification suite passes unchanged
   (playthroughs, skeletons matrix, examples) plus a browser spot-check of a
   fragment game and games/test-group. No behavior change of any kind.
2. **The Gallery game** — `gallery/` (single page, no separate intro; a
   short attract/title screen inside the page). Built ON the framework.
3. **Wizard fork + codec + verify driver** — "What's the joke?" step,
   template enum, gallery content step, generate.js support, harness driver.

## The game (one screen, 5-8 minutes)

**Stall**: Shooting Gallery pack (curtains, wood stall, rows, clouds/trees
backdrop; copy used pieces to `assets/gallery/` + license). Three target
rows (near/mid/far). Crosshair aiming: mouse move + click, touch tap-to-
shoot, arrows/stick + action for keyboard/gamepad (also what the harness
driver uses).

**Targets**:
- Roastables: the pack's duck/target sprites with a small hanging plaque
  showing the label verbatim (auto-fit text, 24-char cap). Hitting one:
  points + satisfying pop + its plaque spins off.
- Friends (DON'T shoot): roster sprites mounted on target sticks, they wave;
  hitting one costs points and they display a hurt "HEY!" bubble with their
  name. Friend pool = cast + extra friend (everyone except the bosses).
- Butterfingers (if cast): occasionally stumbles across a row carrying a
  stack of plates — a moving bonus target; hitting the STACK (not them) is
  a big bonus with a crash; hitting THEM is the friend penalty.

**Rounds**: 3 escalating rounds + boss round + finale. Each round has a
seeded schedule (gameId hash — deterministic per link), a hit quota, and a
timer. Miss the quota → the barker calls TRY AGAIN (retry the round; score
keeps counting). No hard mode in v1 — replay value is the score.

**The barker**: THE BUILDER if cast (their sprite + name runs the stall,
round-intro lines from template strings); otherwise a painted sign does the
job (no generic human).

**THE FIRST BOSS round** (judge slot): a jumbo target of them swings across
on the curtain rope, heckling from their wizard-typed heckle line (fallback:
neutral heckle pool in template strings). N hits; they duck behind the stall
edge; at 1 hit left — fake slump, victory jingle starts, record scratch,
`JUST KIDDING.`, phase 2 faster. (The fake-death gag is house style now,
not any one group's.) Uncast: the round becomes an elite roastable volley.

**THE FINAL BOSS finale** (authority slot): they take over the stall — every
slot pops THEIR face; hit the REAL one (the real one performs their quirk
animation as the tell); wrong picks cost time. Beaten → they come out from
behind the stall and turn good: hand the host the carnival prize (giant
plush from the pack's objects), everyone pops up and cheers. Uncast: grand
all-targets volley finale instead.

**THE SAVIOR** (if cast): when a round is about to be failed (quota
unreachable in remaining time once, per game), they stroll past and tip the
stall — every remaining target pops up simultaneously for one rescue window,
name-credited on screen.

**Catchphrase = the special shot**: a clean streak (no misses, no friend
hits) charges the SAY IT meter; firing it (action button / big center button
on touch) slams the punchline across the screen, speaks it aloud
(SpeechSynthesis, the framework wrapper), clears all active roastables, brief
slow-mo. Once per round.

**End card**: score, accuracy, best streak, per-roastable stats in their
words ("<LABEL> DOWNED: n"), rankNames from config, share nudge.

**Host presence**: corner HUD chip — host roster sprite + "<NAME>'S TURN";
the stall rifle at bottom follows aim.

**Music**: the Phase M sets, mapped: rounds=dinner slot, boss=boss,
finale=chase, win=celebration, fail=sad, gameover=gameover.

## Config / codec / wizard

- `template: 'hangout' | 'gallery'` (absent → hangout). Whitelisted enum.
- `gallery: { targets: [str<=24 x 4..8], firstBossHeckle?: str<=60,
  finalBossQuirk?: str<=60 }` — capped, whitelisted, tone-gated against the
  group's own off-limits list like all text.
- Casting/roster/punchline/music/forbiddenWords: the universal sections,
  unchanged.
- Wizard: step 1 becomes **"What's the joke?"** — two cards:
  "A place you always end up + the stories you retell" → The Hangout;
  "The things your group can't stop roasting" → The Gallery. The setting
  step shows only on the Hangout path; the Gallery path gets a targets step
  (4-8 short labels + the two optional boss lines). All other steps shared.
  Review card adapts per path. Draft state carries `template`.
- Share links: `/gallery/#cfg=…`; the wizard emits the right page per
  template. generate.js: `template` answer field, writes games/<slug>/
  gallery shells when template=gallery.

## Verification

- Framework round: entire existing suite green, byte-parity via behavior
  (playthroughs), zero console errors in browser spot-checks.
- Gallery driver (registered with the harness): rebuild the seeded schedule,
  aim-and-fire at scheduled positions, take the boss round through fake
  death, solve the finale via the quirk-tell (driver reads the seeded real-
  slot index), reach the end card. Runs for: a fully-cast config, a minimal
  config (host only — both boss rounds degrade to volleys, no savior/
  butterfingers/barker), and a no-picks sprite config.
- Tone gate: template strings + any authored heckle pool must contain no
  KCK residue (the de-KCK grep list stays green) and pass the per-group
  off-limits check for the examples.
- New example: `examples/gallery-sample.config.js` + a hosted
  games/gallery-sample/ generated through tools/generate.js.
- Browser pass before deploy: full playthrough on desktop + a touch-emulated
  pass (resize_window mobile), zero console errors, no 404s.
