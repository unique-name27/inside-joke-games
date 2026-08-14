'use strict';
/* ======================================================================
   THE DEFENSE -- template #4 engine (see SPEC-defense.md). Single page,
   no separate intro (a short title/attract screen lives inside this
   file, below). Built ON shared/framework.js, following the exact
   conventions flight/engine.js already established for this project's
   non-hangout templates (ENGINE_ROOT/CFG_FRAGMENT resolution, local
   CW/CH + eager fitCanvas() call, local SFX_DEFS/MUSIC_LOOP_DEFS +
   wrapper functions, local pixel-primitive helpers, local
   drawRotatePrompt, tick()/update()/draw() factored the same way)
   rather than inventing a new pattern.

   ROUND 1 SCOPE (this file): the full one-screen tower defense --
   cast-as-towers (auto-placed in seeded order, optional between-wave pad
   swap), the priority-target tap loop, seeded waves with verbatim label
   banners and per-enemy mini-plaques, THE FIRST BOSS's sniper heckle,
   THE SAVIOR's leak-triggered teleport + support aura, BUTTERFINGERS'
   seeded unaimed AoE drops, THE BUILDER's per-wave barricade, THE FINAL
   BOSS's last-wave jumbo unit + turn-good mini-wave, THE RALLY
   catchphrase, the checkpoint retry loop, the wave HP budget scaled to
   placed-tower DPS (host-only winnable), and the end card. What round 1
   does NOT do (round 2 per SPEC-defense.md's build plan): the wizard's
   annoyance step / defenseField cast lines, tools/generate.js support,
   and a registered harness driver (tools/verify-defense.js) -- this file
   exposes plain top-level functions (tick/handleAction/setPriorityAt)
   exactly the way flight/engine.js does, so wiring a future harness is a
   thin wrapper, not a rewrite.
   ====================================================================== */

const ENGINE_ROOT = new URL('../', document.currentScript.src).href;

/* URL-fragment CONFIG override -- identical mechanism/rationale to
   flight/engine.js's own (see that file's header). `cfgBuildDefaultConfig`
   is called with the THIRD arg 'defense' so a no-fragment boot builds a
   defense-shaped default (not the hangout's) -- see SPEC-flight.md's
   build plan note (which SPEC-defense.md explicitly inherits) about not
   repeating the redirect-path gap the gallery patched defensively. */
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
  CONFIG = cfgBuildDefaultConfig(ENGINE_ROOT, undefined, 'defense');
}
// defensive default -- mirrors flight/engine.js's own CONFIG.flight guard
// exactly (see that file's comment): the brief window before the redirect
// above actually navigates away still needs this file to not crash on
// CONFIG.defense.* references.
if(!CONFIG.defense) CONFIG.defense = {
  defending: 'THE COUCH',
  waves: ['THE NOTIFICATIONS', 'THE LATECOMERS', 'THE LEFTOVER DISHES', 'THE GROUP CHAT'],
};

document.title = (CONFIG.title && CONFIG.title.gamePageTitle) || 'The Defense -- Playable Demo';

/* ---------------- constants & palette ---------------- */
const CW = 960, CH = 540, TILE = 16, PACK_TILE = 64;
// fitCanvas() (shared/framework.js) reads CW/CH -- see flight/engine.js's
// identical comment for why the one initial call has to happen here.
fitCanvas();
const PAL = {
  cream:'#f3e9d2', wood:'#8a5a30', night:'#141428', gold:'#e8b84b', outline:'#6b2b1f', ink:'#2a1c12',
  grass:'#3ecc71', grassDark:'#2fae60', heartFull:'#c9394a', heartEmpty:'#3a2a20', rangeRing:'rgba(232,184,75,0.18)',
};

/* ---------------- CONFIG-derived helpers -- {HOST} token, same as every
   other template ---------------- */
const STORAGE_PREFIX = CFG_FRAGMENT ? ('frag_' + CFG_FRAGMENT.hash) : ((CONFIG && CONFIG.gameId) || 'defense');
function fmt(s){
  if(typeof s !== 'string') return s;
  return CONFIG.host ? s.split('{HOST}').join(CONFIG.host.name) : s;
}
function fmtLines(lines){ return lines.map(fmt); }

const CAST = CONFIG.cast || {};
const JUDGE_CAST = !!CAST.judge;         // THE FIRST BOSS -- sniper tower
const AUTHORITY_CAST = !!CAST.authority; // THE FINAL BOSS -- last-wave jumbo unit, then turn-good tower
const SAVIOR_CAST = !!CAST.savior;
const BUTTERFINGERS_CAST = !!CAST.butterfingers;
const BUILDER_CAST = !!CAST.builder;

const DEFENSE_DEFENDING = (CONFIG.defense.defending && CONFIG.defense.defending.trim()) ? CONFIG.defense.defending.trim() : 'THE COUCH';
const DEFENSE_WAVES_RAW = (CONFIG.defense.waves && CONFIG.defense.waves.length) ? CONFIG.defense.waves : ['THE USUAL CHAOS'];
const WAVES_COUNT = Math.max(1, Math.min(6, DEFENSE_WAVES_RAW.length));
const DEFENSE_WAVE_LABELS = DEFENSE_WAVES_RAW.slice(0, WAVES_COUNT);

/* neutral fallback pools -- template-owned, tone-clean, used whenever a
   config doesn't supply the optional defense.firstBossHeckle/
   finalBossQuirk lines (see SPEC-defense.md's config section, and
   flight/engine.js's identical pattern). Picked deterministically per
   game via the same seeded rng everything else uses, never Math.random. */
const FIRST_BOSS_HECKLE_FALLBACKS = [
  'FINALLY, SOMETHING WORTH SHOOTING AT.', 'YOU CALL THAT AN ANNOYANCE? WATCH THIS.', 'I\'VE BEEN WAITING ALL WEEK FOR THIS.', 'STAND BACK. LET ME WORK.',
];
const FINAL_BOSS_QUIRK_FALLBACKS = [
  'STILL MAD ABOUT THE THERMOSTAT.', 'CANNOT LET GO OF ONE BAD REVIEW.', 'NEVER FORGIVES A LATE REPLY.',
];
const FIRST_BOSS_HECKLE = CONFIG.defense.firstBossHeckle || null;
const FINAL_BOSS_QUIRK = CONFIG.defense.finalBossQuirk || null;

/* ======================================================================
   SEEDED RNG -- gameId hash -> a deterministic sequence, never Math.random.
   Reuses cfgHashString (game/cfgcodec.js, already loaded) for the hash;
   mulberry32 turns that into a repeatable stream. Byte-identical
   implementation to flight/engine.js's own (duplicated per engine on
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
function rngPick(rng, arr){ return arr[rngInt(rng, arr.length)]; }
function rngShuffled(rng, arr){
  const out = arr.slice();
  for(let i = out.length - 1; i > 0; i--){
    const j = rngInt(rng, i + 1);
    const tmp = out[i]; out[i] = out[j]; out[j] = tmp;
  }
  return out;
}
const GAME_SEED_BASE = CONFIG.gameId || 'defense';
const gameRng = makeRng(GAME_SEED_BASE + ':defense:flavor');

/* ======================================================================
   PEOPLE FIRST (SPEC-people.md round 1) -- quotes-shown log every
   tools/verify-defense.js's own PROBE reads (no duplicated literals),
   seeded per-person quote rotation, and THE WHOLE CREW end-card credits.
   Byte-identical implementation to gallery/flight/engine.js's own
   (duplicated per engine on purpose, same convention as the seeded RNG
   above).
   ====================================================================== */
let QUOTES_SHOWN = {};
function logQuoteShown(key){ QUOTES_SHOWN[key] = true; }
const quoteRotators = {};
function nextQuoteFor(key, quotes){
  if(!quotes || !quotes.length) return null;
  if(!quoteRotators[key]) quoteRotators[key] = { idx: rngInt(makeRng(GAME_SEED_BASE + ':quotes:' + key), quotes.length) };
  const r = quoteRotators[key];
  const q = quotes[r.idx % quotes.length];
  r.idx++;
  logQuoteShown(key);
  return q;
}
let CREW_CREDITS = [];
/* THE WHOLE CREW -- every `extras` entry (unconditional, when named) plus
   a safety-net sweep for any quoted host/judge/authority/savior/
   butterfingers/builder who never got a natural on-screen moment this
   playthrough (a tower's first-kill-this-wave quote bubble, the savior's
   own "shows up" bubble, the celebration banner, or the boss heckle/
   quirk pool below). diner0 IS one of the placed towers here (see
   TOWER_STATS.diner0/buildTowerRoster -- always present) but its own
   quote-bubble coverage still routes through the same first-kill
   mechanic as host/butterfingers, not an unconditional listing, so it's
   folded into the same safety-net role loop below rather than treated
   specially. Still leads the list whenever the block has ANYTHING to
   show ("listing diner0 + every extras entry", SPEC-people.md) --
   otherwise left out entirely, so an otherwise quote-less/extras-less
   config never earns a credits line at all. Built once, right when the
   end card is entered (see enterEndcard below). */
