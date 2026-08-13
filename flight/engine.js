'use strict';
/* ======================================================================
   THE FLIGHT -- template #3 engine (see SPEC-flight.md). Single page, no
   separate intro (a short title/attract screen lives inside this file,
   below). Built ON shared/framework.js, following the exact conventions
   gallery/engine.js already established for this project's non-hangout
   templates (ENGINE_ROOT/CFG_FRAGMENT resolution, local CW/CH + eager
   fitCanvas() call, local SFX_DEFS/MUSIC_LOOP_DEFS + wrapper functions,
   local pixel-primitive helpers, local drawRotatePrompt, tick()/update()/
   draw() factored the same way) rather than inventing a new pattern.

   ROUND 1 SCOPE (this file): the full one-button trip run -- seeded gate
   gates per leg (terrain that gets colder as the trip gets worse), leg
   breathers that type out the group's own story beats, hazard plaques,
   star pickups that charge THE SHOUT, THE FIRST BOSS's mid-trip leg (lobbed
   objects), THE FINAL BOSS's sinusoidal approach gate, THE SAVIOR's one-
   time save, the BUTTERFINGERS phone gag, landing + turn-good, the end
   card, and full degradation when judge/authority/savior/butterfingers/
   builder are uncast. THE FULL TRIP (3 hearts, retries) and ONE TANK (one
   life, score-chase, unlocked by landing) modes are both implemented here.
   What round 1 does NOT do (round 2 per SPEC-flight.md's build plan): the
   wizard's trip step / flightField cast lines, tools/generate.js support,
   and a registered harness driver (tools/verify-flight.js) -- this file
   exposes plain top-level functions (tick/flap/handleAction) exactly the
   way gallery/engine.js does, so wiring a future harness is a thin
   wrapper, not a rewrite.
   ====================================================================== */

const ENGINE_ROOT = new URL('../', document.currentScript.src).href;

/* URL-fragment CONFIG override -- identical mechanism/rationale to
   gallery/engine.js's own (see that file's header). `cfgBuildDefaultConfig`
   is called with the THIRD arg 'flight' so a no-fragment boot builds a
   flight-shaped default (not the hangout's) -- see SPEC-flight.md's build
   plan note about not repeating the redirect-path gap the gallery patched
   defensively. */
const CFG_FRAGMENT = (typeof cfgLoadFragmentOverride === 'function') ? cfgLoadFragmentOverride(ENGINE_ROOT) : null;
if(CFG_FRAGMENT && CFG_FRAGMENT.config){
  if(CONFIG){
    for(const k in CONFIG){ if(Object.prototype.hasOwnProperty.call(CONFIG, k)) delete CONFIG[k]; }
    Object.assign(CONFIG, CFG_FRAGMENT.config);
  } else {
    CONFIG = CFG_FRAGMENT.config;
  }
} else if(!CONFIG){
  location.replace(ENGINE_ROOT + 'build/');
  CONFIG = cfgBuildDefaultConfig(ENGINE_ROOT, undefined, 'flight');
}
// defensive default -- mirrors gallery/engine.js's own CONFIG.gallery guard
// exactly (see that file's comment): the brief window before the redirect
// above actually navigates away still needs this file to not crash on
// CONFIG.flight.* references.
if(!CONFIG.flight) CONFIG.flight = {
  beats: ['IT STARTED FINE.', 'THEN SOMETHING WENT SIDEWAYS.', 'NOBODY WOULD ADMIT WHOSE IDEA IT WAS.', 'SOMEHOW EVERYONE MADE IT HOME.'],
  hazards: ['THE WEATHER', 'THE DIRECTIONS', 'THE SCHEDULE', 'THE PLAN'],
  planeColor: 'yellow',
};

document.title = (CONFIG.title && CONFIG.title.gamePageTitle) || 'The Flight -- Playable Demo';

/* ---------------- constants & palette ---------------- */
const CW = 960, CH = 540, TILE = 16;
// fitCanvas() (shared/framework.js) reads CW/CH -- see gallery/engine.js's
// identical comment for why the one initial call has to happen here.
fitCanvas();
const PAL = {
  cream:'#f3e9d2', wood:'#8a5a30', night:'#141428', gold:'#e8b84b', outline:'#6b2b1f', ink:'#2a1c12',
  heartFull:'#c9394a', heartEmpty:'#3a2a20', phoneScreen:'#7fb8e6',
};
/* per-terrain sky tint + ground image key -- "the trip gets colder as it
   gets worse" (SPEC-flight.md). rock/dirt share the plain rock pair (no
   dirt-specific rock formation in the pack -- see assets/flight/
   CREDITS.txt); every other terrain uses its own matching rock pair. */
const TERRAIN = {
  grass: { ground:'groundGrass', rock:'rock',      rockDown:'rockDown',      tint:null },
  dirt:  { ground:'groundDirt',  rock:'rock',       rockDown:'rockDown',      tint:'#c9954a' },
  rock:  { ground:'groundRock',  rock:'rock',       rockDown:'rockDown',      tint:'#8a8f99' },
  snow:  { ground:'groundSnow',  rock:'rockSnow',   rockDown:'rockSnowDown',  tint:'#eaf3fb' },
  ice:   { ground:'groundIce',   rock:'rockIce',    rockDown:'rockIceDown',   tint:'#bdeff5' },
};
/* how many legs -> which terrains, in order (SPEC-flight.md "The trip = the
   level"). Clamped to [1,6] beats always resolves one of these exactly. */
const LEG_TERRAIN_TABLE = {
  1: ['grass'],
  2: ['grass', 'ice'],
  3: ['grass', 'rock', 'ice'],
  4: ['grass', 'dirt', 'rock', 'ice'],
  5: ['grass', 'dirt', 'rock', 'snow', 'ice'],
  6: ['grass', 'dirt', 'rock', 'snow', 'snow', 'ice'],
};

/* ---------------- CONFIG-derived helpers -- {HOST} token, same as every
   other template ---------------- */
const STORAGE_PREFIX = CFG_FRAGMENT ? ('frag_' + CFG_FRAGMENT.hash) : ((CONFIG && CONFIG.gameId) || 'flight');
function fmt(s){
  if(typeof s !== 'string') return s;
  return CONFIG.host ? s.split('{HOST}').join(CONFIG.host.name) : s;
}

const CAST = CONFIG.cast || {};
const JUDGE_CAST = !!CAST.judge;        // THE FIRST BOSS
const AUTHORITY_CAST = !!CAST.authority; // THE FINAL BOSS
const SAVIOR_CAST = !!CAST.savior;
const BUTTERFINGERS_CAST = !!CAST.butterfingers;
const BUILDER_CAST = !!CAST.builder;

const FLIGHT_BEATS_RAW = (CONFIG.flight.beats && CONFIG.flight.beats.length) ? CONFIG.flight.beats : ['THE TRIP BEGAN.'];
const LEGS_COUNT = Math.max(1, Math.min(6, FLIGHT_BEATS_RAW.length));
const FLIGHT_BEATS = FLIGHT_BEATS_RAW.slice(0, LEGS_COUNT);
const FLIGHT_HAZARDS = (CONFIG.flight.hazards && CONFIG.flight.hazards.length) ? CONFIG.flight.hazards : ['THE USUAL CHAOS'];
const PLANE_COLORS = ['yellow', 'red', 'blue', 'green'];
const FLIGHT_PLANE_COLOR = (PLANE_COLORS.indexOf(CONFIG.flight.planeColor) !== -1) ? CONFIG.flight.planeColor : 'yellow';
// THE FIRST BOSS's plane is red, unless the host already flies red, per
// SPEC-flight.md's cast-mapping bullet. THE FINAL BOSS just needs a plane
// color visually distinct from the host's; no spec-mandated pick, so blue
// (falling back to green if the host is blue) is this round's own call.
const BOSS_PLANE_COLOR = (FLIGHT_PLANE_COLOR === 'red') ? 'yellow' : 'red';
const FINAL_BOSS_PLANE_COLOR = (FLIGHT_PLANE_COLOR === 'blue') ? 'green' : 'blue';

/* neutral fallback pools -- template-owned, tone-clean, used whenever a
   config doesn't supply the optional flight.firstBossHeckle/
   finalBossQuirk lines (see SPEC-flight.md's config section, and gallery/
   engine.js's identical pattern). Picked deterministically per game via
   the same seeded rng everything else uses, never Math.random. */
const FIRST_BOSS_HECKLE_FALLBACKS = [
  'CALL THAT FLYING?', 'I\'VE SEEN BETTER LANDINGS FROM A ROCK.', 'PATHETIC ALTITUDE CONTROL.', 'IS THIS YOUR FIRST FLIGHT?',
];
const FINAL_BOSS_QUIRK_FALLBACKS = [
  'ALWAYS COMPLAINS ABOUT LEG ROOM.', 'CANNOT STAND A DELAYED SNACK CART.', 'NEVER FORGIVES A MIDDLE SEAT.',
];
const FIRST_BOSS_HECKLE = CONFIG.flight.firstBossHeckle || null;
const FINAL_BOSS_QUIRK = CONFIG.flight.finalBossQuirk || null;

/* ======================================================================
   SEEDED RNG -- gameId hash -> a deterministic sequence, never Math.random.
   Reuses cfgHashString (game/cfgcodec.js, already loaded) for the hash;
   mulberry32 turns that into a repeatable stream. Byte-identical
   implementation to gallery/engine.js's own (duplicated per engine on
   purpose, same convention as the pixel primitives below).
   ====================================================================== */
