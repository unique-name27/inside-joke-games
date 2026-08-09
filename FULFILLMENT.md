# Fulfillment playbook

The per-order operator playbook — meant to be run by a Claude session (with
file/shell access to this repo) once an `INTAKE.md` response comes in.
Target: ≤30 minutes of wall time, ≈zero hands-on beyond reviewing the
diff and pushing.

## The fast path: `tools/generate.js`

Steps 3-5 below (map answers to a config, deploy the shell pages, verify)
are now automated by the generator — see `tools/README.md` for the full
answers-file schema:

```
node tools/generate.js <answers.json> --base-url=https://<pages-domain>
```

It builds the config, refuses to write anything if verification (syntax +
a full playthrough + the tone gate) fails, deploys `games/<slug>/` on
success, and prints both a hosted URL and an instant, deployment-free
`#cfg=` link. **Step 0, step 1 (turning the raw form response into
`answers.json`), and — critically — step 2 (the content review gate) are
NOT automated** and still need a human before you run the CLI, let alone
before you deliver: the generator has no way to judge whether a story is
affectionate ribbing or something crueler. Steps 3-5 remain documented in
full below both as a reference for what the CLI is actually doing, and as
the manual fallback for a bespoke order (real hand-written dialogue,
rather than the CLI's generic-but-complete template lines).

## 0. Before you start

You need: the user's intake response (from the Google Form / response
sheet), and a repo checkout with `node` available for the harness. Nothing
else — no build step, no npm install.

## 1. Read the intake response

Pull the user's answers for all 11 questions (see `INTAKE.md`). Note which
setting they picked (Q1 — defaults to THE DINNER PARTY if unanswered) and
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
reply to the user directly (outside this repo) rather than deploying
anything; there's nothing further to do here.

## 3. Map answers to a new config

Every order gets its own `games/<slug>/config.js`, where `<slug>` is a
short, URL-safe, hard-to-guess identifier for the order (first names +
a few random characters is enough — see "Privacy" below; not the user's
literal name or email).

