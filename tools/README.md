# tools/ — the generator

Automates turning an `INTAKE.md` response into a deployed game, for
whichever template the order picked: no manual config-mapping, no
hand-run harness script, no manual tone-gate grep. Zero npm dependencies
— only Node builtins (`fs`, `path`, `crypto`, `vm`).

```
node tools/generate.js <answers.json> [--out=games] [--base-url=https://<pages-domain>] [--slug=<name>]
```

- `<answers.json>` — required. See "The answers schema" below;
  `tools/example-answers.json` (Hangout), `tools/gallery-sample-answers.json`
  (Gallery), `tools/flight-sample-answers.json` (Flight),
  `tools/defense-sample-answers.json` (Defense), and
  `tools/mission-sample-answers.json` (Mission) are complete
  worked examples, one per template — `tools/example-answers.json` is the
  same content as `examples/test-group.config.js`, expressed as intake
  answers.
- `--out` — output folder, default `games` (so the result lands at
  `games/<slug>/`, exactly `FULFILLMENT.md`'s existing deployment
  location).
- `--base-url` — your GitHub Pages origin (e.g.
  `https://<user>.github.io/inside-joke-games`), used only to print real,
  clickable URLs at the end. Omit it and the script still generates and
  verifies everything — it just prints `<PAGES_DOMAIN>` as a placeholder
  in the two link lines.