function seedFromString(str){
  const h = parseInt(cfgHashString(str), 36);
  return (isFinite(h) && h !== 0) ? (h >>> 0) : 0x9e3779b9;
}
function makeRng(seedStr){
  let s = seedFromString(seedStr);
  return function(){
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rngInt(rng, n){ return Math.floor(rng() * n); }
function rngRange(rng, lo, hi){ return lo + rng() * (hi - lo); }
function rngShuffled(rng, arr){
  const out = arr.slice();
  for(let i = out.length - 1; i > 0; i--){
    const j = rngInt(rng, i + 1);
    const tmp = out[i]; out[i] = out[j]; out[j] = tmp;
  }
  return out;
}
function rngPick(rng, arr){ return arr[rngInt(rng, arr.length)]; }
const GAME_SEED_BASE = CONFIG.gameId || 'flight';
const gameRng = makeRng(GAME_SEED_BASE + ':flight:flavor');
const firstBossHeckleLine = FIRST_BOSS_HECKLE || rngPick(gameRng, FIRST_BOSS_HECKLE_FALLBACKS);
const finalBossQuirkLine = FINAL_BOSS_QUIRK || rngPick(gameRng, FINAL_BOSS_QUIRK_FALLBACKS);

/* ======================================================================
   LEG PLAN -- terrain/duration/scroll-speed/gate-count are pure formulas
   of legIndex (never randomized), so the TOTAL gate count (needed for ONE
   TANK's distance-% score) is stable across leg retries -- only the
   per-gate DETAILS (gap heights, star slots, label rotation, boss lobs)
   are seeded per (legIndex, attempt), exactly as SPEC-flight.md's
   Determinism section lists them.
   ====================================================================== */
const SCROLL_BASE = 150, SCROLL_STEP = 7, SCROLL_MAX = 195;
const GATE_SPACING_START = 2.15, GATE_SPACING_FLOOR = 1.65, GATE_SPACING_STEP = 0.07;
const GAP_START = 240, GAP_FLOOR = 190;
function legScrollSpeed(legIndex){ return Math.min(SCROLL_MAX, SCROLL_BASE + legIndex * SCROLL_STEP); }
function legGateSpacingTime(legIndex){ return Math.max(GATE_SPACING_FLOOR, GATE_SPACING_START - legIndex * GATE_SPACING_STEP); }
function legDuration(legIndex){ return 32 + 4 * (legIndex % 3); } // 32/36/40s, cycling -- "~30-45s" per leg
function legGateCount(legIndex){ return Math.max(6, Math.round(legDuration(legIndex) / legGateSpacingTime(legIndex))); }
function legGapHeight(legIndex){
  if(LEGS_COUNT <= 1) return GAP_START;
  return Math.max(GAP_FLOOR, GAP_START - legIndex * ((GAP_START - GAP_FLOOR) / (LEGS_COUNT - 1)));
}
const BOSS_LEG_INDEX = JUDGE_CAST ? (Math.ceil(LEGS_COUNT / 2) - 1) : -1;
const TERRAIN_ORDER = LEG_TERRAIN_TABLE[LEGS_COUNT];
const LEGS = [];
for(let i = 0; i < LEGS_COUNT; i++){
  LEGS.push({
    index: i,
    terrain: TERRAIN_ORDER[i],
    beat: FLIGHT_BEATS[i],
    gateCount: legGateCount(i),
    scrollSpeed: legScrollSpeed(i),
    spacingTime: legGateSpacingTime(i),
    gapHeight: legGapHeight(i),
    isBossLeg: i === BOSS_LEG_INDEX,
  });
}
let TOTAL_GATES_ALL = 0;
for(const leg of LEGS) TOTAL_GATES_ALL += leg.gateCount;

/* ======================================================================
   ASSETS -- the Tappy Plane pack (assets/flight/, CC0, see assets/flight/
   CREDITS.txt for exactly which pieces and why) plus the same roster
   character sheets every template can draw a cast pick from.
   ====================================================================== */
const FLIGHT_IMG_FILES = {
  background:'background.png',
  groundGrass:'groundGrass.png', groundDirt:'groundDirt.png', groundRock:'groundRock.png', groundSnow:'groundSnow.png', groundIce:'groundIce.png',
  rock:'rock.png', rockDown:'rockDown.png',
  rockGrass:'rockGrass.png', rockGrassDown:'rockGrassDown.png',
  rockIce:'rockIce.png', rockIceDown:'rockIceDown.png',
  rockSnow:'rockSnow.png', rockSnowDown:'rockSnowDown.png',
  puffLarge:'puffLarge.png', puffSmall:'puffSmall.png',
  starGold:'starGold.png',
  medalBronze:'medalBronze.png', medalSilver:'medalSilver.png', medalGold:'medalGold.png',
  textGetReady:'textGetReady.png', textGameOver:'textGameOver.png',
  tap:'tap.png', tapLeft:'tapLeft.png', tapRight:'tapRight.png',
  planeYellow1:'planeYellow1.png', planeYellow2:'planeYellow2.png', planeYellow3:'planeYellow3.png',
  planeRed1:'planeRed1.png', planeRed2:'planeRed2.png', planeRed3:'planeRed3.png',
  planeBlue1:'planeBlue1.png', planeBlue2:'planeBlue2.png', planeBlue3:'planeBlue3.png',
  planeGreen1:'planeGreen1.png', planeGreen2:'planeGreen2.png', planeGreen3:'planeGreen3.png',
};
const FLIGHT_IMG = {};
let assetsSettledCount = 0;
let assetsReady = false;
const ROSTER_SHEET_IMAGES = {};
const ROSTER_SHEET_KEYS = (typeof ROSTER_SHEETS !== 'undefined') ? Object.keys(ROSTER_SHEETS) : [];
const ASSETS_TOTAL = Object.keys(FLIGHT_IMG_FILES).length + ROSTER_SHEET_KEYS.length;
function markAssetSettled(){ assetsSettledCount++; if(assetsSettledCount>=ASSETS_TOTAL) assetsReady = true; }
for(const key in FLIGHT_IMG_FILES){
  const img = new Image();
  img.src = ENGINE_ROOT + 'assets/flight/' + FLIGHT_IMG_FILES[key];
  img.onload = markAssetSettled; img.onerror = markAssetSettled;
  FLIGHT_IMG[key] = img;
}
for(const sheetKey of ROSTER_SHEET_KEYS){
  const img = new Image();
  img.src = ENGINE_ROOT + ROSTER_SHEETS[sheetKey].path;
  img.onload = markAssetSettled; img.onerror = markAssetSettled;
  ROSTER_SHEET_IMAGES[sheetKey] = img;
}
function sheetImage(sheetKey){ return ROSTER_SHEET_IMAGES[sheetKey] || ROSTER_SHEET_IMAGES.dungeon; }
function tileSrcX(col){ return col*TILE; }
function tileSrcY(row){ return row*TILE; }
const tintCache = new Map();
function rawTile(img, col, row){
  const key = img.src+'|raw|'+col+'|'+row;
  let c = tintCache.get(key);
  if(c) return c;
  const off = document.createElement('canvas');
  off.width = TILE; off.height = TILE;
  const o = off.getContext('2d');
  o.imageSmoothingEnabled = false;
  o.drawImage(img, tileSrcX(col), tileSrcY(row), TILE, TILE, 0, 0, TILE, TILE);
  if(img.complete && img.naturalWidth>0) tintCache.set(key, off);
  return off;
}
function drawRosterSprite(ctx, sheet, col, row, cx, cy, scale, flip){
  const tile = rawTile(sheetImage(sheet), col, row);
  const w = TILE*scale, h = TILE*scale;
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.translate(cx - (flip?w:0), cy);
  if(flip) ctx.scale(-1,1);
  ctx.drawImage(tile, 0, 0, w, h);
  ctx.restore();
}
/* generic scaled draw for a Tappy Plane pack piece, anchored by its CENTER
   (cx,cy) at a given display width (aspect-locked to the source). */
function drawPacked(ctx, img, cx, cy, dispW){
  if(!img.complete || !img.naturalWidth) return;
  const dispH = dispW * (img.naturalHeight/img.naturalWidth);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, cx-dispW/2, cy-dispH/2, dispW, dispH);
}
/* non-aspect-locked stretch -- used for the rock gate pairs, which have to
   fill whatever obstacle length a given seeded gap leaves (see drawGate). */
function drawStretched(ctx, img, x, y, w, h){
  if(!img.complete || !img.naturalWidth || h<=0) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, x, y, w, h);
}

/* ---------------- pixel primitives (see shared/framework.js's header --
   these stay duplicated per engine on purpose) ---------------- */
function drawBitmap(ctx, rows, colorMap, x, y, cell){
  for(let r=0;r<rows.length;r++){
    const row = rows[r];
    for(let c=0;c<row.length;c++){
      const ch = row[c];
      if(ch === '0' || ch === '.') continue;
      ctx.fillStyle = colorMap[ch];
      ctx.fillRect(Math.round(x+c*cell), Math.round(y+r*cell), cell, cell);
    }
  }
}
function drawSparkle(ctx, x, y, size, alpha, color){
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x-1), Math.round(y-size), 2, size*2);
  ctx.fillRect(Math.round(x-size), Math.round(y-1), size*2, 2);
  ctx.restore();
}
const SPARKLE_SIZES = [1,3,4,2];
function sparkleFrameSize(t, period){
  period = period || 0.4;
  const local = ((t % period) + period) % period;
  const frame = Math.min(3, Math.floor(local/(period/4)));
  return SPARKLE_SIZES[frame];
}

/* ---------------- procedural props NOT in the Tappy Plane pack (see
   assets/flight/CREDITS.txt) -- same drawBitmap-prop convention as gallery/
   engine.js's PLATE_ROWS/PLUSH_ROWS. ---------------- */
const HEART_ROWS = ['.11.11.', '1111111', '1111111', '.11111.', '..111..', '...1...'];
function drawHeart(ctx, x, y, cell, full){
  drawBitmap(ctx, HEART_ROWS, { '1': full ? PAL.heartFull : PAL.heartEmpty }, x, y, cell);
}
const PHONE_ROWS = ['111111', '122221', '122221', '122221', '122221', '122221', '122221', '111111'];
const PHONE_COLORS = { '1':PAL.ink, '2':PAL.phoneScreen };
function drawPhone(ctx, x, y, cell){ drawBitmap(ctx, PHONE_ROWS, PHONE_COLORS, x, y, cell); }
const LOB_ROWS = ['.11.', '1111', '1111', '.11.'];
function drawLobObject(ctx, x, y, cell, color){ drawBitmap(ctx, LOB_ROWS, {'1':color}, x, y, cell); }

