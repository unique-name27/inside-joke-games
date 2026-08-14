# SPEC — People First (Cast 2.0: the people step, real quotes, roles picked from people)

Owner directive (2026-08-13): the builder should ask for **3–6 people**
(name + pick the character), then **1–3 things each person actually
said**, THEN let the user pick who's the boss — with real lines for the
boss so it feels realistic. The motivating picture: a family game — mom
cooking, dad complaining, sister on her phone. Today's wizard is
role-first (type a name into THE FIRST BOSS's card); people don't think
in roles, they think in people. Invert it.

Three deliverables, three rounds:
1. **Quotes in the games** (config schema + all five engines + drivers).
2. **The people-first wizard** (+ generator answers shape + INTAKE).
3. **Docs + storefront** (family framing, "built from what your people
   actually say").

The engines' cast model does NOT change shape — people-first is a
wizard-level transform that compiles down to the existing
`host`/`cast.<role>` config (plus the new `quotes` arrays and a small
`extras` list). Every existing link, sample, and driver keeps working.

## Round 1 — their words in their mouths (quotes)

**Schema** (`game/cfgcodec.js`, append-only as always):
- `quotes: cfgArr(3, cfgStr(60))` added to the host schema, every cast
  role's schema, and diner0's. Optional everywhere; absent = today's
  behavior, byte-identical.
- NEW top-level `extras: cfgArr(2, cfgObj({ name: cfgStr(40),
  sprite: cfgEnum(CFG_ROSTER_KEYS), quotes: cfgArr(3, cfgStr(60)) }))` —
  people beyond host + 5 roles + the existing extra friend (diner0).
  Fragment-safe: names/quotes capped text, sprite enum only.
- Quotes render uppercased (chunky/bubble house style); wizard/generator
  uppercase at compile time, engines trust the config as-is (same as
  every other text field).

**Engines — each surfaces quotes in its most natural EXISTING bubble/
banner mechanism.** Rule: every cast member (host included) with quotes
gets at least one of their own quotes on screen per full playthrough,
seeded rotation (gameId-hashed, deterministic), never blocking, always
falling back cleanly when quotes are absent:
- **Hangout** (`game/engine.js` — smallest possible diff, this is the
  most complex engine): between dinner-beat story rounds, one seated
  diner says one of their own quotes in the existing speech-bubble
  system (seeded pick of person+quote). The host's quotes join their
  existing celebratory lines. DO NOT touch beats, timings, collision,
  DIFF tables, or skeleton behavior; if a surgical spot can't be found
  for a role, that role's quotes may ride the epilogue/end-card instead
  — but the harness assertion below still holds.
- **Gallery**: a friend target's "HEY!" hurt bubble becomes one of THEIR
  quotes when they have any; the barker (builder) opens one round with a
  quote of their own.
- **Flight**: after each breather's story beat line, a short second
  bubble — one cast member's quote (seeded rotation through everyone
  with quotes across the legs).
- **Defense**: a tower's first kill each wave may pop that person's
  quote as a mini bubble (seeded, throttled to one per tower per wave;
  the first boss's sniper heckle keeps precedence on their own first
  kill).
- **Mission**: between-stage squadron chatter — one wingmate quote
  marqueed under the stage banner (seeded rotation).
- **Bosses feel real** (the owner's explicit ask): when a boss role is
  cast and that person has quotes, their quotes are APPENDED to that
  template's heckle/quirk fallback pool for their fight — the boss
  heckles with things they actually say, alongside the existing typed
  heckle/quirk field. (Hangout bosses keep their hand-written/config
  dialogue; their quotes join the taunt rotation where a pool already
  exists.)
- **Extras exist everywhere it's cheap, credits everywhere always**:
  every person in `extras` (and diner0) is guaranteed a line in every
  template's END CARD — sprite + name + one quote ("THE WHOLE CREW"
  block). Beyond that: the Gallery adds extras to the friend-target
  pool; the Mission flies up to 2 extras as additional plain wingmen;
  Flight/Defense/Hangout are credits-only (fixed seats/pads — don't
  force it).

**Verification (round 1)**: every per-template driver gains a
quotes-shown assertion (each cast member with quotes surfaced ≥1 quote;
end-card credits list every extra) — PROBE reads the engine's own
shown-quotes log, no duplicated literals. All five samples gain quotes
(+1–2 extras each where the fiction supports it) so the assertions bite.
Suite green, sample regens re-run (they will legitimately change — the
samples gain content; verify by re-running the generator, not by
byte-diffing against the old output). Existing quote-less configs and
old links: byte-identical behavior, proven by the existing playthrough
checks staying green before samples are touched.

## Round 2 — the people-first wizard

**New state model** (draft schema v2):
- `state.people = [ { name, sprite, quotes: ['','',''] } ]` — 3 to 6
  entries (start with 3 empty cards; Add person up to 6, Remove above 3).
- `state.assign = { host: null, critic: null, boss: null, savior: null,
  butterfingers: null, builder: null }` — each an index into `people`
  (or null = skipped). One person can hold at most one role; `host` is
  required.
- Per-template boss line fields stay where they are (on the role, shown
  once assigned), now PRE-SUGGESTED from that person's quotes
  (placeholder shows their first quote; field stays optional/editable).
- `anecdote` per person (one line, optional) moves onto the person card
  with the quotes (it already exists per-role today; it's a
  person-attribute, not a role-attribute).

**Step flow** (every template, replacing the old cast step position):
1. **THE PEOPLE** — "Who's in it? Your group, your family, your team —
   3 to 6 people." Person card = name + the existing sprite-strip
   picker ("Which one is them?" — same Phase C strip, all ~26 tiles) +
   "1–3 things they actually say" quote rows + the optional
   one-line quirk/anecdote. Family example in the step copy: *"Mom who's
   always cooking, Dad with the complaints, the sister who won't get
   off her phone -- that's a cast."*
2. **WHO'S WHO** — same step, second section (not a new step; step
   count per template is unchanged): the host pick ("Who's the main
   character?" — required, tap a person chip) then the five role rows,
   each with per-template desc (existing ROLE_DEFS copy) and a tap-pick
   of the remaining people (or SKIP). Assigning a boss reveals that
   template's heckle/quirk field, pre-suggested from their quotes.
   People left unassigned show a reassuring line: "Everyone else is
   still in the game -- friends, targets-you-don't-shoot, wingmates,
   and the end-card credits."

**Compile-down** (`buildOverridesFromState`): people+assign →
`host.{name,sprite,quotes}`, `cast.<cfgKey>.{name,sprite,anecdote,quotes}`
per assigned role, first unassigned person → `cast.diner0` (today's
extra-friend slot, now with their real name/sprite/quotes), remaining
unassigned → `extras[]` (cap 2; if more, keep the first two and list the
rest in the review card with a "credits only" note — never silently
drop a NAME: over-cap people still ride `extras` names? No — cap is the
schema; the wizard prevents it: 6 people max = host + 5 roles, so ≥4
assignments means ≤2 extras always. With 6 people and fewer than 3
assignments the wizard nudges to assign more or remove a person —
required-content gate: people ≤ host+roles+diner0+2 extras arithmetic
must hold, which for 6 people means at least 3 roles assigned... keep
the gate simple: if unassigned people exceed diner0+2 slots, the
preview step says who won't fit beyond the credits and asks to assign
roles or trim — blocking, explicit, honest).

**Migration** (`normalizeWizardState`): an old draft (role-keyed
`cast`, `host`/`otherFriendName` strings) converts to `people` +
`assign` (host string → person 0 + assign.host=0; each cast:true role →
a person + that assignment; otherFriend → a person, unassigned).
Post-migration drafts round-trip v2 only. Old drafts must never crash
or lose a typed name.

**Generator** (`tools/generate.js` + `tools/README.md` schema): answers
gain the people shape — `people: [{name, sprite?, quotes?[],
anecdote?}]` + `assign: {host: <index or name>, critic?, boss?,
savior?, butterfingers?, builder?}`. The OLD shape (`host`/`cast`/
`anecdotes`/`hostSprite`/`spriteCast`) keeps working unchanged
(back-compat branch — old answer files must regenerate byte-identically
BEFORE the samples are updated). All five `tools/*-sample-answers.json`
migrate to the people shape and gain the quotes/extras used by round
1's samples; regenerate all five `games/<slug>-sample/` folders through
the generator.

**INTAKE.md**: Q6/Q7/Q8 restructure into the people-first flow — Q6
"Who's in it? 3–6 people: name, which character they are (we'll show a
picker), and 1–3 things they actually say, word for word"; Q7 "Who's
who?" (host required + the five role rows, each 'pick one of your
people or skip', boss-line sub-questions unchanged); Q8 (anecdotes)
folds into Q6's per-person quirk line — renumber carefully and update
every cross-reference (FULFILLMENT.md's Q-references, tools/README.md's
Q-comments, generate.js's requireField hints — grep for `Q[0-9]` in all
four files; this renumber is exactly the kind of sweep that went stale
last time).