function buildCrewCredits(){
  const list = [];
  function pushCrew(key, name, spriteEntry, quotes){
    if(!name) return;
    list.push({ name: name, sprite: rosterResolveSprite(spriteEntry, 1, 7), quote: nextQuoteFor(key, quotes) });
  }
  const extrasArr = CONFIG.extras || [];
  for(let i=0;i<extrasArr.length;i++){
    const ex = extrasArr[i];
    if(ex && ex.name) pushCrew('extra'+i, ex.name, { sprite: ex.sprite }, fmtLines(ex.quotes || []));
  }
  if(CONFIG.host && CONFIG.host.quotes && CONFIG.host.quotes.length && !QUOTES_SHOWN.host){
    pushCrew('host', CONFIG.host.name, CONFIG.host, fmtLines(CONFIG.host.quotes));
  }
  for(const role of ['judge','authority','savior','butterfingers','builder']){
    if(CAST[role] && CAST[role].quotes && CAST[role].quotes.length && !QUOTES_SHOWN[role]){
      pushCrew(role, CAST[role].name, CAST[role], fmtLines(CAST[role].quotes));
    }
  }
  const diner0HasUnshownQuotes = !!(CAST.diner0 && CAST.diner0.quotes && CAST.diner0.quotes.length && !QUOTES_SHOWN.diner0);
  if(CAST.diner0 && CAST.diner0.name && (diner0HasUnshownQuotes || list.length)){
    list.unshift({ name: CAST.diner0.name, sprite: rosterResolveSprite(CAST.diner0, 1, 7), quote: diner0HasUnshownQuotes ? nextQuoteFor('diner0', fmtLines(CAST.diner0.quotes)) : null });
  }
  return list;
}

/* PEOPLE FIRST -- "BOSSES FEEL REAL": when the relevant boss is cast and
   has quotes, their own quotes REPLACE the neutral fallback pool for the
   seeded pick below (config-typed firstBossHeckle/finalBossQuirk, if set,
   still wins outright -- untouched). Absent quotes -- byte-identical to
   the neutral-fallback-only behavior this file has always had. */
const FIRST_BOSS_HECKLE_POOL = (JUDGE_CAST && CAST.judge.quotes && CAST.judge.quotes.length) ? fmtLines(CAST.judge.quotes) : FIRST_BOSS_HECKLE_FALLBACKS;
const FINAL_BOSS_QUIRK_POOL = (AUTHORITY_CAST && CAST.authority.quotes && CAST.authority.quotes.length) ? fmtLines(CAST.authority.quotes) : FINAL_BOSS_QUIRK_FALLBACKS;
const firstBossHeckleLine = FIRST_BOSS_HECKLE || rngPick(gameRng, FIRST_BOSS_HECKLE_POOL);
const finalBossQuirkLine = FINAL_BOSS_QUIRK || rngPick(gameRng, FINAL_BOSS_QUIRK_POOL);
if(!FIRST_BOSS_HECKLE && JUDGE_CAST && CAST.judge.quotes && CAST.judge.quotes.length) logQuoteShown('judge');
if(!FINAL_BOSS_QUIRK && AUTHORITY_CAST && CAST.authority.quotes && CAST.authority.quotes.length) logQuoteShown('authority');

/* ======================================================================
   BOARD -- fixed 960x540, an S-path entering the left edge and ending at
   THE THING (bottom-right), 6 fixed tower pads along the way. Numbers
   below are this round's own creative call (SPEC-defense.md sets no
   exact layout), tuned for readability and to keep everything clear of
   the HUD margins -- same "tuning is this round's own creative call"
   precedent gallery/engine.js's and flight/engine.js's own headers set.
   ====================================================================== */
const PATH_WAYPOINTS = [
  { x:-60,  y:150 },
  { x:240,  y:150 },
  { x:240,  y:350 },
  { x:540,  y:350 },
  { x:540,  y:140 },
  { x:760,  y:140 },
  { x:760,  y:440 },
  { x:900,  y:440 },
  { x:900,  y:480 }, // THE THING sits here
];
const THE_THING_POS = PATH_WAYPOINTS[PATH_WAYPOINTS.length-1];
const LAST_CORNER_INDEX = PATH_WAYPOINTS.length - 3; // the corner just before the final approach -- see SAVIOR's teleport trigger
const PATH_WIDTH = 74;
const BARRICADE_SEGMENT_INDEX = 2; // fixed path segment THE BUILDER's barricade always occupies

const PATH_SEGMENTS = [];
(function buildSegments(){
  let cum = 0;
  for(let i=0;i<PATH_WAYPOINTS.length-1;i++){
    const a = PATH_WAYPOINTS[i], b = PATH_WAYPOINTS[i+1];
    const len = Math.hypot(b.x-a.x, b.y-a.y);
    PATH_SEGMENTS.push({ a, b, len, cumStart: cum });
    cum += len;
  }
  PATH_SEGMENTS.totalLength = cum;
})();
const TOTAL_PATH_LENGTH = PATH_SEGMENTS.totalLength;
const LAST_CORNER_DIST = PATH_SEGMENTS[LAST_CORNER_INDEX].cumStart;
const BARRICADE_DIST = PATH_SEGMENTS[BARRICADE_SEGMENT_INDEX].cumStart + PATH_SEGMENTS[BARRICADE_SEGMENT_INDEX].len*0.5;
function posAtDist(dist){
  if(dist <= 0) return { x: PATH_WAYPOINTS[0].x, y: PATH_WAYPOINTS[0].y };
  for(let i=0;i<PATH_SEGMENTS.length;i++){
    const s = PATH_SEGMENTS[i];
    if(dist <= s.cumStart+s.len || i === PATH_SEGMENTS.length-1){
      const local = Math.max(0, Math.min(1, (dist-s.cumStart)/s.len));
      return { x: s.a.x+(s.b.x-s.a.x)*local, y: s.a.y+(s.b.y-s.a.y)*local };
    }
  }
  return { x: THE_THING_POS.x, y: THE_THING_POS.y };
}

const PAD_POSITIONS = [
  { x:140, y:230 },
  { x:330, y:250 },
  { x:390, y:430 },
  { x:610, y:250 },
  { x:660, y:430 },
  { x:860, y:500 }, // anchor pad -- closest to THE THING, always HOST's
];
const ANCHOR_PAD_INDEX = PAD_POSITIONS.length - 1;
const SAVIOR_TELEPORT_POS = { x: THE_THING_POS.x - 70, y: THE_THING_POS.y - 40 };

/* ======================================================================
   ASSETS -- the Tower Defense pack (assets/defense/, CC0, see
   assets/defense/CREDITS.txt for exactly which tile numbers and why)
   plus the same roster character sheets every template can draw a cast
   pick from.
   ====================================================================== */
const DEFENSE_IMG_FILES = {
  pathEdgeStraight:'pathEdgeStraight.png', pathEdgeCorner:'pathEdgeCorner.png', pathFill:'pathFill.png', pad:'pad.png',
  turretCannon:'turretCannon.png', turretTank:'turretTank.png', turretMissile:'turretMissile.png',
  enemyGrunt:'enemyGrunt.png', enemyGruntHeavy:'enemyGruntHeavy.png', enemyPlaneGreen:'enemyPlaneGreen.png', enemyPlaneGrey:'enemyPlaneGrey.png',
  projectileRocket:'projectileRocket.png', projectileOrb:'projectileOrb.png',
};
const DEFENSE_IMG = {};
let assetsSettledCount = 0;
let assetsReady = false;
const ROSTER_SHEET_IMAGES = {};
const ROSTER_SHEET_KEYS = (typeof ROSTER_SHEETS !== 'undefined') ? Object.keys(ROSTER_SHEETS) : [];
const ASSETS_TOTAL = Object.keys(DEFENSE_IMG_FILES).length + ROSTER_SHEET_KEYS.length;
function markAssetSettled(){ assetsSettledCount++; if(assetsSettledCount>=ASSETS_TOTAL) assetsReady = true; }
for(const key in DEFENSE_IMG_FILES){
  const img = new Image();
  img.src = ENGINE_ROOT + 'assets/defense/' + DEFENSE_IMG_FILES[key];
  img.onload = markAssetSettled; img.onerror = markAssetSettled;
  DEFENSE_IMG[key] = img;
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
/* generic scaled draw for a Tower Defense pack piece, anchored by its
   CENTER (cx,cy) at a given display width (aspect-locked to the source;
   every tile here is a 64x64 square so this is always a straight scale). */
function drawPacked(ctx, img, cx, cy, dispW, rotation){
  if(!img.complete || !img.naturalWidth) return;
  const dispH = dispW * (img.naturalHeight/img.naturalWidth);
  ctx.imageSmoothingEnabled = false;
  if(rotation){
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(rotation);
    ctx.drawImage(img, -dispW/2, -dispH/2, dispW, dispH);
    ctx.restore();
  } else {
    ctx.drawImage(img, cx-dispW/2, cy-dispH/2, dispW, dispH);
  }
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
const SPARKLE_SIZES = [1,3,4,2];
function sparkleFrameSize(t, period){
  period = period || 0.4;
  const local = ((t % period) + period) % period;
  const frame = Math.min(3, Math.floor(local/(period/4)));
  return SPARKLE_SIZES[frame];
}
function drawSparkle(ctx, x, y, size, alpha, color){
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x-1), Math.round(y-size), 2, size*2);
  ctx.fillRect(Math.round(x-size), Math.round(y-1), size*2, 2);
  ctx.restore();
}

/* ---------------- procedural props NOT in the Tower Defense pack (see
   assets/defense/CREDITS.txt) -- same drawBitmap-prop convention as
   gallery/engine.js's PLATE_ROWS/PLUSH_ROWS, flight/engine.js's
   HEART_ROWS/PHONE_ROWS. ---------------- */
