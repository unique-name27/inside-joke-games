'use strict';
/* ======================================================================
   THE GAME NIGHT REGULARS -- example CONFIG for template: 'defense' (see
   SPEC-defense.md). A fictional sample group, distinct from examples/
   gallery-sample.config.js's and examples/flight-sample.config.js's own
   people -- this is the fixture round 2's own verification pass will
   drive (a scripted playthrough via defense/engine.js's own harness
   hooks, tools/verify-defense.js) and the one defense/index.html itself
   loads today. NOT wired into games/<slug>/ through tools/generate.js
   yet (that's round 2 -- the CLI/wizard don't know about
   `template: 'defense'` yet); point defense/index.html's
   <script src="config.js"> at this file (or copy it over) to play it
   directly. games/defense-sample/ (hand-built this round, see that
   folder's own files) is the playable, path-adjusted copy of this exact
   content.

   Every optional role is cast here (judge/authority/savior/
   butterfingers/builder) so a single load exercises THE FIRST BOSS's
   sniper heckle, THE SAVIOR's leak-triggered teleport, BUTTERFINGERS'
   seeded AoE drops, THE BUILDER's per-wave barricade, and THE FINAL
   BOSS's last-wave jumbo unit + turn-good mini-wave all in one
   playthrough. The host-only degradation path (every optional role
   uncast -> no heckle/teleport/barricade/drops, a grand-rush finale
   instead of a boss, still winnable with the scaled-down HP budget) is
   exercised in verification by cloning this object and nulling out
   `cast`, not by a second example file.
   ====================================================================== */
const CONFIG = {
  gameId: 'defense-sample',

  template: 'defense',

  title: {
    lockupLines: ['THE GAME', 'NIGHT REGULARS'],
    gamePageTitle: 'The Game Night Regulars -- Defense Demo',
  },

  punchline: "THAT'S NOT HOW YOU PLAY THAT.",

  host: {
    name: 'PRIYA',
    sprite: 'mohawk',
    quotes: ['I READ THE RULEBOOK. COVER TO COVER.', 'GAME NIGHT IS SACRED. DO NOT BE LATE.'],
  },

  defense: {
    defending: 'GAME NIGHT',
    waves: [
      'PHONE NOTIFICATIONS',
      'THE RULES EXPLAINER',
      'THE UPSTAIRS NEIGHBORS',
      'THE RULES LAWYER',
      'A FLIPPED BOARD',
    ],
    firstBossHeckle: "WRITE THAT DOWN, IT'S A PENALTY.",
    finalBossQuirk: 'STILL MAD ABOUT THE PARKING SPOT.',
  },

  music: {
    customSongPath: null, // no custom song -- loops run at full level
    // 'spy' vibe set (see game/cfgcodec.js's CFG_VIBE_TRACK_SETS), hand-
    // resolved into the loops block itself -- a fragment/config.js never
    // carries a live `musicVibe` field (cfgLoadFragmentOverride deletes it
    // after resolving loops; it's a wizard/generator-time convenience, not
    // a real CONFIG key), so this sample just authors the resolved result
    // directly, same as games/gallery-sample/'s and games/flight-sample/'s
    // own loops blocks.
    loops: {
      dinner: '../assets/audio/music/mission-plausible.ogg', // title, prep, between waves
      boss: '../assets/audio/music/mischief-stroll.ogg',      // THE FINAL BOSS's last wave
      chase: '../assets/audio/music/drumming-sticks.ogg',     // every other wave
      celebration: '../assets/audio/music/space-cadet.ogg',   // turn-good + win, through the end card
      sad: '../assets/audio/music/infinite-descent.ogg',      // the heart-lost sting before a retry
      gameover: '../assets/audio/music/game-over.ogg',        // the retry card's own bed
    },
    introFallback: '../assets/audio/music/night-at-the-beach.ogg', // unused (no separate intro) -- kept for schema parity with the codec's shared music block
  },

  forbiddenWords: [], // no universal baseline -- this group has nothing off-limits

  cast: {
    diner0: { name: 'THE FOURTH PLAYER', sprite: 'strawhat', anecdote: 'Always down for one more round.', quotes: ["I'M DOWN FOR ONE MORE ROUND.", 'DEAL ME IN. ALWAYS.'] },
    judge: { name: 'THE SCOREKEEPER', sprite: 'grandma', anecdote: 'Tracks points more carefully than the actual rulebook.', quotes: ['I TRACK POINTS BETTER THAN THE RULEBOOK.', 'THAT MOVE WAS ILLEGAL. I HAVE NOTES.'] },
    authority: { name: 'THE HOA PRESIDENT', sprite: 'beard', anecdote: 'Has opinions about the driveway chalk.', quotes: ['THE DRIVEWAY CHALK IS A VIOLATION.', 'I HAVE OPINIONS. MANY OPINIONS.'] },
    savior: { name: 'THE PEACEMAKER', sprite: 'overalls', anecdote: 'Steps in right before someone flips the table.', quotes: ['NOBODY IS FLIPPING THIS TABLE TONIGHT.', "LET'S ALL JUST TAKE A BREATH."] },
    butterfingers: { name: 'THE ONE WHO KNOCKS THE BOARD', sprite: 'braid', anecdote: 'Has ended three games with one elbow.', quotes: ['MY ELBOW HAS ENDED THREE GAMES.', 'IT WAS AN ACCIDENT. AGAIN.'] },
    builder: { name: "THE GROUP'S SCORE APP", sprite: 'vest', anecdote: 'Built this exact game during a rain delay.', quotes: ['I BUILT THIS DURING A RAIN DELAY.', 'THE SCOREBOARD NEVER LIES.'] },
  },

  rankNames: {
    immaculate: 'PERFECT GAME NIGHT',
    comicTiming: 'GAME NIGHT SAVED',
    worst: "TABLE'S FLIPPED. TRY AGAIN.",
  },
};
