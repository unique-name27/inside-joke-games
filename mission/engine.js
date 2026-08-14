'use strict';
/* ======================================================================
   THE MISSION -- template #5 engine (see SPEC-mission.md). Single page, no
   separate intro (a short title screen lives inside this file, below).
   Built ON shared/framework.js, following the exact conventions
   flight/engine.js and defense/engine.js already established for this
   project's non-hangout templates (ENGINE_ROOT/CFG_FRAGMENT resolution,
   local CW/CH + eager fitCanvas() call, local SFX_DEFS/MUSIC_LOOP_DEFS +
   wrapper functions, local pixel-primitive helpers, local
   drawRotatePrompt, tick()/update()/draw() factored the same way) rather
   than inventing a new pattern. Movement uses the framework's shared
   getMoveVector()/touchJoystick (left-half floating joystick + right-half
   tap for action) -- the HANGOUT's touch convention (see game/engine.js's
   own pointerdown handler), NOT flight's whole-screen-tap -- because this
   template needs a real 2D move vector, not a single flap button.

   ROUND 1 SCOPE (this file): the full vertical squadron shmup -- seeded
   scrolling starfield, the host's ship plus a wingmate per cast FRIEND
   role (savior/butterfingers/builder/diner0) each doing their own
   personality, seeded per-stage formation waves with mini label plaques
   on the bigger enemies, seeded meteor drifts, THE BEAM catchphrase
   (crate-charged, manually fired, full wipe in a normal stage / a big
   damage chunk + beamed retort during a boss phase), the mid-mission
   ambush (THE FIRST BOSS's ace fighter, or an elite swarm volley when
   judge is uncast), the flagship finale (THE FINAL BOSS's multi-part ship
   across 3 seeded volley phases, or a grand meteor-and-swarm finale volley
   when authority is uncast), turn-good eject-pod + victory flyby, 3
   shield pips + the "THE MISSION STALLS" stage-retry loop, the mission %
   progress bar, and the end card. What round 1 does NOT do (round 2 per
   SPEC-mission.md's build plan): the wizard's mission step / missionField
   cast lines, tools/generate.js support, and a registered harness driver
   (tools/verify-mission.js) -- this file exposes plain top-level functions
   (tick/handleAction/fireBeam) exactly the way flight/engine.js and
   defense/engine.js do, so wiring a future harness is a thin wrapper, not
   a rewrite.

   DESIGN CALLS THIS ROUND MADE where SPEC-mission.md leaves room (flagged
   here, not just in the round report, so the next engineer sees the
   reasoning in context):
   - Stages advance on a FIXED timer (like flight's legs), not a
     clear-the-wave gate (like defense's waves) -- "vertical shmup" reads
     as continuous scrolling, not a stand-and-clear encounter, and it
     keeps forward progress guaranteed regardless of squadron DPS. Only
     hits taken (pips) can stall a stage, never remaining enemies.
   - Only the HOST's own ship takes hit detection (enemy fire/contact,
     meteors). Wingmates fly, fire, and do their personality beats, but
     are never themselves "destroyed" -- same precedent as defense's
     towers (never destroyed, only leaks cost hearts) and flight's plane
     (only it can crash).
   - THE BEAM behaves as a WIPE whenever no real boss entity is on screen
     (a normal stage, or the uncast elite-volley/finale-volley
     substitutes) and as a damage-chunk-plus-retort only when a real boss
     entity (the ambush's ace fighter, the flagship) is present.
   - The flagship fight is exactly 3 seeded volley phases (SPEC-mission.md
     says "2-3"; 3 is simplest to seed consistently -- `<gameId>:mission:
     flagship:<attempt>:<phase>` for phase 0/1/2) with a shared HP pool
     depleting across all three; a defensive floor forces it to 0 if any
     future harness policy somehow reaches the end of phase 2 without
     defeating it, so the encounter can never soft-lock.
   ====================================================================== */

const ENGINE_ROOT = new URL('../', document.currentScript.src).href;

/* URL-fragment CONFIG override -- identical mechanism/rationale to
   flight/engine.js's and defense/engine.js's own (see either file's
   header). `cfgBuildDefaultConfig` is called with the THIRD arg 'mission'
   so a no-fragment boot builds a mission-shaped default (not the
   hangout's) -- see SPEC-flight.md's build-plan note (inherited by every
   template since) about not repeating the redirect-path gap the gallery
   patched defensively. */
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
  CONFIG = cfgBuildDefaultConfig(ENGINE_ROOT, undefined, 'mission');
}
// defensive default -- mirrors flight/engine.js's CONFIG.flight guard and
// defense/engine.js's CONFIG.defense guard exactly (see either's own
// comment): the brief window before the redirect above actually navigates
// away still needs this file to not crash on CONFIG.mission.* references.
if(!CONFIG.mission) CONFIG.mission = {
  mission: 'GET EVERYONE HOME',
  swarms: ['THE USUAL SUSPECTS', 'THE LATECOMERS', 'THE WHOLE SITUATION'],
  shipColor: 'blue',
};

document.title = (CONFIG.title && CONFIG.title.gamePageTitle) || 'The Mission -- Playable Demo';

/* ---------------- constants & palette ---------------- */
const CW = 960, CH = 540, TILE = 16;
// fitCanvas() (shared/framework.js) reads CW/CH -- see flight/engine.js's
// identical comment for why the one initial call has to happen here.
fitCanvas();
const PAL = {
  cream:'#f3e9d2', wood:'#8a5a30', night:'#141428', gold:'#e8b84b', outline:'#6b2b1f', ink:'#2a1c12',
  pipFull:'#e8b84b', pipEmpty:'#4a3a20', hammer:'#c9954a',
};

/* ---------------- CONFIG-derived helpers -- {HOST} token, same as every
   other template ---------------- */
const STORAGE_PREFIX = CFG_FRAGMENT ? ('frag_' + CFG_FRAGMENT.hash) : ((CONFIG && CONFIG.gameId) || 'mission');
function fmt(s){
  if(typeof s !== 'string') return s;
  return CONFIG.host ? s.split('{HOST}').join(CONFIG.host.name) : s;
}
function fmtLines(lines){ return lines.map(fmt); }

const CAST = CONFIG.cast || {};
// judge/authority are the BOSS FLEET here (antagonists), not player-side
// wingmates -- see SPEC-mission.md: "The bosses are the boss fleet
// (antagonists here, unlike The Defense)". The squadron itself is
// savior/butterfingers/builder/diner0.
const JUDGE_CAST = !!CAST.judge;         // THE FIRST BOSS -- mid-mission ambush ace fighter
const AUTHORITY_CAST = !!CAST.authority; // THE FINAL BOSS -- the flagship
const SAVIOR_CAST = !!CAST.savior;
const BUTTERFINGERS_CAST = !!CAST.butterfingers;
const BUILDER_CAST = !!CAST.builder;

const MISSION_LINE = (CONFIG.mission.mission && CONFIG.mission.mission.trim()) ? CONFIG.mission.mission.trim() : 'GET EVERYONE HOME';
const MISSION_SWARMS_RAW = (CONFIG.mission.swarms && CONFIG.mission.swarms.length) ? CONFIG.mission.swarms : ['THE USUAL SUSPECTS'];
const STAGE_COUNT = Math.max(1, Math.min(6, MISSION_SWARMS_RAW.length));
const MISSION_SWARMS = MISSION_SWARMS_RAW.slice(0, STAGE_COUNT);
const MISSION_SHIP_COLORS = ['blue', 'green', 'orange', 'red'];
const MISSION_SHIP_COLOR = (MISSION_SHIP_COLORS.indexOf(CONFIG.mission.shipColor) !== -1) ? CONFIG.mission.shipColor : 'blue';
const AMBUSH_AFTER_INDEX = Math.ceil(STAGE_COUNT / 2) - 1; // the mid-mission ambush lands right after this stage completes

/* neutral fallback pools -- template-owned, tone-clean, used whenever a
   config doesn't supply the optional mission.firstBossHeckle/
   finalBossQuirk lines (see SPEC-mission.md's config section, and
   flight/engine.js's/defense/engine.js's identical pattern). BEAM_RETORT
   and FLAGSHIP_TURNGOOD are wholly engine-owned (SPEC-mission.md doesn't
   ask for config fields for either) -- both hand-authored wholesome-
   deadpan per this round's own house rule ("the tone gate never scans
   engine source, so this is on you"). Picked deterministically per game
   via the same seeded rng everything else uses, never Math.random. */
const FIRST_BOSS_HECKLE_FALLBACKS = [
  'NICE FORMATION. WON\'T LAST.', 'IS THAT THE BEST YOU\'VE GOT?', 'CUTE SQUADRON.', 'THIS WON\'T TAKE LONG.',
];
const FINAL_BOSS_QUIRK_FALLBACKS = [
  'STILL MAD ABOUT THE FLIGHT PLAN.', 'NEVER FORGIVES A LATE RENDEZVOUS.', 'CANNOT STAND AN UNTIDY FORMATION.',
];
const BEAM_RETORT_FALLBACKS = [
  'BARELY FELT THAT.', 'NICE TRY.', 'IS THAT ALL YOU\'VE GOT?', 'THAT TICKLED.',
];
const FLAGSHIP_TURNGOOD_FALLBACKS = [
  'OKAY. THAT WAS ACTUALLY KIND OF FUN.', 'FINE. YOU WIN THIS ONE.', 'ALRIGHT, ALRIGHT. TAKE ME WITH YOU.',
];
const FIRST_BOSS_HECKLE = CONFIG.mission.firstBossHeckle || null;
const FINAL_BOSS_QUIRK = CONFIG.mission.finalBossQuirk || null;

/* ======================================================================
   SEEDED RNG -- gameId hash -> a deterministic sequence, never Math.random.
   Reuses cfgHashString (game/cfgcodec.js, already loaded) for the hash;
   mulberry32 turns that into a repeatable stream. Byte-identical
   implementation to flight/engine.js's/defense/engine.js's own
   (duplicated per engine on purpose, same convention as the pixel
   primitives below).
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
const GAME_SEED_BASE = CONFIG.gameId || 'mission';
const gameRng = makeRng(GAME_SEED_BASE + ':mission:flavor');

/* ======================================================================
   PEOPLE FIRST (SPEC-people.md round 1) -- quotes-shown log every
   tools/verify-mission.js's own PROBE reads (no duplicated literals),
   seeded per-person quote rotation, and THE WHOLE CREW end-card credits.
   Byte-identical implementation to gallery/flight/defense/engine.js's own
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
/* THE WHOLE CREW -- every `extras` entry (unconditional, when named --
   also flown as up to 2 plain extra wingmen, see EXTRA_WINGMATE_ROLES/
   drawWingmates) plus a safety-net sweep for any quoted host/judge/
   authority/savior/butterfingers/builder who never got a natural
   on-screen moment this playthrough (the between-stage chatter marquee,
   the celebration banner, or the boss heckle/quirk pool below). diner0
   IS one of the squadron's own wingmate roles here (see FORMATION_
   OFFSETS.diner0) but still routes through the same safety-net role loop
   below (not an unconditional listing) -- it still leads the list
   whenever the block has ANYTHING to show ("listing diner0 + every
   extras entry", SPEC-people.md). Built once, right when the end card is
   entered (see enterEndcard below). */
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
/* between-stage chatter -- "one wingmate quote marqueed under the stage
   banner (seeded rotation)" (SPEC-people.md). Pool = the squadron's own
   FRIEND roles (savior/butterfingers/builder/diner0, this file's own
   header) plus any flown extras (see EXTRA_WINGMATE_ROLES) -- judge/
   authority are covered by the boss heckle/quirk pool below instead (a
   real ambush/flagship encounter, not a chatter beat, is their own
   natural spot), and host rides the celebration banner (see
   enterCelebration). Round-robins across stage entries (never
   Math.random); each speaker's own quote pick is nextQuoteFor's own
   seeded rotation. Returns null (no chatter -- today's behavior) when
   nobody eligible has quotes. */
