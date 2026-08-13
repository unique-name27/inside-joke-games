'use strict';
/* ======================================================================
   THE GALLERY -- template #2 engine (see SPEC-gallery.md). Single page, no
   separate intro (a short attract/title screen lives inside this file,
   below). Built ON shared/framework.js -- see that file's own header for
   what's shared vs. what stays per-engine; this file follows the exact
   same conventions game/engine.js and intro/engine.js already established
   (ENGINE_ROOT/CFG_FRAGMENT resolution, local CW/CH + eager fitCanvas()
   call, local SFX_DEFS/MUSIC_LOOP_DEFS + wrapper functions, local pixel-
   primitive helpers, local drawRotatePrompt, the same frame()/update()/
   draw() main-loop shape) rather than inventing a new pattern.

   ROUND 2 SCOPE (this file): the full one-screen game -- stall, 3 target
   rows, seeded round schedules, crosshair aiming (mouse/touch/keyboard/
   gamepad), roastable/friend/butterfingers targets, the barker, THE FIRST
   BOSS rope round with fake death, THE FINAL BOSS stall-takeover finale
   with the quirk tell, the savior rescue, the SAY IT catchphrase meter,
   retry-on-quota-miss, the end card, full degradation when judge/
   authority/savior/butterfingers/builder are uncast. What round 2 does
   NOT do (deferred to round 3 per SPEC-gallery.md's build plan): the
   wizard's "What's the joke?" step / targets step, game/cfgcodec.js schema
   validation for `template`/`gallery` fields, tools/generate.js support,
   and a registered harness driver (tools/verify-gallery.js or similar) --
   this file exposes plain top-level functions (tick/update/draw/fireAt)
   exactly the way game/engine.js does, so wiring a future harness is a
   thin wrapper, not a rewrite.
   ====================================================================== */

const ENGINE_ROOT = new URL('../', document.currentScript.src).href;

/* URL-fragment CONFIG override -- identical mechanism/rationale to
   game/engine.js's own (see that file's header comment). Cheap to keep
   wired up even though `template`/`gallery` aren't part of
   game/cfgcodec.js's schema yet (round 3) -- cfgLoadFragmentOverride
   returns null for anything it can't validate, so an old-shaped fragment
   just falls back to this page's own file CONFIG unchanged, same as any
   other rejected fragment. */
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
  CONFIG = cfgBuildDefaultConfig(ENGINE_ROOT);
}
// defensive default -- cfgBuildDefaultConfig (round-3 territory) doesn't
// know about `gallery` yet, so the brief window before the redirect above
// actually navigates away needs this file to not crash on CONFIG.gallery.*
if(!CONFIG.gallery) CONFIG.gallery = { targets: ['NOTHING ON THE LIST YET'] };

document.title = (CONFIG.title && CONFIG.title.gamePageTitle) || 'The Gallery -- Playable Demo';

/* ---------------- constants & palette ---------------- */
const CW = 960, CH = 540, TILE = 16;
// fitCanvas() (shared/framework.js) reads CW/CH -- see game/engine.js's
// identical comment for why the one initial call has to happen here.
fitCanvas();
const PAL = {
  cream:'#f3e9d2', terracotta:'#c96f4a', wood:'#8a5a30', sky:'#7fb8e6', skyLow:'#bfe0f2',
  night:'#141428', gold:'#e8b84b', outline:'#6b2b1f', ink:'#2a1c12', silhouette:'#0a0a14',
  grass:'#4d8a3c', grassDark:'#356028', heartFull:'#c9394a', heartEmpty:'#3a2a20',
  friendBad:'#e0645a', plush:'#c96f4a', plushDark:'#8a4a30',
};

/* ---------------- CONFIG-derived helpers -- {HOST} token, same as every
   other template ---------------- */
const STORAGE_PREFIX = CFG_FRAGMENT ? ('frag_' + CFG_FRAGMENT.hash) : ((CONFIG && CONFIG.gameId) || 'gallery');
function fmt(s){
  if(typeof s !== 'string') return s;
  return CONFIG.host ? s.split('{HOST}').join(CONFIG.host.name) : s;
}
function fmtLines(lines){ return lines.map(fmt); }

const CAST = CONFIG.cast || {};
const JUDGE_CAST = !!CAST.judge;
const AUTHORITY_CAST = !!CAST.authority;
const SAVIOR_CAST = !!CAST.savior;
const BUTTERFINGERS_CAST = !!CAST.butterfingers;
const BUILDER_CAST = !!CAST.builder;
const GALLERY_TARGETS = (CONFIG.gallery.targets && CONFIG.gallery.targets.length) ? CONFIG.gallery.targets : ['NOTHING ON THE LIST YET'];

/* neutral fallback pools -- template-owned, tone-clean, used whenever a
   config doesn't supply the optional gallery.firstBossHeckle/
   finalBossQuirk lines (see SPEC-gallery.md's config section). Picked
   deterministically per game (via the same seeded rng everything else
   uses), not left to Math.random. */
const FIRST_BOSS_HECKLE_FALLBACKS = [
  'CALL THAT AIM?', 'MY GRANDMOTHER SHOOTS BETTER.', 'IS THAT ALL YOU\'VE GOT?', 'PATHETIC. TRULY.',
];
const FINAL_BOSS_QUIRK_FALLBACKS = [
  'ALWAYS TALKS WITH THEIR HANDS.', 'CAN\'T RESIST A DRAMATIC PAUSE.', 'NEVER BLINKS FIRST.',
];
const FIRST_BOSS_HECKLE = CONFIG.gallery.firstBossHeckle || null;
const FINAL_BOSS_QUIRK = CONFIG.gallery.finalBossQuirk || null;

/* ======================================================================
   SEEDED RNG -- gameId hash -> a deterministic sequence, never Math.random.
   Reuses cfgHashString (game/cfgcodec.js, already loaded) for the hash;
   mulberry32 turns that into a repeatable stream. Every schedule/pick in
   this file goes through a rng seeded off CONFIG.gameId + a descriptive
   suffix, so the SAME link always plays the SAME rounds, and a retried
   round (new attempt number folded into the seed) doesn't feel identical.
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
function rngPick(rng, arr){ return arr[rngInt(rng, arr.length)]; }
const GAME_SEED_BASE = CONFIG.gameId || 'gallery';
const gameRng = makeRng(GAME_SEED_BASE + ':gallery:flavor');
const firstBossHeckleLine = FIRST_BOSS_HECKLE || rngPick(gameRng, FIRST_BOSS_HECKLE_FALLBACKS);
const finalBossQuirkLine = FINAL_BOSS_QUIRK || rngPick(gameRng, FINAL_BOSS_QUIRK_FALLBACKS);

/* ======================================================================
   ASSETS -- the Shooting Gallery pack (assets/gallery/, CC0, see
   assets/gallery/CREDITS.txt for exactly which pieces and why) plus the
   same roster character sheets every template can draw a cast pick from
   (intro/assets/, loaded the same way game/engine.js/intro/engine.js do --
   this block is per-engine content, not shared/framework.js's job, see its
   header).
   ====================================================================== */
const GALLERY_IMG_FILES = {
  bgWood:'bg_wood.png', curtainTop:'curtain_top.png', curtain:'curtain.png', curtainRope:'curtain_rope.png',
  cloud1:'cloud1.png', cloud2:'cloud2.png', treeOak:'tree_oak.png', treePine:'tree_pine.png', grass1:'grass1.png',
  duckYellow:'duck_yellow.png', duckBrown:'duck_brown.png', duckWhite:'duck_white.png',
  stickWood:'stick_wood.png', targetWhite:'target_white.png', rifle:'rifle.png', crosshairImg:'crosshair_red_large.png',
};
const GALLERY_IMG = {};
let assetsSettledCount = 0;
let assetsReady = false;
const ROSTER_SHEET_IMAGES = {};
const ROSTER_SHEET_KEYS = (typeof ROSTER_SHEETS !== 'undefined') ? Object.keys(ROSTER_SHEETS) : [];
const ASSETS_TOTAL = Object.keys(GALLERY_IMG_FILES).length + ROSTER_SHEET_KEYS.length;
function markAssetSettled(){ assetsSettledCount++; if(assetsSettledCount>=ASSETS_TOTAL) assetsReady = true; }
for(const key in GALLERY_IMG_FILES){
  const img = new Image();
  img.src = ENGINE_ROOT + 'assets/gallery/' + GALLERY_IMG_FILES[key];
  img.onload = markAssetSettled; img.onerror = markAssetSettled;
  GALLERY_IMG[key] = img;
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
/* generic scaled draw for a Shooting Gallery pack piece, anchored by its
   CENTER (cx,cy) at a given display width (aspect-locked to the source) */
function drawPacked(ctx, img, cx, cy, dispW){
  if(!img.complete || !img.naturalWidth) return;
  const dispH = dispW * (img.naturalHeight/img.naturalWidth);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, cx-dispW/2, cy-dispH/2, dispW, dispH);
}

