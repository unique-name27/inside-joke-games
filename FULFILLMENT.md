# Fulfillment playbook

The per-order operator playbook — meant to be run by a Claude session (with
file/shell access to this repo) once an `INTAKE.md` response comes in.
Target: ≤30 minutes of wall time, ≈zero hands-on beyond reviewing the
diff and pushing.

## 0. Before you start

You need: the buyer's intake response (from the Google Form / response
sheet), and a repo checkout with `node` available for the harness. Nothing
else — no build step, no npm install.

## 1. Read the intake response

Pull the buyer's answers for all 10 questions (see `INTAKE.md`). Note
which of the five optional roles (Critic/Boss/Savior/Butterfingers/Builder)
they actually cast — anything left blank is skipped, not defaulted.

## 2. Content review gate

Read every free-text answer (stories, anecdotes, catchphrase, title,
off-limits list) before doing anything else. **Decline or flag** the order
— don't proceed to config-mapping — if anything:

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
reply to the buyer directly (outside this repo) rather than deploying
anything; there's nothing further to do here.

## 3. Map answers to a new config

Every order gets its own `games/<slug>/config.js`, where `<slug>` is a
short, URL-safe, hard-to-guess identifier for the order (first names +
a few random characters is enough — see "Privacy" below; not the buyer's
literal name or email).

