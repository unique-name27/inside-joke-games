'use strict';
/* ======================================================================
   THE APARTMENT HUNTERS -- hand-built playable copy of examples/
   mission-sample.config.js, path-adjusted for this folder's depth
   (games/mission-sample/, two levels under the repo root -- ../../assets/
   not ../assets/). Round 1's own shell (see SPEC-mission.md's build plan
   item 1 and README.md's "How games are added"); round 2's generator
   (`node tools/generate.js tools/mission-sample-answers.json
   --slug=mission-sample`) will overwrite this file from the same content
   expressed as intake answers -- reconcile any drift to match the
   generator's own output then, same as this repo did for
   games/flight-sample/ and games/defense-sample/.
   ====================================================================== */
const CONFIG = {
  gameId: 'mission-sample',

  template: 'mission',

  title: {
    lockupLines: ['THE APARTMENT', 'HUNTERS'],
    gamePageTitle: 'The Apartment Hunters -- Mission Demo',
  },

  punchline: 'WE FOUND IT. IT HAS LAUNDRY.',

  host: {
    name: 'DESHAWN',
    sprite: 'overalls',
  },

  mission: {
    mission: 'FIND A PLACE WITH IN-UNIT LAUNDRY',
    swarms: [
      'THE BAD LISTINGS',
      'GHOSTING LANDLORDS',
      'SURPRISE FEES',
      'THE BRUTAL COMMUTE',
      'ROOMMATE RED FLAGS',
    ],
    shipColor: 'orange',
    firstBossHeckle: "IT WON'T LAST AT THIS PRICE.",
    finalBossQuirk: 'STILL MAD ABOUT THAT ONE EMAIL.',
  },

  music: {
    customSongPath: null,
    loops: {
      dinner: '../../assets/audio/music/time-driving.ogg',
      boss: '../../assets/audio/music/alpha-dance.ogg',
      chase: '../../assets/audio/music/retro-beat.ogg',
      celebration: '../../assets/audio/music/german-virtue.ogg',
      sad: '../../assets/audio/music/sad-town.ogg',
      gameover: '../../assets/audio/music/game-over.ogg',
    },
    introFallback: '../../assets/audio/music/night-at-the-beach.ogg',
  },

  forbiddenWords: [],

  cast: {
    diner0: { name: 'THE FOURTH APPLICANT', sprite: 'strawhat', anecdote: 'Shows up to every viewing with snacks.' },
    judge: { name: 'THE BROKER', sprite: 'grandma', anecdote: 'Charges a fee for texting back.' },
    authority: { name: 'THE LANDLORD', sprite: 'beard', anecdote: 'Has never once fixed the radiator.' },
    savior: { name: 'THE CO-SIGNER', sprite: 'vest', anecdote: 'Always has a backup plan and a spare key.' },
    butterfingers: { name: 'THE ONE WHO DROPS THE KEYS', sprite: 'braid', anecdote: 'Has been locked out three times this month.' },
    builder: { name: 'THE SPREADSHEET', sprite: 'squire', anecdote: 'Built a spreadsheet ranking every listing by laundry access.' },
  },

  rankNames: {
    immaculate: 'FOUND IT FIRST TRY',
    comicTiming: 'SIGNED THE LEASE',
    worst: 'BACK TO THE LISTINGS. TRY AGAIN.',
  },
};
