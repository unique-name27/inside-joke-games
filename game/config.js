'use strict';
/* ======================================================================
   KARKS CUB KINGDOM -- CONFIG #1 (the template source)

   Every personalized element of the game lives in this one object. Both
   game/index.html and intro/index.html read it (intro via
   <script src="../game/config.js">, since Phase A established that
   assets/config live one level up from each page -- see the "Config
   sharing" note in SPEC-game.md's Template & roles section). Loaded via
   <script src="config.js"></script> BEFORE the page's inline <script>, so
   CONFIG is a plain global by the time the game/intro code runs.

   Text convention: every field here is a COMPLETE, already-composed
   string/line array -- there's no generic template engine. The only
   exception is two reusable tokens, {HOST} and {ITEM}, which the small
   fmt() helper (defined in game/index.html and intro/index.html) replaces
   wherever they appear, so the host's name and the gift item's name only
   have to be spelled correctly once each (see CONFIG.host.name and
   CONFIG.savior.itemName below) even though they're each quoted inside
   several different sentences across both files.

   Role archetypes (CONFIG.cast): HOST is required (the player). JUDGE,
   AUTHORITY, SAVIOR, BUTTERFINGERS, BUILDER are each optional -- set a
   role to `null` to skip it; the beat(s) built around it are skipped too,
   with the flow degrading gracefully (see the degradation map in
   SPEC-game.md). Content buckets for a role (e.g. CONFIG.judge) can stay
   populated even when CONFIG.cast.judge is null -- they simply won't be
   read -- but every CONFIG #1 (this file) ships with all six roles cast,
   since Karks Cub Kingdom is the full, un-degraded original.
   ====================================================================== */
