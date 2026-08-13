# Fulfillment playbook

The per-order operator playbook — meant to be run by a Claude session (with
file/shell access to this repo) once an `INTAKE.md` response comes in.
Target: ≤30 minutes of wall time, ≈zero hands-on beyond reviewing the
diff and pushing.

## The fast path: `tools/generate.js`

Steps 3-5 below (map answers to a config, deploy the shell pages, verify)
are now automated by the generator, for whichever template the order
picked — see `tools/README.md` for the full answers-file schema:

```
node tools/generate.js <answers.json> --base-url=https://<pages-domain>
```

It builds the config, refuses to write anything if that template's own
verification (syntax + a full playthrough + the tone gate) fails, deploys
`games/<slug>/` in the right shell shape for the template on success, and
prints both a hosted URL and an instant, deployment-free `#cfg=` link.
**Step 0, step 1 (turning the raw form response into `answers.json`), and
— critically — step 2 (the content review gate) are NOT automated** and
still need a human before you run the CLI, let alone before you deliver:
the generator has no way to judge whether a story is affectionate ribbing
or something crueler. Steps 3-5 remain documented in full below both as a
reference for what the CLI is actually doing, and as the manual fallback
for a bespoke order (real hand-written dialogue, rather than the CLI's
generic-but-complete template lines — Hangout only; the Gallery's/
Flight's/Defense's optional boss lines are the only per-order dialogue
those templates take).

## 0. Before you start

You need: the user's intake response (from the Google Form / response
sheet), and a repo checkout with `node` available for the harness. Nothing
else — no build step, no npm install.

## 1. Read the intake response

Pull the user's answers for all 12 questions (see `INTAKE.md`). Note
which template they picked (**Q1 — "What's the joke?"**: The Hangout /
The Gallery / The Flight / The Defense — everything downstream branches
on this), which
setting (Q2 — Hangout only, defaults to THE DINNER PARTY if unanswered),
and which of the five optional roles (First Boss/Final Boss/Savior/
Butterfingers/Builder) they actually cast (Q7) — anything left blank is
skipped, not defaulted.

## 2. Content review gate

Read every free-text answer (Q4's story/targets/trip content, Q7's
anecdotes and optional boss lines, Q3's catchphrase, Q5's title, Q11's
off-limits list) before doing anything else, regardless of which template
was picked. **Decline or flag** the order — don't proceed to
config-mapping — if anything:

- targets a person who didn't consent to being written about (this product
  is for consenting friend groups, not surprising someone with content
  about them),
- is hateful, sexual, or otherwise not appropriate for a comedy gift,
- amounts to doxxing (real addresses, financial info, anything identifying
  beyond a first name/nickname),
- punches down rather than sideways — the whole format only works if the
  "inside joke" reads as affectionate ribbing among equals. A joke at a
  vulnerable person's expense, or built around someone's protected
  characteristic, isn't affectionate ribbing — decline it.

If something is borderline but fixable (an anecdote that's a little sharp,
a catchphrase that needs softening), it's fine to soften it yourself during
config-mapping (step 3) rather than declining outright — use judgment, and
say so in your delivery note if you changed anything. If you're declining,
reply to the user directly (outside this repo) rather than deploying
anything; there's nothing further to do here.

## 3. Map answers to a new config

Every order gets its own `games/<slug>/config.js`, where `<slug>` is a
short, URL-safe, hard-to-guess identifier for the order (first names +
a few random characters is enough — see "Privacy" below; not the user's
literal name or email).

**Which template.** Q1 picks the whole shape of what follows — the table
below covers the Hangout; the Gallery's, the Flight's, and the Defense's
own answer → field mappings are in `tools/README.md`'s answers schema
(same idea, a different content field in place of `stories`, and no
`scene`/`lengthPreset` for any of them). Use `examples/roadtrip.config.js`
(Hangout, fully cast), `examples/test-group.config.js` (Hangout, degraded),
`examples/gallery-sample.config.js` (Gallery),
`examples/flight-sample.config.js` (Flight), or
`examples/defense-sample.config.js` (Defense) as the schema reference —
copy whichever matches Q1's answer and is the closer starting point,
then fill in every field from the intake answers.

