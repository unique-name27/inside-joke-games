'use strict';
/* ======================================================================
   game/cfgcodec.js -- shared by game/engine.js, intro/engine.js, and
   tools/generate.js (the CLI), plus (later) the /build/ wizard. Loaded as
   a plain classic <script> (same convention as engine.js/config.js -- see
   README.md "How games are added"), so every function here is a plain
   top-level `function` declaration (attaches to the page's global scope);
   at the bottom it ALSO exports via `module.exports` when `module` exists,
   so `require('./cfgcodec.js')` works unmodified from Node (the CLI, and
   this file's own harness).

   Two independent halves:

   PART A -- CODEC: a small, self-contained LZW-based compressor + a
   URL-safe (unpadded base64url) byte encoder, used to pack a CONFIG
   override into a shareable `#cfg=<data>` URL fragment. This is
   "lz-string style" in spirit (LZ-based, URI-safe alphabet) but is NOT
   bit-compatible with any third-party lz-string package and doesn't need
   to be -- it only ever has to round-trip with itself. No external
   libraries; only standard TextEncoder/TextDecoder (available in every
   modern browser and in Node without any dependency).

   PART B -- FRAGMENT CONFIG: a neutral, fully-populated CFG_DEFAULT_CONFIG
   (deliberately generic, unbranded content -- see examples/roadtrip.
   config.js for the fully-cast schema reference) + a whitelist
   validator/sanitizer (CFG_FRAGMENT_SCHEMA + cfgSanitizeConfig) + a deep
   merge (cfgDeepMerge), so a decoded fragment can safely override just the
   parts of CONFIG it wants to and nothing else -- unknown keys are
   dropped, strings/arrays are length-capped, and a malformed or oversized
   fragment fails closed (falls back to the page's own file CONFIG).
   ====================================================================== */

/* ----------------------------------------------------------------------
   PART A.1 -- byte-oriented LZW (classic textbook algorithm, dictionary
   PRELOADED with all 256 single-byte values so there's no "which
   character came first" bootstrapping ambiguity between encoder and
   decoder -- that ambiguity is exactly what makes hand-rolled Unicode-
   alphabet LZW variants easy to get subtly wrong; preloading a FIXED,
   universally-known 0-255 alphabet sidesteps it entirely). Operates on
   bytes (UTF-8 of the JSON text), not JS UTF-16 code units, so arbitrary
   Unicode (emoji included) round-trips correctly via TextEncoder/Decoder.
   ---------------------------------------------------------------------- */
var CFG_MAX_DICT = 1 << 20; // ~1M entries -- a generous, purely defensive cap; real payloads never get near it

function cfgLzwEncodeBytes(bytes){
  var dict = new Map();
  for(var i=0;i<256;i++) dict.set(String.fromCharCode(i), i);
  var dictSize = 256;
  var w = '';
  var out = [];
  for(var j=0;j<bytes.length;j++){
    var c = String.fromCharCode(bytes[j]);
    var wc = w + c;
    if(dict.has(wc)){
      w = wc;
    } else {
      out.push(dict.get(w));
      if(dictSize < CFG_MAX_DICT){ dict.set(wc, dictSize++); }
      w = c;
    }
  }
  if(w !== '') out.push(dict.get(w));
  return out;
}

/* mirrors cfgLzwEncodeBytes exactly, including the classic "KwKwK" special
   case (the code being decoded is the ONE ABOUT TO BE ADDED to the
   dictionary this very step -- happens on inputs with an immediately-
   repeated pattern). maxOutputBytes is checked INCREMENTALLY inside the
   loop (not just at the end) so a maliciously crafted small input that
   would LZW-expand into something huge gets rejected before that huge
   buffer is ever materialized -- see cfgDecompress's size caps. */
function cfgLzwDecodeBytes(codes, maxOutputBytes){
  if(!codes.length) return new Uint8Array(0);
  var dict = new Map();
  for(var i=0;i<256;i++) dict.set(i, String.fromCharCode(i));
  var dictSize = 256;
  var w = dict.get(codes[0]);
  if(w === undefined) return null; // corrupt: first code must be a valid byte
  var outParts = [w];
  var total = w.length;
  if(total > maxOutputBytes) return null;
  for(var j=1;j<codes.length;j++){
    var k = codes[j];
    var entry;
    if(dict.has(k)) entry = dict.get(k);
    else if(k === dictSize) entry = w + w.charAt(0);
    else return null; // corrupt: code refers to a dictionary slot that can't exist yet
    total += entry.length;
    if(total > maxOutputBytes) return null;
    outParts.push(entry);
    if(dictSize < CFG_MAX_DICT){ dict.set(dictSize++, w + entry.charAt(0)); }
    w = entry;
  }
  var joined = outParts.join('');
  var bytes = new Uint8Array(joined.length);
  for(var m=0;m<joined.length;m++) bytes[m] = joined.charCodeAt(m);
  return bytes;
}

/* ----------------------------------------------------------------------
   PART A.2 -- LEB128 varint (standard 7-data-bits + continuation-bit
   encoding, same scheme Protobuf/DWARF use) packs the LZW code array into
   bytes without any shared-bit-width bookkeeping between encoder and
   decoder -- the classic source of off-by-one bugs in packed-bitstream
   LZW variants (including real lz-string). A few extra bytes of framing
   overhead versus perfectly packed bits, traded for being straightforward
   to get exactly right.
   ---------------------------------------------------------------------- */
