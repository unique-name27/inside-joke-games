'use strict';
/* ======================================================================
   SHARED ENGINE -- intro cinematic
   Single-file implementation per SPEC-intro.md. Loaded by every deployed
   games/<slug>/intro/ page AND the bare /intro/ page (which redirects to
   the builder when there's no file config and no #cfg= fragment -- see
   the CONFIG-resolution block just below).
   ====================================================================== */

/* ---------------- shared-engine asset root -- see game/index.html for the
   identical mechanism/rationale (README "How games are added"). Moved
   ahead of document.title -- previously the first line -- for the same
   reason as game/engine.js: the URL-fragment override just below needs
   ENGINE_ROOT before anything else touches CONFIG. ---------------- */
const ENGINE_ROOT = new URL('../', document.currentScript.src).href;

/* ---------------- URL-fragment CONFIG override (self-serve generator) ----------------
   See game/engine.js for the full rationale (including the bare-page
   redirect-to-builder behavior) -- identical mechanism here, duplicated by
   this project's established convention for anything shared between the
   two engines. game/cfgcodec.js is loaded just before this script (right
   after config.js), same as on the game/ page. */
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

document.title = CONFIG.title.introPageTitle;

/* ---------------- constants & palette ---------------- */
const CW = 960, CH = 540, TILE = 16, SPR_SCALE = 4;
// fitCanvas() (shared/framework.js) reads CW/CH -- the one initial call has
// to happen here, now that CW exists, rather than inside framework.js
// itself (which loads before this declaration) -- see its own comment.
fitCanvas();
const PAL = {
  cream:'#f3e9d2', terracotta:'#c96f4a', wood:'#8a5a30',
  night:'#141428', starWhite:'#fff3c9', glowHi:'#ffb347', glowLo:'#7a4a1e',
  gold:'#e8b84b', outline:'#6b2b1f', ink:'#2a1c12', silhouette:'#0a0a14'
};
// RECORD_MODE is declared (as a safe `let ... = false` default) in
// shared/framework.js, loaded just before this script -- reassigning
// (not re-declaring) it here preserves this deliberate intro-only feature.
// See shared/framework.js's header, reconciliation 1.
RECORD_MODE = new URLSearchParams(location.search).get('record') === '1';

/* ---------------- story skeleton (scene) resolution -- see game/skeletons.js
   ----------------
   Identical mechanism/rationale to game/engine.js's own SKEL resolution --
   game/skeletons.js is loaded (as ../game/skeletons.js, mirroring this
   page's existing ../game/config.js load) just before this script. Only
   Scene 3 (the flashback around the table) reads SKEL -- see drawScene3. */
const SKEL = (typeof SKELETONS !== 'undefined') ? (SKELETONS[CONFIG.scene] || SKELETONS.dinner) : null;
const SKEL_HELPERS = { PAL: PAL, drawPixelCircle: drawPixelCircle, drawBitmap: drawBitmap, drawSparkle: drawSparkle, drawChunkyText: drawChunkyText };

/* ---------------- CONFIG-derived helpers (Phase B: template extraction) ----------------
   CONFIG comes from ../game/config.js (same file the game reads -- see the
   "config sharing" note in SPEC-game.md's Template & roles section),
   possibly overridden above by a URL fragment. See game/engine.js for why
   a fragment-loaded game's STORAGE_PREFIX is hash-derived instead of
   CONFIG.gameId. See game/index.html for the identical (duplicated by
   convention) fmt()/skey(). */
const STORAGE_PREFIX = CFG_FRAGMENT ? ('frag_' + CFG_FRAGMENT.hash) : ((CONFIG && CONFIG.gameId) || 'game');
// skey() now lives in shared/framework.js -- see game/engine.js's matching
// comment / shared/framework.js's header for why this is safe.
function fmt(s){
  if(typeof s !== 'string') return s;
  let out = s;
  if(CONFIG.host) out = out.split('{HOST}').join(CONFIG.host.name);
  if(CONFIG.savior) out = out.split('{ITEM}').join(CONFIG.savior.itemName);
  return out;
}
function fmtLines(lines){ return lines.map(fmt); }
const CAST = CONFIG.cast || {};
const SAVIOR_CAST = !!(CONFIG.cast && CONFIG.cast.savior);
/* PHASE C: Scene 3's flashback table used to hardcode these 4 tiles as
   bare literals -- byte-identical to the old default, but blind to ANY
   cast sprite pick (legacy spriteCol/Row or the new roster enum alike). Resolved once
   here (CONFIG/CAST never change at runtime) via the same shared
   rosterResolveSprite + fallback-col/row-IS-today's-literal pattern
   game/engine.js's DINER_DEFS uses, so an unpicked cast (every pre-
   Phase-C config) still renders these 4 literals exactly. */
const INTRO_DINER_SPRITES = {
  diner0: rosterResolveSprite(CAST.diner0, 1, 7),
  judge: rosterResolveSprite(CAST.judge, 4, 8),
  butterfingers: rosterResolveSprite(CAST.butterfingers, 3, 8),
  builder: rosterResolveSprite(CAST.builder, 2, 8),
};

/* canvas/ctx/fitCanvas/isTouch/rotatePromptActive now live in
   shared/framework.js (loaded before this script). */
/* see game/engine.js's identical listener for the full rationale: a new
   #cfg= link opened while this same path is already loaded only fires
   hashchange (no real navigation), so without this the tab would keep
   playing the OLD, already-resolved config under the new URL. */
window.addEventListener('hashchange', ()=>{ location.reload(); });

/* ---------------- assets ---------------- */
const imgTown = new Image();
const imgDungeon = new Image();
imgTown.src = ENGINE_ROOT + 'intro/assets/tiny_town.png';
imgDungeon.src = ENGINE_ROOT + 'intro/assets/tiny_dungeon.png';
let assetsReady = false;
let assetsLoaded = 0;
// PHASE C: imgTown/imgDungeon above are unchanged (imgTown is scenery-only,
// not part of the roster -- see game/roster.js's own header comment); the
// roster's OTHER sheets (Tiny Farm/Ski/Battle) load the same way, tracked
// by the same assetsLoaded/assetsReady gate, just widened from a fixed "2"
// to "however many sheets total" so this still only flips true once every
// sheet has settled (loaded or errored).
const ROSTER_SHEET_IMAGES = { dungeon: imgDungeon };
const ROSTER_SHEET_KEYS = (typeof ROSTER_SHEETS !== 'undefined') ? Object.keys(ROSTER_SHEETS) : ['dungeon'];
const ASSETS_TOTAL = 2 + (ROSTER_SHEET_KEYS.length - 1); // imgTown + imgDungeon + every non-dungeon roster sheet
function assetLoaded(){ assetsLoaded++; if(assetsLoaded>=ASSETS_TOTAL) assetsReady = true; }
imgTown.onload = assetLoaded;
imgDungeon.onload = assetLoaded;
imgTown.onerror = assetLoaded;
imgDungeon.onerror = assetLoaded;
for(const __sheetKey of ROSTER_SHEET_KEYS){
  if(__sheetKey === 'dungeon') continue;
  const img = new Image();
  img.src = ENGINE_ROOT + ROSTER_SHEETS[__sheetKey].path;
  img.onload = assetLoaded;
  img.onerror = assetLoaded;
  ROSTER_SHEET_IMAGES[__sheetKey] = img;
}
function sheetImage(sheetKey){ return ROSTER_SHEET_IMAGES[sheetKey] || imgDungeon; }

