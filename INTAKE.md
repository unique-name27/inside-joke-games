# Inside Joke Games — order form

Customer-facing content for the intake form (Google Form). Copy each
numbered question in as its own form item, using the suggested field
type. Everything here assumes the user is ordering **one** personalized
game for their friend group.

---

**Q1. What's the joke?** *(Multiple choice, required)*

Every inside joke has a shape — pick the one that fits your group.
This picks which game you get; every question after this one adjusts
to match.

- ☐ A place you always end up + the stories you retell → **The Hangout**
- ☐ The things your group can't stop roasting → **The Gallery**
- ☐ A disaster trip you keep retelling → **The Flight**
- ☐ A recurring annoyance the group defends against → **The Defense**
- ☐ Us-against-the-world absurdism → **The Mission**

Not sure? Default to The Hangout — it's the original.

---

**Q2. Pick your setting.** *(Multiple choice, required — Hangout games only; skip if you picked The Gallery, The Flight, The Defense, or The
Mission in Q1)*

Same game, four rooms — pick whichever one actually fits your group. Every
setting shares the same roles and the same engine; only the scenery, props,
and a few flavor lines change.

- ☐ THE DINNER PARTY — a table, some stories, one unforgettable question.
- ☐ THE ROAD TRIP — a campfire at the rest stop, stories from the road.
- ☐ THE OFFICE PARTY — the break room, after hours.
- ☐ THE WEDDING WEEKEND — a reception hall, a DJ booth, and the toasts.

Not sure? Default to THE DINNER PARTY — it's the original.

---

**Q3. What's your group's catchphrase?** *(Short answer, required)*

Every group has one — the thing somebody always says. It becomes the
punchline of your game, the one line everybody shouts at the big finish
(spoken out loud, too). Type it exactly how your group says it.

---

**Q4. Tell us the story.** *(Paragraph, required — the exact question depends on your answer to Q1)*

- **If you picked The Hangout:** Tell us 2–3 real, boring stories from
  your group. Nothing dramatic — the whole joke is that they're *so*
  ordinary. Think: the time someone drank the house wine so nobody else
  had to, or spent forty minutes alphabetizing the spice rack while
  everyone waited. One or two sentences each.
- **If you picked The Gallery:** Give us 4–8 things your group can't
  stop roasting — word for word, exactly how you'd say it. Each one
  becomes a target on the shooting stall, plaque and all. ("Fantasy
  draft speeches," "Spreadsheet at brunch.")
- **If you picked The Flight:** Tell the trip in order — one line per
  leg, word for word how the group tells it (3–6 legs). Then: what
  kept getting in the way? Short labels — they get painted on the
  rocks the plane dodges (2–6 hazards). Then pick a plane color:
  Yellow, Red, Blue, or Green.
- **If you picked The Defense:** What does your group actually defend?
  One short label — it goes on a plaque, word for word ("GAME NIGHT",
  "THE THERMOSTAT"). Then: what keeps coming for it? 3–6 short labels,
  in order — each one becomes a wave of the recurring annoyance
  marching in ("MONDAY MEETINGS," "THE GROUP CHAT AT 2AM").
- **If you picked The Mission:** What's the mission? The sillier the
  better — it goes on the banner ("FIND THE BEST TACO"). Then: what are
  you up against? Short labels, in order (2–6 swarms) — each one becomes
  a stage's enemy swarm ("THE GROUP CHAT," "BAD DIRECTIONS"). Then pick
  a ship color: Blue, Green, Orange, or Red.

---

**Q5. What should we call your game?** *(Short answer, required)*

Your group's name, an inside joke, whatever fits — see
`examples/test-group.config.js` (The Hangout), `examples/gallery-sample.config.js`
(The Gallery), `examples/flight-sample.config.js` (The Flight),
`examples/defense-sample.config.js` (The Defense), or
`examples/mission-sample.config.js` (The Mission) for a worked example
matching whichever shape you picked in Q1. Keep it short; it has to
render as blocky pixel lettering.

---

**Q6. Who's in it?** *(A repeating block, 3–6 times: name + a character
picker + 1–3 short-answer "quote" fields + an optional quirk line —
required, at least 3)*

Your group, your family, your team — 3 to 6 people. Mom who's always
cooking, Dad with the complaints, the sister who won't get off her
phone — that's a cast. For **each** person, give us:

- **Their name** — first name or nickname is fine.
- **Which character looks like them** — we'll show you a picker (~26
  tiles across a few different styles) once the form's live; for a
  paper/plain-text version of this form, just note a description and
  we'll pick something close.
- **1–3 things they actually say, word for word.** The real reason this
  product works — their own lines end up in their own mouths in the
  game (a heckle, a between-round quip, a credits line). Type them
  exactly how the person says them.
- **One quick memory or quirk** *(optional)* — a habit, a running bit,
  something they always do. We use this as flavor text, not literal
  dialogue, so don't worry about making it "game-ready."

Every person you list here ends up in the game somehow — as the main
character, one of the five roles below, or (if there's nobody left to
assign them to) still gets a credited line and their own quote in the
end card. Nobody's typed name is ever dropped.

---

**Q7. Who's who?** *(Multiple choice for the main character, required —
then a pick-one-of-Q6's-people-or-skip row per role below)*

**Who's the main character?** — the one the player plays as. In The
Hangout that's the one who cooks, hosts, or organizes; in The Gallery
it's whoever's running the stall; in The Flight it's whoever's flying
the plane; in The Defense it's the anchor tower nearest the thing
everyone protects; in The Mission they fly lead, the rest of the
squadron falling in around them. Pick one of the people from Q6.