/* ======================================================================
   AUDIO -- reuses shared/framework.js's makeBufferBank/playSample/twang/
   ducking/volume UI/SpeechSynthesis wrapper; this block is this engine's
   own content (SFX list + wrappers + music-loop defs), same convention as
   gallery/engine.js. Every SFX file below already ships in assets/audio/
   sfx/ -- no new audio assets were needed for this template (see assets/
   flight/CREDITS.txt).
   ====================================================================== */
let volumeSetting = loadVolumeSetting();
let volumeBeforeMute = volumeSetting>0 ? volumeSetting : 0.25;

const USE_CUSTOM_SONG = !!(CONFIG.music && CONFIG.music.customSongPath);
const MUSIC_TRACK_SRC = CONFIG.music && CONFIG.music.customSongPath;
let useMp3Music = false, bgmGraceUntil = 0;
let bgmRawBytes = null, bgmBuffer = null, bgmSourceNode = null;
let bgmFetchState = 'idle';
function prefetchMusic(){
  if(bgmFetchState !== 'idle') return;
  bgmFetchState = 'loading';
  fetch(MUSIC_TRACK_SRC)
    .then(r=>{ if(!r.ok) throw new Error('http '+r.status); return r.arrayBuffer(); })
    .then(bytes=>{ bgmRawBytes = bytes; bgmFetchState = 'fetched'; tryDecodeMusic(); })
    .catch(()=>{ bgmFetchState = 'failed'; });
}
function tryDecodeMusic(){
  if(!actx || !bgmRawBytes || bgmFetchState !== 'fetched') return;
  bgmFetchState = 'decoding';
  const bytes = bgmRawBytes; bgmRawBytes = null;
  try{
    actx.decodeAudioData(bytes,
      (decoded)=>{ bgmBuffer = decoded; bgmFetchState = 'ready'; tryStartMusic(); },
      ()=>{ bgmFetchState = 'failed'; });
  } catch(err){ bgmFetchState = 'failed'; }
}
function tryStartMusic(){
  if(useMp3Music || !actx || !bgmBuffer) return;
  if(actx.state !== 'running') return;
  try{
    bgmSourceNode = actx.createBufferSource();
    bgmSourceNode.buffer = bgmBuffer;
    bgmSourceNode.loop = true;
    bgmSourceNode.connect(musicGain);
    bgmSourceNode.start();
    useMp3Music = true;
  } catch(err){ /* the loop score keeps covering */ }
}
if(USE_CUSTOM_SONG) prefetchMusic();

/* every one of the 16 files in assets/audio/sfx/ gets a job here (The
   Gallery left close_002.ogg unused -- this template gives it to the
   BUTTERFINGERS phone-drop gag). */
const SFX_DEFS = {
  flap:          { src:ENGINE_ROOT+'assets/audio/sfx/woosh3.ogg',                gain:0.5 }, // wing flap
  impact:        { src:ENGINE_ROOT+'assets/audio/sfx/impactSoft_medium_002.ogg', gain:0.7 }, // crash / lose a heart
  starPickup:    { src:ENGINE_ROOT+'assets/audio/sfx/confirmation_001.ogg',      gain:0.6 }, // star collected
  legClear:      { src:ENGINE_ROOT+'assets/audio/sfx/confirmation_004.ogg',      gain:0.6 }, // leg boundary reached
  shoutCharge:   { src:ENGINE_ROOT+'assets/audio/sfx/jingles-hit_02.ogg',        gain:0.7 }, // THE SHOUT charged
  shoutSlam:     { src:ENGINE_ROOT+'assets/audio/sfx/impactWood_heavy_002.ogg',  gain:0.9 }, // THE SHOUT fires
  rockCrumble:   { src:ENGINE_ROOT+'assets/audio/sfx/impactGlass_heavy_001.ogg', gain:0.7 }, // rocks crumble to puffs
  landing:       { src:ENGINE_ROOT+'assets/audio/sfx/jingles-hit_10.ogg',        gain:0.8 }, // landing fanfare
  medalChime:    { src:ENGINE_ROOT+'assets/audio/sfx/jingles-hit_03.ogg',        gain:0.7 }, // end-card medal reveal
  saviorChime:   { src:ENGINE_ROOT+'assets/audio/sfx/select_006.ogg',            gain:0.6 }, // THE SAVIOR's save
  stall:         { src:ENGINE_ROOT+'assets/audio/sfx/minimize_006.ogg',          gain:0.6 }, // out of hearts / stall stinger
  groan:         { src:ENGINE_ROOT+'assets/audio/sfx/error_003.ogg',             gain:0.6 }, // miss / crash groan
  bossRumble:    { src:ENGINE_ROOT+'assets/audio/sfx/stoneDrag2.ogg',            gain:0.6 }, // boss plane entrance
  keyBlip:       { src:ENGINE_ROOT+'assets/audio/sfx/tick_001.ogg',              gain:0.4 }, // typewriter text blip
  phoneDrop:     { src:ENGINE_ROOT+'assets/audio/sfx/close_002.ogg',             gain:0.5 }, // BUTTERFINGERS gag
  scratch:       { src:ENGINE_ROOT+'assets/audio/sfx/scratch_002.ogg',           gain:0.7 }, // THE FINAL BOSS's entrance
};
const sfxLoader = makeBufferBank(SFX_DEFS);
function tryDecodeAllSamples(){ sfxLoader.tryDecodeAll(); }
sfxLoader.prefetchAll();
function playFlap(t){ playSample('flap', t); }
function playImpact(t){ playSample('impact', t); }
function playStarPickup(t){ playSample('starPickup', t); }
function playLegClear(t){ playSample('legClear', t); }
function playShoutCharge(t){ playSample('shoutCharge', t); }
function playShoutSlam(t){ playSample('shoutSlam', t); playTwang(t+0.9, 0.8); }
function playRockCrumble(t){ playSample('rockCrumble', t); }
function playLanding(t){ playSample('landing', t); }
function playMedalChime(t){ playSample('medalChime', t); }
function playSaviorChime(t){ playSample('saviorChime', t); }
function playStall(t){ playSample('stall', t); }
function playGroan(t){ playSample('groan', t); }
function playBossRumble(t){ playSample('bossRumble', t); }
function playKeyBlip(t){ playSample('keyBlip', t); }
// shared/framework.js's updateTypewriterAudio calls playBeep (a shared
// no-op stub, defined there) + playDing directly as ordinary globals at
// call time -- every engine that uses it must supply its own playDing
// (see gallery/engine.js's identical wrapper). Reuses the keyBlip sample.
function playDing(t){ playKeyBlip(t); }
function playPhoneDrop(t){ playSample('phoneDrop', t); }
function playScratch(t){ playSample('scratch', t); }

/* Phase M mapping (see SPEC-flight.md "Music"): title/get-ready/legs1-2 =
   dinner slot; later legs = chase; the breather before THE FINAL BOSS =
   sad; boss gate = boss; landing/celebration/win end card = celebration;
   stall/retry card = gameover. */
const MUSIC_LOOP_DEFS = {};
for(const key in (CONFIG.music && CONFIG.music.loops || {})) MUSIC_LOOP_DEFS[key] = { src: CONFIG.music.loops[key] };
const loopLoader = makeBufferBank(MUSIC_LOOP_DEFS);
function tryDecodeAllLoops(){ loopLoader.tryDecodeAll(); }
loopLoader.prefetchAll();
setBeatMusic('dinner'); // seeded at boot -- a template that forgets this plays silence

function ensureAudioStarted(){
  if(!actx){
    initAudio();
    setBeatMusic('dinner');
    bgmGraceUntil = performance.now() + 3000;
    tryDecodeMusic();
  }
  if(actx.state==='suspended' && actx.resume){
    const p = actx.resume();
    if(p && typeof p.then==='function') p.then(tryStartMusic);
  }
  tryStartMusic();
}
function sayPunchline(){ speakLine(CONFIG.punchline, 0.85, 0.7); }

/* ======================================================================
   PHYSICS / LAYOUT CONSTANTS
   ====================================================================== */
const GROUND_H = 64, GROUND_Y = CH - GROUND_H;
const GAP_RNG_TOP = 40, GAP_RNG_MARGIN = 20; // keeps gap centers off the very top/ground edges
const PLANE_X = 210, PLANE_R = 20;
const PLANE_DISPLAY_W = 60, PLANE_DISPLAY_H = PLANE_DISPLAY_W * (73/88);
const GRAVITY = 1000, FLAP_VY = -310, MAX_FALL_VY = 480;
const GATE_ROCK_W = 68;
const STAR_R = 18, STAR_CHANCE = 0.4;
const SHOUT_PREDICT_DT = 0.25, STAR_CHARGE_NEEDED = 3;
const CRASH_INVULN = 1.5, SAVIOR_INVULN = 1.5;
const SLOWMO_SCALE = 0.35, SLOWMO_DURATION = 1.1;
const MODE_BREATHER_TIME = { full: 4.0, onetank: 2.0 };
const BOSS_X = CW - 170, BOSS_Y = 130, LOB_COUNT = 4, LOB_R = 12;
const FINAL_BOSS_CENTER_Y = 260, FINAL_BOSS_AMP = 130, FINAL_BOSS_PERIOD = 2.2, FINAL_BOSS_CYCLES = 4;
const FINAL_BOSS_R = 46, FINAL_BOSS_X = PLANE_X + 150;

/* ======================================================================
   GAME STATE
   ====================================================================== */
let gameT = 0;
let timeScale = 1; // slow-mo during THE SHOUT
let slowMoTimer = 0;
let phase = 'title';
let phaseElapsed = 0;
let phaseData = {};
let gpAPrev = false;

let currentMode = 'full'; // 'full' | 'onetank'
let hearts = 3;
let invulnUntil = 0;

