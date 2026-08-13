'use strict';
/* ======================================================================
   THE APARTMENT HUNTERS -- example CONFIG for template: 'mission' (see
   SPEC-mission.md). A fictional sample group, distinct from examples/
   gallery-sample.config.js's (a weekend league), examples/
   flight-sample.config.js's (a ski-trip crew), and examples/
   defense-sample.config.js's (a game-night crew) own people -- this is
   the fixture tools/verify-mission.js drives (a scripted playthrough via
   mission/engine.js's own harness hooks) and the one mission/index.html
   itself loads today. This file itself stays hand-authored/hand-
   maintained (never regenerated) -- point mission/index.html's
   <script src="config.js"> at it (or copy it over) to play it directly.
   The SAME content, expressed as intake answers, lives in
   tools/mission-sample-answers.json -- `node tools/generate.js tools/
   mission-sample-answers.json --slug=mission-sample` regenerates
   games/mission-sample/ from it (the generator's own output is canonical
   there -- diner0 comes back as the generic "THE FOURTH FRIEND" and
   rankNames reverts to the neutral defaults, same divergence
   games/defense-sample/'s own generated config.js already has from this
   file's own hand-authored cast/rankNames choices).

   Every optional role is cast here (judge/authority/savior/
   butterfingers/builder) so a single load exercises THE FIRST BOSS's
   ambush heckle, THE SAVIOR's shield absorb, BUTTERFINGERS' seeded crate
   fumbles, THE BUILDER's turret drone, and THE FINAL BOSS's flagship +
   turn-good flyby all in one playthrough. The host-only degradation path
   (every optional role uncast -> no shield/drone/butterfingers crates,
   an elite swarm volley instead of the ambush, a grand meteor-and-swarm
   finale instead of the flagship, still winnable with the scaled-down
   enemy HP) is exercised in verification by cloning this object and
   nulling out `cast`, not by a second example file.
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
    customSongPath: null, // no custom song -- loops run at full level
    // 'chase' vibe set (see game/cfgcodec.js's CFG_VIBE_TRACK_SETS), hand-
    // resolved into the loops block itself -- a fragment/config.js never
    // carries a live `musicVibe` field (cfgLoadFragmentOverride deletes it
    // after resolving loops; it's a wizard/generator-time convenience, not
    // a real CONFIG key), same as games/defense-sample/'s own loops block.
    // Fast/driving register fits a shmup better than any of the gentler sets.
    loops: {
      dinner: '../assets/audio/music/time-driving.ogg',   // title, briefing
      boss: '../assets/audio/music/alpha-dance.ogg',        // ambush + flagship
      chase: '../assets/audio/music/retro-beat.ogg',        // every other stage
      celebration: '../assets/audio/music/german-virtue.ogg', // turn-good + flyby + win card
      sad: '../assets/audio/music/sad-town.ogg',            // the lull before the flagship
      gameover: '../assets/audio/music/game-over.ogg',      // the retry card's own bed
    },
    introFallback: '../assets/audio/music/night-at-the-beach.ogg', // unused (no separate intro) -- kept for schema parity with the codec's shared music block
  },

  forbiddenWords: [], // no universal baseline -- this group has nothing off-limits

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