/* ---------------- pixel primitives (see shared/framework.js's header --
   these stay duplicated per engine on purpose) ---------------- */
function drawPixelCircle(ctx, cx, cy, r, color, px){
  px = px || 2;
  ctx.fillStyle = color;
  for(let dy=-r; dy<=r; dy+=px){
    const w = Math.sqrt(Math.max(0, r*r - dy*dy));
    const rowW = Math.max(px, Math.round((w*2)/px)*px);
    ctx.fillRect(Math.round(cx-rowW/2), Math.round(cy+dy), rowW, px);
  }
}
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

/* ---------------- procedural props NOT in the Shooting Gallery pack ----
   (see assets/gallery/CREDITS.txt) -- same drawBitmap-prop convention as
   game/engine.js's STEAK_ROWS/CHIP_ROWS. ---------------- */
const PLATE_ROWS = ['.111111.','11111111','.111111.','11111111','.111111.','11111111'];
const PLATE_COLORS = {'1':'#f3e9d2'};
function drawPlateStack(ctx, x, y, cell){ drawBitmap(ctx, PLATE_ROWS, PLATE_COLORS, x, y, cell); }
const PLUSH_ROWS = [
  '..1111..', '.111111.', '1121121.', '11111111', '11111111', '.111111.', '1.1111.1', '1......1'
];
const PLUSH_COLORS = {'1':PAL.plush, '2':PAL.ink};
function drawPlush(ctx, x, y, cell){ drawBitmap(ctx, PLUSH_ROWS, PLUSH_COLORS, x, y, cell); }

/* ======================================================================
   AUDIO -- reuses shared/framework.js's makeBufferBank/playSample/twang/
   ducking/volume UI/SpeechSynthesis wrapper; this block is this engine's
   own content (SFX list + wrappers + music-loop defs), same convention as
   game/engine.js and intro/engine.js. Every SFX file below already ships
   in assets/audio/sfx/ -- no new audio assets were needed for this
   template (see assets/gallery/CREDITS.txt).
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

const SFX_DEFS = {
  pop:           { src:ENGINE_ROOT+'assets/audio/sfx/confirmation_004.ogg',     gain:0.6 }, // target pop / hit
  ding:          { src:ENGINE_ROOT+'assets/audio/sfx/confirmation_001.ogg',     gain:0.6 }, // catchphrase ready
  thud:          { src:ENGINE_ROOT+'assets/audio/sfx/impactSoft_medium_002.ogg',gain:0.6 }, // miss / dud
  glassShatter:  { src:ENGINE_ROOT+'assets/audio/sfx/impactGlass_heavy_001.ogg',gain:0.8 }, // plate-stack crash
  slamBoom:      { src:ENGINE_ROOT+'assets/audio/sfx/impactWood_heavy_002.ogg', gain:0.9 }, // punchline slam
  groan:         { src:ENGINE_ROOT+'assets/audio/sfx/error_003.ogg',            gain:0.6 }, // friend hit penalty
  recordScratch: { src:ENGINE_ROOT+'assets/audio/sfx/scratch_002.ogg',          gain:0.8 }, // fake-death gag
  jingleStart:   { src:ENGINE_ROOT+'assets/audio/sfx/jingles-hit_03.ogg',       gain:0.8 }, // fake victory jingle
  fanfare:       { src:ENGINE_ROOT+'assets/audio/sfx/jingles-hit_10.ogg',       gain:0.8 }, // round/boss/finale clear
  haBlip:        { src:ENGINE_ROOT+'assets/audio/sfx/jingles-hit_02.ogg',       gain:0.6 }, // catchphrase charged
  sadGliss:      { src:ENGINE_ROOT+'assets/audio/sfx/minimize_006.ogg',         gain:0.6 }, // quota-miss stinger
  softChime:     { src:ENGINE_ROOT+'assets/audio/sfx/select_006.ogg',           gain:0.6 }, // savior rescue chime
  rumble:        { src:ENGINE_ROOT+'assets/audio/sfx/stoneDrag2.ogg',           gain:0.7 }, // stall-takeover rumble
  whoosh:        { src:ENGINE_ROOT+'assets/audio/sfx/woosh3.ogg',               gain:0.5 }, // crosshair whip / miss
  keyBlip:       { src:ENGINE_ROOT+'assets/audio/sfx/tick_001.ogg',             gain:0.5 }, // barker sign text-in
};
const sfxLoader = makeBufferBank(SFX_DEFS);
function tryDecodeAllSamples(){ sfxLoader.tryDecodeAll(); }
sfxLoader.prefetchAll();
function playPop(t){ playSample('pop', t); }
function playDing(t){ playSample('ding', t); }
function playThud(t){ playSample('thud', t); }
function playGlassShatter(t){ playSample('glassShatter', t); }
function playSlamBoom(t){ playSample('slamBoom', t); }
function playGroan(t){ playSample('groan', t); }
function playRecordScratch(t){ playSample('recordScratch', t); }
function playJingleStart(t){ playSample('jingleStart', t); }
function playFanfare(t){ playSample('fanfare', t); playTwang(t+1.2, 0.9); }
function playHaBlip(t){ playSample('haBlip', t); }
function playSadGliss(t){ playSample('sadGliss', t); }
function playSoftChime(t){ playSample('softChime', t); }
function playRumble(t){ playSample('rumble', t); }
function playWhoosh(t){ playSample('whoosh', t); }
function playKeyBlip(t){ playSample('keyBlip', t); }

/* Phase M mapping (see SPEC-gallery.md "Music"): rounds=dinner slot,
   boss=boss, finale=chase, win=celebration, fail=sad (the brief TRY AGAIN
   stinger), gameover=gameover (the bed under the TRY AGAIN card itself).
   Same internal loop-key names every template uses -- MUSIC_LOOP_DEFS
   built from CONFIG.music.loops exactly like game/engine.js. */
const MUSIC_LOOP_DEFS = {};
for(const key in (CONFIG.music && CONFIG.music.loops || {})) MUSIC_LOOP_DEFS[key] = { src: CONFIG.music.loops[key] };
const loopLoader = makeBufferBank(MUSIC_LOOP_DEFS);
function tryDecodeAllLoops(){ loopLoader.tryDecodeAll(); }
loopLoader.prefetchAll();
setBeatMusic('dinner');

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
   STALL LAYOUT -- three target rows (near/mid/far), 5 fixed slots per row.
   near is biggest/lowest (closest to the player), far is smallest/highest
   -- the classic shooting-gallery depth cue. Butterfingers doesn't use a
   slot -- it's the one target that moves laterally across a row instead.
   ====================================================================== */
const ROWS = [
  { key:'far',  y:196, scale:0.60 },
  { key:'mid',  y:292, scale:0.86 },
  { key:'near', y:396, scale:1.18 },
];
const SLOTS_PER_ROW = 5;
const PLAYFIELD_X0 = 150, PLAYFIELD_X1 = 810;
function slotX(slotIdx){ return PLAYFIELD_X0 + slotIdx*((PLAYFIELD_X1-PLAYFIELD_X0)/(SLOTS_PER_ROW-1)); }
const DUCK_IMAGES = ['duckWhite','duckBrown','duckYellow']; // index-matched to ROWS (far/mid/near)

/* ======================================================================
   ROUND DEFINITIONS -- 3 escalating rounds, then a boss slot (THE FIRST
   BOSS if JUDGE_CAST, else 'elitevolley'), then a finale slot (THE FINAL
   BOSS if AUTHORITY_CAST, else 'grandvolley'). elitevolley/grandvolley
   reuse the exact same round-schedule machinery as round1-3 -- they're
   just another (harder-tuned) round, not a separate mechanic -- see
   SPEC-gallery.md: "the round becomes an elite roastable volley" /
   "grand all-targets volley finale". Tuning is this round's own creative
   call (documented in the coordinator report, not spec-mandated numbers).
   ====================================================================== */
const ROUND_DEFS = {
  round1:      { quota:6,  duration:24, maxConcurrent:2, spawnRange:[1.3,2.0], allowFriends:true,  allowButterfingers:false, label:'ROUND 1' },
  round2:      { quota:8,  duration:24, maxConcurrent:3, spawnRange:[1.0,1.7], allowFriends:true,  allowButterfingers:true,  label:'ROUND 2' },
  round3:      { quota:10, duration:26, maxConcurrent:3, spawnRange:[0.8,1.4], allowFriends:true,  allowButterfingers:true,  label:'ROUND 3' },
  elitevolley: { quota:14, duration:26, maxConcurrent:4, spawnRange:[0.6,1.0], allowFriends:false, allowButterfingers:true,  label:'ELITE VOLLEY' },
  grandvolley: { quota:16, duration:28, maxConcurrent:5, spawnRange:[0.5,0.9], allowFriends:true,  allowButterfingers:true,  label:'THE GRAND VOLLEY' },
};
const ROUND_ORDER = ['round1','round2','round3'];
const TARGET_UP_RANGE = [2.2, 3.2];   // seconds a roastable/friend target stays hittable before ducking back down unhit
const RISE_DURATION = 0.16, DUCK_DURATION = 0.16;
const BUTTERFINGERS_CROSS_TIME = 3.0; // seconds to cross a row
const FRIEND_POOL_EXTRA = 'A FRIEND'; // the "extra friend" beyond cast -- SPEC-gallery.md's "cast + extra friend"