let player = { y: CH/2, vy: 0 };
let bgScrollX = 0, groundScrollX = 0;

let activeGates = [];    // this leg's gate schedule (see buildLegSchedule)
let activeLobs = [];     // THE FIRST BOSS's thrown objects, this leg only
let legGatesClearedBase = 0;      // gates cleared in all PREVIOUSLY completed legs
let gatesClearedInLegAttempt = 0; // gates cleared in the current leg's current attempt
let legReached = new Array(LEGS_COUNT).fill(false);
let butterfingersGagShown = false;
let butterfingersPhone = null; // {x,y,vy,born} while tumbling, else null

let starsCollectedThisRun = 0;
let shoutUsedThisRun = false;
let shoutFiredAt = -1;
let shoutChargeAnnounced = false;
let saviorUsedThisRun = false;
let crashesThisRun = 0;

let flightPuffs = []; // local image-based particles (see spawnPuff) -- the
                       // shared particles[] array (shared/framework.js)
                       // has no image-sprite particle type, only the
                       // procedural ones (sparkle/shard/ha/starrow)

let screenShakeUntil = 0, screenShakeMag = 0;
function triggerShake(mag, dur){ screenShakeUntil = gameT+dur; screenShakeMag = mag; }
let bannerText = null, bannerSub = null, bannerUntil = 0;
function showBanner(text, sub, dur){ bannerText = text; bannerSub = sub||null; bannerUntil = gameT + (dur===undefined?1.6:dur); }

/* ---------------- tutorial/stall cards -- see shared/framework.js's card
   system. CARDS.stallretry's body is rewritten per-attempt just before
   showing it (see enterStallRetry), same deliberate bypass of
   maybeShowCard's one-shot guard gallery/engine.js's showRetryCard uses --
   a retry can legitimately show more than once. ---------------- */
const CARDS = {
  stallretry: { key:'stallretry', title:'THE TRIP STALLS', body:['NOT QUITE.', 'ONE MORE GO.'] },
};

/* ======================================================================
   ONE TANK unlock / best-% persistence (see SPEC-flight.md "Modes")
   ====================================================================== */
function oneTankUnlocked(){ try{ return localStorage.getItem(skey('oneTankUnlocked'))==='1'; }catch(e){ return false; } }
function markOneTankUnlocked(){ try{ localStorage.setItem(skey('oneTankUnlocked'), '1'); }catch(e){} }
function oneTankBestPct(){ try{ const v = parseFloat(localStorage.getItem(skey('oneTankBestPct'))||'0'); return isFinite(v)?v:0; }catch(e){ return 0; } }
function updateOneTankBest(pct){ try{ if(pct > oneTankBestPct()) localStorage.setItem(skey('oneTankBestPct'), String(pct)); }catch(e){} }

/* ======================================================================
   LEG SCHEDULE -- deterministic per (legIndex, attempt): gate gap centers,
   star slots, hazard-label rotation, and (boss leg only) thrown-object
   lobs. Seed matches SPEC-flight.md's Determinism section exactly:
   `<gameId>:flight:leg:<index>:<attempt>`.
   ====================================================================== */
function buildLegSchedule(legIndex, attempt){
  const leg = LEGS[legIndex];
  const rng = makeRng(GAME_SEED_BASE + ':flight:leg:' + legIndex + ':' + attempt);
  const hazardOrder = rngShuffled(rng, FLIGHT_HAZARDS);
  const gates = [];
  const gapHalf = leg.gapHeight/2;
  const spacingX = leg.scrollSpeed * leg.spacingTime;
  let x = CW + 260;
  for(let i=0; i<leg.gateCount; i++){
    const gapCenterY = rngRange(rng, GAP_RNG_TOP+gapHalf+GAP_RNG_MARGIN, GROUND_Y-gapHalf-GAP_RNG_MARGIN);
    gates.push({
      id: legIndex+'_'+attempt+'_'+i,
      x, gapCenterY, gapHalf,
      label: hazardOrder[i % hazardOrder.length],
      hasStar: rng() < STAR_CHANCE, starTaken:false,
      passed: false,
    });
    x += spacingX * rngRange(rng, 0.9, 1.1);
  }
  const lobs = [];
  if(leg.isBossLeg){
    const dur = legDuration(legIndex);
    for(let i=0;i<LOB_COUNT;i++){
      lobs.push({
        t: dur*(i+1)/(LOB_COUNT+1) + rngRange(rng, -0.6, 0.6), // spread through the leg, seeded jitter
        vy0: rngRange(rng, -70, 30),
        spawned: false,
      });
    }
  }
  return { gates, lobs };
}

/* ======================================================================
   COLLISION -- one shared test used for real-time AND THE SHOUT's
   predicted-impact check (see fireAt-equivalent below), same "one entry
   point a future harness can drive" principle as gallery/engine.js's
   fireAt.
   ====================================================================== */
function gateHits(px, py, gate, xOffset){
  const gx = gate.x + (xOffset||0);
  const halfW = GATE_ROCK_W/2;
  if(px+PLANE_R < gx-halfW || px-PLANE_R > gx+halfW) return false;
  const gapTop = gate.gapCenterY - gate.gapHalf, gapBottom = gate.gapCenterY + gate.gapHalf;
  return (py-PLANE_R < gapTop) || (py+PLANE_R > gapBottom);
}
function predictedImminentGateCollision(){
  if(!activeGates.length) return false;
  const dt = SHOUT_PREDICT_DT;
  const predY = Math.min(GROUND_Y, player.y + player.vy*dt + 0.5*GRAVITY*dt*dt);
  const scrollShift = -legForPhase().scrollSpeed*dt;
  for(const g of activeGates){
    if(g.passed) continue;
    if(gateHits(PLANE_X, predY, g, scrollShift)) return true;
  }
  return false;
}
function legForPhase(){ return LEGS[phaseData.legIndex !== undefined ? phaseData.legIndex : 0]; }

/* ======================================================================
   CRASH HANDLING -- one function every hazard type (gate, thrown object,
   ground, THE FINAL BOSS's sweep) routes through, so THE SAVIOR's once-
   per-run save and the FULL-TRIP-vs-ONE-TANK branch never has to be
   duplicated per hazard.
   ====================================================================== */
function puffAwayNearbyGates(){
  for(const g of activeGates){
    if(!g.passed && g.x < PLANE_X+400){
      g.passed = true; gatesClearedInLegAttempt++;
      spawnPuff(g.x, g.gapCenterY, true);
    }
  }
  activeLobs = activeLobs.filter(o => !(o.x > PLANE_X-60 && o.x < PLANE_X+400));
}
function handleCrash(){
  if(gameT < invulnUntil) return; // already invulnerable -- ignore repeat hits this window
  if(SAVIOR_CAST && !saviorUsedThisRun){
    saviorUsedThisRun = true;
    invulnUntil = gameT + SAVIOR_INVULN;
    if(actx) playSaviorChime(actx.currentTime);
    showBanner(fmt(CAST.savior.name).toUpperCase()+' SHOWED UP.', null, 2.2);
    puffAwayNearbyGates();
    return;
  }
  crashesThisRun++;
  if(currentMode === 'onetank'){
    endRunStalled();
    return;
  }
  hearts--;
  if(actx) playImpact(actx.currentTime);
  if(actx) playGroan(actx.currentTime+0.05);
  triggerShake(6, 0.3);
  if(hearts<=0){
    enterStallRetry();
    return;
  }
  invulnUntil = gameT + CRASH_INVULN;
  puffAwayNearbyGates();
}

/* ======================================================================
   THE SHOUT -- charged by 3 stars, once per run. Auto-fires the moment a
   collision is imminent (deterministic prediction, no manual trigger --
   "one-button purity: no second input exists", SPEC-flight.md).
   ====================================================================== */
function collectStar(gate){
  gate.starTaken = true;
  starsCollectedThisRun++;
  if(actx) playStarPickup(actx.currentTime);
  spawnPuff(gate.x, gate.gapCenterY, false);
  if(starsCollectedThisRun >= STAR_CHARGE_NEEDED && !shoutUsedThisRun && !shoutChargeAnnounced){
    shoutChargeAnnounced = true;
    if(actx) playShoutCharge(actx.currentTime);
  }
}
function shoutCharged(){ return starsCollectedThisRun >= STAR_CHARGE_NEEDED && !shoutUsedThisRun; }
function fireShout(){
  shoutUsedThisRun = true;
  shoutFiredAt = gameT;
  if(actx){ playShoutSlam(actx.currentTime); playRockCrumble(actx.currentTime+0.05); }
  sayPunchline();
  triggerShake(10, 0.5);
  timeScale = SLOWMO_SCALE; slowMoTimer = SLOWMO_DURATION;
  showBanner(CONFIG.punchline, null, 1.8);
  for(const g of activeGates){
    if(!g.passed){
      g.passed = true; gatesClearedInLegAttempt++;
      spawnPuff(g.x, g.gapCenterY - g.gapHalf - 30, true);
      spawnPuff(g.x, g.gapCenterY + g.gapHalf + 30, true);
    }
  }
}

/* ======================================================================
   PARTICLES (local, image-based -- see flightPuffs's own comment above)
   ====================================================================== */
function spawnPuff(cx, cy, big){
  const n = big ? 3 : 1;
  for(let i=0;i<n;i++){
    flightPuffs.push({
      x: cx + rngRange(gameRng, -18, 18), y: cy + rngRange(gameRng, -14, 14),
      vx: rngRange(gameRng, -30, 30), vy: rngRange(gameRng, -50, -10),
      big: big, born: gameT, life: 0.6,
    });
  }
}
function updateAndDrawFlightPuffs(ctx, dt){
  for(const p of flightPuffs){
    const age = gameT - p.born;
    if(age > p.life) continue;
    const a = 1 - age/p.life;
    const img = p.big ? FLIGHT_IMG.puffLarge : FLIGHT_IMG.puffSmall;
    ctx.save(); ctx.globalAlpha = Math.max(0,a);
    drawPacked(ctx, img, p.x+p.vx*age, p.y+p.vy*age, p.big?40:24);
    ctx.restore();
  }
  flightPuffs = flightPuffs.filter(p => (gameT-p.born) <= p.life);
}

