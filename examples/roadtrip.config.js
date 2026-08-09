'use strict';
/* ======================================================================
   THE ROAD TRIP CREW -- example CONFIG demonstrating the 'roadtrip' story
   skeleton (see SPEC-skeletons.md / game/skeletons.js). Same shape/status
   as examples/test-group.config.js -- NOT wired into game/index.html or
   intro/index.html by default; point a game/intro pair at this file
   instead (swap the <script src> to "../examples/roadtrip.config.js", or
   copy it over game/config.js for a local check) to see a second scene
   played end to end.

   Differences from CONFIG #1 (game/config.js) and examples/test-group.config.js:
   - `scene: 'roadtrip'` -- the arena, props, and mechanic-flavor strings
     (start card, mode-select) all come from SKELETONS.roadtrip instead of
     SKELETONS.dinner; the beat choreography and collision geometry are
     byte-identical to every other scene.
   - A different cast mix: JUDGE, AUTHORITY, SAVIOR, and BUILDER are all
     cast (so Beats 2/3/4 and Epilogue B/Beat 5 all run), but
     BUTTERFINGERS is left uncast on purpose -- Epilogue A is skipped,
     proving a non-dinner scene degrades gracefully exactly like the
     dinner one does.
   - lengthPreset: 'five_min' (2 rounds, shortened epilogue holds).
   - music.customSongPath: null -- no uploaded song, so the per-beat loops
     (the 'dinner' key is an internal beat name -- not renamed, per
     SPEC-skeletons.md) play at full level as the actual score.
   ====================================================================== */
const CONFIG = {
  gameId: 'roadtrip-demo',

  scene: 'roadtrip',

  lengthPreset: 'five_min',

  title: {
    lockupLines: ['THE ROAD', 'TRIP'],
    introPageTitle: 'The Road Trip Crew',
    gamePageTitle: 'The Road Trip Crew -- Playable Demo',
  },

  punchline: 'FOR FREE?',

  host: {
    name: 'TAYLOR',
  },

  music: {
    customSongPath: null, // no custom song -- loops run at full level
    loops: {
      dinner: '../assets/audio/music/time-driving.ogg', // internal beat name -- not renamed
      boss: '../assets/audio/music/mission-plausible.ogg',
      chase: '../assets/audio/music/time-driving.ogg',
      celebration: '../assets/audio/music/farm-frolics.ogg',
      sad: '../assets/audio/music/sad-descent.ogg',
      gameover: '../assets/audio/music/game-over.ogg',
    },
    introFallback: '../assets/audio/music/night-at-the-beach.ogg',
  },

  forbiddenWords: ['COIN', 'BILL', 'COST', 'NOTHING'],

  dismissiveLine: 'OKAY. WE GET IT.',

  // five_min only plays the first 2
  stories: [
    { lines: ['WE MISSED THE EXIT', 'AND JUST KEPT DRIVING.'] },
    { lines: ['SOMEONE PACKED SEVEN SNACKS', 'AND ZERO WATER.'] },
  ],

  cast: {
    diner0: { name: 'THE FOURTH RIDER', spriteCol: 1, spriteRow: 7, anecdote: 'Calls shotgun every single time.' },
    judge: { name: 'THE MAP GUY', spriteCol: 4, spriteRow: 8, anecdote: 'Argues with the GPS out loud.' },
    authority: { name: 'DEVON', anecdote: 'Booked the whole trip and takes reviews personally.' },
    savior: { name: 'THE SNACK RUN GUY', anecdote: 'Always back with exactly the right gas-station find.' },
    butterfingers: null, // uncast on purpose -- proves a non-dinner scene degrades gracefully too
    builder: { name: 'THE PLAYLIST GUY', spriteCol: 2, spriteRow: 8, anecdote: 'Built this exact game on the drive home.' },
  },

  judge: {
    title: 'THE CRITIC',
    cardBody: ['DODGE HIS REVIEWS.', 'STAND ON THE MAP TO GRAB IT.', 'SPACE TO THROW.'],
    critiqueLines: [
      ['WRONG ROUTE.'],
      ['WE’VE BEEN HERE BEFORE.'],
      ['THE PLAYLIST WAS LUKEWARM.'],
      ['I’VE HEARD THIS STORY TWICE.'],
    ],
    duckLines: ['TOO SLOW, {HOST}.', 'PREDICTABLE.', 'I REVIEWED THAT THROW. ONE STAR.'],
    hitLines: ['OW. LUCKY.', 'THAT WAS MY GOOD MAP.', 'MY SUNGLASSES. YOU HIT MY SUNGLASSES.'],
    fakeDeathLine1: 'JUST KIDDING.',
    fakeDeathLine2: 'ALSO: WE ARE STILL LOST.',
    mockLine: ['I LIVE.', '...NICE PLAYLIST.'],
    retortLine: 'IT HAS RANGE.',
    itemLabel: 'THE WIDOWMAKER!',
    redemptionLine: 'THE ROUTE IS ACTUALLY FINE.',
  },

  savior: {
    itemName: 'THERMOS',
    line1: 'EXCUSE ME...',
    line2: 'I BROUGHT THE {ITEM}.',
    sincereLine: '{HOST}... YOU SAVED THE TRIP.',
  },

  authority: {
    entranceLine1: 'A ONE-STAR GOOGLE REVIEW?!',
    entranceLine2: 'WHO DID THIS?',
    turnGoodLine1: 'FIVE STARS...',
    turnGoodLine2: 'ROAD TRIP AT MY PLACE. SOMETIME.',
    beggingLine: 'PLEASE. FIVE STARS.',
    failLine: 'THE REVIEW STANDS.',
    cardTitle: 'DEVON HAS ARRIVED',
    cardBody: ["{HOST}'S TRIP LEAD SAW A BAD REVIEW.", 'CHASE THE CREW. BEG FOR FIVE STARS.', "DON'T GET CAUGHT."],
  },

  builder: {
    epBCaption1: 'THAT NIGHT, ONE OF THE CREW KEPT THINKING ABOUT THE DRIVE.',
    epBCaption2: 'THEY GOT HOME.',
    epBCaption3: 'AND BUILT A GAME ABOUT THAT EXACT ROAD TRIP.',
    epBCaption4: 'AND SHARED IT WITH THE CREW.',
    cardTitle: 'TECH SUPPORT',
    cardBody: ["ONE OF THE CREW CAN'T HEAR THE GAME.", 'CHASE THEM DOWN.', 'ASK IF THEY RESET IT.'],
    cantHearLine: "I CAN'T HEAR THE MUSIC.",
    resetQuestionLine: 'DID YOU RESET IT?',
    resetReplies: ['WHAT?', "IT'S JUST BEEPING.", 'STILL NO SOUND.'],
    resetFinalReply: 'OH. IT WORKS NOW.',
  },

  introStory: {
    scene1Lines: ['NOT LONG AGO,', '{HOST} TOOK THE CREW ON A DRIVE.', 'THE STORIES THEY TOLD WERE VERY ORDINARY.'],
    scene2Lines: ['THEY SAY {HOST} IS STILL AT THE WHEEL...', 'LISTENING.'],
    scene4LinesWithSavior: ['YOU GOT THE {ITEM}!', 'IT IS SOMEHOW STILL WARM.'],
    scene4LinesNoSavior: ['THE TRIP WAS SAVED.', 'EVERYONE HAD A GREAT TIME.'],
  },

  rankNames: {
    immaculate: 'IMMACULATE',
    comicTiming: 'COMIC TIMING',
    worst: 'FRIEND WHO RUINS ROAD TRIPS',
  },

  loseLine: 'THE TRIP IS RUINED.',
};