Use `game/config.js` (KCK, config #1) as the schema reference and
`examples/test-group.config.js` as a second worked example of an
intentionally-degraded config — copy whichever is the closer starting
point, then fill in every field from the intake answers:

| Intake answer | Config field |
|---|---|
| Q1 setting | `scene` — `'dinner'` (default) / `'roadtrip'` / `'office'` / `'wedding'`. See "Story skeletons" below — this is the one field on this whole page you never hand-write dialogue for. |
| Q2 catchphrase | `punchline` |
| Q3 stories | `stories[]` (each `{lines:[...]}`, 1-2 lines each, ALL CAPS to match the game's chunky-text style) |
| Q4 title | `title.lockupLines` (short — see "Title font" below), `title.introPageTitle`, `title.gamePageTitle` |
| Q5 host | `host.name`, and `cast.diner0`/etc. sprite picks as you see fit |
| Q6 role casting | `cast.judge` / `cast.authority` / `cast.savior` / `cast.butterfingers` / `cast.builder` — `null` for any left blank in Q6. **Every uncast role's own content bucket (`CONFIG.judge`, `CONFIG.authority`, etc.) can be omitted from the file entirely** — nothing reads it once the role is uncast (this is exactly what `examples/test-group.config.js` demonstrates: JUDGE uncast, and `CONFIG.judge`/`authority`/`savior` simply don't exist in that file). Only write content buckets for roles Q6 actually cast. |
| Q7 anecdotes | each cast role's `anecdote` field, and inform the flavor of that role's written lines (see below) |
| Q8 music | `music.customSongPath` (user's uploaded file, copied into `games/<slug>/assets/` — see "Assets" below) **or** `null` + pick one `music.loops` entry to lean on (see the vibe → loop-key mapping below) |
| Q9 spellings | apply throughout — every name that appears in any line |
| Q10 off-limits | append to `forbiddenWords` (in addition to the baseline `['COIN','BILL','COST','NOTHING']` — KCK's own instance of the rule; keep that baseline unless an order specifically needs it changed) |
| Q11 email | not part of the config — just your delivery contact |

**Story skeletons (Q1).** `scene` picks which of the four settings' arena,
props, and mechanic-flavor strings (`game/skeletons.js`) dress the game —
the beats, collision geometry, and every OTHER content field in this table
are identical regardless of which one is picked. Every skeleton's own
strings (start card, mode-select) already ship pre-cleared for tone —
**you never hand-edit `game/skeletons.js` per order**; if `tools/generate.js`
built the config, it already validated `scene` against the four allowed
keys and refused to write the file on an unrecognized value.

**Writing the actual dialogue.** Every cast role needs its content bucket's
lines written out in full (see `game/config.js` for the complete field list
per role: `judge.critiqueLines`/`duckLines`/`hitLines`/`cardBody`/
`fakeDeathLine1`/`fakeDeathLine2`, `authority.entranceLine1`/`entranceLine2`/
`turnGoodLine1`/`turnGoodLine2`/`beggingLine`/`failLine`/`cardTitle`/
`cardBody`, `savior.line1`/`line2`/`sincereLine`, `butterfingers.*`,
`builder.*`). This is genuinely hand-written per order, not templated —
that's the point of the product. Keep the tone matching KCK's own (deadpan,
ALL CAPS, short lines) and lean on the Q7 anecdotes for flavor. The
`{HOST}` and `{ITEM}` tokens (see `SPEC-game.md`'s "Template & roles"
section) are available if a line needs to say the host's name or the gift
item's name — don't hand-write those in more than the two token spots
unless you specifically want a line to differ from the shared value.

**Length preset.** Default every order to `lengthPreset: 'five_min'`
unless the user's intake indicates they want the full experience (not
currently asked on the form, so: default to five_min).

**Title font.** `title.lockupLines` renders through the hand-built 5×7
pixel font — full A–Z, 0–9, apostrophe/period/question mark are covered
(see `SPEC-game.md`), but there's no lowercase and no other punctuation.
Keep the title short (2 short words/lines, like KCK's own `['KARKS CUB',
'KINGDOM']`) so it fits the lockup's layout.

**Assets.** SFX samples and the dungeon tile sheet are shared engine assets
— never copied per order (see `README.md` "How games are added"). Only a
user's own uploaded song is order-specific: place it at
`games/<slug>/assets/theme.mp3` and point `music.customSongPath` at
`'../assets/theme.mp3'`. `CONFIG.music.*` paths are resolved relative to
the **page** that loads them (`games/<slug>/game/index.html` /
`intro/index.html` — a plain `fetch(path)`, no config-relative base),
which sits one directory *below* `games/<slug>/config.js` itself — so the
path needs that one extra `../` to climb back up to `games/<slug>/`
before descending into `assets/`. (An earlier version of this note said
`'assets/theme.mp3'`, relative to config.js's own folder — that was
wrong, just never caught because KCK's own config.js and its game/intro
pages happen to sit in the very same folder at the repo root, where the
two interpretations coincide. `games/test-group/config.js` shows the
correct page-relative pattern for the shared Kenney loops,
`'../../../assets/...'` — three levels, since that file's page is three
levels deep instead of one.)

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

Run:

```
node tools/verify-config.js games/<slug>/config.js
```

This is the real, checked-in tool (not a from-scratch harness per round
anymore) — it runs, in order: a syntax check; a full headless playthrough
(Node `vm`, no browser) that follows whatever degradation path this
config's own cast implies (full cast → boss fight → Widowmaker →
Aram chase; uncast JUDGE → straight to celebration; etc.) all the way to
the end card; and the tone gate (the baseline safety words + this
config's own `forbiddenWords`, whole-word case-sensitive, plus the
separate `FREE`-only-inside-`CONFIG.punchline` rule — see
`SPEC-game.md`'s "Template & roles" section for the underlying rule this
implements). Prints PASS/FAIL, which phase the playthrough reached, which
roles read as cast, and every error — exit code 0 on pass. If you used
`tools/generate.js` (see "The fast path" above) this already ran
automatically and refused to write the config on failure; run it again
by hand after any manual edit to `games/<slug>/config.js`.

## 6. Verify live, then deliver

No servers in this repo's own dev loop by convention (verification here is
the harness above) — but the deployed GitHub Pages URL is the real
product, so **do** load `https://<pages-domain>/games/<slug>/` for real
once it's pushed, click through a full playthrough, and confirm audio/
visuals look right before sending the link. Then deliver
`https://<pages-domain>/games/<slug>/` to the user's Q11 email.

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