/* the friend pool is every cast member EXCEPT the two boss slots (judge/
   authority never appear as a "don't shoot" friend target -- they're the
   bosses), plus one generic extra friend so the pool is never empty on a
   minimal (host-only) config. */
function buildFriendPool(){
  const pool = [];
  for(const slot of ['savior','butterfingers','builder']){
    if(CAST[slot] && CAST[slot].name) pool.push({ name: CAST[slot].name, sprite: rosterResolveSprite(CAST[slot], 2, 7) });
  }
  pool.push({ name: FRIEND_POOL_EXTRA, sprite: rosterResolveSprite(null, 1, 7) });
  return pool;
}
const FRIEND_POOL = buildFriendPool();

/* ======================================================================
   SEEDED SCHEDULE -- deterministic per (gameId, round key, attempt). Spawn
   events are generated up front for the round's whole duration, then
   consumed by the live sim as gameT-in-round crosses each event's time.
   ====================================================================== */
function buildRoundSchedule(roundKey, attempt){
  const def = ROUND_DEFS[roundKey];
  const rng = makeRng(GAME_SEED_BASE + ':gallery:' + roundKey + ':' + attempt);
  const events = [];
  let t = rngRange(rng, 0.4, 1.0);
  let guard = 0;
  while(t < def.duration - 0.6 && guard++ < 400){
    const row = rngInt(rng, ROWS.length);
    const slot = rngInt(rng, SLOTS_PER_ROW);
    let kind = 'roastable';
    const roll = rng();
    if(def.allowButterfingers && BUTTERFINGERS_CAST && roll < 0.10){
      kind = 'butterfingers';
    } else if(def.allowFriends && roll < (def.allowButterfingers && BUTTERFINGERS_CAST ? 0.34 : 0.30)){
      kind = 'friend';
    }
    events.push({
      t, row, slot, kind,
      labelIdx: rngInt(rng, GALLERY_TARGETS.length),
      friendIdx: rngInt(rng, FRIEND_POOL.length),
      up: rngRange(rng, TARGET_UP_RANGE[0], TARGET_UP_RANGE[1]),
      vy: rngRange(rng, -8, 8), // tiny per-target bob offset so a row doesn't look perfectly mechanical
    });
    t += rngRange(rng, def.spawnRange[0], def.spawnRange[1]);
  }
  return events;
}

/* ======================================================================
   GAME STATE
   ====================================================================== */
let gameT = 0;
let timeScale = 1; // slow-mo during the catchphrase slam
let phase = 'title';
let phaseElapsed = 0;
let phaseData = {};
let crosshair = { x: CW/2, y: CH/2 };
// touchActionPointerId is shared/framework.js's own `let` (input layer) --
// reused here as-is, not redeclared (a second top-level `let` of the same
// name would be a SyntaxError once both scripts share one global scope).
let gpAPrev = false;

let activeTargets = [];   // roastable/friend pop-up targets: {id,row,slot,kind,labelIdx,friendIdx,state,bornT,upDur}
let butterfingers = null; // the one moving lateral target, or null
let nextTargetId = 1;
let schedule = [];
let scheduleIdx = 0;
let roundTimeLeft = 0;
let roundHits = 0;
let saviorUsedThisGame = false;
let rescueUntil = 0; // >0 while the savior's rescue window is open

let streakClean = true;
let meterCharge = 0;
let catchphraseCharged = false;
let usedCatchphraseThisRound = false;
const CHARGE_PER_HIT = 0.22;
const SLOWMO_DURATION = 1.1, SLOWMO_SCALE = 0.35;
let slowMoUntil = 0;

let stats = { shotsFired:0, hits:0, misses:0, friendHits:0, bestStreak:0, curStreak:0, score:0, perRoastable:{}, butterfingersBonus:0 };
for(const label of GALLERY_TARGETS) stats.perRoastable[label] = 0;

let screenShakeUntil = 0, screenShakeMag = 0;
function triggerShake(mag, dur){ screenShakeUntil = gameT+dur; screenShakeMag = mag; }

let bannerText = null, bannerSub = null, bannerUntil = 0;
function showBanner(text, sub, dur){ bannerText = text; bannerSub = sub||null; bannerUntil = gameT + (dur===undefined?1.6:dur); }

let boss = null;   // THE FIRST BOSS state
let finale = null; // THE FINAL BOSS state

/* ---------------- tutorial/round-intro cards -- see shared/framework.js's
   card system. Bodies are built once (round quotas/labels are engine
   constants, not runtime-dynamic) except CARDS.retry, whose body is
   rewritten per-attempt just before showing it (see showRetryCard) --
   deliberately NOT routed through maybeShowCard's one-shot guard, since a
   retry can legitimately show more than once; see that function. */
const CARDS = {
  title: { key:'title', title:CONFIG.title.lockupLines.join(' '), body:['A CARNIVAL SHOOTING STALL.','THE TARGETS ARE THE THINGS THIS GROUP CAN\'T STOP ROASTING.', isTouch?'TAP TO START':'PRESS SPACE TO START'] },
  round1: { key:'round1', title:'ROUND 1', body:[fmt('STEP RIGHT UP, {HOST}.'), 'HIT '+ROUND_DEFS.round1.quota+' TARGETS BEFORE TIME RUNS OUT.', 'WATCH FOR FRIENDLY FACES -- DON\'T SHOOT THOSE.'] },
  round2: { key:'round2', title:'ROUND 2', body:['GETTING FASTER NOW.', 'HIT '+ROUND_DEFS.round2.quota+' TARGETS.'].concat(BUTTERFINGERS_CAST?['WATCH FOR THE STACK OF PLATES.']:[]) },
  round3: { key:'round3', title:'ROUND 3', body:['LAST ROUND. MAKE IT COUNT.', 'HIT '+ROUND_DEFS.round3.quota+' TARGETS.'] },
  elitevolley: { key:'elitevolley', title:'ELITE VOLLEY', body:['NO BOSS TONIGHT.', 'JUST TARGETS -- LOTS OF THEM.', 'HIT '+ROUND_DEFS.elitevolley.quota+' BEFORE TIME\'S UP.'] },
  boss: { key:'boss', title:(JUDGE_CAST?CAST.judge.name:'THE CRITIC')+' TAKES THE ROPE', body:['DODGE THE HECKLING.', 'HIT THEM ENOUGH TIMES TO CLEAR THE ROUND.'] },
  finale: { key:'finale', title:(AUTHORITY_CAST?CAST.authority.name:'THE BOSS')+' TAKES OVER', body:['EVERY FACE ON STAGE IS THEIRS NOW.', 'FIND THE REAL ONE. WRONG PICKS COST TIME.'] },
  grandvolley: { key:'grandvolley', title:'THE GRAND VOLLEY', body:['EVERYTHING, ALL AT ONCE.', 'HIT '+ROUND_DEFS.grandvolley.quota+' BEFORE TIME\'S UP.'] },
  retry: { key:'retry', title:'TRY AGAIN', body:['NOT QUITE. ONE MORE GO.'] },
};
/* mutates CARDS.retry.body then shows it directly (bypassing
   maybeShowCard's one-shot-per-key guard, which is right for tutorial
   cards but wrong for a card that can legitimately reappear) */
function showRetryCard(roundLabel){
  CARDS.retry.body = [roundLabel+': NOT QUITE.', 'ONE MORE GO.'];
  activeCard = CARDS.retry;
  cardT = 0;
}

/* ======================================================================
   ROUND-LIKE PHASES -- round1/round2/round3/elitevolley/grandvolley all
   share this one implementation (see ROUND_DEFS's own header comment).
   ====================================================================== */