/* tile sheet geometry: 16px tiles, 1px gap */
/* NOTE: the Kenney "_packed" sheets are tightly packed (0px gap between tiles),
   unlike the loose/unpacked "Tiles" folder exports -- confirmed via naturalWidth
   192 = 12*16 exactly on both tiny_town.png and tiny_dungeon.png. */
function tileSrcX(col){ return col*TILE; }
function tileSrcY(row){ return row*TILE; }

/* ---------------- tinted sprite cache (silhouettes / recolors) ---------------- */
const tintCache = new Map();
function tintedSprite(img, col, row, color){
  const key = img.src+'|'+col+'|'+row+'|'+color;
  let c = tintCache.get(key);
  if(c) return c;
  const off = document.createElement('canvas');
  off.width = TILE; off.height = TILE;
  const o = off.getContext('2d');
  o.imageSmoothingEnabled = false;
  o.drawImage(img, tileSrcX(col), tileSrcY(row), TILE, TILE, 0, 0, TILE, TILE);
  o.globalCompositeOperation = 'source-in';
  o.fillStyle = color;
  o.fillRect(0,0,TILE,TILE);
  tintCache.set(key, off);
  return off;
}
function rawTile(img,col,row){
  const key = img.src+'|raw|'+col+'|'+row;
  let c = tintCache.get(key);
  if(c) return c;
  const off = document.createElement('canvas');
  off.width = TILE; off.height = TILE;
  const o = off.getContext('2d');
  o.imageSmoothingEnabled = false;
  o.drawImage(img, tileSrcX(col), tileSrcY(row), TILE, TILE, 0, 0, TILE, TILE);
  tintCache.set(key, off);
  return off;
}
/* draw a 16px tile scaled by integer factor, optional vertical flip (for "facing up" diners) */
function drawTile(ctx, tileCanvas, dx, dy, scale, flipY){
  ctx.imageSmoothingEnabled = false;
  if(flipY){
    ctx.save();
    ctx.translate(dx, dy + TILE*scale);
    ctx.scale(1,-1);
    ctx.drawImage(tileCanvas, 0, 0, TILE*scale, TILE*scale);
    ctx.restore();
  } else {
    ctx.drawImage(tileCanvas, dx, dy, TILE*scale, TILE*scale);
  }
}

/* pixelText/drawPixelText/drawChunkyText/readingFont/measureReadingText/
   drawReadingText/drawReadingTextOutlined now live in shared/framework.js. */

/* ---------------- pixel primitives ---------------- */
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

/* diagonal kitchen knife -- swept as axis-aligned vertical column stamps along a
   fixed tip->handle line (no ctx.rotate, since rotated fills anti-alias even
   with smoothing off). Endpoints are hardcoded for Scene 5's exact layout:
   the tip pokes out above-right of the title lockup, the handle+rivets poke
   out below-left, and the middle length runs behind it (this function is
   called before the logo is drawn). Every column overlaps the next (step <
   column width), so blade, guard and handle are one unbroken shape. */
function drawKnife(ctx, alpha){
  ctx.save();
  ctx.globalAlpha = (alpha===undefined?1:alpha);
  ctx.imageSmoothingEnabled = false;

  const tipX = 720, tipY = 150;       // clear of the title lockup's right edge
  const handleX = 260, handleY = 295; // clear of the ribbon banner (top 315)
  const spanX = tipX - handleX;
  const slope = (handleY - tipY) / (handleX - tipX);
  const bladeFrac = 0.62, guardFrac = 0.05;
  const step = 3, w = step + 1;

  for(let x = tipX; x >= handleX; x -= step){
    const t = (tipX - x) / spanX;
    const y = tipY + slope*(x - tipX);
    const xi = Math.round(x);
    if(t < bladeFrac){
      const bt = t / bladeFrac;
      const half = Math.round((6 + bt*20) / 2);
      ctx.fillStyle = '#d7dee4'; // light half (highlight side)
      ctx.fillRect(xi, Math.round(y-half), w, half);
      ctx.fillStyle = '#8a939c'; // dark half (shadow side)
      ctx.fillRect(xi, Math.round(y), w, half);
      ctx.fillStyle = '#f2f5f7'; // straight spine highlight on the centerline
      ctx.fillRect(xi, Math.round(y-1), w, 3);
    } else if(t < bladeFrac + guardFrac){
      ctx.fillStyle = '#1c1c1c'; // guard / bolster
      ctx.fillRect(xi, Math.round(y-13), w, 26);
    } else {
      ctx.fillStyle = '#2c1c10'; // dark handle
      ctx.fillRect(xi, Math.round(y-9), w, 18);
    }
  }
  // 2 rivets, positioned within the segment of the handle that clears the logo
  for(const rt of [0.90, 0.97]){
    const x = tipX - rt*spanX;
    const y = tipY + slope*(x - tipX);
    ctx.fillStyle = '#c98a3a';
    ctx.fillRect(Math.round(x-2), Math.round(y-2), 5, 5);
  }
  ctx.restore();
}

/* ---------------- programmatic props (5x-ish grid bitmaps) ---------------- */
const STEAK_ROWS = ['01111110','12222110','12133210','12222110','01111110'];
const STEAK_COLORS = {'1':'#e79b8c','2':'#f2c9b8','3':'#7a3f2a'};

function drawSteak(ctx, x, y, cell){
  drawBitmap(ctx, STEAK_ROWS, STEAK_COLORS, x, y, cell);
}

/* ---------------- hand-built pixel title font (5x7 grid) ----------------
   Full A-Z coverage (this renderer draws whatever CONFIG.title.lockupLines
   supplies -- it owns no branding of its own; W/Y are unused by any
   currently-shipped title but harmless to leave in place). */