/* ======================================================================
   PHASES -- title / modeselect / getready / flying / breather / finalboss
   / landing / celebration / endcard.
   ====================================================================== */
function resetRunState(){
  hearts = 3; invulnUntil = 0;
  player.y = CH/2; player.vy = 0;
  activeGates = []; activeLobs = [];
  legGatesClearedBase = 0; gatesClearedInLegAttempt = 0;
  legReached = new Array(LEGS_COUNT).fill(false);
  butterfingersGagShown = false; butterfingersPhone = null;
  starsCollectedThisRun = 0; shoutUsedThisRun = false; shoutFiredAt = -1; shoutChargeAnnounced = false;
  saviorUsedThisRun = false; crashesThisRun = 0;
  flightPuffs = []; timeScale = 1; slowMoTimer = 0;
  bgScrollX = 0; groundScrollX = 0;
}

let modeSelectIndex = 0;
function enterTitle(){
  phase = 'title'; phaseElapsed = 0; phaseData = {};
  setBeatMusic('dinner');
}
function enterModeSelect(){
  phase = 'modeselect'; phaseElapsed = 0; phaseData = {};
  modeSelectIndex = 0;
}
function enterGetReady(mode){
  currentMode = mode || 'full';
  resetRunState();
  phase = 'getready'; phaseElapsed = 0; phaseData = {};
  setBeatMusic('dinner');
}
function enterLeg(legIndex, attempt){
  const leg = LEGS[legIndex];
  const sched = buildLegSchedule(legIndex, attempt);
  activeGates = sched.gates; activeLobs = [];
  gatesClearedInLegAttempt = 0;
  legReached[legIndex] = true;
  hearts = 3; // "hearts refill each leg" -- FULL TRIP only meaningfully, harmless in ONE TANK (no hearts drawn there)
  invulnUntil = gameT + 0.4; // brief grace right after a leg boundary
  phase = 'flying'; phaseElapsed = 0;
  phaseData = { legIndex, attempt, isBossLeg: leg.isBossLeg, lobSchedule: sched.lobs, awaitingRetry:false };
  setBeatMusic(legIndex <= 1 ? 'dinner' : 'chase');
  if(leg.isBossLeg && actx) playBossRumble(actx.currentTime);
}
function wrapBeatLine(text, maxChars){
  maxChars = maxChars || 42;
  const words = String(text).split(' ');
  const lines = []; let cur = '';
  for(const w of words){
    const cand = cur ? cur+' '+w : w;
    if(cand.length > maxChars && cur){ lines.push(cur); cur = w; } else cur = cand;
  }
  if(cur) lines.push(cur);
  return lines.length ? lines.slice(0,3) : [''];
}
function enterBreather(fromLegIndex, toLegIndex){
  legGatesClearedBase += LEGS[fromLegIndex].gateCount; // this leg is fully accounted for now
  gatesClearedInLegAttempt = 0; // ...and folded in above, so the per-attempt counter starts clean (enterLeg also resets this once toLegIndex actually starts, but this keeps the running total correct for the breather itself, e.g. its live HUD/pct reads)
  if(actx) playLegClear(actx.currentTime);
  const bossIntro = JUDGE_CAST && toLegIndex === BOSS_LEG_INDEX;
  const gag = BUTTERFINGERS_CAST && toLegIndex === 1 && !butterfingersGagShown;
  const lines = wrapBeatLine(FLIGHT_BEATS[toLegIndex]);
  phase = 'breather'; phaseElapsed = 0;
  phaseData = {
    fromLegIndex, toLegIndex, finalApproach:false, bossIntro, gag,
    tw: makeTypewriter(lines, 22, 0.35),
    duration: 0, // computed below once tw exists
  };
  phaseData.duration = Math.max(MODE_BREATHER_TIME[currentMode], phaseData.tw.doneAt + 0.5);
  if(gag){ butterfingersGagShown = true; butterfingersPhone = { x: CW*0.5, y: -30, vy: 40, born: gameT }; if(actx) playPhoneDrop(actx.currentTime+0.3); }
  setBeatMusic(toLegIndex <= 1 ? 'dinner' : 'chase');
}
function enterFinalApproachBreather(){
  legGatesClearedBase += LEGS[LEGS_COUNT-1].gateCount;
  gatesClearedInLegAttempt = 0; // no enterLeg() follows this breather to reset it (next stop is finalboss/landing, not another leg) -- see enterBreather's identical reset for why this must happen here too
  if(actx) playLegClear(actx.currentTime);
  const lines = ['COMING IN FOR THE LANDING...'];
  phase = 'breather'; phaseElapsed = 0;
  phaseData = {
    fromLegIndex: LEGS_COUNT-1, toLegIndex: LEGS_COUNT-1, finalApproach:true, bossIntro:false, gag:false,
    tw: makeTypewriter(lines, 22, 0.35), duration: 0,
  };
  phaseData.duration = Math.max(MODE_BREATHER_TIME[currentMode], phaseData.tw.doneAt + 0.5);
  setBeatMusic('sad');
}
function updateBreather(dt){
  bgScrollX += 30*dt; groundScrollX += 60*dt;
  player.y += (CH*0.42 - player.y) * Math.min(1, dt*3); // ease to a calm cruise altitude
  if(butterfingersPhone){
    butterfingersPhone.vy += 260*dt;
    butterfingersPhone.y += butterfingersPhone.vy*dt;
    if(butterfingersPhone.y > CH+40) butterfingersPhone = null;
  }
  updateTypewriterAudio(phaseData.tw, phaseElapsed); // per-character playBeep (no-op stub) + per-line playDing, both framework-called globals
  if(phaseElapsed >= phaseData.duration){
    if(phaseData.finalApproach){
      if(AUTHORITY_CAST) enterFinalBoss(1); else enterLanding(false);
    } else {
      enterLeg(phaseData.toLegIndex, 1);
    }
  }
}
function enterStallRetry(){
  setBeatMusic('gameover');
  if(actx) playStall(actx.currentTime);
  phaseData.awaitingRetry = true;
  CARDS.stallretry.body = ['THE TRIP STALLS.', 'ONE MORE GO.'];
  activeCard = CARDS.stallretry;
  cardT = 0;
}
function updateFlying(dt){
  if(phaseData.awaitingRetry){
    if(!activeCard){
      phaseData.awaitingRetry = false;
      phaseData.attempt++;
      enterLeg(phaseData.legIndex, phaseData.attempt);
    }
    return;
  }
  const leg = LEGS[phaseData.legIndex];
  // THE SHOUT -- deterministic imminent-collision prediction, checked
  // BEFORE the real collision test below so it preempts the actual hit.
  if(shoutCharged() && predictedImminentGateCollision()) fireShout();

  player.vy = Math.min(MAX_FALL_VY, player.vy + GRAVITY*dt);
  player.y += player.vy*dt;
  if(player.y - PLANE_R < 0){ player.y = PLANE_R; player.vy = Math.max(0, player.vy); }
  bgScrollX += leg.scrollSpeed*0.4*dt; groundScrollX += leg.scrollSpeed*dt;

  for(const g of activeGates) g.x -= leg.scrollSpeed*dt;
  // THE FIRST BOSS's thrown objects -- spawn as their seeded trigger time
  // (relative to this leg attempt's own start, i.e. phaseElapsed) arrives.
  if(phaseData.isBossLeg && phaseData.lobSchedule){
    for(const l of phaseData.lobSchedule){
      if(!l.spawned && phaseElapsed >= l.t){
        l.spawned = true;
        activeLobs.push({ x: BOSS_X, y: BOSS_Y, vx: -(leg.scrollSpeed+50), vy: l.vy0, hit:false });
      }
    }
  }
  for(const o of activeLobs){ o.vy += 500*dt; o.x += o.vx*dt; o.y += o.vy*dt; }
  activeLobs = activeLobs.filter(o => !o.hit && o.x > -60 && o.y < CH+60);

  const groundHit = player.y + PLANE_R >= GROUND_Y;
  if(groundHit){ player.y = GROUND_Y - PLANE_R; handleCrash(); }

  for(const g of activeGates){
    if(g.passed) continue;
    if(g.hasStar && !g.starTaken){
      const dx = PLANE_X - g.x, dy = player.y - g.gapCenterY;
      if(Math.hypot(dx,dy) < PLANE_R+STAR_R) collectStar(g);
    }
    if(gameT >= invulnUntil && gateHits(PLANE_X, player.y, g, 0)){ handleCrash(); }
    if(g.x + GATE_ROCK_W/2 < PLANE_X && !g.passed){ g.passed = true; gatesClearedInLegAttempt++; }
  }
  for(const o of activeLobs){
    if(o.hit) continue;
    if(gameT >= invulnUntil && Math.hypot(PLANE_X-o.x, player.y-o.y) < PLANE_R+LOB_R){ o.hit = true; handleCrash(); }
  }
  activeGates = activeGates.filter(g => g.x > -200);

  if(gatesClearedInLegAttempt >= leg.gateCount){
    if(phaseData.legIndex === LEGS_COUNT-1) enterFinalApproachBreather();
    else enterBreather(phaseData.legIndex, phaseData.legIndex+1);
  }
}
function enterFinalBoss(attempt){
  const rng = makeRng(GAME_SEED_BASE + ':flight:bossgate:' + attempt);
  phase = 'finalboss'; phaseElapsed = 0;
  phaseData = {
    attempt, stage:'intro', startPhase: rng()*Math.PI*2, ampJitter: 1 + (rng()-0.5)*0.15,
    sweepStartT: 0, awaitingRetry:false,
  };
  setBeatMusic('boss');
  hearts = 3;
  if(actx) playScratch(actx.currentTime);
  showBanner((AUTHORITY_CAST?fmt(CAST.authority.name).toUpperCase():'THE AUTHORITY')+' STORMS IN.', finalBossQuirkLine, 2.4);
}
function finalBossY(t){
  return FINAL_BOSS_CENTER_Y + FINAL_BOSS_AMP*phaseData.ampJitter*Math.sin(phaseData.startPhase + (2*Math.PI*t)/FINAL_BOSS_PERIOD);
}
function updateFinalBoss(dt){
  if(phaseData.awaitingRetry){
    if(!activeCard){ phaseData.awaitingRetry = false; enterFinalBoss(phaseData.attempt+1); }
    return;
  }
  groundScrollX += 40*dt; bgScrollX += 16*dt;
  // gravity/flap always applies (even during the intro banner and the win
  // beat) so the plane never looks frozen mid-air
  player.vy = Math.min(MAX_FALL_VY, player.vy + GRAVITY*dt);
  player.y += player.vy*dt;
  player.y = Math.max(PLANE_R, Math.min(GROUND_Y-PLANE_R, player.y));
  if(phaseData.stage === 'intro'){
    if(phaseElapsed >= 2.0){ phaseData.stage = 'live'; phaseData.sweepStartT = gameT; }
    return;
  }
  if(phaseData.stage === 'win'){
    if(gameT >= phaseData.winUntil) enterLanding(true);
    return;
  }
  // stage === 'live'
  const t = gameT - phaseData.sweepStartT;
  const by = finalBossY(t);
  if(gameT >= invulnUntil && Math.abs(player.y - by) < PLANE_R+FINAL_BOSS_R){
    handleCrash();
  }
  if(t >= FINAL_BOSS_CYCLES*FINAL_BOSS_PERIOD){
    phaseData.stage = 'win';
    if(actx) playLanding(actx.currentTime);
    showBanner((AUTHORITY_CAST?fmt(CAST.authority.name).toUpperCase():'THE AUTHORITY')+' PEELS OFF.', null, 1.8);
    phaseData.winUntil = gameT + 1.8;
  }
}
function enterLanding(turnGood){
  phase = 'landing'; phaseElapsed = 0;
  phaseData = { turnGood: !!turnGood, startY: player.y };
  setBeatMusic('celebration');
}
const LANDING_DURATION = 3.0;
function updateLanding(dt){
  groundScrollX += Math.max(0, 60*(1 - phaseElapsed/LANDING_DURATION))*dt;
  const p = Math.min(1, phaseElapsed/LANDING_DURATION);
  player.y = phaseData.startY + (GROUND_Y - PLANE_R - 6 - phaseData.startY)*p;
  if(phaseElapsed >= LANDING_DURATION) enterCelebration();
}
function enterCelebration(){
  phase = 'celebration'; phaseElapsed = 0; phaseData = {};
  setBeatMusic('celebration');
  if(actx){ playLanding(actx.currentTime); playMedalChime(actx.currentTime+0.4); }
  sayPunchline();
  showBanner(CONFIG.punchline, null, 2.4);
  spawnSparkleBurst(CW/2, 220, 20, gameT);
  markOneTankUnlocked();
  if(currentMode === 'onetank') updateOneTankBest(100);
}
function updateCelebration(dt){
  if(phaseElapsed >= 2.8) enterEndcard();
}
function computeMedalAndRank(landed, stalled){
  if(stalled) return { medal:'bronze', rank: CONFIG.rankNames.worst };
  if(landed && crashesThisRun === 0) return { medal:'gold', rank: CONFIG.rankNames.immaculate };
  return { medal:'silver', rank: CONFIG.rankNames.comicTiming };
}
function distancePctNow(){
  return Math.max(0, Math.min(100, Math.round(100*(legGatesClearedBase+gatesClearedInLegAttempt)/TOTAL_GATES_ALL)));
}
function endRunStalled(){
  const pct = distancePctNow();
  updateOneTankBest(pct);
  if(actx) playStall(actx.currentTime);
  setBeatMusic('gameover');
  triggerShake(6, 0.3);
  const mr = computeMedalAndRank(false, true);
  phase = 'endcard'; phaseElapsed = 0;
  phaseData = { landed:false, stalled:true, distancePct: pct, rank: mr.rank, medal: mr.medal };
}
function enterEndcard(){
  const mr = computeMedalAndRank(true, false);
  phase = 'endcard'; phaseElapsed = 0;
  phaseData = { landed:true, stalled:false, distancePct:100, rank: mr.rank, medal: mr.medal };
  setBeatMusic('gameover');
}
function resetGame(){
  cardsShown.stallretry = false;
  activeCard = null;
  phase = 'title'; phaseElapsed = 0; phaseData = {};
}