function nextAfterRoundLike(key){
  const i = ROUND_ORDER.indexOf(key);
  if(i>=0 && i<ROUND_ORDER.length-1) return { fn: enterRoundLike, arg: ROUND_ORDER[i+1] };
  if(i===ROUND_ORDER.length-1) return JUDGE_CAST ? { fn: enterBoss } : { fn: enterRoundLike, arg:'elitevolley' };
  if(key==='elitevolley') return { fn: enterFinaleOrGrand };
  if(key==='grandvolley') return { fn: enterCelebration };
  return { fn: enterCelebration };
}
function enterRoundLike(roundKey){
  phase = 'roundlike';
  phaseElapsed = 0;
  phaseData = { roundKey, stage:'intro', attempt:1 };
  activeTargets = []; butterfingers = null;
  setBeatMusic('dinner');
  maybeShowCard(roundKey);
  if(!CARDS[roundKey]) { activeCard = null; } // safety -- every roundKey above has a CARDS entry
}
function startRoundLikeAttempt(){
  const def = ROUND_DEFS[phaseData.roundKey];
  schedule = buildRoundSchedule(phaseData.roundKey, phaseData.attempt);
  scheduleIdx = 0;
  activeTargets = []; butterfingers = null;
  roundTimeLeft = def.duration;
  roundHits = 0;
  streakClean = true; meterCharge = 0; catchphraseCharged = false; usedCatchphraseThisRound = false;
  phaseData.stage = 'live';
  phaseData.roundStartT = gameT;
}
function checkSaviorRescue(def){
  if(!SAVIOR_CAST || saviorUsedThisGame || rescueUntil>gameT) return;
  const quotaRemaining = def.quota - roundHits;
  if(quotaRemaining<=0) return;
  const onScreen = activeTargets.filter(t=>t.kind==='roastable' && (t.state==='up'||t.state==='rising')).length;
  const feasibleSpawns = Math.floor(roundTimeLeft / def.spawnRange[0]);
  if(onScreen + feasibleSpawns < quotaRemaining){
    saviorUsedThisGame = true;
    rescueUntil = gameT + 3.0;
    roundTimeLeft = Math.max(roundTimeLeft, 3.0); // the rescue window itself buys enough time to cash it in
    // pop every remaining scheduled target for this round right now
    for(let i=scheduleIdx;i<schedule.length;i++){
      const ev = schedule[i];
      if(ev.kind==='roastable') spawnTargetFromEvent(ev, true);
    }
    scheduleIdx = schedule.length;
    if(actx) playSoftChime(actx.currentTime);
    showBanner((SAVIOR_CAST?CAST.savior.name:'A FRIEND')+' TIPS THE STALL!', 'GRAB EVERYTHING -- QUICK!', 3.0);
  }
}
function spawnTargetFromEvent(ev, rescueBoost){
  activeTargets.push({
    id: nextTargetId++, row: ev.row, slot: ev.slot, kind: ev.kind,
    labelIdx: ev.labelIdx, friendIdx: ev.friendIdx,
    state: 'rising', bornT: gameT, upDur: rescueBoost ? 3.2 : ev.up, vy: ev.vy,
    hitT: 0,
  });
}
function updateRoundLike(dt){
  const def = ROUND_DEFS[phaseData.roundKey];
  if(phaseData.stage==='intro'){
    if(!activeCard) startRoundLikeAttempt();
    return;
  }
  if(phaseData.stage==='retry'){
    if(!activeCard) startRoundLikeAttempt();
    return;
  }
  if(phaseData.stage==='clear'){
    if(gameT >= phaseData.clearUntil){
      const nxt = nextAfterRoundLike(phaseData.roundKey);
      nxt.arg!==undefined ? nxt.fn(nxt.arg) : nxt.fn();
    }
    return;
  }
  // stage === 'live'
  const inRoundT = gameT - phaseData.roundStartT;
  while(scheduleIdx<schedule.length && schedule[scheduleIdx].t<=inRoundT){
    const ev = schedule[scheduleIdx++];
    const concurrent = activeTargets.filter(t=>t.state==='up'||t.state==='rising').length + (butterfingers?1:0);
    if(ev.kind==='butterfingers'){
      if(!butterfingers) spawnButterfingers(ev);
    } else if(concurrent < def.maxConcurrent){
      // never place two live targets in the exact same row+slot
      const occupied = activeTargets.some(t=>(t.state==='up'||t.state==='rising') && t.row===ev.row && t.slot===ev.slot);
      if(!occupied) spawnTargetFromEvent(ev, false);
    }
  }
  updateActiveTargets(dt);
  updateButterfingers(dt);
  if(rescueUntil<=gameT){
    roundTimeLeft -= dt;
    checkSaviorRescue(def);
  }
  if(roundHits >= def.quota){
    if(actx) playFanfare(actx.currentTime);
    showBanner(def.label+' CLEAR!', null, 1.4);
    phaseData.stage = 'clear';
    phaseData.clearUntil = gameT + 1.5;
    activeTargets = []; butterfingers = null;
    return;
  }
  if(roundTimeLeft<=0){
    if(actx){ playSadGliss(actx.currentTime); }
    setBeatMusic('sad');
    activeTargets = []; butterfingers = null;
    phaseData.attempt++;
    phaseData.stage = 'retry';
    showRetryCard(def.label);
  }
}
function updateActiveTargets(dt){
  for(const t of activeTargets){
    const age = gameT - t.bornT;
    if(t.state==='rising' && age>=RISE_DURATION) t.state = 'up';
    else if(t.state==='up' && age>=RISE_DURATION+t.upDur){ t.state='ducking'; t.duckAt=gameT; }
    else if(t.state==='ducking' && (gameT-t.duckAt)>=DUCK_DURATION) t.state='gone';
    else if(t.state==='hit' && (gameT-t.hitT)>=0.35) t.state='gone';
  }
  activeTargets = activeTargets.filter(t=>t.state!=='gone');
}
function spawnButterfingers(ev){
  const fromLeft = rngInt(gameRng, 2)===0;
  butterfingers = {
    row: ev.row, x: fromLeft?-60:CW+60, dir: fromLeft?1:-1,
    speed: (CW+120)/BUTTERFINGERS_CROSS_TIME, state:'moving',
  };
}
function updateButterfingers(dt){
  if(!butterfingers) return;
  if(butterfingers.state==='moving'){
    butterfingers.x += butterfingers.speed*butterfingers.dir*dt;
    if(butterfingers.x < -80 || butterfingers.x > CW+80) butterfingers = null;
  } else if(butterfingers.state==='hit' && (gameT-butterfingers.hitT)>=0.4){
    butterfingers = null;
  }
}
function butterfingersStackPos(){
  const row = ROWS[butterfingers.row];
  return { x: butterfingers.x + 26*butterfingers.dir, y: row.y - 30*row.scale, scale: row.scale };
}
function butterfingersBodyPos(){
  const row = ROWS[butterfingers.row];
  return { x: butterfingers.x, y: row.y, scale: row.scale };
}

/* ======================================================================
   HIT DETECTION -- one entry point (fireAt) for mouse click, touch tap,
   and keyboard/gamepad action alike (see SPEC-gallery.md: "also what the
   harness driver uses" -- a future tools/verify-gallery.js can call this
   exact function with scheduled targets' known positions).
   ====================================================================== */
function dist(x1,y1,x2,y2){ return Math.hypot(x1-x2, y1-y2); }
function targetDrawPos(t){
  const row = ROWS[t.row];
  let y = row.y;
  if(t.state==='rising'){ const p = Math.min(1,(gameT-t.bornT)/RISE_DURATION); y = row.y + (1-p)*44; }
  else if(t.state==='ducking'){ const p = Math.min(1,(gameT-t.duckAt)/DUCK_DURATION); y = row.y + p*44; }
  return { x: slotX(t.slot) + t.vy*0.3, y, scale: row.scale };
}
const TARGET_HIT_RADIUS_BASE = 48, FRIEND_HIT_RADIUS_BASE = 34;
function fireAt(x,y){
  stats.shotsFired++;
  if(catchphraseCharged){ triggerCatchphrase(); return; }
  if(phase==='roundlike' && phaseData.stage==='live'){ fireAtRoundLike(x,y); return; }
  if(phase==='boss' && (phaseData.stage==='live'||phaseData.stage==='phase2')){ fireAtBoss(x,y); return; }
  if(phase==='finale' && phaseData.stage==='live'){ fireAtFinale(x,y); return; }
  stats.shotsFired--; // not a real "shot" outside live gameplay -- doesn't count against accuracy
}
function fireAtRoundLike(x,y){
  if(butterfingers && butterfingers.state==='moving'){
    const sp = butterfingersStackPos();
    if(dist(x,y,sp.x,sp.y) < 30*sp.scale){ applyButterfingersStackHit(); return; }
    const bp = butterfingersBodyPos();
    if(dist(x,y,bp.x,bp.y) < 34*bp.scale){ applyFriendPenalty(fmt(CAST.butterfingers?CAST.butterfingers.name:'THEM')); butterfingers.state='hit'; butterfingers.hitT=gameT; return; }
  }
  for(const t of activeTargets){
    if(t.state!=='up') continue;
    const pos = targetDrawPos(t);
    const r = (t.kind==='roastable' ? TARGET_HIT_RADIUS_BASE : FRIEND_HIT_RADIUS_BASE) * pos.scale;
    if(dist(x,y,pos.x,pos.y) < r){
      if(t.kind==='roastable') applyRoastableHit(t);
      else { applyFriendPenalty(FRIEND_POOL[t.friendIdx].name); t.state='hit'; t.hitT=gameT; }
      return;
    }
  }
  applyMiss();
}
function applyRoastableHit(t){
  t.state = 'hit'; t.hitT = gameT;
  roundHits++;
  stats.hits++; stats.score += 10;
  const label = GALLERY_TARGETS[t.labelIdx];
  stats.perRoastable[label] = (stats.perRoastable[label]||0) + 1;
  stats.curStreak++; stats.bestStreak = Math.max(stats.bestStreak, stats.curStreak);
  if(streakClean && !usedCatchphraseThisRound){
    meterCharge = Math.min(1, meterCharge + CHARGE_PER_HIT);
    if(meterCharge>=1 && !catchphraseCharged){ catchphraseCharged = true; if(actx) playHaBlip(actx.currentTime); }
  }
  if(actx) playPop(actx.currentTime);
  const pos = targetDrawPos(t);
  spawnSparkleBurst(pos.x, pos.y, 7, gameT);
  spawnHaBurst(pos.x, pos.y-20, gameT);
}
function applyButterfingersStackHit(){
  butterfingers.state = 'hit'; butterfingers.hitT = gameT;
  stats.hits++; stats.score += 40; stats.butterfingersBonus++;
  stats.curStreak++; stats.bestStreak = Math.max(stats.bestStreak, stats.curStreak);
  if(streakClean && !usedCatchphraseThisRound){
    meterCharge = Math.min(1, meterCharge + CHARGE_PER_HIT);
    if(meterCharge>=1 && !catchphraseCharged){ catchphraseCharged = true; if(actx) playHaBlip(actx.currentTime); }
  }
  if(actx) playGlassShatter(actx.currentTime);
  triggerShake(3, 0.15);
  const sp = butterfingersStackPos();
  spawnGlassShards(sp.x, sp.y, gameT);
}
function applyFriendPenalty(name){
  stats.friendHits++; stats.misses++; stats.score = Math.max(0, stats.score-15);
  stats.curStreak = 0; streakClean = false; meterCharge = 0; catchphraseCharged = false;
  if(actx) playGroan(actx.currentTime);
  triggerShake(4, 0.25);
  showBanner('HEY!', name.toUpperCase(), 1.1);
}
function applyMiss(){
  stats.misses++; stats.curStreak = 0; streakClean = false; meterCharge = 0; catchphraseCharged = false;
  if(actx) playWhoosh(actx.currentTime);
}
function triggerCatchphrase(){
  usedCatchphraseThisRound = true; catchphraseCharged = false; meterCharge = 0;
  if(actx) playSlamBoom(actx.currentTime);
  sayPunchline();
  triggerShake(10, 0.5);
  timeScale = SLOWMO_SCALE; slowMoTimer = SLOWMO_DURATION;
  showBanner(CONFIG.punchline, null, 1.8);
  for(const t of activeTargets){
    if(t.kind==='roastable' && (t.state==='up'||t.state==='rising')) applyRoastableHit(t);
  }
}
let slowMoTimer = 0;

