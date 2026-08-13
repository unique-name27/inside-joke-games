'use strict';
/* ======================================================================
   THE GAME NIGHT REGULARS -- hand-built deployed shell for template:
   'defense' (see SPEC-defense.md's Round 1 deliverables and examples/
   defense-sample.config.js, which this is the path-adjusted, deployed
   twin of -- same content, `../assets/` swapped for `../../assets/` to
   match this file's extra directory depth, same convention as
   games/gallery-sample/config.js and games/flight-sample/config.js).

   tools/generate.js doesn't know about `template: 'defense'` yet (that's
   round 2 -- see SPEC-defense.md's build plan); this file is hand-built so
   the game is playable in a browser THIS round. Once round 2's generator
   ships, re-running `node tools/generate.js tools/defense-sample-answers.json
   --slug=defense-sample` will overwrite this file reproducibly from the
   same source content -- do not hand-edit lightly once that lands.
   ====================================================================== */
const CONFIG = {
  "gameId": "defense-sample",
  "template": "defense",
  "title": {
    "lockupLines": ["THE GAME", "NIGHT REGULARS"],
    "introPageTitle": "The Game Night Regulars",
    "gamePageTitle": "The Game Night Regulars -- Defense Demo"
  },
  "punchline": "THAT'S NOT HOW YOU PLAY THAT.",
  "host": {
    "name": "PRIYA",
    "sprite": "mohawk"
  },
  "defense": {
    "defending": "GAME NIGHT",
    "waves": [
      "PHONE NOTIFICATIONS",
      "THE RULES EXPLAINER",
      "THE UPSTAIRS NEIGHBORS",
      "THE RULES LAWYER",
      "A FLIPPED BOARD"
    ],
    "firstBossHeckle": "WRITE THAT DOWN, IT'S A PENALTY.",
    "finalBossQuirk": "STILL MAD ABOUT THE PARKING SPOT."
  },
  "music": {
    "customSongPath": null,
    "loops": {
      "dinner": "../../assets/audio/music/mission-plausible.ogg",
      "boss": "../../assets/audio/music/mischief-stroll.ogg",
      "chase": "../../assets/audio/music/drumming-sticks.ogg",
      "celebration": "../../assets/audio/music/space-cadet.ogg",
      "sad": "../../assets/audio/music/infinite-descent.ogg",
      "gameover": "../../assets/audio/music/game-over.ogg"
    },
    "introFallback": "../../assets/audio/music/night-at-the-beach.ogg"
  },
  "forbiddenWords": [],
  "cast": {
    "diner0": { "name": "THE FOURTH PLAYER", "sprite": "strawhat", "anecdote": "Always down for one more round." },
    "judge": { "name": "THE SCOREKEEPER", "sprite": "grandma", "anecdote": "Tracks points more carefully than the actual rulebook." },
    "authority": { "name": "THE HOA PRESIDENT", "sprite": "beard", "anecdote": "Has opinions about the driveway chalk." },
    "savior": { "name": "THE PEACEMAKER", "sprite": "overalls", "anecdote": "Steps in right before someone flips the table." },
    "butterfingers": { "name": "THE ONE WHO KNOCKS THE BOARD", "sprite": "braid", "anecdote": "Has ended three games with one elbow." },
    "builder": { "name": "THE GROUP'S SCORE APP", "sprite": "vest", "anecdote": "Built this exact game during a rain delay." }
  },
  "rankNames": {
    "immaculate": "PERFECT GAME NIGHT",
    "comicTiming": "GAME NIGHT SAVED",
    "worst": "TABLE'S FLIPPED. TRY AGAIN."
  }
};