**The Hangout** (Q1 = "A place you always end up..."):

| Intake answer | Config field |
|---|---|
| Q2 setting | `scene` — `'dinner'` (default) / `'roadtrip'` / `'office'` / `'wedding'`. See "Story skeletons" below — this is the one field on this whole page you never hand-write dialogue for. |
| Q3 catchphrase | `punchline` |
| Q4 stories | `stories[]` (each `{lines:[...]}`, 1-2 lines each, ALL CAPS to match the game's chunky-text style) |
| Q5 title | `title.lockupLines` (short — see "Title font" below), `title.introPageTitle`, `title.gamePageTitle` |
| Q6 host | `host.name`, and `cast.diner0`/etc. sprite picks as you see fit |
| Q7 role casting | `cast.judge` / `cast.authority` / `cast.savior` / `cast.butterfingers` / `cast.builder` — `null` for any left blank in Q7. Q7's "The First Boss"/"The Final Boss" are `judge`/`authority` under the hood (historical key names — see `tools/README.md`). **Every uncast role's own content bucket (`CONFIG.judge`, `CONFIG.authority`, etc.) can be omitted from the file entirely** — nothing reads it once the role is uncast (this is exactly what `examples/test-group.config.js` demonstrates: JUDGE uncast, and `CONFIG.judge`/`authority`/`savior` simply don't exist in that file). Only write content buckets for roles Q7 actually cast. |
| Q8 anecdotes | each cast role's `anecdote` field, and inform the flavor of that role's written lines (see below) |
| Q9 music | `music.customSongPath` (user's uploaded file, copied into `games/<slug>/assets/` — see "Assets" below) **or** `null` + pick one `music.loops` entry to lean on (see the vibe → loop-key mapping below) |
| Q10 spellings | apply throughout — every name that appears in any line |
| Q11 off-limits | becomes `forbiddenWords` directly — this order's own list, no baseline/universal words at all. Nothing off-limits ships as `forbiddenWords: []` |
| Q12 email | not part of the config — just your delivery contact |

**The Gallery / The Flight / The Defense** (Q1 = "the things your group
can't stop roasting" / "a disaster trip you keep retelling" / "a
recurring annoyance the group defends against"): the shared rows above
(catchphrase/title/host/cast/anecdotes/music/spellings/off-limits/email)
map identically; there is no `scene` or `lengthPreset` for any of them.
Q4 maps to `gallery.targets[]` (Gallery, 4-8 short labels, uppercased),
`flight.beats[]` + `flight.hazards[]` + `flight.planeColor` (Flight,
beats keep the group's typed case — do NOT uppercase them, they read as
narrated prose, not a shouty label), or `defense.defending` +
`defense.waves[]` (Defense, both uppercased short labels — the thing on
the plaque and the 3-6 wave banners). Q7's two optional boss-line fields
map to `gallery.firstBossHeckle`/`gallery.finalBossQuirk`,
`flight.firstBossHeckle`/`flight.finalBossQuirk`, or
`defense.firstBossHeckle`/`defense.finalBossQuirk` (note the Defense's
First Boss fights ON the group's side — their line is a sniper-ally
one-liner, not an antagonist heckle) — blank on any falls back to that
template's own engine-side neutral fallback pool (each engine's
`FIRST_BOSS_HECKLE_FALLBACKS`/`FINAL_BOSS_QUIRK_FALLBACKS`), never left
visibly blank in the shipped game. None of these templates' cast content
buckets are per-role dialogue blocks the way the Hangout's
`judge`/`authority` are — each engine builds its own boss-card/banner
titles straight off `CAST.judge.name`/`CAST.authority.name`, so there's
no `judge.title`/`authority.cardTitle` to set for any of them.

**Story skeletons (Q2, Hangout only).** `scene` picks which of the four
settings' arena, props, and mechanic-flavor strings (`game/skeletons.js`)
dress the game — the beats, collision geometry, and every OTHER content
field in this table are identical regardless of which one is picked.
Every skeleton's own strings (start card, mode-select) already ship
pre-cleared for tone — **you never hand-edit `game/skeletons.js` per
order**; if `tools/generate.js` built the config, it already validated
`scene` against the four allowed keys and refused to write the file on
an unrecognized value. The Gallery, the Flight, and the Defense have no
scene skeleton at all — Q2 doesn't apply to any of them.

**Writing the actual dialogue.** Hangout only: every cast role needs its
content bucket's lines written out in full (see `examples/roadtrip.config.js`
for the complete field list per role: `judge.critiqueLines`/`duckLines`/`hitLines`/`cardBody`/
`fakeDeathLine1`/`fakeDeathLine2`, `authority.entranceLine1`/`entranceLine2`/
`turnGoodLine1`/`turnGoodLine2`/`beggingLine`/`failLine`/`cardTitle`/
`cardBody`, `savior.line1`/`line2`/`sincereLine`, `butterfingers.*`,
`builder.*`). This is genuinely hand-written per order, not templated —
that's the point of the product. Keep the tone deadpan, ALL CAPS, short
lines, and lean on the Q8 anecdotes for flavor. The Gallery, the Flight,
and the Defense have no equivalent step — their only per-order dialogue
is Q7's two optional boss lines (heckle/quirk), and every other line
(round intros, banners, end-card copy) is the template's own fixed,
already tone-gate-clean engine text.

**Boss slots read as real people.** Hangout: when The First Boss (`judge`)
is cast, set `judge.title` to that person's name, ALL CAPS — it's what the
boss HP bar shows during the fight, and it should read MARCO, not the
generic "THE CRITIC" placeholder. Likewise, when The Final Boss (`authority`)
is cast, set `authority.cardTitle` to `'<NAME> HAS ARRIVED'`, ALL CAPS.
(`tools/generate.js` and the `/build/` wizard both do this automatically
now; this only matters when you're hand-authoring a config.) The Gallery,
the Flight, and the Defense need no equivalent step — those engines
already read the person's name straight off `CAST.judge`/`CAST.authority`
for every boss/tower title and banner.

The `{HOST}` and `{ITEM}` tokens (see `SPEC-game.md`'s "Template & roles"
section) are available if a Hangout line needs to say the host's name or
the gift item's name — don't hand-write those in more than the two token
spots unless you specifically want a line to differ from the shared
value. (No template other than the Hangout uses either token.)

**Length preset.** Hangout only. Default every order to
`lengthPreset: 'five_min'` unless the user's intake indicates they want
the full experience (not currently asked on the form, so: default to
five_min). The Gallery, the Flight, and the Defense have no length
preset — their own runtime comes entirely from their content (how many
targets/legs/waves).

**Title font.** `title.lockupLines` renders through the hand-built 5×7
pixel font — full A–Z, 0–9, apostrophe/period/question mark are covered
(see `SPEC-game.md`), but there's no lowercase and no other punctuation.
Keep the title short (2 short words/lines, like test-group's own
`['THE TEST', 'GROUP']`) so it fits the lockup's layout. Same rule for
all four templates.

**Assets.** SFX samples, the dungeon/roster tile sheets, and each
template's own art pack are shared engine assets — never copied per
order (see `README.md` "How games are added"). Only a user's own
uploaded song (Hangout only today — Q9) is order-specific: place it at
`games/<slug>/assets/theme.mp3` and point `music.customSongPath` at
`'../assets/theme.mp3'`. `CONFIG.music.*` paths are resolved relative to
the **page** that loads them (`games/<slug>/game/index.html` /
`intro/index.html` — a plain `fetch(path)`, no config-relative base),
which sits one directory *below* `games/<slug>/config.js` itself — so the
path needs that one extra `../` to climb back up to `games/<slug>/`
before descending into `assets/`. (An earlier version of this note said
`'assets/theme.mp3'`, relative to config.js's own folder — that was
wrong, just never caught because the repo-root config.js and its game/intro
pages happen to sit in the very same folder, where the
two interpretations coincide. `games/test-group/config.js` shows the
correct page-relative pattern for the shared Kenney loops,
`'../../../assets/...'` — three levels, since that file's page is three
levels deep instead of one.)

## 4. Deploy the pages

Which files to write depends on the template picked at Q1 — mirror
whichever checked-in example matches:

**The Hangout — 4 files**, mirroring `games/test-group/`:

- `games/<slug>/config.js` — from step 3.
- `games/<slug>/game/index.html` — copy `games/test-group/game/index.html`
  verbatim (it's a 4-line shell; nothing in it is order-specific).
- `games/<slug>/intro/index.html` — copy `games/test-group/intro/index.html`
  verbatim, same reason.
- `games/<slug>/index.html` — copy `games/test-group/index.html` verbatim
  (redirects to `intro/`).

**The Gallery — 2 files**, mirroring `games/gallery-sample/`:

- `games/<slug>/config.js` — from step 3.
- `games/<slug>/index.html` — copy `gallery/index.html` verbatim, except
  the `<title>` (swap for `title.gamePageTitle`) and the four `<script
  src>` paths (each needs one more `../` — see `games/gallery-sample/index.html`
  for the exact result).

**The Flight — 2 files**, mirroring `games/flight-sample/`:

- `games/<slug>/config.js` — from step 3.
- `games/<slug>/index.html` — copy `flight/index.html` verbatim, same
  `<title>` + four `<script src>` adjustment as the Gallery above — see
  `games/flight-sample/index.html` for the exact result.

**The Defense — 2 files**, mirroring `games/defense-sample/`:

- `games/<slug>/config.js` — from step 3.
- `games/<slug>/index.html` — copy `defense/index.html` verbatim, same
  `<title>` + four `<script src>` adjustment — see
  `games/defense-sample/index.html` for the exact result.

None of these files need editing beyond the copy — they all load the
shared engine (`game/engine.js`/`intro/engine.js`, or `gallery/engine.js`,
`flight/engine.js`, or `defense/engine.js`, depending on template) this
repo ships, plus the sibling `config.js` you just wrote.
`tools/generate.js` does this whole step automatically (with
`safeReplace()`-verified string replacements for the
Gallery/Flight/Defense shell, so a mismatch fails loudly instead of
silently shipping the wrong paths — see `tools/README.md`). See
`README.md`'s "How games are added" for why this works without
duplicating any engine.

## 5. Verify before deploying

Run the matching template's own driver:

```
node tools/verify-config.js games/<slug>/config.js    # The Hangout
node tools/verify-gallery.js games/<slug>/config.js    # The Gallery
node tools/verify-flight.js games/<slug>/config.js     # The Flight
node tools/verify-defense.js games/<slug>/config.js    # The Defense
```

Each is the real, checked-in tool (not a from-scratch harness per round
anymore) — it runs, in order: a syntax check; a full headless playthrough
(Node `vm`, no browser) that follows whatever degradation path this
config's own cast implies all the way to the end card (Hangout: full cast
→ boss fight → comeback beat → final-boss chase, or uncast JUDGE →
straight to celebration, etc.; Gallery: rounds → boss round or elite
volley → finale or grand volley → end card; Flight: legs → the boss leg
(if cast) → the final-boss approach gate (if cast) or a clear-sky landing
→ end card, plus a THE SHOUT / ONE TANK check; Defense: waves → the
final-boss wave (if cast) or a grand rush → turn-good mini-wave → end
card, plus priority-target/pad-swap/RALLY checks); and the tone gate (this
config's own `forbiddenWords` list, whole-word case-sensitive, and
nothing else — there's no baseline/universal word list, see
`game/cfgcodec.js`'s `cfgBuildDefaultConfig` for why). Prints PASS/FAIL,
which phase the playthrough reached, which roles read as cast, and every
error — exit code 0 on pass. If you used `tools/generate.js` (see "The
fast path" above) this already ran automatically and refused to write
the config on failure; run it again by hand after any manual edit to
`games/<slug>/config.js`.

## 6. Verify live, then deliver

No servers in this repo's own dev loop by convention (verification here is
the harness above) — but the deployed GitHub Pages URL is the real
product, so **do** load `https://<pages-domain>/games/<slug>/` for real
once it's pushed, click through a full playthrough, and confirm audio/
visuals look right before sending the link. Then deliver
`https://<pages-domain>/games/<slug>/` to the user's Q12 email.

For the **instant link** (no hosting/push required, works the moment
it's generated), which page it points at also depends on the template:
`/intro/#cfg=<data>` for The Hangout, `/gallery/#cfg=<data>` for The
Gallery, `/flight/#cfg=<data>` for The Flight, `/defense/#cfg=<data>`
for The Defense — `tools/generate.js` prints the right one automatically.

## Privacy note

Slugs are **obscure, not secured** — anyone with the link can play the
game, and the repo (if public) may make slugs discoverable. This is
adequate for a gag gift among friends, not real privacy. Don't put
anything in a config that the user wouldn't be comfortable being visible
to a stranger who found the link.

---

## Worked example: `examples/test-group.config.js` end to end

Walking the whole playbook against the config this repo already ships, as
if it were a real order. This exact hypothetical intake is also checked in
as `tools/example-answers.json` — `node tools/generate.js
tools/example-answers.json` reproduces steps 3-5 below automatically.
(`tools/gallery-sample-answers.json`/`tools/flight-sample-answers.json`/
`tools/defense-sample-answers.json` + their `games/<slug>-sample/`
folders are the same worked-example pattern for the other three
templates.)

1. **Intake (hypothetical)**: Q1 "The Hangout" · catchphrase "SO TRUE." ·
   stories: missed a flight by 4 minutes, alphabetized the spice rack on
   hold · title "The Test Group" · host "Jordan" · cast: only
   Butterfingers ("Morgan") and Builder ("Riley") — First Boss/Final
   Boss/Savior all left blank · anecdotes: Morgan takes 40 photos of
   every plate, Riley builds something every hangout · music: no upload,
   vibe "Warm and celebratory" · no off-limits list · five_min (the
   default).
2. **Content review**: nothing concerning — proceed.
3. **Config mapping**: this is exactly `examples/test-group.config.js` —
   `cast.judge`/`authority`/`savior` are `null`, and their content buckets
   are simply absent from the file. `lengthPreset: 'five_min'`.
   `music.customSongPath: null` (no upload).
4. **Deploy**: this repo ships the deployed copy at `games/test-group/` —
   `config.js` is literally `node tools/generate.js tools/example-answers.json`'s
   own output (gameId pinned to `'test-group'` so the folder name and the
   save-slot prefix match); `game/index.html`, `intro/index.html`,
   `index.html` are copied verbatim from the template shells.
5. **Verify**: `node tools/verify-config.js games/test-group/config.js` passes; the
   harness confirms JUDGE/AUTHORITY/SAVIOR read as uncast, Beat 2/3/4 are
   disabled, the flow goes dinner rounds → celebration → Epilogue A →
   Epilogue B → Beat 5 → end card with the boss never becoming visible,
   and the tone gate is clean (forbiddenWords: []).
6. **Deliver**: the link would be `https://<pages-domain>/games/test-group/`.

This is the exact proof that the degradation map (see `SPEC-game.md`)
produces a complete, satisfying game even when three of the six roles are
skipped — and `games/gallery-sample/`/`games/flight-sample/`/
`games/defense-sample/` are the same proof for the other three templates'
own host-only degradation paths (see `tools/verify-skeletons.js`'s
Gallery/Flight/Defense groups).