**Then, for each role below: pick one of your remaining Q6 people, or
skip it.** Every boss is somebody you actually know — no placeholders.
Most groups fill 2–4 of these five; anyone left over still isn't
lost (see Q6's own last line).

| Role | Who's this? |
|---|---|
| **The First Boss** | Every game needs a boss fight. Pick a real person from your group — they'll heckle from on high (and, in The Gallery/The Flight, throw things), and the player gives it right back. In The Defense they're on your side for once: the team's sniper, still heckling — just aimed at the annoyances. In The Mission they're back on the other side: the ace fighter that ambushes the squadron mid-mission, heckling before peeling off. |
| **The Final Boss** | Someone with actual authority in your world — a manager, a parent, a coach, a landlord — who storms in mad about something small, then comes around. (In The Defense they lead the very last wave — and then, beaten, join your side for the cleanup. In The Mission they command the flagship at the end, then eject and join the victory flyby.) |
| **The Savior** | The sincere one who saves the day — shows up right when things look bad. |
| **Butterfingers** | The one tech/phone mishaps always happen to. |
| **The Builder** | The one who'd actually go build something like this game. |

*(The First Boss and The Final Boss are historically named "critic" and
"boss" in the answers schema / config files — `judge`/`authority`
under the hood; the names on this form are the current, boss-slot framing
only.)*

**If you picked The Gallery, The Flight, The Defense, or The Mission in
Q1**, two more optional short-answer fields belong here: what The First
Boss heckles with (their own words, short — in The Defense this is
their sniper one-liner, delivered from your side of the field; in The
Mission it's beamed across the screen mid-ambush), and The Final Boss's
dead giveaway or what they're mad about — the thing that always tells you
it's really them (in The Mission this is beamed between the flagship's
volleys). Both optional — leave either blank and the game reaches for one
of that person's own Q6 quotes first, then a neutral, already-cleared
line if they didn't give one either.

---

**Q8. Music — upload a song, or pick a vibe.** *(File upload OR multiple choice — upload only available for The Hangout today)*

If your group has an anthem, upload it (MP3, under ~15MB) and it'll play as
the game's soundtrack (The Hangout only for now). Otherwise pick a vibe and
we'll score it with one of our stock track sets — the same six-slot set
scores every beat of the game, not just the ambient parts:

- ☐ Upbeat / a little goofy ("Wacky Waiting")
- ☐ Playful tension, like a spy movie ("Mission Plausible")
- ☐ Fast and fun, chase energy ("Time Driving")
- ☐ Warm and celebratory ("Farm Frolics")
- ☐ Quiet and sincere ("Sad Descent")
- ☐ Surprise us

---

**Q9. Any names we need to spell exactly right?** *(Paragraph, optional)*

List preferred spellings/nicknames for anyone named above, if it matters —
"Kathryn not Catherine," "goes by Bird," that kind of thing.

---

**Q10. Anything off-limits?** *(Paragraph, optional)*

Any topic, word, or phrase we should keep out of the game entirely — an
old joke that didn't land, a sore subject, a real name someone would rather
we not use. When in doubt, tell us and we'll leave it out.

---

**Q11. Email address for delivery.** *(Short answer, required)*

Where we send your game's link once it's ready (turnaround is about 48
hours).

---

### Notes for whoever builds the Google Form

- Q1/Q3/Q5/Q6/Q7 (the main-character pick)/Q11 are always required; Q2 is
  required only on the Hangout branch (make it conditional on Q1, or note
  it's skippable); Q4's exact required sub-fields depend on Q1 (see that
  question's own branches above); Q6 requires at least 3 people (up to
  6); everything else is optional (an empty Q7 role row is exactly how a
  user skips it — no "N/A" needed; an unanswered Q2 defaults to THE
  DINNER PARTY).
- Google Forms' native branching (Section-based "go to section based on
  answer") is the natural fit for Q1 → the rest of the form: five
  sections, one per template, each ending with the shared questions
  (Q3 catchphrase onward) — or, simpler to build and maintain, keep the
  form linear and just show/hide Q2 and swap Q4's instructions per the
  branches written above (a human is reading these responses anyway, so
  a purely cosmetic mismatch between what Q4 asks for and what got typed
  is a low-risk simplification if the branching logic is a hassle to
  wire up).
- Q6 is most naturally a repeating "person" section (Google Forms' own
  section-repeat isn't native — a set of 6 identically-shaped sections,
  with "skip to Q7" available from section 3 onward, approximates it; a
  plain paper/PDF version of this form can just print 6 copies of the
  same block instead). Each person's block is: name, a note on which
  character/description fits them (the live picker only exists in the
  web builder), 1–3 quote short-answer fields, one optional quirk field.
- Q7 is most naturally the main-character multiple-choice (populated from
  whatever names got typed into Q6) followed by 5 more multiple-choice
  rows, one per role, each listing the SAME Q6 names plus a "Skip this
  role" option — makes the skip-by-picking-that-option behavior obvious,
  and keeps one person from accidentally being picked for two roles. The
  two optional boss-line fields (heckle/quirk — every template except the
  Hangout) can live in that same section.
- Q10's answers map directly onto the deployed game's `forbiddenWords`
  list — there's no baseline/universal list, this order's own answer is
  the entire tone gate; the same gate now also scans every Q6 quote and
  name (not just Q3/Q4/Q5's own text) — see `FULFILLMENT.md`.