const HEART_ROWS = ['.11.11.', '1111111', '1111111', '.11111.', '..111..', '...1...'];
function drawHeart(ctx, x, y, cell, full){
  drawBitmap(ctx, HEART_ROWS, { '1': full ? PAL.heartFull : PAL.heartEmpty }, x, y, cell);
}
const THING_ROWS = ['..111..', '.11111.', '11111111', '11333311', '11333311', '11111111'];
const THING_COLORS = { '1':PAL.wood, '3':PAL.gold };
function drawThePedestal(ctx, x, y, cell){ drawBitmap(ctx, THING_ROWS, THING_COLORS, x, y, cell); }
const BARRICADE_ROWS = ['1111111', '1222221', '1222221', '1222221', '1111111'];
const BARRICADE_COLORS = { '1':PAL.outline, '2':PAL.wood };
function drawBarricade(ctx, x, y, cell){ drawBitmap(ctx, BARRICADE_ROWS, BARRICADE_COLORS, x, y, cell); }

/* ======================================================================
   AUDIO -- reuses shared/framework.js's makeBufferBank/playSample/twang/
   ducking/volume UI/SpeechSynthesis wrapper; this block is this engine's
   own content (SFX list + wrappers + music-loop defs), same convention as
   flight/engine.js. Every SFX file below already ships in assets/audio/
   sfx/ -- no new audio assets were needed for this template (see
   assets/defense/CREDITS.txt).
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

/* every one of the 16 files in assets/audio/sfx/ gets a job here, same
   "every file used exactly once, per-engine own convention" discipline
   flight/engine.js's own SFX_DEFS documents. */
const SFX_DEFS = {
  fire:              { src:ENGINE_ROOT+'assets/audio/sfx/woosh3.ogg',                gain:0.4 }, // tower shot
  hit:               { src:ENGINE_ROOT+'assets/audio/sfx/impactSoft_medium_002.ogg', gain:0.5 }, // projectile impact
  kill:              { src:ENGINE_ROOT+'assets/audio/sfx/confirmation_004.ogg',      gain:0.5 }, // enemy destroyed
  waveClear:         { src:ENGINE_ROOT+'assets/audio/sfx/jingles-hit_10.ogg',        gain:0.8 }, // wave cleared fanfare
  leak:              { src:ENGINE_ROOT+'assets/audio/sfx/error_003.ogg',             gain:0.6 }, // leak / heart lost
  retryStinger:      { src:ENGINE_ROOT+'assets/audio/sfx/minimize_006.ogg',          gain:0.6 }, // THE <DEFENDING> FALLS
  heckleBlip:        { src:ENGINE_ROOT+'assets/audio/sfx/tick_001.ogg',              gain:0.4 }, // heckle/quirk typewriter blip
  teleport:          { src:ENGINE_ROOT+'assets/audio/sfx/select_006.ogg',            gain:0.6 }, // savior teleport
  barricadeBuild:    { src:ENGINE_ROOT+'assets/audio/sfx/stoneDrag2.ogg',            gain:0.6 }, // builder hammering
  butterfingersDrop: { src:ENGINE_ROOT+'assets/audio/sfx/impactWood_heavy_002.ogg',  gain:0.8 }, // clumsy AoE drop impact
  splatAoE:          { src:ENGINE_ROOT+'assets/audio/sfx/impactGlass_heavy_001.ogg', gain:0.7 }, // AoE splash effect
  rallyCharge:       { src:ENGINE_ROOT+'assets/audio/sfx/jingles-hit_02.ogg',        gain:0.7 }, // THE RALLY charged
  rallySlam:         { src:ENGINE_ROOT+'assets/audio/sfx/confirmation_001.ogg',      gain:0.8 }, // THE RALLY fires
  bossEntrance:      { src:ENGINE_ROOT+'assets/audio/sfx/scratch_002.ogg',           gain:0.7 }, // final boss entrance
  turnGood:          { src:ENGINE_ROOT+'assets/audio/sfx/jingles-hit_03.ogg',        gain:0.7 }, // authority turns good
  padSwap:           { src:ENGINE_ROOT+'assets/audio/sfx/close_002.ogg',             gain:0.4 }, // pad swap tap
};
const sfxLoader = makeBufferBank(SFX_DEFS);
function tryDecodeAllSamples(){ sfxLoader.tryDecodeAll(); }
sfxLoader.prefetchAll();
function playFire(t){ playSample('fire', t); }
function playHit(t){ playSample('hit', t); }
function playKill(t){ playSample('kill', t); }
function playWaveClear(t){ playSample('waveClear', t); playTwang(t+0.9, 0.7); }
function playLeak(t){ playSample('leak', t); }
function playRetryStinger(t){ playSample('retryStinger', t); }
function playHeckleBlip(t){ playSample('heckleBlip', t); }
function playTeleport(t){ playSample('teleport', t); }
function playBarricadeBuild(t){ playSample('barricadeBuild', t); }
function playButterfingersDrop(t){ playSample('butterfingersDrop', t); }
function playSplatAoE(t){ playSample('splatAoE', t); }
function playRallyCharge(t){ playSample('rallyCharge', t); }
function playRallySlam(t){ playSample('rallySlam', t); }
function playBossEntrance(t){ playSample('bossEntrance', t); }
function playTurnGood(t){ playSample('turnGood', t); }
function playPadSwap(t){ playSample('padSwap', t); }
// shared/framework.js's updateTypewriterAudio calls playBeep (a shared
// no-op stub, defined there) + playDing directly as ordinary globals at
// call time -- every engine that uses it must supply its own playDing
// (see gallery/engine.js's/flight/engine.js's identical wrapper).
function playDing(t){ playHeckleBlip(t); }