function cfgVarintPush(n, out){
  n = n >>> 0;
  while(n >= 0x80){
    out.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  out.push(n);
}
function cfgVarintDecodeAll(bytes){
  var out = [];
  var n = 0, shift = 0;
  for(var i=0;i<bytes.length;i++){
    var b = bytes[i];
    n |= (b & 0x7f) << shift;
    if((b & 0x80) === 0){
      out.push(n >>> 0);
      n = 0; shift = 0;
    } else {
      shift += 7;
      if(shift > 21) return null; // corrupt/malicious: our codes never need more than 3 continuation bytes
    }
  }
  if(shift !== 0) return null; // truncated varint at end of stream
  return out;
}

/* ----------------------------------------------------------------------
   PART A.3 -- unpadded base64url (RFC 4648 sec. 5 alphabet, no `=`
   padding -- the same "base64url nopad" convention JWTs use), hand-rolled
   so the codec has zero dependency on btoa/atob (browser-only, and
   deprecated/absent in some Node paths) or Buffer (not available inside
   this project's Node `vm` sandbox harnesses without deliberately
   exposing it).
   ---------------------------------------------------------------------- */
var CFG_B64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
var CFG_B64URL_LOOKUP = (function(){
  var t = {};
  for(var i=0;i<CFG_B64URL_ALPHABET.length;i++) t[CFG_B64URL_ALPHABET[i]] = i;
  return t;
})();
function cfgBase64urlEncode(bytes){
  var out = '';
  var i = 0;
  for(; i+3<=bytes.length; i+=3){
    var n = (bytes[i]<<16) | (bytes[i+1]<<8) | bytes[i+2];
    out += CFG_B64URL_ALPHABET[(n>>>18)&0x3f] + CFG_B64URL_ALPHABET[(n>>>12)&0x3f] + CFG_B64URL_ALPHABET[(n>>>6)&0x3f] + CFG_B64URL_ALPHABET[n&0x3f];
  }
  var rem = bytes.length - i;
  if(rem === 1){
    var n1 = bytes[i]<<16;
    out += CFG_B64URL_ALPHABET[(n1>>>18)&0x3f] + CFG_B64URL_ALPHABET[(n1>>>12)&0x3f];
  } else if(rem === 2){
    var n2 = (bytes[i]<<16) | (bytes[i+1]<<8);
    out += CFG_B64URL_ALPHABET[(n2>>>18)&0x3f] + CFG_B64URL_ALPHABET[(n2>>>12)&0x3f] + CFG_B64URL_ALPHABET[(n2>>>6)&0x3f];
  }
  return out;
}
function cfgBase64urlDecode(str){
  if(typeof str !== 'string') return null;
  var len = str.length;
  if(len % 4 === 1) return null; // impossible length for a validly-encoded stream
  var fullGroups = Math.floor(len/4);
  var bytes = [];
  for(var g=0; g<fullGroups; g++){
    var i = g*4;
    var a=CFG_B64URL_LOOKUP[str[i]], b=CFG_B64URL_LOOKUP[str[i+1]], c=CFG_B64URL_LOOKUP[str[i+2]], d=CFG_B64URL_LOOKUP[str[i+3]];
    if(a===undefined||b===undefined||c===undefined||d===undefined) return null;
    var n = (a<<18)|(b<<12)|(c<<6)|d;
    bytes.push((n>>>16)&0xff, (n>>>8)&0xff, n&0xff);
  }
  var tail = str.slice(fullGroups*4);
  if(tail.length === 2){
    var ta=CFG_B64URL_LOOKUP[tail[0]], tb=CFG_B64URL_LOOKUP[tail[1]];
    if(ta===undefined||tb===undefined) return null;
    var tn = (ta<<18)|(tb<<12);
    bytes.push((tn>>>16)&0xff);
  } else if(tail.length === 3){
    var ta3=CFG_B64URL_LOOKUP[tail[0]], tb3=CFG_B64URL_LOOKUP[tail[1]], tc3=CFG_B64URL_LOOKUP[tail[2]];
    if(ta3===undefined||tb3===undefined||tc3===undefined) return null;
    var tn3 = (ta3<<18)|(tb3<<12)|(tc3<<6);
    bytes.push((tn3>>>16)&0xff, (tn3>>>8)&0xff);
  } else if(tail.length !== 0){
    return null;
  }
  return new Uint8Array(bytes);
}

/* ----------------------------------------------------------------------
   PART A.4 -- UTF-8 <-> bytes, and the full compress/decompress pipeline.
   ---------------------------------------------------------------------- */
function cfgUtf8Encode(str){
  return new TextEncoder().encode(str);
}
function cfgUtf8Decode(bytes){
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

var CFG_MAX_FRAGMENT_CHARS = 6000;        // full `#cfg=` payload length safety cap
var CFG_MAX_DECOMPRESSED_BYTES = 262144;  // 256KB -- far more than any legitimate config needs

/* string -> URL-safe string, or null on failure. Never throws. */
function cfgCompress(str){
  try{
    if(typeof str !== 'string') return null;
    var utf8 = cfgUtf8Encode(str);
    var codes = cfgLzwEncodeBytes(utf8);
    var varintBytes = [];
    for(var i=0;i<codes.length;i++) cfgVarintPush(codes[i], varintBytes);
    return cfgBase64urlEncode(Uint8Array.from(varintBytes));
  }catch(e){ return null; }
}
/* URL-safe string -> original string, or null on ANY failure (bad
   alphabet, truncated varint, corrupt LZW stream, oversized payload,
   invalid UTF-8) -- callers rely on null meaning "fall back silently". */
function cfgDecompress(str){
  try{
    if(typeof str !== 'string' || str.length > CFG_MAX_FRAGMENT_CHARS) return null;
    if(str.length === 0) return '';
    var varintBytes = cfgBase64urlDecode(str);
    if(!varintBytes) return null;
    var codes = cfgVarintDecodeAll(varintBytes);
    if(!codes) return null;
    var utf8 = cfgLzwDecodeBytes(codes, CFG_MAX_DECOMPRESSED_BYTES);
    if(!utf8) return null;
    return cfgUtf8Decode(utf8);
  }catch(e){ return null; }
}

/* short deterministic id (FNV-1a 32-bit, base36) -- used as the
   localStorage prefix for fragment-loaded games, so two different shared
   links never collide on save data, and the SAME link always reuses the
   same save slot (see cfgLoadFragmentOverride). Not a security hash --
   just a cheap, stable, collision-unlikely id. */
function cfgHashString(str){
  var h = 0x811c9dc5;
  for(var i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/* ----------------------------------------------------------------------
   PART B.0 -- CFG_SCENE_DEFAULTS: the STORY SKELETONS feature's only
   footprint in this file (see game/skeletons.js for the presentation
   half -- palettes/draw functions/mechanic-flavor strings -- which this
   file deliberately has zero dependency on; this table is TEXT ONLY).
   Keyed by every scene except 'dinner' -- 'dinner' IS
   cfgBuildDefaultConfig's own unmodified base below, so overlaying
   anything here for it would be a no-op by construction. Applied via
   cfgDeepMerge onto the otherwise-standard base (see cfgBuildDefaultConfig
   below), so a caller's own overrides (a user's own answers, a fragment's
   own explicit introStory) still win over these -- this table only fills
   in the "nobody said anything more specific" case.
   ---------------------------------------------------------------------- */
var CFG_SCENE_KEYS = ['dinner', 'roadtrip', 'office', 'wedding'];
var CFG_SCENE_DEFAULTS = {
  roadtrip: {
    introStory: {
      scene1Lines: ['NOT LONG AGO,', '{HOST} TOOK THE CREW ON A DRIVE.', 'THE STORIES THEY TOLD WERE VERY ORDINARY.'],
      scene2Lines: ['THEY SAY {HOST} IS STILL AT THE WHEEL...', 'LISTENING.'],
    },
    loseLine: 'THE TRIP IS RUINED.',
    rankNames: { worst: 'FRIEND WHO RUINS ROAD TRIPS' },
  },
  office: {
    introStory: {
      scene1Lines: ['NOT LONG AGO,', '{HOST} THREW A PARTY FOR THE OFFICE.', 'THE STORIES THEY TOLD WERE VERY ORDINARY.'],
      scene2Lines: ['THEY SAY {HOST} STILL WAITS BY THE PRINTER...', 'LISTENING.'],
    },
    loseLine: 'THE PARTY IS RUINED.',
    rankNames: { worst: 'COWORKER WHO RUINS PARTIES' },
  },
  wedding: {
    introStory: {
      scene1Lines: ['NOT LONG AGO,', '{HOST} GOT EVERYONE TOGETHER FOR A WEDDING.', 'THE STORIES THEY TOLD WERE VERY ORDINARY.'],
      scene2Lines: ['THEY SAY {HOST} IS STILL ON THE DANCE FLOOR...', 'LISTENING.'],
    },
    loseLine: 'THE RECEPTION IS RUINED.',
    rankNames: { worst: 'GUEST WHO RUINS WEDDINGS' },
  },
};

/* ----------------------------------------------------------------------
   PART B.1 -- CFG_DEFAULT_CONFIG: a neutral, fully-populated base for
   deep-merging a fragment onto. Deliberately generic, unbranded content --
   game/config.js ships no config of its own anymore (see that file's own
   stub comment); examples/roadtrip.config.js is the fully-cast schema
   reference now, examples/test-group.config.js the degraded one. Every
   role's content bucket is fully written out with generic-but-complete
   placeholder text so a fragment that supplies e.g. only `cast.judge.name`
   still gets a complete, playable comeback beat for free via merge.
   Every optional role in `cast` defaults to null (uncast) -- the safest,
   always-works minimum is "just the host, straight through to
   celebration" -- a fragment opts INTO a role by supplying a real object
   for it. Takes `engineRoot` (the caller's own ENGINE_ROOT) so the stock
   music paths resolve correctly regardless of which page/depth loaded the
   fragment -- returns a FRESH object each call (no shared mutable state).

   `sceneKey` (STORY SKELETONS) is the SECOND, OPTIONAL argument -- default
   `'dinner'`. For `'dinner'` (omitted, explicit, or any unrecognized/
   invalid key -- same "fail closed to the safe default" convention as
   everywhere else this project validates untrusted input) the returned
   object is BYTE-IDENTICAL to this function's pre-skeletons behavior: no
   `scene` key is added and CFG_SCENE_DEFAULTS is never consulted, so
   every existing call site (cfgLoadFragmentOverride's own single-arg
   calls included) and every old `#cfg=` link keeps regressing perfectly.
   For a real non-dinner key, the returned object gains `scene: sceneKey`
   plus CFG_SCENE_DEFAULTS' text overlay, deep-merged on top of the same
   otherwise-standard base.
   ---------------------------------------------------------------------- */
/* THE GALLERY (template #2, see SPEC-gallery.md) -- its own neutral default
   base, dispatched to by cfgBuildDefaultConfig below when templateKey is
   'gallery'. Deliberately a SEPARATE, smaller object rather than the
   hangout base plus overlay: gallery/engine.js never reads stories/
   introStory/judge/authority/savior/butterfingers/builder content blocks
   or `scene` at all (see gallery/engine.js's header) -- those fields would
   just be inert clutter on a gallery config. firstBossHeckle/finalBossQuirk
   are deliberately ABSENT here (not even empty strings): gallery/engine.js
   already has its own neutral fallback pools for exactly this case (see
   its FIRST_BOSS_HECKLE_FALLBACKS/FINAL_BOSS_QUIRK_FALLBACKS), so a sparse
   gallery fragment/order that skips those two optional lines still plays
   complete without this default needing to duplicate that pool. `targets`
   still needs *something* whenever nobody supplies any (gallery/engine.js
   also defends against an empty array, but a real 4-neutral-placeholder
   list reads far better than its own last-resort single-item fallback). */
function cfgBuildGalleryDefaultConfig(engineRoot){
  var root = engineRoot || '';
  return {
    gameId: 'shared',
    template: 'gallery',
    title: {
      lockupLines: ['YOUR', 'GROUP'],
      introPageTitle: 'A Tiny Game',
      gamePageTitle: 'A Tiny Game -- Playable Demo',
    },
    punchline: 'CLASSIC.',
    host: { name: 'HOST' },
    music: {
      customSongPath: null,
      loops: {
        dinner: root + 'assets/audio/music/wacky-waiting.ogg',
        boss: root + 'assets/audio/music/mission-plausible.ogg',
        chase: root + 'assets/audio/music/time-driving.ogg',
        celebration: root + 'assets/audio/music/farm-frolics.ogg',
        sad: root + 'assets/audio/music/sad-descent.ogg',
        gameover: root + 'assets/audio/music/game-over.ogg',
      },
      introFallback: root + 'assets/audio/music/night-at-the-beach.ogg', // unused (no separate intro) -- kept for schema parity with the shared music block
    },
    forbiddenWords: [],
    gallery: {
      targets: ['THE USUAL THING', 'THAT ONE STORY', 'THE RUNNING BIT', 'YOU KNOW WHY'],
    },
    cast: {
      diner0: { name: 'THE FOURTH FRIEND', spriteCol: 1, spriteRow: 7, anecdote: 'Always up for anything.' },
      judge: null,
      authority: null,
      savior: null,
      butterfingers: null,
      builder: null,
    },
    rankNames: {
      immaculate: 'IMMACULATE',
      comicTiming: 'COMIC TIMING',
      worst: 'COULD USE MORE PRACTICE',
    },
  };
}

/* THE FLIGHT (template #3, see SPEC-flight.md) -- its own neutral default
   base, dispatched to by cfgBuildDefaultConfig below when templateKey is
   'flight'. Modeled line-by-line on cfgBuildGalleryDefaultConfig just
   above (separate small object, not an overlay on the hangout base --
   flight/engine.js never reads stories/introStory/judge/authority/savior/
   butterfingers/builder content blocks or `scene` either, same rationale
   as the gallery's own header comment). firstBossHeckle/finalBossQuirk are
   deliberately ABSENT (not even empty strings) -- flight/engine.js has its
   own neutral fallback pools for exactly this case, same pattern as the
   gallery's FIRST_BOSS_HECKLE_FALLBACKS/FINAL_BOSS_QUIRK_FALLBACKS. `beats`/
   `hazards` get four neutral placeholders each (the wizard's own 3-beat/
   2-hazard minimums are UX guidance, never codec-enforced -- see
   CFG_FLIGHT_SCHEMA's own comment) so an absent-content flight game still
   plays a complete (if generic) trip end to end. */
function cfgBuildFlightDefaultConfig(engineRoot){
  var root = engineRoot || '';
  return {
    gameId: 'shared',
    template: 'flight',
    title: {
      lockupLines: ['YOUR', 'GROUP'],
      introPageTitle: 'A Tiny Game',
      gamePageTitle: 'A Tiny Game -- Playable Demo',
    },
    punchline: 'CLASSIC.',
    host: { name: 'HOST' },
    music: {
      customSongPath: null,
      loops: {
        dinner: root + 'assets/audio/music/wacky-waiting.ogg',
        boss: root + 'assets/audio/music/mission-plausible.ogg',
        chase: root + 'assets/audio/music/time-driving.ogg',
        celebration: root + 'assets/audio/music/farm-frolics.ogg',
        sad: root + 'assets/audio/music/sad-descent.ogg',
        gameover: root + 'assets/audio/music/game-over.ogg',
      },
      introFallback: root + 'assets/audio/music/night-at-the-beach.ogg', // unused (no separate intro) -- kept for schema parity with the shared music block
    },
    forbiddenWords: [],
    flight: {
      beats: ['IT STARTED FINE.', 'THEN SOMETHING WENT SIDEWAYS.', 'NOBODY WOULD ADMIT WHOSE IDEA IT WAS.', 'SOMEHOW EVERYONE MADE IT HOME.'],
      hazards: ['THE WEATHER', 'THE DIRECTIONS', 'THE SCHEDULE', 'THE PLAN'],
      planeColor: 'yellow',
    },
    cast: {
      diner0: { name: 'THE FOURTH FRIEND', spriteCol: 1, spriteRow: 7, anecdote: 'Always up for anything.' },
      judge: null,
      authority: null,
      savior: null,
      butterfingers: null,
      builder: null,
    },
    rankNames: {
      immaculate: 'IMMACULATE',
      comicTiming: 'COMIC TIMING',
      worst: 'COULD USE MORE PRACTICE',
    },
  };
}

/* THE DEFENSE (template #4, see SPEC-defense.md) -- its own neutral
   default base, dispatched to by cfgBuildDefaultConfig below when
   templateKey is 'defense'. Modeled line-by-line on
   cfgBuildFlightDefaultConfig just above (separate small object, not an
   overlay on the hangout base -- defense/engine.js never reads stories/
   introStory/judge/authority/savior/butterfingers/builder CONTENT BLOCKS
   or `scene` either, same rationale as the flight's own header comment --
   it does still read `cast.judge`/`cast.authority`/etc. themselves, same
   as every template). firstBossHeckle/finalBossQuirk are deliberately
   ABSENT (not even empty strings) -- defense/engine.js has its own
   neutral fallback pools for exactly this case, same pattern as flight's
   FIRST_BOSS_HECKLE_FALLBACKS/FINAL_BOSS_QUIRK_FALLBACKS. `waves` gets
   four neutral placeholders (the wizard's own 3-wave minimum is UX
   guidance, never codec-enforced -- see CFG_DEFENSE_SCHEMA's own
   comment) so an absent-content defense game still plays a complete (if
   generic) defense end to end. */
function cfgBuildDefenseDefaultConfig(engineRoot){
  var root = engineRoot || '';
  return {
    gameId: 'shared',
    template: 'defense',
    title: {
      lockupLines: ['YOUR', 'GROUP'],
      introPageTitle: 'A Tiny Game',
      gamePageTitle: 'A Tiny Game -- Playable Demo',
    },
    punchline: 'CLASSIC.',
    host: { name: 'HOST' },
    music: {
      customSongPath: null,
      loops: {
        dinner: root + 'assets/audio/music/wacky-waiting.ogg',
        boss: root + 'assets/audio/music/mission-plausible.ogg',
        chase: root + 'assets/audio/music/time-driving.ogg',
        celebration: root + 'assets/audio/music/farm-frolics.ogg',
        sad: root + 'assets/audio/music/sad-descent.ogg',
        gameover: root + 'assets/audio/music/game-over.ogg',
      },
      introFallback: root + 'assets/audio/music/night-at-the-beach.ogg', // unused (no separate intro) -- kept for schema parity with the shared music block
    },
    forbiddenWords: [],
    defense: {
      defending: 'THE COUCH',
      waves: ['THE NOTIFICATIONS', 'THE LATECOMERS', 'THE LEFTOVER DISHES', 'THE GROUP CHAT'],
    },
    cast: {
      diner0: { name: 'THE FOURTH FRIEND', spriteCol: 1, spriteRow: 7, anecdote: 'Always up for anything.' },
      judge: null,
      authority: null,
      savior: null,
      butterfingers: null,
      builder: null,
    },
    rankNames: {
      immaculate: 'IMMACULATE',
      comicTiming: 'COMIC TIMING',
      worst: 'COULD USE MORE PRACTICE',
    },
  };
}

/* THE MISSION (template #5, see SPEC-mission.md) -- its own neutral
   default base, dispatched to by cfgBuildDefaultConfig below when
   templateKey is 'mission'. Modeled line-by-line on
   cfgBuildDefenseDefaultConfig just above (separate small object, not an
   overlay on the hangout base -- mission/engine.js never reads stories/
   introStory/judge/authority/savior/butterfingers/builder CONTENT BLOCKS
   or `scene` either, same rationale as the defense's own header comment --
   it does still read `cast.judge`/`cast.authority`/etc. themselves, same
   as every template; unlike defense, judge/authority are the BOSS FLEET
   here, not player-side towers). firstBossHeckle/finalBossQuirk are
   deliberately ABSENT (not even empty strings) -- mission/engine.js has
   its own neutral fallback pools for exactly this case, same pattern as
   defense's FIRST_BOSS_HECKLE_FALLBACKS/FINAL_BOSS_QUIRK_FALLBACKS.
   `swarms` gets three neutral placeholder labels (the wizard's own 2-swarm
   minimum is UX guidance, never codec-enforced -- see CFG_MISSION_SCHEMA's
   own comment) so an absent-content mission game still plays a complete
   (if generic) squadron run end to end. */
function cfgBuildMissionDefaultConfig(engineRoot){
  var root = engineRoot || '';
  return {
    gameId: 'shared',
    template: 'mission',
    title: {
      lockupLines: ['YOUR', 'GROUP'],
      introPageTitle: 'A Tiny Game',
      gamePageTitle: 'A Tiny Game -- Playable Demo',
    },
    punchline: 'CLASSIC.',
    host: { name: 'HOST' },
    music: {
      customSongPath: null,
      loops: {
        dinner: root + 'assets/audio/music/wacky-waiting.ogg',
        boss: root + 'assets/audio/music/mission-plausible.ogg',
        chase: root + 'assets/audio/music/time-driving.ogg',
        celebration: root + 'assets/audio/music/farm-frolics.ogg',
        sad: root + 'assets/audio/music/sad-descent.ogg',
        gameover: root + 'assets/audio/music/game-over.ogg',
      },
      introFallback: root + 'assets/audio/music/night-at-the-beach.ogg', // unused (no separate intro) -- kept for schema parity with the shared music block
    },
    forbiddenWords: [],
    mission: {
      mission: 'GET EVERYONE HOME',
      swarms: ['THE USUAL SUSPECTS', 'THE LATECOMERS', 'THE WHOLE SITUATION'],
      shipColor: 'blue',
    },
    cast: {
      diner0: { name: 'THE FOURTH FRIEND', spriteCol: 1, spriteRow: 7, anecdote: 'Always up for anything.' },
      judge: null,
      authority: null,
      savior: null,
      butterfingers: null,
      builder: null,
    },
    rankNames: {
      immaculate: 'IMMACULATE',
      comicTiming: 'COMIC TIMING',
      worst: 'COULD USE MORE PRACTICE',
    },
  };
}

/* `templateKey` is the THIRD, OPTIONAL argument -- default `'hangout'`. Any
   value other than the literal strings `'gallery'`/`'flight'`/`'defense'`/
   `'mission'` (absent, `'hangout'`, or anything an already-sanitized
   fragment/order could never produce since the enum whitelist below drops
   anything else first) returns exactly what this function has always
   returned -- see cfgBuildGalleryDefaultConfig's own header for why
   'gallery'/'flight'/'defense'/'mission' each dispatch to a wholly
   separate object instead of an overlay on the hangout base. */
function cfgBuildDefaultConfig(engineRoot, sceneKey, templateKey){
  if(templateKey === 'gallery') return cfgBuildGalleryDefaultConfig(engineRoot);
  if(templateKey === 'flight') return cfgBuildFlightDefaultConfig(engineRoot);
  if(templateKey === 'defense') return cfgBuildDefenseDefaultConfig(engineRoot);
  if(templateKey === 'mission') return cfgBuildMissionDefaultConfig(engineRoot);
  var root = engineRoot || '';
  var scene = (sceneKey && sceneKey !== 'dinner' && Object.prototype.hasOwnProperty.call(CFG_SCENE_DEFAULTS, sceneKey)) ? sceneKey : null;
  var cfg = {
    gameId: 'shared',
    lengthPreset: 'five_min',
    title: {
      lockupLines: ['YOUR', 'GROUP'],
      introPageTitle: 'A Tiny Game',
      gamePageTitle: 'A Tiny Game -- Playable Demo',
    },
    punchline: 'CLASSIC.',
    host: { name: 'HOST' },
    music: {
      customSongPath: null,
      loops: {
        dinner: root + 'assets/audio/music/wacky-waiting.ogg',
        boss: root + 'assets/audio/music/mission-plausible.ogg',
        chase: root + 'assets/audio/music/time-driving.ogg',
        celebration: root + 'assets/audio/music/farm-frolics.ogg',
        sad: root + 'assets/audio/music/sad-descent.ogg',
        gameover: root + 'assets/audio/music/game-over.ogg',
      },
      introFallback: root + 'assets/audio/music/night-at-the-beach.ogg',
    },
    // the tone gate is entirely per-group now (see tools/verify-config.js's
    // toneGateSource) -- no universal/baseline word list, so the neutral
    // default is simply nothing off-limits. A real order's own off-limits
    // answer (Q10) fills this in.
    forbiddenWords: [],
    stories: [
      { lines: ['SOMEONE MISSED THE TURN', 'FOR THE THIRD TIME.'] },
      { lines: ['THE WAITER FORGOT THE ORDER', 'AND NOBODY MINDED.'] },
    ],
    cast: {
      diner0: { name: 'THE FOURTH FRIEND', spriteCol: 1, spriteRow: 7, anecdote: 'Always up for anything.' },
      judge: null,
      authority: null,
      savior: null,
      butterfingers: null,
      builder: null,
    },
    dismissiveLine: 'OKAY. WE GET IT.',
    judge: {
      title: 'THE CRITIC',
      cardBody: ['DODGE THE REVIEWS.', 'GRAB THE ITEM ON THE FLOOR.', 'SPACE TO THROW.'],
      critiqueLines: [ ['WEAK PREMISE.'], ['DERIVATIVE.'], ['COULD BE BETTER.'] ],
      duckLines: ['TOO SLOW, {HOST}.', 'PREDICTABLE.'],
      hitLines: ['OW. LUCKY.', 'RUDE.'],
      fakeDeathLine1: 'JUST KIDDING.',
      fakeDeathLine2: 'ANYWAY.',
      mockLine: ['I LIVE.', '...NICE SHIRT.'],
      retortLine: 'IT WAS A GIFT.',
      itemLabel: 'THE COMEBACK!',
      redemptionLine: 'FINE. IT WAS GOOD.',
    },
    savior: {
      itemName: 'GIFT',
      line1: 'EXCUSE ME...',
      line2: 'I BROUGHT THE {ITEM}.',
      sincereLine: 'HEY {HOST}... YOU SAVED THE NIGHT.',
    },
    authority: {
      entranceLine1: 'A ONE-STAR REVIEW?!',
      entranceLine2: 'WHO DID THIS?',
      turnGoodLine1: 'FIVE STARS...',
      turnGoodLine2: "LET'S DO THIS AGAIN SOMETIME.",
      beggingLine: 'PLEASE. FIVE STARS.',
      failLine: 'THE REVIEW STANDS.',
      cardTitle: 'THE BOSS HAS ARRIVED',
      cardBody: ["{HOST}'S BOSS SAW A BAD REVIEW.", 'CHASE THE GUESTS. BEG FOR FIVE STARS.', "DON'T GET CAUGHT."],
    },
    butterfingers: {
      deleteAllLine: 'DELETE ALL?',
      deletedLine: 'DELETED.',
      allMyPhotosLine: 'ALL MY PHOTOS.',
    },
    builder: {
      epBCaption1: 'THAT NIGHT, SOMEONE KEPT THINKING ABOUT IT.',
      epBCaption2: 'THEY WENT HOME.',
      epBCaption3: 'AND BUILT A GAME ABOUT THAT EXACT NIGHT.',
      epBCaption4: 'AND SHARED IT WITH EVERYONE.',
      cardTitle: 'TECH SUPPORT',
      cardBody: ["SOMEONE CAN'T HEAR THE GAME.", 'CHASE THEM DOWN.', 'ASK IF THEY RESET IT.'],
      cantHearLine: "I CAN'T HEAR THE MUSIC.",
      resetQuestionLine: 'DID YOU RESET IT?',
      resetReplies: ['WHAT?', "IT'S JUST BEEPING.", 'STILL NO SOUND.'],
      resetFinalReply: 'OH. IT WORKS NOW.',
    },
    introStory: {
      scene1Lines: ['NOT LONG AGO,', '{HOST} HOSTED A NIGHT FOR SOME FRIENDS.', 'THE STORIES THEY TOLD WERE VERY ORDINARY.'],
      scene2Lines: ['THEY SAY {HOST} STILL WAITS BY THE DOOR...', 'LISTENING.'],
      scene4LinesWithSavior: ['YOU GOT THE {ITEM}!', 'IT IS GREATLY APPRECIATED.'],
      scene4LinesNoSavior: ['THE NIGHT WAS SAVED.', 'EVERYONE HAD A GREAT TIME.'],
    },
    rankNames: {
      immaculate: 'IMMACULATE',
      comicTiming: 'COMIC TIMING',
      worst: 'FRIEND WHO RUINS THE NIGHT',
    },
    loseLine: 'THE NIGHT IS RUINED.',
  };
  if(scene){
    cfg.scene = scene;
    cfg = cfgDeepMerge(cfg, CFG_SCENE_DEFAULTS[scene]);
  }
  return cfg;
}

/* ----------------------------------------------------------------------
   PART B.2 -- CFG_FRAGMENT_SCHEMA + sanitizer. Deliberately NARROWER than
   the full file-CONFIG schema: no `music` (a fragment can never point the
   engine's fetch() at an arbitrary attacker-chosen URL -- stock music
   always comes from CFG_DEFAULT_CONFIG), no `gameId` (derived from a hash
   of the fragment instead, see cfgHashString), no asset paths of any
   kind. Every string/array field is length/count-capped; every object
   field only keeps its own whitelisted sub-keys; anything not in this
   schema is silently dropped, never merged in -- "only known keys" by
   construction, not by a denylist.
   ---------------------------------------------------------------------- */
function cfgStr(maxLen){ return { type:'string', maxLen: maxLen }; }
function cfgNum(min, max){ return { type:'number', min: min, max: max }; }
function cfgEnum(values){ return { type:'enum', values: values }; }
function cfgArr(maxLen, item){ return { type:'array', maxLen: maxLen, item: item }; }
function cfgObj(fields, nullable){ return { type:'object', fields: fields, nullable: !!nullable }; }

/* PHASE C (characters are their people): `sprite` is an ENUM pick among
   game/roster.js's fixed, engine-shipped ROSTER_KEYS -- never a path, col,
   or row (those stay engine-side data; see that file's own header
   comment). `CFG_ROSTER_KEYS` degrades to an empty array (so the enum
   whitelist becomes "nothing validates", never "anything validates") if
   roster.js somehow isn't loaded before this file evaluates -- it always
   is in every real page and every harness (see game/index.html,
   intro/index.html, tools/verify-config.js's loadEngineWithConfig), so
   this is defensive-only. `spriteCol`/`spriteRow` stay exactly as they
   were pre-Phase-C -- the resolved-value back-compat fields a legacy
   config/fragment may still carry; game/roster.js's rosterResolveSprite
   is the ONE place that decides which of `sprite` vs spriteCol/spriteRow
   wins (sprite wins outright when it's a valid key, never a partial mix). */
var CFG_ROSTER_KEYS = (typeof ROSTER_KEYS !== 'undefined') ? ROSTER_KEYS
  : (typeof require === 'function' ? (function(){ try{ return require('./roster.js').ROSTER_KEYS; }catch(e){ return []; } })() : []);

/* PEOPLE FIRST (SPEC-people.md, round 1) -- `quotes`: 1-3 things this
   person actually said, word for word, capped 60 chars each (the same
   "structural ceiling only, UX minimum lives in the wizard" split every
   other array field in this schema draws -- the wizard's own 1-3 minimum
   is never codec-enforced). Optional everywhere -- absent = every
   existing config/fragment's behavior, byte-identical (see each engine's
   own quote-surfacing code, which always treats a missing/empty
   `quotes` the same as "this person doesn't have any"). Rendered
   uppercased, same as every other display string -- the wizard/generator
   uppercase at compile time, engines trust the config as-is. */
var CFG_CAST_ENTRY_FIELDS = {
  name: cfgStr(40),
  spriteCol: cfgNum(0, 15),
  spriteRow: cfgNum(0, 15),
  sprite: cfgEnum(CFG_ROSTER_KEYS),
  anecdote: cfgStr(160),
  quotes: cfgArr(3, cfgStr(60)),
};
function cfgCastEntry(nullable){ return cfgObj(CFG_CAST_ENTRY_FIELDS, nullable); }

/* PEOPLE FIRST -- `extras`: people beyond host + the five roles + diner0
   (today's one "extra friend" slot) -- the wizard's People step allows up
   to 6 people total, so up to 2 can land here once host+diner0+however
   many roles are assigned. Deliberately its own small field set (not
   CFG_CAST_ENTRY_FIELDS) -- an extra has no role-specific fields
   (anecdote/spriteCol/spriteRow back-compat) to carry, just name/sprite/
   quotes. See each engine's own "THE WHOLE CREW" end-card credits block
   (every template) and, where the fiction supports it (Gallery's target
   pool, Mission's extra wingmen), a second, cheap use. */
var CFG_EXTRA_ENTRY_FIELDS = {
  name: cfgStr(40),
  sprite: cfgEnum(CFG_ROSTER_KEYS),
  quotes: cfgArr(3, cfgStr(60)),
};
function cfgExtraEntry(){ return cfgObj(CFG_EXTRA_ENTRY_FIELDS); }

/* the ONE narrow, deliberate exception to "no music from a fragment,
   ever": an ENUM pick among a FIXED set of built-in stock tracks (never
   an arbitrary URL/path -- cfgApplyMusicVibe below only ever resolves one
   of these 5 known keys, or a deterministic rotation among them, against
   engineRoot + hardcoded filenames, the same shared assets every game
   already ships). Lets a `#cfg=` link (and the /build/ wizard's live
   preview, which goes through this exact same function) pick which
   curated track SET scores the whole game, without reopening the
   "redirect fetch() at an attacker URL" risk `music` itself was excluded
   over.

   PHASE M (music overhaul): a vibe no longer swaps only the ambient
   `dinner` loop -- it maps all SIX beat slots to a curated set, drawn
   from the 24 Kenney "Music Loops" tracks (19 in Loops/ + 5 in Retro/;
   see assets/audio/CREDITS.txt for the full source list). Curated for
   register coherence (track length/tempo + name/mood) -- `dinner` is
   always that vibe's ORIGINAL headline track (unchanged from before this
   phase, so the wizard's preview button keeps previewing the same track
   it always has), and `sad`/`gameover` are always drawn from the gentle
   pool (Sad Descent / Sad Town / Infinite Descent / Game Over) in every
   set, regardless of the set's own register:

     upbeat  (Upbeat / a little goofy)     -- goofy/silly comedy register
       dinner: Wacky Waiting        boss: Cheerful Annoyance
       chase:  Polka Train          celebration: Swinging Pants
       sad:    Sad Descent          gameover: Game Over
     spy     (Playful tension, like a spy movie) -- intrigue/mischief
       dinner: Mission Plausible    boss: Mischief Stroll
       chase:  Drumming Sticks      celebration: Space Cadet
       sad:    Infinite Descent     gameover: Game Over
     chase   (Fast and fun, chase energy)  -- driving/energetic
       dinner: Time Driving         boss: Alpha Dance
       chase:  Retro Beat           celebration: German Virtue
       sad:    Sad Town             gameover: Game Over
     warm    (Warm and celebratory)        -- cozy/homey
       dinner: Farm Frolics         boss: Italian Mom
       chase:  Retro Reggae         celebration: Night at the Beach
       sad:    Sad Descent          gameover: Game Over
     sincere (Quiet and sincere)           -- hushed/gentle throughout
       dinner: Sad Descent          boss: Retro Mystic
       chase:  Flowing Rocks        celebration: Sad Town
       sad:    Infinite Descent     gameover: Game Over

   Retro Comedy and Retro Polka (the two remaining Retro tracks) went
   unused by this curation -- both under 8 seconds, too short/gimmicky to
   read as a bed loop rather than a stinger. */
var CFG_VIBE_TRACK_SETS = {
  upbeat: { dinner:'wacky-waiting', boss:'cheerful-annoyance', chase:'polka-train', celebration:'swinging-pants', sad:'sad-descent', gameover:'game-over' },
  spy: { dinner:'mission-plausible', boss:'mischief-stroll', chase:'drumming-sticks', celebration:'space-cadet', sad:'infinite-descent', gameover:'game-over' },
  chase: { dinner:'time-driving', boss:'alpha-dance', chase:'retro-beat', celebration:'german-virtue', sad:'sad-town', gameover:'game-over' },
  warm: { dinner:'farm-frolics', boss:'italian-mom', chase:'retro-reggae', celebration:'night-at-the-beach', sad:'sad-descent', gameover:'game-over' },
  sincere: { dinner:'sad-descent', boss:'retro-mystic', chase:'flowing-rocks', celebration:'sad-town', sad:'infinite-descent', gameover:'game-over' },
};
var CFG_VIBE_KEYS = Object.keys(CFG_VIBE_TRACK_SETS);

/* mergedConfig.music.loops gets every slot set, always -- either the
   matching vibe's own curated set, or (vibeKey absent/unrecognized, e.g.
   an old link with no musicVibe field, or a user who picked "Surprise
   us") a DETERMINISTIC pick among the 5 sets, keyed off `hashSeed` via
   the existing cfgHashString -- never Math.random at runtime, so the
   same seed always resolves to the same set (a given link/order always
   sounds the same) while different ones spread across the curated
   register options. Callers pass a seed that's stable for THEIR own
   notion of "this one game" -- cfgLoadFragmentOverride and the wizard's
   assembleConfig both use the fragment's own sanitized JSON (identical
   at encode- and decode-time by construction, see cfgSanitizeConfig's
   fixed key order); tools/generate.js uses the real gameId (slug) it's
   about to write to the file. `parseInt(..., 36)` reverses
   cfgHashString's own `.toString(36)` -- reuses that function exactly as
   it stands, no new hashing code. */
function cfgApplyMusicVibe(mergedConfig, vibeKey, engineRoot, hashSeed){
  if(!mergedConfig || !mergedConfig.music || !mergedConfig.music.loops) return mergedConfig;
  var resolvedVibe = (vibeKey && Object.prototype.hasOwnProperty.call(CFG_VIBE_TRACK_SETS, vibeKey)) ? vibeKey : null;
  var set;
  if(resolvedVibe){
    set = CFG_VIBE_TRACK_SETS[resolvedVibe];
  } else {
    var idx = parseInt(cfgHashString(String(hashSeed || '')), 36) % CFG_VIBE_KEYS.length;
    set = CFG_VIBE_TRACK_SETS[CFG_VIBE_KEYS[idx]];
  }
  var root = engineRoot || '';
  for(var slot in set){
    mergedConfig.music.loops[slot] = root + 'assets/audio/music/' + set[slot] + '.ogg';
  }
  return mergedConfig;
}

/* THE GALLERY (template #2) -- `template` is the top-level template pick,
   same "fixed enum, never a free string" shape as `scene`/`musicVibe`.
   Absent (every pre-Gallery config/fragment) or any unrecognized value
   sanitizes away entirely -- cfgBuildDefaultConfig's own templateKey
   default ('hangout') is what an absent key actually resolves to, so old
   links/orders keep playing the Hangout, byte-identically, forever. */
var CFG_TEMPLATE_KEYS = ['hangout', 'gallery', 'flight', 'defense', 'mission'];
/* gallery.targets: 4-8 short labels is the WIZARD/authoring-time guideline
   (mirrors `stories`' own "2-4" guideline just below, also not enforced
   here) -- this schema only caps the CEILING (8) and per-string length
   (24), the same "structural safety net, not the UX guidance" split every
   other array field in this schema already draws. firstBossHeckle/
   finalBossQuirk are optional (cfgObj's `fields` entries are only ever
   copied when the raw payload actually has the key -- see
   cfgSanitizeValue's object branch) -- gallery/engine.js's own neutral
   fallback pools cover their absence, see that file's header. */
var CFG_GALLERY_SCHEMA = {
  targets: cfgArr(8, cfgStr(24)),
  firstBossHeckle: cfgStr(60),
  finalBossQuirk: cfgStr(60),
};

/* THE FLIGHT (template #3) -- beats: the 3-6 trip legs, in order (wizard/
   authoring minimum of 3 is UX guidance, never codec-enforced -- same "cap
   the ceiling only" split every other array field in this schema draws).
   hazards: the 2-6 short labels painted on the gate plaques, cycling in
   seeded order (see flight/engine.js). planeColor: a fixed enum, same
   "pick among a whitelisted set, never a free string" shape as `scene`/
   `musicVibe`/`template` elsewhere in this file. firstBossHeckle/
   finalBossQuirk are optional for the same reason CFG_GALLERY_SCHEMA's own
   are -- flight/engine.js's own neutral fallback pools cover their
   absence. */
var CFG_FLIGHT_SCHEMA = {
  beats: cfgArr(6, cfgStr(90)),
  hazards: cfgArr(6, cfgStr(24)),
  planeColor: cfgEnum(['yellow', 'red', 'blue', 'green']),
  firstBossHeckle: cfgStr(60),
  finalBossQuirk: cfgStr(60),
};

/* THE DEFENSE (template #4) -- defending: the 24-char label for THE
   THING everyone protects (a plaque on its pedestal). waves: 3-6 short
   annoyance labels, in order (wizard/authoring minimum of 3 is UX
   guidance, never codec-enforced -- same "cap the ceiling only" split
   every array field in this schema draws). firstBossHeckle/
   finalBossQuirk are optional for the same reason CFG_GALLERY_SCHEMA's/
   CFG_FLIGHT_SCHEMA's own are -- defense/engine.js's own neutral
   fallback pools cover their absence. */
var CFG_DEFENSE_SCHEMA = {
  defending: cfgStr(24),
  waves: cfgArr(6, cfgStr(24)),
  firstBossHeckle: cfgStr(60),
  finalBossQuirk: cfgStr(60),
};

/* THE MISSION (template #5) -- mission: the 40-char mission-objective
   line, banner-rendered verbatim ("MISSION: FIND THE BEST TACO"). swarms:
   2-6 short enemy-swarm labels, in order, one per stage (wizard/authoring
   minimum of 2 is UX guidance, never codec-enforced -- same "cap the
   ceiling only" split every other array field in this schema draws).
   shipColor: a fixed enum, same "pick among a whitelisted set, never a
   free string" shape as `scene`/`musicVibe`/`template`/flight's own
   planeColor elsewhere in this file. firstBossHeckle/finalBossQuirk are
   optional for the same reason CFG_GALLERY_SCHEMA's/CFG_FLIGHT_SCHEMA's/
   CFG_DEFENSE_SCHEMA's own are -- mission/engine.js's own neutral fallback
   pools cover their absence. */
var CFG_MISSION_SCHEMA = {
  mission: cfgStr(40),
  swarms: cfgArr(6, cfgStr(24)),
  shipColor: cfgEnum(['blue', 'green', 'orange', 'red']),
  firstBossHeckle: cfgStr(60),
  finalBossQuirk: cfgStr(60),
};

var CFG_FRAGMENT_SCHEMA = {
  template: cfgEnum(CFG_TEMPLATE_KEYS),
  gallery: cfgObj(CFG_GALLERY_SCHEMA),
  flight: cfgObj(CFG_FLIGHT_SCHEMA),
  defense: cfgObj(CFG_DEFENSE_SCHEMA),
  mission: cfgObj(CFG_MISSION_SCHEMA),
  lengthPreset: cfgEnum(['full', 'five_min']),
  // STORY SKELETONS: enum-only, same "pick a fixed built-in by key, never a
  // path/URL/free string" shape as musicVibe just below -- see
  // game/skeletons.js for what a scene key actually resolves to (draw
  // functions/palettes/strings, entirely engine-shipped, never fragment-
  // supplied). Absent or not one of these four -> sanitizes to absent, same
  // as any other unrecognized enum value -- resolved to 'dinner' at the
  // engine's own SKEL lookup (SKELETONS[CONFIG.scene] || SKELETONS.dinner).
  scene: cfgEnum(CFG_SCENE_KEYS),
  musicVibe: cfgEnum(CFG_VIBE_KEYS),
  title: cfgObj({
    lockupLines: cfgArr(2, cfgStr(14)),
    introPageTitle: cfgStr(60),
    gamePageTitle: cfgStr(60),
  }),
  punchline: cfgStr(40),
  // PHASE C: the host/player gets the same optional sprite pick a cast
  // entry does (see CFG_CAST_ENTRY_FIELDS's own comment for the
  // sprite-vs-spriteCol/Row precedence -- game/roster.js's
  // rosterResolveSprite is the one place that resolves it, for host and
  // cast alike). Absent (every pre-Phase-C config/fragment) resolves to
  // today's hardcoded host tile -- see game/engine.js's drawHost.
  host: cfgObj({ name: cfgStr(40), spriteCol: cfgNum(0, 15), spriteRow: cfgNum(0, 15), sprite: cfgEnum(CFG_ROSTER_KEYS), quotes: cfgArr(3, cfgStr(60)) }),
  // PEOPLE FIRST (SPEC-people.md, round 1) -- people beyond host + the
  // five roles + diner0; see CFG_EXTRA_ENTRY_FIELDS's own comment. The
  // one new top-level key this feature adds -- append-only, same as
  // every other top-level field here.
  extras: cfgArr(2, cfgExtraEntry()),
  forbiddenWords: cfgArr(10, cfgStr(30)),
  stories: cfgArr(4, cfgObj({ lines: cfgArr(2, cfgStr(80)) })),
  dismissiveLine: cfgStr(80),
  cast: cfgObj({
    diner0: cfgCastEntry(false),
    judge: cfgCastEntry(true),
    authority: cfgCastEntry(true),
    savior: cfgCastEntry(true),
    butterfingers: cfgCastEntry(true),
    builder: cfgCastEntry(true),
  }),
  judge: cfgObj({
    title: cfgStr(40),
    cardBody: cfgArr(4, cfgStr(80)),
    critiqueLines: cfgArr(8, cfgArr(2, cfgStr(80))),
    duckLines: cfgArr(6, cfgStr(80)),
    hitLines: cfgArr(6, cfgStr(80)),
    fakeDeathLine1: cfgStr(80),
    fakeDeathLine2: cfgStr(80),
    mockLine: cfgArr(2, cfgStr(80)),
    retortLine: cfgStr(80),
    itemLabel: cfgStr(40),
    redemptionLine: cfgStr(80),
  }),
  savior: cfgObj({
    itemName: cfgStr(30),
    line1: cfgStr(80),
    line2: cfgStr(80),
    sincereLine: cfgStr(80),
  }),
  authority: cfgObj({
    entranceLine1: cfgStr(80),
    entranceLine2: cfgStr(80),
    turnGoodLine1: cfgStr(80),
    turnGoodLine2: cfgStr(80),
    beggingLine: cfgStr(80),
    failLine: cfgStr(80),
    cardTitle: cfgStr(40),
    cardBody: cfgArr(4, cfgStr(80)),
  }),
  butterfingers: cfgObj({
    deleteAllLine: cfgStr(80),
    deletedLine: cfgStr(80),
    allMyPhotosLine: cfgStr(80),
  }),
  builder: cfgObj({
    epBCaption1: cfgStr(200),
    epBCaption2: cfgStr(200),
    epBCaption3: cfgStr(200),
    epBCaption4: cfgStr(200),
    cardTitle: cfgStr(40),
    cardBody: cfgArr(4, cfgStr(80)),
    cantHearLine: cfgStr(80),
    resetQuestionLine: cfgStr(80),
    resetReplies: cfgArr(6, cfgStr(80)),
    resetFinalReply: cfgStr(80),
  }),
  introStory: cfgObj({
    scene1Lines: cfgArr(4, cfgStr(200)),
    scene2Lines: cfgArr(4, cfgStr(200)),
    scene4LinesWithSavior: cfgArr(4, cfgStr(200)),
    scene4LinesNoSavior: cfgArr(4, cfgStr(200)),
  }),
  rankNames: cfgObj({
    immaculate: cfgStr(40),
    comicTiming: cfgStr(40),
    worst: cfgStr(60),
  }),
  loseLine: cfgStr(80),
};

/* returns undefined if `value` doesn't fit `schema` at all (caller drops
   the key, falling back to the default); returns a sanitized value
   (possibly `null` for a nullable object) otherwise. Recursive, depth
   bounded by CFG_FRAGMENT_SCHEMA's own fixed shape (never follows
   attacker-controlled recursion depth). */
function cfgSanitizeValue(schema, value){
  if(!schema) return undefined;
  if(schema.type === 'string'){
    if(typeof value !== 'string') return undefined;
    return schema.maxLen && value.length > schema.maxLen ? value.slice(0, schema.maxLen) : value;
  }
  if(schema.type === 'number'){
    if(typeof value !== 'number' || !isFinite(value)) return undefined;
    var v = value;
    if(schema.min !== undefined) v = Math.max(schema.min, v);
    if(schema.max !== undefined) v = Math.min(schema.max, v);
    return Math.round(v);
  }
  if(schema.type === 'enum'){
    return (typeof value === 'string' && schema.values.indexOf(value) !== -1) ? value : undefined;
  }
  if(schema.type === 'array'){
    if(!Array.isArray(value)) return undefined;
    var maxLen = schema.maxLen || 20;
    var out = [];
    for(var i=0; i<value.length && out.length<maxLen; i++){
      var sv = cfgSanitizeValue(schema.item, value[i]);
      if(sv !== undefined) out.push(sv);
    }
    return out;
  }
  if(schema.type === 'object'){
    if(value === null) return schema.nullable ? null : undefined;
    if(typeof value !== 'object' || Array.isArray(value)) return undefined;
    var result = {};
    var any = false;
    for(var key in schema.fields){
      if(!Object.prototype.hasOwnProperty.call(value, key)) continue;
      var fv = cfgSanitizeValue(schema.fields[key], value[key]);
      if(fv !== undefined){ result[key] = fv; any = true; }
    }
    return any ? result : undefined; // nothing whitelisted survived -- contributes nothing over the default
  }
  return undefined;
}

/* top-level entry: raw decoded JSON value -> a plain object containing
   ONLY whitelisted, length-capped keys (never throws; a non-object input
   sanitizes to {}, contributing nothing over the default). */
function cfgSanitizeConfig(raw){
  if(typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  var out = {};
  for(var key in CFG_FRAGMENT_SCHEMA){
    if(!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    var sv = cfgSanitizeValue(CFG_FRAGMENT_SCHEMA[key], raw[key]);
    if(sv !== undefined) out[key] = sv;
  }
  return out;
}

/* ----------------------------------------------------------------------
   PART B.3 -- deep merge. `overrides` wins key by key; nested plain
   objects merge recursively; arrays and primitives from `overrides`
   replace the base value wholesale (never merged element-wise -- too
   ambiguous); an explicit `null` in `overrides` sets that key to null
   (meaningful for cast.<role> = null, "explicitly uncast") rather than
   being treated as "not specified". Returns a NEW object -- never mutates
   either argument, so callers decide how (or whether) to apply the result
   to their own CONFIG binding.
   ---------------------------------------------------------------------- */
function cfgDeepMerge(base, overrides){
  if(overrides === null) return null;
  if(typeof overrides !== 'object' || Array.isArray(overrides)) return overrides;
  var baseObj = (base && typeof base === 'object' && !Array.isArray(base)) ? base : {};
  var out = {};
  for(var bk in baseObj){ if(Object.prototype.hasOwnProperty.call(baseObj, bk)) out[bk] = baseObj[bk]; }
  for(var ok in overrides){
    if(!Object.prototype.hasOwnProperty.call(overrides, ok)) continue;
    var ov = overrides[ok];
    if(ov === null){
      out[ok] = null;
    } else if(typeof ov === 'object' && !Array.isArray(ov)){
      out[ok] = cfgDeepMerge(baseObj[ok], ov);
    } else {
      out[ok] = ov;
    }
  }
  return out;
}

/* ----------------------------------------------------------------------
   PART B.4 -- the high-level, browser-facing entry point. Reads
   location.hash, and if (and only if) it's a well-formed, decodable,
   parseable `#cfg=<data>` fragment, returns { config, hash, raw } --
   `config` is the fully-merged CONFIG-shaped object ready to replace the
   page's own CONFIG; `hash` is cfgHashString(raw), for STORAGE_PREFIX;
   `raw` is the fragment payload itself (engine.js/intro engine.js use it
   to forward the SAME fragment across the intro<->game navigation so
   save data and the override stay attached to the same link). Returns
   null for "no fragment" OR "fragment present but invalid/oversized" --
   both cases fall back to the page's own file CONFIG identically, on
   purpose (never partially applies a broken fragment). */
function cfgLoadFragmentOverride(engineRoot){
  try{
    var hash = (typeof location !== 'undefined' && location.hash) || '';
    var m = /^#cfg=(.+)$/.exec(hash);
    if(!m) return null;
    var raw = m[1];
    if(raw.length === 0 || raw.length > CFG_MAX_FRAGMENT_CHARS) return null;
    var json = cfgDecompress(raw);
    if(!json) return null;
    var parsed;
    try{ parsed = JSON.parse(json); }catch(e){ return null; }
    // a well-formed EMPTY object ({}) is a deliberate "just the neutral
    // defaults" override and should succeed; anything that isn't a plain
    // object at all (an array, a bare number/string/bool, null) isn't a
    // valid CONFIG payload no matter how cleanly it decoded -- treat that
    // as invalid and fall back to the file CONFIG, same as a corrupt one.
    if(typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    var sanitized = cfgSanitizeConfig(parsed);
    // STORY SKELETONS: build the base off the fragment's OWN scene pick (an
    // absent/invalid one falls back to 'dinner' inside cfgBuildDefaultConfig
    // itself, same as always) so a roadtrip/office/wedding link gets that
    // scene's CFG_SCENE_DEFAULTS text for free -- the fragment's own
    // explicit fields (sanitized, merged on next) still win over it either way.
    var base = cfgBuildDefaultConfig(engineRoot, sanitized.scene, sanitized.template);
    var merged = cfgDeepMerge(base, sanitized);
    // hash seed = the sanitized override's own JSON (NOT `raw`, the
    // compressed fragment string) -- the /build/ wizard's assembleConfig
    // hashes the exact same JSON.stringify(sanitized) before it has a
    // compressed fragment to hash at all, so a link's live preview and the
    // link itself resolve to the same "surprise us" set. cfgSanitizeConfig
    // always builds keys in CFG_FRAGMENT_SCHEMA's own fixed order, so this
    // string is byte-identical between encode time and this decode time.
    cfgApplyMusicVibe(merged, sanitized.musicVibe, engineRoot, JSON.stringify(sanitized));
    delete merged.musicVibe; // consumed above -- not a real CONFIG field, don't leave it sitting on the object
    return { config: merged, hash: cfgHashString(raw), raw: raw };
  }catch(e){ return null; }
}

/* convenience for callers building a shareable link (the /build/ wizard,
   tools/generate.js): CONFIG-shaped object -> the exact string to place
   after `#cfg=` (already sanitized through the SAME whitelist a real page
   would apply on load, so what you compress is what actually survives --
   callers should still show the user a real preview to be sure). */
function cfgEncodeConfigFragment(configObj){
  var sanitized = cfgSanitizeConfig(configObj);
  return cfgCompress(JSON.stringify(sanitized));
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    cfgCompress: cfgCompress,
    cfgDecompress: cfgDecompress,
    cfgHashString: cfgHashString,
    cfgBuildDefaultConfig: cfgBuildDefaultConfig,
    cfgBuildGalleryDefaultConfig: cfgBuildGalleryDefaultConfig,
    cfgBuildFlightDefaultConfig: cfgBuildFlightDefaultConfig,
    cfgBuildDefenseDefaultConfig: cfgBuildDefenseDefaultConfig,
    cfgBuildMissionDefaultConfig: cfgBuildMissionDefaultConfig,
    CFG_TEMPLATE_KEYS: CFG_TEMPLATE_KEYS,
    CFG_GALLERY_SCHEMA: CFG_GALLERY_SCHEMA,
    CFG_FLIGHT_SCHEMA: CFG_FLIGHT_SCHEMA,
    CFG_DEFENSE_SCHEMA: CFG_DEFENSE_SCHEMA,
    CFG_MISSION_SCHEMA: CFG_MISSION_SCHEMA,
    CFG_FRAGMENT_SCHEMA: CFG_FRAGMENT_SCHEMA,
    cfgSanitizeConfig: cfgSanitizeConfig,
    cfgDeepMerge: cfgDeepMerge,
    cfgLoadFragmentOverride: cfgLoadFragmentOverride,
    cfgEncodeConfigFragment: cfgEncodeConfigFragment,
    cfgApplyMusicVibe: cfgApplyMusicVibe,
    CFG_VIBE_TRACK_SETS: CFG_VIBE_TRACK_SETS,
    CFG_VIBE_KEYS: CFG_VIBE_KEYS,
    CFG_MAX_FRAGMENT_CHARS: CFG_MAX_FRAGMENT_CHARS,
    CFG_SCENE_KEYS: CFG_SCENE_KEYS,
    CFG_SCENE_DEFAULTS: CFG_SCENE_DEFAULTS,
    CFG_ROSTER_KEYS: CFG_ROSTER_KEYS,
  };
}
