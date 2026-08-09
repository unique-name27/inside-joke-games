'use strict';
/* ======================================================================
   THE TEST GROUP -- a real deployed game, proving the shared-engine
   mechanism end to end (see README.md "How games are added" and
   FULFILLMENT.md's worked example). This is examples/test-group.config.js,
   copied to live alongside its own game/intro pages exactly the way a real
   order's games/<slug>/config.js would, with the music asset paths adjusted
   for this file's actual location (three levels below the repo root,
   instead of examples/'s two) -- everything else is untouched.
   ====================================================================== */
const CONFIG = {
  gameId: 'test-group',

  lengthPreset: 'five_min',

  title: {
    lockupLines: ['THE TEST', 'GROUP'],
    introPageTitle: 'The Test Group',
    gamePageTitle: 'The Test Group -- Playable Demo',
  },

  punchline: 'FOR FREE?',

  host: {
    name: 'JORDAN',
  },

  music: {
    customSongPath: null, // no custom song -- loops run at full level
    loops: {
      dinner: '../../../assets/audio/music/wacky-waiting.ogg',
      boss: '../../../assets/audio/music/mission-plausible.ogg',
      chase: '../../../assets/audio/music/time-driving.ogg',
      celebration: '../../../assets/audio/music/farm-frolics.ogg',
      sad: '../../../assets/audio/music/sad-descent.ogg',
      gameover: '../../../assets/audio/music/game-over.ogg',
    },
    introFallback: '../../../assets/audio/music/night-at-the-beach.ogg',
  },

  forbiddenWords: ['COIN', 'BILL', 'COST', 'NOTHING'],

  // required even with JUDGE uncast -- Beat 1's laugh-drain death can still
  // happen (dinner rounds always run) and reuses this as its reaction line
  dismissiveLine: 'HUH. OKAY.',

  // five_min only plays the first 2
  stories: [
    { lines: ['I MISSED MY FLIGHT', 'BY FOUR MINUTES.'] },
    { lines: ['I ALPHABETIZED THE SPICE RACK', 'WHILE WE WERE ON HOLD.'] },
  ],

  cast: {
    diner0: { name: 'CASEY', spriteCol: 1, spriteRow: 7, anecdote: 'Brings a board game every time.' },
    judge: null,         // uncast -- no boss fight, no Beat 3, no Beat 4 (see file header)
    authority: null,     // uncast (downstream of judge -- see above)
    savior: null,        // uncast (downstream of judge -- see above)
    butterfingers: { name: 'MORGAN', spriteCol: 3, spriteRow: 8, anecdote: 'Takes 40 photos of every plate.' },
    builder: { name: 'RILEY', spriteCol: 2, spriteRow: 8, anecdote: 'Builds something every time we hang out.' },
  },

  butterfingers: {
    deleteAllLine: 'DELETE ALL?',
    deletedLine: 'DELETED.',
    allMyPhotosLine: 'ALL MY PHOTOS.',
  },

  builder: {
    epBCaption1: 'THAT NIGHT, ONE OF THE FRIENDS KEPT THINKING ABOUT THE DINNER.',
    epBCaption2: 'THEY FLEW HOME.',
    epBCaption3: 'AND BUILT A GAME ABOUT THAT EXACT DINNER.',
    epBCaption4: 'AND SHARED IT WITH THE GROUP.',
    cardTitle: 'TECH SUPPORT',
    cardBody: ["ONE OF THE FRIENDS CAN'T HEAR THE GAME.", 'CHASE THEM DOWN.', 'ASK IF THEY RESET IT.'],
    cantHearLine: "I CAN'T HEAR THE MUSIC.",
    resetQuestionLine: 'DID YOU RESET IT?',
    resetReplies: ['WHAT?', "IT'S JUST BEEPING.", 'STILL NO SOUND.'],
    resetFinalReply: 'OH. IT WORKS NOW.',
  },

  introStory: {
    scene1Lines: ['NOT LONG AGO, THE TEST GROUP MET FOR DINNER.', 'CHEF {HOST} PREPARED A FEAST FOR FOUR FRIENDS.', 'THE STORIES THEY TOLD WERE VERY ORDINARY.'],
    scene2Lines: ['THEY SAY CHEF {HOST} STILL WAITS IN THE DOORWAY...', 'LISTENING.'],
    scene4LinesWithSavior: ['YOU GOT THE {ITEM}!', 'IT IS EXTREMELY MARBLED.'],
    scene4LinesNoSavior: ['THE DINNER WAS SAVED.', 'EVERYONE HAD A GREAT TIME.'],
  },

  rankNames: {
    immaculate: 'IMMACULATE',
    comicTiming: 'COMIC TIMING',
    worst: 'FRIEND WHO RUINS DINNERS',
  },

  loseLine: 'THE DINNER IS RUINED.',
};