/* ======================================================================
   UPDATE / ACTION DISPATCH
   ====================================================================== */
function update(dt){
  phaseElapsed += dt;
  if(phase==='title'){ /* attract screen -- nothing to simulate */ }
  else if(phase==='modeselect'){ /* waits for input */ }
  else if(phase==='getready'){ player.y = CH/2 + Math.sin(gameT*2)*6; }
  else if(phase==='flying') updateFlying(dt);
  else if(phase==='breather') updateBreather(dt);
  else if(phase==='finalboss') updateFinalBoss(dt);
  else if(phase==='landing') updateLanding(dt);
  else if(phase==='celebration') updateCelebration(dt);
  else if(phase==='endcard'){ /* waits for input */ }
}
/* the ONE gameplay input -- flap. Menus/cards reuse the same physical
   button contextually via handleAction (below), same split gallery/
   engine.js draws between fireAt (aim/shoot) and handleAction (menus/
   cards) -- THE SHOUT itself still has no manual trigger of its own (see
   fireShout, called only from the deterministic prediction in
   updateFlying), so the one-button invariant for gameplay holds. */
function flap(){
  if(phase==='flying' || phase==='finalboss'){
    player.vy = FLAP_VY;
    if(actx) playFlap(actx.currentTime);
  }
}
function confirmModeSelect(){
  enterGetReady(modeSelectIndex===0 ? 'full' : 'onetank');
}
function handleAction(){
  if(activeCard){ activeCard = null; return; }
  if(phase==='title'){
    ensureAudioStarted();
    if(oneTankUnlocked()) enterModeSelect(); else enterGetReady('full');
    return;
  }
  if(phase==='modeselect'){ confirmModeSelect(); return; }
  if(phase==='getready'){ enterLeg(0,1); flap(); return; }
  if(phase==='flying' || phase==='finalboss'){ flap(); return; }
  if(phase==='endcard'){ resetGame(); return; }
}
function pollGamepadFlap(){
  if(rotatePromptActive) return;
  if(!navigator.getGamepads) return;
  let pads = [];
  try{ pads = navigator.getGamepads(); }catch(e){ return; }
  let pressed = false;
  for(const gp of pads){ if(gp && gp.buttons[0] && gp.buttons[0].pressed) pressed = true; }
  if(pressed && !gpAPrev) handleAction();
  gpAPrev = pressed;
}

/* ======================================================================
   DRAW -- backdrop
   ====================================================================== */
function currentTerrainKey(){
  if(phase==='flying' || (phase==='breather' && !phaseData.finalApproach)) return LEGS[phaseData.legIndex !== undefined ? phaseData.legIndex : (phaseData.toLegIndex||0)].terrain;
  return LEGS[LEGS_COUNT-1].terrain;
}
function hexToRgb(hex){ const n = parseInt(hex.slice(1),16); return [ (n>>16)&255, (n>>8)&255, n&255 ]; }
function lerpColor(hexA, hexB, mix){
  if(!hexA) hexA = '#7fb8e6'; if(!hexB) hexB='#7fb8e6';
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  const r = Math.round(a[0]+(b[0]-a[0])*mix), g = Math.round(a[1]+(b[1]-a[1])*mix), bl = Math.round(a[2]+(b[2]-a[2])*mix);
  return 'rgb('+r+','+g+','+bl+')';
}
function drawBackground(ctx){
  ctx.fillStyle = PAL.night; ctx.fillRect(0,0,CW,CH);
  const img = FLIGHT_IMG.background;
  if(img.complete && img.naturalWidth){
    const tw = 480, th = tw*(img.naturalHeight/img.naturalWidth);
    const offset = -(bgScrollX % tw);
    for(let x=offset-tw; x<CW; x+=tw) ctx.drawImage(img, x, 0, tw, GROUND_Y+40);
  }
  // per-terrain tint, crossfaded during breather (see enterBreather)
  let tintColor = null, tintAlpha = 0;
  if(phase==='breather' && !phaseData.finalApproach){
    const mix = Math.min(1, phaseElapsed/Math.max(0.01,phaseData.duration));
    const a = TERRAIN[LEGS[phaseData.fromLegIndex].terrain].tint;
    const b = TERRAIN[LEGS[phaseData.toLegIndex].terrain].tint;
    if(a || b){ tintColor = lerpColor(a, b, mix); tintAlpha = 0.16; }
  } else {
    const t = TERRAIN[currentTerrainKey()].tint;
    if(t){ tintColor = t; tintAlpha = 0.16; }
  }
  if(tintColor){ ctx.save(); ctx.globalAlpha = tintAlpha; ctx.fillStyle = tintColor; ctx.fillRect(0,0,CW,GROUND_Y+40); ctx.restore(); }
}
function drawGround(ctx){
  let imgA, imgB = null, mix = 0;
  if(phase==='breather' && !phaseData.finalApproach){
    imgA = FLIGHT_IMG[TERRAIN[LEGS[phaseData.fromLegIndex].terrain].ground];
    imgB = FLIGHT_IMG[TERRAIN[LEGS[phaseData.toLegIndex].terrain].ground];
    mix = Math.min(1, phaseElapsed/Math.max(0.01,phaseData.duration));
  } else {
    imgA = FLIGHT_IMG[TERRAIN[currentTerrainKey()].ground];
  }
  const tw = 202; // groundXXX.png are ~808x71 -- tile at a display width the ground band comfortably repeats at
  const offset = -(groundScrollX % tw);
  ctx.imageSmoothingEnabled = false;
  for(let x=offset-tw; x<CW; x+=tw){
    if(imgA && imgA.complete) ctx.drawImage(imgA, x, GROUND_Y, tw+1, GROUND_H);
  }
  if(imgB && mix>0){
    ctx.save(); ctx.globalAlpha = mix;
    for(let x=offset-tw; x<CW; x+=tw){ if(imgB.complete) ctx.drawImage(imgB, x, GROUND_Y, tw+1, GROUND_H); }
    ctx.restore();
  }
}