const CONFIG = {
  gameId: 'kck', // localStorage key prefix -- kck_volume, kck_beaten, kck_hard_cleared

  lengthPreset: 'full', // 'full' | 'five_min' -- see SPEC-game.md for exactly what this scales

  title: {
    lockupLines: ['KARKS CUB', 'KINGDOM'], // hand-built pixel title; also rendered small in Epilogue B
    introPageTitle: 'Karks Cub Kingdom',
    gamePageTitle: 'Karks Cub Kingdom -- Playable Demo',
  },

  // the whole joke. Used verbatim in every slam/ribbon/unison-bubble/pop-in/
  // endcard occurrence, and as the literal SpeechSynthesis utterance text
  // (lowercased+de-punctuated isn't needed -- "For free?" reads fine as-is).
  punchline: 'FOR FREE?',

  host: {
    name: 'GABE', // {HOST} token -- "CHEF {HOST}" appears in a few narration/bubble lines
  },

  music: {
    // KCK ships with its own uploaded song and keeps it (USE_CUSTOM_SONG's
    // role from Phase A) -- set to null for a config with no custom song,
    // in which case the loops below run at full level as the real score.
    customSongPath: '../assets/music/theme.mp3',
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

  // whole-word, case-sensitive tone gate (verification-time only -- see
  // FULFILLMENT.md's harness step). This is KCK's own instance of "words
  // that must never appear" -- the exact list is spelled out below since
  // it's the actual gate data, not prose about it. Separately, only
  // CONFIG.punchline itself may contain the word this whole game is built
  // around not saying anywhere else.
  forbiddenWords: ['COIN', 'BILL', 'COST', 'NOTHING'],

  // Beat 1 dinner-round stories, told in order. 'five_min' preset plays only
  // the first 2; 'full' plays all of them (today: 3).
  stories: [
    { lines: ['I DRANK A GLASS OF RIESLING', 'SO NOBODY ELSE HAD TO.'] },
    { lines: ['THE BARTENDER COMPLIMENTED EVERY ONE OF OUR ORDERS.', 'LIKE WE WERE BRILLIANT.'] },
    { lines: ['A GUY SAID HE LIKED MY SEARS T-SHIRT.', 'IT IS FROM SEARS.'] },
    { lines: ['I STAYED TILL THE SEVENTH INNING', 'OF A TWELVE TO ZERO GAME.'] },
  ],

  // the four seated diners. diner0 has no dedicated beat (just a fourth
  // friend at the table); diner1 is the JUDGE's seat before he stands up
  // (only rendered/used if cast.judge is set); diner2/diner3 are the
  // BUTTERFINGERS/BUILDER seats. Each is {name, spriteCol, spriteRow,
  // anecdote} -- name/anecdote aren't rendered as on-screen text anywhere
  // today (reserved for a future cast-roster screen / intake reference);
  // spriteCol/spriteRow pick the Tiny Dungeon sheet tile.
  cast: {
    diner0: { name: 'THE FOURTH GUY', spriteCol: 1, spriteRow: 7, anecdote: 'Always orders for the table.' },
    judge:         { name: 'THE CRITIC GUY', spriteCol: 4, spriteRow: 8, anecdote: 'Reviews everything, unprompted.' },
    authority:     { name: 'ARAM', anecdote: "The boss who takes reviews personally." },
    savior:        { name: 'THE WAGYU GUY', anecdote: 'Always arrives fashionably late with the good stuff.' },
    butterfingers: { name: 'THE BATHROOM GUY', spriteCol: 3, spriteRow: 8, anecdote: 'Never puts his phone down.' },
    builder:       { name: 'THE BUILDER GUY', spriteCol: 2, spriteRow: 8, anecdote: 'Built this exact game.' },
  },

  // Beat 1's laugh-drain death can happen with or without JUDGE cast (dinner
  // rounds always run), so this table-reaction line lives at the top level
  // rather than inside CONFIG.judge -- it doubles as the judge's own
  // stand-up bubble when JUDGE *is* cast (beat2_intro), but must still
  // resolve to something when he isn't.
  dismissiveLine: 'OKAY. WE GET IT.',

  judge: {
    title: 'THE CRITIC',
    cardBody: ['DODGE HIS REVIEWS.', 'STAND ON THE RIESLING TO GRAB IT.', 'SPACE TO THROW.'],
    critiqueLines: [
      ['WEAK PREMISE.'],
      ['DERIVATIVE.'],
      ['THE SOUP WAS LUKEWARM.'],
      ['I’VE HEARD THIS STORY TWICE.'],
      ['GOOD THING HE BOUGHT ALL THE', 'BASEBALLS AT THE GAME.'], // callback to stories[2]
    ],
    duckLines: ['TOO SLOW, {HOST}.', 'PREDICTABLE.', 'I REVIEWED THAT THROW. ONE STAR.'],
    hitLines: ['OW. LUCKY.', 'THAT WAS THE HOUSE RIESLING.', 'MY GLASSES. YOU HIT MY GLASSES.'],
    fakeDeathLine1: 'JUST KIDDING.',
    fakeDeathLine2: 'ALSO: THE SOUP WAS COLD.',

    // THE WIDOWMAKER beat (Beat 3, between the revival spring-up and the
    // woman's tribute line): the still-giant critic immediately resumes
    // being a critic, diner0 (the Sears-shirt guy) retorts and throws THE
    // WIDOWMAKER at him -- impact shrinks him back down and he walks back
    // to his seat, one of the 4 friends again.
    mockLine: ['I LIVE.', '...NICE SEARS SHIRT.'],
    retortLine: 'IT IS FROM SEARS.',
    itemLabel: 'THE WIDOWMAKER!',
    redemptionLine: 'THE SOUP IS ACTUALLY FINE.',
  },

  savior: {
    itemName: 'WAGYU', // {ITEM} token
    line1: 'EXCUSE ME...',
    line2: 'I BROUGHT THE {ITEM}.',
    sincereLine: 'CHEF {HOST}... YOU SAVED THE DINNER.',
  },

  authority: {
    entranceLine1: 'A ONE-STAR GOOGLE REVIEW?!',
    entranceLine2: 'WHO DID THIS?',
    turnGoodLine1: 'FIVE STARS...',
    turnGoodLine2: 'DINNER AT MY PLACE. SOMETIME.',
    beggingLine: 'PLEASE. FIVE STARS.',
    failLine: 'THE REVIEW STANDS.',
    cardTitle: 'ARAM HAS ARRIVED',
    cardBody: ["CHEF {HOST}'S BOSS SAW A BAD REVIEW.", 'CHASE THE GUYS. BEG FOR FIVE STARS.', "DON'T GET CAUGHT."],
  },

  butterfingers: {
    deleteAllLine: 'DELETE ALL?',
    deletedLine: 'DELETED.',
    allMyPhotosLine: 'ALL MY PHOTOS.',
  },

  builder: {
    epBCaption1: 'THAT NIGHT, ONE OF THE GUYS KEPT THINKING ABOUT THE DINNER.',
    epBCaption2: 'HE FLEW HOME.',
    epBCaption3: 'AND BUILT A GAME ABOUT THAT EXACT DINNER.',
    epBCaption4: 'AND SHARED IT WITH THE GUYS.',
    cardTitle: 'TECH SUPPORT',
    cardBody: ["ONE OF THE GUYS CAN'T HEAR THE GAME.", 'CHASE HIM DOWN.', 'ASK IF HE RESET IT.'],
    cantHearLine: "I CAN'T HEAR THE MUSIC.",
    resetQuestionLine: 'DID YOU RESET IT?',
    resetReplies: ['WHAT?', "IT'S JUST BEEPING.", 'STILL NO SOUND.'],
    resetFinalReply: 'OH. IT WORKS NOW.',
  },

  introStory: {
    scene1Lines: ['LONG AGO, IN THE KINGDOM OF KARK,', 'CHEF {HOST} PREPARED A FEAST FOR FOUR GUYS.', 'THE STORIES THEY TOLD WERE VERY ORDINARY.'],
    scene2Lines: ['THEY SAY CHEF {HOST} STILL WAITS IN THE DOORWAY...', 'LISTENING.'],
    // scene3 reuses CONFIG.stories[0] verbatim (the intro is a flashback preview)
    scene4LinesWithSavior: ['YOU GOT THE {ITEM}!', 'IT IS EXTREMELY MARBLED.'],
    scene4LinesNoSavior: ['THE DINNER WAS SAVED.', 'EVERYONE HAD A GREAT TIME.'],
  },

  rankNames: {
    immaculate: 'IMMACULATE',
    comicTiming: 'COMIC TIMING',
    worst: 'GUY WHO RUINS DINNERS',
  },

  loseLine: 'THE DINNER IS RUINED.', // hard-mode lose card
};