/* ======================================================================
   THE FIRST BOSS -- a jumbo target of the judge, swinging across the
   curtain rope. Uncast -> 'elitevolley' (a round-like phase) is used
   instead; see nextAfterRoundLike/enterFinaleOrGrand.
   ====================================================================== */
const BOSS_Y = 168, BOSS_AMPLITUDE = 300, BOSS_HIDDEN_SIN = 0.90;
const BOSS_PHASE1_PERIOD = 3.4, BOSS_PHASE2_PERIOD = 2.2;
const BOSS_PHASE1_HITS = 3, BOSS_PHASE2_HITS = 3;
const BOSS_HIT_RADIUS = 78;
function enterBoss(){
  phase = 'boss'; phaseElapsed = 0; phaseData = { stage:'intro' };
  boss = { hitsLanded:0, x:CW/2, exposed:true, phaseStartT:0, flinchUntil:0, heckleUntil:0, heckleArmed:true };
  setBeatMusic('boss');
  maybeShowCard('boss');
}
function updateBoss(dt){
  if(phaseData.stage==='intro'){
    if(!activeCard){ boss.phaseStartT = gameT; phaseData.stage = 'live'; }
    return;
  }
  if(phaseData.stage==='fakedeath'){
    const el = gameT - phaseData.fakeDeathT;
    if(!phaseData.scratchFired && el>=1.1){
      phaseData.scratchFired = true;
      if(actx) playRecordScratch(actx.currentTime);
      triggerShake(8, 0.35);
      showBanner('JUST KIDDING.', null, 1.3);
    }
    if(el>=2.4){ boss.phaseStartT = gameT; phaseData.stage = 'phase2'; boss.heckleArmed = true; }
    return;
  }
  if(phaseData.stage==='win'){
    if(gameT>=phaseData.winUntil) enterFinaleOrGrand();
    return;
  }
  // 'live' (phase1) or 'phase2'
  const period = phaseData.stage==='phase2' ? BOSS_PHASE2_PERIOD : BOSS_PHASE1_PERIOD;
  const localT = gameT - boss.phaseStartT;
  const s = Math.sin((localT/period)*Math.PI*2);
  boss.x = CW/2 + s*BOSS_AMPLITUDE;
  boss.exposed = Math.abs(s) < BOSS_HIDDEN_SIN;
  if(boss.exposed && boss.heckleArmed && Math.abs(s)<0.08){
    boss.heckleArmed = false;
    boss.heckleUntil = gameT + 2.2;
  }
  if(Math.abs(s)>0.6) boss.heckleArmed = true;
}
function fireAtBoss(x,y){
  if(!boss.exposed){ applyMiss(); return; }
  if(dist(x,y,boss.x,BOSS_Y) < BOSS_HIT_RADIUS){
    boss.hitsLanded++;
    boss.flinchUntil = gameT+0.3;
    stats.hits++; stats.score += (phaseData.stage==='phase2'?35:25);
    if(actx) playPop(actx.currentTime);
    triggerShake(3, 0.15);
    spawnSparkleBurst(boss.x, BOSS_Y, 6, gameT);
    if(phaseData.stage==='live' && boss.hitsLanded>=BOSS_PHASE1_HITS){ enterBossFakeDeath(); }
    else if(phaseData.stage==='phase2' && boss.hitsLanded>=BOSS_PHASE1_HITS+BOSS_PHASE2_HITS){ enterBossWin(); }
  } else {
    applyMiss();
  }
}
function enterBossFakeDeath(){
  phaseData.stage = 'fakedeath'; phaseData.fakeDeathT = gameT; phaseData.scratchFired = false;
  if(actx) playJingleStart(actx.currentTime);
  showBanner((JUDGE_CAST?CAST.judge.name:'THE CRITIC')+' SLUMPS OVER...', null, 1.0);
}
function enterBossWin(){
  phaseData.stage = 'win';
  if(actx) playFanfare(actx.currentTime);
  showBanner('BOSS DOWN!', null, 1.6);
  phaseData.winUntil = gameT + 1.8;
  spawnSparkleBurst(CW/2, BOSS_Y, 14, gameT);
}

/* ======================================================================
   THE FINAL BOSS -- every slot pops the authority's face; the REAL slot
   bobs (the tell), fakes stay static. Uncast -> 'grandvolley' (a
   round-like phase) instead; see enterFinaleOrGrand.
   ====================================================================== */
const FINALE_SLOT_DEFS = [
  {row:0,slot:1},{row:0,slot:3}, {row:1,slot:1},{row:1,slot:3}, {row:2,slot:1},{row:2,slot:3},
];
const FINALE_WAVES = 3, FINALE_TIME_TOTAL = 30, FINALE_WRONG_PENALTY = 4, FINALE_REVEAL_HOLD = 1.4;
function enterFinaleOrGrand(){ AUTHORITY_CAST ? enterFinale() : enterRoundLike('grandvolley'); }
function enterFinale(){
  phase = 'finale'; phaseElapsed = 0; phaseData = { stage:'intro', attempt:1 };
  finale = { wave:0, timeLeft:FINALE_TIME_TOTAL, slots:[], realIdx:-1, revealUntil:0 };
  setBeatMusic('chase');
  maybeShowCard('finale');
}
function startFinaleWave(){
  const rng = makeRng(GAME_SEED_BASE+':gallery:finale:'+phaseData.attempt+':'+finale.wave);
  finale.realIdx = rngInt(rng, FINALE_SLOT_DEFS.length);
  finale.slots = FINALE_SLOT_DEFS.map((d,i)=>({ row:d.row, slot:d.slot, real:i===finale.realIdx, hit:false, wrongFlash:0 }));
  finale.waveStartT = gameT;
}
function updateFinale(dt){
  if(phaseData.stage==='intro'){
    if(!activeCard){ finale.wave = 1; startFinaleWave(); phaseData.stage = 'live'; }
    return;
  }
  if(phaseData.stage==='retry'){
    if(!activeCard){ phaseData.attempt++; finale.timeLeft = FINALE_TIME_TOTAL; finale.wave = 1; startFinaleWave(); phaseData.stage = 'live'; }
    return;
  }
  if(phaseData.stage==='live'){
    finale.timeLeft -= dt;
    if(finale.timeLeft<=0){
      if(actx) playSadGliss(actx.currentTime);
      setBeatMusic('sad');
      phaseData.stage = 'retry';
      showRetryCard('THE FINAL BOSS');
    }
    return;
  }
  if(phaseData.stage==='wavewin'){
    if(gameT>=finale.revealUntil){
      if(finale.wave>=FINALE_WAVES) enterFinaleWinScene();
      else { finale.wave++; startFinaleWave(); phaseData.stage='live'; }
    }
    return;
  }
  // 'win' stage
  if(gameT>=phaseData.winUntil) enterCelebration();
}
function fireAtFinale(x,y){
  for(const s of finale.slots){
    if(s.hit) continue;
    const row = ROWS[s.row];
    const pos = { x: slotX(s.slot), y: row.y - 6, scale: row.scale };
    if(dist(x,y,pos.x,pos.y) < 50*pos.scale){
      if(s.real){
        s.hit = true;
        stats.hits++; stats.score += 50;
        if(actx) playFanfare(actx.currentTime);
        triggerShake(5, 0.2);
        showBanner('THAT\'S THEM!', finalBossQuirkLine, FINALE_REVEAL_HOLD);
        finale.revealUntil = gameT + FINALE_REVEAL_HOLD;
        phaseData.stage = 'wavewin';
      } else {
        finale.timeLeft = Math.max(0, finale.timeLeft - FINALE_WRONG_PENALTY);
        stats.misses++; stats.score = Math.max(0, stats.score-10);
        if(actx) playThud(actx.currentTime);
        triggerShake(3, 0.15);
        s.wrongFlash = gameT;
      }
      return;
    }
  }
  applyMiss();
}
function enterFinaleWinScene(){
  phaseData.stage = 'win';
  if(actx){ playFanfare(actx.currentTime); playRumble(actx.currentTime+0.2); }
  showBanner((AUTHORITY_CAST?CAST.authority.name:'THE BOSS')+' TURNS GOOD!', 'HANDS OVER THE PRIZE.', 2.2);
  phaseData.winUntil = gameT + 2.4;
  spawnSparkleBurst(CW/2, 260, 16, gameT);
}

