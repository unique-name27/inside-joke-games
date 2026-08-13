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

Not sure? Default to The Hangout — it's the original.

---

**Q2. Pick your setting.** *(Multiple choice, required — Hangout games only; skip if you picked The Gallery or The Flight in Q1)*

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

---

**Q5. What should we call your game?** *(Short answer, required)*

Your group's name, an inside joke, whatever fits — see
`examples/test-group.config.js` (The Hangout), `examples/gallery-sample.config.js`
(The Gallery), or `examples/flight-sample.config.js` (The Flight) for a
worked example matching whichever shape you picked in Q1. Keep it
short; it has to render as blocky pixel lettering.

---

**Q6. Who's the host?** *(Short answer, required)*

Every game has a host — the character the player plays. In The Hangout
that's the one who cooks, hosts, or organizes; in The Gallery it's whoever's
running the stall; in The Flight it's whoever's flying the plane. Just
their first name (or nickname) is fine.

---

**Q7. Cast the rest of your group.** *(a short-answer field per row below — skip any that don't fit; only Q6's host is required)*

Every boss is somebody you actually know. Real people only — for each
role, give us a name **or** leave it blank to skip that slot entirely — the
game adjusts automatically, no placeholder needed. Most groups cast 2–4 of
these.

| Role | Who's this? |
|---|---|
| **The First Boss** | Every game needs a boss fight. Pick a real person from your group — they'll heckle from on high (and, in The Gallery/The Flight, throw things), and the player gives it right back. |
| **The Final Boss** | Someone with actual authority in your world — a manager, a parent, a coach, a landlord — who storms in mad about something small, then comes around. |
| **The Savior** | The sincere one who saves the day — shows up right when things look bad. |
| **Butterfingers** | The one tech/phone mishaps always happen to. |
| **The Builder** | The one who'd actually go build something like this game. |

*(The First Boss and The Final Boss are historically named "critic" and
"boss" in the answers schema / config files — `judge`/`authority`
under the hood; the names on this form are the current, boss-slot framing
only.)*

**If you picked The Gallery or The Flight in Q1**, two more optional
short-answer fields belong here: what The First Boss heckles with (their
own words, short), and The Final Boss's dead giveaway — the thing that
always tells you it's really them, no matter what they're wearing. Both
optional; leave either blank and the game falls back to a neutral,
already-cleared line.

---

**Q8. Give us one quick memory or quirk for each person you cast in Q7.** *(Paragraph, required if Q7 has any names)*

One line per person is plenty — a habit, a running bit, something they
always do. We use these as flavor text, not as literal dialogue, so don't
worry about making them "game-ready."

---

**Q9. Music — upload a song, or pick a vibe.** *(File upload OR multiple choice — upload only available for The Hangout today)*

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

**Q10. Any names we need to spell exactly right?** *(Paragraph, optional)*

List preferred spellings/nicknames for anyone named above, if it matters —
"Kathryn not Catherine," "goes by Bird," that kind of thing.

---

**Q11. Anything off-limits?** *(Paragraph, optional)*

Any topic, word, or phrase we should keep out of the game entirely — an
old joke that didn't land, a sore subject, a real name someone would rather
we not use. When in doubt, tell us and we'll leave it out.

---

**Q12. Email address for delivery.** *(Short answer, required)*

Where we send your game's link once it's ready (turnaround is about 48
hours).

---

### Notes for whoever builds the Google Form

- Q1/Q3/Q5/Q6/Q12 are always required; Q2 is required only on the
  Hangout branch (make it conditional on Q1, or note it's skippable);
  Q4's exact required sub-fields depend on Q1 (see that question's own
  branches above); everything else is optional (an empty Q7 role is
  exactly how a user skips it — no "N/A" needed; an unanswered Q2
  defaults to THE DINNER PARTY).
- Google Forms' native branching (Section-based "go to section based on
  answer") is the natural fit for Q1 → the rest of the form: three
  sections, one per template, each ending with the shared questions
  (Q3 catchphrase onward) — or, simpler to build and maintain, keep the
  form linear and just show/hide Q2 and swap Q4's instructions per the
  branches written above (a human is reading these responses anyway, so
  a purely cosmetic mismatch between what Q4 asks for and what got typed
  is a low-risk simplification if the branching logic is a hassle to
  wire up).
- Q7 is most naturally 5 separate short-answer fields (one per role) inside
  a "Cast your group" section, rather than one big text box — makes the
  skip-by-leaving-blank behavior obvious. The two optional Gallery/Flight
  boss-line fields (heckle/quirk) can live in that same section.
- Q11's answers map directly onto the deployed game's `forbiddenWords` list
  — there's no baseline/universal list, this order's own answer is the
  entire tone gate — see `FULFILLMENT.md`.