- `--slug` — overrides the default random-suffixed slug. Real orders
  always take the default (a stable, guessable folder name is
  undesirable for someone else's game); this exists for reproducible
  checked-in examples like `games/gallery-sample/`/`games/flight-sample/`/
  `games/defense-sample/`/`games/mission-sample/` (see their matching
  `tools/<slug>-answers.json`),
  the same deterministic-naming spirit as `games/test-group/`'s own
  hand-picked slug.

## What it does

1. Reads and structurally validates the answers file (missing
   `catchphrase`/`title`/`host`/`email` — plus each template's own
   required content field(s), see below — fail fast with a clear
   message).
2. Builds the `CONFIG` object: `game/cfgcodec.js`'s `cfgBuildDefaultConfig()`
   (the same neutral per-template template a shared `#cfg=` link merges
   onto — see the "URL-fragment configs" section of `README.md`) is the
   base, deep-merged with the answers via `cfgDeepMerge` (same codec,
   reused rather than duplicated). Every cast role not answered in Q6 is
   explicitly left `null` (uncast), matching the degradation map.
3. **Verifies before writing anything** — that template's own verify
   driver (`tools/verify-config.js` for Hangout, `tools/verify-gallery.js`
   for Gallery, `tools/verify-flight.js` for Flight,
   `tools/verify-defense.js` for Defense, `tools/verify-mission.js` for
   Mission) runs the generated
   config through: a syntax check, a full headless playthrough (Node
   `vm`, no browser — the same methodology every round of this project
   has used) that drives whatever roles ended up cast all the way to the
   end card, and the tone gate (this order's own `forbiddenWords`,
   whole-word case-sensitive, and nothing else — no baseline/universal
   word list, and it now scans every Q6 person's name/quotes/quirk too,
   not just the older shared free-text fields). **A failing config is
   never written to disk** — the script prints the specific errors and
   exits non-zero.
4. Writes `games/<slug>/config.js` plus that template's own shell pages:
   **Hangout** gets three HTML pages (`index.html`, `game/index.html`,
   `intro/index.html`), copied fresh off `games/test-group/`'s own
   current files (not a hardcoded template string) with just the
   `<title>` swapped; **Gallery**/**Flight**/**Defense**/**Mission** each get exactly
   ONE `index.html`, copied fresh off
   `gallery/index.html`/`flight/index.html`/`defense/index.html`/
   `mission/index.html`
   with five exact-string replacements (title + four script `src`s,
   re-pointed one directory level deeper) — every replacement is
   verified to have actually matched something before it's written (see
   `generate.js`'s `safeReplace()`); a mismatch fails loudly instead of
   silently shipping a shell with the wrong paths. Either shape is the
   exact Phase-C pattern `README.md`'s "How games are added" describes.
5. If `music.songFile` was given (Hangout only today), copies it to
   `games/<slug>/assets/theme.mp3` and points `customSongPath` at the
   correct page-relative path (`../assets/theme.mp3` — see "A
   `FULFILLMENT.md` correction" below).
6. Prints **two** links: the hosted `games/<slug>/` URL (real once
   pushed) and an **instant fragment link** — playable immediately, no
   deployment step, using this repo's own already-shared engine.
   Hangout's instant link is `/intro/#cfg=<data>` (the intro page, same
   as ever); Gallery's is `/gallery/#cfg=<data>`; Flight's is
   `/flight/#cfg=<data>`; Defense's is `/defense/#cfg=<data>`; Mission's
   is `/mission/#cfg=<data>` (each a single page, no separate intro to
   route through). "An order can be fulfilled either as a hosted folder
   or an instant link."

## The answers schema

`template` (INTAKE.md's Q1, "What's the joke?") picks which of the
five shapes below applies — `"hangout"` (default if omitted),
`"gallery"`, `"flight"`, `"defense"`, or `"mission"`. The shared fields
(`catchphrase`/`title`/`people`/`assign`/`music`/`spellings`/
`offLimits`/`email`) are read identically across all of them; each
template's own content fields
are template-only (a Hangout answers file never has `targets`/`beats`, a
Gallery one never has `stories`/`scene`, and so on). Q-numbers in the
comments below match INTAKE.md's current numbering (Q1 the joke pick,
Q2 setting [Hangout only], Q3 catchphrase, Q4 the content question
[branches per template], Q5 title, Q6 who's in it [people, quotes,
quirks], Q7 who's who [host + role assignment + optional boss lines],
Q8 music, Q9 spellings, Q10 off-limits, Q11 email).

There are **two supported shapes** for `people`/`host`/`cast`/
`anecdotes`, both read by `tools/generate.js`'s `buildOverrides()`
(the `isPeopleShape` branch there):

- **`people[]` + `assign{}`** (current — what the `/build/` wizard emits,
  and what every checked-in `tools/*-sample-answers.json` now uses):
  one array of 3-6 people (Q6), each with a `name` and optionally
  `sprite`/`quotes[]`/`anecdote`, plus one `assign` object (Q7) mapping
  `host` and the five role keys to a person — by array index, or by an
  exact (case-insensitive) name match. This is the primary/documented
  shape below.
- **Legacy `host` (string) + `cast{}` + `anecdotes{}`** (still fully
  supported, unchanged, forever — see "Legacy shape" below): the shape
  every answers file used before People First round 2. Detected by the
  *absence* of a `people` array; an old answers file re-run through this
  CLI today regenerates byte-identically.

**Hangout** (`template` omitted or `"hangout"`), people shape — this is
literally `tools/example-answers.json`:

```jsonc
{
  "scene": "dinner",                        // Q2, optional, defaults to "dinner" -- "dinner" | "roadtrip" | "office" | "wedding" (see "Story skeletons" in README.md)
  "catchphrase": "SO TRUE.",                // Q3, required
  "stories": ["...", "..."],                // Q4, required — array of 2-4 plain-English sentences, pre-split (one string per story); the generator uppercases + word-wraps each into up to 2 short lines itself
  "title": "The Test Group",                // Q5, required
  "people": [                               // Q6, required -- 3-6 people, each { name, sprite?, quotes?[1-3], anecdote? }
    { "name": "Jordan", "quotes": ["I made a seating chart for four people.", "The appetizers are a surprise. To me too."] },
    { "name": "Morgan", "anecdote": "Takes 40 photos of every plate.", "quotes": ["Let me get the lighting right.", "This is for the group chat later."] },
    { "name": "Riley", "anecdote": "Builds something every time we hang out.", "quotes": ["I already started building something.", "It works. Mostly."] },
    { "name": "Casey", "anecdote": "Brings a board game every time.", "quotes": ["I brought the game. Nobody asked.", "Rules are suggestions, mostly."] }
  ],
  "assign": {                               // Q7 -- role: index-or-name into `people`, or null/omitted to skip.
                                             // Boss slots -- every boss is a real person the group knows (see
                                             // README.md's role section); "critic"/"boss" are historical key
                                             // names for what the form now calls The First Boss / The Final Boss.
    "host": "Jordan",                       //   the required main-character pick -> CONFIG.host
    "critic": null,                         //   "The First Boss"   -> CONFIG.cast.judge
    "boss": null,                           //   "The Final Boss"   -> CONFIG.cast.authority
    "savior": null,                         //   "The Savior"       -> CONFIG.cast.savior
    "butterfingers": "Morgan",              //   "Butterfingers"    -> CONFIG.cast.butterfingers
    "builder": "Riley"                      //   "The Builder"      -> CONFIG.cast.builder
                                             // Casey isn't assigned -- becomes CONFIG.cast.diner0 automatically
                                             // (name/anecdote/quotes carried through; nobody in `people` is ever
                                             // dropped -- unassigned people beyond the first go into `extras[]`,
                                             // up to 2 more).
  },
  "music": { "vibe": "warm", "songFile": null },  // Q8
  "spellings": [ { "from": "Catherine", "to": "Kathryn" } ], // Q9, optional
  "offLimits": [],                          // Q10, optional
  "email": "user@example.com",              // Q11, required — delivery contact only, not part of CONFIG
  "lengthPreset": "five_min"                // optional, defaults to 'five_min' per FULFILLMENT.md
}
```

**Gallery** (`"template": "gallery"`), people shape — this is literally
`tools/gallery-sample-answers.json` — swaps `scene`/`stories` for
`targets` (+ two optional boss lines), drops `lengthPreset` entirely
(the gallery has no scene skeleton, no length preset):

```jsonc
{
  "template": "gallery",
  "catchphrase": "That's so on brand.",     // Q3, required
  "targets": [                              // Q4 (Gallery), required — 4-8 short labels, word for word
    "Fantasy draft speeches", "Spreadsheet at brunch", "The parking incident", "Socks with sandals",
    "Artisanal mac n cheese", "Narrates own cooking"
  ],
  "firstBossHeckle": "Your aim is as bad as your takes.",       // optional (Q7) -- THE FIRST BOSS's heckle line; blank -> gallery/engine.js's own neutral fallback pool (or that person's own Q6 quotes first, if they have any)
  "finalBossQuirk": "Always adjusts their glasses before lying.", // optional (Q7) -- THE FINAL BOSS's tell
  "title": "The Weekend League",            // Q5, required
  "people": [                               // Q6, required -- here all 6 people fill host + the 5 roles, nobody left unassigned
    { "name": "Jordan", "quotes": ["I train for this all week.", "My fantasy team name is Undefeated. The team is not."] },
    { "name": "The Commissioner", "anecdote": "Runs the fantasy league like it is federal law.", "sprite": "grandma", "quotes": ["The league bylaws are not suggestions.", "..."] },
    { "name": "The Landlord", "anecdote": "Shows up personally over a noise complaint.", "sprite": "bandana", "quotes": ["Someone filed a complaint. It was me.", "..."] },
    { "name": "The Designated Driver", "anecdote": "Always sober, always has snacks in the car.", "sprite": "vest", "quotes": ["I'm good. I have snacks in the car.", "..."] },
    { "name": "The One Who Drops Everything", "anecdote": "Has broken three different house rules, literally.", "sprite": "braid", "quotes": ["It slipped. It always slips.", "..."] },
    { "name": "The Group's Tech Guy", "anecdote": "Built this exact game on a Tuesday night.", "sprite": "mohawk", "quotes": ["I built this on a Tuesday night.", "..."] }
  ],
  "assign": {                               // Q7
    "host": "Jordan", "critic": "The Commissioner", "boss": "The Landlord",
    "savior": "The Designated Driver", "butterfingers": "The One Who Drops Everything",
    "builder": "The Group's Tech Guy"
  },
  "music": { "vibe": "upbeat" },            // Q8
  "spellings": [], "offLimits": [], "email": "user@example.com" // Q9/Q10/Q11
}
```

**Mission** (`"template": "mission"`), people shape — this is literally
`tools/mission-sample-answers.json` — swaps `scene`/`stories` for
`mission` + `swarms` (+ the same two optional boss lines; both bosses
are ANTAGONISTS here, the boss fleet — the ace fighter's heckle and the
flagship's quirk are beamed across the screen, not delivered from your
own side the way the Defense's sniper-ally line is). This one leaves
**2** people unassigned, showing the `diner0` + `extras[0]` split:

```jsonc
{
  "template": "mission",
  "catchphrase": "We found it. It has laundry.",     // Q3, required
  "mission": "Find a place with in-unit laundry",    // Q4 (Mission), required -- the banner line, the sillier the better
  "swarms": [                                        // Q4 (Mission), required -- 2-6 short labels, IN ORDER; each becomes a stage's swarm (uppercased)
    "The Bad Listings", "Ghosting Landlords", "Surprise Fees", "The Brutal Commute", "Roommate Red Flags"
  ],
  "shipColor": "orange",                             // Q4 (Mission), optional -- blue/green/orange/red, defaults to blue
  "firstBossHeckle": "It won't last at this price.",   // optional (Q7) -- the ace fighter's beamed heckle, mid-ambush
  "finalBossQuirk": "Still mad about that one email.", // optional (Q7) -- the flagship's beamed quirk, between volleys
  "title": "The Apartment Hunters",                    // Q5, required
  "people": [                                          // Q6, required -- 8 people here: host + 5 roles + 2 left unassigned
    { "name": "Deshawn", "sprite": "overalls", "quotes": ["We found it. It has laundry.", "..."] },
    { "name": "The Broker", "anecdote": "Charges a fee for texting back.", "sprite": "grandma", "quotes": ["That's a processing fee for texting back.", "..."] },
    { "name": "The Landlord", "anecdote": "Has never once fixed the radiator.", "sprite": "beard", "quotes": ["The radiator is fine. It's character.", "..."] },
    { "name": "The Co-Signer", "anecdote": "Always has a backup plan and a spare key.", "sprite": "vest", "quotes": ["I always have a backup plan.", "..."] },
    { "name": "The One Who Drops The Keys", "anecdote": "Has been locked out three times this month.", "sprite": "braid", "quotes": ["Locked out again. Third time this month.", "..."] },
    { "name": "The Spreadsheet", "anecdote": "Built a spreadsheet ranking every listing by laundry access.", "sprite": "squire", "quotes": ["I ranked every listing by laundry access.", "..."] },
    { "name": "The Fourth Friend", "quotes": ["I brought snacks to every viewing.", "..."] },       // unassigned #1 -> cast.diner0
    { "name": "The Friend Who Already Has A Place", "sprite": "villager", "quotes": ["I found mine in one weekend. Sorry.", "..."] } // unassigned #2 -> extras[0]
  ],
  "assign": {                                          // Q7
    "host": "Deshawn", "critic": "The Broker", "boss": "The Landlord",
    "savior": "The Co-Signer", "butterfingers": "The One Who Drops The Keys", "builder": "The Spreadsheet"
  },
  "music": { "vibe": "chase" },                        // Q8
  "spellings": [], "offLimits": [], "email": "user@example.com" // Q9/Q10/Q11
}
```

**Flight** (`"template": "flight"`), people shape — this is literally
`tools/flight-sample-answers.json` — swaps `scene`/`stories` for
`beats` + `hazards` + `planeColor` (+ the same two optional boss lines
as the gallery, reused for THE FIRST BOSS's heckle / THE FINAL BOSS's
quirk). Also leaves 2 people unassigned (`diner0` + `extras[0]`):

```jsonc
{
  "template": "flight",
  "catchphrase": "Somehow we always make it down.",              // Q3, required
  "beats": [                                // Q4 (Flight), required — 3-6 trip legs, IN ORDER, typed case KEPT (not uppercased -- see tools/generate.js's wrapLineKeepCase)
    "THE RENTAL SHOP LOST THE BOOT SIZES.", "SOMEONE PACKED SHORTS INSTEAD OF SNOW PANTS.", "THE CHAIRLIFT STOPPED FOR FORTY MINUTES."
  ],
  "hazards": [ "The ice patch", "The wrong turn", "The gondola line", "The vending machine" ], // Q4 (Flight), required — 2-6 short labels, word for word (uppercased, like gallery targets)
  "planeColor": "blue",                     // Q4 (Flight), optional -- "yellow" (default) | "red" | "blue" | "green"
  "firstBossHeckle": "Pizza, not french fries, rookie.",         // optional (Q7)
  "finalBossQuirk": "Still mad about the wet boots by the fire.", // optional (Q7)
  "title": "The Powder Day Crew",                                // Q5, required
  "people": [                               // Q6, required -- 8 people: host + 5 roles + 2 unassigned
    { "name": "Sam", "sprite": "skigreen", "quotes": ["We always make it down. Eventually.", "..."] },
    { "name": "The Ski Instructor", "anecdote": "Judges every turn from the lift line.", "sprite": "skipurple", "quotes": ["Bend your knees. You never bend your knees.", "..."] },
    { "name": "The Lodge Manager", "anecdote": "Remembers every pair of wet boots left by the fire.", "sprite": "grandma", "quotes": ["The boots were still wet by the fire.", "..."] },
    { "name": "The One With Snacks", "anecdote": "Always has one more granola bar than anyone asked for.", "sprite": "snowman", "quotes": ["I always pack one extra granola bar.", "..."] },
    { "name": "The One Who Dropped The GoPro", "anecdote": "Has lost count of how many lens caps are buried in the snow.", "sprite": "braid", "quotes": ["It's somewhere in the snow. Probably.", "..."] },
    { "name": "The Group's Map App", "anecdote": "Built this exact game after the drive home.", "sprite": "bandana", "quotes": ["I built this right after the drive home.", "..."] },
    { "name": "The Fourth Friend", "quotes": ["I'm always up for anything.", "..."] },                       // unassigned #1 -> cast.diner0
    { "name": "The Friend Who Stayed In The Lodge", "sprite": "strawhat", "quotes": ["I watched from the window. It looked cold.", "..."] } // unassigned #2 -> extras[0]
  ],
  "assign": {                               // Q7
    "host": "Sam", "critic": "The Ski Instructor", "boss": "The Lodge Manager",
    "savior": "The One With Snacks", "butterfingers": "The One Who Dropped The GoPro", "builder": "The Group's Map App"
  },
  "music": { "vibe": "chase" },             // Q8
  "spellings": [], "offLimits": [], "email": "user@example.com" // Q9/Q10/Q11
}
```

**Defense** (`"template": "defense"`), people shape — this is literally
`tools/defense-sample-answers.json` — swaps `scene`/`stories` for
`defending` + `waves` (+ the same two optional boss lines; note the
Defense's First Boss fights ON the group's side, so `firstBossHeckle` is
their sniper-ally one-liner). Leaves **1** person unassigned (`diner0`
only, no `extras[]`):

```jsonc
{
  "template": "defense",
  "catchphrase": "That's not how you play that.",   // Q3, required
  "defending": "Game Night",                // Q4 (Defense), required — ONE short label, word for word (uppercased in-game)
  "waves": [                                // Q4 (Defense), required — 3-6 short labels, IN ORDER; each becomes a wave banner (uppercased)
    "Phone Notifications", "The Rules Explainer", "The Upstairs Neighbors", "The Rules Lawyer", "A Flipped Board"
  ],
  "firstBossHeckle": "Write that down, it's a penalty.",  // optional (Q7) -- the sniper's line, delivered from YOUR side
  "finalBossQuirk": "Still mad about the parking spot.",  // optional (Q7) -- the last wave's entrance line
  "title": "The Game Night Regulars",                     // Q5, required
  "people": [                               // Q6, required -- 7 people: host + 5 roles + 1 unassigned
    { "name": "Priya", "sprite": "mohawk", "quotes": ["I read the rulebook. Cover to cover.", "..."] },
    { "name": "The Scorekeeper", "anecdote": "Tracks points more carefully than the actual rulebook.", "sprite": "grandma", "quotes": ["I track points better than the rulebook.", "..."] },
    { "name": "The HOA President", "anecdote": "Has opinions about the driveway chalk.", "sprite": "beard", "quotes": ["The driveway chalk is a violation.", "..."] },
    { "name": "The Peacemaker", "anecdote": "Steps in right before someone flips the table.", "sprite": "overalls", "quotes": ["Nobody is flipping this table tonight.", "..."] },
    { "name": "The One Who Knocks The Board", "anecdote": "Has ended three games with one elbow.", "sprite": "braid", "quotes": ["My elbow has ended three games.", "..."] },
    { "name": "The Group's Score App", "anecdote": "Built this exact game during a rain delay.", "sprite": "vest", "quotes": ["I built this during a rain delay.", "..."] },
    { "name": "The Fourth Friend", "quotes": ["I'm always up for anything.", "..."] } // unassigned -> cast.diner0
  ],
  "assign": {                               // Q7
    "host": "Priya", "critic": "The Scorekeeper", "boss": "The HOA President",
    "savior": "The Peacemaker", "butterfingers": "The One Who Knocks The Board", "builder": "The Group's Score App"
  },
  "music": { "vibe": "spy" },               // Q8
  "spellings": [], "offLimits": [], "email": "user@example.com" // Q9/Q10/Q11
}
```

### Legacy shape (still fully supported)

Any answers file predating People First round 2 — `host` as a plain
string, `cast{role: name}`, and a separate `anecdotes{role: text}` map —
keeps working completely unchanged, forever. `tools/generate.js` detects
it by the *absence* of a `people` array and routes it through its own
code path (`buildOverrides()`'s `else` branch), never touching the
people-shape fields. This is the shape every pre-round-2 order used, and
it's what INTAKE.md's own Q6("host")/Q7("cast the rest")/Q8("anecdotes")
questions produced before this round folded them into the current
Q6("who's in it")/Q7("who's who"):

```jsonc
{
  "catchphrase": "SO TRUE.",
  "stories": ["...", "..."],
  "title": "The Test Group",
  "host": "Jordan",                         // plain string, not a `people` array
  "cast": {                                 // role: name, or null/omitted to skip
    "critic": "Bob", "boss": null, "savior": null,
    "butterfingers": "Morgan", "builder": "Riley"
  },
  "anecdotes": { "butterfingers": "Takes 40 photos of every plate.", "builder": "Builds something every time we hang out." },
  "hostSprite": "plain",                    // optional -- roster key, see below
  "spriteCast": { "critic": "grandma" },    // optional -- roster keys, see below
  "music": { "vibe": "warm", "songFile": null },
  "spellings": [], "offLimits": [], "email": "user@example.com",
  "lengthPreset": "five_min"
}
```

The legacy shape has no per-person `quotes`/per-person `anecdote` field
(`anecdotes` is keyed by role, not by person, and there's nothing
equivalent to Q6's quotes at all) — a config generated from it simply
has no `host.quotes`/`cast.<role>.quotes`, which every engine already
treats as "nothing to surface," same as an intentionally-blank quote row
in the people shape. The same idea (Gallery/Flight/Defense/Mission swap
`stories`/`scene` for their own content field, everything else identical)
applies to the legacy shape too — see any pre-round-2 commit of this file
for the full set of legacy examples, or just take any people-shape
example above and mentally flatten `people`+`assign` back into
`host`+`cast`+`anecdotes`.

`music.vibe` picks one of five **curated 6-track sets** (all of `dinner`/
`boss`/`chase`/`celebration`/`sad`/`gameover`, not just the ambient
`dinner` loop) — `upbeat`, `spy`, `chase`, `warm`, `sincere`. Each set's
`dinner` track is the same headline the vibe has always previewed
(Wacky Waiting / Mission Plausible / Time Driving / Farm Frolics / Sad
Descent, respectively); the other five slots are curated for register
coherence, with `sad`/`gameover` always drawn from a gentle pool
regardless of the set. `CFG_VIBE_TRACK_SETS` in `game/cfgcodec.js` is the
authoritative table (full track list documented in a comment there and in
`assets/audio/CREDITS.txt`). Omitted or unrecognized `music.vibe` no
longer means "today's fixed defaults" — `cfgApplyMusicVibe` picks one of
the five sets deterministically, hashing the order's own `gameId` (never
random at runtime), so a given order always sounds the same across
re-reads but different orders spread across the curated options. This
works identically across all five templates.

`scene` (Hangout only) picks one of the four **story skeletons** — THE
DINNER PARTY (default), THE ROAD TRIP, THE OFFICE PARTY, THE WEDDING
WEEKEND — the engine's own presentation code for that setting
(`game/skeletons.js`): different scenery, props, and mechanic-flavor
strings around the exact same beats and collision geometry. This CLI
passes it straight to `cfgBuildDefaultConfig(root, scene)`, which fills
in that scene's own flavor text (intro lines, the lose line, the "worst"
rank name) as the base every other answer still overrides — no bespoke
per-scene wiring needed here. See `README.md`'s "Story skeletons"
section. The Gallery, the Flight, the Defense, and the Mission have no `scene`
answer at all — their `cfgBuildDefaultConfig(root, undefined, template)`
base is its own separate, smaller object (see
`cfgBuildGalleryDefaultConfig`/`cfgBuildFlightDefaultConfig`/
`cfgBuildDefenseDefaultConfig`/`cfgBuildMissionDefaultConfig`).

`game/roster.js` keys — "which tile is this person?" (see that file's
~26-entry curated roster) — are optional in both shapes, at different
spots: the people shape reads each person's own `sprite` field directly
(see the examples above); the legacy shape reads top-level `hostSprite`/
`spriteCast` instead (every template). Either way, unset/unrecognized
silently no-ops (that slot keeps its default tile); not required by
either schema above — every existing answers file keeps working
byte-identically without ever setting these.

## What's automated vs. what still needs a human

**Automated by this CLI**: config assembly (names, content, catchphrase,
title, cast, forbidden words) for whichever template was picked, file
deployment (the right shell shape per template), verification (syntax +
full playthrough + tone gate, via that template's own driver), the
shareable link.

**Still requires a human** (`FULFILLMENT.md` step 2, "content review
gate"): whether an order is actually appropriate to fulfill at all —
doesn't target a non-consenting person, isn't hateful/sexual, isn't
doxxing, doesn't punch down. A tone gate can catch specific forbidden
*words*; it cannot judge whether a story is affectionate ribbing or
something crueler. **Read every free-text answer before delivering.**

**Not attempted**: bespoke, witty, hand-written dialogue per order. The
Hangout's supporting dialogue (critique lines, entrance lines, epilogue
captions, etc.) reuses `cfgBuildDefaultConfig`'s generic-but-complete,
already tone-gate-clean template text — the same content a `#cfg=` link
falls back to for anything a user didn't specify (the Gallery's/Flight's/
Defense's/Mission's own neutral fallback pools work the same way for
their optional boss lines). Real per-order wit remains `FULFILLMENT.md`'s hand-authored path
(copy `examples/roadtrip.config.js` as the schema reference, write every
line by hand) — this CLI automates getting a *complete, correct,
deployed, verified* game with zero manual steps; making every line of
dialogue funny for *this specific* group is still a person's job.

## A `FULFILLMENT.md` correction

While wiring up per-order song uploads, this round found that
`FULFILLMENT.md`'s existing note — `customSongPath: 'assets/theme.mp3'`
"relative to the config file's own folder" — undercounts a directory
level. `CONFIG.music.*` paths are fetched relative to the **page** that
loaded them (`games/<slug>/game/index.html` / `intro/index.html`, one
level *below* `games/<slug>/config.js`), not relative to `config.js`
itself — confirmed by how `game/engine.js` actually resolves the string
(a plain `fetch(MUSIC_TRACK_SRC)`, no config-relative base) and by how
`games/test-group/config.js`'s own shared-loop paths are written
(`../../../assets/...`, page-relative). The correct path for a per-order
asset at `games/<slug>/assets/theme.mp3` is `'../assets/theme.mp3'` — one
`../` to climb from `games/<slug>/game/` (or `intro/`) back up to
`games/<slug>/`, then into `assets/`. This CLI uses the corrected path;
`FULFILLMENT.md`'s "Assets" note has been corrected to match. (Uploaded-
song support is Hangout-only today — the Gallery/Flight/Defense/Mission
answer schemas above have no `music.songFile`.)

## The per-template verify drivers on their own

Each is also directly runnable against any existing config of its own
template, generated or hand-written — useful for re-checking a config
after a manual edit, or for a human-operated order that skips the
generator entirely:

```
node tools/verify-config.js games/<slug>/config.js    # Hangout
node tools/verify-gallery.js games/<slug>/config.js    # Gallery
node tools/verify-flight.js games/<slug>/config.js     # Flight
node tools/verify-defense.js games/<slug>/config.js    # Defense
node tools/verify-mission.js games/<slug>/config.js    # Mission
```

Prints PASS/FAIL, which phase the playthrough reached, which roles read
as cast, and every tone-gate/error line — exit code 0 on pass, 1 on
fail (2 on a missing argument). `tools/verify-skeletons.js` (no
arguments — run bare) is the third layer: the scene matrix, the roster
resource/default checks, and — for the Gallery, the Flight, the
Defense, and the Mission — a full-cast + host-only playthrough off each
template's own checked-in sample plus a fragment round-trip proving
`template` and every one of that template's own fields survive
encode/sanitize/decode.

## `game/cfgcodec.js` — reused, not reimplemented

Both the fragment-URL mechanism (every template's own `engine.js`) and
this generator share the exact same `game/cfgcodec.js` for compression,
the CONFIG whitelist schema (now five templates' worth), the neutral
default per template, and the deep merge — see that file's own header
comment for the full design, and `README.md`'s "URL-fragment configs"
section for the player-facing mechanism this CLI's instant links plug
into.