let chatterTurn = 0;
function pickStageChatter(){
  const slots = ['savior', 'butterfingers', 'builder', 'diner0'].concat(EXTRA_WINGMATE_ROLES);
  const eligible = slots.filter(slot => personForWingmate(slot) && personForWingmate(slot).quotes && personForWingmate(slot).quotes.length);
  if(!eligible.length) return null;
  const slot = eligible[chatterTurn % eligible.length];
  chatterTurn++;
  const person = personForWingmate(slot);
  return nextQuoteFor(slot, fmtLines(person.quotes));
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
   ASSETS -- the Space Shooter Remastered pack (assets/mission/, CC0, see
   assets/mission/CREDITS.txt for exactly which pieces and why) plus the
   same roster character sheets every template can draw a cast pick from.
   ====================================================================== */
const MISSION_IMG_FILES = {
  playerShip1_blue:'playerShip1_blue.png', playerShip1_green:'playerShip1_green.png',
  playerShip1_orange:'playerShip1_orange.png', playerShip1_red:'playerShip1_red.png',
  enemyGreen1:'enemyGreen1.png', enemyGreen2:'enemyGreen2.png', enemyGreen3:'enemyGreen3.png',
  enemyGreen4:'enemyGreen4.png', enemyGreen5:'enemyGreen5.png',
  enemyBlack1:'enemyBlack1.png', enemyBlack2:'enemyBlack2.png', enemyBlack3:'enemyBlack3.png',
  enemyBlack4:'enemyBlack4.png', enemyBlack5:'enemyBlack5.png',
  ufoGreen:'ufoGreen.png',
  laserBlue:'laserBlue01.png', laserGreen:'laserGreen01.png', laserRed:'laserRed01.png',
  meteorBrownBig:'meteorBrown_big1.png', meteorBrownSmall:'meteorBrown_small1.png',
  meteorGreyBig:'meteorGrey_big1.png', meteorGreySmall:'meteorGrey_small1.png',
  background:'darkPurple.png',
  shield:'shield1.png', fire:'fire00.png', engineTrail:'engine1.png',
  crateBolt:'bolt_gold.png', crateShield:'shield_gold.png', crateStar:'star_gold.png',
};
const MISSION_IMG = {};
let assetsSettledCount = 0;
let assetsReady = false;
const ROSTER_SHEET_IMAGES = {};
const ROSTER_SHEET_KEYS = (typeof ROSTER_SHEETS !== 'undefined') ? Object.keys(ROSTER_SHEETS) : [];
const ASSETS_TOTAL = Object.keys(MISSION_IMG_FILES).length + ROSTER_SHEET_KEYS.length;
function markAssetSettled(){ assetsSettledCount++; if(assetsSettledCount>=ASSETS_TOTAL) assetsReady = true; }
for(const key in MISSION_IMG_FILES){
  const img = new Image();
  img.src = ENGINE_ROOT + 'assets/mission/' + MISSION_IMG_FILES[key];
  img.onload = markAssetSettled; img.onerror = markAssetSettled;
  MISSION_IMG[key] = img;
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
/* generic scaled draw for a Space Shooter pack piece, anchored by its
   CENTER (cx,cy) at a given display width (aspect-locked to the source),
   with an optional rotation in radians -- same signature defense/engine.js's
   own drawPacked already established for a pack whose pieces sometimes
   need rotating (meteors here; the path tiles there). */
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

/* ---------------- procedural props NOT in the Space Shooter pack (see
   assets/mission/CREDITS.txt) -- same drawBitmap-prop convention as
   gallery/engine.js's PLATE_ROWS/PLUSH_ROWS, flight/engine.js's
   HEART_ROWS/PHONE_ROWS, defense/engine.js's THING_ROWS/BARRICADE_ROWS.
   ---------------- */
const SHIELD_PIP_ROWS = ['.111.', '11111', '11111', '.111.', '..1..'];
function drawShieldPip(ctx, x, y, cell, full){
  drawBitmap(ctx, SHIELD_PIP_ROWS, { '1': full ? PAL.pipFull : PAL.pipEmpty }, x, y, cell);
}
const HAMMER_ROWS = ['.11.', '1111', '.11.', '.11.'];
function drawHammer(ctx, x, y, cell){ drawBitmap(ctx, HAMMER_ROWS, { '1': PAL.hammer }, x, y, cell); }

/* ======================================================================
   AUDIO -- reuses shared/framework.js's makeBufferBank/playSample/twang/
   ducking/volume UI/SpeechSynthesis wrapper; this block is this engine's
   own content (SFX list + wrappers + music-loop defs), same convention as
   flight/engine.js/defense/engine.js. Every SFX file below already ships
   in assets/audio/sfx/ -- no new audio assets were needed for this
   template (see assets/mission/CREDITS.txt).
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
   flight/engine.js's/defense/engine.js's own SFX_DEFS documents. */
const SFX_DEFS = {
  fire:          { src:ENGINE_ROOT+'assets/audio/sfx/woosh3.ogg',                gain:0.35 }, // player/wingmate shot
  wildFire:      { src:ENGINE_ROOT+'assets/audio/sfx/tick_001.ogg',              gain:0.3 },  // butterfingers' wild shots
  hit:           { src:ENGINE_ROOT+'assets/audio/sfx/impactSoft_medium_002.ogg', gain:0.5 },  // bullet impact
  kill:          { src:ENGINE_ROOT+'assets/audio/sfx/confirmation_004.ogg',      gain:0.5 },  // enemy destroyed
  pipLost:       { src:ENGINE_ROOT+'assets/audio/sfx/error_003.ogg',             gain:0.6 },  // shield pip lost
  stallStinger:  { src:ENGINE_ROOT+'assets/audio/sfx/minimize_006.ogg',          gain:0.6 },  // THE MISSION STALLS
  stageClear:    { src:ENGINE_ROOT+'assets/audio/sfx/confirmation_001.ogg',      gain:0.6 },  // swarm cleared, next stage
  crateChime:    { src:ENGINE_ROOT+'assets/audio/sfx/select_006.ogg',            gain:0.6 },  // crate collected
  beamCharge:    { src:ENGINE_ROOT+'assets/audio/sfx/jingles-hit_02.ogg',        gain:0.7 },  // THE BEAM charged
  beamSlam:      { src:ENGINE_ROOT+'assets/audio/sfx/impactWood_heavy_002.ogg',  gain:0.9 },  // THE BEAM fires
  beamCrumble:   { src:ENGINE_ROOT+'assets/audio/sfx/impactGlass_heavy_001.ogg', gain:0.7 },  // wipe puffs
  saviorChime:   { src:ENGINE_ROOT+'assets/audio/sfx/confirmation_004.ogg',      gain:0.5 },  // savior shield absorb
  butterfingers: { src:ENGINE_ROOT+'assets/audio/sfx/close_002.ogg',             gain:0.5 },  // crate fumble
  hammer:        { src:ENGINE_ROOT+'assets/audio/sfx/stoneDrag2.ogg',            gain:0.6 },  // builder's drone wind-up
  ambushEntrance:{ src:ENGINE_ROOT+'assets/audio/sfx/scratch_002.ogg',           gain:0.7 },  // ace fighter entrance
  turnGood:      { src:ENGINE_ROOT+'assets/audio/sfx/jingles-hit_03.ogg',        gain:0.7 },  // flagship turns good
  fanfare:       { src:ENGINE_ROOT+'assets/audio/sfx/jingles-hit_10.ogg',        gain:0.8 },  // celebration fanfare
};
const sfxLoader = makeBufferBank(SFX_DEFS);
function tryDecodeAllSamples(){ sfxLoader.tryDecodeAll(); }
sfxLoader.prefetchAll();
function playFire(t){ playSample('fire', t); }
function playWildFire(t){ playSample('wildFire', t); }
function playHit(t){ playSample('hit', t); }
function playKill(t){ playSample('kill', t); }
function playPipLost(t){ playSample('pipLost', t); }
function playStallStinger(t){ playSample('stallStinger', t); }
function playStageClear(t){ playSample('stageClear', t); }
function playCrateChime(t){ playSample('crateChime', t); }
function playBeamCharge(t){ playSample('beamCharge', t); }
function playBeamSlam(t){ playSample('beamSlam', t); playTwang(t+0.9, 0.8); }
function playBeamCrumble(t){ playSample('beamCrumble', t); }
function playSaviorChime(t){ playSample('saviorChime', t); }
function playButterfingers(t){ playSample('butterfingers', t); }
function playHammer(t){ playSample('hammer', t); }
function playAmbushEntrance(t){ playSample('ambushEntrance', t); }
function playTurnGood(t){ playSample('turnGood', t); }
function playFanfare(t){ playSample('fanfare', t); }
// shared/framework.js's updateTypewriterAudio calls playBeep (a shared
// no-op stub, defined there) + playDing directly as ordinary globals at
// call time -- every engine that uses it must supply its own playDing
// (see gallery/engine.js's/flight/engine.js's/defense/engine.js's
// identical wrapper). This engine never runs a typewriter, but the
// wrapper is kept for schema/pattern parity and defensive safety.
function playDing(t){ playCrateChime(t); }

/* Phase M mapping (see SPEC-mission.md "Music"): title = dinner slot;
   stages 1-2 = dinner, later stages = chase; ambush + flagship = boss;
   the lull before the flagship = sad; turn-good + flyby + win card =
   celebration; retry card = gameover. */
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
const PLAY_X_MIN = 40, PLAY_X_MAX = CW-40;
const PLAY_Y_MIN = CH/3, PLAY_Y_MAX = CH-40; // "clamped to the lower 2/3" -- SPEC-mission.md
const PLAYER_SPEED = 260;
const PLAYER_R = 16, ENEMY_R_SMALL = 15, ENEMY_R_BIG = 26, ENEMY_R_UFO = 17;
const METEOR_R_BIG = 22, METEOR_R_SMALL = 13, BULLET_R = 5, CRATE_R = 13, DRONE_R = 14;
const CRATE_FALL_SPEED = 65; // ~7s spawn-to-catch fall time -- see buildStageSchedule's crateInterval comment for why this and the interval are tuned together
const PLAYER_FIRE_COOLDOWN = 0.22, PLAYER_DMG = 11;
const DINER0_FIRE_COOLDOWN = 0.34, DINER0_DMG = 8;
const BUTTERFINGERS_FIRE_COOLDOWN = 0.27, BUTTERFINGERS_DMG = 6;
const DRONE_FIRE_COOLDOWN = 0.3, DRONE_DMG = 9, DRONE_ACTIVE_TIME = 4.0, DRONE_BUILDUP_TIME = 0.8;
const PLAYER_BULLET_SPEED = 480, ENEMY_BULLET_SPEED = 220;
const INVULN_TIME = 1.3;
// formation offsets (relative to the player), fixed per SPEC-mission.md's
// "fixed formation offsets" -- the whole squadron follows the host's own
// movement rigidly, never independently steered.
const FORMATION_OFFSETS = {
  savior:        { dx:-52, dy:-14 }, // "flies closest" -- tucked in tight, just ahead
  diner0:        { dx: 64, dy: 16 },
  butterfingers: { dx:-118, dy: 34 },
  builder:       { dx: 118, dy: 34 },
  // PEOPLE FIRST (SPEC-people.md round 1) -- "the Mission flies up to 2
  // extras as plain extra wingmen": two more fixed slots, further out
  // than the 4 role wingmates above, no fire/no BUDGET_DPS credit (purely
  // decorative formation members -- "plain", per spec) -- see
  // EXTRA_WINGMATE_ROLES/personForWingmate/drawWingmates.
  extra0:        { dx:-180, dy: 60 },
  extra1:        { dx: 180, dy: 60 },
};
/* up to 2 `extras` entries, in order, each keyed 'extra0'/'extra1' -- see
   FORMATION_OFFSETS' own comment. Empty when CONFIG.extras is absent/
   empty, same as every other quotes/extras feature in this file. */
const EXTRA_WINGMATE_ROLES = (CONFIG.extras || []).slice(0, 2).map((ex, i) => 'extra'+i).filter((role, i) => CONFIG.extras[i] && CONFIG.extras[i].name);
/* resolves a wingmate slot (a FORMATION_OFFSETS key) to its {name,sprite,
   quotes}-shaped person object -- 'diner0'/role names read CAST, 'extraN'
   reads CONFIG.extras[N]. Used by pickStageChatter/drawWingmates so
   neither has to special-case extras vs. cast roles separately. */
function personForWingmate(slot){
  if(slot === 'diner0') return CAST.diner0;
  const extraMatch = /^extra(\d+)$/.exec(slot);
  if(extraMatch) return (CONFIG.extras || [])[+extraMatch[1]];
  return CAST[slot];
}
function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
function wingmatePos(role){
  const off = FORMATION_OFFSETS[role];
  return { x: clamp(player.x+off.dx, 24, CW-24), y: clamp(player.y+off.dy, 50, CH-16) };
}
function bossName(role){
  const c = CAST[role];
  if(c && c.name) return fmt(c.name).toUpperCase();
  return role==='judge' ? 'THE ACE PILOT' : 'THE FLAGSHIP COMMAND';
}

/* budget DPS credits -- flat, deliberately approximate per-role
   contribution used ONLY to scale enemy/boss HP (see enemyHpScale below).
   Anchored at the FLOOR (host+diner0, the minimum possible roster -- diner0
   is never null, see game/cfgcodec.js's cfgBuildMissionDefaultConfig) so
   host-only always plays at exactly this round's tuned baseline HP, and a
   bigger squadron only ever makes enemies proportionally tankier (more
   guns, fair fights), never less winnable -- same
   "host-only stays winnable" spirit defense/engine.js's own
   BUDGET_UPTIME_FACTOR comment documents, adapted for a fixed-timer stage
   structure (see this file's header) where HP doesn't gate forward
   progress the way it gates a defense wave, only boss defeats do. */
const BUDGET_DPS = {
  host: PLAYER_DMG/PLAYER_FIRE_COOLDOWN, diner0: DINER0_DMG/DINER0_FIRE_COOLDOWN,
  savior: 6, // no direct fire -- flat credit for the shield's real defensive value
  butterfingers: BUTTERFINGERS_DMG/BUTTERFINGERS_FIRE_COOLDOWN,
  builder: (DRONE_DMG/DRONE_FIRE_COOLDOWN) * 0.4, // partial credit -- the drone isn't always active
};
const BASELINE_DPS = BUDGET_DPS.host + BUDGET_DPS.diner0;
function totalSquadronDps(){
  let dps = BUDGET_DPS.host + BUDGET_DPS.diner0;
  if(SAVIOR_CAST) dps += BUDGET_DPS.savior;
  if(BUTTERFINGERS_CAST) dps += BUDGET_DPS.butterfingers;
  if(BUILDER_CAST) dps += BUDGET_DPS.builder;
  return dps;
}
function enemyHpScale(){ return totalSquadronDps() / BASELINE_DPS; } // always >= 1

/* ======================================================================
   GAME STATE
   ====================================================================== */
let gameT = 0;
let timeScale = 1; // slow-mo during THE BEAM's slam beat
let slowMoTimer = 0;
let phase = 'title';
let phaseElapsed = 0;
let phaseData = {};
let gpAPrev = false;

let player = { x: CW/2, y: PLAY_Y_MAX-40 };
let pips = 3;
let totalPipsLostEver = 0;
let invulnUntil = 0;
let saviorUsedThisStage = false;

let playerFireCd = 0, diner0FireCd = 0, butterfingersFireCd = 0;
let builderDrone = null; // { phase:'buildup'|'firing', x, y, until, fireCd }
let turnedGoodPod = null; // { x, y } once the flagship turns good

let crateCount = 0, beamUsedThisEncounter = false, beamsFiredThisRun = 0;
let playerShotsFired = 0, playerShotsHit = 0;

let activeEnemies = []; // { id, x, y, hp, maxHp, shape, big, isUfo, dead, spawnT, stageIndex, sway*, fireEvery, fireOffset, lastFireT }
let activeMeteors = []; // { x, y, vx, vy, size, tint, rot, dead }
let playerBullets = []; // { x, y, vx, vy, dmg, owner }
let enemyBullets = [];  // { x, y, vx, vy }
let crates = []; // { x, y, kind }
let nextEnemyId = 1;

let stageDownedCount = new Array(STAGE_COUNT).fill(0);

let flightPuffs = []; // local image-based particles, same rationale as flight/engine.js's/defense/engine.js's own
function spawnPuff(cx, cy, big){
  const n = big ? 4 : 2;
  for(let i=0;i<n;i++){
    flightPuffs.push({
      x: cx+rngRange(gameRng,-14,14), y: cy+rngRange(gameRng,-14,14),
      vx: rngRange(gameRng,-40,40), vy: rngRange(gameRng,-40,40),
      big, born: gameT, life: 0.5,
    });
  }
}
function updateAndDrawPuffs(ctx){
  for(const p of flightPuffs){
    const age = gameT-p.born;
    if(age > p.life) continue;
    const a = 1-age/p.life;
    ctx.save(); ctx.globalAlpha = Math.max(0,a);
    drawPacked(ctx, MISSION_IMG.fire, p.x+p.vx*age, p.y+p.vy*age, p.big?38:20);
    ctx.restore();
  }
  flightPuffs = flightPuffs.filter(p => (gameT-p.born) <= p.life);
}
let confetti = [];
function spawnConfetti(){
  for(let i=0;i<36;i++){
    confetti.push({ x:rngRange(gameRng,0,CW), y:-10-rngRange(gameRng,0,120), vy:rngRange(gameRng,90,160), vx:rngRange(gameRng,-30,30), color: rngPick(gameRng,[PAL.gold,PAL.cream,'#3ecc71','#5ab4e8']), born:gameT, life:3.0 });
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
let bubble = null; // { text, x, y, until } -- savior/butterfingers one-off speech
function showBubble(text, x, y, dur){ bubble = { text, x, y, until: gameT + (dur===undefined?2.0:dur) }; }
let marquee = null; // { text, until } -- THE FIRST BOSS's/THE FINAL BOSS's beamed lines
function showMarquee(text, dur){ marquee = { text, until: gameT + (dur===undefined?3.2:dur) }; }

/* ---------------- tutorial/stall card -- see shared/framework.js's card
   system. CARDS.stallretry's body is rewritten per-attempt just before
   showing it (see enterStallRetry), same deliberate bypass of
   maybeShowCard's one-shot guard flight/engine.js's/defense/engine.js's
   own retry cards use -- a retry can legitimately show more than once. */
const CARDS = {
  stallretry: { key:'stallretry', title:'THE MISSION STALLS', body:['ONE MORE GO.'] },
};

/* ======================================================================
   STARFIELD -- seeded once at boot (`<gameId>:mission:stars`, not
   per-attempt -- purely cosmetic backdrop, stable across the whole run,
   same rationale a title-screen backdrop never needs to reseed on retry).
   ====================================================================== */
const STAR_COUNT = 70;
const STARS = (function(){
  const rng = makeRng(GAME_SEED_BASE + ':mission:stars');
  const out = [];
  for(let i=0;i<STAR_COUNT;i++){
    out.push({ x: rngRange(rng,0,CW), y: rngRange(rng,0,CH), speed: rngRange(rng,26,90), size: rngRange(rng,1,2.4) });
  }
  return out;
})();
function drawStarfield(ctx, dt){
  ctx.save(); ctx.fillStyle = PAL.cream;
  for(const s of STARS){
    s.y += s.speed*dt;
    if(s.y > CH) s.y -= CH;
    ctx.globalAlpha = 0.5 + 0.5*(s.size/2.4);
    ctx.fillRect(Math.round(s.x), Math.round(s.y), Math.ceil(s.size), Math.ceil(s.size));
  }
  ctx.restore();
}
function drawBackground(ctx, dt){
  ctx.fillStyle = PAL.night; ctx.fillRect(0,0,CW,CH);
  const img = MISSION_IMG.background;
  if(img.complete && img.naturalWidth){
    const tw = 240, th = tw*(img.naturalHeight/img.naturalWidth);
    for(let y=0;y<CH;y+=th) for(let x=0;x<CW;x+=tw) ctx.drawImage(img, x, y, tw, th);
  }
  drawStarfield(ctx, dt);
}

/* ======================================================================
   STAGE SCHEDULE -- deterministic per (stageIndex, attempt): enemy spawn
   events (position/shape/HP/fire timing), meteor drifts, crate drops, the
   builder's drone windows, and butterfingers' wild-shot spread jitter.
   Seed matches SPEC-mission.md's Determinism section exactly:
   `<gameId>:mission:stage:<i>:<attempt>`.
   ====================================================================== */
const ENEMY_SHAPES = [1,2,3,4,5];
function stageDuration(i){ return 36 + 2*i; } // "~40s each" -- SPEC-mission.md
function stageEnemyCount(i){ return 6 + i*2; }
function buildStageSchedule(stageIndex, attempt){
  const rng = makeRng(GAME_SEED_BASE + ':mission:stage:' + stageIndex + ':' + attempt);
  const duration = stageDuration(stageIndex);
  const count = stageEnemyCount(stageIndex);
  const scale = enemyHpScale();
  const smallHp = 20 * scale * (1 + stageIndex*0.06);
  const bigHp = 88 * scale * (1 + stageIndex*0.06);
  const ufoHp = 34 * scale * (1 + stageIndex*0.06);
  const enemies = [];
  let t = 1.2;
  for(let i=0;i<count;i++){
    const isUfo = rng() < 0.12;
    const big = !isUfo && (i % 4 === 3);
    enemies.push({
      t, x: rngRange(rng, 70, CW-70),
      shape: rngPick(rng, ENEMY_SHAPES), big, isUfo,
      hp: isUfo ? ufoHp : (big ? bigHp : smallHp),
      swayAmp: rngRange(rng, 20, 70), swayFreq: rngRange(rng, 0.6, 1.6), swayPhase: rngRange(rng, 0, Math.PI*2),
      vy: rngRange(rng, 60, 95),
      fires: big || isUfo,
      fireEvery: rngRange(rng, 1.6, 2.6), fireOffset: rngRange(rng, 0.4, 1.2),
      label: MISSION_SWARMS[stageIndex],
    });
    t += (duration-2.4) / count * rngRange(rng, 0.7, 1.3);
  }
  const meteors = [];
  let mt = 2.0;
  while(mt < duration-1){
    meteors.push({
      t: mt, x: rngRange(rng, 40, CW-40),
      size: rng()<0.5 ? 'big':'small', tint: rng()<0.5 ? 'brown':'grey',
      vx: rngRange(rng, -30, 30), vy: rngRange(rng, 70, 120), rot: rngRange(rng, -2, 2),
    });
    mt += rngRange(rng, 3.5, 6.5);
  }
  // "a lower rate so THE BEAM stays reachable" -- SPEC-mission.md. 11s
  // (vs. butterfingers' 9s) is deliberately a MODEST slowdown, not a
  // drastic one -- 3 full charge-and-fire cycles still need to fit inside
  // a single stage's own duration (36-46s) alongside each crate's ~7s
  // fall-and-catch-up window (see updateCrates' CRATE_FALL_SPEED), or the
  // neutral fallback would never actually complete a charge before the
  // stage rolls over and resets it -- round 2's own verify-mission.js
  // host-only run proved 14s too slow to ever reach 3/3 in time.
  const crateInterval = BUTTERFINGERS_CAST ? 9 : 11;
  const crateEvents = [];
  let ct = rngRange(rng, crateInterval*0.5, crateInterval);
  while(ct < duration){
    crateEvents.push({ t: ct });
    ct += rngRange(rng, crateInterval-1.5, crateInterval+1.5);
  }
  const droneEvents = [];
  if(BUILDER_CAST){
    let dt = rngRange(rng, 6, 10);
    while(dt < duration - DRONE_BUILDUP_TIME - 1){
      droneEvents.push({ t: dt });
      dt += rngRange(rng, 12, 16);
    }
  }
  const spreadJitters = [];
  for(let i=0;i<48;i++) spreadJitters.push(rngRange(rng, -55, 55));
  return { duration, enemies, meteors, crateEvents, droneEvents, spreadJitters };
}

/* ======================================================================
   AMBUSH SCHEDULE -- the mid-mission ambush's own seed:
   `<gameId>:mission:ambush:<attempt>` (also reused for the elite-volley
   substitute when THE FIRST BOSS is uncast -- same "degraded path reuses
   the cast path's own seed slot" precedent defense/engine.js's grand-rush
   finale sets).
   ====================================================================== */
function buildAmbushSchedule(attempt){
  const rng = makeRng(GAME_SEED_BASE + ':mission:ambush:' + attempt);
  const passCount = 4;
  const passes = [];
  for(let i=0;i<passCount;i++){
    passes.push({
      fromSide: rng()<0.5 ? 'left':'right',
      y: rngRange(rng, 90, 210),
      speed: rngRange(rng, 230, 300),
      fireCount: 2 + rngInt(rng, 2),
    });
  }
  const retortLine = rngPick(rng, BEAM_RETORT_FALLBACKS);
  const bossHp = 150 * enemyHpScale();
  const aceShape = rngPick(rng, ENEMY_SHAPES); // which enemyBlack<N> sprite plays the ace fighter, this game
  return { passes, retortLine, bossHp, aceShape };
}
/* elite-volley substitute (JUDGE uncast) -- reuses the same seed slot
   above but only draws the extra enemy-spawn content it needs; still no
   boss entity, so THE BEAM behaves like a normal stage wipe here (see
   fireBeam). */
function buildEliteVolleySchedule(attempt){
  const rng = makeRng(GAME_SEED_BASE + ':mission:ambush:' + attempt);
  const duration = 22;
  const count = 10;
  const scale = enemyHpScale();
  const enemies = [];
  let t = 1.0;
  for(let i=0;i<count;i++){
    const big = i % 3 === 2;
    enemies.push({
      t, x: rngRange(rng, 70, CW-70), shape: rngPick(rng, ENEMY_SHAPES), big, isUfo:false,
      hp: (big ? 88 : 20) * scale, swayAmp: rngRange(rng,20,70), swayFreq: rngRange(rng,0.6,1.6), swayPhase: rngRange(rng,0,Math.PI*2),
      vy: rngRange(rng, 75, 110), fires: big, fireEvery: rngRange(rng,1.4,2.2), fireOffset: rngRange(rng,0.3,1.0),
      label: 'ELITE SWARM',
    });
    t += (duration-1.6)/count * rngRange(rng, 0.7, 1.3);
  }
  return { duration, enemies };
}

/* ======================================================================
   FLAGSHIP SCHEDULE -- 3 seeded volley phases, seed per-phase:
   `<gameId>:mission:flagship:<attempt>:<phase>` (SPEC-mission.md's own
   Determinism section). The finale-volley substitute (AUTHORITY uncast)
   reuses phase 0 of the same slot for its own meteor/swarm density --
   same degraded-path-reuses-cast-seed precedent as the ambush's own.
   ====================================================================== */
const FLAGSHIP_PHASE_COUNT = 3, FLAGSHIP_PHASE_DURATION = 9;
function buildFlagshipPhaseSchedule(attempt, phaseIdx){
  const rng = makeRng(GAME_SEED_BASE + ':mission:flagship:' + attempt + ':' + phaseIdx);
  const pattern = phaseIdx % 3; // 0=spread, 1=aimed twin, 2=telegraphed wall-with-gap
  const volleys = [];
  let t = 1.0;
  while(t < FLAGSHIP_PHASE_DURATION-0.5){
    volleys.push({ t, gapX: rngRange(rng, 120, CW-120) });
    t += rngRange(rng, 1.5, 2.3);
  }
  const retortLine = rngPick(rng, BEAM_RETORT_FALLBACKS);
  const turnGoodLine = rngPick(rng, FLAGSHIP_TURNGOOD_FALLBACKS);
  return { pattern, volleys, retortLine, turnGoodLine };
}
function buildFinaleVolleySchedule(attempt){
  const rng = makeRng(GAME_SEED_BASE + ':mission:flagship:' + attempt + ':0');
  const duration = 24;
  const enemies = [];
  let t = 1.0;
  const count = 12;
  for(let i=0;i<count;i++){
    const big = i % 3 === 0;
    enemies.push({
      t, x: rngRange(rng, 70, CW-70), shape: rngPick(rng, ENEMY_SHAPES), big, isUfo: rng()<0.15,
      hp: (big?88:20) * enemyHpScale(), swayAmp: rngRange(rng,20,70), swayFreq: rngRange(rng,0.6,1.6), swayPhase: rngRange(rng,0,Math.PI*2),
      vy: rngRange(rng, 80, 120), fires: big, fireEvery: rngRange(rng,1.3,2.0), fireOffset: rngRange(rng,0.3,1.0),
      label: 'FINALE SWARM',
    });
    t += (duration-1.4)/count * rngRange(rng, 0.7, 1.3);
  }
  const meteors = [];
  let mt = 1.5;
  while(mt < duration-1){
    meteors.push({ t: mt, x: rngRange(rng,40,CW-40), size: rng()<0.5?'big':'small', tint: rng()<0.5?'brown':'grey', vx: rngRange(rng,-30,30), vy: rngRange(rng,80,130), rot: rngRange(rng,-2,2) });
    mt += rngRange(rng, 2.5, 4.5);
  }
  return { duration, enemies, meteors };
}

/* ======================================================================
   COMBAT
   ====================================================================== */
function dist2(ax,ay,bx,by){ return Math.hypot(ax-bx, ay-by); }
function fireBullet(x, y, vx, vy, dmg, owner, laserKey){
  playerBullets.push({ x, y, vx, vy, dmg, owner, laserKey });
  if(owner==='player') playerShotsFired++;
}
function updateSquadronFire(dt){
  if(phaseData.awaitingRetry) return;
  playerFireCd -= dt;
  if(playerFireCd <= 0){
    playerFireCd = PLAYER_FIRE_COOLDOWN;
    fireBullet(player.x, player.y-18, 0, -PLAYER_BULLET_SPEED, PLAYER_DMG, 'player', 'laserBlue');
    if(actx) playFire(actx.currentTime);
  }
  if(SAVIOR_CAST){
    // no direct fire -- see FORMATION_OFFSETS/BUDGET_DPS.savior's own comment
  }
  diner0FireCd -= dt;
  if(diner0FireCd <= 0){
    diner0FireCd = DINER0_FIRE_COOLDOWN;
    const p = wingmatePos('diner0');
    fireBullet(p.x, p.y-14, 0, -PLAYER_BULLET_SPEED, DINER0_DMG, 'diner0', 'laserBlue');
  }
  if(BUTTERFINGERS_CAST){
    butterfingersFireCd -= dt;
    if(butterfingersFireCd <= 0){
      butterfingersFireCd = BUTTERFINGERS_FIRE_COOLDOWN;
      const p = wingmatePos('butterfingers');
      const jitters = (phaseData.schedule && phaseData.schedule.spreadJitters) || [0];
      phaseData.spreadIdx = ((phaseData.spreadIdx||0)+1) % jitters.length;
      const spreadDeg = jitters[phaseData.spreadIdx];
      const rad = spreadDeg * Math.PI/180;
      fireBullet(p.x, p.y-14, Math.sin(rad)*PLAYER_BULLET_SPEED*0.5, -Math.cos(rad)*PLAYER_BULLET_SPEED, BUTTERFINGERS_DMG, 'butterfingers', 'laserGreen');
      if(actx) playWildFire(actx.currentTime);
    }
  }
  if(builderDrone && builderDrone.phase==='firing'){
    builderDrone.fireCd -= dt;
    if(builderDrone.fireCd <= 0){
      builderDrone.fireCd = DRONE_FIRE_COOLDOWN;
      fireBullet(builderDrone.x, builderDrone.y-12, 0, -PLAYER_BULLET_SPEED, DRONE_DMG, 'drone', 'laserBlue');
    }
  }
}
function updateBuilderDrone(dt){
  if(!builderDrone) return;
  if(builderDrone.phase==='buildup'){
    if(gameT >= builderDrone.until){ builderDrone.phase='firing'; builderDrone.until = gameT+DRONE_ACTIVE_TIME; builderDrone.fireCd=0; }
    return;
  }
  if(gameT >= builderDrone.until) builderDrone = null;
}
function trySpawnDrone(){
  if(!BUILDER_CAST || builderDrone) return;
  const p = wingmatePos('builder');
  builderDrone = { phase:'buildup', x:p.x, y:p.y-30, until: gameT+DRONE_BUILDUP_TIME, fireCd:0 };
  if(actx) playHammer(actx.currentTime);
}
function spawnEnemyFromEvent(ev, stageIndex){
  activeEnemies.push({
    id: nextEnemyId++, x: ev.x, y: -30, spawnT: gameT,
    shape: ev.shape, big: ev.big, isUfo: ev.isUfo,
    hp: ev.hp, maxHp: ev.hp, dead:false,
    swayAmp: ev.swayAmp, swayFreq: ev.swayFreq, swayPhase: ev.swayPhase, vy: ev.vy,
    fires: ev.fires, fireEvery: ev.fireEvery, lastFireT: ev.fireOffset!==undefined ? gameT+ev.fireOffset : null,
    label: ev.label, stageIndex,
  });
}
function killEnemy(e, byBeam){
  if(e.dead) return;
  e.dead = true;
  if(actx) playKill(actx.currentTime);
  spawnPuff(e.x, e.y, e.big);
  if(e.stageIndex !== undefined && e.stageIndex !== null) stageDownedCount[e.stageIndex]++;
  if(!byBeam) maybeChargeCrateFromKill();
}
function maybeChargeCrateFromKill(){ /* reserved -- crates come from the seeded schedule/butterfingers gag, not kill count, per SPEC-mission.md */ }
function updateEnemies(dt, boundsY){
  for(const e of activeEnemies){
    if(e.dead) continue;
    e.y += e.vy*dt;
    e.x = clamp(e.x + Math.sin((gameT-e.spawnT)*e.swayFreq + e.swayPhase)*0.02*e.swayAmp, 20, CW-20);
    if(e.fires && e.lastFireT !== null && gameT >= e.lastFireT){
      e.lastFireT = gameT + e.fireEvery;
      enemyBullets.push({ x:e.x, y:e.y+14, vx:0, vy:ENEMY_BULLET_SPEED });
    }
    const r = e.isUfo ? ENEMY_R_UFO : (e.big ? ENEMY_R_BIG : ENEMY_R_SMALL);
    if(gameT >= invulnUntil && dist2(e.x,e.y,player.x,player.y) < r+PLAYER_R){
      handleHit();
      killEnemy(e, false);
    }
  }
  activeEnemies = activeEnemies.filter(e => !e.dead && e.y < CH+(boundsY||60));
}
function updateMeteors(dt){
  for(const m of activeMeteors){
    if(m.dead) continue;
    m.x += m.vx*dt; m.y += m.vy*dt;
    const r = m.size==='big' ? METEOR_R_BIG : METEOR_R_SMALL;
    if(gameT >= invulnUntil && dist2(m.x,m.y,player.x,player.y) < r+PLAYER_R){
      handleHit();
      m.dead = true;
      spawnPuff(m.x, m.y, m.size==='big');
    }
  }
  activeMeteors = activeMeteors.filter(m => !m.dead && m.y < CH+60);
}
function updatePlayerBullets(dt, hitTest){
  for(const b of playerBullets){
    b.x += b.vx*dt; b.y += b.vy*dt;
    if(b.dead) continue;
    if(hitTest) hitTest(b);
  }
  playerBullets = playerBullets.filter(b => !b.dead && b.y > -40 && b.x>-40 && b.x<CW+40);
}
function updateEnemyBullets(dt){
  for(const b of enemyBullets){
    b.x += b.vx*dt; b.y += b.vy*dt;
    if(!b.dead && gameT >= invulnUntil && dist2(b.x,b.y,player.x,player.y) < BULLET_R+PLAYER_R){
      b.dead = true; handleHit();
    }
  }
  enemyBullets = enemyBullets.filter(b => !b.dead && b.y < CH+30);
}
function updateCrates(dt){
  for(const c of crates){
    if(c.dead) continue;
    c.y += CRATE_FALL_SPEED*dt;
    c.x += (player.x - c.x) * Math.min(1, dt*1.5); // "drifts to the player" -- tight enough tracking to stay collectible against a moving target, not just a slowly-decaying lag
    if(dist2(c.x,c.y,player.x,player.y) < CRATE_R+PLAYER_R){
      c.dead = true;
      if(crateCount < 3 && !beamUsedThisEncounter){
        crateCount++;
        if(actx) playCrateChime(actx.currentTime);
        if(crateCount>=3 && actx) playBeamCharge(actx.currentTime);
      }
    }
  }
  crates = crates.filter(c => !c.dead && c.y < CH+30);
}
function handleHit(){
  if(gameT < invulnUntil) return;
  if(SAVIOR_CAST && !saviorUsedThisStage){
    saviorUsedThisStage = true;
    invulnUntil = gameT + INVULN_TIME;
    if(actx) playSaviorChime(actx.currentTime);
    showBubble(fmt(CAST.savior.name).toUpperCase()+' HAD YOU.', player.x, player.y-30, 2.0);
    return;
  }
  pips--; totalPipsLostEver++;
  if(actx) playPipLost(actx.currentTime);
  triggerShake(6, 0.3);
  invulnUntil = gameT + INVULN_TIME;
  if(pips <= 0) enterStallRetry();
}

/* ======================================================================
   THE BEAM -- 3 crates charge it; action fires it manually; chargeable
   once per encounter (crates stop mattering once charged/used -- see
   updateCrates). Wipe in a normal swarm phase, damage chunk + beamed
   retort in a real boss phase (see this file's header for that split).
   ====================================================================== */
function beamReady(){ return crateCount>=3 && !beamUsedThisEncounter; }
function fireBeam(){
  if(!beamReady()) return;
  beamsFiredThisRun++;
  crateCount = 0; beamUsedThisEncounter = true;
  if(actx){ playBeamSlam(actx.currentTime); playBeamCrumble(actx.currentTime+0.05); }
  sayPunchline();
  triggerShake(10, 0.5);
  timeScale = 0.35; slowMoTimer = 0.9;
  showBanner(CONFIG.punchline, null, 1.8);
  if(phase==='stage' || phase==='eliteVolley' || phase==='finaleVolley'){
    for(const e of activeEnemies) if(!e.dead) killEnemy(e, true);
    for(const m of activeMeteors) if(!m.dead){ m.dead=true; spawnPuff(m.x,m.y,true); }
    enemyBullets = [];
  } else if(phase==='ambush'){
    phaseData.boss.hp = Math.max(0, phaseData.boss.hp - phaseData.boss.maxHp*0.4);
    showMarquee(phaseData.schedule.retortLine, 2.2);
  } else if(phase==='flagship'){
    phaseData.boss.hp = Math.max(0, phaseData.boss.hp - phaseData.boss.maxHp*0.3);
    showMarquee(phaseData.phaseSchedule.retortLine, 2.2);
  }
}

/* ======================================================================
   MISSION PROGRESS -- purely a HUD nicety (see SPEC-mission.md's "mission
   % progress bar"), not a gameplay gate. Beats: one per stage, +1 for the
   ambush/eliteVolley beat, +1 for the flagship/finaleVolley beat.
   ====================================================================== */
const MISSION_BEATS_TOTAL = STAGE_COUNT + 2;
function beatIndexForStage(i){ return i + (i>AMBUSH_AFTER_INDEX ? 1 : 0); }
function missionProgressPct(){
  if(phase==='title') return 0;
  if(phase==='endcard' || phase==='celebration' || phase==='turngood') return 100;
  let idx = 0, frac = 0;
  if(phase==='stage'){ idx = beatIndexForStage(phaseData.stageIndex); frac = Math.min(1, phaseElapsed/phaseData.duration); }
  else if(phase==='ambush' || phase==='eliteVolley'){ idx = beatIndexForStage(AMBUSH_AFTER_INDEX)+1; frac = Math.min(1, phaseElapsed/(phaseData.duration||18)); }
  else if(phase==='lull'){ idx = MISSION_BEATS_TOTAL-1; frac = 0; }
  else if(phase==='flagship'){ idx = MISSION_BEATS_TOTAL-1; frac = Math.min(1, ((phaseData.phaseIndex||0)+Math.min(1,phaseElapsed/FLAGSHIP_PHASE_DURATION))/FLAGSHIP_PHASE_COUNT); }
  else if(phase==='finaleVolley'){ idx = MISSION_BEATS_TOTAL-1; frac = Math.min(1, phaseElapsed/(phaseData.duration||24)); }
  return Math.max(0, Math.min(100, Math.round((idx+frac)/MISSION_BEATS_TOTAL*100)));
}

/* ======================================================================
   PHASES -- title / stage / ambush / eliteVolley / lull / flagship /
   finaleVolley / turngood / celebration / endcard.
   ====================================================================== */
function resetRunState(){
  player.x = CW/2; player.y = PLAY_Y_MAX-40;
  pips = 3; totalPipsLostEver = 0; invulnUntil = 0; saviorUsedThisStage = false;
  playerFireCd = 0; diner0FireCd = 0; butterfingersFireCd = 0; builderDrone = null; turnedGoodPod = null;
  crateCount = 0; beamUsedThisEncounter = false; beamsFiredThisRun = 0;
  playerShotsFired = 0; playerShotsHit = 0;
  activeEnemies = []; activeMeteors = []; playerBullets = []; enemyBullets = []; crates = [];
  stageDownedCount = new Array(STAGE_COUNT).fill(0);
  flightPuffs = []; confetti = []; timeScale = 1; slowMoTimer = 0;
}
function enterTitle(){
  phase = 'title'; phaseElapsed = 0; phaseData = {};
  setBeatMusic('dinner');
}
function enterStage(i, attempt){
  const schedule = buildStageSchedule(i, attempt);
  pips = 3; saviorUsedThisStage = false; crateCount = 0; beamUsedThisEncounter = false;
  activeEnemies = []; activeMeteors = []; enemyBullets = []; crates = []; builderDrone = null;
  phase = 'stage'; phaseElapsed = 0;
  phaseData = { stageIndex: i, attempt, schedule, duration: schedule.duration, spawnIdx:0, meteorIdx:0, crateIdx:0, droneIdx:0, spreadIdx:0, awaitingRetry:false };
  setBeatMusic(i <= 1 ? 'dinner' : 'chase');
  showBanner('SWARM '+(i+1)+' -- '+MISSION_SWARMS[i], null, 2.2);
  // PEOPLE FIRST (SPEC-people.md round 1) -- "between-stage squadron
  // chatter -- one wingmate quote marqueed under the stage banner" -- see
  // pickStageChatter's own header.
  const chatter = pickStageChatter();
  if(chatter) showMarquee(chatter, 2.4);
  if(actx) playStageClear(actx.currentTime);
}
function updateStage(dt){
  if(phaseData.awaitingRetry){
    if(!activeCard){ phaseData.awaitingRetry=false; enterStage(phaseData.stageIndex, phaseData.attempt+1); }
    return;
  }
  const sched = phaseData.schedule;
  while(phaseData.spawnIdx < sched.enemies.length && sched.enemies[phaseData.spawnIdx].t <= phaseElapsed){
    spawnEnemyFromEvent(sched.enemies[phaseData.spawnIdx++], phaseData.stageIndex);
  }
  while(phaseData.meteorIdx < sched.meteors.length && sched.meteors[phaseData.meteorIdx].t <= phaseElapsed){
    const m = sched.meteors[phaseData.meteorIdx++];
    activeMeteors.push({ x:m.x, y:-30, vx:m.vx, vy:m.vy, size:m.size, tint:m.tint, rot:m.rot, dead:false });
  }
  while(phaseData.crateIdx < sched.crateEvents.length && sched.crateEvents[phaseData.crateIdx].t <= phaseElapsed){
    phaseData.crateIdx++;
    if(crateCount < 3 && !beamUsedThisEncounter){
      const viaButterfingers = BUTTERFINGERS_CAST;
      // host-only fallback: "neutral seeded drops ... so THE BEAM stays
      // reachable" (SPEC-mission.md) -- anchored near the player's OWN
      // current x (a seeded offset off a live position, same pattern
      // butterfingers' own wingmatePos('butterfingers') anchor uses, and
      // defense/engine.js's nearestPathDistToPoint(towerPos(...)) before
      // it), not a uniformly random spawn clear across the play width --
      // a crate that starts 400+px from the player has to fully home
      // across that gap during its ~12s fall while ALSO chasing a moving
      // target, which round-2's own verify-mission.js proved unreliable
      // (the host-only crate-charge assertion failed under a plain
      // dodge-autopilot before this fix).
      const from = viaButterfingers ? wingmatePos('butterfingers') : { x: clamp(player.x + rngRange(gameRng, -90, 90), 60, CW-60), y: -20 };
      crates.push({ x: from.x, y: -20, kind: rngPick(gameRng, ['crateBolt','crateShield','crateStar']) });
      if(viaButterfingers){
        showBubble('OOPS. THAT\'S YOURS.', from.x, 20, 1.6);
        if(actx) playButterfingers(actx.currentTime);
      }
    }
  }
  while(phaseData.droneIdx < sched.droneEvents.length && sched.droneEvents[phaseData.droneIdx].t <= phaseElapsed){
    phaseData.droneIdx++;
    trySpawnDrone();
  }
  updateSquadronFire(dt);
  updateBuilderDrone(dt);
  updateEnemies(dt);
  updateMeteors(dt);
  updateEnemyBullets(dt);
  updateCrates(dt);
  updatePlayerBullets(dt, bulletHitEnemies);
  if(phaseElapsed >= phaseData.duration){
    onStageComplete(phaseData.stageIndex);
  }
}
function bulletHitEnemies(b){
  for(const e of activeEnemies){
    if(e.dead) continue;
    const r = e.isUfo ? ENEMY_R_UFO : (e.big ? ENEMY_R_BIG : ENEMY_R_SMALL);
    if(dist2(b.x,b.y,e.x,e.y) < r+BULLET_R){
      b.dead = true;
      if(b.owner==='player') playerShotsHit++;
      if(actx) playHit(actx.currentTime);
      e.hp -= b.dmg;
      if(e.hp <= 0) killEnemy(e, false);
      return;
    }
  }
}
function onStageComplete(i){
  if(i === AMBUSH_AFTER_INDEX){
    if(JUDGE_CAST) enterAmbush(1); else enterEliteVolley(1);
    return;
  }
  if(i === STAGE_COUNT-1){ enterLull(); return; }
  enterStage(i+1, 1);
}

function enterAmbush(attempt){
  const schedule = buildAmbushSchedule(attempt);
  pips = 3; saviorUsedThisStage = false; // THE BEAM: crateCount/beamUsedThisEncounter deliberately NOT reset here -- a charge earned during the preceding stage carries into this encounter unspent (see fireBeam's own stage-vs-boss-phase split); only enterStage starts a fresh charge cycle.
  activeEnemies = []; activeMeteors = []; enemyBullets = []; crates = []; builderDrone = null;
  phase = 'ambush'; phaseElapsed = 0;
  phaseData = {
    attempt, schedule, duration: 22, passIdx: -1, aceShape: schedule.aceShape,
    boss: { hp: schedule.bossHp, maxHp: schedule.bossHp, x:-80, y:schedule.passes[0].y, active:false },
    awaitingRetry:false,
  };
  setBeatMusic('boss');
  if(actx) playAmbushEntrance(actx.currentTime);
  showBanner(bossName('judge')+' CUTS ACROSS.', null, 2.0);
  showMarquee(firstBossHeckleLine, 3.4);
}
function advanceAmbushPass(){
  phaseData.passIdx++;
  if(phaseData.passIdx >= phaseData.schedule.passes.length || phaseData.boss.hp<=0){
    phaseData.boss.active = false;
    onAmbushComplete();
    return;
  }
  const p = phaseData.schedule.passes[phaseData.passIdx];
  phaseData.boss.active = true;
  phaseData.boss.y = p.y;
  phaseData.boss.x = p.fromSide==='left' ? -80 : CW+80;
  phaseData.boss.vx = (p.fromSide==='left' ? 1 : -1) * p.speed;
  phaseData.boss.firesLeft = p.fireCount;
  phaseData.boss.nextFireAt = gameT + 0.6;
}
function onAmbushComplete(){
  enterStage(AMBUSH_AFTER_INDEX+1, 1);
}
function updateAmbush(dt){
  if(phaseData.awaitingRetry){
    if(!activeCard){ phaseData.awaitingRetry=false; enterAmbush(phaseData.attempt+1); }
    return;
  }
  if(phaseData.passIdx === -1 && phaseElapsed > 1.0) advanceAmbushPass();
  updateSquadronFire(dt);
  updateMeteors(dt);
  updateEnemyBullets(dt);
  updateCrates(dt);
  const boss = phaseData.boss;
  if(boss.active){
    boss.x += boss.vx*dt;
    if(boss.firesLeft>0 && gameT >= boss.nextFireAt){
      boss.firesLeft--; boss.nextFireAt = gameT + 0.5;
      enemyBullets.push({ x:boss.x, y:boss.y+20, vx:(player.x-boss.x)*0.4, vy:ENEMY_BULLET_SPEED });
    }
    if(gameT >= invulnUntil && dist2(boss.x,boss.y,player.x,player.y) < 34+PLAYER_R) handleHit();
    if(boss.x < -100 || boss.x > CW+100) advanceAmbushPass();
  }
  updatePlayerBullets(dt, (b)=>{
    if(!boss.active) return;
    if(dist2(b.x,b.y,boss.x,boss.y) < 34+BULLET_R){
      b.dead = true;
      if(b.owner==='player') playerShotsHit++;
      if(actx) playHit(actx.currentTime);
      boss.hp -= b.dmg;
      if(boss.hp<=0) advanceAmbushPass();
    }
  });
}
function enterEliteVolley(attempt){
  const schedule = buildEliteVolleySchedule(attempt);
  pips = 3; saviorUsedThisStage = false; // THE BEAM: crateCount/beamUsedThisEncounter deliberately NOT reset here -- a charge earned during the preceding stage carries into this encounter unspent (see fireBeam's own stage-vs-boss-phase split); only enterStage starts a fresh charge cycle.
  activeEnemies = []; activeMeteors = []; enemyBullets = []; crates = [];
  phase = 'eliteVolley'; phaseElapsed = 0;
  phaseData = { attempt, schedule, duration: schedule.duration, spawnIdx:0, awaitingRetry:false };
  setBeatMusic('boss');
  showBanner('ELITE SWARM VOLLEY.', null, 2.0);
}
function updateEliteVolley(dt){
  if(phaseData.awaitingRetry){
    if(!activeCard){ phaseData.awaitingRetry=false; enterEliteVolley(phaseData.attempt+1); }
    return;
  }
  const sched = phaseData.schedule;
  while(phaseData.spawnIdx < sched.enemies.length && sched.enemies[phaseData.spawnIdx].t <= phaseElapsed){
    spawnEnemyFromEvent(sched.enemies[phaseData.spawnIdx++], null);
  }
  updateSquadronFire(dt);
  updateEnemies(dt);
  updateEnemyBullets(dt);
  updateCrates(dt);
  updatePlayerBullets(dt, bulletHitEnemies);
  if(phaseElapsed >= phaseData.duration) onAmbushComplete();
}

function enterLull(){
  activeEnemies = []; activeMeteors = []; enemyBullets = []; crates = []; builderDrone = null;
  phase = 'lull'; phaseElapsed = 0; phaseData = { duration: 2.8 };
  setBeatMusic('sad');
  showBanner('REGROUPING...', null, 2.4);
}
function updateLull(dt){
  if(phaseElapsed >= phaseData.duration){
    if(AUTHORITY_CAST) enterFlagship(1); else enterFinaleVolley(1);
  }
}

function enterFlagship(attempt){
  pips = 3; saviorUsedThisStage = false; // THE BEAM: crateCount/beamUsedThisEncounter deliberately NOT reset here -- a charge earned during the preceding stage carries into this encounter unspent (see fireBeam's own stage-vs-boss-phase split); only enterStage starts a fresh charge cycle.
  activeEnemies = []; activeMeteors = []; enemyBullets = []; crates = []; builderDrone = null;
  const baseHp = 420 * enemyHpScale();
  phase = 'flagship'; phaseElapsed = 0;
  phaseData = {
    attempt, phaseIndex: 0, boss: { hp: baseHp, maxHp: baseHp, cx: CW/2, cy: 130 },
    phaseSchedule: buildFlagshipPhaseSchedule(attempt, 0), volleyIdx: 0, awaitingRetry:false,
  };
  setBeatMusic('boss');
  if(actx) playAmbushEntrance(actx.currentTime);
  showBanner(bossName('authority')+' ARRIVES.', null, 2.2);
  showMarquee(finalBossQuirkLine, 3.4);
}
function enterFlagshipPhase(idx){
  phaseData.phaseIndex = idx;
  phaseData.phaseSchedule = buildFlagshipPhaseSchedule(phaseData.attempt, idx);
  phaseData.volleyIdx = 0;
  showMarquee(finalBossQuirkLine, 2.4); // "beamed quirk between volleys" -- SPEC-mission.md
}
function updateFlagship(dt){
  if(phaseData.awaitingRetry){
    if(!activeCard){ phaseData.awaitingRetry=false; enterFlagship(phaseData.attempt+1); }
    return;
  }
  updateSquadronFire(dt);
  updateEnemyBullets(dt);
  updateCrates(dt);
  const boss = phaseData.boss;
  boss.cy = 130 + Math.sin(gameT*0.8)*14;
  const sched = phaseData.phaseSchedule;
  // phaseData.phaseElapsed tracks elapsed time within the CURRENT phase only
  // (reset to 0 by enterFlagshipPhase/the phase-advance branch below) --
  // phaseElapsed itself (the framework's own per-`phase`-value clock) covers
  // the WHOLE flagship encounter, not any one phase, so volleys schedule off
  // this local counter instead.
  phaseData.phaseElapsed = (phaseData.phaseElapsed||0) + dt;
  while(phaseData.volleyIdx < sched.volleys.length && sched.volleys[phaseData.volleyIdx].t <= phaseData.phaseElapsed){
    const v = sched.volleys[phaseData.volleyIdx++];
    fireFlagshipVolley(sched.pattern, v);
  }
  updatePlayerBullets(dt, (b)=>{
    if(dist2(b.x,b.y,boss.cx,boss.cy) < 70+BULLET_R){
      b.dead = true;
      if(b.owner==='player') playerShotsHit++;
      if(actx) playHit(actx.currentTime);
      boss.hp -= b.dmg;
    }
  });
  // deliberately NO body-contact damage against the flagship itself (unlike
  // the ambush's ace fighter, which crosses transiently and stays dodgeable
  // -- see updateAmbush): the flagship hovers near the top of the screen
  // the WHOLE encounter, well within the player's forced lower-2/3 play
  // band's own reach, so a contact check here would be near-unavoidable
  // chip damage rather than a real dodge. Danger comes entirely from its
  // seeded bullet volleys, which IS the "2-3 seeded volley phases"
  // mechanic SPEC-mission.md actually asks for.
  if(boss.hp <= 0){ enterTurnGood(sched.turnGoodLine); return; }
  if(phaseData.phaseElapsed >= FLAGSHIP_PHASE_DURATION){
    const next = phaseData.phaseIndex+1;
    if(next >= FLAGSHIP_PHASE_COUNT){
      // defensive floor -- see this file's header note on why the flagship
      // fight can never soft-lock
      boss.hp = 0; enterTurnGood(sched.turnGoodLine); return;
    }
    phaseData.phaseElapsed = 0;
    enterFlagshipPhase(next);
  }
}
function fireFlagshipVolley(pattern, v){
  const boss = phaseData.boss;
  if(pattern===0){
    for(let i=-2;i<=2;i++) enemyBullets.push({ x:boss.cx+i*22, y:boss.cy+30, vx:i*40, vy:ENEMY_BULLET_SPEED });
  } else if(pattern===1){
    enemyBullets.push({ x:boss.cx-80, y:boss.cy+20, vx:(player.x-(boss.cx-80))*0.35, vy:ENEMY_BULLET_SPEED });
    enemyBullets.push({ x:boss.cx+80, y:boss.cy+20, vx:(player.x-(boss.cx+80))*0.35, vy:ENEMY_BULLET_SPEED });
  } else {
    for(let x=60; x<CW-60; x+=44){
      if(Math.abs(x-v.gapX) < 40) continue;
      enemyBullets.push({ x, y:boss.cy+30, vx:0, vy:ENEMY_BULLET_SPEED*0.85 });
    }
  }
}
function enterTurnGood(line){
  activeEnemies = []; activeMeteors = []; enemyBullets = []; crates = [];
  phase = 'turngood'; phaseElapsed = 0;
  phaseData = { line: line || rngPick(gameRng, FLAGSHIP_TURNGOOD_FALLBACKS) };
  turnedGoodPod = { x: CW/2, y: 130 }; // starts at the flagship's own position, eases into formation in updateTurnGood
  if(actx) playTurnGood(actx.currentTime);
  showBanner(bossName('authority')+' TURNS GOOD.', 'AND JOINS THE FLYBY.', 2.6);
  showMarquee(phaseData.line, 2.6);
  setBeatMusic('celebration');
}
function updateTurnGood(dt){
  if(turnedGoodPod){
    turnedGoodPod.x += (player.x+64 - turnedGoodPod.x)*Math.min(1,dt*1.2);
    turnedGoodPod.y += (player.y-40 - turnedGoodPod.y)*Math.min(1,dt*1.2);
  }
  if(phaseElapsed >= 2.4) enterCelebration();
}
function enterFinaleVolley(attempt){
  const schedule = buildFinaleVolleySchedule(attempt);
  pips = 3; saviorUsedThisStage = false; // THE BEAM: crateCount/beamUsedThisEncounter deliberately NOT reset here -- a charge earned during the preceding stage carries into this encounter unspent (see fireBeam's own stage-vs-boss-phase split); only enterStage starts a fresh charge cycle.
  activeEnemies = []; activeMeteors = []; enemyBullets = []; crates = [];
  phase = 'finaleVolley'; phaseElapsed = 0;
  phaseData = { attempt, schedule, duration: schedule.duration, spawnIdx:0, meteorIdx:0, awaitingRetry:false };
  setBeatMusic('boss');
  showBanner('THE FINALE VOLLEY.', null, 2.2);
}
function updateFinaleVolley(dt){
  if(phaseData.awaitingRetry){
    if(!activeCard){ phaseData.awaitingRetry=false; enterFinaleVolley(phaseData.attempt+1); }
    return;
  }
  const sched = phaseData.schedule;
  while(phaseData.spawnIdx < sched.enemies.length && sched.enemies[phaseData.spawnIdx].t <= phaseElapsed){
    spawnEnemyFromEvent(sched.enemies[phaseData.spawnIdx++], null);
  }
  while(phaseData.meteorIdx < sched.meteors.length && sched.meteors[phaseData.meteorIdx].t <= phaseElapsed){
    const m = sched.meteors[phaseData.meteorIdx++];
    activeMeteors.push({ x:m.x, y:-30, vx:m.vx, vy:m.vy, size:m.size, tint:m.tint, rot:m.rot, dead:false });
  }
  updateSquadronFire(dt);
  updateEnemies(dt);
  updateMeteors(dt);
  updateEnemyBullets(dt);
  updateCrates(dt);
  updatePlayerBullets(dt, bulletHitEnemies);
  if(phaseElapsed >= phaseData.duration) enterCelebration();
}
function enterCelebration(){
  // defensive clear -- the finale-volley substitute (AUTHORITY uncast)
  // reaches this call directly from updateFinaleVolley with its own
  // enemies/meteors still potentially on screen, unlike the turn-good path
  // (already cleared in enterTurnGood).
  activeEnemies = []; activeMeteors = []; enemyBullets = []; crates = [];
  phase = 'celebration'; phaseElapsed = 0; phaseData = {};
  setBeatMusic('celebration');
  if(actx) playFanfare(actx.currentTime);
  sayPunchline();
  // PEOPLE FIRST (SPEC-people.md round 1) -- "the host's quotes join
  // their existing celebratory lines": the banner's sub-line becomes one
  // of the host's own quotes when they have any.
  const hostQuote = (CONFIG.host && CONFIG.host.quotes && CONFIG.host.quotes.length) ? nextQuoteFor('host', fmtLines(CONFIG.host.quotes)) : null;
  showBanner(CONFIG.punchline, hostQuote, 2.4);
  spawnConfetti();
}
function updateCelebration(dt){
  player.y = Math.max(PLAY_Y_MIN, player.y - 30*dt); // a slow climbing flyby
  if(turnedGoodPod){ turnedGoodPod.y = Math.max(PLAY_Y_MIN, turnedGoodPod.y - 30*dt); }
  if(phaseElapsed >= 2.8) enterEndcard();
}
function enterEndcard(){
  phase = 'endcard'; phaseElapsed = 0;
  const rank = totalPipsLostEver===0 ? CONFIG.rankNames.immaculate : CONFIG.rankNames.comicTiming;
  phaseData = { rank };
  // win end card stays on the celebration bed -- SPEC-mission.md's own
  // music mapping puts "turn-good + flyby + win card" all on `celebration`
  // (unlike flight/defense, whose end cards switch to `gameover`; only
  // Mission's OWN retry card uses `gameover` here).
  setBeatMusic('celebration');
  // PEOPLE FIRST (SPEC-people.md round 1) -- see buildCrewCredits' own header.
  CREW_CREDITS = buildCrewCredits();
}
function resetGame(){
  cardsShown.stallretry = false;
  activeCard = null;
  phase = 'title'; phaseElapsed = 0; phaseData = {};
}
function enterStallRetry(){
  setBeatMusic('gameover');
  if(actx) playStallStinger(actx.currentTime);
  phaseData.awaitingRetry = true;
  CARDS.stallretry.body = [CONFIG.rankNames.worst + '.', 'ONE MORE GO.'];
  activeCard = CARDS.stallretry;
  cardT = 0;
}

/* ======================================================================
   UPDATE / ACTION DISPATCH
   ====================================================================== */
function updatePlayerMovement(dt){
  const mv = getMoveVector();
  player.x = clamp(player.x + mv.dx*PLAYER_SPEED*dt, PLAY_X_MIN, PLAY_X_MAX);
  player.y = clamp(player.y + mv.dy*PLAYER_SPEED*dt, PLAY_Y_MIN, PLAY_Y_MAX);
}
function update(dt){
  phaseElapsed += dt;
  if(phase==='title'){ /* attract screen -- nothing to simulate */ }
  else if(phase==='stage'){ updatePlayerMovement(dt); updateStage(dt); }
  else if(phase==='ambush'){ updatePlayerMovement(dt); updateAmbush(dt); }
  else if(phase==='eliteVolley'){ updatePlayerMovement(dt); updateEliteVolley(dt); }
  else if(phase==='lull'){ updatePlayerMovement(dt); updateLull(dt); }
  else if(phase==='flagship'){ updatePlayerMovement(dt); updateFlagship(dt); }
  else if(phase==='finaleVolley'){ updatePlayerMovement(dt); updateFinaleVolley(dt); }
  else if(phase==='turngood'){ updateTurnGood(dt); }
  else if(phase==='celebration'){ updateCelebration(dt); }
  else if(phase==='endcard'){ /* waits for input */ }
}
const FLYING_PHASES = { stage:1, ambush:1, eliteVolley:1, flagship:1, finaleVolley:1 };
function handleAction(){
  if(activeCard){ activeCard = null; return; }
  if(phase==='title'){ ensureAudioStarted(); resetRunState(); enterStage(0,1); return; }
  if(FLYING_PHASES[phase]){
    if(phaseData.awaitingRetry) return;
    if(beamReady()) fireBeam();
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
   DRAW
   ====================================================================== */
function meteorImg(m){ return MISSION_IMG[(m.tint==='brown'?'meteorBrown':'meteorGrey') + (m.size==='big'?'Big':'Small')]; }
function drawMeteors(ctx){
  for(const m of activeMeteors) drawPacked(ctx, meteorImg(m), m.x, m.y, m.size==='big'?46:26, gameT*m.rot);
}
function enemyImgKey(e){ return e.isUfo ? 'ufoGreen' : ('enemyGreen'+e.shape); }
function drawPlaque(ctx, cx, y, text){
  const px = 10;
  const w = Math.min(140, 16+text.length*px*0.6), h = px+10;
  ctx.save(); ctx.globalAlpha = 0.95;
  ctx.fillStyle = PAL.wood; ctx.fillRect(cx-w/2-2, y-2, w+4, h+4);
  ctx.fillStyle = PAL.cream; ctx.fillRect(cx-w/2, y, w, h);
  ctx.restore();
  drawReadingText(ctx, text, cx, y+1, px, PAL.ink, 'center');
}
function drawEnemies(ctx){
  for(const e of activeEnemies){
    const w = e.isUfo ? 34 : (e.big ? 52 : 30);
    drawPacked(ctx, MISSION_IMG[enemyImgKey(e)], e.x, e.y, w, Math.PI);
    if(e.big) drawPlaque(ctx, e.x, e.y+30, e.label);
  }
}
function drawCrates(ctx){
  for(const c of crates) drawPacked(ctx, MISSION_IMG[c.kind], c.x, c.y, 24);
}
function drawBullets(ctx){
  for(const b of playerBullets){
    if(b.dead) continue;
    drawPacked(ctx, MISSION_IMG[b.laserKey], b.x, b.y, 12);
  }
  for(const b of enemyBullets) drawPacked(ctx, MISSION_IMG.laserRed, b.x, b.y, 12);
}
function drawEngineTrail(ctx, x, y, scale){
  const a = 0.5 + 0.4*Math.sin(gameT*14);
  ctx.save(); ctx.globalAlpha = Math.max(0.1,a);
  drawPacked(ctx, MISSION_IMG.engineTrail, x, y, 16*scale);
  ctx.restore();
}
function drawPlayerShip(ctx){
  const flashing = gameT < invulnUntil && Math.floor(gameT*10)%2===0;
  drawEngineTrail(ctx, player.x, player.y+22, 1);
  ctx.save(); if(flashing) ctx.globalAlpha = 0.4;
  drawPacked(ctx, MISSION_IMG['playerShip1_'+MISSION_SHIP_COLOR], player.x, player.y, 46);
  const face = rosterResolveSprite(CONFIG.host, 2, 7);
  drawRosterSprite(ctx, face.sheet, face.col, face.row, player.x-8, player.y-16, 1.9, false);
  ctx.restore();
  if(SAVIOR_CAST && !saviorUsedThisStage && FLYING_PHASES[phase]){
    ctx.save(); ctx.globalAlpha = 0.75 + 0.2*Math.sin(gameT*5);
    drawPacked(ctx, MISSION_IMG.shield, player.x, player.y, 74);
    ctx.restore();
  }
}
function drawWingmateFace(ctx, role, x, y, fallbackCol, fallbackRow){
  const entry = personForWingmate(role);
  const face = rosterResolveSprite(entry, fallbackCol, fallbackRow);
  drawEngineTrail(ctx, x, y+16, 0.7);
  drawPacked(ctx, MISSION_IMG['playerShip1_'+MISSION_SHIP_COLOR], x, y, 32);
  drawRosterSprite(ctx, face.sheet, face.col, face.row, x-6, y-11, 1.3, false);
  const name = entry && entry.name ? fmt(entry.name).toUpperCase() : 'THE FOURTH FRIEND';
  drawReadingTextOutlined(ctx, name, x, y+20, 9, PAL.cream, '#000000', 'center');
}
function drawWingmates(ctx){
  const p0 = wingmatePos('diner0');
  drawWingmateFace(ctx, 'diner0', p0.x, p0.y, 1, 7);
  if(SAVIOR_CAST){ const p = wingmatePos('savior'); drawWingmateFace(ctx, 'savior', p.x, p.y, 2, 7); }
  if(BUTTERFINGERS_CAST){ const p = wingmatePos('butterfingers'); drawWingmateFace(ctx, 'butterfingers', p.x, p.y, 3, 8); }
  if(BUILDER_CAST){ const p = wingmatePos('builder'); drawWingmateFace(ctx, 'builder', p.x, p.y, 2, 8); }
  // PEOPLE FIRST (SPEC-people.md round 1) -- "the Mission flies up to 2
  // extras as plain extra wingmen" -- see EXTRA_WINGMATE_ROLES.
  for(const role of EXTRA_WINGMATE_ROLES){ const p = wingmatePos(role); drawWingmateFace(ctx, role, p.x, p.y, 1, 7); }
}
function drawBuilderDrone(ctx){
  if(!builderDrone) return;
  if(builderDrone.phase==='buildup'){
    const bob = Math.sin(gameT*10)*3;
    drawHammer(ctx, builderDrone.x-8, builderDrone.y-10+bob, 4);
  } else {
    drawPacked(ctx, MISSION_IMG.ufoGreen, builderDrone.x, builderDrone.y, 26);
  }
}
function drawAmbushBoss(ctx){
  if(phase!=='ambush' || !phaseData.boss.active) return;
  const b = phaseData.boss;
  drawPacked(ctx, MISSION_IMG['enemyBlack'+((phaseData.aceShape)||1)], b.x, b.y, 70, Math.PI);
  const face = rosterResolveSprite(CAST.judge, 4, 8);
  drawRosterSprite(ctx, face.sheet, face.col, face.row, b.x-9, b.y-6, 1.6, false);
  drawReadingTextOutlined(ctx, bossName('judge'), b.x, b.y+38, 11, PAL.cream, '#000000', 'center');
  const pct = Math.max(0, b.hp/b.maxHp);
  ctx.fillStyle = PAL.pipEmpty; ctx.fillRect(b.x-30, b.y-46, 60, 5);
  ctx.fillStyle = PAL.pipFull; ctx.fillRect(b.x-30, b.y-46, 60*pct, 5);
}
function drawFlagship(ctx){
  if(phase!=='flagship') return;
  const b = phaseData.boss;
  drawPacked(ctx, MISSION_IMG.enemyBlack2, b.cx-70, b.cy+14, 50, Math.PI);
  drawPacked(ctx, MISSION_IMG.enemyBlack4, b.cx+70, b.cy+14, 50, Math.PI);
  drawPacked(ctx, MISSION_IMG.enemyBlack1, b.cx, b.cy, 96, Math.PI);
  const face = rosterResolveSprite(CAST.authority, 0, 7);
  drawRosterSprite(ctx, face.sheet, face.col, face.row, b.cx-9, b.cy-8, 1.8, false);
  drawReadingTextOutlined(ctx, bossName('authority'), b.cx, b.cy+56, 12, PAL.cream, '#000000', 'center');
  const pct = Math.max(0, b.hp/b.maxHp);
  ctx.fillStyle = PAL.pipEmpty; ctx.fillRect(b.cx-70, b.cy-70, 140, 6);
  ctx.fillStyle = PAL.pipFull; ctx.fillRect(b.cx-70, b.cy-70, 140*pct, 6);
}
function drawTurnGoodPod(ctx){
  // draw() only ever calls this from the shared "flying phases" branch, so
  // phase is already known to be turngood/celebration here (never endcard,
  // which takes drawEndcard's own early-return branch instead) -- turnedGoodPod
  // itself is the only real guard needed.
  if(!turnedGoodPod) return;
  drawPacked(ctx, MISSION_IMG.enemyBlack1, turnedGoodPod.x, turnedGoodPod.y, 30, Math.PI);
  const face = rosterResolveSprite(CAST.authority, 0, 7);
  drawRosterSprite(ctx, face.sheet, face.col, face.row, turnedGoodPod.x-6, turnedGoodPod.y-6, 1.1, false);
}
function drawMarqueeBanner(ctx){
  if(!marquee || gameT >= marquee.until) return;
  const y = 62, stripH = 30;
  ctx.save(); ctx.globalAlpha = 0.92;
  ctx.fillStyle = PAL.wood; ctx.fillRect(0, y-3, CW, stripH+6);
  ctx.fillStyle = '#1a1410'; ctx.fillRect(0, y, CW, stripH);
  ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.rect(0,y,CW,stripH); ctx.clip();
  const full = '>>>  ' + marquee.text + '  >>>  ' + marquee.text + '  ';
  const w = measureReadingText(ctx, full, 15);
  const totalW = w + 60;
  const elapsed = gameT - (marquee.until - 3.2);
  const x = CW - ((elapsed*70) % totalW);
  drawReadingText(ctx, full, x, y+7, 15, PAL.gold, 'left');
  drawReadingText(ctx, full, x-totalW, y+7, 15, PAL.gold, 'left');
  ctx.restore();
}
function drawBanner(ctx){
  if(!bannerText || gameT>=bannerUntil) return;
  const p = Math.min(1, (bannerUntil-gameT)>1.3 ? (1.6-(bannerUntil-gameT))/0.3 : 1);
  ctx.save(); ctx.globalAlpha = Math.min(1,p);
  drawChunkyText(ctx, bannerText, CW/2, 140, 26, PAL.gold, PAL.outline, 'center');
  if(bannerSub) drawReadingText(ctx, bannerSub, CW/2, 178, 14, PAL.cream, 'center');
  ctx.restore();
}
function drawBubble(ctx){
  if(!bubble || gameT >= bubble.until) return;
  drawAutoBubble(ctx, bubble.text, bubble.x, bubble.y, 12, 1);
}
function drawShieldPips(ctx){
  for(let i=0;i<3;i++) drawShieldPip(ctx, 14+i*22, 14, 3, i<pips);
}
function drawBeamMeter(ctx){
  const mx=CW-190, my=14, mw=150, mh=12;
  ctx.save(); ctx.fillStyle='#1a1410'; ctx.fillRect(mx-2,my-2,mw+4,mh+4);
  ctx.fillStyle = beamReady() ? PAL.gold : '#5c4a26';
  ctx.fillRect(mx,my,mw*Math.min(1,crateCount/3),mh);
  ctx.restore();
  if(beamReady() && Math.floor(gameT*3)%2===0) drawReadingText(ctx, 'THE BEAM -- '+(isTouch?'TAP RIGHT':'SPACE'), mx+mw/2, my+16, 11, PAL.gold, 'center');
  else drawReadingText(ctx, 'THE BEAM', mx+mw/2, my+16, 10, PAL.cream, 'center');
}
function stageChipLabel(){
  if(phase==='stage') return 'SWARM '+(phaseData.stageIndex+1)+' OF '+STAGE_COUNT+' -- '+MISSION_SWARMS[phaseData.stageIndex];
  if(phase==='ambush') return 'AMBUSH';
  if(phase==='eliteVolley') return 'ELITE SWARM VOLLEY';
  if(phase==='lull') return 'REGROUPING';
  if(phase==='flagship') return 'THE FLAGSHIP';
  if(phase==='finaleVolley') return 'THE FINALE VOLLEY';
  if(phase==='turngood' || phase==='celebration') return 'MISSION ACCOMPLISHED';
  return '';
}
function drawTopHud(ctx){
  const label = stageChipLabel();
  if(label){
    const w = Math.max(160, label.length*8+20);
    ctx.save(); ctx.globalAlpha=0.85;
    ctx.fillStyle = PAL.wood; ctx.fillRect(CW/2-w/2-2, 40, w+4, 22);
    ctx.fillStyle = '#1a1410'; ctx.fillRect(CW/2-w/2, 42, w, 18);
    ctx.restore();
    drawReadingText(ctx, label, CW/2, 45, 11, PAL.gold, 'center');
  }
  const barW = 340, barX = CW/2-barW/2, barY = 16;
  ctx.save(); ctx.fillStyle='#1a1410'; ctx.fillRect(barX-2,barY-2,barW+4,10);
  ctx.fillStyle = PAL.gold; ctx.fillRect(barX,barY,barW*missionProgressPct()/100,6);
  ctx.restore();
  drawReadingText(ctx, 'MISSION: '+MISSION_LINE, CW/2, barY+10, 11, PAL.cream, 'center');
}
function drawTitleScreen(ctx){
  const lockup = (CONFIG.title.lockupLines||['YOUR','GROUP']).join(' ');
  drawChunkyText(ctx, lockup, CW/2, 130, 38, PAL.gold, PAL.outline, 'center');
  drawReadingText(ctx, 'US AGAINST THE WORLD.', CW/2, 195, 15, PAL.cream, 'center');
  drawReadingText(ctx, 'MISSION: '+MISSION_LINE, CW/2, 224, 15, PAL.gold, 'center');
  drawPacked(ctx, MISSION_IMG['playerShip1_'+MISSION_SHIP_COLOR], CW/2, 350, 60);
  if(Math.floor(gameT*2)%2===0) drawReadingText(ctx, isTouch?'TAP TO LAUNCH':'PRESS SPACE TO LAUNCH', CW/2, 420, 15, PAL.gold, 'center');
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
  drawReadingText(ctx, 'THE WHOLE CREW', CW/2, y, 13, PAL.gold, 'center'); y += 17;
  for(const c of CREW_CREDITS){
    const line = c.quote ? (c.name + ': "' + c.quote + '"') : c.name;
    const tw = measureReadingText(ctx, line, 11);
    drawRosterSprite(ctx, c.sprite.sheet, c.sprite.col, c.sprite.row, CW/2 - tw/2 - 20, y-8, 1, false);
    drawReadingText(ctx, line, CW/2, y, 11, PAL.cream, 'center');
    y += 15;
  }
  return y + 6;
}
function drawEndcard(ctx){
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,CW,CH);
  drawChunkyText(ctx, 'MISSION: '+MISSION_LINE, CW/2, 16, 18, PAL.gold, PAL.outline, 'center');
  drawChunkyText(ctx, 'MISSION ACCOMPLISHED.', CW/2, 48, 22, PAL.gold, PAL.outline, 'center');
  let y = 86;
  const accuracy = playerShotsFired>0 ? Math.round(100*playerShotsHit/playerShotsFired) : 0;
  drawReadingText(ctx, 'ACCURACY: '+accuracy+'%', CW/2, y, 13, PAL.cream, 'center'); y+=18;
  drawReadingText(ctx, 'PIPS LEFT: '+Math.max(0,pips)+' OF 3', CW/2, y, 13, PAL.cream, 'center'); y+=18;
  drawReadingText(ctx, 'BEAMS FIRED: '+beamsFiredThisRun, CW/2, y, 13, PAL.cream, 'center'); y+=22;
  drawMedal(ctx, CW/2, y+22); y+=52;
  drawReadingText(ctx, phaseData.rank, CW/2, y, 18, PAL.gold, 'center'); y+=26;
  for(let i=0;i<STAGE_COUNT;i++){
    drawReadingText(ctx, MISSION_SWARMS[i]+' DOWNED: '+stageDownedCount[i], CW/2, y, 12, PAL.cream, 'center'); y+=16;
  }
  y += 6;
  if(BUILDER_CAST){ drawReadingText(ctx, 'BUILT BY '+fmt(CAST.builder.name).toUpperCase()+'.', CW/2, y, 12, PAL.cream, 'center'); y+=18; }
  y = drawCrewCredits(ctx, y);
  drawReadingText(ctx, 'SEND THIS ONE TO THE GROUP CHAT.', CW/2, y, 13, PAL.cream, 'center'); y+=22;
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
  drawBackground(ctx, rotatePromptActive||activeCard ? 0 : (1/60));
  if(phase==='title'){ drawTitleScreen(ctx); }
  else if(phase==='endcard'){ drawEndcard(ctx); }
  else {
    drawMeteors(ctx);
    drawEnemies(ctx);
    drawCrates(ctx);
    drawBullets(ctx);
    drawWingmates(ctx);
    drawBuilderDrone(ctx);
    drawAmbushBoss(ctx);
    drawFlagship(ctx);
    drawTurnGoodPod(ctx);
    drawPlayerShip(ctx);
    updateAndDrawPuffs(ctx);
    updateAndDrawConfetti(ctx);
    drawBubble(ctx);
    drawTopHud(ctx);
    if(FLYING_PHASES[phase]) drawShieldPips(ctx);
    if(FLYING_PHASES[phase]) drawBeamMeter(ctx);
    drawBanner(ctx);
    drawMarqueeBanner(ctx);
  }
  if(isTouch) drawJoystick(ctx); // no-op when no drag is active (see shared/framework.js's drawJoystick)
  ctx.restore();
}

/* ======================================================================
   INPUT -- move vector (WASD/arrows/stick/left-half touch joystick) to
   steer; action (SPACE / right-half tap / gamepad A) fires THE BEAM when
   charged, or advances title/card/end-card -- the Hangout's touch
   convention (see game/engine.js's own pointerdown handler), not flight's
   whole-screen-tap. Volume UI pointerdown check comes first, always.
   ====================================================================== */
window.addEventListener('keydown', (e)=>{
  keys[e.code] = true;
  ensureAudioStarted();
  if(e.code==='KeyM' && !e.repeat){ toggleMute(); return; }
  if(rotatePromptActive) return;
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
  if(e.pointerType!=='touch'){
    handleAction();
    return;
  }
  isTouch = true;
  if(rotatePromptActive) return;
  if(activeCard || phase==='title' || phase==='endcard'){
    handleAction();
    return;
  }
  if(p.x < CW/2){
    touchJoystick.active = true;
    touchJoystick.pointerId = e.pointerId;
    touchJoystick.baseX = p.x; touchJoystick.baseY = p.y;
    touchJoystick.curX = p.x; touchJoystick.curY = p.y;
  } else {
    touchActionPointerId = e.pointerId;
    handleAction();
  }
});
window.addEventListener('pointermove', (e)=>{
  if(e.pointerType==='touch' && touchJoystick.active && e.pointerId===touchJoystick.pointerId){
    const p = screenToLogical(e.clientX, e.clientY);
    touchJoystick.curX = p.x; touchJoystick.curY = p.y;
  }
});
window.addEventListener('pointerup', releaseTouchPointer);
window.addEventListener('pointercancel', releaseTouchPointer);
window.addEventListener('load', ()=>{ try{ ensureAudioStarted(); }catch(e){} });

/* ======================================================================
   MAIN LOOP -- same frame()/rAF shape every engine uses (see flight/
   engine.js's/defense/engine.js's identical structure); tick(dt) is
   factored out as its own named function so a future harness can drive
   frames manually without duplicating this logic.
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
