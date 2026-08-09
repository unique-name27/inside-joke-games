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
   (deliberately NOT Karks Cub Kingdom's own config -- game/config.js stays
   the *schema* reference, per the spec, not the merge base) + a whitelist
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
   PART B.1 -- CFG_DEFAULT_CONFIG: a neutral, fully-populated base for
   deep-merging a fragment onto. Deliberately NOT Karks Cub Kingdom's own
   branding (that stays the *schema* reference in game/config.js) -- every
   role's content bucket is fully written out with generic-but-complete
   placeholder text so a fragment that supplies e.g. only `cast.judge.name`
   still gets a complete, playable Widowmaker beat for free via merge.
   Every optional role in `cast` defaults to null (uncast) -- the safest,
   always-works minimum is "just the host, straight through to
   celebration" -- a fragment opts INTO a role by supplying a real object
   for it. Takes `engineRoot` (the caller's own ENGINE_ROOT) so the stock
   music paths resolve correctly regardless of which page/depth loaded the
   fragment -- returns a FRESH object each call (no shared mutable state).
   ---------------------------------------------------------------------- */
function cfgBuildDefaultConfig(engineRoot){
  var root = engineRoot || '';
  return {
    gameId: 'shared',
    lengthPreset: 'five_min',
    title: {
      lockupLines: ['YOUR', 'GROUP'],
      introPageTitle: 'A Tiny Game',
      gamePageTitle: 'A Tiny Game -- Playable Demo',
    },
    punchline: 'FOR FREE?',
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
    forbiddenWords: ['COIN', 'BILL', 'COST', 'NOTHING'],
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

var CFG_CAST_ENTRY_FIELDS = {
  name: cfgStr(40),
  spriteCol: cfgNum(0, 15),
  spriteRow: cfgNum(0, 15),
  anecdote: cfgStr(160),
};
function cfgCastEntry(nullable){ return cfgObj(CFG_CAST_ENTRY_FIELDS, nullable); }

/* the ONE narrow, deliberate exception to "no music from a fragment,
   ever": an ENUM pick among a FIXED set of built-in stock tracks (never
   an arbitrary URL/path -- cfgApplyMusicVibe below only ever resolves one
   of these 5 known keys against engineRoot + a hardcoded filename, the
   same shared asset every game already ships). Lets a `#cfg=` link (and
   the /build/ wizard's live preview, which goes through this exact same
   function) pick which stock track scores the one ambient loop not
   already tied to a specific story beat, without reopening the
   "redirect fetch() at an attacker URL" risk `music` itself was excluded
   over. */
var CFG_VIBE_TRACK_MAP = {
  upbeat: 'wacky-waiting', spy: 'mission-plausible', chase: 'time-driving',
  warm: 'farm-frolics', sincere: 'sad-descent',
};
function cfgApplyMusicVibe(mergedConfig, vibeKey, engineRoot){
  if(!vibeKey || !Object.prototype.hasOwnProperty.call(CFG_VIBE_TRACK_MAP, vibeKey)) return mergedConfig;
  if(!mergedConfig || !mergedConfig.music || !mergedConfig.music.loops) return mergedConfig;
  mergedConfig.music.loops.dinner = (engineRoot || '') + 'assets/audio/music/' + CFG_VIBE_TRACK_MAP[vibeKey] + '.ogg';
  return mergedConfig;
}

var CFG_FRAGMENT_SCHEMA = {
  lengthPreset: cfgEnum(['full', 'five_min']),
  musicVibe: cfgEnum(Object.keys(CFG_VIBE_TRACK_MAP)),
  title: cfgObj({
    lockupLines: cfgArr(2, cfgStr(14)),
    introPageTitle: cfgStr(60),
    gamePageTitle: cfgStr(60),
  }),
  punchline: cfgStr(40),
  host: cfgObj({ name: cfgStr(40) }),
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
    var base = cfgBuildDefaultConfig(engineRoot);
    var merged = cfgDeepMerge(base, sanitized);
    cfgApplyMusicVibe(merged, sanitized.musicVibe, engineRoot);
    delete merged.musicVibe; // consumed above -- not a real CONFIG field, don't leave it sitting on the object
    return { config: merged, hash: cfgHashString(raw), raw: raw };
  }catch(e){ return null; }
}

/* convenience for callers building a shareable link (the /build/ wizard,
   tools/generate.js): CONFIG-shaped object -> the exact string to place
   after `#cfg=` (already sanitized through the SAME whitelist a real page
   would apply on load, so what you compress is what actually survives --
   callers should still show the buyer a real ?/preview to be sure). */
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
    CFG_FRAGMENT_SCHEMA: CFG_FRAGMENT_SCHEMA,
    cfgSanitizeConfig: cfgSanitizeConfig,
    cfgDeepMerge: cfgDeepMerge,
    cfgLoadFragmentOverride: cfgLoadFragmentOverride,
    cfgEncodeConfigFragment: cfgEncodeConfigFragment,
    cfgApplyMusicVibe: cfgApplyMusicVibe,
    CFG_VIBE_TRACK_MAP: CFG_VIBE_TRACK_MAP,
    CFG_MAX_FRAGMENT_CHARS: CFG_MAX_FRAGMENT_CHARS,
  };
}
