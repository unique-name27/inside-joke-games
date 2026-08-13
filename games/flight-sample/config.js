'use strict';
/* ======================================================================
   THE POWDER DAY CREW -- hand-built deployed shell for template: 'flight'
   (see SPEC-flight.md's Round 1 deliverables and examples/flight-sample.
   config.js, which this is the path-adjusted, deployed twin of -- same
   content, `../assets/` swapped for `../../assets/` to match this file's
   extra directory depth, same convention as games/gallery-sample/config.js).

   tools/generate.js doesn't know about `template: 'flight'` yet (that's
   round 2 -- see SPEC-flight.md's build plan); this file is hand-built so
   the game is playable in a browser THIS round. Once round 2's generator
   ships, re-running `node tools/generate.js tools/flight-sample-answers.json
   --slug=flight-sample` will overwrite this file reproducibly from the
   same source content -- do not hand-edit lightly once that lands.
   ====================================================================== */
const CONFIG = {
  "gameId": "flight-sample",
  "template": "flight",
  "title": {
    "lockupLines": ["THE POWDER DAY", "CREW"],
    "introPageTitle": "The Powder Day Crew",
    "gamePageTitle": "The Powder Day Crew -- Flight Demo"
  },
  "punchline": "SOMEHOW WE ALWAYS MAKE IT DOWN.",
  "host": {
    "name": "SAM",
    "sprite": "skigreen"
  },
  "flight": {
    "beats": [
      "THE RENTAL SHOP LOST THE BOOT SIZES.",
      "SOMEONE PACKED SHORTS INSTEAD OF SNOW PANTS.",
      "THE CHAIRLIFT STOPPED FOR FORTY MINUTES.",
      "NOBODY COULD FIND THE CABIN IN THE DARK.",
      "THE HOT TUB WAS SOMEHOW STILL ICE COLD."
    ],
    "hazards": [
      "THE ICE PATCH",
      "THE WRONG TURN",
      "THE GONDOLA LINE",
      "THE VENDING MACHINE"
    ],
    "planeColor": "blue",
    "firstBossHeckle": "PIZZA, NOT FRENCH FRIES, ROOKIE.",
    "finalBossQuirk": "STILL MAD ABOUT THE WET BOOTS BY THE FIRE."
  },
  "music": {
    "customSongPath": null,
    "loops": {
      "dinner": "../../assets/audio/music/time-driving.ogg",
      "boss": "../../assets/audio/music/alpha-dance.ogg",
      "chase": "../../assets/audio/music/retro-beat.ogg",
      "celebration": "../../assets/audio/music/german-virtue.ogg",
      "sad": "../../assets/audio/music/sad-town.ogg",
      "gameover": "../../assets/audio/music/game-over.ogg"
    },
    "introFallback": "../../assets/audio/music/night-at-the-beach.ogg"
  },
  "forbiddenWords": [],
  "cast": {
    "judge": { "name": "THE SKI INSTRUCTOR", "sprite": "skipurple", "anecdote": "Judges every turn from the lift line." },
    "authority": { "name": "THE LODGE MANAGER", "sprite": "grandma", "anecdote": "Remembers every pair of wet boots left by the fire." },
    "savior": { "name": "THE ONE WITH SNACKS", "sprite": "snowman", "anecdote": "Always has one more granola bar than anyone asked for." },
    "butterfingers": { "name": "THE ONE WHO DROPPED THE GOPRO", "sprite": "braid", "anecdote": "Has lost count of how many lens caps are buried in the snow." },
    "builder": { "name": "THE GROUP'S MAP APP", "sprite": "bandana", "anecdote": "Built this exact game after the drive home." }
  },
  "rankNames": {
    "immaculate": "BLACK DIAMOND",
    "comicTiming": "STILL FINDING YOUR EDGES",
    "worst": "SHOULD HAVE STAYED IN THE LODGE"
  }
};