const TITLE_GLYPHS = {
  W: ['10001','10001','10001','10101','10101','11011','10001'],
  A: ['01110','10001','10001','11111','10001','10001','10001'],
  G: ['01111','10000','10000','10011','10001','10001','01110'],
  Y: ['10001','10001','01010','00100','00100','00100','00100'],
  U: ['10001','10001','10001','10001','10001','10001','01110'],
  K: ['10001','10010','10100','11000','10100','10010','10001'],
  R: ['11110','10001','10001','11110','10100','10010','10001'],
  S: ['01111','10000','10000','01110','00001','00001','11110'],
  C: ['01111','10000','10000','10000','10000','10000','01111'],
  B: ['11110','10001','10001','11110','10001','10001','11110'],
  I: ['11111','00100','00100','00100','00100','00100','11111'],
  N: ['10001','11001','10101','10101','10011','10001','10001'],
  D: ['11100','10010','10001','10001','10001','10010','11100'],
  O: ['01110','10001','10001','10001','10001','10001','01110'],
  M: ['10001','11011','10101','10101','10001','10001','10001'],
  E: ['11111','10000','10000','11110','10000','10000','11111'],
  F: ['11111','10000','10000','11110','10000','10000','10000'],
  H: ['10001','10001','10001','11111','10001','10001','10001'],
  J: ['00111','00010','00010','00010','00010','10010','01100'],
  L: ['10000','10000','10000','10000','10000','10000','11111'],
  P: ['11110','10001','10001','11110','10000','10000','10000'],
  Q: ['01110','10001','10001','10001','10101','10010','01101'],
  T: ['11111','00100','00100','00100','00100','00100','00100'],
  V: ['10001','10001','10001','10001','10001','01010','00100'],
  X: ['10001','10001','01010','00100','01010','10001','10001'],
  Z: ['11111','00001','00010','00100','01000','10000','11111'],
  '0': ['01110','10001','10011','10101','11001','10001','01110'],
  '1': ['00100','01100','00100','00100','00100','00100','01110'],
  '2': ['01110','10001','00001','00010','00100','01000','11111'],
  '3': ['11110','00001','00001','01110','00001','00001','11110'],
  '4': ['00010','00110','01010','10010','11111','00010','00010'],
  '5': ['11111','10000','11110','00001','00001','10001','01110'],
  '6': ['00110','01000','10000','11110','10001','10001','01110'],
  '7': ['11111','00001','00010','00100','01000','01000','01000'],
  '8': ['01110','10001','10001','01110','10001','10001','01110'],
  '9': ['01110','10001','10001','01111','00001','00010','01100'],
  "'": ['01100','01100','00100','00000','00000','00000','00000'],
  '.': ['00000','00000','00000','00000','00000','01100','01100'],
  '?': ['01110','10001','00001','00010','00100','00000','00100'],
};
const TITLE_GLYPH_COLS = 5, TITLE_GLYPH_ROWS = 7, TITLE_GLYPH_GAP = 1, TITLE_SPACE_COLS = 3;
function titleLineCols(line){
  let cols = 0;
  for(const ch of line) cols += (ch===' ' ? TITLE_SPACE_COLS : TITLE_GLYPH_COLS) + TITLE_GLYPH_GAP;
  return cols>0 ? cols-TITLE_GLYPH_GAP : 0;
}
let titleCanvasCache = null;
/* builds a multi-line hand-built pixel logo (each line independently
   centered within the block), 3-pass shadow/outline/fill style */
function buildTitleCanvas(lines, cell){
  const pad = 3, lineGap = 2;
  const lineCols = lines.map(titleLineCols);
  const maxCols = Math.max(...lineCols);
  const w = (maxCols + pad*2) * cell;
  const h = (lines.length*TITLE_GLYPH_ROWS + (lines.length-1)*lineGap + pad*2) * cell;
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const o = off.getContext('2d');
  o.imageSmoothingEnabled = false;

  function forEach(fn){
    let rowOffset = pad;
    for(let li=0; li<lines.length; li++){
      const line = lines[li];
      const startCol = pad + Math.floor((maxCols-lineCols[li])/2);
      let cx = startCol;
      for(const ch of line){
        if(ch===' '){ cx += TITLE_SPACE_COLS + TITLE_GLYPH_GAP; continue; }
        const glyph = TITLE_GLYPHS[ch];
        if(glyph){
          for(let r=0;r<TITLE_GLYPH_ROWS;r++){
            for(let c=0;c<TITLE_GLYPH_COLS;c++){
              if(glyph[r][c]==='1') fn(cx+c, rowOffset+r);
            }
          }
        }
        cx += TITLE_GLYPH_COLS + TITLE_GLYPH_GAP;
      }
      rowOffset += TITLE_GLYPH_ROWS + lineGap;
    }
  }
  // drop shadow
  o.fillStyle = 'rgba(20,10,6,0.55)';
  forEach((gx,gy)=> o.fillRect((gx+1)*cell, (gy+1)*cell, cell, cell));
  // outline
  o.fillStyle = PAL.outline;
  const offs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
  forEach((gx,gy)=>{
    for(const [dx,dy] of offs) o.fillRect((gx+dx)*cell, (gy+dy)*cell, cell, cell);
  });
  // fill
  o.fillStyle = PAL.gold;
  forEach((gx,gy)=> o.fillRect(gx*cell, gy*cell, cell, cell));
  return off;
}
function getTitleCanvas(){
  if(!titleCanvasCache) titleCanvasCache = buildTitleCanvas(CONFIG.title.lockupLines, 3);
  return titleCanvasCache;
}

/* ---------------- starfield ---------------- */
const NUM_STARS = 130;
const stars = [];
for(let i=0;i<NUM_STARS;i++){
  stars.push({
    x: Math.random()*CW,
    y: Math.random()*480,
    phase: Math.random()*Math.PI*2,
    speed: 3 + Math.random()*6
  });
}
function updateStars(dt){
  for(const s of stars){
    s.y -= s.speed*dt;
    if(s.y < -2){ s.y = 480; s.x = Math.random()*CW; }
  }
}
function drawStars(ctx, t){
  for(const s of stars){
    const tw = 0.5 + 0.5*Math.sin(t*2 + s.phase);
    ctx.globalAlpha = 0.35 + 0.65*tw;
    ctx.fillStyle = PAL.starWhite;
    ctx.fillRect(Math.floor(s.x), Math.floor(s.y), 2, 2);
  }
  ctx.globalAlpha = 1;
}
function drawMoon(ctx, x, y, r){
  drawPixelCircle(ctx, x, y, r, '#fff8e6', 2);
  drawPixelCircle(ctx, x+3, y+2, r-5, '#e9dcb0', 2);
}

/* makeTypewriter (typewriter speech bubbles bucket) now lives in
   shared/framework.js -- its `doneAt` member replaces this file's old
   totalDur/lineDoneTime, which were dead code (never referenced anywhere;
   see shared/framework.js's header, reconciliation 6). */

/* ======================================================================
   AUDIO ENGINE -- real Kenney CC0 samples (a few one-shot SFX + a single
   fallback music loop) over WebAudio, loaded via a generalized buffer-bank
   loader. The Karplus-Strong jaw-harp "twang" stays fully synthesized. The
   generic loader/player, BEAT_DEFAULT/MUSIC_BASE_GAIN/ducking, the twang
   synth, master volume + the volume UI, and the SpeechSynthesis wrapper all
   now live in shared/framework.js -- see its header for the full list and
   every reconciliation made (this file's old BPM/BEAT is now
   BEAT_DEFAULT -- same value, shared name; its one call site below was
   updated to match).
   ====================================================================== */