/* ======================================================================
   CELEBRATION + END CARD
   ====================================================================== */
function enterCelebration(){
  phase = 'celebration'; phaseElapsed = 0; phaseData = {};
  setBeatMusic('celebration');
  if(actx) playFanfare(actx.currentTime);
  spawnHaBurst(CW/2, 300, gameT);
  spawnSparkleBurst(CW/2, 260, 20, gameT);
}
function updateCelebration(dt){
  if(phaseElapsed>=3.2) enterEndcard();
}
function computeRank(){
  const acc = stats.shotsFired ? stats.hits/stats.shotsFired : 0;
  if(acc>=0.85 && stats.bestStreak>=6) return CONFIG.rankNames.immaculate;
  if(acc>=0.55) return CONFIG.rankNames.comicTiming;
  return CONFIG.rankNames.worst;
}
function enterEndcard(){
  phase = 'endcard'; phaseElapsed = 0; phaseData = { rank: computeRank() };
  setBeatMusic('gameover');
}
function resetGame(){
  stats = { shotsFired:0, hits:0, misses:0, friendHits:0, bestStreak:0, curStreak:0, score:0, perRoastable:{}, butterfingersBonus:0 };
  for(const label of GALLERY_TARGETS) stats.perRoastable[label] = 0;
  saviorUsedThisGame = false; rescueUntil = 0;
  activeTargets = []; butterfingers = null; boss = null; finale = null;
  timeScale = 1; slowMoTimer = 0;
  cardsShown.title = false; cardsShown.round1 = false; cardsShown.round2 = false; cardsShown.round3 = false;
  cardsShown.elitevolley = false; cardsShown.boss = false; cardsShown.finale = false; cardsShown.grandvolley = false;
  phase = 'title'; phaseElapsed = 0; phaseData = {};
  activeCard = null;
}

/* ======================================================================
   UPDATE / ACTION DISPATCH
   ====================================================================== */
function update(dt){
  phaseElapsed += dt;
  if(phase==='title'){ /* nothing to simulate -- attract screen */ }
  else if(phase==='roundlike') updateRoundLike(dt);
  else if(phase==='boss') updateBoss(dt);
  else if(phase==='finale') updateFinale(dt);
  else if(phase==='celebration') updateCelebration(dt);
  else if(phase==='endcard'){ /* waits for input */ }
}
/* the one "advance/dismiss" action -- Space/gamepad-button0 on a screen
   with no live target to aim at, or a tap that lands on an activeCard.
   fireAt (above) handles the actual aiming/shooting; this only handles
   card dismissal and phase-to-phase advancement. */
function handleAction(){
  if(activeCard){ activeCard = null; return; }
  if(phase==='title'){ ensureAudioStarted(); enterRoundLike('round1'); return; }
  if(phase==='endcard'){ resetGame(); return; }
}
function pollGamepadFire(){
  if(rotatePromptActive) return;
  if(!navigator.getGamepads) return;
  let pads = [];
  try{ pads = navigator.getGamepads(); }catch(e){ return; }
  let pressed = false;
  for(const gp of pads){ if(gp && gp.buttons[0] && gp.buttons[0].pressed) pressed = true; }
  if(pressed && !gpAPrev){
    if(activeCard || phase==='title' || phase==='endcard') handleAction();
    else fireAt(crosshair.x, crosshair.y);
  }
  gpAPrev = pressed;
}

/* ======================================================================
   DRAW -- backdrop
   ====================================================================== */
function drawSky(ctx){
  const grad = ctx.createLinearGradient(0,0,0,340);
  grad.addColorStop(0, PAL.sky); grad.addColorStop(1, PAL.skyLow);
  ctx.fillStyle = grad; ctx.fillRect(0,0,CW,340);
  drawPacked(ctx, GALLERY_IMG.cloud1, 130, 70, 150);
  drawPacked(ctx, GALLERY_IMG.cloud2, 760, 50, 160);
  drawPacked(ctx, GALLERY_IMG.treeOak, 40, 300, 170);
  drawPacked(ctx, GALLERY_IMG.treePine, 910, 300, 150);
}
function drawStallStructure(ctx){
  // wood backdrop panel, stretched to fill the stall box
  const bx=60, by=150, bw=840, bh=330;
  if(GALLERY_IMG.bgWood.complete){
    ctx.imageSmoothingEnabled = false;
    // tile the 256x256 wood texture across the box rather than stretching
    // it (stretching a small tile that wide would smear badly)
    const tileW=256, tileH=256;
    for(let ty=by; ty<by+bh; ty+=tileH){
      for(let tx=bx; tx<bx+bw; tx+=tileW){
        ctx.drawImage(GALLERY_IMG.bgWood, tx, ty, Math.min(tileW,bx+bw-tx), Math.min(tileH,by+bh-ty));
      }
    }
  }
  // curtain top valance
  if(GALLERY_IMG.curtainTop.complete){
    const tw=200;
    for(let tx=bx; tx<bx+bw; tx+=tw) ctx.drawImage(GALLERY_IMG.curtainTop, tx, by-30, Math.min(tw,bx+bw-tx), 63);
  }
  // draped curtains at the sides
  drawPacked(ctx, GALLERY_IMG.curtain, bx+20, by+180, 90);
  ctx.save(); ctx.translate(bx+bw, 0); ctx.scale(-1,1);
  drawPacked(ctx, GALLERY_IMG.curtain, 20, by+180, 90);
  ctx.restore();
  // foreground grass strip along the base
  if(GALLERY_IMG.grass1.complete){
    const gw=132, gy=CH-70;
    for(let gx=0; gx<CW; gx+=gw) ctx.drawImage(GALLERY_IMG.grass1, gx, gy, Math.min(gw,CW-gx), 70);
  }
}
function drawStall(ctx){
  ctx.fillStyle = PAL.night; ctx.fillRect(0,0,CW,CH);
  drawSky(ctx);
  drawStallStructure(ctx);
}

