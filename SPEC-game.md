# Karks Cub Kingdom — Playable Demo Spec

Top-down Zelda-style playable sequence: punchline → heart capture → critic boss
fight → fake death → wagyu resurrection finale. Deliverable:
`game/index.html` (single file + reuse `intro/assets/`), plus small text edits
to the existing `intro/index.html`.

## Golden rule of tone

**Never explain the joke.** No text anywhere may mention cost, money, price,
bills, or things being free — EXCEPT the punchline itself, "FOR FREE?".
The stories are mundane, the chef asks "FOR FREE?", that's the whole bit.

## Intro edits (`intro/index.html`)

1. Scene 1 lines are currently "...NO COIN WAS ASKED." / "NO BILL EVER CAME."
   Replace all three lines with:
   - `LONG AGO, IN THE KINGDOM OF KARK,`
   - `CHEF GABE PREPARED A FEAST FOR FOUR GUYS.`
   - `THE STORIES THEY TOLD WERE VERY ORDINARY.`
2. Scene 4 text `IT COSTS... NOTHING.` → `IT IS EXTREMELY MARBLED.`
3. Title screen PRESS START (and any click/key on the title) now navigates to
   `../game/` instead of replaying. Attract-replay after 25 s idle stays.
4. Title lockup renamed from "THE LEGEND OF WAGYU" to **KARKS CUB KINGDOM**
   (two-line hand-built pixel lockup, `KARKS CUB` / `KINGDOM`); the `FOR
   FREE?` terracotta ribbon subtitle stays exactly where it was.

## Game (`game/index.html`)

Same technical base as the intro: single file, canvas 960×540, pixel-crisp,
integer scaling, WebAudio-only sound, same palette, same asset PNGs via
`../intro/assets/`. Port stays 8807 (served from repo root). Copy/adapt the
intro's audio engine (sequencer, voices, jaw-harp KS twang, Theme A/B tables).
Root `index.html` (repo root): meta-refresh redirect to `intro/`.

### Player

The chef. 16px sprite (same one as intro Scene 4) at 4× scale. Moves with
WASD/arrows/d-pad, 8-direction, ~220 px/s. One action button: Space / click /
gamepad A — context-sensitive (say the line / throw bottle). Hearts UI top-left
(Zelda style: full/half hearts, max 6). Start with 3 hearts.

### Arena