/* loadVolumeSetting/saveVolumeSetting/applyMasterVolume/setVolumeSetting/
   initAudio now live in shared/framework.js -- RECONCILED there to this
   file's RECORD_MODE-aware bodies (see its header, reconciliation 1) and
   BUG-FIXED to also call tryDecodeAllSamples() (reconciliation 2: this
   file's old initAudio only called tryDecodeAllLoops(), so its 3 defined
   SFX -- ding/slamBoom/fanfare, actually called from this file's own scene
   code -- almost certainly never played). */
let volumeSetting = loadVolumeSetting();
let volumeBeforeMute = volumeSetting>0 ? volumeSetting : 0.25;

/* ---------------- background music track (theme.mp3) ----------------
   FULLY BUFFERED playback, same approach as game/index.html: fetch at page
   load (no gesture needed), decodeAudioData once the context exists, loop an
   AudioBufferSourceNode through musicGain. Avoids the iOS-flaky
   <audio>+createMediaElementSource path entirely. Ducking (setMusicLevel/
   duckDown/duckUp) works unchanged; the loop fallback is a quiet understudy
   (loopGain) silenced the moment the real track starts. */
/* CONFIG.music.customSongPath -- see game/index.html for the matching
   toggle/rationale. */
const USE_CUSTOM_SONG = !!CONFIG.music.customSongPath;
const MUSIC_TRACK_SRC = CONFIG.music.customSongPath;
let useMp3Music = false, bgmGraceUntil = 0;
let bgmRawBytes = null, bgmBuffer = null, bgmSourceNode = null;
let bgmFetchState = 'idle'; // idle | loading | fetched | decoding | ready | failed
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
  } catch(err){ /* the loop fallback keeps covering */ }
}
if(USE_CUSTOM_SONG) prefetchMusic();

/* makeBufferBank/playSample (generic loader/player) now live in
   shared/framework.js. */

/* ---- one-shot SFX (real samples; same files as game/index.html) ---- */
const SFX_DEFS = {
  ding:     { src:ENGINE_ROOT+'assets/audio/sfx/confirmation_001.ogg',     gain:0.7 },
  slamBoom: { src:ENGINE_ROOT+'assets/audio/sfx/impactWood_heavy_002.ogg', gain:0.9 },
  fanfare:  { src:ENGINE_ROOT+'assets/audio/sfx/jingles-hit_10.ogg',       gain:0.8 },
};
const sfxLoader = makeBufferBank(SFX_DEFS);
function tryDecodeAllSamples(){ sfxLoader.tryDecodeAll(); }
sfxLoader.prefetchAll();

/* ---- single fallback music loop (the cinematic has no "beats" to score
   separately -- one warm, nostalgic loop covers the whole thing while
   USE_CUSTOM_SONG's track downloads, or permanently if there's no custom
   song at all) ---- */
const MUSIC_LOOP_DEFS = {
  fallback: { src: CONFIG.music.introFallback },
};
const loopLoader = makeBufferBank(MUSIC_LOOP_DEFS);
function tryDecodeAllLoops(){ loopLoader.tryDecodeAll(); }
loopLoader.prefetchAll();
// currentLoopKey/startLoopNow/stopLoopNow/updateBeatMusic (shared/
// framework.js) default pendingLoopKey to null -- seed this cinematic's one
// starting (and only) loop key explicitly (was the implicit always-
// 'fallback' behavior of this file's old single-boolean currentLoopOn
// design before this round's reconciliation; see shared/framework.js's
// header, reconciliation 3).
setBeatMusic('fallback');

/* startLoopNow/stopLoopNow/setBeatMusic/updateBeatMusic/playTwang/playBeep/
   duckDown/duckUp/setMusicLevel now live in shared/framework.js. */
function playDing(t){ playSample('ding', t); }
function playSlamBoom(t){ playSample('slamBoom', t); }
function playFanfare(t){
  playSample('fanfare', t);
  playTwang(t+1.2, 0.9); // tail twang, same offset as game/index.html's fanfare
}

let audioT0 = null; // actx.currentTime at boot-gate activation (music/scene "t=0") -- still the master scene clock

/* ======================================================================
   scene drawing helpers
   ====================================================================== */
/* updateTypewriterAudio now lives in shared/framework.js. */

/* deterministic town-at-night skyline: two rows of hardcoded building rects
   (no Math.random at draw time) instead of tiled/tinted sprites, which
   flattened to featureless full-width bands once recolored to a silhouette.
   Each entry is {x, w, h, roof, chimney}; roof is 'flat' | 'step' | 'gable'. */