/* ---------------- gates ---------------- */
function drawPlaque(ctx, cx, y, text, maxW){
  const px = 11;
  const w = Math.min(maxW, 16 + text.length*px*0.6), h = px+12;
  ctx.save(); ctx.globalAlpha = 0.95;
  ctx.fillStyle = PAL.wood; ctx.fillRect(cx-w/2-2, y-2, w+4, h+4);
  ctx.fillStyle = PAL.cream; ctx.fillRect(cx-w/2, y, w, h);
  ctx.restore();
  drawReadingText(ctx, text, cx, y+2, px, PAL.ink, 'center');
}
function drawGate(ctx, g, terrainKey){
  const t = TERRAIN[terrainKey];
  const bottomImg = FLIGHT_IMG[t.rock], topImg = FLIGHT_IMG[t.rockDown];
  const gapTop = g.gapCenterY-g.gapHalf, gapBottom = g.gapCenterY+g.gapHalf;
  drawStretched(ctx, topImg, g.x-GATE_ROCK_W/2, 0, GATE_ROCK_W, Math.max(0,gapTop));
  drawStretched(ctx, bottomImg, g.x-GATE_ROCK_W/2, gapBottom, GATE_ROCK_W, Math.max(0,GROUND_Y-gapBottom));
  if(g.label) drawPlaque(ctx, g.x, gapBottom+8, g.label, 150);
  if(g.hasStar && !g.starTaken){
    const bob = Math.sin(gameT*4 + g.x*0.01)*4;
    ctx.save(); ctx.globalAlpha = 0.95;
    drawPacked(ctx, FLIGHT_IMG.starGold, g.x, g.gapCenterY+bob, 30);
    ctx.restore();
  }
}
function drawGates(ctx){
  const terrainKey = LEGS[phaseData.legIndex].terrain;
  for(const g of activeGates) drawGate(ctx, g, terrainKey);
}
function drawLobs(ctx){
  for(const o of activeLobs){
    if(o.hit) continue;
    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(gameT*6);
    drawLobObject(ctx, -8, -8, 4, PAL.ink);
    ctx.restore();
  }
}

/* ---------------- planes ---------------- */
const PLANE_COLOR_KEY = { yellow:'Yellow', red:'Red', blue:'Blue', green:'Green' };
function planeFrame(t){ return 1+Math.floor(((t*10)%3+3)%3); }
function planeImg(color, t){ return FLIGHT_IMG['plane'+PLANE_COLOR_KEY[color]+planeFrame(t)]; }
function drawPlane(ctx, cx, cy, color, t, scale, faceEntry, faceFallbackCol, faceFallbackRow, flip){
  const img = planeImg(color, t);
  ctx.save();
  if(flip){ ctx.translate(cx,cy); ctx.scale(-1,1); ctx.translate(-cx,-cy); }
  drawPacked(ctx, img, cx, cy, PLANE_DISPLAY_W*scale);
  ctx.restore();
  const face = rosterResolveSprite(faceEntry, faceFallbackCol, faceFallbackRow);
  drawRosterSprite(ctx, face.sheet, face.col, face.row, cx-8*scale*0.75, cy-14*scale*0.75, 2.6*scale, false);
}
function drawPlayerPlane(ctx){
  const bob = (phase==='getready') ? Math.sin(gameT*2)*3 : Math.sin(gameT*8)*1.2;
  const flashing = gameT < invulnUntil && Math.floor(gameT*10)%2===0;
  ctx.save(); if(flashing) ctx.globalAlpha = 0.4;
  drawPlane(ctx, PLANE_X, player.y+bob, FLIGHT_PLANE_COLOR, gameT, 1, CONFIG.host, 2, 7, false);
  ctx.restore();
}
function drawBossLegOverlay(ctx){
  if(phase!=='flying' || !phaseData.isBossLeg) return;
  drawPlane(ctx, BOSS_X, BOSS_Y+Math.sin(gameT*3)*8, BOSS_PLANE_COLOR, gameT, 1.1, CAST.judge, 4, 8, true);
  drawAutoBubble(ctx, firstBossHeckleLine, BOSS_X, BOSS_Y-40, 13, 1);
}
function drawFinalBoss(ctx){
  if(phase!=='finalboss') return;
  const y = phaseData.stage==='live' ? finalBossY(gameT-phaseData.sweepStartT) : FINAL_BOSS_CENTER_Y;
  drawPlane(ctx, FINAL_BOSS_X, y, FINAL_BOSS_PLANE_COLOR, gameT, 1.7, CAST.authority, 0, 7, true);
}
function drawLandingBoss(ctx){
  if(phase!=='landing' || !phaseData.turnGood) return;
  const y = phaseData.startY + (GROUND_Y-PLANE_R-6-phaseData.startY)*Math.min(1,phaseElapsed/LANDING_DURATION);
  drawPlane(ctx, PLANE_X+90, y-10, FINAL_BOSS_PLANE_COLOR, gameT, 1.0, CAST.authority, 0, 7, false);
  if(phaseElapsed>1.0) drawAutoBubble(ctx, ['SORRY ABOUT THAT.', 'SAFE TRAVELS.'], PLANE_X+90, y-40, 12, Math.min(1,(phaseElapsed-1.0)/0.2));
}

/* ---------------- HUD ---------------- */
function drawLegChip(ctx){
  let label;
  if(phase==='flying' || (phase==='breather' && !phaseData.finalApproach)){
    const idx = (phase==='flying') ? phaseData.legIndex : phaseData.toLegIndex;
    label = 'LEG '+(idx+1)+' OF '+LEGS_COUNT;
  } else if(phase==='finalboss') label = 'FINAL APPROACH';
  else if(phase==='breather' && phaseData.finalApproach) label = 'FINAL APPROACH';
  else if(phase==='landing') label = 'LANDING';
  else return;
  const w = Math.max(120, label.length*9+20);
  ctx.save(); ctx.globalAlpha=0.85;
  ctx.fillStyle = PAL.wood; ctx.fillRect(CW/2-w/2-2, 10, w+4, 24);
  ctx.fillStyle = '#1a1410'; ctx.fillRect(CW/2-w/2, 12, w, 20);
  ctx.restore();
  drawReadingText(ctx, label, CW/2, 16, 13, PAL.gold, 'center');
}
function drawHearts(ctx){
  if(currentMode!=='full') return;
  for(let i=0;i<3;i++) drawHeart(ctx, 14+i*22, 14, 3, i<hearts);
}
function drawStarCount(ctx){
  drawPacked(ctx, FLIGHT_IMG.starGold, CW-150, 22, 20);
  drawReadingText(ctx, 'x'+starsCollectedThisRun, CW-134, 14, 14, PAL.cream, 'left');
  if(shoutCharged() && Math.floor(gameT*3)%2===0){
    drawReadingText(ctx, 'THE SHOUT IS READY', CW/2, 40, 12, PAL.gold, 'center');
  }
}
function drawOneTankHUD(ctx){
  if(currentMode!=='onetank') return;
  drawReadingText(ctx, 'ONE TANK -- '+distancePctNow()+'%', 14, 14, 14, PAL.gold, 'left');
}
function drawBanner(ctx){
  if(!bannerText || gameT>=bannerUntil) return;
  const p = Math.min(1, (bannerUntil-gameT)>1.3 ? (1.6-(bannerUntil-gameT))/0.3 : 1);
  ctx.save(); ctx.globalAlpha = Math.min(1,p);
  drawChunkyText(ctx, bannerText, CW/2, 130, 28, PAL.gold, PAL.outline, 'center');
  if(bannerSub) drawReadingText(ctx, bannerSub, CW/2, 170, 15, PAL.cream, 'center');
  ctx.restore();
}
function drawButterfingersGag(ctx){
  if(!butterfingersPhone) return;
  ctx.save();
  ctx.translate(butterfingersPhone.x, butterfingersPhone.y);
  ctx.scale(Math.cos(gameT*6), 1);
  drawPhone(ctx, -12, -16, 4);
  ctx.restore();
  drawAutoBubble(ctx, [(BUTTERFINGERS_CAST?fmt(CAST.butterfingers.name).toUpperCase():'SOMEONE')+' DROPPED', 'THE PHONE AGAIN.'], butterfingersPhone.x, butterfingersPhone.y-24, 12, 1);
}
function drawBreatherBubble(ctx){
  if(phase!=='breather') return;
  const state = phaseData.tw.getState(phaseElapsed);
  const lines = phaseData.tw.lines.map((l,i)=>l.slice(0, state[i]));
  drawAutoBubble(ctx, lines, CW/2, 140, 15, 1);
}