/* Phase M mapping (see SPEC-defense.md "Music"): prep/title/between-waves
   = dinner slot; waves = chase; heart lost = a brief 'sad' sting, then
   'gameover' as the bed under the retry card itself; final boss wave =
   boss; turn-good + win = celebration. */
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
   TOWER / ENEMY DATA -- role -> combat stats + which pack tile it draws.
   BUDGET_DPS is a flat, deliberately approximate per-role contribution
   used ONLY to size each wave's total enemy HP (see waveHpBudget below)
   -- support/utility roles (savior/builder) don't deal direct damage but
   still get a small flat credit here for their real gameplay value
   (the aura buff, the barricade's damage-mitigation), rather than trying
   to fully simulate their effect just to size a wave.
   ====================================================================== */
const TOWER_STATS = {
  host:          { range:190, rate:1.1, dmg:16, projSpeed:420, proj:'projectileOrb',    look:'turretCannon', budgetDps:17.6 },
  diner0:        { range:150, rate:1.0, dmg:11, projSpeed:380, proj:'projectileOrb',    look:'turretCannon', budgetDps:11 },
  judge:         { range:270, rate:0.4, dmg:55, projSpeed:520, proj:'projectileRocket', look:'turretMissile', budgetDps:22 },
  savior:        { range:0,   rate:0,   dmg:0,  look:'turretTank', isSupport:true, auraRadius:150, auraMult:1.35, budgetDps:8 },
  butterfingers: { range:0,   rate:0,   dmg:90, look:'turretMissile', isChaos:true, dropInterval:7, dropRadiusPx:170, splashRadius:70, budgetDps:28 },
  builder:       { range:0,   rate:0,   dmg:0,  look:'turretTank', isEngineer:true, barricadeHp:150, budgetDps:8 },
};
const TURNGOOD_STATS = { range:220, rate:1.3, dmg:48, projSpeed:480, proj:'projectileRocket', look:'turretCannon' };
const ENEMY_TYPES = {
  grunt:      { img:'enemyGrunt',      speed:52, isAir:false, hpMult:1.0 },
  gruntHeavy: { img:'enemyGruntHeavy', speed:46, isAir:false, hpMult:1.35 },
  planeGreen: { img:'enemyPlaneGreen', speed:82, isAir:true,  hpMult:1.0 },
  planeGrey:  { img:'enemyPlaneGrey',  speed:88, isAir:true,  hpMult:0.85 },
};
const DEFAULT_ROSTER_FALLBACK = {
  host:['plain',2,7], diner0:['villager',1,7], judge:['grandma',4,8], authority:['sage',0,7],
  savior:['plain',2,7], butterfingers:['braid',3,8], builder:['vest',2,8],
};
function roleSprite(cfgEntry, role){
  const fb = DEFAULT_ROSTER_FALLBACK[role] || ['plain',2,7];
  return rosterResolveSprite(cfgEntry, fb[1], fb[2]);
}
function roleName(role){
  if(role === 'host') return fmt(CONFIG.host.name).toUpperCase();
  if(role === 'diner0') return (CAST.diner0 && CAST.diner0.name) ? CAST.diner0.name.toUpperCase() : 'THE FOURTH FRIEND';
  const c = CAST[role];
  return c && c.name ? c.name.toUpperCase() : role.toUpperCase();
}

/* ======================================================================
   WAVE PLAN -- pure formulas of waveIndex (never randomized), so the
   TOTAL enemy count per wave is stable across retries -- only the
   per-spawn DETAILS (which pad order, which enemy type, timing jitter,
   butterfingers drop offsets) are seeded per (waveIndex, attempt), same
   determinism split flight/engine.js's own LEGS plan uses.
   ====================================================================== */
const BUDGET_UPTIME_FACTOR = 8.9; // empirical, retuned round 2 (was 8.5). Per-wave enemy HP is uniform
// within a wave by design, so this scalar's effect on outcome is a staircase, not a smooth ramp: a
// naive (no-priority-tap) full-cast playthrough sits at a stable "2 hearts lost, 0 stalls" plateau
// across the whole 8.5-8.943 range, then jumps straight to "5 hearts lost, 1 forced stall" at 8.944+
// (verified by sweeping in 0.001 steps -- no intermediate value exists to land closer to the middle
// of "2-4 hearts" without also crossing the 3-leaks-in-one-wave stall threshold). 8.9 was chosen for
// comfortable margin from that cliff while still landing inside the target range. See
// tools/verify-defense.js's DIFFICULTY_TUNING block for the driver assertions that pin this down.
function waveEnemyCount(i){ return 5 + i*2; }
function waveDuration(i){ return 24 + i*2; }
function totalPlacedDps(){
  let dps = TOWER_STATS.host.budgetDps + TOWER_STATS.diner0.budgetDps;
  if(JUDGE_CAST) dps += TOWER_STATS.judge.budgetDps;
  if(SAVIOR_CAST) dps += TOWER_STATS.savior.budgetDps;
  if(BUTTERFINGERS_CAST) dps += TOWER_STATS.butterfingers.budgetDps;
  if(BUILDER_CAST) dps += TOWER_STATS.builder.budgetDps;
  return dps;
}
function waveHpBudget(i){ return totalPlacedDps() * BUDGET_UPTIME_FACTOR * (1 + i*0.1); }
function perEnemyHp(i){ return Math.max(18, waveHpBudget(i) / waveEnemyCount(i)); }
const FINAL_WAVE_INDEX = WAVES_COUNT - 1;

/* ======================================================================
   GAME STATE
   ====================================================================== */
let gameT = 0;
let timeScale = 1; // slow-mo during THE RALLY's slam beat
let slowMoTimer = 0;
let phase = 'title';
let phaseElapsed = 0;
let phaseData = {};
let gpAPrev = false;

let hearts = 3;
let totalHeartsLostEver = 0;
let towers = []; // { role, padIndex, teleported:bool, cooldown, ... }
let activeEnemies = []; // { id, type, hp, maxHp, dist, isBoss, label }
let nextEnemyId = 1;
let projectiles = []; // { x,y, targetId, speed, dmg, img, sourceRole }
let barricadeHp = 0, barricadeMaxHp = 0;
let judgeHeckledThisWave = false;
let saviorTeleportedThisWave = false;
// PEOPLE FIRST (SPEC-people.md round 1) -- "a tower's first kill each
// wave may pop that person's quote... throttled: one per tower per wave;
// the first boss's sniper heckle keeps precedence on their own first
// kill" -- judge is deliberately excluded here (their own branch above
// keeps the heckle). Reset alongside judgeHeckledThisWave, see enterWave.
let firstKillQuoteShownThisWave = {};
function personFor(role){ return role==='host' ? CONFIG.host : CAST[role]; }
let wavesHeldCount = 0;
let rallyCharge = 0;
let rallyUsedThisGame = false;
let rallyBuffUntil = 0;
let perWaveDowned = []; // [{label, count}] per wave, in order

let cursorEnemyIndex = 0;
let priorityTargetId = null, priorityUntil = 0;
let padSwapFirst = -1;

let flightPuffs = []; // local image/pixel-based particles, same rationale as flight/engine.js's own flightPuffs (the shared particles[] array has no image-sprite type)
function spawnPuff(cx, cy, big, color){
  const n = big ? 4 : 2;
  for(let i=0;i<n;i++){
    flightPuffs.push({ x:cx+rngRange(gameRng,-14,14), y:cy+rngRange(gameRng,-14,14), vx:rngRange(gameRng,-40,40), vy:rngRange(gameRng,-60,-10), big, color: color||PAL.gold, born:gameT, life:0.55 });
  }
}
function updateAndDrawPuffs(ctx){
  for(const p of flightPuffs){
    const age = gameT-p.born;
    if(age > p.life) continue;
    const a = 1-age/p.life;
    ctx.save(); ctx.globalAlpha = Math.max(0,a); ctx.fillStyle = p.color;
    const s = p.big ? 10 : 6;
    ctx.fillRect(Math.round(p.x+p.vx*age-s/2), Math.round(p.y+p.vy*age-s/2), s, s);
    ctx.restore();
  }
  flightPuffs = flightPuffs.filter(p => (gameT-p.born) <= p.life);
}
let confetti = [];
function spawnConfetti(){
  for(let i=0;i<40;i++){
    confetti.push({ x:rngRange(gameRng,0,CW), y:-10-rngRange(gameRng,0,120), vy:rngRange(gameRng,90,160), vx:rngRange(gameRng,-30,30), color: rngPick(gameRng,[PAL.gold,PAL.heartFull,PAL.grass,PAL.cream]), born:gameT, life:3.2 });
  }
}
function updateAndDrawConfetti(ctx){
  for(const c of confetti){
    const age = gameT-c.born;
    if(age>c.life) continue;
    ctx.save(); ctx.globalAlpha = Math.max(0,1-age/c.life); ctx.fillStyle = c.color;
    ctx.fillRect(Math.round(c.x+c.vx*age), Math.round(c.y+c.vy*age), 5, 5);
    ctx.restore();
  }
  confetti = confetti.filter(c => (gameT-c.born) <= c.life);
}

let screenShakeUntil = 0, screenShakeMag = 0;
function triggerShake(mag, dur){ screenShakeUntil = gameT+dur; screenShakeMag = mag; }
let bannerText = null, bannerSub = null, bannerUntil = 0;
function showBanner(text, sub, dur){ bannerText = text; bannerSub = sub||null; bannerUntil = gameT + (dur===undefined?1.6:dur); }
let bubble = null; // { text, x, y, until } -- heckle/quirk/savior/butterfingers one-off speech
function showBubble(text, x, y, dur){ bubble = { text, x, y, until: gameT + (dur===undefined?2.2:dur) }; }

/* ---------------- tutorial/stall cards -- see shared/framework.js's card
   system. CARDS.retry's body is rewritten per-attempt just before
   showing it (see enterRetry), same deliberate bypass of
   maybeShowCard's one-shot guard flight/engine.js's enterStallRetry
   uses -- a retry can legitimately show more than once. ---------------- */
const CARDS = {
  retry: { key:'retry', title:'THE ' + DEFENSE_DEFENDING + ' FALLS', body:['ONE MORE GO.'] },
};

/* ======================================================================
   PLACEMENT -- auto-placed at game start in a fixed seeded order (zero
   interaction needed). HOST always anchors the pad nearest THE THING;
   every other cast tower role fills the remaining 5 pads in a seeded
   shuffle. diner0 is always present (see game/cfgcodec.js's
   cfgBuildDefaultConfig -- it's never null, unlike the 5 optional
   roles), so the minimum roster is host+diner0, 2 towers.
   ====================================================================== */
function buildTowerRoster(){
  const roles = ['diner0'];
  if(JUDGE_CAST) roles.push('judge');
  if(SAVIOR_CAST) roles.push('savior');
  if(BUTTERFINGERS_CAST) roles.push('butterfingers');
  if(BUILDER_CAST) roles.push('builder');
  const placeRng = makeRng(GAME_SEED_BASE + ':defense:placement');
  const otherPadIndexes = rngShuffled(placeRng, [0,1,2,3,4]);
  const list = [{ role:'host', padIndex: ANCHOR_PAD_INDEX }];
  roles.forEach((role,i) => list.push({ role, padIndex: otherPadIndexes[i] }));
  return list;
}
function towerPos(t){
  if(t.role === 'savior' && t.teleported) return SAVIOR_TELEPORT_POS;
  if(t.standsBesideThing) return { x: THE_THING_POS.x+50, y: THE_THING_POS.y-10 };
  return PAD_POSITIONS[t.padIndex];
}
function towerByPad(padIndex){ return towers.find(t => t.padIndex === padIndex); }

/* ======================================================================
   WAVE SCHEDULE -- deterministic per (waveIndex, attempt): enemy type
   mix, spawn timing jitter, and (if BUTTERFINGERS_CAST) drop offsets.
   Seed matches SPEC-defense.md's Determinism section:
   `<gameId>:defense:wave:<i>:<attempt>`.
   ====================================================================== */
function buildWaveSchedule(waveIndex, attempt){
  const rng = makeRng(GAME_SEED_BASE + ':defense:wave:' + waveIndex + ':' + attempt);
  const isFinal = waveIndex === FINAL_WAVE_INDEX;
  const baseCount = waveEnemyCount(waveIndex);
  const count = (isFinal && !AUTHORITY_CAST) ? Math.round(baseCount*1.5) : baseCount;
  const hp = perEnemyHp(waveIndex);
  const spacing = waveDuration(waveIndex) / count;
  const airChance = Math.min(0.6, 0.1*waveIndex);
  const events = [];
  let t = 0.8;
  for(let i=0;i<count;i++){
    const isAir = rng() < airChance;
    const pool = isAir ? ['planeGreen','planeGrey'] : ['grunt','gruntHeavy'];
    const type = rngPick(rng, pool);
    events.push({ t, type, hp: hp*ENEMY_TYPES[type].hpMult });
    t += spacing * rngRange(rng, 0.75, 1.25);
  }
  let boss = null;
  if(isFinal && AUTHORITY_CAST){
    boss = { t: 0.5, hp: hp*5.5 };
    for(const ev of events) ev.t += 2.6; // the escort visibly follows the boss in
  }
  const drops = [];
  if(BUTTERFINGERS_CAST){
    const span = t;
    let dt = rngRange(rng, 3, 6);
    while(dt < span+3){
      drops.push({ t: dt, offset: rngRange(rng, -TOWER_STATS.butterfingers.dropRadiusPx, TOWER_STATS.butterfingers.dropRadiusPx) });
      dt += rngRange(rng, TOWER_STATS.butterfingers.dropInterval-1.5, TOWER_STATS.butterfingers.dropInterval+1.5);
    }
  }
  return { events, boss, drops, span: t };
}
const TURNGOOD_SEED = GAME_SEED_BASE + ':defense:turngood';

/* ======================================================================
   COMBAT
   ====================================================================== */
function dist2(ax,ay,bx,by){ return Math.hypot(ax-bx, ay-by); }
function nearestPathDistToPoint(px, py){
  let best = 0, bestD = Infinity;
  for(const seg of PATH_SEGMENTS){
    const steps = 6;
    for(let i=0;i<=steps;i++){
      const local = i/steps;
      const x = seg.a.x+(seg.b.x-seg.a.x)*local, y = seg.a.y+(seg.b.y-seg.a.y)*local;
      const d = dist2(px,py,x,y);
      if(d < bestD){ bestD = d; best = seg.cumStart + seg.len*local; }
    }
  }
  return best;
}
function frontmostInRange(towerX, towerY, range){
  let best = null;
  for(const e of activeEnemies){
    if(e.dist >= LAST_CORNER_DIST+TOTAL_PATH_LENGTH) continue; // never targets something already gone
    const d = dist2(towerX, towerY, e.pos.x, e.pos.y);
    if(d <= range && (!best || e.dist > best.dist)) best = e;
  }
  return best;
}
function pickTarget(tower, pos, range){
  if(priorityTargetId!=null && gameT < priorityUntil){
    const pt = activeEnemies.find(e => e.id === priorityTargetId);
    if(pt && dist2(pos.x,pos.y,pt.pos.x,pt.pos.y) <= range) return pt;
  }
  return frontmostInRange(pos.x, pos.y, range);
}
function auraMultiplierFor(pos){
  if(!SAVIOR_CAST) return 1;
  const saviorTower = towers.find(t => t.role==='savior');
  if(!saviorTower) return 1;
  const sp = towerPos(saviorTower);
  return dist2(pos.x,pos.y,sp.x,sp.y) <= TOWER_STATS.savior.auraRadius ? TOWER_STATS.savior.auraMult : 1;
}
function fireProjectile(pos, target, stats, role){
  const rallyMult = (gameT < rallyBuffUntil) ? 2 : 1;
  const dmg = stats.dmg * auraMultiplierFor(pos) * rallyMult;
  projectiles.push({ x:pos.x, y:pos.y, targetId: target.id, speed: stats.projSpeed, dmg, img: stats.proj, sourceRole: role });
  if(actx) playFire(actx.currentTime);
}
function updateTowers(dt){
  for(const t of towers){
    // THE FINAL BOSS's turned-good tower isn't a normal cast role -- it's
    // pushed onto `towers` fresh in enterTurnGood() with role:'authority',
    // which has no TOWER_STATS entry of its own (see TURNGOOD_STATS's own
    // comment, and drawTowers' identical special-case just below).
    const stats = t.role === 'authority' ? TURNGOOD_STATS : TOWER_STATS[t.role];
    const pos = towerPos(t);
    if(stats.isSupport || stats.isEngineer) continue; // no direct fire
    if(stats.isChaos) continue; // handled by the wave's own drop schedule, not a per-tick cooldown loop
    t.cooldown = (t.cooldown||0) - dt;
    if(t.cooldown > 0) continue;
    const target = pickTarget(t, pos, stats.range);
    if(!target) continue;
    const rallyRateMult = (gameT < rallyBuffUntil) ? 2 : 1;
    t.cooldown = 1/(stats.rate*rallyRateMult);
    fireProjectile(pos, target, stats, t.role);
  }
}
function applyDamage(e, dmg, byRole){
  e.hp -= dmg;
  if(actx) playHit(actx.currentTime);
  if(e.hp <= 0 && !e.dead){
    e.dead = true;
    if(actx) playKill(actx.currentTime);
    spawnPuff(e.pos.x, e.pos.y, false, PAL.grass);
    perWaveDowned[phaseData.waveIndex] = perWaveDowned[phaseData.waveIndex] || {};
    perWaveDowned[phaseData.waveIndex][e.label] = (perWaveDowned[phaseData.waveIndex][e.label]||0) + 1;
    rallyCharge = Math.min(1, rallyCharge + 0.34);
    if(rallyCharge >= 1 && !rallyUsedThisGame && !rallyCharge_announced){ rallyCharge_announced = true; if(actx) playRallyCharge(actx.currentTime); }
    if(e.isBoss){ phaseData.bossDefeated = true; if(actx) playTurnGood(actx.currentTime); }
    else if(byRole === 'judge' && !judgeHeckledThisWave){
      judgeHeckledThisWave = true;
      const jp = towerPos(towers.find(t=>t.role==='judge'));
      showBubble(firstBossHeckleLine, jp.x, jp.y-40, 2.4);
      if(actx) playHeckleBlip(actx.currentTime);
    } else if(byRole && byRole !== 'judge' && !firstKillQuoteShownThisWave[byRole]){
      // PEOPLE FIRST (SPEC-people.md round 1) -- see firstKillQuoteShownThisWave's own header.
      const person = personFor(byRole);
      if(person && person.quotes && person.quotes.length){
        const t = towers.find(tw=>tw.role===byRole);
        if(t){
          firstKillQuoteShownThisWave[byRole] = true;
          const tp = towerPos(t);
          const q = nextQuoteFor(byRole, fmtLines(person.quotes));
          showBubble(q, tp.x, tp.y-40, 2.4);
          if(actx) playHeckleBlip(actx.currentTime);
        }
      }
    }
  }
}
let rallyCharge_announced = false;
function updateProjectiles(dt){
  for(const p of projectiles){
    const target = activeEnemies.find(e => e.id === p.targetId && !e.dead);
    if(!target){ p.dead = true; continue; }
    const dx = target.pos.x-p.x, dy = target.pos.y-p.y;
    const d = Math.hypot(dx,dy);
    if(d < 14){ applyDamage(target, p.dmg, p.sourceRole); p.dead = true; continue; }
    const step = p.speed*dt;
    p.x += (dx/d)*step; p.y += (dy/d)*step;
  }
  projectiles = projectiles.filter(p => !p.dead);
}
function handleLeak(e){
  if(e.isBoss){ /* the boss leaking is handled the same as any other leak below -- it just never gets to "beaten" */ }
  hearts--; totalHeartsLostEver++;
  rallyCharge = 0; rallyCharge_announced = false; // "kills with no leaks" -- any leak resets the streak
  if(actx) playLeak(actx.currentTime);
  triggerShake(5, 0.3);
  if(hearts <= 0) enterRetry();
}
function updateBarricade(e, dt){
  if(!BUILDER_CAST || barricadeHp <= 0) return false;
  if(e.dist < BARRICADE_DIST && e.dist + ENEMY_TYPES[e.type].speed*dt >= BARRICADE_DIST){
    e.dist = BARRICADE_DIST; // queue at the wall
  }
  if(Math.abs(e.dist - BARRICADE_DIST) < 4 && e.dist <= BARRICADE_DIST){
    barricadeHp -= 9*dt;
    if(barricadeHp <= 0){ barricadeHp = 0; spawnPuff(posAtDist(BARRICADE_DIST).x, posAtDist(BARRICADE_DIST).y, true, PAL.wood); }
    return true; // blocked this tick
  }
  return false;
}
function updateEnemies(dt){
  for(const e of activeEnemies){
    if(e.dead) continue;
    const blocked = updateBarricade(e, dt);
    if(!blocked) e.dist += ENEMY_TYPES[e.type].speed * dt;
    e.pos = posAtDist(e.dist);
    if(!saviorTeleportedThisWave && SAVIOR_CAST && e.dist >= LAST_CORNER_DIST){
      saviorTeleportedThisWave = true;
      const saviorTower = towers.find(t=>t.role==='savior');
      if(saviorTower){
        saviorTower.teleported = true;
        if(actx) playTeleport(actx.currentTime);
        // PEOPLE FIRST (SPEC-people.md round 1) -- their own quote joins
        // this existing "shows up" bubble when they have one.
        const saviorQuote = (CAST.savior.quotes && CAST.savior.quotes.length) ? nextQuoteFor('savior', fmtLines(CAST.savior.quotes)) : null;
        showBubble(saviorQuote || (fmt(CAST.savior.name).toUpperCase()+' SHOWS UP.'), SAVIOR_TELEPORT_POS.x, SAVIOR_TELEPORT_POS.y-30, 2.2);
      }
    }
    if(e.dist >= TOTAL_PATH_LENGTH){ e.dead = true; e.leaked = true; handleLeak(e); }
  }
  activeEnemies = activeEnemies.filter(e => !e.dead);
}
function updateButterfingersDrops(){
  if(!BUTTERFINGERS_CAST || !phaseData.schedule) return;
  const bTower = towers.find(t=>t.role==='butterfingers');
  if(!bTower) return;
  const baseDist = phaseData.butterfingersBaseDist!==undefined ? phaseData.butterfingersBaseDist : (phaseData.butterfingersBaseDist = nearestPathDistToPoint(towerPos(bTower).x, towerPos(bTower).y));
  for(const d of phaseData.schedule.drops){
    if(d.spawned || phaseData.elapsedInWave < d.t) continue;
    d.spawned = true;
    const dropDist = Math.max(0, Math.min(TOTAL_PATH_LENGTH, baseDist + d.offset));
    const p = posAtDist(dropDist);
    const stats = TOWER_STATS.butterfingers;
    // PEOPLE FIRST (SPEC-people.md round 1) -- applyDamage's own first-kill
    // quote branch (see there) may set this drop's bubble to butterfingers'
    // own quote instead of "OOPS." -- captured before the loop so the
    // unconditional showBubble below only fires when that DIDN'T just
    // happen, rather than clobbering it a moment later.
    const hadQuoteBefore = !!firstKillQuoteShownThisWave.butterfingers;
    for(const e of activeEnemies){
      if(e.dead) continue;
      if(dist2(p.x,p.y,e.pos.x,e.pos.y) <= stats.splashRadius) applyDamage(e, stats.dmg, 'butterfingers');
    }
    spawnPuff(p.x, p.y, true, PAL.heartFull);
    if(actx){ playButterfingersDrop(actx.currentTime); playSplatAoE(actx.currentTime+0.05); }
    if(!(firstKillQuoteShownThisWave.butterfingers && !hadQuoteBefore)) showBubble('OOPS.', p.x, p.y-30, 1.4);
  }
}

/* ======================================================================
   THE RALLY -- kills with no leaks charge the meter; PLAYER-triggered
   (unlike THE FLIGHT's auto-firing SHOUT -- see SPEC-defense.md: "a
   pulsing SAY IT button"), once per GAME.
   ====================================================================== */
function rallyReady(){ return rallyCharge >= 1 && !rallyUsedThisGame; }
function fireRally(){
  if(!rallyReady()) return;
  rallyUsedThisGame = true;
  if(actx) playRallySlam(actx.currentTime);
  sayPunchline();
  triggerShake(10, 0.5);
  timeScale = 0.4; slowMoTimer = 0.9;
  showBanner(CONFIG.punchline, null, 2.0);
  rallyBuffUntil = gameT + 6;
  spawnConfetti();
}

/* ======================================================================
   PHASES -- title / prep / wave / turngood / celebration / endcard.
   ====================================================================== */
function resetRunState(){
  hearts = 3; totalHeartsLostEver = 0;
  towers = buildTowerRoster();
  activeEnemies = []; projectiles = [];
  barricadeHp = 0; barricadeMaxHp = 0;
  judgeHeckledThisWave = false; saviorTeleportedThisWave = false; firstKillQuoteShownThisWave = {};
  wavesHeldCount = 0; rallyCharge = 0; rallyUsedThisGame = false; rallyBuffUntil = 0; rallyCharge_announced = false;
  perWaveDowned = [];
  priorityTargetId = null; priorityUntil = 0; cursorEnemyIndex = 0; padSwapFirst = -1;
  flightPuffs = []; confetti = []; timeScale = 1; slowMoTimer = 0;
  for(const t of towers) t.cooldown = 0;
}
function enterTitle(){
  phase = 'title'; phaseElapsed = 0; phaseData = {};
  setBeatMusic('dinner');
}
function enterPrep(waveIndex){
  phase = 'prep'; phaseElapsed = 0;
  phaseData = { waveIndex, attempt: 1 };
  setBeatMusic('dinner');
}
function enterWave(waveIndex, attempt){
  const schedule = buildWaveSchedule(waveIndex, attempt);
  activeEnemies = []; projectiles = [];
  hearts = 3; // "hearts refill" each wave, same house checkpoint rule flight/engine.js's legs use
  judgeHeckledThisWave = false; saviorTeleportedThisWave = false; firstKillQuoteShownThisWave = {};
  for(const t of towers) if(t.role==='savior') t.teleported = false;
  barricadeMaxHp = TOWER_STATS.builder.barricadeHp; barricadeHp = BUILDER_CAST ? barricadeMaxHp : 0;
  if(BUILDER_CAST && actx) playBarricadeBuild(actx.currentTime);
  perWaveDowned[waveIndex] = perWaveDowned[waveIndex] || {};
  phase = 'wave'; phaseElapsed = 0;
  phaseData = {
    waveIndex, attempt, isFinalWave: waveIndex===FINAL_WAVE_INDEX, schedule,
    elapsedInWave: 0, spawnedCount: 0, bossSpawned: !schedule.boss, bossDefeated: false, awaitingRetry: false,
    butterfingersBaseDist: undefined,
  };
  setBeatMusic(phaseData.isFinalWave && AUTHORITY_CAST ? 'boss' : 'chase');
  if(phaseData.isFinalWave && AUTHORITY_CAST && actx) playBossEntrance(actx.currentTime);
  if(phaseData.isFinalWave && AUTHORITY_CAST){
    showBanner((AUTHORITY_CAST?fmt(CAST.authority.name).toUpperCase():'THE AUTHORITY'), finalBossQuirkLine, 2.6);
  }
}
function spawnEnemy(type, hp, isBoss, startDist){
  const label = DEFENSE_WAVE_LABELS[phaseData.waveIndex];
  const d = startDist || 0;
  activeEnemies.push({ id: nextEnemyId++, type, hp, maxHp:hp, dist:d, pos: posAtDist(d), isBoss:!!isBoss, label, dead:false });
}
function updateWaveSpawning(dt){
  phaseData.elapsedInWave += dt;
  const sched = phaseData.schedule;
  if(!phaseData.bossSpawned && sched.boss && phaseData.elapsedInWave >= sched.boss.t){
    phaseData.bossSpawned = true;
    spawnEnemy('gruntHeavy', sched.boss.hp, true);
  }
  while(phaseData.spawnedCount < sched.events.length && sched.events[phaseData.spawnedCount].t <= phaseData.elapsedInWave){
    const ev = sched.events[phaseData.spawnedCount++];
    spawnEnemy(ev.type, ev.hp, false);
  }
  updateButterfingersDrops();
}
function waveFullySpawned(){ return phaseData.bossSpawned && phaseData.spawnedCount >= phaseData.schedule.events.length; }
function enterRetry(){
  setBeatMusic('sad');
  if(actx) playRetryStinger(actx.currentTime);
  phaseData.awaitingRetry = true;
  CARDS.retry.body = [CONFIG.rankNames.worst + '.', 'ONE MORE GO.'];
  activeCard = CARDS.retry;
  cardT = 0;
}
function updateWave(dt){
  if(phaseData.awaitingRetry){
    if(!activeCard){
      phaseData.awaitingRetry = false;
      setBeatMusic('gameover');
      // 'gameover' plays under the card itself (already shown); once
      // dismissed, the fresh attempt reclaims the wave's own bed.
      enterWave(phaseData.waveIndex, phaseData.attempt+1);
    }
    return;
  }
  updateWaveSpawning(dt);
  updateTowers(dt);
  updateProjectiles(dt);
  updateEnemies(dt);
  if(waveFullySpawned() && activeEnemies.length===0){
    wavesHeldCount++;
    if(actx) playWaveClear(actx.currentTime);
    if(phaseData.isFinalWave){
      if(AUTHORITY_CAST && phaseData.bossDefeated) enterTurnGood();
      else enterCelebration();
    } else {
      enterPrep(phaseData.waveIndex+1);
    }
  }
}
function enterTurnGood(){
  const usedPads = new Set(towers.map(t=>t.padIndex));
  let emptyPad = -1;
  for(let i=0;i<PAD_POSITIONS.length;i++) if(!usedPads.has(i)){ emptyPad = i; break; }
  const authorityTower = { role:'authority', padIndex: emptyPad, standsBesideThing: emptyPad===-1, cooldown:0 };
  towers.push(authorityTower);
  showBanner((AUTHORITY_CAST?fmt(CAST.authority.name).toUpperCase():'THE AUTHORITY')+' TURNS GOOD.', 'AND JOINS THE DEFENSE.', 2.4);
  const rng = makeRng(TURNGOOD_SEED);
  const hp = perEnemyHp(FINAL_WAVE_INDEX) * 0.6;
  const events = [];
  let t = 0.6;
  for(let i=0;i<3;i++){ events.push({ t, type: rngPick(rng,['grunt','gruntHeavy']), hp }); t += rngRange(rng,2.0,3.2); }
  phase = 'turngood'; phaseElapsed = 0;
  phaseData = { schedule:{ events, boss:null, drops:[] }, elapsedInWave:0, spawnedCount:0, bossSpawned:true, waveIndex: FINAL_WAVE_INDEX };
  activeEnemies = []; projectiles = [];
  setBeatMusic('celebration');
}
function updateTurnGood(dt){
  phaseData.elapsedInWave += dt;
  const sched = phaseData.schedule;
  while(phaseData.spawnedCount < sched.events.length && sched.events[phaseData.spawnedCount].t <= phaseData.elapsedInWave){
    const ev = sched.events[phaseData.spawnedCount++];
    // "a short STRAGGLER mini-wave" (SPEC-defense.md) -- these three
    // spawn already most of the way home (LAST_CORNER_DIST, the same
    // near-leak threshold THE SAVIOR's own teleport trigger uses), not a
    // fresh full lap of the whole path. A full-lap spawn (dist 0, like
    // every normal wave) would pass straight through every other placed
    // tower's own coverage first, especially THE FIRST BOSS's long 270px
    // sniper range -- in a fully-cast game that reliably kills every
    // straggler before it ever reaches the turned-good tower's position
    // beside THE THING, so the "strongest tower on the board" would never
    // actually get to fire a shot. Starting them this close still leaves
    // a real (if short) window before TOTAL_PATH_LENGTH -- the turned-
    // good tower's own high dps (TURNGOOD_STATS) comfortably clears it.
    spawnEnemy(ev.type, ev.hp, false, LAST_CORNER_DIST);
  }
  updateTowers(dt);
  updateProjectiles(dt);
  updateEnemies(dt);
  if(phaseData.spawnedCount >= sched.events.length && activeEnemies.length===0) enterCelebration();
}
function enterCelebration(){
  phase = 'celebration'; phaseElapsed = 0; phaseData = {};
  setBeatMusic('celebration');
  if(actx) playWaveClear(actx.currentTime);
  sayPunchline();
  // PEOPLE FIRST (SPEC-people.md round 1) -- "the host's quotes join
  // their existing celebratory lines": the banner's sub-line becomes one
  // of the host's own quotes when they have any.
  const hostQuote = (CONFIG.host && CONFIG.host.quotes && CONFIG.host.quotes.length) ? nextQuoteFor('host', fmtLines(CONFIG.host.quotes)) : null;
  showBanner(CONFIG.punchline, hostQuote, 2.4);
  spawnConfetti();
}
function updateCelebration(dt){
  if(phaseElapsed >= 2.8) enterEndcard();
}
function enterEndcard(){
  phase = 'endcard'; phaseElapsed = 0;
  const rank = totalHeartsLostEver===0 ? CONFIG.rankNames.immaculate : CONFIG.rankNames.comicTiming;
  phaseData = { rank };
  setBeatMusic('gameover');
  // PEOPLE FIRST (SPEC-people.md round 1) -- see buildCrewCredits' own header.
  CREW_CREDITS = buildCrewCredits();
}
function resetGame(){
  cardsShown.retry = false;
  activeCard = null;
  phase = 'title'; phaseElapsed = 0; phaseData = {};
}

/* ======================================================================
   UPDATE / ACTION DISPATCH
   ====================================================================== */
function update(dt){
  phaseElapsed += dt;
  if(phase==='title'){ /* attract screen -- nothing to simulate */ }
  else if(phase==='prep'){ /* waits for READY */ }
  else if(phase==='wave') updateWave(dt);
  else if(phase==='turngood') updateTurnGood(dt);
  else if(phase==='celebration') updateCelebration(dt);
  else if(phase==='endcard'){ /* waits for input */ }
}
function sortedFrontEnemies(){
  return activeEnemies.slice().sort((a,b)=>b.dist-a.dist).slice(0,6);
}
function setPriorityAt(x, y){
  let best = null, bestD = 30;
  for(const e of activeEnemies){
    const d = dist2(x,y,e.pos.x,e.pos.y);
    if(d < bestD){ bestD = d; best = e; }
  }
  if(best){ priorityTargetId = best.id; priorityUntil = gameT + 3; return true; }
  return false;
}
function padAt(x, y){
  for(let i=0;i<PAD_POSITIONS.length;i++){ if(dist2(x,y,PAD_POSITIONS[i].x,PAD_POSITIONS[i].y) < 34) return i; }
  return -1;
}
function trySwapPads(padIndex){
  if(padSwapFirst === -1){
    if(towerByPad(padIndex)) padSwapFirst = padIndex;
    return;
  }
  if(padIndex === padSwapFirst){ padSwapFirst = -1; return; }
  const a = towerByPad(padSwapFirst), b = towerByPad(padIndex);
  if(a && b){
    const tmp = a.padIndex; a.padIndex = b.padIndex; b.padIndex = tmp;
    if(actx) playPadSwap(actx.currentTime);
  }
  padSwapFirst = -1;
}
function handleAction(){
  if(activeCard){ activeCard = null; return; }
  if(phase==='title'){ ensureAudioStarted(); resetRunState(); enterPrep(0); return; }
  if(phase==='prep'){ enterWave(phaseData.waveIndex, phaseData.attempt); return; }
  if(phase==='wave'){
    if(rallyReady()){ fireRally(); return; }
    const front = sortedFrontEnemies();
    if(front.length){
      const e = front[Math.min(cursorEnemyIndex, front.length-1)];
      priorityTargetId = e.id; priorityUntil = gameT+3;
    }
    return;
  }
  if(phase==='endcard'){ resetGame(); return; }
}
function pollGamepadAction(){
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
   DRAW -- board
   ====================================================================== */
function drawBoard(ctx){
  ctx.fillStyle = PAL.night; ctx.fillRect(0,0,CW,CH);
  ctx.fillStyle = PAL.grass; ctx.fillRect(0,0,CW,CH);
  // path -- stamp pathFill along straight runs, pathEdgeCorner rotated at
  // each turn, matching flight/engine.js's own "rotate, don't re-source"
  // convention for a small tile set covering many orientations.
  const w = DEFENSE_IMG.pathFill;
  for(const seg of PATH_SEGMENTS){
    const len = seg.len, steps = Math.max(1, Math.round(len/56));
    for(let i=0;i<=steps;i++){
      const local = i/steps;
      const x = seg.a.x+(seg.b.x-seg.a.x)*local, y = seg.a.y+(seg.b.y-seg.a.y)*local;
      drawPacked(ctx, w, x, y, PATH_WIDTH);
    }
  }
  for(let i=1;i<PATH_WAYPOINTS.length-1;i++){
    const wp = PATH_WAYPOINTS[i];
    drawPacked(ctx, DEFENSE_IMG.pathEdgeCorner, wp.x, wp.y, PATH_WIDTH*0.95);
  }
  // pads
  for(const p of PAD_POSITIONS) drawPacked(ctx, DEFENSE_IMG.pad, p.x, p.y, 58);
  // THE THING
  drawThePedestal(ctx, THE_THING_POS.x-28, THE_THING_POS.y-24, 8);
  drawReadingTextOutlined(ctx, DEFENSE_DEFENDING, THE_THING_POS.x, THE_THING_POS.y+22, 12, PAL.gold, '#000000', 'center');
  // barricade
  if(BUILDER_CAST && barricadeHp>0){
    const bp = posAtDist(BARRICADE_DIST);
    drawBarricade(ctx, bp.x-18, bp.y-14, 5);
    const pct = Math.max(0, barricadeHp/barricadeMaxHp);
    ctx.fillStyle = PAL.heartEmpty; ctx.fillRect(bp.x-20, bp.y-24, 40, 5);
    ctx.fillStyle = PAL.heartFull; ctx.fillRect(bp.x-20, bp.y-24, 40*pct, 5);
  }
}
function drawTowers(ctx){
  for(const t of towers){
    const stats = t.role==='authority' ? TURNGOOD_STATS : TOWER_STATS[t.role];
    const pos = towerPos(t);
    drawPacked(ctx, DEFENSE_IMG[stats.look], pos.x, pos.y, 52);
    const sprite = t.role==='host' ? roleSprite(CONFIG.host,'host') : roleSprite(CAST[t.role], t.role);
    drawRosterSprite(ctx, sprite.sheet, sprite.col, sprite.row, pos.x-9, pos.y-46, 2.8, false);
    drawReadingTextOutlined(ctx, roleName(t.role==='host'?'host':t.role), pos.x, pos.y+26, 10, PAL.cream, '#000000', 'center');
    if(t.role==='savior' && SAVIOR_CAST && (gameT*2)%2<1){
      ctx.save(); ctx.globalAlpha=0.22; ctx.fillStyle=PAL.gold;
      ctx.beginPath(); ctx.arc(pos.x,pos.y,TOWER_STATS.savior.auraRadius,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
  }
}
function drawEnemies(ctx){
  for(const e of activeEnemies){
    const img = DEFENSE_IMG[ENEMY_TYPES[e.type].img];
    const scale = e.isBoss ? 2.0 : 1.0;
    drawPacked(ctx, img, e.pos.x, e.pos.y, 34*scale);
    const hpPct = Math.max(0, e.hp/e.maxHp);
    const barW = 26*scale;
    ctx.fillStyle = PAL.heartEmpty; ctx.fillRect(Math.round(e.pos.x-barW/2), Math.round(e.pos.y-20*scale), barW, 4);
    ctx.fillStyle = PAL.heartFull; ctx.fillRect(Math.round(e.pos.x-barW/2), Math.round(e.pos.y-20*scale), barW*hpPct, 4);
    drawReadingTextOutlined(ctx, e.label, e.pos.x, e.pos.y+16*scale, 9, PAL.cream, '#000000', 'center');
    if(priorityTargetId===e.id && gameT<priorityUntil){
      ctx.save(); ctx.strokeStyle = PAL.gold; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(e.pos.x, e.pos.y, 20*scale, 0, Math.PI*2); ctx.stroke(); ctx.restore();
    }
  }
  const front = phase==='wave' ? sortedFrontEnemies() : [];
  if(front.length){
    const cur = front[Math.min(cursorEnemyIndex, front.length-1)];
    ctx.save(); ctx.strokeStyle = PAL.cream; ctx.lineWidth=1.5; ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.arc(cur.pos.x, cur.pos.y, 26, 0, Math.PI*2); ctx.stroke(); ctx.restore();
  }
}
function drawProjectiles(ctx){
  for(const p of projectiles){
    const ang = Math.atan2((activeEnemies.find(e=>e.id===p.targetId)||p).pos ? (activeEnemies.find(e=>e.id===p.targetId).pos.y-p.y) : 0, 1);
    drawPacked(ctx, DEFENSE_IMG[p.img], p.x, p.y, 22, ang);
  }
}
function drawHUD(ctx){
  for(let i=0;i<3;i++) drawHeart(ctx, 14+i*22, 14, 3, i<hearts);
  const waveIdx = (phase==='wave'||phase==='prep') ? phaseData.waveIndex : Math.min(WAVES_COUNT-1, wavesHeldCount);
  const label = (phase==='wave') ? DEFENSE_WAVE_LABELS[waveIdx] : (phase==='prep' ? 'GET READY' : '');
  if(phase==='wave' || phase==='prep'){
    const chip = 'WAVE '+(waveIdx+1)+' OF '+WAVES_COUNT+(label?(' -- '+label):'');
    const w = Math.max(160, chip.length*8+20);
    ctx.save(); ctx.globalAlpha=0.85;
    ctx.fillStyle = PAL.wood; ctx.fillRect(CW/2-w/2-2, 10, w+4, 24);
    ctx.fillStyle = '#1a1410'; ctx.fillRect(CW/2-w/2, 12, w, 20);
    ctx.restore();
    drawReadingText(ctx, chip, CW/2, 16, 12, PAL.gold, 'center');
  }
  if(phase==='wave' && !phaseData.awaitingRetry){
    const mx=CW-190, my=14, mw=150, mh=12;
    ctx.save(); ctx.fillStyle='#1a1410'; ctx.fillRect(mx-2,my-2,mw+4,mh+4);
    ctx.fillStyle = rallyReady()?PAL.gold:'#5c4a26';
    ctx.fillRect(mx,my,mw*Math.min(1,rallyCharge),mh);
    ctx.restore();
    if(rallyReady() && Math.floor(gameT*3)%2===0) drawReadingText(ctx, 'THE RALLY -- '+(isTouch?'TAP':'SPACE'), mx+mw/2, my+16, 11, PAL.gold, 'center');
    else if(!rallyUsedThisGame) drawReadingText(ctx, 'THE RALLY', mx+mw/2, my+16, 10, PAL.cream, 'center');
  }
  if(bubble && gameT < bubble.until) drawAutoBubble(ctx, bubble.text, bubble.x, bubble.y, 12, 1);
  if(bannerText && gameT < bannerUntil){
    const p = Math.min(1, (bannerUntil-gameT)>1.3 ? (1.6-(bannerUntil-gameT))/0.3 : 1);
    ctx.save(); ctx.globalAlpha = Math.min(1,p);
    drawChunkyText(ctx, bannerText, CW/2, 100, 26, PAL.gold, PAL.outline, 'center');
    if(bannerSub) drawReadingText(ctx, bannerSub, CW/2, 140, 14, PAL.cream, 'center');
    ctx.restore();
  }
}
function drawTitleScreen(ctx){
  const lockup = (CONFIG.title.lockupLines||['YOUR','GROUP']).join(' ');
  drawChunkyText(ctx, lockup, CW/2, 150, 40, PAL.gold, PAL.outline, 'center');
  drawReadingText(ctx, 'A RECURRING ANNOYANCE THE GROUP DEFENDS AGAINST.', CW/2, 220, 15, PAL.cream, 'center');
  drawReadingText(ctx, 'DEFENDING: '+DEFENSE_DEFENDING, CW/2, 250, 14, PAL.gold, 'center');
  if(Math.floor(gameT*2)%2===0) drawReadingText(ctx, isTouch?'TAP TO START':'PRESS SPACE TO START', CW/2, 300, 15, PAL.gold, 'center');
}
function drawPrepScreen(ctx){
  drawReadingText(ctx, 'WAVE '+(phaseData.waveIndex+1)+' OF '+WAVES_COUNT+' -- '+DEFENSE_WAVE_LABELS[phaseData.waveIndex], CW/2, 60, 16, PAL.gold, 'center');
  drawReadingText(ctx, isTouch?'TAP A PAD, THEN ANOTHER, TO SWAP -- TAP READY WHEN SET':'ARROWS+SPACE TO SWAP -- SPACE ON READY TO START', CW/2, 88, 12, PAL.cream, 'center');
  const rw=160, rh=40, rx=CW/2-rw/2, ry=CH-70;
  ctx.save(); ctx.fillStyle=PAL.gold; ctx.fillRect(rx-3,ry-3,rw+6,rh+6); ctx.fillStyle='#1a1410'; ctx.fillRect(rx,ry,rw,rh); ctx.restore();
  drawReadingText(ctx, 'READY', CW/2, ry+13, 16, PAL.gold, 'center');
  if(padSwapFirst!==-1){
    const pp = PAD_POSITIONS[padSwapFirst];
    ctx.save(); ctx.strokeStyle=PAL.gold; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(pp.x,pp.y,34,0,Math.PI*2); ctx.stroke(); ctx.restore();
  }
}
function drawMedal(ctx, cx, cy){
  ctx.save(); ctx.fillStyle=PAL.gold; ctx.beginPath(); ctx.arc(cx,cy,26,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=PAL.outline; ctx.lineWidth=3; ctx.stroke(); ctx.restore();
}
/* PEOPLE FIRST (SPEC-people.md round 1) -- THE WHOLE CREW (see
   buildCrewCredits). No-op (returns y unchanged) when CREW_CREDITS is
   empty -- absent quotes/extras, the end card renders byte-identical to
   before this feature existed. */
function drawCrewCredits(ctx, y){
  if(!CREW_CREDITS.length) return y;
  y += 6;
  drawReadingText(ctx, 'THE WHOLE CREW', CW/2, y, 14, PAL.gold, 'center'); y += 18;
  for(const c of CREW_CREDITS){
    const line = c.quote ? (c.name + ': "' + c.quote + '"') : c.name;
    const tw = measureReadingText(ctx, line, 11);
    drawRosterSprite(ctx, c.sprite.sheet, c.sprite.col, c.sprite.row, CW/2 - tw/2 - 20, y-8, 1, false);
    drawReadingText(ctx, line, CW/2, y, 11, PAL.cream, 'center');
    y += 16;
  }
  return y + 6;
}
function drawEndcard(ctx){
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,CW,CH);
  drawChunkyText(ctx, CONFIG.punchline, CW/2, 26, 24, PAL.gold, PAL.outline, 'center');
  let y = 66;
  drawReadingText(ctx, 'WAVES HELD: '+wavesHeldCount+' OF '+WAVES_COUNT, CW/2, y, 15, PAL.cream, 'center'); y+=22;
  drawReadingText(ctx, 'HEARTS LOST: '+totalHeartsLostEver, CW/2, y, 14, PAL.cream, 'center'); y+=20;
  drawReadingText(ctx, rallyUsedThisGame?'THE RALLY: FIRED':'THE RALLY: SAVED', CW/2, y, 14, PAL.cream, 'center'); y+=26;
  drawMedal(ctx, CW/2, y+22); y+=52;
  drawReadingText(ctx, phaseData.rank, CW/2, y, 18, PAL.gold, 'center'); y+=28;
  for(let i=0;i<WAVES_COUNT;i++){
    const label = DEFENSE_WAVE_LABELS[i];
    const counts = perWaveDowned[i] || {};
    const total = Object.keys(counts).reduce((s,k)=>s+counts[k],0);
    drawReadingText(ctx, label+' DOWNED: '+total, CW/2, y, 12, PAL.cream, 'center'); y+=16;
  }
  y += 8;
  if(BUILDER_CAST){ drawReadingText(ctx, 'BUILT BY '+fmt(CAST.builder.name).toUpperCase()+'.', CW/2, y, 12, PAL.cream, 'center'); y+=20; }
  y = drawCrewCredits(ctx, y);
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
  drawBoard(ctx);
  if(phase==='title'){ drawTitleScreen(ctx); }
  else if(phase==='endcard'){ drawEndcard(ctx); }
  else {
    drawTowers(ctx);
    drawEnemies(ctx);
    drawProjectiles(ctx);
    updateAndDrawPuffs(ctx);
    updateAndDrawConfetti(ctx);
    if(phase==='prep') drawPrepScreen(ctx);
    drawHUD(ctx);
  }
  ctx.restore();
}

/* ======================================================================
   INPUT -- tap/click an enemy for priority target; tap a pad then
   another to swap (prep only); action/READY/keyboard cycles + confirms.
   Volume UI pointerdown check comes first, always.
   ====================================================================== */
window.addEventListener('keydown', (e)=>{
  keys[e.code] = true;
  ensureAudioStarted();
  if(e.code==='KeyM' && !e.repeat){ toggleMute(); return; }
  if(rotatePromptActive) return;
  if(phase==='wave' && !e.repeat){
    if(e.code==='ArrowUp' || e.code==='ArrowLeft'){ cursorEnemyIndex = Math.max(0, cursorEnemyIndex-1); return; }
    if(e.code==='ArrowDown' || e.code==='ArrowRight'){ cursorEnemyIndex = cursorEnemyIndex+1; return; }
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
  if(activeCard || phase==='title' || phase==='endcard'){ handleAction(); return; }
  if(phase==='prep'){
    const rw=160, rh=40, rx=CW/2-rw/2, ry=CH-70;
    if(p.x>=rx && p.x<=rx+rw && p.y>=ry && p.y<=ry+rh){ handleAction(); return; }
    const pad = padAt(p.x, p.y);
    if(pad!==-1) trySwapPads(pad);
    return;
  }
  if(phase==='wave' || phase==='turngood'){
    if(phase==='wave' && rallyReady()){
      const mx=CW-190, my=14, mw=150, mh=16;
      if(p.x>=mx && p.x<=mx+mw && p.y>=my-2 && p.y<=my+mh){ fireRally(); return; }
    }
    setPriorityAt(p.x, p.y);
  }
});
window.addEventListener('load', ()=>{ try{ ensureAudioStarted(); }catch(e){} });

/* ======================================================================
   MAIN LOOP -- same frame()/rAF shape every engine uses (see flight/
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
  pollGamepadAction();
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
