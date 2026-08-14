'use strict';
/* ======================================================================
   THE WEEKEND LEAGUE -- example CONFIG for template: 'gallery' (see
   SPEC-gallery.md). A fictional sample group, distinct from
   examples/test-group.config.js's people -- this is the fixture round 2's
   own verification pass drives (a scripted playthrough via gallery/
   engine.js's __probe/__tick harness hooks) and the one gallery/index.html
   itself loads today. NOT wired into games/<slug>/ yet (that's round 3 --
   tools/generate.js/the wizard don't know about `template` yet); point
   gallery/index.html's <script src="config.js"> at this file (or copy it
   over) to play it directly.

   Every optional role is cast here (judge/authority/savior/butterfingers/
   builder) so a single load exercises THE FIRST BOSS's fake-death gag,
   THE FINAL BOSS's quirk-tell finale, the savior rescue, and the
   butterfingers plate-stack bonus all in one playthrough. The host-only
   degradation path (every optional role uncast -> both bosses replaced by
   their volley substitutes, no savior rescue, no butterfingers spawns, the
   barker falls back to the painted sign) is exercised in verification by
   cloning this object and nulling out `cast`, not by a second example file.
   ====================================================================== */
const CONFIG = {
  gameId: 'gallery-sample',

  template: 'gallery',

  title: {
    lockupLines: ['THE WEEKEND', 'LEAGUE'],
    gamePageTitle: 'The Weekend League -- Shooting Gallery Demo',
  },

  punchline: "THAT'S SO ON BRAND.",

  host: {
    name: 'JORDAN',
    quotes: ['I TRAIN FOR THIS ALL WEEK.', 'MY FANTASY TEAM NAME IS UNDEFEATED. THE TEAM IS NOT.'],
  },

  gallery: {
    targets: [
      'FANTASY DRAFT SPEECHES',
      'SPREADSHEET AT BRUNCH',
      'THE PARKING INCIDENT',
      'SOCKS WITH SANDALS',
      'ARTISANAL MAC N CHEESE',
      'NARRATES OWN COOKING',
    ],
    firstBossHeckle: 'YOUR AIM IS AS BAD AS YOUR TAKES.',
    finalBossQuirk: 'ALWAYS ADJUSTS THEIR GLASSES BEFORE LYING.',
  },

  music: {
    customSongPath: null, // no custom song -- loops run at full level
    loops: {
      dinner: '../assets/audio/music/wacky-waiting.ogg',      // rounds
      boss: '../assets/audio/music/mission-plausible.ogg',    // THE FIRST BOSS / elite volley
      chase: '../assets/audio/music/time-driving.ogg',        // THE FINAL BOSS / grand volley
      celebration: '../assets/audio/music/farm-frolics.ogg',  // win, through the end card
      sad: '../assets/audio/music/sad-descent.ogg',           // the "TRY AGAIN" quota-miss stinger
      gameover: '../assets/audio/music/game-over.ogg',        // bed under the TRY AGAIN card itself
    },
    introFallback: '../assets/audio/music/night-at-the-beach.ogg', // unused (no separate intro) -- kept for schema parity with the codec's shared music block
  },

  forbiddenWords: [], // no universal baseline -- this group has nothing off-limits

  cast: {
    judge: { name: 'THE COMMISSIONER', sprite: 'grandma', anecdote: 'Runs the fantasy league like it is federal law.', quotes: ['THE LEAGUE BYLAWS ARE NOT SUGGESTIONS.', 'I REVIEWED THE TAPE. YOU LOST FAIR AND SQUARE.'] },
    authority: { name: 'THE LANDLORD', sprite: 'bandana', anecdote: 'Shows up personally over a noise complaint.', quotes: ['SOMEONE FILED A COMPLAINT. IT WAS ME.', 'QUIET HOURS START AT TEN. SHARP.'] },
    savior: { name: 'THE DESIGNATED DRIVER', sprite: 'vest', anecdote: 'Always sober, always has snacks in the car.', quotes: ['I\'M GOOD. I HAVE SNACKS IN THE CAR.', 'TEXT ME WHEN YOU\'RE READY TO GO.'] },
    butterfingers: { name: 'THE ONE WHO DROPS EVERYTHING', sprite: 'braid', anecdote: 'Has broken three different house rules, literally.', quotes: ['IT SLIPPED. IT ALWAYS SLIPS.', 'IN MY DEFENSE, IT WAS SLIPPERY.'] },
    builder: { name: 'THE GROUP\'S TECH GUY', sprite: 'mohawk', anecdote: 'Built this exact game on a Tuesday night.', quotes: ['I BUILT THIS ON A TUESDAY NIGHT.', 'IT\'S DEPLOYED. DON\'T ASK HOW.'] },
  },

  rankNames: {
    immaculate: 'SHARPSHOOTER',
    comicTiming: 'CROWD FAVORITE',
    worst: 'MENACE TO THE MIDWAY',
  },
};