/* ---------------- targets ---------------- */
function drawPlaque(ctx, cx, y, text, scale){
  const px = Math.max(9, Math.round(11*scale));
  const w = Math.min(220, 18 + text.length*px*0.62), h = px+14;
  ctx.save(); ctx.globalAlpha = 0.95;
  ctx.fillStyle = PAL.wood; ctx.fillRect(cx-w/2-2, y-2, w+4, h+4);
  ctx.fillStyle = PAL.cream; ctx.fillRect(cx-w/2, y, w, h);
  ctx.restore();
  drawReadingText(ctx, text, cx, y+3, px, PAL.ink, 'center');
}
function drawActiveTargets(ctx){
  const order = activeTargets.slice().sort((a,b)=>a.row-b.row);
  for(const t of order){
    const pos = targetDrawPos(t);
    const duckImg = GALLERY_IMG[DUCK_IMAGES[t.row]];
    if(t.kind==='roastable'){
      let alpha = 1;
      if(t.state==='hit') alpha = Math.max(0, 1-(gameT-t.hitT)/0.35);
      ctx.save(); ctx.globalAlpha = alpha;
      drawPacked(ctx, duckImg, pos.x, pos.y, 96*pos.scale);
      ctx.restore();
      if(t.state!=='hit') drawPlaque(ctx, pos.x, pos.y+44*pos.scale, GALLERY_TARGETS[t.labelIdx], pos.scale);
      else { // the plaque "spins off" -- a quick rightward flick + fade
        const p = (gameT-t.hitT)/0.35;
        ctx.save(); ctx.globalAlpha = Math.max(0,1-p); ctx.translate(pos.x+p*70, pos.y+44*pos.scale); ctx.rotate(p*2.2);
        drawPlaque(ctx, 0, 0, GALLERY_TARGETS[t.labelIdx], pos.scale); ctx.restore();
      }
    } else { // friend -- roster sprite on a stick, waving
      const f = FRIEND_POOL[t.friendIdx];
      let alpha = 1;
      if(t.state==='hit') alpha = Math.max(0, 1-(gameT-t.hitT)/0.35);
      ctx.save(); ctx.globalAlpha = alpha;
      drawPacked(ctx, GALLERY_IMG.stickWood, pos.x, pos.y+18*pos.scale, 22*pos.scale);
      const wave = Math.sin(gameT*4 + t.id)*4;
      drawRosterSprite(ctx, f.sprite.sheet, f.sprite.col, f.sprite.row, pos.x-8*pos.scale+wave*0.3, pos.y-40*pos.scale, 5*pos.scale, false);
      ctx.restore();
      if(t.state==='hit' && (gameT-t.hitT)<0.9) drawAutoBubble(ctx, ['HEY!', f.name.toUpperCase()], pos.x, pos.y-46*pos.scale, 13, Math.min(1,(gameT-t.hitT)/0.15));
    }
  }
}
function drawButterfingersEnt(ctx){
  if(!butterfingers) return;
  const bp = butterfingersBodyPos(), sp = butterfingersStackPos();
  let alpha = 1;
  if(butterfingers.state==='hit') alpha = Math.max(0, 1-(gameT-butterfingers.hitT)/0.4);
  ctx.save(); ctx.globalAlpha = alpha;
  const sprite = BUTTERFINGERS_CAST ? rosterResolveSprite(CAST.butterfingers, 3, 8) : rosterResolveSprite(null, 3, 8);
  drawRosterSprite(ctx, sprite.sheet, sprite.col, sprite.row, bp.x-8*bp.scale, bp.y-40*bp.scale, 5*bp.scale, butterfingers.dir<0);
  if(butterfingers.state==='moving' || (gameT-butterfingers.hitT)<0.15) drawPlateStack(ctx, sp.x-16*sp.scale, sp.y-16*sp.scale, 4*sp.scale);
  ctx.restore();
}

/* ---------------- THE FIRST BOSS ---------------- */
function drawBoss(ctx){
  if(!boss) return;
  // the rope
  if(GALLERY_IMG.curtainRope.complete){
    ctx.imageSmoothingEnabled = false;
    for(let x=90;x<CW-90;x+=40) ctx.drawImage(GALLERY_IMG.curtainRope, x, BOSS_Y-12, 40, 21);
  }
  const sprite = JUDGE_CAST ? rosterResolveSprite(CAST.judge, 4, 8) : rosterResolveSprite(null, 4, 8);
  const y = boss.exposed ? BOSS_Y : BOSS_Y+34;
  const scale = boss.exposed ? 8.5 : 5;
  const flinch = (gameT<boss.flinchUntil) ? 1.1 : 1.0;
  const slumped = phaseData.stage==='fakedeath';
  ctx.save();
  ctx.translate(boss.x, y);
  if(slumped) ctx.rotate(0.25);
  ctx.scale(flinch, flinch);
  drawRosterSprite(ctx, sprite.sheet, sprite.col, sprite.row, -TILE*scale/2, -TILE*scale, scale, false);
  ctx.restore();
  if(boss.exposed && gameT<boss.heckleUntil){
    drawAutoBubble(ctx, firstBossHeckleLine, boss.x, y-TILE*scale-8, 14, 1);
  }
}

/* ---------------- THE FINAL BOSS ---------------- */
function drawFinale(ctx){
  if(!finale || !finale.slots.length) return;
  const sprite = AUTHORITY_CAST ? rosterResolveSprite(CAST.authority, 0, 7) : rosterResolveSprite(null, 0, 7);
  for(const s of finale.slots){
    if(s.hit && phaseData.stage!=='wavewin') continue;
    const row = ROWS[s.row];
    const x = slotX(s.slot);
    let y = row.y - 6;
    if(s.real && phaseData.stage==='live') y += Math.sin(gameT*6)*6; // the tell -- only the real slot bobs
    let flash = (gameT-s.wrongFlash)<0.2;
    ctx.save();
    if(flash) ctx.globalAlpha = 0.5;
    drawPacked(ctx, GALLERY_IMG.targetWhite, x, y, 70*row.scale);
    drawRosterSprite(ctx, sprite.sheet, sprite.col, sprite.row, x-9*row.scale, y-18*row.scale, 5.4*row.scale, false);
    ctx.restore();
    if(s.hit && s.real) spawnSparkleBurst(x, y, 1, gameT); // gentle continuous sparkle while the reveal holds -- cheap, only 1 particle/frame
  }
}

/* ---------------- HUD: host chip, barker chip, crosshair + rifle, quota/
   timer/meter, banners ---------------- */