const SKYLINE_BACK = [
  {x:-40, w:110, h:90,  roof:'flat',  chimney:false},
  {x:70,  w:90,  h:135, roof:'step',  chimney:false},
  {x:160, w:110, h:60,  roof:'flat',  chimney:true},
  {x:270, w:85,  h:140, roof:'gable', chimney:false},
  {x:355, w:100, h:75,  roof:'flat',  chimney:false},
  {x:455, w:90,  h:130, roof:'step',  chimney:false},
  {x:545, w:120, h:65,  roof:'flat',  chimney:true},
  {x:665, w:95,  h:125, roof:'gable', chimney:false},
  {x:760, w:110, h:100, roof:'step',  chimney:false},
  {x:870, w:110, h:70,  roof:'flat',  chimney:false},
  {x:980, w:90,  h:110, roof:'flat',  chimney:false}
];
const SKYLINE_FRONT = [
  {x:0,   w:90,  h:70,  roof:'flat',  chimney:false},
  {x:90,  w:70,  h:110, roof:'step',  chimney:true},
  {x:160, w:100, h:50,  roof:'flat',  chimney:false},
  {x:260, w:80,  h:130, roof:'gable', chimney:false},
  {x:340, w:120, h:90,  roof:'step',  chimney:false},
  {x:460, w:65,  h:140, roof:'flat',  chimney:true},
  {x:525, w:110, h:60,  roof:'gable', chimney:false},
  {x:635, w:75,  h:100, roof:'step',  chimney:false},
  {x:710, w:130, h:75,  roof:'flat',  chimney:true},
  {x:840, w:90,  h:120, roof:'gable', chimney:false},
  {x:930, w:90,  h:55,  roof:'flat',  chimney:false}
];
function drawBuilding(ctx, b, baseY, color){
  ctx.fillStyle = color;
  const topY = baseY - b.h;
  ctx.fillRect(b.x, topY, b.w, b.h);
  let roofTop = topY;
  if(b.roof === 'step'){
    const sw = Math.round(b.w*0.55), sh = 22;
    ctx.fillRect(b.x + Math.round((b.w-sw)/2), topY-sh, sw, sh);
    roofTop = topY - sh;
  } else if(b.roof === 'gable'){
    let ww = b.w, y = topY;
    for(let i=0;i<3;i++){
      ww = Math.round(ww*0.6);
      const sh = 9;
      y -= sh;
      ctx.fillRect(b.x + Math.round((b.w-ww)/2), y, ww, sh);
    }
    roofTop = y;
  }
  if(b.chimney){
    const cw = 9, chh = 26;
    ctx.fillRect(b.x + Math.round(b.w*0.18), roofTop-chh, cw, chh+6);
  }
}
function drawRooftops(ctx){
  const baseY = CH;
  for(const b of SKYLINE_BACK) drawBuilding(ctx, b, baseY, '#1c1c36');
  for(const b of SKYLINE_FRONT) drawBuilding(ctx, b, baseY, '#23233f');
}
function drawInterior(ctx){
  for(let x=0;x<CW;x+=64){
    for(let y=0;y<160;y+=64){
      drawTile(ctx, tintedSprite(imgDungeon,0,0,'#241a22'), x, y, 4, false);
    }
  }
  for(let x=0;x<CW;x+=64){
    for(let y=160;y<CH;y+=64){
      drawTile(ctx, tintedSprite(imgDungeon,1,3,'#3a2a1c'), x, y, 4, false);
    }
  }
  // floor-tile seams -- tinting a sprite to a silhouette color flattens all of its
  // own texture, so without this the floor band reads as one flat brown rectangle.
  // Draw explicit grid seams (+ a faint plank highlight) so it reads as tiled floor.
  ctx.fillStyle = '#241a10';
  for(let x=0;x<=CW;x+=64){ ctx.fillRect(x,160,2,CH-160); }
  for(let y=160;y<=CH;y+=64){ ctx.fillRect(0,y,CW,2); }
  ctx.fillStyle = '#4a3624';
  for(let x=32;x<CW;x+=64){ ctx.fillRect(x,160,1,CH-160); }
}
function drawDiningHint(ctx){
  // a dim, partially-lit table + plates at left/center of the dark dining room,
  // so Scene 2's interior reads as a dining room rather than an empty box.
  const tx=110, ty=290, tw=170, th=64;
  ctx.fillStyle = '#3a2417'; ctx.fillRect(tx,ty,tw,th);
  ctx.fillStyle = '#5c3a26'; ctx.fillRect(tx+4,ty+4,tw-8,th-8);
  drawPixelCircle(ctx, tx+42, ty+32, 9, '#7a705c', 2);
  drawPixelCircle(ctx, tx+128, ty+32, 9, '#7a705c', 2);
}
let doorGrad = null;
function drawDoorwayGlow(ctx){
  if(!doorGrad){
    doorGrad = ctx.createRadialGradient(840,220,10,840,220,300);
    doorGrad.addColorStop(0, PAL.glowHi);
    doorGrad.addColorStop(1, PAL.glowLo);
  }
  ctx.fillStyle = doorGrad;
  ctx.fillRect(760,50,160,350);
  ctx.beginPath();
  ctx.moveTo(760,50);
  ctx.lineTo(760,400);
  ctx.lineTo(430,360);
  ctx.lineTo(430,110);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#1a1420';
  ctx.lineWidth = 6;
  ctx.strokeRect(760,50,160,350);
}
/* hand-built standing silhouette (12x20 grid): hat, head, shoulders, torso, legs.
   The 16px dungeon sprite only fills a fraction of its own tile once tinted flat,
   which read as a small unreadable blob -- this bitmap is sized and posed on
   purpose so the backlit silhouette in the doorway is legible. */
const HOST_SIL_ROWS = [
  '....1111....', // hat top
  '...111111...', // hat puff
  '..11111111..', // hat brim
  '...111111...', // head
  '...111111...', // head
  '...111111...', // jaw
  '....1111....', // neck
  '..11111111..', // shoulders
  '.1111111111.', // torso
  '.1111111111.', // torso
  '.1111111111.', // torso
  '.1111111111.', // torso/belt
  '..11111111..', // waist
  '..11111111..', // hips
  '..111..111..', // legs
  '..111..111..', // legs
  '..111..111..', // legs
  '..111..111..', // legs
  '..111..111..', // legs
  '..111..111..'  // feet
];
function drawHostSilhouette(ctx, cx, feetY, t){
  const bob = (Math.floor(t/0.4)%2===0) ? 0 : -2;
  const cell = 5;
  const w = 12*cell, h = HOST_SIL_ROWS.length*cell;
  const x = cx - w/2;
  const y = feetY - h + bob;
  ctx.fillStyle = PAL.silhouette;
  for(let r=0;r<HOST_SIL_ROWS.length;r++){
    const row = HOST_SIL_ROWS[r];
    for(let c=0;c<row.length;c++){
      if(row[c] === '1') ctx.fillRect(Math.round(x+c*cell), Math.round(y+r*cell), cell, cell);
    }
  }
}
/* PHASE C: `sheet` is now a required first sprite param -- see
   game/engine.js's identical drawDinerSprite for the full rationale. */
function drawDiner(ctx, sheet, col, row, x, y, flip){
  drawTile(ctx, rawTile(sheetImage(sheet),col,row), x-32, y-64, 4, flip);
}
/* drawSpeechBubble now lives in shared/framework.js. */
function drawSpotlight(ctx, cx, cy){
  const bands = [[170,'rgba(243,233,210,0.06)'],[130,'rgba(243,233,210,0.10)'],
                 [95,'rgba(243,233,210,0.16)'],[62,'rgba(243,233,210,0.24)'],[34,'rgba(255,248,230,0.35)']];
  for(const [r,color] of bands) drawPixelCircle(ctx, cx, cy, r, color, 4);
}
// PHASE C: same host sprite resolution as game/engine.js's HOST_SPRITE --
// resolved once (CONFIG never changes at runtime), the roster's own
// 'plain' entry ({dungeon,2,7}) as the default, so an unpicked host
// renders byte-identical to before this phase. No overlay on top (no
// hat) -- the host renders as exactly their roster sprite, same as
// every other seat.
const HOST_SPRITE = rosterResolveSprite(CONFIG.host, 2, 7);
function drawItemGetHost(ctx, cx, feetY, t){
  drawTile(ctx, rawTile(sheetImage(HOST_SPRITE.sheet),HOST_SPRITE.col,HOST_SPRITE.row), cx-32, feetY-64, 4, false);
  const steakY = feetY-112 + Math.sin(t*2)*3;
  drawSteak(ctx, cx-16, steakY, 4);
  for(let k=0;k<4;k++){
    const ang = t*1.5 + k*(Math.PI/2);
    const sx = cx + Math.cos(ang)*26;
    const sy = steakY+10 + Math.sin(ang)*14;
    drawSparkle(ctx, sx, sy, sparkleFrameSize(t+k*0.1), 0.9, PAL.gold);
  }
}
function drawArchedText(ctx, text, cx, cy, px, color, archHeight){
  const widths = []; let total = 0;
  for(const ch of text){ const pt = pixelText(ch, px, color); widths.push(pt.w); total += pt.w; }
  let x = cx - total/2;
  const n = text.length;
  for(let i=0;i<n;i++){
    const progress = n<=1 ? 0.5 : i/(n-1);
    const yOff = -Math.sin(progress*Math.PI)*archHeight;
    drawPixelText(ctx, text[i], x, cy+yOff, px, color);
    x += widths[i];
  }
}
function drawRibbon(ctx, cx, cy, w, h){
  ctx.fillStyle = PAL.wood; ctx.fillRect(cx-w/2-6, cy-h/2-4, w+12, h+8);
  ctx.fillStyle = PAL.terracotta; ctx.fillRect(cx-w/2, cy-h/2, w, h);
  ctx.fillStyle = PAL.wood;
  ctx.fillRect(cx-w/2-20, cy-h/2, 20, h);
  ctx.fillRect(cx+w/2, cy-h/2, 20, h);
}
function drawLogoSparkleCross(ctx, cx, cy, t){
  const period = 4.0, travel = 1.0;
  const local = ((t%period)+period)%period;
  if(local < travel){
    const p = local/travel;
    const sx = cx-140 + p*280;
    const sy = cy - 10 - Math.sin(p*Math.PI)*20;
    drawSparkle(ctx, sx, sy, sparkleFrameSize(t,0.3), 0.85, '#fff8e6');
  }
}