Use `game/config.js` (KCK, config #1) as the schema reference and
`examples/test-group.config.js` as a second worked example of an
intentionally-degraded config — copy whichever is the closer starting
point, then fill in every field from the intake answers:

| Intake answer | Config field |
|---|---|
| Q1 catchphrase | `punchline` |
| Q2 stories | `stories[]` (each `{lines:[...]}`, 1-2 lines each, ALL CAPS to match the game's chunky-text style) |
| Q3 title | `title.lockupLines` (short — see "Title font" below), `title.introPageTitle`, `title.gamePageTitle` |
| Q4 host | `host.name`, and `cast.diner0`/etc. sprite picks as you see fit |
| Q5 role casting | `cast.judge` / `cast.authority` / `cast.savior` / `cast.butterfingers` / `cast.builder` — `null` for any left blank in Q5. **Every uncast role's own content bucket (`CONFIG.judge`, `CONFIG.authority`, etc.) can be omitted from the file entirely** — nothing reads it once the role is uncast (this is exactly what `examples/test-group.config.js` demonstrates: JUDGE uncast, and `CONFIG.judge`/`authority`/`savior` simply don't exist in that file). Only write content buckets for roles Q5 actually cast. |
| Q6 anecdotes | each cast role's `anecdote` field, and inform the flavor of that role's written lines (see below) |
| Q7 music | `music.customSongPath` (buyer's uploaded file, copied into `games/<slug>/assets/` — see "Assets" below) **or** `null` + pick one `music.loops` entry to lean on (see the vibe → loop-key mapping below) |
| Q8 spellings | apply throughout — every name that appears in any line |
| Q9 off-limits | append to `forbiddenWords` (in addition to the baseline `['COIN','BILL','COST','NOTHING']` — KCK's own instance of the rule; keep that baseline unless an order specifically needs it changed) |
| Q10 email | not part of the config — just your delivery contact |

**Writing the actual dialogue.** Every cast role needs its content bucket's
lines written out in full (see `game/config.js` for the complete field list
per role: `judge.critiqueLines`/`duckLines`/`hitLines`/`cardBody`/
`fakeDeathLine1`/`fakeDeathLine2`, `authority.entranceLine1`/`entranceLine2`/
`turnGoodLine1`/`turnGoodLine2`/`beggingLine`/`failLine`/`cardTitle`/
`cardBody`, `savior.line1`/`line2`/`sincereLine`, `butterfingers.*`,
`builder.*`). This is genuinely hand-written per order, not templated —
that's the point of the product. Keep the tone matching KCK's own (deadpan,
ALL CAPS, short lines) and lean on the Q6 anecdotes for flavor. The
`{HOST}` and `{ITEM}` tokens (see `SPEC-game.md`'s "Template & roles"
section) are available if a line needs to say the host's name or the gift
item's name — don't hand-write those in more than the two token spots
unless you specifically want a line to differ from the shared value.

**Length preset.** Default every order to `lengthPreset: 'five_min'`
unless the buyer's intake indicates they want the full experience (not
currently asked on the form, so: default to five_min).

**Title font.** `title.lockupLines` renders through the hand-built 5×7
pixel font — full A–Z, 0–9, apostrophe/period/question mark are covered
(see `SPEC-game.md`), but there's no lowercase and no other punctuation.
Keep the title short (2 short words/lines, like KCK's own `['KARKS CUB',
'KINGDOM']`) so it fits the lockup's layout.

**Assets.** SFX samples and the dungeon tile sheet are shared engine assets
— never copied per order (see `README.md` "How games are added"). Only a
buyer's own uploaded song is order-specific: place it at
`games/<slug>/assets/theme.mp3` and point `music.customSongPath` at
`'assets/theme.mp3'` (relative to the config file's own folder, `games/<slug>/`
— see the "config sharing" note in `SPEC-game.md` for how relative asset
paths work at this nesting depth; the shipped `games/test-group/config.js`
shows the equivalent pattern for the shared Kenney loops, one directory
shallower since it has no per-order asset of its own).

## 4. Deploy the pages

Every order needs three files, all under `games/<slug>/` (mirroring the
`games/test-group/` example this repo ships):

- `games/<slug>/config.js` — from step 3.
- `games/<slug>/game/index.html` — copy `games/test-group/game/index.html`
  verbatim (it's a 4-line shell; nothing in it is order-specific).
- `games/<slug>/intro/index.html` — copy `games/test-group/intro/index.html`
  verbatim, same reason.
- `games/<slug>/index.html` — copy `games/test-group/index.html` verbatim
  (redirects to `intro/`).

None of these four files need editing beyond the copy — they all load the
shared `game/engine.js` / `intro/engine.js` this repo ships plus the
sibling `config.js` you just wrote. See `README.md`'s "How games are
added" for why this works without duplicating the engine.

## 5. Verify before deploying

Run, in order:

1. `node --check` on `games/<slug>/config.js` (and the game/intro engine
   files, if you touched them — you shouldn't have).
2. The vm-harness playthrough against the new config — see
   `harness/README.md`-equivalent instructions below; at minimum, confirm:
   the config loads without throwing, every cast role's content bucket is
   present, an attentive-player Beat 1 completes, the flow reaches the
   configured degradation point correctly (full cast → boss fight;
   uncast JUDGE → straight to celebration; etc.), and the run reaches the
   end card.
3. Tone gate: grep the new config file (and only that file — the shared
   engine/intro files never contain personalized text) for
   `CONFIG.forbiddenWords`, whole-word case-sensitive, plus the separate
   `FREE`-only-inside-`CONFIG.punchline` rule. (This is the same check
   `SPEC-game.md`'s "Template & roles" section describes, just pointed at
   the new file.)

Since there's no persistent test suite file in this repo (harnesses are
built fresh per verification round, per this project's convention), the
quickest way to run the harness against a brand new order is: take the
Phase B/C verification harness pattern (a Node `vm` sandbox stubbing
canvas/AudioContext/DOM, documented in the commit history / prior session
transcripts) and point its config loader at `games/<slug>/config.js`
instead of `game/config.js`. If you don't have that harness handy, at
minimum load the config file with `node --check`, and manually verify in
the browser per step 6 below before delivering.

## 6. Verify live, then deliver

No servers in this repo's own dev loop by convention (verification here is
the harness above) — but the deployed GitHub Pages URL is the real
product, so **do** load `https://<pages-domain>/games/<slug>/` for real
once it's pushed, click through a full playthrough, and confirm audio/
visuals look right before sending the link. Then deliver
`https://<pages-domain>/games/<slug>/` to the buyer's Q10 email.

## Privacy note

Slugs are **obscure, not secured** — anyone with the link can play the
game, and the repo (if public) may make slugs discoverable. This is
adequate for a gag gift among friends, not real privacy. Don't put
anything in a config that the buyer wouldn't be comfortable being visible
to a stranger who found the link.

---

## Worked example: `examples/test-group.config.js` end to end

Walking the whole playbook against the config this repo already ships, as
if it were a real order:

1. **Intake (hypothetical)**: catchphrase "FOR FREE?" · stories: missed a
   flight by 4 minutes, alphabetized the spice rack on hold · title "The
   Test Group" · host "Jordan" · cast: only Butterfingers ("Morgan") and
   Builder ("Riley") — Critic/Boss/Savior all left blank · anecdotes:
   Morgan takes 40 photos of every plate, Riley builds something every
   hangout · music: no upload, "surprise us" → picked `dinner`/`Wacky
   Waiting` as the default register · no off-limits list · five_min (the
   default).
2. **Content review**: nothing concerning — proceed.
3. **Config mapping**: this is exactly `examples/test-group.config.js` —
   `cast.judge`/`authority`/`savior` are `null`, and their content buckets
   are simply absent from the file. `lengthPreset: 'five_min'`.
   `music.customSongPath: null` (no upload).
4. **Deploy**: this repo ships the deployed copy at `games/test-group/` —
   `config.js` (same content, asset paths adjusted one directory deeper),
   `game/index.html`, `intro/index.html`, `index.html`, all copied
   verbatim from the template shells.
5. **Verify**: `node --check games/test-group/config.js` passes; the
   harness confirms JUDGE/AUTHORITY/SAVIOR read as uncast, Beat 2/3/4 are
   disabled, the flow goes dinner rounds → celebration → Epilogue A →
   Epilogue B → Beat 5 → end card with the boss never becoming visible,
   and the tone gate is clean.
6. **Deliver**: the link would be `https://<pages-domain>/games/test-group/`.

This is the exact proof that the degradation map (see `SPEC-game.md`)
produces a complete, satisfying game even when three of the six roles are
skipped.