/* ---------------- title / getready / modeselect / endcard screens ---------------- */
function drawTitleScreen(ctx){
  const lockup = (CONFIG.title.lockupLines||['YOUR','GROUP']).join(' ');
  drawChunkyText(ctx, lockup, CW/2, 150, 40, PAL.gold, PAL.outline, 'center');
  drawReadingText(ctx, 'A DISASTER TRIP YOU KEEP RETELLING.', CW/2, 220, 16, PAL.cream, 'center');
  if(oneTankUnlocked()){
    drawReadingText(ctx, 'ONE TANK BEST: '+oneTankBestPct()+'%', CW/2, 250, 14, PAL.gold, 'center');
  } else {
    drawReadingText(ctx, 'ONE TANK UNLOCKS WHEN YOU LAND', CW/2, 250, 14, PAL.gold, 'center');
  }
  if(Math.floor(gameT*2)%2===0) drawReadingText(ctx, isTouch?'TAP TO START':'PRESS SPACE TO START', CW/2, 300, 15, PAL.gold, 'center');
  drawPlane(ctx, CW/2, 380, FLIGHT_PLANE_COLOR, gameT, 1.6, CONFIG.host, 2, 7, false);
}
function drawModeSelect(ctx){
  drawChunkyText(ctx, 'CHOOSE YOUR FLIGHT PLAN', CW/2, 100, 26, PAL.gold, PAL.outline, 'center');
  const opts = [
    { title:'THE FULL TRIP', sub:'EVERYONE LANDS' },
    { title:'ONE TANK', sub:'ONE LIFE. HOW FAR CAN YOU GET?' },
  ];
  for(let i=0;i<2;i++){
    const x = CW/2-220+i*440, y = 200, w=400, h=140;
    const sel = modeSelectIndex===i;
    ctx.save(); ctx.globalAlpha = sel?1:0.7;
    ctx.fillStyle = sel?PAL.gold:PAL.wood; ctx.fillRect(x-4,y-4,w+8,h+8);
    ctx.fillStyle = '#1a1410'; ctx.fillRect(x,y,w,h);
    ctx.restore();
    drawReadingText(ctx, opts[i].title, x+w/2, y+40, 20, sel?PAL.gold:PAL.cream, 'center');
    drawReadingText(ctx, opts[i].sub, x+w/2, y+80, 13, PAL.cream, 'center');
  }
  if(Math.floor(gameT*2)%2===0) drawReadingText(ctx, isTouch?'TAP A PLAN':'ARROWS TO CHOOSE, SPACE TO CONFIRM', CW/2, 400, 14, PAL.gold, 'center');
}
function modeOptionRect(i){ return { x: CW/2-220+i*440, y:200, w:400, h:140 }; }
function drawGetReadyScreen(ctx){
  drawPacked(ctx, FLIGHT_IMG.textGetReady, CW/2, 140, 340);
  drawPlane(ctx, PLANE_X, player.y, FLIGHT_PLANE_COLOR, gameT, 1.3, CONFIG.host, 2, 7, false);
  if(Math.floor(gameT*2)%2===0) drawPacked(ctx, FLIGHT_IMG.tap, CW/2, 380, 56);
  drawReadingText(ctx, isTouch?'TAP TO TAKE OFF':'PRESS SPACE TO TAKE OFF', CW/2, 430, 15, PAL.gold, 'center');
}
function drawMedal(ctx, medal, cx, cy){
  const img = medal==='gold'?FLIGHT_IMG.medalGold : medal==='silver'?FLIGHT_IMG.medalSilver : FLIGHT_IMG.medalBronze;
  drawPacked(ctx, img, cx, cy, 80);
}
function drawEndcard(ctx){
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,CW,CH);
  drawChunkyText(ctx, CONFIG.punchline, CW/2, 30, 26, PAL.gold, PAL.outline, 'center');
  let y = 78;
  if(phaseData.landed){ drawReadingText(ctx, 'LANDED.', CW/2, y, 18, PAL.cream, 'center'); }
  else { drawReadingText(ctx, 'HOW FAR INTO THE TRIP: '+phaseData.distancePct+'%', CW/2, y, 18, PAL.cream, 'center'); }
  y += 26;
  drawReadingText(ctx, 'STARS: '+starsCollectedThisRun, CW/2, y, 14, PAL.cream, 'center'); y+=20;
  drawReadingText(ctx, 'CRASHES: '+crashesThisRun, CW/2, y, 14, PAL.cream, 'center'); y+=20;
  drawMedal(ctx, phaseData.medal, CW/2, y+50); y += 100;
  drawReadingText(ctx, phaseData.rank, CW/2, y, 20, PAL.gold, 'center'); y += 30;
  // per-beat recap -- reached ones lit
  const colW = Math.min(880, CW-40);
  for(let i=0;i<LEGS_COUNT;i++){
    const lit = legReached[i];
    drawReadingText(ctx, (lit?'* ':'  ')+FLIGHT_BEATS[i], CW/2, y, 12, lit?PAL.cream:'#5c5240', 'center');
    y += 17;
  }
  y += 8;
  if(BUILDER_CAST){ drawReadingText(ctx, 'BUILT BY '+fmt(CAST.builder.name).toUpperCase()+'.', CW/2, y, 12, PAL.cream, 'center'); y+=20; }
  drawReadingText(ctx, 'SEND THIS ONE TO THE GROUP CHAT.', CW/2, y, 13, PAL.cream, 'center'); y+=24;
  if(Math.floor(gameT*2)%2===0) drawReadingText(ctx, isTouch?'TAP TO PLAY AGAIN':'PRESS SPACE TO PLAY AGAIN', CW/2, y, 14, PAL.gold, 'center');
}
/* full-screen "turn your phone" gate -- deliberately its own copy, not
   shared/framework.js (see that file's header -- drawRotatePrompt is the
   documented case where engines genuinely differ). */
function drawRotatePrompt(ctx){
  ctx.save(); ctx.globalAlpha=0.85; ctx.fillStyle='#000'; ctx.fillRect(0,0,CW,CH); ctx.restore();
  const w=680,h=220, x=CW/2-w/2, y=CH/2-h/2;
  ctx.fillStyle=PAL.cream; ctx.fillRect(x-4,y-4,w+8,h+8);
  ctx.fillStyle='#1a1410'; ctx.fillRect(x,y,w,h);
  drawChunkyText(ctx, 'ROTATE YOUR PHONE', CW/2, y+60, 26, PAL.gold, PAL.outline, 'center');
  if(Math.floor(gameT*2)%2===0) drawReadingText(ctx, 'TURN TO LANDSCAPE TO PLAY', CW/2, y+140, 16, PAL.cream, 'center');
}

/* ======================================================================
   DRAW dispatch
   ====================================================================== */
function draw(){
  ctx.save();
  if(gameT < screenShakeUntil){
    const m = screenShakeMag;
    ctx.translate((Math.random()*2-1)*m, (Math.random()*2-1)*m);
  }
  drawBackground(ctx);
  drawGround(ctx);
  if(phase==='title'){ drawTitleScreen(ctx); }
  else if(phase==='modeselect'){ drawModeSelect(ctx); }
  else if(phase==='getready'){ drawGetReadyScreen(ctx); }
  else if(phase==='endcard'){ drawEndcard(ctx); }
  else {
    if(phase==='flying') drawGates(ctx);
    if(phase==='flying') drawLobs(ctx);
    drawBossLegOverlay(ctx);
    drawFinalBoss(ctx);
    drawLandingBoss(ctx);
    drawPlayerPlane(ctx);
    updateAndDrawFlightPuffs(ctx, 0);
    drawButterfingersGag(ctx);
    drawBreatherBubble(ctx);
    drawLegChip(ctx);
    drawHearts(ctx);
    drawOneTankHUD(ctx);
    drawStarCount(ctx);
    drawBanner(ctx);
  }
  ctx.restore();
}

/* ======================================================================
   INPUT -- one button: SPACE / click / tap anywhere / gamepad A = flap
   (or the phase-appropriate menu/card action -- see handleAction). Volume
   UI pointerdown check comes first, always.
   ====================================================================== */
window.addEventListener('keydown', (e)=>{
  keys[e.code] = true;
  ensureAudioStarted();
  if(e.code==='KeyM' && !e.repeat){ toggleMute(); return; }
  if(rotatePromptActive) return;
  if(phase==='modeselect' && !e.repeat){
    if(e.code==='ArrowUp' || e.code==='ArrowLeft'){ modeSelectIndex = 0; return; }
    if(e.code==='ArrowDown' || e.code==='ArrowRight'){ modeSelectIndex = 1; return; }
  }
  if(e.code==='Space' && !e.repeat){
    handleAction();
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e)=>{ keys[e.code] = false; });
window.addEventListener('pointerdown', (e)=>{
  ensureAudioStarted();
  const p = screenToLogical(e.clientX, e.clientY);
  if(handleVolumePointerdown(p.x, p.y)) return;
  if(rotatePromptActive) return;
  if(e.pointerType==='touch') isTouch = true;
  if(phase==='modeselect'){
    for(let i=0;i<2;i++){
      const r = modeOptionRect(i);
      if(p.x>=r.x && p.x<=r.x+r.w && p.y>=r.y && p.y<=r.y+r.h){ modeSelectIndex = i; confirmModeSelect(); return; }
    }
    return;
  }
  handleAction();
});
window.addEventListener('load', ()=>{ try{ ensureAudioStarted(); }catch(e){} });

/* ======================================================================
   MAIN LOOP -- same frame()/rAF shape every engine uses (see gallery/
   engine.js's identical structure); tick(dt) is factored out as its own
   named function so a future harness can drive frames manually without
   duplicating this logic.
   ====================================================================== */
function tick(dtRaw){
  if(slowMoTimer>0){ slowMoTimer -= dtRaw; if(slowMoTimer<=0){ slowMoTimer=0; timeScale=1; } }
  const dt = dtRaw*timeScale;
  gameT += dt;
  update(dt);
}
let lastFrameMs = performance.now();
function frame(nowMs){
  requestAnimationFrame(frame);
  const dtRaw = Math.min(0.05, (nowMs-lastFrameMs)/1000);
  lastFrameMs = nowMs;
  rotatePromptActive = isTouch && window.innerHeight > window.innerWidth;
  if(!useMp3Music && bgmBuffer) tryStartMusic();
  if(window.innerWidth > 0 && Math.abs(parseInt(canvas.style.width||'0') - Math.floor(CW*Math.min(window.innerWidth/CW, window.innerHeight/CH))) > 2 && window.innerHeight > 0){
    fitCanvas();
  }
  pollGamepadFlap();
  if(rotatePromptActive || activeCard){
    cardT += dtRaw;
  } else {
    tick(dtRaw);
  }
  draw();
  if(rotatePromptActive) drawRotatePrompt(ctx);
  else if(activeCard) drawCardOverlay(ctx);
  drawVolumeUI(ctx); // always last -- on top of every other overlay
  if(actx) updateBeatMusic();
}
requestAnimationFrame(frame);