/* ======================================================================
   per-scene draw functions
   ====================================================================== */
function drawScene1(ctx, localT, se){
  ctx.fillStyle = PAL.night; ctx.fillRect(0,0,CW,CH);
  drawStars(ctx, se);
  drawMoon(ctx, 800, 90, 26);
  if(assetsReady) drawRooftops(ctx);
  const state = updateTypewriterAudio(sceneData.tw, localT);
  const lines = sceneData.tw.lines;
  const ys = [350,386,422];
  for(let i=0;i<lines.length;i++){
    drawReadingTextOutlined(ctx, lines[i].slice(0,state[i]), CW/2, ys[i], 21, PAL.cream, '#000000', 'center');
  }
}
function drawScene2(ctx, localT, se){
  ctx.fillStyle = '#120c16'; ctx.fillRect(0,0,CW,CH);
  if(assetsReady){
    drawInterior(ctx);
    drawDiningHint(ctx);
    drawDoorwayGlow(ctx);
    drawHostSilhouette(ctx, 840, 400, se);
  }
  const state = updateTypewriterAudio(sceneData.tw, localT, (lineIdx)=>{
    if(lineIdx===1 && actx) playTwang(actx.currentTime+0.02);
  });
  const lines = sceneData.tw.lines;
  drawReadingTextOutlined(ctx, lines[0].slice(0,state[0]), CW/2, 452, 21, PAL.cream, '#000000', 'center');
  drawReadingTextOutlined(ctx, lines[1].slice(0,state[1]), CW/2, 486, 21, PAL.cream, '#000000', 'center');
}
function drawScene3(ctx, localT, se){
  let shakeX=0, shakeY=0;
  if(sceneData.slamFired){
    const remain = (sceneData.slamAt+0.4) - localT;
    if(remain>0){
      const mag = 8*remain/0.4;
      shakeX = (Math.random()*2-1)*mag; shakeY = (Math.random()*2-1)*mag;
    }
  }
  ctx.save();
  ctx.translate(shakeX, shakeY);
  ctx.fillStyle = '#120c16'; ctx.fillRect(-12,-12,CW+24,CH+24);
  if(assetsReady){
    drawInterior(ctx);
    SKEL.drawCenterProp(ctx, localT, SKEL_HELPERS);
    drawDiner(ctx,INTRO_DINER_SPRITES.diner0.sheet,INTRO_DINER_SPRITES.diner0.col,INTRO_DINER_SPRITES.diner0.row,400,246,false);
    drawDiner(ctx,INTRO_DINER_SPRITES.judge.sheet,INTRO_DINER_SPRITES.judge.col,INTRO_DINER_SPRITES.judge.row,560,246,false);
    drawDiner(ctx,INTRO_DINER_SPRITES.butterfingers.sheet,INTRO_DINER_SPRITES.butterfingers.col,INTRO_DINER_SPRITES.butterfingers.row,400,440,true);
    drawDiner(ctx,INTRO_DINER_SPRITES.builder.sheet,INTRO_DINER_SPRITES.builder.col,INTRO_DINER_SPRITES.builder.row,560,440,true);
  }
  // size the bubble to the widest full line (not the partial typed text) so it
  // never has to resize mid-type, and text always stays inside its border.
  const bubbleLinePx = 16, bubblePad = 12;
  const bubbleLine0W = measureReadingText(ctx, sceneData.tw.lines[0], bubbleLinePx);
  const bubbleLine1W = measureReadingText(ctx, sceneData.tw.lines[1], bubbleLinePx);
  const bubbleW = Math.max(bubbleLine0W, bubbleLine1W) + bubblePad*2;
  const bubbleY = 110, bubbleH = 84;
  // clamped so a long typed line can never push the bubble off-canvas
  const bubbleX = Math.max(6, Math.min(CW-bubbleW-6, 330));
  if(localT>1.0){
    const bubbleT = Math.max(0, Math.min(1,(localT-1.0)/0.4));
    drawSpeechBubble(ctx, bubbleX, bubbleY, bubbleW, bubbleH, bubbleT);
  }
  if(localT>1.5){
    const state = updateTypewriterAudio(sceneData.tw, localT-1.5, (lineIdx)=>{
      if(lineIdx===1) sceneData.silenceStartAt = localT;
    });
    const lines = sceneData.tw.lines;
    const tx = bubbleX + bubblePad;
    drawReadingText(ctx, lines[0].slice(0,state[0]), tx, bubbleY+14, bubbleLinePx, '#000000', 'left');
    drawReadingText(ctx, lines[1].slice(0,state[1]), tx, bubbleY+42, bubbleLinePx, '#000000', 'left');
  }
  if(sceneData.silenceStartAt!=null && !sceneData.silenceDucked){
    sceneData.silenceDucked = true;
    if(actx) duckDown(actx.currentTime);
  }
  if(sceneData.silenceStartAt!=null && !sceneData.slamFired && localT >= sceneData.silenceStartAt+0.7){
    sceneData.slamFired = true;
    sceneData.slamAt = localT;
    if(actx){
      const now = actx.currentTime;
      playSlamBoom(now);
      playTwang(now);
      playTwang(now+BEAT_DEFAULT);
      duckUp(now, 1.0);
    }
    for(let i=0;i<18;i++){
      sceneData.particles.push({x:380+Math.random()*200, y:260+Math.random()*80, vy:-(20+Math.random()*20), born:localT, life:2.0});
    }
  }
  if(sceneData.slamFired){
    drawChunkyText(ctx, CONFIG.punchline, CW/2, 300, 64, PAL.gold, PAL.outline, 'center');
    for(const p of sceneData.particles){
      const age = localT - p.born;
      if(age<0 || age>p.life) continue;
      const alpha = 1-age/p.life;
      const py = p.y + p.vy*age;
      ctx.save(); ctx.globalAlpha = alpha;
      drawPixelText(ctx, 'HA', p.x, py, 14, PAL.cream, 'center');
      ctx.restore();
    }
  }
  ctx.restore();
}
function drawScene4(ctx, localT, se){
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,CW,CH);
  drawSpotlight(ctx, CW/2, 300);
  if(assetsReady) drawItemGetHost(ctx, CW/2, 400, se);
  if(!sceneData.fanfareFired && localT>=0.3){
    sceneData.fanfareFired = true;
    if(actx){
      const now = actx.currentTime;
      duckDown(now);
      playFanfare(now+0.05);
    }
  }
  if(sceneData.fanfareFired && !sceneData.duckedUp && localT>=1.9){
    sceneData.duckedUp = true;
    if(actx) duckUp(actx.currentTime, 1.0);
  }
  if(localT>0.6){
    const state = updateTypewriterAudio(sceneData.tw, localT-0.6);
    const lines = sceneData.tw.lines;
    drawReadingTextOutlined(ctx, lines[0].slice(0,state[0]), CW/2, 446, 21, PAL.cream, '#000000', 'center');
    drawReadingTextOutlined(ctx, lines[1].slice(0,state[1]), CW/2, 480, 21, PAL.cream, '#000000', 'center');
  }
}
function drawScene5(ctx, localT, se){
  ctx.fillStyle = PAL.night; ctx.fillRect(0,0,CW,CH);
  drawStars(ctx, se);
  drawMoon(ctx, 850, 70, 20);
  // knife drawn first (lowest z-order) so it sits BEHIND the logo -- its tip
  // still pokes out top-right of the wordmark, its middle length runs behind it.
  drawKnife(ctx, 0.85);
  const wc = getTitleCanvas();
  const logoScale = 2.6;
  const lw = wc.width*logoScale, lh = wc.height*logoScale;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(wc, Math.round(CW/2-lw/2), 120, lw, lh);
  drawLogoSparkleCross(ctx, CW/2, 200, localT);
  drawRibbon(ctx, CW/2, 335, 220, 40);
  drawReadingTextOutlined(ctx, CONFIG.punchline, CW/2, 324, 20, PAL.cream, '#000000', 'center');
  const blinkOn = Math.floor(localT)%2===0;
  if(blinkOn) drawReadingTextOutlined(ctx, 'PRESS START', CW/2, 404, 26, PAL.cream, '#000000', 'center');
  const controlsLine = isTouch
    ? 'DRAG LEFT SIDE -- MOVE      TAP RIGHT SIDE -- SAY IT / THROW'
    : 'ARROWS / WASD -- MOVE      SPACE -- SAY IT / THROW';
  drawReadingTextOutlined(ctx, controlsLine, CW/2, 444, 17, PAL.cream, '#000000', 'center');
  if(!isTouch) drawReadingTextOutlined(ctx, 'GAMEPAD WORKS TOO', CW/2, 478, 15, PAL.cream, '#000000', 'center');
  drawReadingTextOutlined(ctx, 'A DINNER PARTY LEGEND · KENNEY ASSETS · CC0', CW/2, 512, 12, PAL.cream, '#000000', 'center');
}
function drawBoot(nowMs){
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,CW,CH);
  const on = Math.floor(nowMs/500)%2===0;
  if(on) drawReadingTextOutlined(ctx, 'CLICK TO START', CW/2, CH/2-20, 30, PAL.cream, '#000000', 'center');
  drawReadingTextOutlined(ctx, '(OR PRESS ANY KEY)', CW/2, CH/2+22, 15, PAL.cream, '#000000', 'center');
}