One room, the dinner party: Tiny Dungeon floor tiles, terracotta table in the
center with 4 seated diners (the intro's Scene 3 look), kitchen doorway with
warm glow bottom-right (player spawns there), main door on the left wall.
The table is solid (collision); diners are solid. Keep 8-px collision grid.

### Beat 1 — the punchline (×2–3 rounds, config/preset-dependent -- see "Template & roles")

1. A diner's speech bubble types a mundane story (reuse typewriter):
   - Round A: `I DRANK A GLASS OF RIESLING` / `SO NOBODY ELSE HAD TO.`
   - Round B: `I STAYED TILL THE SEVENTH INNING` / `OF A TWELVE TO ZERO GAME.`
     (spec originally said "TWELVE-NOTHING" -- changed to avoid the tone
     grep's own NOTHING gate; same mundane baseball-score beat)
2. When the story completes, a bouncing `!` prompt appears over the chef.
   Player presses action → the chef **clearly says "FOR FREE?"**:
   - Big chunky gold text `FOR FREE?` slams over the kitchen doorway
     (same style as intro Scene 3) + jaw-harp twang + screen shake.
   - **Spoken aloud** via the SpeechSynthesis API: utterance "For free?",
     rate 0.85, pitch 0.7 (deadpan). Pick the first available local voice;
     if speechSynthesis is unavailable or has no voices, skip silently —
     the text + twang carry it.
   - Timing bonus: pressing within 1.2 s of story completion = "PERFECT"
     flash and +2 extra hearts in the scatter below.
3. **The table goes crazy**: all four diners bounce, HA-HA particles, drums
   kick in — and 6–10 small laugh tokens burst from the table on a lobbed
   z-arc (napkin-style) out to a pre-vetted floor point beyond the table's
   edge, so they visibly float up and over it rather than sliding on flat
   friction; every landing spot is guaranteed outside the table/walls (any
   spot that would fail that check gets slid back onto open floor before it's
   allowed to settle) so a token can never rest somewhere the player can't
   reach. They sit and blink; despawn after 6 s.
4. **Laugh capture**: player runs and collects them before they vanish
   (pickup radius ~20 px, Zelda pickup chime, +half-heart-unit each, cap 6
   full). A big chunky `CATCH THE LAUGHS!` banner pops in (0.2 s) / holds
   (1.2 s) / fades (0.4 s) centered in the upper third at the start of every
   capture phase (not just the first — gameplay is never paused for it; the
   one-time tutorial card still pauses on the very first capture, and the
   banner effectively resumes once that's dismissed). A small persistent hint
   also shows bottom-center on the first round only.
5. Short breather, next round. After round B's capture, go to Beat 2.

**Laugh drain (time pressure)**: while the player is anywhere in Beat 1
(`story`/`prompt`/`capture`/`breather`), the laugh meter ticks DOWN one
half-unit on a steady clock — every 4.5 s in normal mode, every 2.75 s in
hard mode (`DIFF.laughDrainInterval`). No drain in Beat 2 or later (napkins
are the pressure there instead), and the clock automatically pauses whenever
a card/mode-select/rotate-prompt has the game frozen, since it only advances
inside `update(dt)`, which `frame()` already skips entirely in those states —
no extra guarding needed. The economy: stories/punchlines/captures refill the
meter (the existing scatter/capture), the clock drains it — dawdle between
punchlines and the room goes cold. Sanity-checked against the actual round
timings in code: an attentive player (reacts to the prompt immediately,
actively chases capture tokens) nets positive every round and finishes Beat 1
with hearts to spare in both modes; a responsive-but-disengaged player (still
presses through the story/prompt promptly, but never chases capture tokens,
so gains nothing from them) runs out of laughs partway through round 2 in
normal mode, and even sooner in hard mode. See "Hard mode" below for the
hard-mode-specific values.

**Visuals**: the HUD chip that the *next* drain tick will hit pulses and
fades as the tick approaches (urgency ramps up in roughly the last 40% of the
interval), and on each lost half a small grey `ha` puff drifts up off the
meter with a soft, low two-note down-blip (quiet, low-register — reads as
"a little air going out of the room," not an alarm).

**Death by silence**: if the meter hits 0 during Beat 1:
- Normal mode: game over with the existing `OKAY. WE GET IT.` treatment →
  retry card → `TRY AGAIN` calls a new `retryBeat1()`, which restarts the
  **current** round at its story (hearts back to 6 halves, `roundIndex` left
  untouched so round progress is preserved, stats keep counting) —
  `gameOverReason` is set to `'beat1'`.
- Hard mode: routes through the same `gameover` → lose-card flow as every
  other hard-mode death (no mid-beat retry) — hard mode's early-press floor
  removal already allowed a Beat 1 death via mashing; the drain clock is
  simply a second way to reach the same ending.

The tutorial card (`DINNER IS SERVED`) gained a fourth line:
`DON'T LET THE LAUGHTER DIE.`

### Beat 2 — the critic boss

Intro moment: the glasses diner stands up — bubble: `OKAY. WE GET IT.` — walks
to the RIGHT wall, and **a door appears halfway up the wall** (frame + door
tile floating ~130 px above the floor, clearly absurd, with a 0.5 s "pop"
sparkle). He climbs into it (brief scripted hop) and leans out. Boss HP bar
appears top-center: `THE CRITIC` — 6 segments.

**His attacks** (he stays in the elevated door; player must dodge):
- Lobbed crumpled napkin balls (arcing projectiles with shadow blobs that
  telegraph the landing spot; ~1 every 1.4 s ±25% jitter). Contact or landing
  burst = −half heart, 0.8 s i-frames + blink.
- Every ~6 s ±25% jitter: a spoken critique — bubble text cycles
  `WEAK PREMISE.` / `DERIVATIVE.` / `THE SOUP WAS LUKEWARM.` /
  `I'VE HEARD THIS STORY TWICE.` / `GOOD THING HE BOUGHT ALL THE BASEBALLS AT
  THE GAME.` (callback to Round B's story) — each accompanied by a 3-napkin
  fan volley (5 in phase 2).
- SpeechSynthesis optional for critiques (same fallback rule), rate 1.0,
  pitch 0.6, only if the punchline speech worked.

**Attack patterns (anti-circling)**: every single throw and every volley
independently rolls one of 4 aiming patterns rather than always aiming at the
player's live position, so no one fixed movement habit (e.g. holding a
steady circle-strafe) is ever safe:
- ~35% (phase 1) / ~30% (phase 2) **LED** — aim at player position +
  velocity × 0.45 s (0.6 s in phase 2).
- ~30% / ~20% **DIRECT** — aim at the player's current position; punishes
  stopping/reversing to bait the lead.
- ~20% / ~20% **SCATTER** — 3 napkins at randomized offsets 60–130 px (45–95
  px in phase 2) around the player — covers a circle path both ahead and
  behind.
- ~15% / ~30% **CUTOFF** — aim 2× the lead distance ahead along the player's
  current heading — lands where a circler is about to be.
Every throw's timing also gets ±25% random jitter so the rhythm can't be
memorized. Shadows still telegraph the exact landing spot for the full flight
either way — the goal is that dodging requires reading the telegraph, not
holding one direction.

**Player attack — riesling throw**: riesling bottles (green pixel bottle,
14×6) spawn one at a time on the table's near edge (respawn 2.5 s after
pickup). Walk over one to pick it up (bottle icon shows next to hearts; carry
max 1). Action button throws it in an auto-aimed arc at the boss door. Hit =
−1 boss HP, glass-shatter noise burst + splash particles + boss "OW."-style
recoil. Miss (he ducks into the door randomly, ~25% of throws when above 3 HP)
= bottle shatters on the wall.

**Fake death at 1 HP**: his next hit doesn't kill — instead:
- He slumps over the door edge, arms dangling. Boss bar shatters. Victory
  jingle STARTS playing (first 4 notes of the item-get fanfare)…
- …record-scratch (noise sweep), he pops back up: bubble
  `JUST KIDDING.` then `ALSO: THE SOUP WAS COLD.`
- Bar reappears with 4 segments, phase 2: napkins every 0.9 s, volleys of 5,
  landing bursts bigger. He no longer ducks.

**Real death**: at 0 HP he slumps for real, drops a single big heart (full
heal), the wall door sags shut behind him, music drops to the soft intro
arpeggio.

### Beat 3 — the wagyu resurrection

1. The LEFT main door opens: **the woman enters** carrying a platter with the
   wagyu (pink marbled steak sprite + rotating sparkles). She walks slowly to
   the slumped critic. Bubble (sincere, typed slowly):
   `EXCUSE ME...` / `I BROUGHT THE WAGYU.`
2. She offers the wagyu — sparkle burst — **it brings him back to life**:
   he springs upright in the wall door, fully restored, adjusts his glasses.
3. One full beat of silence (0.9 s, music fully ducked)…
4. **EVERYONE says it at once**: simultaneous speech bubbles over all four
   diners, the woman, AND the boss — each just `FOR FREE?` — plus the giant
   gold `FOR FREE?` slam, jaw-harp gallop, screen flash, drums. If speech
   worked earlier, speak it once more.
5. Does NOT freeze/cut to the end card yet — flows straight into Beat 4.

### Beat 4 — Aram

Right after the unison finale, the LEFT door slams open: **Aram**, the
chef's boss, storms in (a hand-tinted ~2× diner-scale sprite, dark red/angry
palette, simple hand-drawn angry brows over the base sprite). He walks in to
about mid-room and delivers two sequential bubbles: `A ONE-STAR GOOGLE
REVIEW?!` then `WHO DID THIS?`. Tutorial card (shown once, same freeze-the-
game card system as the others): title `ARAM HAS ARRIVED` — body `CHEF
GABE'S BOSS SAW A BAD REVIEW.` / `CHASE THE GUYS. BEG FOR FIVE STARS.` /
`DON'T GET CAUGHT.`

**Gameplay**: Aram chases the player directly at 0.8× player speed; contact
(≈36 px, 1 s cooldown) costs half a heart-unit, grants 1.0 s i-frames (longer
than the boss's 0.8 s, since he's a persistent chaser not a one-shot
projectile), and knocks the player back ~40 px. Meanwhile the three
non-critic seated diners, the woman, and the revived critic (who is fixed to
actually re-render post-fight — see Implementation notes) all wander the
room on random floor waypoints (~50 px/s, avoiding the table). Any of them
within ~120 px of the player flees (~130 px/s — slower than the player's
220 px/s, so they're always catchable; resumes wandering only past ~160 px,
to avoid flee/resume flicker right at the boundary).

**Begging**: within ~40 px of a non-fleeing, not-yet-reviewed character,
press the action button: the chef's own speech bubble reads `PLEASE. FIVE
STARS.`, that character stops and "checks their phone" (small blinking phone
icon, ~1.2 s), then a row of 5 small gold stars floats up from them and the
review counter ticks — each character can only give one review. HUD top-
center during the chase: `<n>/3` in gold plus 3 small hand-built star icons.

**Turning good**: at 3/3 reviews, Aram freezes mid-chase and "checks his
phone" for ~1.5 s, then turns good (warmer palette, brows relax) while
everyone else cheers (bounce + HA bursts + sparkle confetti, fanfare into
full Theme B). Sequential bubbles: `FIVE STARS...` then `DINNER AT MY PLACE.
SOMETIME.` — then flows into the win celebration below (not straight to the
end card), with an added stat line `FIVE-STAR REVIEWS: 3` on the eventual
end card.

**Failing Beat 4**: player hearts hit 0 during the chase → same dimmed
retry-card flow, but the bubble reads `THE REVIEW STANDS.` and `TRY AGAIN`
restarts Beat 4 specifically (reviews reset to 0, characters reset to
wandering; the ARAM HAS ARRIVED card is not reshown).

**Implementation note**: the critic is left in a `state==='dead'` limbo after
his real death (which is how his sagging-door fade-out plays), and nothing
previously cleared that before Beat 3's resurrection beat — fixed by setting
`boss.state` to a distinct "revived" value (not the fight's `active`, so the
HP bar and attack AI never come back) as soon as the revive beat starts, so
he's actually visible/wanderable/beggable for Beat 3's finale and all of
Beat 4.

### Win celebration

After Aram turns good: a ~5 s beat where the 3 remaining seated diners + the
woman + the revived critic + Aram converge loosely around the chef and
celebrate — continuous staggered bouncing/HA/sparkle bursts (each participant
on its own cadence so it reads as a crowd, not synchronized robots), a
~100-piece falling confetti field, a warm lighting lift, a couple of soft
gold screen flashes, four `FOR FREE?` pop-in/out texts in rotating corners,
and one final giant centered slam near the end. Then flows into Epilogue A
(not straight to the end card).

### Epilogue A — the bathroom (~8 s, gameplay locked)

A pure cutscene. The music ducks low. One seated diner gets up and walks to a
small bathroom door cut into the TOP wall (same dark-gap-plus-wood-frame
visual language as the other doors). He stops, pulls out his phone (the same
small phone-rect-over-the-head animation as Beat 4's begging reviewers), and
delivers three sequential slow-typed bubbles with holds: `DELETE ALL?` …
`DELETED.` … a longer comedic beat … `ALL MY PHOTOS.` — then a shocked bounce,
a sad descending synth gliss, and the rest of the table (the two diners not
involved) erupts in HA bursts. He trudges back to his seat, and Epilogue B
begins.

### Epilogue B — the guy who built this (~10 s, letterboxed like the Aram staging)

A meta joke: one of the guys flew home and built this exact game. Three
shots, always letterboxed:

1. A pixel airplane flies right-to-left across a deterministic night-sky/
   skyline strip (same visual spirit as the intro's starfield). Caption:
   `ONE OF THE GUYS FLEW HOME...`
2. Cut to a tiny room: a guy at a desk with a glowing computer screen. The
   screen renders a miniature KARKS CUB KINGDOM title lockup (the same
   hand-built pixel-glyph title-canvas system, ported into `game/index.html`
   since it's a separate document from the intro and can't literally share
   the canvas object, scaled down small). He types — a tap-tap hand
   animation plus soft key-blip sound ticks. Caption: `AND BUILT THIS EXACT
   GAME.`
3. The sparkle/link flies from his screen and splits into FOUR notifications
   — the four original diners' sprites appear in a row, each phone pinging
   with a sparkle burst + a soft chime, one after another. Caption: `AND
   SHARED IT WITH THE GUYS.`

Then letterbox out, back to the dining room for Beat 5.

### Beat 5 — tech support (playable, no death)

One of the guys is having trouble hearing the game and the player has to
chase him down and ask if he reset it. Tutorial card (shown once): title
`TECH SUPPORT` — body `ONE OF THE GUYS CAN'T HEAR THE GAME.` / `CHASE HIM
DOWN.` / `ASK IF HE RESET IT.`

The target diner wanders/flees exactly like Beat 4's reviewers (a deliberate
copy+adapt of that same wander/flee algorithm, not a shared call, since the
two have unrelated completion semantics), with a periodic bubble `I CAN'T
HEAR THE MUSIC.`. Catching him (within the same ~40 px beg-style radius) and
pressing the action button shows the chef's own `DID YOU RESET IT?` bubble;
his replies cycle per catch: 1st `WHAT?`, 2nd `IT'S JUST BEEPING.`, 3rd
`STILL NO SOUND.`, 4th (final in normal mode) `OH. IT WORKS NOW.` — on the
final catch the music swells (full duck-up + fanfare), a mini group cheer
plays (HA bursts from the nearby cast), then freeze → end card. **No damage,
no laugh drain, no death in this beat** — pure comedy chase. The other two
seated diners idle/bounce occasionally; Aram (now turned good) just stands
and watches. Hard mode needs a 5th catch (see Hard mode below); since only
the 4 listed lines are tone-pre-cleared, the extra catch repeats `STILL NO
SOUND.` rather than inventing new dialogue, and `OH. IT WORKS NOW.` always
lands on whichever catch is actually final. The end card gets a new stat
line `RESETS SUGGESTED: n` (the total number of `DID YOU RESET IT?` asks).

### Failure state

- **Beat 1** (early press with no floor in hard mode, or the laugh-drain
  clock hitting 0 in either mode): screen dims, bubble `OKAY. WE GET IT.` →
  retry card → `TRY AGAIN` calls `retryBeat1()`, restarting the current round
  at its story (hearts back to 6 halves, round progress preserved, stats
  keep counting).
- **Boss fight** (Beat 2): player hearts hit 0 → screen dims, bubble from the
  whole table: `OKAY. WE GET IT.` → retry card (`TRY AGAIN` restarts Beat 2
  with 3 hearts; stats keep counting).
- **Aram's chase** (Beat 4): player hearts hit 0 → screen dims, bubble:
  `THE REVIEW STANDS.` → retry card restarts Beat 4 (reviews reset; stats
  keep counting; the tutorial card is not reshown).
- In hard mode, **all three** of the above skip the retry card entirely and
  go to the lose card instead (see Hard mode).

### Music

- Beat 1: Theme A loop (no drums until the first FOR FREE? slam, then drums).
- Beat 2: Theme A transposed feel at 140 BPM with drums (reuse note tables,
  scale the beat clock), + low drone. Phase 2 after fake death: add the
  harmony voice and hats on sixteenths.
- Beat 3: silence → arpeggio → full Theme B for the unison finale.
- Beat 4: Theme B loop at ~140 with drums for the chase; a duck into the
  turn-good fanfare, then full Theme B again for the cheer.
- Keep all ducking behavior from the intro engine.

**Real soundtrack (`assets/music/theme.mp3`)**: both the intro and the game
route a looping `<audio>` element through `createMediaElementSource()` into
the same `musicGain` node the chiptune scheduler already used, so every
existing ducking call works unchanged on the real track with no special-
casing. The chiptune scheduler keeps running underneath (cheap bookkeeping,
still drives tempo/section-program state) but its note-dispatch is silently
skipped once the track is confirmed playing — every direct one-off SFX call
(beeps, dings, twangs, slam booms, whoosh, chimes, fanfare, record scratch,
groan, rumble, glass shatter, speech synthesis) is untouched either way,
since none of those go through the scheduler. If the file fails to load or
`MediaElementSource` isn't available, playback silently stays on the
chiptune system — this must never result in silence. Playback starts on the
same user-gesture that already unlocks the AudioContext today.

### Hard mode — "Second Seating"

Unlockable, offered after beating the game once, genuinely losable.

**Unlock + entry**:
- Any win (reaching the end card) sets `localStorage['kck_beaten']='1'`. The
  end card additionally shows `HARD MODE UNLOCKED` / `SECOND SEATING AWAITS
  AT THE START` big, the very first time it flips on; on every later win it's
  just a small corner note instead of retaking the card.
- On page load, if `kck_beaten` is set, a mode-select card shows **before**
  the `DINNER IS SERVED` tutorial card: title `CHOOSE YOUR SEATING`, two rows
  `FIRST SEATING -- A NICE DINNER` / `SECOND SEATING -- MUCH HARDER. YOU CAN
  LOSE.`. Arrow keys/WASD move the highlight (default: FIRST SEATING), Space
  confirms (gamepad d-pad + A too). Without the flag, boot is unchanged.
  If `kck_hard_cleared` is set, a small gold star shows next to SECOND
  SEATING in this card.
- A single `hardMode` boolean, decided once at mode-select and never changed
  mid-run. Every difficulty-sensitive constant resolves through a `DIFF`
  table (`D(key)` picks `.normal` or `.hard`) instead of being a bare
  literal — every `.normal` value is exactly the old literal it replaced, so
  normal mode is guaranteed byte-identical to its pre-hard-mode behavior.

**Hard-mode ("Second Seating") changes**:
- Player: heart cap 8 half-units (4 laugh chips) instead of 12; still starts
  at 6 halves.
- Beat 1: story typing ~30% faster (20 → 26 cps); the PERFECT window shrinks
  1.2s → 0.6s; an early press costs a FULL heart (2 halves) with **no
  floor** (normal mode floors at 1 half so Beat 1 can never be fatal; hard
  mode has no floor, so three early blurts can and do end the run —
  `OKAY. WE GET IT.` game over); the laugh scatter drops ~40% fewer tokens
  and they despawn in 4s instead of 6s; the laugh-drain clock (see Beat 1
  above) ticks every 2.75s instead of 4.5s — noticeably tighter, since the
  round itself is also shorter (faster typing, fewer/shorter-lived tokens).
- Beat 2 (the critic): 8 HP (phase 2 returns at 6, was 4); napkin interval
  1.0s (0.65s in phase 2, was 1.4/0.9); volleys of 4 (6 in phase 2, was 3/5);
  napkin damage is a full heart (2 halves, was 1); duck chance is 35% at
  **all** HP levels/phases (normal mode only allows ducking above 3 HP and
  never in phase 2); LED/CUTOFF lead-prediction times run 30% longer.
- Beat 3: unchanged — it's a cinematic, not a combat beat.
- Beat 4 (Aram): his speed is 0.95× the player's (was 0.8×); contact damage
  is a full heart (2 halves, was 1); needs 4 of the 5 reviewers instead of 3;
  begging takes 1.8s instead of 1.2s (longer exposure while stationary);
  reviewers flee at a higher speed and a larger detection radius.
- Beat 5 (tech support, no death either way): he flees faster (185 px/s vs
  140) and it takes 5 catches to resolve instead of 4 (`DIFF.techFleeSpeed`,
  `DIFF.resetsNeeded`).
- **Losing is real**: in hard mode there is no mid-beat retry. Any game over
  (a fatal early press or laugh-drain death in Beat 1, the boss fight, or
  Aram's chase) skips the usual dimmed-bubble-then-`TRY AGAIN` flow and goes
  straight to a lose card:
  big `THE DINNER IS RUINED.`, the run's full stat block, and a blinking
  `PRESS START` that returns to the title (`../intro/`) — the whole run
  restarts from scratch, exactly like a fresh page load.
- **Hard-mode win**: the end card shows an extra gold line
  `SECOND SEATING CLEARED` and sets `localStorage['kck_hard_cleared']='1'`.

### Template & roles

Every personalized element of the game lives in one `CONFIG` object,
`game/config.js`, loaded via `<script src="config.js"></script>` **before**
`game/index.html`'s inline `<script>`, so `CONFIG` is a plain global by the
time the game code runs. Karks Cub Kingdom (this repo, as shipped) is
**CONFIG #1** — `game/config.js` contains KCK's exact current content, and
the game plays byte-identically to the pre-Phase-B build when loaded with
it (asserted by the harness: story text, boss HP, punchline, rank names,
critique/duck/hit lines all match the old hardcoded literals verbatim).

**Config sharing with the intro.** `intro/index.html` needs the title,
punchline, story, and music values too. Rather than a second copy or a
repo-root shared file, it loads the *same* file game/index.html uses, one
level up: `<script src="../game/config.js"></script>`. This keeps exactly
one CONFIG per game (no drift between the two pages) and needed no new
build step — a personalized game's `intro/` and `game/` folders are always
deployed together as siblings, so the relative path always resolves.

**Text convention.** Every CONFIG field is a complete, already-composed
string or line array — there's no generic template engine. The one
exception is two reusable tokens, `{HOST}` and `{ITEM}`, which a small
`fmt(s)` helper (defined identically in both `game/index.html` and
`intro/index.html`, same duplication convention as the audio engine)
replaces wherever they appear: `{HOST}` → `CONFIG.host.name`, `{ITEM}` →
`CONFIG.savior.itemName`. This covers the handful of sentences that repeat
the host's name or the gift item's name across both files (e.g. "CHEF
{HOST}... YOU SAVED THE DINNER.") without needing a user/Claude-mapping
step to keep four separately-authored sentences in sync by hand. Everything
else — stories, critique lines, cast anecdotes, epilogue captions — is
free-form text with no placeholders, written whole by whoever maps an
order's intake to its config (see `FULFILLMENT.md`, Phase C).

**Role archetypes** (`CONFIG.cast`): `host` is required (the player, always
"the chef"). `judge`, `authority`, `savior`, `butterfingers`, `builder` are
each optional — set the slot to `null` in `CONFIG.cast` to skip that role.
A role's *content* bucket (`CONFIG.judge`, `CONFIG.authority`, etc.) can be
omitted from a config entirely once its role is uncast — nothing reads it —
the shipped `examples/test-group.config.js` does exactly this, to prove the
uncast path never touches that content.

Beat-enable flags are derived once at load, from the cast, and every beat
transition checks them before advancing instead of a hardcoded next-phase
name:

```
JUDGE_CAST         = CONFIG.cast.judge != null
AUTHORITY_CAST     = CONFIG.cast.authority != null
SAVIOR_CAST        = CONFIG.cast.savior != null
BUTTERFINGERS_CAST = CONFIG.cast.butterfingers != null
BUILDER_CAST       = CONFIG.cast.builder != null

BEAT2_ENABLED         = JUDGE_CAST
BEAT3_ENABLED         = JUDGE_CAST && SAVIOR_CAST
BEAT4_ENABLED         = JUDGE_CAST && SAVIOR_CAST && AUTHORITY_CAST
EPILOGUE_A_ENABLED    = BUTTERFINGERS_CAST
EPILOGUE_B_ENABLED    = BUILDER_CAST   // also gates Beat 5, the same role's finale
```

**The degradation map.** Beat 3 (revival) and Beat 4 (Aram) are each
narratively *downstream* of the critic incident, so they're gated by AND,
not independently — a role missing upstream disables everything built on
top of it, not just its own single beat. Reading the bullets below as
independent single-role-missing scenarios and combining them via the flags
above is exactly the implemented behavior:

- **No JUDGE**: no boss fight at all. Dinner rounds flow straight to
  celebration — Beat 2, Beat 3, and Beat 4 are all skipped (Beat 3/4 are
  aftermath of the critic incident, which never happened).
- **No AUTHORITY** (judge + savior *are* cast): the boss fight, fake death,
  and wagyu revival all play out normally; the unison "FOR FREE?" flows
  straight to celebration instead of Aram's chase — Beat 4 alone is skipped.
- **No SAVIOR** (judge *is* cast): the critic's real death flows straight to
  celebration — no revival scene, and (since Beat 4 needs a revived judge to
  make sense) no Aram chase either.
- **No BUTTERFINGERS**: Epilogue A (the bathroom) is skipped; celebration
  flows to Epilogue B if BUILDER is cast, or straight to freeze/end card if
  not.
- **No BUILDER**: Epilogue B *and* Beat 5 are both skipped (BUILDER stars in
  both — he's the one who built the game AND the one who can't hear it) —
  flow goes straight from celebration (or Epilogue A, if BUTTERFINGERS is
  cast) to freeze/end card.

Every beat this affects also filters *who's on screen*: `celebrationParticipants()`
(unlike `getReviewerList()`, which is only ever called once Beat 4's full
precondition chain has already succeeded) includes the woman only if she
ever arrived, the critic only if he was actually revived, and Aram only if
he actually turned good — so a skipped character is never silently rendered
mid-celebration. The two seats not tied to a specific role (`diner0`, and
whichever of judge/butterfingers/builder isn't running its special beat
this game) are always present as ordinary seated diners.

**Cast sprite picks.** `CONFIG.cast.<role>.spriteCol/spriteRow` pick a Tiny
Dungeon sheet tile for the three roles seated at the table before their
beat starts — `judge` (seat 1, before he stands up), `butterfingers` (seat
2), `builder` (seat 3) — plus the unassigned `diner0` (seat 0). An uncast
role's seat still shows a generic diner (falls back to KCK's own tile) —
only that role's dedicated beat is what's actually skipped, never a hole at
the table. AUTHORITY (Aram) and SAVIOR (the woman) keep their existing
bespoke tinted-sprite rendering (Aram reuses the chef's own tile, hand-
tinted; the woman is a single fixed tile) rather than becoming arbitrary
tile picks — re-architecting those two around a config pick is a larger
visual-system change than "extract to config" covers, and isn't needed to
prove the degradation map works. Debug URL entry points (`?start=boss` etc.)
are unaffected by any of this — they're dev tools that force-jump into a
beat regardless of casting, same as before.

**Length presets** (`CONFIG.lengthPreset`: `'full'` | `'five_min'`).
`'full'` is exactly today's numbers, byte-identical, asserted by the
harness. `'five_min'` scales exactly four things (everything else —
Beat 1-4 pacing, laugh drain, napkin timing, Aram's speed, duck chance,
etc. — is preset-invariant by design; five_min is about trip length, not
moment-to-moment difficulty):

- Dinner rounds: only the first 2 of `CONFIG.stories` play (`roundsCount()`).
- Boss HP: 4 (phase 2: 3) instead of 6 (phase 2: 4) — resolved through `D()`
  exactly like hard mode, via a small `LENGTH_DIFF` table checked before the
  main `DIFF` table.
- Epilogue A/B holds run at ~70% of their `'full'` duration (`EP(seconds)`)
  — the *animations* inside them (thumbnail pop-away cadence, desk-screen
  build-up reveal) are untouched, only the static pauses between beats
  shrink; Epilogue B's sharing-shot ping times are scaled along with its
  shot duration so all 4 pings still land inside the shortened shot.
  `DIALOGUE_GAP` itself (shared with Beat 3) is untouched — only Epilogue
  A's *use* of it is wrapped in `EP()`.
- Beat 5: 3 catches needed instead of 4 (`D('resetsNeeded')`).

`five_min`'s hard-mode numbers for those same three DIFF-routed knobs
aren't spelled out by spec (unlocking hard mode is a KCK-specific
meta-progression feature that isn't guaranteed relevant to every user
config, but could in principle be reached from a five_min preset too) — a
judgment call applies the same normal→hard delta `'full'` mode uses:
boss HP +2, phase-2 HP +2, resets +1.

**Music.** `CONFIG.music.customSongPath` — a user's uploaded song, or
`null` for a config with no custom song. When set, it always wins (same
`USE_CUSTOM_SONG` mechanism Phase A built), with `CONFIG.music.loops` (a
`{dinner, boss, chase, celebration, sad, gameover}` map of asset paths)
running as the quiet cover-while-downloading understudy. When `null`, the
loops run at full level as the actual score — `examples/test-group.config.js`
demonstrates this. `CONFIG.music.introFallback` is the intro cinematic's
single fallback loop (it has no per-beat structure to score separately).

**Tone gate.** `CONFIG.forbiddenWords` is KCK's own instance of "words that
must never appear" (its value: `COIN`/`BILL`/`COST`/`NOTHING`) — a config's
own list, not a hardcoded rule, so a differently-themed personalized game
could gate on different words. The verification harness's tone check reads
this list from whichever config it's checking, plus the separate
`CONFIG.punchline` rule (only the punchline's own literal value may contain
the word "FREE").

**Storage.** `CONFIG.gameId` prefixes every localStorage key (`STORAGE_PREFIX`,
`skey(name)` → `` `${STORAGE_PREFIX}_${name}` ``) — `kck_volume`/`kck_beaten`/
`kck_hard_cleared` for KCK, `test-group_volume`/etc. for the example config
— so two personalized games hosted under the same origin (e.g. sibling
`/games/<slug>/` paths on Inside Joke Games' Pages site) never stomp each
other's progress or volume setting. The volume key is intentionally shared
between a single game's own `intro/` and `game/` pages (same `gameId`,
same key) exactly as before Phase B — only cross-*game* collisions are new
territory here.

**Verifying a config.** `examples/test-group.config.js` is a second, fully
independent config (different cast, JUDGE uncast, `'five_min'` preset, no
custom song) that's never wired into the shipped pages — it exists purely
to prove the degradation map: point a game/intro pair at it instead (swap
the `<script src>`, or copy it over `game/config.js` for a local check) and
the game skips the boss fight entirely, plays 2 dinner rounds, and still
reaches a complete, satisfying end card through Epilogue A → Epilogue B →
Beat 5. The harness runs both configs' full playthroughs (all beats/both
hard-mode states for KCK; the degraded flow through to the end card for
test-group) plus the KCK literal-parity assertions on every verification
pass.

