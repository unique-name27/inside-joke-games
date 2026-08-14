'use strict';
/* ======================================================================
   THE POWDER DAY CREW -- example CONFIG for template: 'flight' (see
   SPEC-flight.md). A fictional sample group, distinct from examples/
   gallery-sample.config.js's people -- this is the fixture round 2's own
   verification pass will drive (a scripted playthrough via flight/
   engine.js's __probe/__tick/__flap harness hooks, tools/verify-flight.js)
   and the one flight/index.html itself loads today. NOT wired into
   games/<slug>/ through tools/generate.js yet (that's round 2 -- the CLI/
   wizard don't know about `template: 'flight'` yet); point flight/
   index.html's <script src="config.js"> at this file (or copy it over) to
   play it directly. games/flight-sample/ (hand-built this round, see that
   folder's own files) is the playable, path-adjusted copy of this exact
   content.

   Every optional role is cast here (judge/authority/savior/butterfingers/
   builder) so a single load exercises THE FIRST BOSS's thrown-object leg,
   THE FINAL BOSS's sinusoidal approach gate + turn-good landing, THE
   SAVIOR's one-time save, and the BUTTERFINGERS phone gag all in one
   playthrough. The host-only degradation path (every optional role
   uncast -> the boss leg plays as an ordinary leg, a clear-sky landing,
   no savior save, no phone gag) is exercised in verification by cloning
   this object and nulling out `cast`, not by a second example file.
   ====================================================================== */
const CONFIG = {
  gameId: 'flight-sample',

  template: 'flight',

  title: {
    lockupLines: ['THE POWDER DAY', 'CREW'],
    gamePageTitle: 'The Powder Day Crew -- Flight Demo',
  },

  punchline: 'SOMEHOW WE ALWAYS MAKE IT DOWN.',

  host: {
    name: 'SAM',
    sprite: 'skigreen',
    quotes: ['WE ALWAYS MAKE IT DOWN. EVENTUALLY.', 'THIS IS FINE. THE SNOW IS FINE.'],
  },

  flight: {
    beats: [
      'THE RENTAL SHOP LOST THE BOOT SIZES.',
      'SOMEONE PACKED SHORTS INSTEAD OF SNOW PANTS.',
      'THE CHAIRLIFT STOPPED FOR FORTY MINUTES.',
      'NOBODY COULD FIND THE CABIN IN THE DARK.',
      'THE HOT TUB WAS SOMEHOW STILL ICE COLD.',
    ],
    hazards: [
      'THE ICE PATCH',
      'THE WRONG TURN',
      'THE GONDOLA LINE',
      'THE VENDING MACHINE',
    ],
    planeColor: 'blue',
    firstBossHeckle: 'PIZZA, NOT FRENCH FRIES, ROOKIE.',
    finalBossQuirk: 'STILL MAD ABOUT THE WET BOOTS BY THE FIRE.',
  },

  music: {
    customSongPath: null, // no custom song -- loops run at full level
    // 'chase' vibe set (see game/cfgcodec.js's CFG_VIBE_TRACK_SETS), hand-
    // resolved into the loops block itself -- a fragment/config.js never
    // carries a live `musicVibe` field (cfgLoadFragmentOverride deletes it
    // after resolving loops; it's a wizard/generator-time convenience, not
    // a real CONFIG key), so this sample just authors the resolved result
    // directly, same as games/gallery-sample/config.js's own loops block.
    loops: {
      dinner: '../assets/audio/music/time-driving.ogg',      // title, get-ready, legs 1-2
      boss: '../assets/audio/music/alpha-dance.ogg',          // THE FINAL BOSS's approach gate
      chase: '../assets/audio/music/retro-beat.ogg',          // later legs
      celebration: '../assets/audio/music/german-virtue.ogg', // landing through the end card
      sad: '../assets/audio/music/sad-town.ogg',              // the breather before THE FINAL BOSS
      gameover: '../assets/audio/music/game-over.ogg',        // THE TRIP STALLS retry card
    },
    introFallback: '../assets/audio/music/night-at-the-beach.ogg', // unused (no separate intro) -- kept for schema parity with the codec's shared music block
  },

  forbiddenWords: [], // no universal baseline -- this group has nothing off-limits

  cast: {
    judge: { name: 'THE SKI INSTRUCTOR', sprite: 'skipurple', anecdote: 'Judges every turn from the lift line.', quotes: ['BEND YOUR KNEES. YOU NEVER BEND YOUR KNEES.', 'I JUDGE EVERY TURN FROM THE LIFT LINE.'] },
    authority: { name: 'THE LODGE MANAGER', sprite: 'grandma', anecdote: 'Remembers every pair of wet boots left by the fire.', quotes: ['THE BOOTS WERE STILL WET BY THE FIRE.', 'I REMEMBER EVERY PAIR OF WET BOOTS.'] },
    savior: { name: 'THE ONE WITH SNACKS', sprite: 'snowman', anecdote: 'Always has one more granola bar than anyone asked for.', quotes: ['I ALWAYS PACK ONE EXTRA GRANOLA BAR.', 'SNACKS FIRST. QUESTIONS LATER.'] },
    butterfingers: { name: 'THE ONE WHO DROPPED THE GOPRO', sprite: 'braid', anecdote: 'Has lost count of how many lens caps are buried in the snow.', quotes: ["IT'S SOMEWHERE IN THE SNOW. PROBABLY.", 'THE LENS CAP IS GONE FOREVER.'] },
    builder: { name: 'THE GROUP\'S MAP APP', sprite: 'bandana', anecdote: 'Built this exact game after the drive home.', quotes: ['I BUILT THIS RIGHT AFTER THE DRIVE HOME.', 'REROUTING. AGAIN.'] },
  },

  // PEOPLE FIRST (SPEC-people.md round 1) -- people beyond host + the five
  // roles: the friend who skipped the slopes entirely.
  extras: [
    { name: 'THE FRIEND WHO STAYED IN THE LODGE', sprite: 'strawhat', quotes: ['I WATCHED FROM THE WINDOW. IT LOOKED COLD.', 'SOMEONE HAD TO GUARD THE HOT COCOA.'] },
  ],

  rankNames: {
    immaculate: 'BLACK DIAMOND',
    comicTiming: 'STILL FINDING YOUR EDGES',
    worst: 'SHOULD HAVE STAYED IN THE LODGE',
  },
};