/* ======================================================================
   state machine, input, record mode, main loop
   ====================================================================== */
let state = 'boot';
let sceneClockOffset = 0;
let prevSceneNum = -1;
let sceneData = {};
let lastInputTime = performance.now();
let lastFrame = performance.now();
let recorder = null, recordChunks = [], isRecording = false;
let gpPrevPressed = false;

/* screenToLogical (input layer) and the volume settings UI -- VOL_ICON/
   drawVolumeUI/toggleMute/handleVolumePointerdown/etc. (grouped under audio
   core) -- now live in shared/framework.js, RECONCILED there to this file's
   RECORD_MODE-aware bodies (see its header, reconciliation 1). */

function trueElapsed(){ return actx ? (actx.currentTime - audioT0) : 0; }
function sceneElapsedNow(){ return trueElapsed() - sceneClockOffset; }
function sceneNumFor(se){
  if(se<10) return 1;
  if(se<20) return 2;
  if(se<32) return 3;
  if(se<40) return 4;
  return 5;
}
function sceneLocalStart(n){
  return n===1?0 : n===2?10 : n===3?20 : n===4?32 : 40;
}
function enterScene(n){
  sceneData = { scene:n, particles:[] };
  if(n===1){
    sceneData.tw = makeTypewriter(fmtLines(CONFIG.introStory.scene1Lines),20,0.4);
    if(actx) setMusicLevel(1.0, actx.currentTime);
  } else if(n===2){
    sceneData.tw = makeTypewriter(fmtLines(CONFIG.introStory.scene2Lines),20,0.4);
  } else if(n===3){
    sceneData.tw = makeTypewriter(fmtLines(CONFIG.stories[0].lines),20,0.4);
    sceneData.slamFired = false;
    sceneData.slamAt = null;
    sceneData.silenceStartAt = null;
    sceneData.silenceDucked = false;
  } else if(n===4){
    sceneData.tw = makeTypewriter(fmtLines(SAVIOR_CAST ? CONFIG.introStory.scene4LinesWithSavior : CONFIG.introStory.scene4LinesNoSavior),20,0.4);
    sceneData.fanfareFired = false;
    sceneData.duckedUp = false;
  } else if(n===5){
    if(actx) setMusicLevel(0.85, actx.currentTime);
  }
}
function triggerBoot(){
  if(state!=='boot') return;
  initAudio();
  audioT0 = actx.currentTime;
  sceneClockOffset = 0;
  // hold the loop-fallback silent briefly -- on a normal connection the real
  // track decodes and starts inside this window
  bgmGraceUntil = performance.now() + 3000;
  tryDecodeMusic();
  if(actx.resume){
    const p = actx.resume();
    if(p && typeof p.then==='function') p.then(tryStartMusic);
  }
  tryStartMusic();
  state = 'cine';
  prevSceneNum = -1;
  lastInputTime = performance.now();
  if(RECORD_MODE) startRecording();
}
function triggerSkip(){
  if(state!=='cine' || RECORD_MODE) return;
  const se = sceneElapsedNow();
  if(se>=40){
    // on the title screen: PRESS START / any click / key / gamepad button now
    // launches the game instead of replaying (attract-loop idle-replay is separate,
    // still handled by the 25s-idle timer in frame()). Forward location.hash so a
    // `#cfg=` fragment override (see cfgLoadFragmentOverride) stays attached to the
    // SAME link across the intro->game navigation -- location.hash is already
    // '' when there's no fragment, so this is a no-op for every file-CONFIG game.
    window.location.href = '../game/' + location.hash;
    return;
  }
  sceneClockOffset = trueElapsed() - 40;
}
function triggerReplay(){
  sceneClockOffset = trueElapsed();
}
window.addEventListener('keydown', (e)=>{
  if(e.code==='KeyM' && !e.repeat){ toggleMute(); return; }
  if(rotatePromptActive) return;
  lastInputTime = performance.now();
  if(state==='boot'){ triggerBoot(); return; }
  if(e.code==='Enter' || e.code==='Escape' || e.code==='Space' || e.key==='Enter' || e.key==='Escape' || e.key===' '){
    triggerSkip();
  }
});
window.addEventListener('pointerdown', (e)=>{
  if(e.pointerType==='touch') isTouch = true; // confirmed by an actual touch
  const volPoint = screenToLogical(e.clientX, e.clientY);
  if(handleVolumePointerdown(volPoint.x, volPoint.y)) return;
  if(rotatePromptActive) return;
  lastInputTime = performance.now();
  if(state==='boot'){ triggerBoot(); return; }
  triggerSkip();
});
function pollGamepad(){
  if(rotatePromptActive) return;
  if(!navigator.getGamepads) return;
  let pads;
  try{ pads = navigator.getGamepads(); } catch(err){ return; }
  let pressed = false;
  for(const gp of pads){
    if(!gp) continue;
    for(const b of gp.buttons){ if(b && b.pressed){ pressed=true; break; } }
    if(pressed) break;
  }
  if(pressed && !gpPrevPressed){
    lastInputTime = performance.now();
    if(state==='boot') triggerBoot(); else triggerSkip();
  }
  gpPrevPressed = pressed;
}
/* lightweight full-screen "turn your phone" gate, matching the card-overlay
   visual language used elsewhere in the project. Blocks input (see the
   keydown/pointerdown/pollGamepad guards above) until landscape returns. */
