'use strict';
/* ======================================================================
   THE TEST GROUP -- example CONFIG demonstrating graceful degradation.

   NOT wired into game/index.html or intro/index.html by default (this file
   lives outside game/ on purpose, so it's never picked up by the
   <script src="config.js"> the shipped pages use). It exists to prove Phase
   B's whole point: point a game/intro pair at THIS file instead (swap the
   <script src> to "../examples/test-group.config.js", or copy it over
   game/config.js for a local check) and the game plays a genuinely
   different, shorter story that still reaches a satisfying end card.

   Differences from a fully-cast config (see examples/roadtrip.config.js):
   - JUDGE is uncast (cast.judge = null) -- per the degradation map, that
     also makes Beat 3 (savior/revival) and Beat 4 (authority/final-boss)
     unreachable regardless of their own cast values, since both are
     narratively downstream of the critic incident -- so this config leaves
     authority/savior uncast too rather than supplying dead content.
     Actual flow: dinner rounds -> celebration -> Epilogue A -> Epilogue B
     -> Beat 5 -> freeze -> end card. No boss fight at all.
   - lengthPreset: 'five_min' (2 dinner rounds, shortened epilogue holds,
     Beat 5 needs 3 catches instead of 4).
   - music.customSongPath: null -- no uploaded song, so the per-beat loops
     play at full level as the actual score (not a quiet understudy).
   ====================================================================== */
const CONFIG = {
  gameId: 'test-group',

  lengthPreset: 'five_min',

  title: {
    lockupLines: ['THE TEST', 'GROUP'],
    introPageTitle: 'The Test Group',
    gamePageTitle: 'The Test Group -- Playable Demo',
  },

  punchline: 'SO TRUE.',

  host: {
    name: 'JORDAN',
    quotes: ['I MADE A SEATING CHART FOR FOUR PEOPLE.', 'THE APPETIZERS ARE A SURPRISE. TO ME TOO.'],
  },

  music: {
    customSongPath: null, // no custom song -- loops run at full level
    loops: {
      dinner: '../assets/audio/music/wacky-waiting.ogg',
      boss: '../assets/audio/music/mission-plausible.ogg',
      chase: '../assets/audio/music/time-driving.ogg',
      celebration: '../assets/audio/music/farm-frolics.ogg',
      sad: '../assets/audio/music/sad-descent.ogg',
      gameover: '../assets/audio/music/game-over.ogg',
    },
    introFallback: '../assets/audio/music/night-at-the-beach.ogg',
  },

  forbiddenWords: [], // no universal baseline anymore -- this group has nothing off-limits

  // required even with JUDGE uncast -- Beat 1's laugh-drain death can still
  // happen (dinner rounds always run) and reuses this as its reaction line
  dismissiveLine: 'HUH. OKAY.',

  // five_min only plays the first 2
  stories: [
    { lines: ['I MISSED MY FLIGHT', 'BY FOUR MINUTES.'] },
    { lines: ['I ALPHABETIZED THE SPICE RACK', 'WHILE WE WERE ON HOLD.'] },
  ],

  cast: {
    diner0: { name: 'CASEY', spriteCol: 1, spriteRow: 7, anecdote: 'Brings a board game every time.', quotes: ['I BROUGHT THE GAME. NOBODY ASKED.', 'RULES ARE SUGGESTIONS, MOSTLY.'] },
    judge: null,         // uncast -- no boss fight, no Beat 3, no Beat 4 (see file header)
    authority: null,     // uncast (downstream of judge -- see above)
    savior: null,        // uncast (downstream of judge -- see above)
    butterfingers: { name: 'MORGAN', spriteCol: 3, spriteRow: 8, anecdote: 'Takes 40 photos of every plate.', quotes: ['LET ME GET THE LIGHTING RIGHT.', 'THIS IS FOR THE GROUP CHAT LATER.'] },
    builder: { name: 'RILEY', spriteCol: 2, spriteRow: 8, anecdote: 'Builds something every time we hang out.', quotes: ['I ALREADY STARTED BUILDING SOMETHING.', 'IT WORKS. MOSTLY.'] },
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
    scene1Lines: ['NOT LONG AGO, THE TEST GROUP MET FOR DINNER.', '{HOST} HOSTED A NIGHT FOR SOME FRIENDS.', 'THE STORIES THEY TOLD WERE VERY ORDINARY.'],
    scene2Lines: ['THEY SAY {HOST} STILL WAITS BY THE DOOR...', 'LISTENING.'],
    scene4LinesWithSavior: ['YOU GOT THE {ITEM}!', 'IT IS GREATLY APPRECIATED.'],
    scene4LinesNoSavior: ['THE DINNER WAS SAVED.', 'EVERYONE HAD A GREAT TIME.'],
  },

  rankNames: {
    immaculate: 'IMMACULATE',
    comicTiming: 'COMIC TIMING',
    worst: 'FRIEND WHO RUINS DINNERS',
  },

  loseLine: 'THE DINNER IS RUINED.',
};
