# Inside Joke Games — order form

Customer-facing content for the intake form (Google Form). Copy each
numbered question in as its own form item, using the suggested field type.
Everything here assumes the buyer is ordering **one** personalized game for
their friend group.

---

**Q1. What's your group's catchphrase?** *(Short answer, required)*

Every group has one — the thing somebody always says. Ours is "FOR FREE?"
(don't ask). Yours becomes the punchline of your game, the one line
everybody shouts at the big finish. Type it exactly how your group says it.

---

**Q2. Tell us 2–3 real, boring stories from your group.** *(Paragraph, required)*

Nothing dramatic — the whole joke is that they're *so* ordinary. Think: the
time someone drank the house wine so nobody else had to, or spent forty
minutes alphabetizing the spice rack while everyone waited. One or two
sentences each. Give us 2 or 3.

---

**Q3. What should we call your game?** *(Short answer, required)*

A title in the spirit of "Karks Cub Kingdom" — your group's name, an inside
joke, whatever fits. Keep it short; it has to render as blocky pixel
lettering.

---

**Q4. Who's the host — the one who cooks, hosts, or organizes?** *(Short answer, required)*

Every game has a host; this is the character the player plays. Just their
first name (or nickname) is fine.

---

**Q5. Cast the rest of your group.** *(a short-answer field per row below — skip any that don't fit; only Q4's host is required)*

For each role, give us a name **or** leave it blank to skip that role
entirely — the game adjusts automatically, no placeholder needed. Most
groups cast 2–4 of these.

| Role | Who's this? |
|---|---|
| **The Critic** | The one who critiques everything — the food, the seating, your throw. Shows up as the game's boss fight. |
| **The Boss** | An intimidating figure who storms in angry about something small, then comes around. |
| **The Savior** | The sincere one who saves the day — shows up right when things look bad. |
| **Butterfingers** | The one tech/phone mishaps always happen to. |
| **The Builder** | The one who'd actually go build something like this game. |

---

**Q6. Give us one quick memory or quirk for each person you cast in Q5.** *(Paragraph, required if Q5 has any names)*

One line per person is plenty — a habit, a running bit, something they
always do. We use these as flavor text, not as literal dialogue, so don't
worry about making them "game-ready."

---

**Q7. Music — upload a song, or pick a vibe.** *(File upload OR multiple choice)*

If your group has an anthem, upload it (MP3, under ~15MB) and it'll play as
the game's soundtrack. Otherwise pick a vibe and we'll score it with one of
our stock tracks:

- ☐ Upbeat / a little goofy ("Wacky Waiting")
- ☐ Playful tension, like a spy movie ("Mission Plausible")
- ☐ Fast and fun, chase energy ("Time Driving")
- ☐ Warm and celebratory ("Farm Frolics")
- ☐ Quiet and sincere ("Sad Descent")
- ☐ Surprise us

---

**Q8. Any names we need to spell exactly right?** *(Paragraph, optional)*

List preferred spellings/nicknames for anyone named above, if it matters —
"Kathryn not Catherine," "goes by Bird," that kind of thing.

---

**Q9. Anything off-limits?** *(Paragraph, optional)*

Any topic, word, or phrase we should keep out of the game entirely — an
old joke that didn't land, a sore subject, a real name someone would rather
we not use. When in doubt, tell us and we'll leave it out.

---

**Q10. Email address for delivery.** *(Short answer, required)*

Where we send your game's link once it's ready (turnaround is about 48
hours).

---

### Notes for whoever builds the Google Form

- Q1/Q2/Q3/Q4/Q10 are required; everything else is optional (an empty Q5
  role is exactly how a buyer skips it — no "N/A" needed).
- Q5 is most naturally 5 separate short-answer fields (one per role) inside
  a "Cast your group" section, rather than one big text box — makes the
  skip-by-leaving-blank behavior obvious.
- Q9's answers map directly onto the deployed game's `forbiddenWords` list
  (plus KCK's own COIN/BILL/COST/NOTHING baseline) — see `FULFILLMENT.md`.