function drawHostChip(ctx){
  const hostSprite = rosterResolveSprite(CONFIG.host, 2, 7);
  const x=14, y=CH-58, w=190, h=44;
  ctx.save(); ctx.globalAlpha=0.92;
  ctx.fillStyle=PAL.wood; ctx.fillRect(x-2,y-2,w+4,h+4);
  ctx.fillStyle='#1a1410'; ctx.fillRect(x,y,w,h);
  ctx.restore();
  drawRosterSprite(ctx, hostSprite.sheet, hostSprite.col, hostSprite.row, x+6, y+4, 2.2, false);
  drawReadingText(ctx, (CONFIG.host&&CONFIG.host.name||'YOU')+"'S TURN", x+46, y+14, 13, PAL.cream, 'left');
}
function drawBarkerChip(ctx){
  const x=14, y=14, w=220, h=44;
  ctx.save(); ctx.globalAlpha=0.92;
  ctx.fillStyle=PAL.wood; ctx.fillRect(x-2,y-2,w+4,h+4);
  ctx.fillStyle='#1a1410'; ctx.fillRect(x,y,w,h);
  ctx.restore();
  if(BUILDER_CAST){
    const s = rosterResolveSprite(CAST.builder, 2, 8);
    drawRosterSprite(ctx, s.sheet, s.col, s.row, x+6, y+4, 2.2, false);
    drawReadingText(ctx, CAST.builder.name, x+46, y+8, 12, PAL.cream, 'left');
    drawReadingText(ctx, 'RUNS THE STALL', x+46, y+24, 10, PAL.gold, 'left');
  } else {
    ctx.save(); ctx.fillStyle=PAL.wood; ctx.fillRect(x+6,y+6,32,32); ctx.fillStyle=PAL.cream; ctx.fillRect(x+10,y+10,24,24); ctx.restore();
    drawReadingText(ctx, 'THE STALL', x+46, y+8, 12, PAL.cream, 'left');
    drawReadingText(ctx, '(A SIGN RUNS THIS ONE)', x+46, y+24, 9, PAL.gold, 'left');
  }
}
function drawCrosshairAndRifle(ctx){
  const pivotX=CW/2, pivotY=CH+8;
  const ang = Math.atan2(crosshair.y-pivotY, crosshair.x-pivotX) + Math.PI/2;
  if(GALLERY_IMG.rifle.complete){
    ctx.save();
    ctx.translate(pivotX, pivotY);
    ctx.rotate(ang*0.35); // dampened -- a full swing would point the barrel offscreen at the extremes
    ctx.imageSmoothingEnabled = false;
    const w=90, h=w*(GALLERY_IMG.rifle.naturalHeight/GALLERY_IMG.rifle.naturalWidth);
    ctx.drawImage(GALLERY_IMG.rifle, -w/2, -h+10, w, h);
    ctx.restore();
  }
  drawPacked(ctx, GALLERY_IMG.crosshairImg, crosshair.x, crosshair.y, 40);
}
const HUD_QUOTA_ROUNDLIKE = true;
function drawRoundHUD(ctx){
  if(phase==='roundlike' && (phaseData.stage==='live')){
    const def = ROUND_DEFS[phaseData.roundKey];
    drawReadingText(ctx, def.label, CW/2, 16, 16, PAL.gold, 'center');
    drawReadingText(ctx, 'HIT '+roundHits+' / '+def.quota, CW/2, 38, 14, PAL.cream, 'center');
    drawReadingText(ctx, 'TIME '+Math.max(0,Math.ceil(roundTimeLeft)), CW/2, 58, 13, roundTimeLeft<6?PAL.friendBad:PAL.cream, 'center');
  } else if(phase==='finale' && (phaseData.stage==='live'||phaseData.stage==='wavewin')){
    drawReadingText(ctx, 'WAVE '+finale.wave+' / '+FINALE_WAVES, CW/2, 16, 16, PAL.gold, 'center');
    drawReadingText(ctx, 'TIME '+Math.max(0,Math.ceil(finale.timeLeft)), CW/2, 38, 14, finale.timeLeft<8?PAL.friendBad:PAL.cream, 'center');
  } else if(phase==='boss'){
    const total = BOSS_PHASE1_HITS+BOSS_PHASE2_HITS;
    drawReadingText(ctx, 'HITS '+boss.hitsLanded+' / '+total, CW/2, 16, 16, PAL.gold, 'center');
  }
  // catchphrase meter -- only meaningful during round-like phases (spec:
  // "clears all active roastables")
  if(phase==='roundlike' && phaseData.stage==='live' && !usedCatchphraseThisRound){
    const mx=CW/2-90, my=68, mw=180, mh=12;
    ctx.save(); ctx.fillStyle='#1a1410'; ctx.fillRect(mx-2,my-2,mw+4,mh+4);
    ctx.fillStyle = catchphraseCharged ? PAL.gold : '#5c4a26';
    ctx.fillRect(mx,my,mw*meterCharge,mh);
    ctx.restore();
    if(catchphraseCharged && Math.floor(gameT*3)%2===0){
      drawReadingText(ctx, 'SAY IT! ('+(isTouch?'TAP':'SPACE')+')', CW/2, my+18, 13, PAL.gold, 'center');
    }
  }
  drawReadingText(ctx, 'SCORE '+stats.score, CW-14, 46, 14, PAL.cream, 'right');
}
function drawBanner(ctx){
  if(!bannerText || gameT>=bannerUntil) return;
  const p = Math.min(1, (bannerUntil-gameT)>1.3 ? (1.6-(bannerUntil-gameT))/0.3 : 1);
  ctx.save(); ctx.globalAlpha = Math.min(1,p);
  drawChunkyText(ctx, bannerText, CW/2, 130, 30, PAL.gold, PAL.outline, 'center');
  if(bannerSub) drawReadingText(ctx, bannerSub, CW/2, 170, 15, PAL.cream, 'center');
  ctx.restore();
}
function drawTitleScreen(ctx){
  drawChunkyText(ctx, CARDS.title.title, CW/2, 190, 42, PAL.gold, PAL.outline, 'center');
  let y = 260;
  for(const line of CARDS.title.body){ drawReadingText(ctx, line, CW/2, y, 16, PAL.cream, 'center'); y += 28; }
  if(Math.floor(gameT*2)%2===0) drawReadingText(ctx, isTouch?'TAP TO START':'PRESS SPACE TO START', CW/2, y+16, 15, PAL.gold, 'center');
}
function drawEndcard(ctx){
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,CW,CH);
  drawChunkyText(ctx, CONFIG.punchline, CW/2, 56, 30, PAL.gold, PAL.outline, 'center');
  let y = 110;
  drawReadingText(ctx, 'SCORE: '+stats.score, CW/2, y, 17, PAL.cream, 'center'); y+=26;
  const acc = stats.shotsFired ? Math.round(100*stats.hits/stats.shotsFired) : 0;
  drawReadingText(ctx, 'ACCURACY: '+acc+'%', CW/2, y, 17, PAL.cream, 'center'); y+=26;
  drawReadingText(ctx, 'BEST STREAK: '+stats.bestStreak, CW/2, y, 17, PAL.cream, 'center'); y+=30;
  const cols = Math.min(2, Math.ceil(GALLERY_TARGETS.length/4));
  const perCol = Math.ceil(GALLERY_TARGETS.length/cols);
  const colW = 420;
  for(let i=0;i<GALLERY_TARGETS.length;i++){
    const col = Math.floor(i/perCol), row = i%perCol;
    const label = GALLERY_TARGETS[i];
    const cx = CW/2 - (colW*cols)/2 + col*colW + colW/2;
    drawReadingText(ctx, label+' DOWNED: '+(stats.perRoastable[label]||0), cx, y+row*22, 13, PAL.cream, 'center');
  }
  y += perCol*22 + 16;
  drawReadingText(ctx, phaseData.rank, CW/2, y, 22, PAL.gold, 'center'); y += 34;
  drawReadingText(ctx, 'SEND THIS ONE TO THE GROUP CHAT.', CW/2, y, 13, PAL.cream, 'center'); y += 30;
  if(Math.floor(gameT*2)%2===0) drawReadingText(ctx, isTouch?'TAP TO PLAY AGAIN':'PRESS SPACE TO PLAY AGAIN', CW/2, y, 14, PAL.gold, 'center');
}
/* full-screen "turn your phone" gate -- deliberately its own copy, not
   moved to shared/framework.js; see that file's header (drawRotatePrompt
   is the one documented case where the two existing engines already
   genuinely differ, and a third engine differing too doesn't change that
   call). */
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
  drawStall(ctx);
  if(phase==='title'){
    drawTitleScreen(ctx);
  } else if(phase==='endcard'){
    drawEndcard(ctx);
  } else {
    drawActiveTargets(ctx);
    drawButterfingersEnt(ctx);
    if(phase==='boss') drawBoss(ctx);
    if(phase==='finale') drawFinale(ctx);
    updateAndDrawParticles(ctx, 0, gameT); // draws whatever spawnXxx calls above just queued
    drawHostChip(ctx);
    drawBarkerChip(ctx);
    drawRoundHUD(ctx);
    drawBanner(ctx);
    if(phase!=='celebration') drawCrosshairAndRifle(ctx);
  }
}

/* ======================================================================
   INPUT -- crosshair aiming: mouse move + click, touch tap-to-shoot,
   arrows/stick + action for keyboard/gamepad (getMoveVector/keys are
   shared/framework.js's input layer -- see its header). Mouse sets the
   crosshair directly to the pointer position every move; touch fires
   immediately on tap (no separate aim step); keyboard/gamepad steer the
   crosshair by velocity and fire on the action key/button.
   ====================================================================== */
const CROSSHAIR_SPEED = 520;
window.addEventListener('keydown', (e)=>{
  keys[e.code] = true;
  ensureAudioStarted();
  if(e.code==='KeyM' && !e.repeat){ toggleMute(); return; }
  if(rotatePromptActive) return;
  if(e.code==='Space' && !e.repeat){
    if(activeCard || phase==='title' || phase==='endcard') handleAction();
    else fireAt(crosshair.x, crosshair.y);
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e)=>{ keys[e.code] = false; });
window.addEventListener('pointerdown', (e)=>{
  ensureAudioStarted();
  const p = screenToLogical(e.clientX, e.clientY);
  if(handleVolumePointerdown(p.x, p.y)) return;
  if(e.pointerType!=='touch'){
    crosshair.x = p.x; crosshair.y = p.y;
    if(activeCard || phase==='title' || phase==='endcard') handleAction();
    else if(!rotatePromptActive) fireAt(p.x, p.y);
    return;
  }
  isTouch = true;
  if(rotatePromptActive) return;
  touchActionPointerId = e.pointerId;
  crosshair.x = p.x; crosshair.y = p.y;
  if(activeCard || phase==='title' || phase==='endcard') handleAction();
  else fireAt(p.x, p.y); // tap-to-shoot -- no separate aim step on touch
});
window.addEventListener('pointermove', (e)=>{
  if(e.pointerType==='touch') return; // touch aims by tapping, not dragging
  const p = screenToLogical(e.clientX, e.clientY);
  crosshair.x = p.x; crosshair.y = p.y;
});
window.addEventListener('pointerup', (e)=>{ if(touchActionPointerId===e.pointerId) touchActionPointerId=null; });
window.addEventListener('pointercancel', (e)=>{ if(touchActionPointerId===e.pointerId) touchActionPointerId=null; });
window.addEventListener('load', ()=>{ try{ ensureAudioStarted(); }catch(e){} });

/* ======================================================================
   MAIN LOOP -- same frame()/rAF shape every engine uses (see
   game/engine.js's identical structure); tick(dt) is factored out as its
   own named function so a future harness (or this round's own
   verification pass) can drive frames manually without duplicating this
   logic, the same way tools/verify-config.js's __tick already does for
   game/engine.js.
   ====================================================================== */
function tick(dtRaw){
  if(slowMoTimer>0){ slowMoTimer -= dtRaw; if(slowMoTimer<=0){ slowMoTimer=0; timeScale=1; } }
  const dt = dtRaw*timeScale;
  gameT += dt;
  // keyboard/gamepad crosshair steering -- mouse/touch already set
  // crosshair directly in their own listeners above, so this only ever
  // moves it when arrow/stick input is actually held
  const mv = getMoveVector();
  if(mv.dx || mv.dy){
    crosshair.x = Math.max(60, Math.min(CW-60, crosshair.x + mv.dx*CROSSHAIR_SPEED*dt));
    crosshair.y = Math.max(140, Math.min(CH-40, crosshair.y + mv.dy*CROSSHAIR_SPEED*dt));
  }
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
  pollGamepadFire();
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