### Mobile

Both `intro/index.html` and `game/index.html` are touch-playable. `fitCanvas()`
no longer floors the CSS scale at 1× — it shrinks the 960×540 logical canvas
to fit a phone viewport (capping the effective backing-store DPR at 2 once
it's shrinking, so a 3×-DPR phone doesn't pay for a needlessly huge backing
store). The viewport meta disables pinch/double-tap zoom; `touch-action:none`
+ `overscroll-behavior:none` stop scroll/bounce gestures from fighting the
game. `isTouch` starts as an `'ontouchstart' in window` hint and is confirmed
(and locked in) by the first real `pointerdown` with `pointerType==='touch'`.

**Rotate prompt**: on a touch device in portrait, a full-screen "ROTATE YOUR
PHONE" overlay (same visual language as the tutorial cards) blocks input and
freezes the game/cinematic — the game reuses its existing card-freeze branch
in `frame()`; the intro (which is driven by the audio clock, not a frame-
accumulated timer) instead holds the scene at its `sceneElapsedNow()` value
from the moment it froze, then shifts `sceneClockOffset` by the frozen
duration on resume so playback picks up exactly where it paused. Both resume
automatically the instant the device goes back to landscape.

**Touch input (game only)**: a floating joystick — pointerdown on the left
half of the screen anchors it at the touch point; the drag vector (10px
deadzone, saturating at 48px, direction-normalized so diagonals aren't
faster) merges into `getMoveVector()` alongside keyboard/gamepad. The right
half is the action button (`handleAction()`); any tap dismisses tutorial/
lose/end cards regardless of side, since there's no joystick-relevant
gameplay on those screens. Routing is pointer-type-aware (mouse keeps the
old "any click = action" behavior) and tracks `pointerId`s individually, so
the joystick and the action button work simultaneously under real multi-
touch. The hard-mode seating card is tap-to-highlight / tap-again-to-confirm,
mapped through the same client→logical-960×540 transform `fitCanvas()`
establishes. On touch, control hints everywhere become `DRAG LEFT SIDE --
MOVE   TAP RIGHT SIDE -- SAY IT / THROW` and the `GAMEPAD WORKS TOO` line
is hidden.