function drawRotatePrompt(ctx){
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#000';
  ctx.fillRect(0,0,CW,CH);
  ctx.restore();
  const w = 680, h = 220;
  const x = CW/2-w/2, y = CH/2-h/2;
  ctx.fillStyle = PAL.cream; ctx.fillRect(x-4,y-4,w+8,h+8);
  ctx.fillStyle = '#1a1410'; ctx.fillRect(x,y,w,h);
  drawReadingTextOutlined(ctx, 'ROTATE YOUR PHONE', CW/2, y+56, 26, PAL.gold, PAL.outline, 'center');
  if(Math.floor(performance.now()/500)%2===0){
    drawReadingTextOutlined(ctx, 'TURN TO LANDSCAPE TO PLAY', CW/2, y+140, 16, PAL.cream, '#000000', 'center');
  }
}
function startRecording(){
  try{
    if(!canvas.captureStream || !window.MediaRecorder) return;
    const videoStream = canvas.captureStream(60);
    const tracks = videoStream.getVideoTracks().concat(recordDest.stream.getAudioTracks());
    const combined = new MediaStream(tracks);
    let mime = 'video/webm;codecs=vp9,opus';
    if(!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm;codecs=vp8,opus';
    if(!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm';
    recorder = new MediaRecorder(combined, MediaRecorder.isTypeSupported(mime) ? {mimeType:mime} : undefined);
    recordChunks = [];
    recorder.ondataavailable = (e)=>{ if(e.data && e.data.size>0) recordChunks.push(e.data); };
    recorder.onstop = ()=>{
      const blob = new Blob(recordChunks, {type:'video/webm'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'for-free-intro.webm';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 4000);
    };
    recorder.start();
    isRecording = true;
  } catch(err){ console.error('recording failed', err); }
}
function checkRecordStop(se){
  if(isRecording && se>=44 && recorder && recorder.state==='recording'){
    recorder.stop();
    isRecording = false;
  }
}
function updateAndDrawScene(n, localT, se){
  if(n===1) drawScene1(ctx, localT, se);
  else if(n===2) drawScene2(ctx, localT, se);
  else if(n===3) drawScene3(ctx, localT, se);
  else if(n===4) drawScene4(ctx, localT, se);
  else drawScene5(ctx, localT, se);
}
let rotateFrozenSE = null; // scene-elapsed value captured at the instant the rotate prompt appears
function frame(nowMs){
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (nowMs-lastFrame)/1000);
  lastFrame = nowMs;
  // self-heal a canvas that was sized while the viewport reported 0x0
  if(window.innerWidth > 0 && window.innerHeight > 0 && Math.abs(parseInt(canvas.style.width||'0') - Math.floor(CW*Math.min(window.innerWidth/CW, window.innerHeight/CH))) > 2){
    fitCanvas();
  }
  updateStars(dt);
  if(state==='boot'){ drawBoot(nowMs); drawVolumeUI(ctx); return; }
  // start the real track the moment it finishes decoding (cheap no-op until
  // then, and forever after it starts)
  if(!useMp3Music && bgmBuffer) tryStartMusic();
  rotatePromptActive = isTouch && window.innerHeight > window.innerWidth;
  if(rotatePromptActive){
    // audio-clock-driven timeline can't just "skip an update call" the way
    // the game's frame-accumulated gameT can -- instead hold the scene at
    // whatever se it was at the moment we froze, so it visually stays put
    if(rotateFrozenSE===null) rotateFrozenSE = sceneElapsedNow();
    const se = rotateFrozenSE;
    const n = sceneNumFor(se);
    if(n !== prevSceneNum){ enterScene(n); prevSceneNum = n; }
    const localT = se - sceneLocalStart(n);
    updateAndDrawScene(n, localT, se);
    drawRotatePrompt(ctx);
    drawVolumeUI(ctx);
    if(actx) updateBeatMusic();
    return;
  } else if(rotateFrozenSE!==null){
    // back to landscape -- shift the timeline forward by exactly however
    // long we were frozen, so playback resumes right where it paused
    sceneClockOffset = trueElapsed() - rotateFrozenSE;
    rotateFrozenSE = null;
  }
  pollGamepad();
  const se = sceneElapsedNow();
  const n = sceneNumFor(se);
  if(n !== prevSceneNum){ enterScene(n); prevSceneNum = n; }
  const localT = se - sceneLocalStart(n);
  updateAndDrawScene(n, localT, se);
  drawVolumeUI(ctx);
  if(actx) updateBeatMusic();
  checkRecordStop(se);
  if(n===5 && !RECORD_MODE){
    if(performance.now() - lastInputTime >= 25000){
      triggerReplay();
      lastInputTime = performance.now();
    }
  }
}
requestAnimationFrame(frame);