**Verification (round 2)**: wizard pure-logic vm checks for the new
state model (migration cases: pre-Gallery draft, role-keyed draft,
v2 draft; compile-down for every template; the unassigned-overflow
gate); full browser pass — build a family Hangout (mom host/cook, dad
first boss, sister butterfingers with phone quotes) end-to-end from a
cleared draft, play the generated link, confirm dad heckles with a
typed dad-quote and the end card credits everyone; zero console
errors. Full suite + all five regens green.

## Round 3 — docs + storefront

- README: the people-first flow description, `quotes`/`extras` in the
  schema sections, the family example alongside the friend-group one.
- Storefront (`index.html`): copy pass adding the family frame — the
  product is for "your group chat, your family, your team"; a line
  about quotes: the games are built from what your people actually
  say. `example/index.html` "What they typed" gains the people/quotes
  shape once the sample answers migrate (keep it truthful to the real
  test-group answers file).
- FULFILLMENT.md: people-shape mapping notes + the quotes content-review
  reminder (quotes are the most personal text in an order — the step-2
  gate reads every one).
- SPEC-game-styles.md invariant #1 gains the quotes sentence ("their
  people are in it — and they say their own lines").

## Invariants (unchanged, restated for this feature)

- Fragments: capped text + enums only; `extras` is the only new
  top-level key; append-only schema; absent quotes/extras = byte-
  identical behavior everywhere.
- Uncast roles still skip beats; quotes never create a beat.
- Tone gate: per-config forbiddenWords covers quotes automatically (it
  scans config source); wizard off-limits check extends over people
  names + quotes.
- Determinism: every quote pick seeded from gameId; no Math.random.
- Commit locally per round, house style, NO push.