### Acceptance checklist

- [ ] No text anywhere mentions cost/money/bills/"nothing" (grep the file for COIN, BILL, COST, NOTHING, FREE — only "FOR FREE?" may match FREE)
- [ ] Chef movement + collision solid at 60 fps; no console errors through a full playthrough
- [ ] speechSynthesis speaks "For free?" when available; silent fallback otherwise
- [ ] Laugh tokens scatter (arced beyond the table), bounce, blink, despawn, always land on reachable floor; capture updates HUD; prominent banner shows every capture phase
- [ ] Wall door appears mid-wall; boss telegraphed arcing napkins are dodgeable via 4 randomized aim patterns, not just one fixed strategy
- [ ] Riesling pickup/throw/hit loop works; boss duck behavior only above 3 HP
- [ ] Fake death sequence: slump → jingle start → record scratch → phase 2
- [ ] Wagyu revive → unison FOR FREE? → Aram's chase/beg/turn-good → win celebration → Epilogue A (bathroom) → Epilogue B (meta joke, letterboxed) → Beat 5 (tech support chase, no death) → freeze → end card with stats (including reviews and resets suggested) and rank
- [ ] Laugh-drain clock ticks only during Beat 1, at the correct interval per mode, pauses whenever a card/mode-select/rotate-prompt freezes the game, and hitting 0 triggers the correct gameover→retry/lose path with round progress preserved on a normal-mode retry
- [ ] Game over path works and TRY AGAIN restarts the beat it failed in (Beat 1, Beat 2, or Beat 4)
- [ ] Real mp3 soundtrack plays through musicGain with ducking intact, chiptune SFX unaffected, automatic silent-safe fallback if the track can't load
- [ ] Hard mode: unlocks on any win, mode-select card gates it correctly, every DIFF constant resolves to its normal value when hardMode is false (byte-identical to pre-hard-mode behavior) and its hard value when true, losing in hard mode always goes to the lose card (never the retry card), hard win sets kck_hard_cleared
- [ ] Mobile: canvas fits a phone viewport in landscape with no crop; rotate prompt blocks/freezes in portrait and resumes in landscape; joystick drag and action-zone tap work simultaneously via independent pointerIds; desktop mouse/keyboard behavior is unaffected (no joystick drawn, no zoning) when isTouch is false
- [ ] Intro edits applied (new Scene 1 lines, marbled line, PRESS START → ../game/)
