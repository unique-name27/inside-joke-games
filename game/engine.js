'use strict';
/* ======================================================================
   KARKS CUB KINGDOM -- playable demo
   Single-file implementation per SPEC-game.md. Shares the palette, pixel
   helpers and audio engine style with intro/index.html (copied + adapted
   here since this is a separate HTML document/AudioContext).
   ====================================================================== */

/* ---------------- shared-engine asset root (see README "How games are
   added") ----------------
   This script is shared verbatim between the top-level game/ demo (this
   repo's own KCK) and every games/<slug>/game/ page, which loads it via a
   relative <script src> pointing back at THIS file (never a per-game copy).
   The engine's own asset references (SFX samples, the dungeon tile sheet --
   NOT CONFIG's, which a per-game config.js writes correctly for its own
   location) need to resolve to this repo's shared assets/ folder regardless
   of how deeply nested the page that loaded this script is. document.
   currentScript is only valid synchronously while this (classic, non-
   deferred) script is first evaluated, so it's captured immediately, into
   the very first statement that needs it -- moved ahead of document.title
   (previously the first line) specifically so the URL-fragment override
   below, which needs ENGINE_ROOT for its default music paths, can run
   before anything else touches CONFIG. */
const ENGINE_ROOT = new URL('../', document.currentScript.src).href;

/* ---------------- URL-fragment CONFIG override (self-serve generator) ----------------
   A `#cfg=<data>` URL fragment lets a game run entirely from a shareable
   link, no games/<slug>/ deployment needed -- see game/cfgcodec.js (loaded
   just before this script, right after config.js) for the codec/schema/
   merge/validation this leans on. CONFIG is declared `const` in config.js,
   which this script can't reassign (separate <script> tags share one
   top-level lexical scope, but the BINDING is still const) -- so instead
   of reassigning CONFIG, its contents are replaced in place, preserving
   the object identity every later `CONFIG.xxx` read already expects.
   Anything invalid, oversized, or simply absent falls back to the page's
   own file CONFIG unchanged (cfgLoadFragmentOverride returns null for
   every one of those cases alike -- see its own doc comment). */
const CFG_FRAGMENT = (typeof cfgLoadFragmentOverride === 'function') ? cfgLoadFragmentOverride(ENGINE_ROOT) : null;
if(CFG_FRAGMENT && CFG_FRAGMENT.config){
  for(const k in CONFIG){ if(Object.prototype.hasOwnProperty.call(CONFIG, k)) delete CONFIG[k]; }
  Object.assign(CONFIG, CFG_FRAGMENT.config);
}

document.title = CONFIG.title.gamePageTitle;

/* ---------------- constants & palette ---------------- */
const CW = 960, CH = 540, TILE = 16;
const PAL = {
  cream:'#f3e9d2', terracotta:'#c96f4a', wood:'#8a5a30',
  night:'#141428', gold:'#e8b84b', outline:'#6b2b1f', ink:'#2a1c12',
  silhouette:'#0a0a14', wall:'#241a22', floor:'#3a2a1c',
  glowHi:'#ffb347', glowLo:'#7a4a1e', heartFull:'#c9394a', heartEmpty:'#3a2a20',
  napkin:'#efe6d0', napkinShade:'#cbbf9e', riesling:'#5a8a3c', rieslingDark:'#3a6024'
};

/* ---------------- CONFIG-derived helpers (Phase B: template extraction) ----------------
   CONFIG comes from config.js (loaded before this script), possibly
   overridden above by a URL fragment. STORAGE_PREFIX keeps different
   games' localStorage keys from colliding when several are hosted under
   the same origin -- a fragment-loaded game has no gameId of its own (the
   fragment schema deliberately doesn't allow setting one), so it derives
   its prefix from a hash of the fragment payload itself instead: the same
   link always reuses the same save slot, and two different links never
   collide. fmt() replaces the two reusable name tokens -- {HOST} and
   {ITEM} -- wherever a config string uses them; every other piece of
   display text in config is already a complete, final sentence (no
   generic templating beyond these two tokens). */
const STORAGE_PREFIX = CFG_FRAGMENT ? ('frag_' + CFG_FRAGMENT.hash) : ((CONFIG && CONFIG.gameId) || 'kck');
function skey(name){ return STORAGE_PREFIX + '_' + name; }
function fmt(s){
  if(typeof s !== 'string') return s;
  let out = s;
  if(CONFIG.host) out = out.split('{HOST}').join(CONFIG.host.name);
  if(CONFIG.savior) out = out.split('{ITEM}').join(CONFIG.savior.itemName);
  return out;
}
function fmtLines(lines){ return lines.map(fmt); }
/* 'full' | 'five_min' -- anything else falls back to 'full' */
const LENGTH_PRESET = (CONFIG.lengthPreset === 'five_min') ? 'five_min' : 'full';
/* role casting -- a role is "cast" when config supplies a non-null entry.
   Every beat built around an optional role checks these (or the derived
   BEATx_ENABLED flags just below) before it's ever entered -- see
   SPEC-game.md's "Template & roles" section for the full degradation map. */
const CAST = CONFIG.cast || {};
const JUDGE_CAST = !!CAST.judge;
const AUTHORITY_CAST = !!CAST.authority;
const SAVIOR_CAST = !!CAST.savior;
const BUTTERFINGERS_CAST = !!CAST.butterfingers;
const BUILDER_CAST = !!CAST.builder;
/* derived beat-enable flags -- each beat only runs if its own role AND every
   narratively-upstream role is also cast (Beat 4 needs the judge defeated
   and revived before Aram's review crisis makes sense; Beat 5 and Epilogue B
   are both the BUILDER's beats so they share one flag). */
const BEAT2_ENABLED = JUDGE_CAST;
const BEAT3_ENABLED = JUDGE_CAST && SAVIOR_CAST;
const BEAT4_ENABLED = JUDGE_CAST && SAVIOR_CAST && AUTHORITY_CAST;
const EPILOGUE_A_ENABLED = BUTTERFINGERS_CAST;
const EPILOGUE_B_ENABLED = BUILDER_CAST; // also gates Beat 5, the same role's finale
/* the degradation map (see SPEC-game.md "Template & roles"): each of these
   is where the game would normally always advance to a fixed next phase --
   now it asks "is that next phase's role actually cast?" and skips straight
   to celebration/freeze if not, so the flow degrades gracefully instead of
   softlocking on a beat with no content. */
function nextAfterDinner(){ return BEAT2_ENABLED ? 'beat2_intro' : 'celebration'; }
function nextAfterBossDeath(){ return BEAT3_ENABLED ? 'beat3_intro' : 'celebration'; }
function nextAfterBeat3(){ return BEAT4_ENABLED ? 'beat4_intro' : 'celebration'; }
function nextAfterCelebration(){ return EPILOGUE_A_ENABLED ? 'epilogueA' : (EPILOGUE_B_ENABLED ? 'epilogueB' : 'freeze'); }
function nextAfterEpilogueA(){ return EPILOGUE_B_ENABLED ? 'epilogueB' : 'freeze'; }
/* cast-slot sprite picks, with KCK's own defaults as the fallback so an
   uncast role's SEAT still shows a generic diner rather than a hole at the
   table -- only that role's dedicated beat is what's actually skipped. */
function castSprite(slot, fallbackCol, fallbackRow){
  const c = CAST[slot];
  return {
    col: (c && c.spriteCol!==undefined) ? c.spriteCol : fallbackCol,
    row: (c && c.spriteRow!==undefined) ? c.spriteRow : fallbackRow,
  };
}

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha:false });

/* DPR-aware backing store: size the canvas's actual pixel buffer to match its
   displayed size in device pixels exactly, so the browser never has to
   resample the canvas itself (that resample, at the non-integer ratios most
   window sizes produce, is what was blurring text). All existing drawing
   code still works in the 960x540 logical space -- one ctx transform maps it
   onto the native-resolution backing store. Setting canvas.width/height
   resets both the transform and imageSmoothingEnabled, so both are
   (re)applied here, every time, after sizing. */
function fitCanvas(){
  // no floor of 1x -- phones are smaller than the 960x540 logical canvas, so
  // it has to be allowed to scale DOWN to fit, not just up. But a hidden or
  // just-restoring tab can report a 0-size viewport; a 0-scale canvas never
  // recovers without a resize event, so fall back to 1x until real
  // dimensions exist (frame() also self-heals, see the main loop).
  const rawScale = Math.min(window.innerWidth / CW, window.innerHeight / CH);
  const cssScale = (isFinite(rawScale) && rawScale > 0.01) ? rawScale : 1;
  const cssW = Math.floor(CW*cssScale), cssH = Math.floor(CH*cssScale);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  // cap the effective DPR at 2 once we're shrinking (cssScale<1) -- a 3x
  // phone at sub-1x CSS scale doesn't need a full 3x backing store, that's
  // pure wasted fill-rate/memory with no visible sharpness benefit
  const dpr = cssScale < 1 ? Math.min(2, window.devicePixelRatio||1) : (window.devicePixelRatio || 1);
  const bw = Math.max(1, Math.round(cssW*dpr));
  const scale = bw / CW;
  const bh = Math.max(1, Math.round(CH*scale));
  canvas.width = bw;
  canvas.height = bh;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', fitCanvas);
window.addEventListener('orientationchange', fitCanvas);
fitCanvas();

/* ---------------- assets (reused from ../intro/assets/) ---------------- */
const imgDungeon = new Image();
imgDungeon.src = ENGINE_ROOT + 'intro/assets/tiny_dungeon.png';
let assetsReady = false;
imgDungeon.onload = ()=>{ assetsReady = true; };
imgDungeon.onerror = ()=>{ assetsReady = true; };

function tileSrcX(col){ return col*TILE; }
function tileSrcY(row){ return row*TILE; }

const tintCache = new Map();
/* NOTE: if img isn't loaded yet, drawImage silently draws nothing -- caching
   that result would permanently freeze a transparent tile even after the
   image finishes loading. Only cache once the source is actually decoded;
   an early call just returns an (uncached, blank-for-now) canvas that gets
   rebuilt correctly on the next call after load. Callers additionally gate
   on `assetsReady` (see drawBaseScene) so this early-blank path is rare. */
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
  if(img.complete && img.naturalWidth>0) tintCache.set(key, off);
  return off;
}
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
function drawTile(ctx, tileCanvas, dx, dy, scale, flipY, flipX){
  ctx.imageSmoothingEnabled = false;
  if(flipY || flipX){
    ctx.save();
    ctx.translate(dx + (flipX?TILE*scale:0), dy + (flipY?TILE*scale:0));
    ctx.scale(flipX?-1:1, flipY?-1:1);
    ctx.drawImage(tileCanvas, 0, 0, TILE*scale, TILE*scale);
    ctx.restore();
  } else {
    ctx.drawImage(tileCanvas, dx, dy, TILE*scale, TILE*scale);
  }
}

/* ---------------- pixel text (half-res upscale trick) ---------------- */
const textCache = new Map();
function pixelText(text, px, color, weight){
  weight = weight || 'bold';
  const key = text+'|'+px+'|'+color+'|'+weight;
  let hit = textCache.get(key);
  if(hit) return hit;
  const half = Math.max(5, Math.round(px/2));
  let tmp = document.createElement('canvas');
  let tctx = tmp.getContext('2d');
  tctx.font = weight+' '+half+'px monospace';
  const m = tctx.measureText(text);
  const w = Math.max(1, Math.ceil(m.width)) + 4;
  const h = half + 8;
  tmp.width = w; tmp.height = h;
  tctx = tmp.getContext('2d');
  tctx.font = weight+' '+half+'px monospace';
  tctx.fillStyle = color;
  tctx.textBaseline = 'top';
  tctx.imageSmoothingEnabled = false;
  tctx.fillText(text, 2, 2);
  const result = { canvas: tmp, w: w*2, h: h*2 };
  textCache.set(key, result);
  return result;
}
function drawPixelText(ctx, text, x, y, px, color, align, weight){
  if(!text) return 0;
  const pt = pixelText(text, px, color, weight);
  let dx = x;
  if(align === 'center') dx = x - pt.w/2;
  else if(align === 'right') dx = x - pt.w;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(pt.canvas, Math.round(dx), Math.round(y), pt.w, pt.h);
  return pt.w;
}
/* ---------------- "reading" text: crisp native fillText, no pixelation ----
   Used for anything meant to be actually READ at a glance -- speech bubbles,
   typewriter narration, tutorial card bodies, hints, critiques/insults,
   end-card stats. The half-res-then-2x pixelation trick above doubles the
   blur once the DPR-aware canvas gets its non-integer CSS display scale
   applied, so this class of text skips that trick entirely and draws
   straight at final size via the browser's own font rasterizer. Chunky
   "display" text (logo, slams, card titles, DUCKED!, TRY AGAIN) keeps using
   drawChunkyText/drawPixelText -- it's large enough to read fine and the
   blocky look is intentional there. */
function readingFont(px){ return 'bold '+px+'px monospace'; }
function measureReadingText(ctx, text, px){
  ctx.save();
  ctx.font = readingFont(px);
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
}
function drawReadingText(ctx, text, x, y, px, color, align){
  if(!text) return 0;
  ctx.save();
  ctx.font = readingFont(px);
  ctx.textBaseline = 'top';
  ctx.textAlign = align || 'left';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
}
/* for reading text laid directly over busy scenery (not on a cream bubble):
   a dark outline keeps it legible against any background. */
function drawReadingTextOutlined(ctx, text, x, y, px, color, outlineColor, align){
  if(!text) return 0;
  ctx.save();
  ctx.font = readingFont(px);
  ctx.textBaseline = 'top';
  ctx.textAlign = align || 'left';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4;
  ctx.strokeStyle = outlineColor;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
}
function drawChunkyText(ctx, text, cx, cy, px, fill, outline, align){
  align = align || 'center';
  const offs = [[-2,0],[2,0],[0,-2],[0,2],[-2,-2],[2,-2],[-2,2],[2,2]];
  for(const [ox,oy] of offs){
    drawPixelText(ctx, text, cx+ox, cy+oy, px, outline, align);
  }
  return drawPixelText(ctx, text, cx, cy, px, fill, align);
}

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

/* ---------------- programmatic props ---------------- */
const TOQUE_ROWS = ['00111100','01111110','01111110','11111111','11111111'];
const TOQUE_COLORS = {'1':'#f5f2ea'};
const TOQUE_BAND_SHADE = '#c9c2b3';
function drawToque(ctx, x, y, cell){
  drawBitmap(ctx, TOQUE_ROWS, TOQUE_COLORS, x, y, cell);
  ctx.fillStyle = TOQUE_BAND_SHADE;
  ctx.fillRect(Math.round(x), Math.round(y+4*cell), 8*cell, cell*0.35);
}
const STEAK_ROWS = ['01111110','12222110','12133210','12222110','01111110'];
const STEAK_COLORS = {'1':'#e79b8c','2':'#f2c9b8','3':'#7a3f2a'};
function drawSteak(ctx, x, y, cell){
  drawBitmap(ctx, STEAK_ROWS, STEAK_COLORS, x, y, cell);
}
/* "laugh chip" meter icon -- gold rounded-square chip with a tiny pixel "HA"
   mark, fill in {0, 0.5, 1}. Kept the function name `drawHeart` and the same
   (ctx,x,y,cell,fill) signature on purpose: every caller (HUD meter, world
   pickups) still passes the exact same half-heart-unit fill math as before --
   this is a pure visual/text retheme, not a logic change. */
const CHIP_ROWS = ['.1111111.','111111111','111111111','111111111','111111111','111111111','111111111','111111111','.1111111.'];
const HA_GLYPH  = ['1.1..1.','1.1.1.1','111.111','1.1.1.1','1.1.1.1'];
function drawHeart(ctx, x, y, cell, fill){
  if(fill<=0){
    drawBitmap(ctx, CHIP_ROWS, {'1':PAL.heartEmpty}, x, y, cell);
    return;
  }
  const baseColor = fill>=1 ? PAL.gold : '#8a7038';
  const glyphColor = fill>=1 ? PAL.outline : '#5c4a26';
  drawBitmap(ctx, CHIP_ROWS, {'1':baseColor}, x, y, cell);
  drawBitmap(ctx, HA_GLYPH, {'1':glyphColor}, x+cell, y+cell*2, cell);
}
/* small green riesling bottle */
const BOTTLE_ROWS = ['.11.','.11.','1111','1111','1111','1111','1111','1111'];
const BOTTLE_COLORS = {'1':PAL.riesling};
function drawBottle(ctx, x, y, cell){
  drawBitmap(ctx, BOTTLE_ROWS, BOTTLE_COLORS, x, y, cell);
  ctx.fillStyle = PAL.rieslingDark;
  ctx.fillRect(Math.round(x+cell), Math.round(y), 2*cell, cell);
  ctx.fillStyle = '#dff0e8';
  ctx.fillRect(Math.round(x+cell), Math.round(y+3*cell), cell, 3*cell); // label glint
}
function drawNapkin(ctx, x, y, r){
  drawPixelCircle(ctx, x, y, r, PAL.napkin, 2);
  drawPixelCircle(ctx, x-1, y+1, Math.max(1,r-2), PAL.napkinShade, 2);
}
/* THE WIDOWMAKER -- a small black widow spider (Beat 3's thrown item):
   black cephalothorax + larger abdomen (two pixel-circles), a red hourglass
   mark on the abdomen, 8 short splayed legs. Built from primitives (not a
   drawBitmap grid) since thin radiating legs don't read well on a blocky
   ASCII grid at this scale. `spin` (radians) rotates the whole sprite for
   the tumbling arc-throw -- a little softening on the rotated pixel edges
   is expected/fine here, same tradeoff already accepted for other rotating
   props in this game. Centered at (x,y). Not config-driven -- the sprite
   itself doesn't change per order, only the item's name/lines do. */
function drawWidowmaker(ctx, x, y, scale, spin){
  ctx.save();
  ctx.translate(x, y);
  if(spin) ctx.rotate(spin);
  ctx.fillStyle = '#0a0a0a';
  const legLen = 5*scale, legW = Math.max(1, 1.4*scale);
  const legAngles = [-2.0,-1.4,1.4,2.0, -0.8,-0.4,0.4,0.8];
  for(const a of legAngles){
    ctx.save();
    ctx.rotate(a);
    ctx.fillRect(-legW/2, -legLen-2*scale, legW, legLen);
    ctx.restore();
  }
  drawPixelCircle(ctx, 0, -2*scale, 2.2*scale, '#0a0a0a', Math.max(1,scale*0.5));
  drawPixelCircle(ctx, 0, 2*scale, 3.4*scale, '#0a0a0a', Math.max(1,scale*0.5));
  ctx.fillStyle = '#c9394a';
  ctx.fillRect(Math.round(-1*scale), Math.round(0.5*scale), Math.round(2*scale), Math.round(1*scale));
  ctx.fillRect(Math.round(-0.5*scale), Math.round(1.5*scale), Math.round(1*scale), Math.round(2.5*scale));
  ctx.restore();
}
function drawShadow(ctx, x, y, r, alpha){
  ctx.save();
  ctx.globalAlpha = (alpha===undefined?0.35:alpha);
  drawPixelCircle(ctx, x, y, r, '#000000', 2);
  ctx.restore();
}

/* ---------------- typewriter ---------------- */
function makeTypewriter(lines, cps, gap){
  cps = cps || 20;
  gap = gap===undefined ? 0.4 : gap;
  const starts = [];
  let acc = 0;
  for(let i=0;i<lines.length;i++){
    starts.push(acc);
    acc += lines[i].length/cps + gap;
  }
  const doneAt = starts[starts.length-1] + lines[lines.length-1].length/cps;
  return {
    lines, starts, cps, doneAt,
    prevRevealed: lines.map(()=>0),
    getState(t){
      const out = [];
      for(let i=0;i<lines.length;i++){
        const rel = t - starts[i];
        let n = 0;
        if(rel > 0) n = Math.min(lines[i].length, Math.floor(rel*cps));
        out.push(n);
      }
      return out;
    },
    // exposes the exact moment typing finishes (see `doneAt` above) so callers
    // can add a genuine post-completion READ HOLD on top, rather than
    // comparing elapsed time to a fixed threshold that can end up smaller
    // than the typing duration itself (which silently produces a ~0s hold --
    // this was the root cause of dialogue feeling like it "advances too fast")
    allDone(t){ return t >= doneAt; }
  };
}
function drawSpeechBubble(ctx, x, y, w, h, growT){
  const gw = Math.max(4,w*growT), gh = Math.max(4,h*growT);
  const by = y + (h-gh);
  ctx.fillStyle = PAL.wood; ctx.fillRect(x-4, by-4, gw+8, gh+8);
  ctx.fillStyle = PAL.cream; ctx.fillRect(x, by, gw, gh);
  ctx.fillStyle = PAL.cream; ctx.fillRect(x+20, by+gh, 14, 10);
  ctx.fillStyle = PAL.wood; ctx.fillRect(x+18, by+gh+10, 18, 4);
}
/* one-line auto-sized bubble anchored above (cx,bottomY), used for the many
   short "over-the-head" lines in the game (prompts, critiques, unison finale).
   Clamped to stay fully on-canvas -- several callers anchor near the right
   wall (boss.x ~900) or top wall, where a wide line at the larger readability-
   pass sizes could otherwise push the box off-screen. The text is drawn
   centered within the (possibly re-centered) box, not at the original cx, so
   it never ends up off-center inside its own bubble. */
function drawAutoBubble(ctx, text, cx, bottomY, px, growT){
  growT = growT===undefined ? 1 : growT;
  const lines = Array.isArray(text) ? text : [text]; // array = pre-wrapped multi-line
  const pad = 10, margin = 6, lineH = Math.round(px*1.35);
  let maxW = 0;
  for(const l of lines) maxW = Math.max(maxW, measureReadingText(ctx, l, px));
  const w = maxW + pad*2, h = lineH*lines.length + pad*2;
  const x = Math.max(margin, Math.min(CW-w-margin, cx-w/2));
  const y = Math.max(margin, Math.min(CH-h-margin, bottomY-h));
  drawSpeechBubble(ctx, x, y, w, h, growT);
  if(growT >= 0.99){
    for(let i=0;i<lines.length;i++){
      drawReadingText(ctx, lines[i], x+w/2, y+pad+i*lineH, px, '#000000', 'center');
    }
  }
}

/* ======================================================================
   AUDIO ENGINE -- real Kenney CC0 samples (one-shot SFX + a per-beat music
   loop score) over WebAudio, loaded through a generalized buffer-bank
   loader (fetch+decodeAudioData, the same proven pattern the theme.mp3
   track already used -- see assets/audio/CREDITS.txt for the source list).
   The Karplus-Strong jaw-harp "twang" stays fully synthesized below -- it's
   a signature sound, not a placeholder. Speech synthesis is untouched.
   ====================================================================== */
const BEAT_DEFAULT = 60/112;
let actx = null, masterGain = null, compressor = null, musicGain = null, fxGain = null, loopGain = null;
let noiseBuffer = null;

/* ---------------- master volume ----------------
   0..1, multiplied into masterGain (masterGain.gain = 0.8 * volumeSetting)
   so every existing gain-staging/ducking downstream of it is untouched --
   this just scales the final output. Persisted so the choice carries
   between the intro and the game and across visits. */
function loadVolumeSetting(){
  try{
    if(!window.localStorage) return 0.25;
    const raw = localStorage.getItem(skey('volume'));
    if(raw===null) return 0.25;
    const v = parseFloat(raw);
    if(!isFinite(v) || v<0 || v>1) return 0.25;
    if(v===0.55 || v===1) return 0.25; // legacy louder-scale values from older builds remap to the new MED
    return v;
  }catch(e){ return 0.25; }
}
function saveVolumeSetting(v){
  try{ if(window.localStorage) localStorage.setItem(skey('volume'), String(v)); }catch(e){}
}
let volumeSetting = loadVolumeSetting();
let volumeBeforeMute = volumeSetting>0 ? volumeSetting : 0.25;
/* ramps into masterGain over ~80ms to avoid clicks; `immediate` skips the
   ramp (used once at initAudio() time, where there's nothing to click from) */
function applyMasterVolume(immediate){
  if(!actx || !masterGain) return;
  const target = 0.8 * volumeSetting;
  const now = actx.currentTime;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(masterGain.gain.value, now);
  if(immediate) masterGain.gain.setValueAtTime(target, now);
  else masterGain.gain.linearRampToValueAtTime(target, now+0.08);
}
function setVolumeSetting(v){
  volumeSetting = Math.max(0, Math.min(1, v));
  saveVolumeSetting(volumeSetting);
  applyMasterVolume(false);
}

function initAudio(){
  if(actx) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  actx = new Ctx();
  noiseBuffer = actx.createBuffer(1, actx.sampleRate*2, actx.sampleRate);
  const nd = noiseBuffer.getChannelData(0);
  for(let i=0;i<nd.length;i++) nd[i] = (Math.random()*2-1);
  compressor = actx.createDynamicsCompressor();
  masterGain = actx.createGain(); masterGain.gain.value = 0.8 * volumeSetting;
  compressor.connect(masterGain);
  masterGain.connect(actx.destination);
  musicGain = actx.createGain(); musicGain.gain.value = 1.0;
  musicGain.connect(compressor);
  fxGain = actx.createGain(); fxGain.gain.value = 1.0;
  fxGain.connect(compressor);
  // the per-beat loop score is a quiet understudy while USE_CUSTOM_SONG's
  // track is still downloading -- same cover-while-downloading role the old
  // chiptune understudy played -- and is silenced entirely once the real
  // track is confirmed playing (see updateBeatMusic()). Games that don't
  // configure a custom song (USE_CUSTOM_SONG=false) run the loops at full
  // level instead, since they ARE the score in that case.
  loopGain = actx.createGain(); loopGain.gain.value = USE_CUSTOM_SONG ? 0.3 : 1.0;
  loopGain.connect(musicGain);
  // decode whatever's already finished fetching (started at page load,
  // well before this first-gesture call in the overwhelming majority of
  // real sessions); tryDecode() is a safe no-op for anything not fetched yet
  tryDecodeAllSamples();
  tryDecodeAllLoops();
}

/* ---------------- background music track (theme.mp3) ----------------
   FULLY BUFFERED playback: fetch the file (starts immediately at page load,
   no gesture needed for a fetch), decode it with decodeAudioData once the
   AudioContext exists, then loop an AudioBufferSourceNode through musicGain.
   This avoids the <audio>+createMediaElementSource path entirely, which is
   flaky on iOS Safari (sometimes plays silently or never starts). All the
   ducking calls (setMusicLevel/duckDown/duckUp) work unchanged since the
   buffer routes through the same musicGain. The per-beat loop score keeps
   running underneath as a QUIET understudy (see loopGain) and is silenced
   the moment the real track starts -- see updateBeatMusic(). Direct one-off
   SFX are unaffected either way. */
/* CONFIG.music.customSongPath: null for a config with no uploaded song (the
   loops below become the actual score, played at full level, with no mp3 to
   ever wait for). Karks Cub Kingdom ships with its own song and keeps it. */
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
    .catch(()=>{ bgmFetchState = 'failed'; }); // the loop score (quiet) carries the whole session
}
function tryDecodeMusic(){
  if(!actx || !bgmRawBytes || bgmFetchState !== 'fetched') return;
  bgmFetchState = 'decoding';
  const bytes = bgmRawBytes; bgmRawBytes = null;
  try{
    // callback form (not promise) for older Safari compatibility
    actx.decodeAudioData(bytes,
      (decoded)=>{ bgmBuffer = decoded; bgmFetchState = 'ready'; tryStartMusic(); },
      ()=>{ bgmFetchState = 'failed'; });
  } catch(err){ bgmFetchState = 'failed'; }
}
function tryStartMusic(){
  if(useMp3Music || !actx || !bgmBuffer) return;
  if(actx.state !== 'running') return; // retried after every gesture/resume
  try{
    bgmSourceNode = actx.createBufferSource();
    bgmSourceNode.buffer = bgmBuffer;
    bgmSourceNode.loop = true;
    bgmSourceNode.connect(musicGain);
    bgmSourceNode.start();
    useMp3Music = true; // the beat loop is faded out and stopped from this instant (see updateBeatMusic)
  } catch(err){ /* the loop score keeps covering */ }
}
if(USE_CUSTOM_SONG) prefetchMusic(); // kick the download off immediately -- it needs no gesture

/* ---------------- generalized sample buffer bank ----------------
   Fetches every SFX + music-loop file immediately at page load (fetch needs
   no user gesture); once the AudioContext exists (first user gesture),
   decodes whatever's already arrived and anything that finishes later.
   Same proven fetch+decodeAudioData pattern as the theme.mp3 loader above,
   generalized to a keyed bank. A 404 or decode failure just leaves that key
   silent forever (playSample()/startLoopNow() no-op) -- no thrown errors. */
function makeBufferBank(defs){
  const bank = {};
  for(const key in defs) bank[key] = { state:'idle', rawBytes:null, buffer:null };
  function prefetch(key){
    const rec = bank[key];
    if(rec.state!=='idle') return;
    rec.state = 'loading';
    fetch(defs[key].src)
      .then(r=>{ if(!r.ok) throw new Error('http '+r.status); return r.arrayBuffer(); })
      .then(bytes=>{ rec.rawBytes = bytes; rec.state = 'fetched'; tryDecode(key); })
      .catch(()=>{ rec.state = 'failed'; });
  }
  function tryDecode(key){
    const rec = bank[key];
    if(!actx || !rec.rawBytes || rec.state!=='fetched') return;
    rec.state = 'decoding';
    const bytes = rec.rawBytes; rec.rawBytes = null;
    try{
      actx.decodeAudioData(bytes, (decoded)=>{ rec.buffer=decoded; rec.state='ready'; }, ()=>{ rec.state='failed'; });
    }catch(e){ rec.state = 'failed'; }
  }
  function prefetchAll(){ for(const key in defs) prefetch(key); }
  function tryDecodeAll(){ for(const key in defs) tryDecode(key); }
  return { bank, prefetchAll, tryDecodeAll };
}

/* ---- one-shot SFX (real samples, routed into fxGain like the old synth
   one-shots were; gain values tuned to roughly match their old synthesized
   loudness) ---- */
const SFX_DEFS = {
  ding:          { src:ENGINE_ROOT+'assets/audio/sfx/confirmation_001.ogg',     gain:0.7 },
  pickupChime:   { src:ENGINE_ROOT+'assets/audio/sfx/confirmation_004.ogg',     gain:0.7 },
  recordScratch: { src:ENGINE_ROOT+'assets/audio/sfx/scratch_002.ogg',          gain:0.8 },
  groan:         { src:ENGINE_ROOT+'assets/audio/sfx/error_003.ogg',            gain:0.6 },
  drainBlip:     { src:ENGINE_ROOT+'assets/audio/sfx/close_002.ogg',            gain:0.4 },
  sadGliss:      { src:ENGINE_ROOT+'assets/audio/sfx/minimize_006.ogg',         gain:0.6 },
  keyBlip:       { src:ENGINE_ROOT+'assets/audio/sfx/tick_001.ogg',             gain:0.5 },
  softChime:     { src:ENGINE_ROOT+'assets/audio/sfx/select_006.ogg',           gain:0.6 },
  slamBoom:      { src:ENGINE_ROOT+'assets/audio/sfx/impactWood_heavy_002.ogg', gain:0.9 },
  glassShatter:  { src:ENGINE_ROOT+'assets/audio/sfx/impactGlass_heavy_001.ogg',gain:0.8 },
  thud:          { src:ENGINE_ROOT+'assets/audio/sfx/impactSoft_medium_002.ogg',gain:0.8 },
  whoosh:        { src:ENGINE_ROOT+'assets/audio/sfx/woosh3.ogg',               gain:0.6 },
  rumble:        { src:ENGINE_ROOT+'assets/audio/sfx/stoneDrag2.ogg',           gain:0.7 },
  fanfare:       { src:ENGINE_ROOT+'assets/audio/sfx/jingles-hit_10.ogg',       gain:0.8 },
  jingleStart:   { src:ENGINE_ROOT+'assets/audio/sfx/jingles-hit_03.ogg',       gain:0.8 },
  haBlip:        { src:ENGINE_ROOT+'assets/audio/sfx/jingles-hit_02.ogg',       gain:0.6 },
};
const sfxLoader = makeBufferBank(SFX_DEFS);
function tryDecodeAllSamples(){ sfxLoader.tryDecodeAll(); }
sfxLoader.prefetchAll(); // kick off immediately -- no gesture needed for fetch
function playSample(key, t, gainMul){
  const rec = sfxLoader.bank[key];
  if(!actx || !rec || rec.state!=='ready' || !rec.buffer) return;
  const src = actx.createBufferSource();
  src.buffer = rec.buffer;
  const g = actx.createGain();
  g.gain.value = (SFX_DEFS[key].gain!==undefined?SFX_DEFS[key].gain:1) * (gainMul===undefined?1:gainMul);
  src.connect(g); g.connect(fxGain);
  src.start(t===undefined?actx.currentTime:t);
}

/* ---- per-beat music loops (the fallback/quiet-understudy score; a config's
   own custom song always wins while USE_CUSTOM_SONG is true -- see
   updateBeatMusic()). Paths come from CONFIG.music.loops; KCK's final picks
   are documented in assets/audio/CREDITS.txt. */
const MUSIC_LOOP_DEFS = {};
for(const key in CONFIG.music.loops) MUSIC_LOOP_DEFS[key] = { src: CONFIG.music.loops[key] };
const loopLoader = makeBufferBank(MUSIC_LOOP_DEFS);
function tryDecodeAllLoops(){ loopLoader.tryDecodeAll(); }
loopLoader.prefetchAll();

let currentLoopKey = null, currentLoopSource = null, currentLoopNodeGain = null;
let pendingLoopKey = 'dinner';
const LOOP_CROSSFADE = 0.4; // ~400ms clean crossfade on beat changes, per spec
function startLoopNow(key){
  const rec = loopLoader.bank[key];
  if(!actx || !rec || rec.state!=='ready' || !rec.buffer) return; // retried every frame by updateBeatMusic
  const now = actx.currentTime;
  if(currentLoopSource){
    const oldGain = currentLoopNodeGain, oldSrc = currentLoopSource;
    oldGain.gain.cancelScheduledValues(now);
    oldGain.gain.setValueAtTime(oldGain.gain.value, now);
    oldGain.gain.linearRampToValueAtTime(0, now+LOOP_CROSSFADE);
    oldSrc.stop(now+LOOP_CROSSFADE+0.05);
  }
  const src = actx.createBufferSource();
  src.buffer = rec.buffer; src.loop = true;
  const g = actx.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(1, now+LOOP_CROSSFADE);
  src.connect(g); g.connect(loopGain);
  src.start(now);
  currentLoopSource = src; currentLoopNodeGain = g; currentLoopKey = key;
}
function stopLoopNow(){
  if(!actx || !currentLoopSource){ currentLoopKey = null; return; }
  const now = actx.currentTime;
  const oldGain = currentLoopNodeGain, oldSrc = currentLoopSource;
  oldGain.gain.cancelScheduledValues(now);
  oldGain.gain.setValueAtTime(oldGain.gain.value, now);
  oldGain.gain.linearRampToValueAtTime(0, now+LOOP_CROSSFADE);
  oldSrc.stop(now+LOOP_CROSSFADE+0.05);
  currentLoopSource = null; currentLoopNodeGain = null; currentLoopKey = null;
}
/* sets the DESIRED beat-loop key; the actual crossfaded start happens lazily
   from updateBeatMusic() (called every frame from frame()) once the
   AudioContext exists and -- if USE_CUSTOM_SONG -- the grace window has
   lapsed or the custom track is already known to have failed. Same "quiet
   understudy" gating the old chiptune scheduler applied per-note, applied
   here once per loop start instead. */
function setBeatMusic(key){ pendingLoopKey = key; }
function updateBeatMusic(){
  if(!actx) return;
  if(USE_CUSTOM_SONG && useMp3Music){
    if(currentLoopKey) stopLoopNow();
    return;
  }
  if(USE_CUSTOM_SONG && bgmFetchState!=='failed' && performance.now() < bgmGraceUntil) return; // still covering silently
  if(currentLoopKey !== pendingLoopKey) startLoopNow(pendingLoopKey);
}

/* ---- Karplus-Strong jaw-harp twang -- the one synthesized voice that
   stays, by request; it's a signature sound, not a placeholder ---- */
function playTwang(t, gainMul){
  gainMul = gainMul===undefined ? 1 : gainMul;
  const dur = 1.1;
  const burst = actx.createBufferSource(); burst.buffer = noiseBuffer;
  const burstGain = actx.createGain();
  burstGain.gain.setValueAtTime(1, t);
  burstGain.gain.setValueAtTime(0, t+0.006);
  const loopSum = actx.createGain(); loopSum.gain.value = 1;
  const delay = actx.createDelay(1.0); delay.delayTime.value = 1/73.42;
  const lpf = actx.createBiquadFilter(); lpf.type='lowpass'; lpf.frequency.value=4200; lpf.Q.value=0.5;
  const comp = actx.createGain(); comp.gain.value = 0.83;
  const fb = actx.createGain(); fb.gain.value = 0.985;
  loopSum.connect(delay); delay.connect(lpf); lpf.connect(comp); comp.connect(fb); fb.connect(loopSum);
  burst.connect(burstGain); burstGain.connect(loopSum);
  const tap = actx.createGain(); tap.gain.value = 6.0;
  comp.connect(tap);
  const formant = actx.createBiquadFilter(); formant.type='bandpass'; formant.Q.value=6;
  formant.frequency.setValueAtTime(400, t);
  formant.frequency.linearRampToValueAtTime(1600, t+0.3);
  const out = actx.createGain();
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(0.5*gainMul, t+0.01);
  out.gain.linearRampToValueAtTime(0, t+dur);
  tap.connect(formant); formant.connect(out); out.connect(fxGain);
  burst.start(t); burst.stop(t+dur+0.1);
}
function playBeep(t){
  // typewriter beep removed by request -- the per-character chirp read as "loud beeping"
}
function playDing(t){ playSample('ding', t); }
function playSlamBoom(t){ playSample('slamBoom', t); }
function playFanfare(t){
  playSample('fanfare', t);
  playTwang(t+1.2, 0.9); // tail twang, ~ where the old melodic run landed its last note
}
/* fake-death "victory" jingle -- cut off by the record scratch before it resolves */
function playJingleStart(t){ playSample('jingleStart', t); }
/* DJ-style record scratch -- the fake-death gag */
function playRecordScratch(t){ playSample('recordScratch', t); }
function playGlassShatter(t){ playSample('glassShatter', t); }
function playThud(t){ playSample('thud', t); }
/* early-punchline penalty ("jumped the punchline") */
function playGroan(t){ playSample('groan', t); }
/* the boss dodging a throw */
function playWhoosh(t){ playSample('whoosh', t); }
function playPickupChime(t){ playSample('pickupChime', t); }
/* layered on top of the pickup chime for "laugh captured" / review given */
function playHaBlip(t){ playSample('haBlip', t); }
/* quiet, low -- one laugh-meter half-heart lost to the drain clock.
   Deliberately soft (see SFX_DEFS gain) so it reads as "a little air going
   out of the room," not an alarm. */
function playDrainBlip(t){ playSample('drainBlip', t); }
/* Epilogue A's "deleted all my photos" reaction beat */
function playSadGliss(t){ playSample('sadGliss', t); }
/* typing at the desk in Epilogue B */
function playKeyBlip(t){ playSample('keyBlip', t); }
/* each of the 4 phone-share pings in Epilogue B */
function playSoftChime(t){ playSample('softChime', t); }
/* the critic's transformation moment */
function playRumble(t){ playSample('rumble', t); }
function duckDown(t, target){
  const g = musicGain.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(target===undefined?0.02:target, t+0.08);
}
function duckUp(t, level){
  level = level===undefined ? 1.0 : level;
  const g = musicGain.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(level, t+0.3);
}
function setMusicLevel(level, t, rampTime){
  const g = musicGain.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(level, t+(rampTime===undefined?1.0:rampTime));
}

/* ======================================================================
   ARENA -- one room, the dinner party (coordinates snapped to an 8px grid)
   ====================================================================== */
const WALL_TOP = 80, WALL_SIDE = 48;
const LEFT_DOOR = {x:0, y:248, w:WALL_SIDE, h:104};
const TABLE = {x:336, y:248, w:288, h:120};
const BOSS_DOOR = {x:848, y:280, w:104, h:128};
/* bathroom door, top wall (Epilogue A) -- same dark-gap-plus-wood-frame
   language as LEFT_DOOR, just cut into the top wall instead of the side one */
const BATHROOM_DOOR = {x:700, y:0, w:56, h:WALL_TOP};
/* kitchen doorway: a low wall stub along the bottom-right edge with a dark
   gap cut into it (the player spawns just in front of the gap), and a
   subtle warm light pool spilling from the gap onto the floor. */
const KITCHEN_DOOR = {x:760, y:500, w:152, h:40, gapX:800, gapW:80};
const KITCHEN_GLOW = {x:840, y:508, r:200};
const PLAYER_SPAWN = {x:840, y:472};
/* on open floor below-right of the table (not inside its solid rect), so the
   player can actually stand within pickup radius of it -- the old spot
   {480,262} was 14px inside TABLE, which collision keeps the player out of,
   so distance-to-pickup could never drop below the old 20px radius. */
const BOTTLE_SPAWN = {x:660, y:396};

function drawArena(ctx){
  // floor everywhere first
  for(let x=0;x<CW;x+=64){
    for(let y=0;y<CH;y+=64){
      drawTile(ctx, tintedSprite(imgDungeon,1,3,PAL.floor), x, y, 4, false);
    }
  }
  // floor seams
  ctx.fillStyle = '#241a10';
  for(let x=0;x<=CW;x+=64){ ctx.fillRect(x,0,2,CH); }
  for(let y=0;y<=CH;y+=64){ ctx.fillRect(0,y,CW,2); }
  ctx.fillStyle = '#4a3624';
  for(let x=32;x<CW;x+=64){ ctx.fillRect(x,0,1,CH); }

  // top wall
  for(let x=0;x<CW;x+=64){
    drawTile(ctx, tintedSprite(imgDungeon,0,0,PAL.wall), x, 0, 4, false);
  }
  ctx.fillStyle = PAL.wall;
  ctx.fillRect(0,0,CW,WALL_TOP);
  // bathroom door cut into the top wall (Epilogue A)
  ctx.fillStyle = '#120c14';
  ctx.fillRect(BATHROOM_DOOR.x, BATHROOM_DOOR.y, BATHROOM_DOOR.w, BATHROOM_DOOR.h);
  ctx.fillStyle = PAL.wood;
  ctx.fillRect(BATHROOM_DOOR.x-6, BATHROOM_DOOR.y, 6, BATHROOM_DOOR.h);
  ctx.fillRect(BATHROOM_DOOR.x+BATHROOM_DOOR.w, BATHROOM_DOOR.y, 6, BATHROOM_DOOR.h);
  ctx.fillRect(BATHROOM_DOOR.x-6, BATHROOM_DOOR.h, BATHROOM_DOOR.w+12, 6);

  // left wall with the main door cut into it
  ctx.fillRect(0,0,WALL_SIDE,CH);
  ctx.fillStyle = '#120c14';
  ctx.fillRect(LEFT_DOOR.x, LEFT_DOOR.y, LEFT_DOOR.w, LEFT_DOOR.h);
  ctx.fillStyle = PAL.wood;
  ctx.fillRect(LEFT_DOOR.x, LEFT_DOOR.y-6, LEFT_DOOR.w+6, 6);
  ctx.fillRect(LEFT_DOOR.x, LEFT_DOOR.y, 6, LEFT_DOOR.h);
  ctx.fillRect(LEFT_DOOR.x, LEFT_DOOR.y+LEFT_DOOR.h, LEFT_DOOR.w+6, 6);

  // right wall (the boss door pops into existence against this later)
  ctx.fillStyle = PAL.wall;
  ctx.fillRect(CW-WALL_SIDE,0,WALL_SIDE,CH);

  // kitchen doorway: low wall stub + dark gap, bottom-right, where the player
  // spawns. The light pool is low-alpha stepped bands (like the intro's item-
  // get spotlight) so it reads as a spill of light, not a solid glow blob --
  // floor tiles/seams stay visible through it.
  ctx.fillStyle = PAL.wall;
  ctx.fillRect(KITCHEN_DOOR.x, KITCHEN_DOOR.y, KITCHEN_DOOR.w, KITCHEN_DOOR.h);
  const bands = [[200,0.05],[150,0.08],[100,0.12],[60,0.16]];
  for(const [r,a] of bands){
    ctx.save(); ctx.globalAlpha = a;
    drawPixelCircle(ctx, KITCHEN_GLOW.x, KITCHEN_GLOW.y, r, PAL.glowHi, 8);
    ctx.restore();
  }
  ctx.fillStyle = '#120c14';
  ctx.fillRect(KITCHEN_DOOR.gapX, KITCHEN_DOOR.y, KITCHEN_DOOR.gapW, KITCHEN_DOOR.h);
  ctx.fillStyle = PAL.wood;
  ctx.fillRect(KITCHEN_DOOR.gapX-4, KITCHEN_DOOR.y, 4, KITCHEN_DOOR.h);
  ctx.fillRect(KITCHEN_DOOR.gapX+KITCHEN_DOOR.gapW, KITCHEN_DOOR.y, 4, KITCHEN_DOOR.h);
}

function drawTableAndProps(ctx){
  ctx.fillStyle = PAL.wood; ctx.fillRect(TABLE.x, TABLE.y, TABLE.w, TABLE.h);
  ctx.fillStyle = PAL.terracotta; ctx.fillRect(TABLE.x+4, TABLE.y+4, TABLE.w-8, TABLE.h-8);
  drawPixelCircle(ctx, 400, 272, 10, PAL.cream, 2);
  drawPixelCircle(ctx, 560, 272, 10, PAL.cream, 2);
  drawPixelCircle(ctx, 400, 332, 10, PAL.cream, 2);
  drawPixelCircle(ctx, 560, 332, 10, PAL.cream, 2);
  [460,500].forEach(gx=>{
    ctx.fillStyle = '#7a1f2a'; ctx.fillRect(gx-6,286,12,10);
    ctx.fillStyle = PAL.wood; ctx.fillRect(gx-1,296,2,10); ctx.fillRect(gx-5,306,10,3);
  });
}

/* the 4 seated diners -- same picks/positions as the intro's dinner vignette.
   Index CRITIC_INDEX is the one who later stands up and becomes the boss;
   once he starts walking (diners[CRITIC_INDEX].walking) his seat renders empty. */
const CRITIC_INDEX = 1;
/* seat 0 has no dedicated role (just a fourth friend); seat 1 is the JUDGE's
   seat before he stands up; seat 2/3 are BUTTERFINGERS/BUILDER. Sprite picks
   come from CONFIG.cast, falling back to KCK's own tiles so an uncast role's
   seat still shows a generic diner instead of a gap at the table. */
const DINER_DEFS = [
  Object.assign(castSprite('diner0', 1,7), {x:400,y:248, flip:false}),
  Object.assign(castSprite('judge', 4,8),  {x:560,y:248, flip:false}),
  Object.assign(castSprite('butterfingers', 3,8), {x:400,y:432, flip:true}),
  Object.assign(castSprite('builder', 2,8), {x:560,y:432, flip:true}),
];
function drawDinerSprite(ctx, col, row, x, y, flip, scale){
  scale = scale===undefined ? 4 : scale;
  drawTile(ctx, rawTile(imgDungeon,col,row), x-TILE*scale/2, y-TILE*scale, scale, flip);
}
function drawSeatedDiners(ctx, diners){
  for(let i=0;i<diners.length;i++){
    const d = diners[i];
    if(d.walking || d.retired) continue;
    drawDinerSprite(ctx, d.col, d.row, d.x, d.y, d.flip);
  }
}

/* ---------------- chef (player) ---------------- */
function drawChef(ctx, x, y, facing, bobT){
  const bob = Math.sin(bobT*10) * (bobT>0?1:0);
  const flipY = facing==='up';
  const flipX = facing==='left';
  drawTile(ctx, rawTile(imgDungeon,2,7), x-32, y-64+bob, 4, flipY, flipX);
  drawToque(ctx, x-16, y-74+bob, 4);
}
/* held out at his side, in addition to the HUD corner icon -- obvious at a
   glance that he's armed. Same bob formula as drawChef so it moves with him. */
function drawHeldBottle(ctx, x, y, facing, bobT){
  const bob = Math.sin(bobT*10) * (bobT>0?1:0);
  const side = facing==='left' ? -1 : 1;
  const hx = x + side*20, hy = y - 30 + bob;
  drawBottle(ctx, hx-6, hy-16, 3);
}

/* ---------------- the critic (boss) ---------------- */
function drawBossDoorFrame(ctx, popT){
  popT = popT===undefined ? 1 : popT;
  const w = BOSS_DOOR.w*popT, h = BOSS_DOOR.h*popT;
  const x = BOSS_DOOR.x + (BOSS_DOOR.w-w)/2, y = BOSS_DOOR.y + (BOSS_DOOR.h-h)/2;
  ctx.fillStyle = PAL.wood;
  ctx.fillRect(x-8, y-8, w+16, h+16);
  ctx.fillStyle = '#120c14';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PAL.wood;
  ctx.fillRect(x+6, y+h*0.5-2, w-12, 4);
}
function drawBossSagged(ctx, alpha){
  // the door "sags shut" after the real death -- drawn as a shrinking, fading frame
  ctx.save();
  ctx.globalAlpha = alpha;
  drawBossDoorFrame(ctx, 1);
  ctx.restore();
}
let criticSpriteCache = null, criticSpritePhase2Cache = null;
function buildCriticSprite(tintRGBA){
  // darker clothing palette via a source-atop tint on an ISOLATED offscreen
  // canvas (containing only the sprite, nothing else) -- source-atop on the
  // shared main canvas would also darken whatever scenery happens to sit
  // under the fillRect, so it has to be composited in isolation first.
  const off = document.createElement('canvas');
  off.width = 16; off.height = 16;
  const o = off.getContext('2d');
  o.imageSmoothingEnabled = false;
  o.drawImage(rawTile(imgDungeon,4,8), 0, 0, 16, 16);
  o.globalCompositeOperation = 'source-atop';
  o.fillStyle = tintRGBA;
  o.fillRect(0, 0, 16, 16);
  return off;
}
function getCriticSprite(phase2){
  // lazily built -- safe to cache unconditionally because every call site
  // already gates drawCritic behind assetsReady, so imgDungeon is loaded.
  if(phase2){
    if(!criticSpritePhase2Cache) criticSpritePhase2Cache = buildCriticSprite('rgba(50,10,16,0.5)');
    return criticSpritePhase2Cache;
  }
  if(!criticSpriteCache) criticSpriteCache = buildCriticSprite('rgba(18,14,26,0.45)');
  return criticSpriteCache;
}
function drawCriticAura(ctx, cx, topY, size, phase2, t){
  const speed = phase2 ? 5 : 3;
  const pulse = 0.5 + 0.5*Math.sin(t*speed);
  const r = size*0.5 + pulse*10;
  ctx.save();
  ctx.globalAlpha = 0.08 + pulse*0.10;
  drawPixelCircle(ctx, cx, topY+size*0.5, r, phase2?'#8c141e':'#140a1e', 4);
  ctx.restore();
}
function drawGlassesGlint(ctx, cx, topY, size, phase2, t){
  const cyc = ((t%2.5)+2.5)%2.5;
  if(cyc < 0.15){
    drawSparkle(ctx, cx, topY+size*0.3, 3, 1, phase2?'#ff4a4a':'#ffffff');
  }
}
/* looms out of the doorframe at ~1.8x (phase 2: ~2.1x) the seated-diner
   scale, darker palette, pulsing aura, periodic glasses glint. `growT` (0..1)
   interpolates from normal (1x) size up to targetScale for the 0.6s
   transformation beat; afterward growT is always 1 so effScale===targetScale.
   Bottom-anchored (feet stay at x,y) so he grows upward out of the frame
   rather than growing from its center. Presentation only -- boss.x/y and
   every gameplay computation that reads them are untouched. */
function drawCritic(ctx, x, y, poseT, slumped, growT, targetScale, phase2){
  growT = growT===undefined ? 1 : growT;
  targetScale = targetScale===undefined ? 1.8 : targetScale;
  const effScale = lerp(1, targetScale, growT);
  const size = 64*effScale;
  const bob = slumped ? 0 : Math.sin(poseT*3)*1.5;
  const drawY = slumped ? -size*0.75 : -size;
  ctx.save();
  ctx.translate(x, y+bob);
  ctx.imageSmoothingEnabled = false;
  drawCriticAura(ctx, 0, drawY, size, phase2, poseT);
  ctx.drawImage(getCriticSprite(phase2), -size/2, drawY, size, size);
  drawGlassesGlint(ctx, 0, drawY, size, phase2, poseT);
  ctx.restore();
}
function drawWoman(ctx, x, y, walkT, flip){
  const bob = Math.sin(walkT*8)*1.5;
  drawTile(ctx, rawTile(imgDungeon,3,8), x-32, y-64+bob, 4, false, !!flip);
}

/* ---------------- Aram, the chef's boss (Beat 4) ----------------
   Same isolated-offscreen tint trick as the critic (buildCriticSprite),
   reusing the chef's own base sprite tile so there's no risk of picking an
   unintended tile from the sheet -- just a darker, angrier recolor at ~2x
   diner scale. A second warm/no-brows tint covers the "turned good" beat. */
let aramSpriteCache = null, aramGoodSpriteCache = null;
function buildAramSprite(tintRGBA){
  const off = document.createElement('canvas');
  off.width = 16; off.height = 16;
  const o = off.getContext('2d');
  o.imageSmoothingEnabled = false;
  o.drawImage(rawTile(imgDungeon,2,7), 0, 0, 16, 16);
  o.globalCompositeOperation = 'source-atop';
  o.fillStyle = tintRGBA;
  o.fillRect(0, 0, 16, 16);
  return off;
}
function getAramSprite(good){
  if(good){
    if(!aramGoodSpriteCache) aramGoodSpriteCache = buildAramSprite('rgba(196,120,40,0.5)');
    return aramGoodSpriteCache;
  }
  if(!aramSpriteCache) aramSpriteCache = buildAramSprite('rgba(120,18,18,0.55)');
  return aramSpriteCache;
}
const ARAM_SIZE = 128; // ~2x diner scale (diner draw is TILE*4 = 64px)
function drawAram(ctx, x, y, poseT, walkT, good){
  const bob = Math.sin(walkT*8)*1.5;
  const size = ARAM_SIZE;
  ctx.save();
  ctx.translate(x, y+bob);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(getAramSprite(good), -size/2, -size, size, size);
  if(!good){
    // simple hand-drawn angry brows -- two dark angled bars over the upper face
    ctx.fillStyle = '#1a0a0a';
    for(const side of [-1,1]){
      ctx.save();
      ctx.translate(side*size*0.18, -size*0.74);
      ctx.rotate(side*0.35);
      ctx.fillRect(-size*0.12, 0, size*0.24, size*0.045);
      ctx.restore();
    }
  }
  ctx.restore();
}
const STAR_ROWS = ['..1..','.111.','11111','.111.','1.1.1'];
function drawStarIcon(ctx, x, y, filled, cell){
  cell = cell || 4;
  drawBitmap(ctx, STAR_ROWS, {'1': filled?PAL.gold:PAL.heartEmpty}, x, y, cell);
}

/* ---------------- hand-built pixel title font (5x7 grid) ----------------
   Ported from intro/index.html (same file has its own copy -- separate
   documents/scripts, can't literally share the canvas object) so Epilogue
   B's "tiny screen" shot can render a miniature KARKS CUB KINGDOM lockup. */
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
  o.fillStyle = 'rgba(20,10,6,0.55)';
  forEach((gx,gy)=> o.fillRect((gx+1)*cell, (gy+1)*cell, cell, cell));
  o.fillStyle = PAL.outline;
  const offs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
  forEach((gx,gy)=>{ for(const [dx,dy] of offs) o.fillRect((gx+dx)*cell, (gy+dy)*cell, cell, cell); });
  o.fillStyle = PAL.gold;
  forEach((gx,gy)=> o.fillRect(gx*cell, gy*cell, cell, cell));
  return off;
}
let miniTitleCanvasCache = null;
function getMiniTitleCanvas(){
  if(!miniTitleCanvasCache) miniTitleCanvasCache = buildTitleCanvas(CONFIG.title.lockupLines, 2);
  return miniTitleCanvasCache;
}

/* speech synthesis -- feature-detected, silent fallback per spec */
let speechWorked = null;
function speakLine(text, rate, pitch){
  // speechSynthesis doesn't route through WebAudio/masterGain at all -- mute
  // means mute, so skip speaking entirely rather than speak silently
  if(volumeSetting<=0) return false;
  if(!('speechSynthesis' in window)){ if(speechWorked===null) speechWorked=false; return false; }
  try{
    const voices = window.speechSynthesis.getVoices();
    if(!voices || voices.length===0){ if(speechWorked===null) speechWorked=false; return false; }
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate; u.pitch = pitch; u.voice = voices[0]; u.volume = volumeSetting;
    window.speechSynthesis.speak(u);
    speechWorked = true;
    return true;
  }catch(e){ if(speechWorked===null) speechWorked=false; return false; }
}
function speakForFree(){ speakLine(CONFIG.punchline, 0.85, 0.7); }
function speakCritique(text){ if(speechWorked===true) speakLine(text, 1.0, 0.6); }

/* ======================================================================
   COLLISION (8px-grid-aligned solids) + PLAYER MOVEMENT
   ====================================================================== */
function rectsOverlap(ax,ay,aw,ah,bx,by,bw,bh){
  return ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by;
}
function arenaSolids(diners){
  const solids = [
    {x:0,y:0,w:CW,h:WALL_TOP},
    {x:0,y:WALL_TOP,w:WALL_SIDE,h:LEFT_DOOR.y-WALL_TOP},
    {x:0,y:LEFT_DOOR.y+LEFT_DOOR.h,w:WALL_SIDE,h:CH-(LEFT_DOOR.y+LEFT_DOOR.h)},
    {x:CW-WALL_SIDE,y:WALL_TOP,w:WALL_SIDE,h:CH-WALL_TOP},
    {x:TABLE.x,y:TABLE.y,w:TABLE.w,h:TABLE.h}
  ];
  if(diners){
    for(const d of diners){
      if(d.walking || d.retired) continue;
      solids.push({x:d.x-16,y:d.y-16,w:32,h:32});
    }
  }
  return solids;
}
function moveAndCollide(entity, dx, dy, solids, r){
  r = r===undefined ? 14 : r;
  entity.x += dx;
  for(const s of solids){
    if(rectsOverlap(entity.x-r,entity.y-r,r*2,r*2,s.x,s.y,s.w,s.h)){ entity.x -= dx; break; }
  }
  entity.y += dy;
  for(const s of solids){
    if(rectsOverlap(entity.x-r,entity.y-r,r*2,r*2,s.x,s.y,s.w,s.h)){ entity.y -= dy; break; }
  }
  entity.x = Math.max(r, Math.min(CW-r, entity.x));
  entity.y = Math.max(r, Math.min(CH-r, entity.y));
}

/* ======================================================================
   PROJECTILES -- napkins (boss) and riesling bottles (player), both lobbed
   arcs: constant horizontal velocity + a parabolic height (z) that lands
   exactly on target at t=duration. The ground-shadow is drawn at the fixed
   TARGET point for the whole flight, which is the "telegraph" the spec asks
   for -- the player can read the landing spot the instant it's thrown.
   ====================================================================== */
const GRAVITY = 900;
let napkins = [], bottles = [], particles = [], heartPickups = [];

function spawnNapkin(fromX, fromY, toX, toY, duration){
  const vz = 0.5*GRAVITY*duration;
  napkins.push({
    x:fromX, y:fromY, vx:(toX-fromX)/duration, vy:(toY-fromY)/duration,
    z:0, vz, t:0, duration, targetX:toX, targetY:toY, landed:false, landT:0, big:false
  });
}
function updateNapkins(dt, gameT){
  for(const n of napkins){
    if(n.landed) continue;
    n.t += dt;
    n.x += n.vx*dt; n.y += n.vy*dt;
    n.z = n.vz*n.t - 0.5*GRAVITY*n.t*n.t;
    if(n.t >= n.duration){
      n.landed = true; n.landAt = gameT;
      for(let i=0;i<8;i++){
        const ang = Math.random()*Math.PI*2;
        particles.push({type:'splash', x:n.targetX, y:n.targetY, vx:Math.cos(ang)*70, vy:Math.sin(ang)*70-30, born:gameT, life:0.4, color:PAL.napkin});
      }
    }
  }
  napkins = napkins.filter(n=> !n.landed || (gameT-n.landAt)<0.3);
}
function drawNapkins(ctx){
  for(const n of napkins){
    if(n.landed) continue;
    drawShadow(ctx, n.targetX, n.targetY, n.big?9:6, 0.3);
    drawNapkin(ctx, n.x, n.y-n.z, n.big?7:5);
  }
}

function spawnBottleThrow(fromX, fromY, toX, toY, duration){
  const vz = 0.5*GRAVITY*duration;
  bottles.push({
    x:fromX, y:fromY, vx:(toX-fromX)/duration, vy:(toY-fromY)/duration,
    z:0, vz, t:0, duration, targetX:toX, targetY:toY, landed:false, landAt:0, thrown:true
  });
}
function updateBottles(dt, gameT){
  for(const b of bottles){
    if(!b.thrown || b.landed) continue;
    b.t += dt;
    b.x += b.vx*dt; b.y += b.vy*dt;
    b.z = b.vz*b.t - 0.5*GRAVITY*b.t*b.t;
    if(b.t >= b.duration){ b.landed = true; b.landAt = gameT; }
  }
  bottles = bottles.filter(b=> !b.landed || (gameT-b.landAt)<0.3);
}
function drawBottles(ctx){
  for(const b of bottles){
    if(b.landed) continue;
    drawShadow(ctx, b.targetX, b.targetY, 6, 0.3);
    drawBottle(ctx, b.x-6, b.y-b.z-16, 3);
  }
}
/* attention cue for the table-edge pickup: a slow alpha pulse plus a small
   periodic sparkle overhead, so it doesn't just blend into the table. */
function drawBottlePickupCue(ctx, gameT){
  const pulse = 0.75 + 0.25*Math.sin(gameT*3);
  ctx.save(); ctx.globalAlpha = pulse;
  drawBottle(ctx, bottlePickup.x-6, bottlePickup.y-16, 3);
  ctx.restore();
  const cyc = gameT % 1.6;
  if(cyc < 0.5){
    drawSparkle(ctx, bottlePickup.x, bottlePickup.y-26, sparkleFrameSize(gameT,0.5), 0.9, PAL.gold);
  }
}

/* ---------------- heart pickups (the post-punchline scatter) ----------------
   Tokens are lobbed on a napkin-style z-arc from the table center out to a
   pre-vetted floor point beyond the table's edge, rather than sliding on flat
   2D friction -- the old friction model only ever traveled ~10-35px before
   settling (well short of the table's ~144px half-width), so tokens routinely
   came to rest ON the (solid) table where the player could never reach them.
   Every landing spot is checked against isOnReachableFloor before it's ever
   assigned, AND re-checked (with a guaranteed slide-out) the instant a token
   settles -- belt and suspenders, so no token can ever end its life on the
   table, inside a wall, or within ~24px of one. */
function pointInRect(x,y,r){ return x>=r.x && x<=r.x+r.w && y>=r.y && y<=r.y+r.h; }
function isOnReachableFloor(x, y){
  if(x < WALL_SIDE+24 || x > CW-WALL_SIDE-24) return false;
  if(y < WALL_TOP+24 || y > CH-24) return false;
  if(pointInRect(x,y,TABLE)) return false;
  return true;
}
/* nudge a point that failed isOnReachableFloor back onto valid floor -- pushed
   out through the nearest table edge (if inside it), then clamped to the
   wall-margin bounds */
function slideToOpenFloor(x, y){
  if(pointInRect(x,y,TABLE)){
    const left = x-TABLE.x, right = (TABLE.x+TABLE.w)-x, top = y-TABLE.y, bottom = (TABLE.y+TABLE.h)-y;
    const m = Math.min(left,right,top,bottom);
    if(m===left) x = TABLE.x-20;
    else if(m===right) x = TABLE.x+TABLE.w+20;
    else if(m===top) y = TABLE.y-20;
    else y = TABLE.y+TABLE.h+20;
  }
  x = Math.max(WALL_SIDE+26, Math.min(CW-WALL_SIDE-26, x));
  y = Math.max(WALL_TOP+26, Math.min(CH-26, y));
  return {x,y};
}
/* random point on open floor around (cx,cy), well beyond the table's own
   footprint, re-rolled until it clears isOnReachableFloor (falls back to a
   guaranteed slide-out if every roll fails) */
function pickHeartLandingSpot(cx, cy){
  for(let tries=0; tries<12; tries++){
    const ang = Math.random()*Math.PI*2;
    const r = 90 + Math.random()*170; // beyond TABLE's ~144px half-width
    const x = cx + Math.cos(ang)*r, y = cy + Math.sin(ang)*r;
    if(isOnReachableFloor(x,y)) return {x,y};
  }
  return slideToOpenFloor(cx, cy);
}
function spawnHeartBurst(n, cx, cy, gameT){
  for(let i=0;i<n;i++){
    const target = pickHeartLandingSpot(cx, cy);
    const duration = 0.45 + Math.random()*0.25;
    heartPickups.push({
      x:cx, y:cy, fromX:cx, fromY:cy, targetX:target.x, targetY:target.y,
      t:0, duration, z:0, vz:0.5*GRAVITY*duration,
      settled:false, born:gameT, life:D('heartLife'), collected:false, blinkT:Math.random()*Math.PI*2
    });
  }
}
/* full-heal chip dropped in place at the boss's real death -- an instant
   (near-zero-duration) "arc" so it uses the same settle/guarantee code path
   as the scattered tokens above without visibly moving from its drop point */
function spawnBigHeart(cx, cy, gameT){
  heartPickups.push({
    x:cx, y:cy, fromX:cx, fromY:cy, targetX:cx, targetY:cy,
    t:0, duration:0.01, z:0, vz:0,
    settled:false, born:gameT, life:9999, collected:false, blinkT:0, big:true
  });
}
function updateHeartPickups(dt, gameT, player, stats){
  for(const h of heartPickups){
    if(h.collected) continue;
    if(!h.settled){
      h.t += dt;
      const p = Math.min(1, h.t/h.duration);
      h.x = h.fromX + (h.targetX-h.fromX)*p;
      h.y = h.fromY + (h.targetY-h.fromY)*p;
      h.z = h.vz*h.t - 0.5*GRAVITY*h.t*h.t;
      if(h.t >= h.duration){
        h.settled = true; h.z = 0;
        h.x = h.targetX; h.y = h.targetY;
        if(!isOnReachableFloor(h.x, h.y)){
          const safe = slideToOpenFloor(h.x, h.y);
          h.x = safe.x; h.y = safe.y;
        }
      }
    }
    h.blinkT += dt*4;
    const d = Math.hypot(player.x-h.x, player.y-h.y);
    if(d < 20){
      h.collected = true;
      player.hearts = Math.min(player.maxHearts, player.hearts+1);
      stats.heartsCaptured++;
      if(actx){ playPickupChime(actx.currentTime); playHaBlip(actx.currentTime+0.1); }
    }
  }
  heartPickups = heartPickups.filter(h=> !h.collected && (gameT-h.born)<h.life);
}
function drawHeartPickups(ctx, gameT){
  for(const h of heartPickups){
    if(h.collected) continue;
    const age = gameT-h.born;
    const blinking = age > 4.0 && !h.big; // start blinking in the last 2s before despawn (the big heal chip never despawns)
    const visible = !blinking || (Math.floor(h.blinkT*2)%2===0);
    if(!visible) continue;
    const drawY = h.y - (h.z||0);
    if(!h.settled) drawShadow(ctx, h.x, h.y, h.big?9:6, 0.25);
    if(h.big){
      const cell = 4.6;
      drawBitmap(ctx, CHIP_ROWS, {'1':PAL.gold}, h.x-4.5*cell, drawY-4.5*cell, cell);
      drawPixelText(ctx, 'HA HA!', h.x, drawY-9, 13, PAL.outline, 'center');
    } else {
      drawHeart(ctx, h.x-4.5*2.5, drawY-4.5*2.5, 2.5, 1);
    }
  }
}

/* ---------------- particles: HA-HA bursts, sparkles, splashes, glass shards ---------------- */
function spawnHaBurst(cx, cy, gameT){
  for(let i=0;i<10;i++){
    particles.push({type:'ha', x:cx+(Math.random()*160-80), y:cy+Math.random()*40, vy:-(30+Math.random()*30), born:gameT, life:1.8});
  }
}
function spawnSparkleBurst(cx, cy, n, gameT){
  for(let i=0;i<n;i++){
    const ang = (i/n)*Math.PI*2;
    particles.push({type:'sparkle', x:cx, y:cy, vx:Math.cos(ang)*40, vy:Math.sin(ang)*40, born:gameT, life:0.7});
  }
}
function spawnGlassShards(cx, cy, gameT){
  for(let i=0;i<10;i++){
    const ang = Math.random()*Math.PI*2;
    particles.push({type:'shard', x:cx, y:cy, vx:Math.cos(ang)*(60+Math.random()*90), vy:Math.sin(ang)*(60+Math.random()*90)-40, born:gameT, life:0.5});
  }
}
/* Beat 4: a completed review -- 5 small gold stars rising/fading in a staggered row */
function spawnStarRow(cx, cy, gameT){
  for(let i=0;i<5;i++){
    particles.push({type:'starrow', x:cx+(i-2)*14, y:cy, vy:-30-Math.random()*10, born:gameT+i*0.05, life:1.0});
  }
}
function updateAndDrawParticles(ctx, dt, gameT){
  for(const p of particles){
    const age = gameT-p.born;
    if(age > p.life) continue;
    const a = 1-age/p.life;
    if(p.type==='ha'){
      const py = p.y + (p.vy||0)*age;
      ctx.save(); ctx.globalAlpha=a;
      drawPixelText(ctx, 'HA', p.x, py, 13, PAL.cream, 'center');
      ctx.restore();
    } else if(p.type==='sparkle'){
      const px=p.x+p.vx*age, py=p.y+p.vy*age;
      drawSparkle(ctx, px, py, sparkleFrameSize(age,0.3), a, PAL.gold);
    } else if(p.type==='splash'){
      const px=p.x+p.vx*age, py=p.y+p.vy*age+120*age*age;
      ctx.save(); ctx.globalAlpha=a; ctx.fillStyle=p.color||PAL.napkin;
      ctx.fillRect(Math.round(px-1),Math.round(py-1),3,3);
      ctx.restore();
    } else if(p.type==='shard'){
      const px=p.x+p.vx*age, py=p.y+p.vy*age+260*age*age;
      ctx.save(); ctx.globalAlpha=a; ctx.fillStyle='#dff0e8';
      ctx.fillRect(Math.round(px-1),Math.round(py-1),2,2);
      ctx.restore();
    } else if(p.type==='starrow'){
      if(age<0) continue; // staggered born time -- not risen yet
      const py = p.y + (p.vy||0)*age;
      ctx.save(); ctx.globalAlpha=a;
      drawStarIcon(ctx, p.x-10, py-10, true, 4);
      ctx.restore();
    }
  }
  particles = particles.filter(p=> (gameT-p.born) <= p.life);
}

/* ======================================================================
   GAME STATE
   ====================================================================== */
function lerp(a,b,t){ return a+(b-a)*t; }
function clamp01(t){ return Math.max(0, Math.min(1, t)); }
function easeInOut(t){ t = clamp01(t); return t*t*(3-2*t); }

/* length-preset round count: 'five_min' plays only the first 2 configured
   stories, 'full' plays every one CONFIG.stories supplies (KCK: 3) */
function roundsCount(){ return LENGTH_PRESET==='five_min' ? Math.min(2, CONFIG.stories.length) : CONFIG.stories.length; }
const ROUNDS = CONFIG.stories.slice(0, roundsCount()).map(r=>({ lines: fmtLines(r.lines) }));
/* each entry is a pre-wrapped 1-2 line bubble (array-of-arrays so a long line
   like the baseball callback can wrap without any runtime text-measuring) */
const CRITIQUE_LINES = (JUDGE_CAST ? CONFIG.judge.critiqueLines : []).map(fmtLines);
/* the CRITIC's throw-reaction insults, aimed at the host -- he snarks whether
   he ducks the bottle or eats it. Cycled in order. */
const CRITIC_DUCK_LINES = JUDGE_CAST ? fmtLines(CONFIG.judge.duckLines) : [];
const CRITIC_HIT_LINES = JUDGE_CAST ? fmtLines(CONFIG.judge.hitLines) : [];
let criticDuckIndex = 0, criticHitIndex = 0;
let playerBubble = null; // {text, born} -- small bubble over the chef's head

let player = { x:PLAYER_SPAWN.x, y:PLAYER_SPAWN.y, facing:'down', walkAnimT:0, hearts:6, maxHearts:12, hasBottle:false, iframes:0, canMove:true, vx:0, vy:0 };
let diners = DINER_DEFS.map(d=>({...d, walking:false, retired:false, bounceT:0, shakeT:0}));
let boss = {
  visible:false, state:'hidden', hp:6, maxHp:6, x:900, y:350, doorPopT:0,
  napkinTimer:1.4, critiqueTimer:6, duckT:0, bubble:null, recoilT:0,
  fakeDeathDone:false, phase2:false, fdT:0, walkX:560, walkY:248, deadT:0,
  transforming:false, transformT:0.6, targetScale:1.8,
  // Beat 3's Widowmaker beat -- the reverse of the transforming/transformT
  // grow-up, shrinking him back down to normal diner size before he walks
  // back to his seat. state becomes 'restored' (not 'revived') once this
  // finishes -- see beat3_windowmaker.
  shrinking:false, shrinkT:0
};
let woman = { x:24, y:300, active:false, arrived:false };
/* Aram (Beat 4) -- the chef's boss. state: 'idle' | 'walkin' | 'chase' | 'frozen'.
   Reuses the same "reused fields on a shared entity" convention as everything
   else here (x/y drive both movement and drawing). */
let aram = { active:false, x:24, y:300, state:'idle', turnedGood:false, contactCooldown:0, facing:'right', walkAnimT:0 };
let stats = { heartsCaptured:0, hitsTaken:0, bottlesLanded:0, tooSoon:0, reviews:0, resets:0 };
let bottlePickup = { x:BOTTLE_SPAWN.x, y:BOTTLE_SPAWN.y, active:true, respawnAt:0 };
let lastTooSoonAt = -999;
/* ---------------- read-time holds ----------------
   How long a finished line of dialogue/a bubble sits on screen before the
   game advances or clears it -- bumped up substantially (per user feedback:
   text was advancing before a relaxed reader could finish it). Typing SPEED
   itself is unchanged everywhere; only these post-completion holds grew. */
const TOO_SOON_HOLD = 1.4;       // "HE WASN'T DONE." reaction bubble (was 0.8)
const PLAYER_BUBBLE_HOLD = 2.0;  // chef's own insult/beg bubble (was 1.2)
const CRITIQUE_BUBBLE_HOLD = 3.8; // critic's critique bubble (was 2.2)
const GAMEOVER_HOLD = 2.7;       // gameover bubble before the retry card (was 1.6)
const DIALOGUE_GAP = 0.9;        // pause between two sequential staged bubble lines
const DIALOGUE_HOLD = 1.7;       // pause after the LAST staged line before the beat advances
const BEAT3_WALK_DUR = 3.5;      // the woman's walk-in (was 2.2s)
const BEAT3_LINE1_HOLD = 2.2;    // hold on "EXCUSE ME..."
const BEAT3_LINE2_HOLD = 2.4;    // hold on "I BROUGHT THE WAGYU."
const BEAT3_LINE3_HOLD = 2.6;    // hold on the sincere line (now beat3_tribute)
/* the Widowmaker beat -- inserted between the critic's revival spring-up
   (beat3_revive) and the woman's tribute line (beat3_tribute). Only ever
   reached when BEAT3_ENABLED (JUDGE_CAST && SAVIOR_CAST), so CONFIG.judge
   is guaranteed to exist by the time these are actually read -- still
   guarded by JUDGE_CAST here (not read unconditionally at module-eval
   time) plus a `||` fallback per field, matching this file's established
   "never crash on an uncast role's missing content bucket" convention. */
const WIDOWMAKER_MOCK_LINES = JUDGE_CAST ? fmtLines(CONFIG.judge.mockLine || ['I LIVE.', '...NICE SEARS SHIRT.']) : ['I LIVE.', '...NICE SEARS SHIRT.'];
const WIDOWMAKER_RETORT_LINE = JUDGE_CAST ? fmt(CONFIG.judge.retortLine || 'IT IS FROM SEARS.') : 'IT IS FROM SEARS.';
const WIDOWMAKER_ITEM_LABEL = JUDGE_CAST ? fmt(CONFIG.judge.itemLabel || 'THE WIDOWMAKER!') : 'THE WIDOWMAKER!';
const WIDOWMAKER_REDEMPTION_LINE = JUDGE_CAST ? fmt(CONFIG.judge.redemptionLine || 'THE SOUP IS ACTUALLY FINE.') : 'THE SOUP IS ACTUALLY FINE.';
const WIDOWMAKER_MOCK1_HOLD = 0.9;       // hold on the first mock line
const WIDOWMAKER_MOCK2_HOLD = 1.3;       // hold on the second mock line -- the beat before the retort
const WIDOWMAKER_RETORT_HOLD = 0.6;      // hold on the retort before the throw
const WIDOWMAKER_THROW_DUR = 0.7;        // the spider's flight time
const WIDOWMAKER_SHRINK_DUR = 0.6;       // mirrors the 0.6s grow-up transform, reversed
const WIDOWMAKER_WALK_DUR = 1.3;         // walk back to his seat
const WIDOWMAKER_REDEMPTION_HOLD = 1.0;  // hold on the redemption line
/* which "you lost" flavor to show on the gameover/retry screens -- set at each
   trigger site right before enterPhase('gameover') */
let gameOverReason = 'boss';

/* ======================================================================
   HARD MODE -- "SECOND SEATING" (unlockable after any win)
   `hardMode` is decided once at the mode-select card (see modeSelectPending
   below) and never changes mid-run. Every difficulty-sensitive constant
   resolves through D(key) rather than being a bare literal, so normal mode
   is guaranteed byte-identical to its old behavior: every 'normal' value
   below is exactly the literal it replaces.
   ====================================================================== */
let hardMode = false;
const DIFF = {
  maxHearts:          { normal:12,   hard:8 },
  storyCps:           { normal:20,   hard:26 },   // ~30% faster typing
  perfectWindow:       { normal:1.2,  hard:0.6 },
  tooSoonDamage:       { normal:1,    hard:2 },    // half-heart-units
  heartBurstMul:       { normal:1.0,  hard:0.6 },  // ~40% fewer laugh tokens
  heartLife:           { normal:6.0,  hard:4.0 },
  bossMaxHp:           { normal:6,    hard:8 },
  bossPhase2Hp:        { normal:4,    hard:6 },
  napkinInterval:      { normal:1.4,  hard:1.0 },
  napkinIntervalP2:    { normal:0.9,  hard:0.65 },
  volleyCount:         { normal:3,    hard:4 },
  volleyCountP2:       { normal:5,    hard:6 },
  napkinDamage:        { normal:1,    hard:2 },
  duckChance:          { normal:0.25, hard:0.35 },
  leadTimeMul:         { normal:1.0,  hard:1.3 },
  aramSpeedMul:        { normal:0.8,  hard:0.95 },
  aramContactDamage:   { normal:1,    hard:2 },
  reviewsNeeded:       { normal:3,    hard:4 },
  begDuration:         { normal:1.2,  hard:1.8 },
  reviewerFleeSpeed:   { normal:130,  hard:170 },
  reviewerFleeRadius:  { normal:120,  hard:160 },
  laughDrainInterval:  { normal:4.5,  hard:2.75 }, // seconds per half-heart lost during Beat 1
  techFleeSpeed:       { normal:140,  hard:185 },  // Beat 5 (tech support) flee speed
  resetsNeeded:        { normal:4,    hard:5 }     // Beat 5 catches needed to resolve -- 'full' preset only, see LENGTH_DIFF
};
/* the three knobs the 'five_min' length preset explicitly tunes (round count
   and epilogue-hold scaling are handled separately, via roundsCount()/EP()
   below). 'full' values are exactly DIFF's own normal/hard above -- kept
   duplicated rather than aliased so this table reads standalone. Five_min's
   hard-mode numbers aren't spelled out by spec; they're derived by applying
   the same normal->hard delta 'full' mode uses (documented judgment call,
   since unlocking hard mode is a KCK-specific meta-progression feature that
   could in principle be reached from a five_min preset too). */
const LENGTH_DIFF = {
  bossMaxHp:    { full:{normal:6, hard:8}, five_min:{normal:4, hard:6} },
  bossPhase2Hp: { full:{normal:4, hard:6}, five_min:{normal:3, hard:5} },
  resetsNeeded: { full:{normal:4, hard:5}, five_min:{normal:3, hard:4} },
};
function D(key){
  if(LENGTH_DIFF[key]) return LENGTH_DIFF[key][LENGTH_PRESET][hardMode ? 'hard' : 'normal'];
  return DIFF[key][hardMode ? 'hard' : 'normal'];
}
/* epilogue timing scaler -- 'five_min' runs Epilogue A/B holds at ~70% of
   their 'full' duration ("shortened epilogue holds"); everything else
   (Beats 1-4 pacing, laugh drain, napkin timing, etc.) is preset-invariant
   by design -- five_min is about trip length (fewer rounds, less boss HP,
   a tighter epilogue), not moment-to-moment difficulty. */
function EP(seconds){ return LENGTH_PRESET==='five_min' ? seconds*0.7 : seconds; }

/* ---------------- Beat 1 laugh drain (time pressure) ----------------
   While the player dawdles in any Beat 1 phase, the laugh meter ticks down
   on a steady clock -- the room's laughter cools if nobody's landing a
   punchline. Only active during 'story'/'prompt'/'capture'/'breather'; the
   timer only advances inside update(dt), which frame() already skips
   entirely while a card/mode-select/rotate-prompt has the game frozen, so
   the drain pauses there for free with no extra guarding needed. */
const BEAT1_PHASES = new Set(['story','prompt','capture','breather']);
let laughDrainTimer = 0;
function updateLaughDrain(dt){
  if(!BEAT1_PHASES.has(phase)) return;
  laughDrainTimer += dt;
  const interval = D('laughDrainInterval');
  while(laughDrainTimer >= interval){
    laughDrainTimer -= interval;
    applyLaughDrainTick();
  }
}
function applyLaughDrainTick(){
  if(player.hearts<=0) return; // already dead/dying -- don't pile on
  player.hearts = Math.max(0, player.hearts-1);
  spawnDrainPuff();
  if(actx) playDrainBlip(actx.currentTime);
  if(player.hearts<=0){
    gameOverReason = 'beat1';
    enterPhase('gameover');
  }
}
/* the specific HUD chip-slot the NEXT drain tick will hit -- the last chip
   with any fill left in it */
function drainTargetSlot(){
  if(player.hearts<=0) return -1;
  return Math.floor((player.hearts-1)/2);
}
/* fade + urgency pulse for that slot, 0 (just ticked) .. 1 (about to tick) */
function drainPulseAlpha(progress, t){
  const fade = 1 - progress*0.35;
  const urgentPulse = progress>0.6 ? (0.7 + 0.3*Math.sin(t*10)) : 1;
  return fade*urgentPulse;
}
/* small grey "ha" puffs drifting off the meter, one per lost half -- a
   dedicated screen-space particle list (not the world-space `particles`
   array) since the HUD isn't affected by the screen-shake translate */
let drainPuffs = [];
function spawnDrainPuff(){
  const slot = drainTargetSlot();
  const x = 16+Math.max(0,slot)*28+13, y = 16+13;
  drainPuffs.push({x, y, vy:-16, born:gameT, life:1.1});
}
function updateAndDrawDrainPuffs(ctx){
  for(const p of drainPuffs){
    const age = gameT-p.born;
    if(age<0 || age>p.life) continue;
    const a = 1-age/p.life;
    const py = p.y + p.vy*age;
    ctx.save(); ctx.globalAlpha = a*0.85;
    drawReadingText(ctx, 'ha', p.x, py, 12, '#8a8a8a', 'center');
    ctx.restore();
  }
  drainPuffs = drainPuffs.filter(p=> (gameT-p.born) <= p.life);
}

/* mode-select card (shown at boot only if the player has beaten the game
   before) + localStorage flags, all feature-detected/try-caught since
   localStorage can throw (private browsing, disabled storage, etc.) */
let modeSelectPending = false;
let modeSelectIndex = 0; // 0 = FIRST SEATING (normal), 1 = SECOND SEATING (hard)
let hasBeatenBefore = false, hardCleared = false;
try{ hasBeatenBefore = window.localStorage && localStorage.getItem(skey('beaten'))==='1'; }catch(e){}
try{ hardCleared = window.localStorage && localStorage.getItem(skey('hard_cleared'))==='1'; }catch(e){}
function setLocalFlag(key){ try{ if(window.localStorage) localStorage.setItem(key,'1'); }catch(e){} }
function confirmModeSelect(){
  hardMode = (modeSelectIndex===1);
  if(hardMode){
    player.maxHearts = D('maxHearts');
    // the very first enterPhase('story') call (at script load, before this
    // choice existed) built its typewriter at normal-mode cps -- rebuild it
    // now that hardMode is actually known. Safe/lossless: update()/gameT
    // were frozen the whole time the mode-select card was up.
    enterPhase('story');
  }
  modeSelectPending = false;
  applyStartParam();
}

let gameT = 0;
let phase = 'story';
let phaseData = {};
let phaseElapsed = 0;
let roundIndex = 0;
let screenShakeUntil = 0, screenShakeMag = 0;
let flashAlpha = 0;

/* start-of-play controls hint: visible until the player has both moved and
   pressed action at least once (or 10s, whichever first), then fades 0.5s. */
const CONTROLS_HINT_TEXT_KB = 'ARROWS/WASD: MOVE   SPACE: SAY IT / THROW';
const CONTROLS_HINT_TEXT_TOUCH = 'DRAG LEFT SIDE -- MOVE      TAP RIGHT SIDE -- SAY IT / THROW';
function controlsHintText(){ return isTouch ? CONTROLS_HINT_TEXT_TOUCH : CONTROLS_HINT_TEXT_KB; }
let hasMovedOnce = false, hasActionedOnce = false;
let controlsHintAlpha = 1;

/* ---------------- mobile / touch ---------------- */
// initial hint from feature detection; confirmed (and locked in) the moment
// a real touch pointerdown fires -- see the pointerdown listener below
let isTouch = ('ontouchstart' in window);
let rotatePromptActive = false;

function updateTypewriterAudio(tw, t, onLineDone){
  const state = tw.getState(t);
  for(let i=0;i<tw.lines.length;i++){
    const prev = tw.prevRevealed[i];
    const now = state[i];
    if(now > prev){
      for(let k=prev+1;k<=now;k++){ if(k%2===0 && actx) playBeep(actx.currentTime+0.001); }
      if(now === tw.lines[i].length && prev < tw.lines[i].length){
        if(actx) playDing(actx.currentTime+0.001);
        if(onLineDone) onLineDone(i);
      }
    }
    tw.prevRevealed[i] = now;
  }
  return state;
}
function triggerShake(mag, dur){ screenShakeUntil = gameT+dur; screenShakeMag = mag; }

function enterPhase(name){
  const prevData = phaseData;
  phase = name; phaseElapsed = 0; phaseData = {};
  if(name==='story'){
    phaseData.tw = makeTypewriter(ROUNDS[roundIndex].lines, D('storyCps'), 0.4);
    // typing runs on its own clock (typeT), separate from phaseElapsed, so an
    // early-punchline penalty can pause it (see triggerTooSoon) without
    // disturbing anything else that might read phaseElapsed.
    phaseData.typeT = 0;
    phaseData.pauseUntil = -1;
    phaseData.tooSoonPopAt = null;
    phaseData.tooSoonBubbleAt = null;
  } else if(name==='prompt'){
    // keep the finished story typewriter around so the bubble (fully typed,
    // static) can still be drawn behind the bouncing "!" prompt
    phaseData.promptStart = gameT;
    phaseData.tw = prevData.tw;
  } else if(name==='breather'){
    // nothing
  } else if(name==='beat2_intro'){
    diners[CRITIC_INDEX].bubbleText = CONFIG.dismissiveLine;
    diners[CRITIC_INDEX].bubbleShownAt = gameT;
  } else if(name==='boss'){
    boss.visible = true; boss.state='active'; boss.hp=D('bossMaxHp'); boss.maxHp=D('bossMaxHp');
    boss.napkinTimer=D('napkinInterval'); boss.critiqueTimer=6; boss.phase2=false;
    boss.x = BOSS_DOOR.x+BOSS_DOOR.w/2; boss.y = BOSS_DOOR.y+BOSS_DOOR.h*0.6;
    boss.transforming = false; boss.transformT = 0.6; boss.targetScale = 1.8;
    bottlePickup.active = true;
    setBeatMusic('boss');
    maybeShowCard('boss'); // "right after the door pop, before his first attack"
  } else if(name==='beat3_intro'){
    player.canMove = false;
    woman.active = true; woman.x = 24; woman.y = LEFT_DOOR.y+LEFT_DOOR.h/2;
    phaseData.stage = 0;
  } else if(name==='beat3_revive'){
    // he was left in 'dead' state after the real kill (drawBaseScene gates
    // drawCritic behind state!=='dead') -- clear it here so he actually
    // renders again. 'revived' (not 'active') on purpose: 'active'/
    // 'phase2active' are what bossIsFighting() and the HP-bar HUD check
    // for, and neither should come back once he's out of the fight for
    // good. Just the spring-up + a beat to let it land -- the Widowmaker
    // beat (beat3_windowmaker) follows immediately, then the woman's
    // tribute line (beat3_tribute).
    boss.state = 'revived';
    spawnSparkleBurst(boss.x, boss.y, 14, gameT);
    phaseData.stage = 0;
    // soft (not silent) under the critic's mock lines and the woman's
    // sincere line -- beat3_silence deepens this further into the true
    // silence beat that follows
    if(actx) duckDown(actx.currentTime, 0.35);
  } else if(name==='beat3_windowmaker'){
    // THE WIDOWMAKER: still-giant critic immediately resumes being a
    // critic (mocks diner0's shirt) -- diner0 retorts and throws THE
    // WIDOWMAKER at him -- impact shatters the wall door and shrinks him
    // back down to size -- he walks back to his own seat and sits, one of
    // the 4 friends again. Stages: 0/1 the critic's two mock bubbles, 2
    // diner0's retort, 3 the throw, 4 impact+shrink, 5 walk back to seat,
    // 6 seated redemption bubble -> enterPhase('beat3_tribute').
    phaseData.stage = 0;
    phaseData.bubbleTw = makeTypewriter([WIDOWMAKER_MOCK_LINES[0]], 15, 0.4);
    phaseData.bubbleStart = 0;
  } else if(name==='beat3_tribute'){
    // just the woman's sincere line -- split out of the old beat3_revive so
    // the Widowmaker beat can sit between the spring-up and this
    phaseData.bubbleTw = makeTypewriter([fmt(CONFIG.savior.sincereLine)], 14, 0.5);
    phaseData.bubbleStart = 0;
  } else if(name==='beat3_silence'){
    if(actx) duckDown(actx.currentTime, 0.015);
  } else if(name==='beat3_finale'){
    triggerShake(8, 0.4);
    flashAlpha = 0.85;
    // everyone laughs at once -- all 4 seated diners (the restored critic
    // participates as his seat now, no more window special-casing) + woman
    for(const d of diners){ if(!d.walking && !d.retired) d.bounceT = 0.001; }
    spawnHaBurst(diners[0].x, diners[0].y-40, gameT);
    spawnHaBurst(diners[CRITIC_INDEX].x, diners[CRITIC_INDEX].y-40, gameT);
    spawnHaBurst(diners[2].x, diners[2].y-40, gameT);
    spawnHaBurst(diners[3].x, diners[3].y-40, gameT);
    spawnHaBurst(woman.x, woman.y-40, gameT);
    if(actx){
      const now = actx.currentTime;
      playSlamBoom(now);
      playTwang(now);
      playTwang(now+BEAT_DEFAULT);
      setBeatMusic('celebration');
      duckUp(now, 1.0);
      if(speechWorked===true) speakForFree();
    }
  } else if(name==='beat4_intro'){
    // dramatic staging: music cuts to silence up front, room dims, door
    // SLAMS a beat later (see updatePhase's 'beat4_intro' case for the
    // slam/walk/letterbox timeline) -- Aram isn't visible until the slam.
    player.canMove = false;
    aram.active = false; aram.state = 'walkin'; aram.turnedGood = false;
    aram.x = 24; aram.y = LEFT_DOOR.y+LEFT_DOOR.h/2;
    aram.contactCooldown = 0;
    phaseData.stage = 0;
    phaseData.slamFired = false;
    phaseData.lastFootstepAt = -999;
    if(actx) duckDown(actx.currentTime, 0.0);
  } else if(name==='beat4_chase'){
    player.canMove = true;
    aram.state = 'chase';
    resetReviewers();
    setBeatMusic('chase');
    maybeShowCard('aram');
  } else if(name==='beat4_turngood'){
    aram.state = 'frozen';
    phaseData.stage = 0;
    if(actx) duckDown(actx.currentTime);
  } else if(name==='celebration'){
    // everyone converges loosely around the chef and celebrates for a
    // sustained beat before the freeze/end card. Participants = the 3 still-
    // seated diners + the woman + the (revived) critic + Aram -- same
    // "4 guys" headcount convention as the Beat 3 finale's unison bubbles,
    // since one of the original 4 diners literally IS the critic/boss by now.
    player.canMove = false;
    const participants = celebrationParticipants();
    phaseData.participants = participants;
    phaseData.startPositions = participants.map(p=>({x:p.x, y:p.y}));
    const cx = player.x, cy = player.y, n = participants.length;
    phaseData.targets = participants.map((p,i)=>{
      const ang = (i/n)*Math.PI*2;
      const r = 80 + (i%2)*20;
      return {
        x: Math.max(WALL_SIDE+20, Math.min(CW-WALL_SIDE-20, cx+Math.cos(ang)*r)),
        y: Math.max(WALL_TOP+20, Math.min(CH-20, cy+Math.sin(ang)*r))
      };
    });
    phaseData.lastHaAt = participants.map(()=> -999);
    phaseData.confetti = spawnConfettiField(100);
    phaseData.textPops = [
      {at:0.2, x:CW*0.22, y:CH*0.26, px:28},
      {at:1.3, x:CW*0.78, y:CH*0.62, px:28},
      {at:2.4, x:CW*0.22, y:CH*0.68, px:28},
      {at:3.4, x:CW*0.78, y:CH*0.24, px:28}
    ];
    phaseData.flashesAt = [1.0, 3.2];
    phaseData.flashesFired = [false, false];
    triggerShake(6, 0.4);
    setBeatMusic('celebration');
    if(actx){
      const now = actx.currentTime;
      duckUp(now, 1.0); // mp3 (if active) and/or the loop score both come back at full
      playFanfare(now);
    }
    if(speechWorked===true) speakForFree();
  } else if(name==='epilogueA'){
    // THE BATHROOM: one seated diner (bathroom guy -- diners[2]) steps away,
    // opens his phone, and VISIBLY deletes his entire photo gallery (a
    // 16-thumbnail grid that pops away a few at a time) before the table
    // laughs at him and he trudges back. Gameplay locked throughout -- pure
    // cutscene. Distinct from Epilogue B's diner (diners[3]).
    player.canMove = false;
    phaseData.stage = 0;
    phaseData.diner = diners[2];
    // NOT setting .walking here -- that flag is only rendered specially for
    // the critic's transform (drawBaseScene); everyone else, including this
    // diner, is just drawn wherever d.x/d.y currently are as long as
    // walking/retired are both false, same as the Beat 4/5 wandering diners.
    phaseData.startX = phaseData.diner.x; phaseData.startY = phaseData.diner.y;
    phaseData.doorX = BATHROOM_DOOR.x + BATHROOM_DOOR.w/2;
    phaseData.doorY = BATHROOM_DOOR.h + 40;
    phaseData.puffs = [];
    setBeatMusic('sad'); // "bathroom/sad moments" -- Sad Descent
    if(actx) duckDown(actx.currentTime, 0.3);
  } else if(name==='epilogueB'){
    // THE GUY WHO BUILT THIS: a letterboxed 4-shot meta-joke cutaway (dining
    // room beat, plane home, desk build-up, sharing with the 4 guys), then
    // back to the dining room for Beat 5. diners[3] ("the builder guy") stars
    // here AND is Beat 5's tech-support target -- that's the joke: the guy
    // who built the game can't hear it either.
    player.canMove = false;
    phaseData.stage = 1;
    phaseData.builder = diners[3];
    phaseData.lastKeyBlipAt = -999;
    phaseData.pingIndex = 0;
    setBeatMusic('dinner'); // back to a lighthearted register for the meta-joke cutaway
    if(actx) duckDown(actx.currentTime, 0.25);
  } else if(name==='beat5_chase'){
    // TECH SUPPORT: pure comedy chase, no damage/drain/death. Reuses the
    // Beat 4 flee/wander pattern (see updateBeat5) on a single target.
    player.canMove = true;
    const r = beat5Target();
    r.fleeing = false; r.begging = false; r.beggingT = 0; r.replied = false;
    r.catchCount = 0; r.bubble = null;
    r.wanderTX = r.x; r.wanderTY = r.y;
    stats.resets = 0;
    phaseData.lastBubbleAt = -999;
    setBeatMusic('chase');
    maybeShowCard('beat5');
  } else if(name==='beat5_resolve'){
    player.canMove = false;
    triggerShake(5, 0.3);
    const r = beat5Target();
    for(const d of diners){ if(!d.walking && !d.retired) d.bounceT = 0.001; }
    spawnHaBurst(r.x, r.y-40, gameT);
    if(woman.active) spawnHaBurst(woman.x, woman.y-40, gameT);
    // the restored critic is just diners[CRITIC_INDEX] now -- the generic
    // "every non-walking/non-retired diner bounces" loop above already
    // covers him, no more window-critic special-casing needed here
    setBeatMusic('celebration');
    if(actx){
      const now = actx.currentTime;
      duckUp(now, 1.0);
      playFanfare(now);
    }
  } else if(name==='endcard'){
    phaseData.rank = computeRank();
    // any win unlocks hard mode ("SECOND SEATING") -- only shown big the
    // very first time it flips on; later wins just get the small corner note
    phaseData.wasBeatenBefore = hasBeatenBefore;
    setLocalFlag(skey('beaten'));
    hasBeatenBefore = true;
    if(hardMode){
      phaseData.hardCleared = true;
      setLocalFlag(skey('hard_cleared'));
      hardCleared = true;
    }
  } else if(name==='gameover'){
    // whole table reacts
    setBeatMusic('gameover');
    if(actx) duckDown(actx.currentTime, 0.5);
  } else if(name==='retrycard'){
    // nothing
  }
}
function computeRank(){
  // jumping the punchline early caps the rank -- IMMACULATE means you never
  // messed up the timing in either direction, not just that you dodged well.
  if(stats.hitsTaken<=2 && stats.tooSoon===0) return CONFIG.rankNames.immaculate;
  if(stats.hitsTaken<=6) return CONFIG.rankNames.comicTiming;
  return CONFIG.rankNames.worst;
}

/* ---------------- early punchline penalty ("story" phase only) ---------------- */
function triggerTooSoon(){
  if(gameT - lastTooSoonAt < 1.0) return; // cooldown so mashing can't melt hearts
  lastTooSoonAt = gameT;
  stats.tooSoon++;
  // normal mode floors at 1 half-heart -- Beat 1 can never be a game over.
  // hard mode costs a full heart with NO floor -- three early blurts can and
  // should end the run.
  const dmg = D('tooSoonDamage');
  player.hearts = hardMode ? Math.max(0, player.hearts-dmg) : Math.max(1, player.hearts-dmg);
  triggerShake(3, 0.2);
  if(actx) playGroan(actx.currentTime);
  phaseData.tooSoonPopAt = gameT;
  phaseData.tooSoonBubbleAt = gameT;
  phaseData.pauseUntil = gameT + TOO_SOON_HOLD; // the typewriter (typeT) freezes until this passes
  for(const d of diners){ if(!d.walking && !d.retired) d.shakeT = 0.001; }
  if(hardMode && player.hearts<=0){
    gameOverReason = 'beat1';
    enterPhase('gameover');
  }
}

/* ---------------- punchline trigger (Beat 1) ---------------- */
function triggerForFree(){
  const perfect = (gameT - phaseData.promptStart) <= D('perfectWindow');
  triggerShake(8, 0.4);
  if(actx){
    const now = actx.currentTime;
    playSlamBoom(now);
    playTwang(now);
    playTwang(now+BEAT_DEFAULT*0.6);
    duckUp(now, 1.0);
  }
  speakForFree();
  // everyone at the table visibly laughs -- each diner bounces AND gets their
  // own HA-HA burst from their own seat, not one burst from the table center
  for(const d of diners){
    if(!d.walking && !d.retired){
      d.bounceT = 0.001;
      spawnHaBurst(d.x, d.y-40, gameT);
    }
  }
  const baseN = 6+Math.floor(Math.random()*3) + (perfect?2:0);
  const n = Math.max(2, Math.round(baseN * D('heartBurstMul'))); // hard mode: ~40% fewer tokens
  spawnHeartBurst(n, TABLE.x+TABLE.w/2, TABLE.y+TABLE.h/2, gameT);
  enterPhase('capture');
  phaseData.slamAt = gameT;
  phaseData.perfect = perfect;
  if(!cardsShown.capture){
    // let 0.4s of real scatter physics happen first, so the tutorial card
    // freezes the laughs visibly mid-air instead of stacked at the table
    pendingCard = CARDS.capture;
    pendingCardAt = gameT + 0.4;
  }
}

/* ---------------- bottle throw resolution ---------------- */
function throwBottle(){
  if(!player.hasBottle) return;
  player.hasBottle = false;
  const duration = 0.75;
  // hard mode: duck chance applies at ALL hp levels/phases (no gate);
  // normal mode keeps the original gate (never phase 2, only above 3 hp)
  const canDuck = hardMode ? true : (!boss.phase2 && boss.hp>3);
  const ducked = canDuck && Math.random()<D('duckChance');
  spawnBottleThrow(player.x, player.y-16, boss.x, boss.y, duration);
  bottles[bottles.length-1].willHit = !ducked;
  if(ducked){
    boss.duckT = duration*0.6;
    if(actx) playWhoosh(actx.currentTime);
    // the critic can't resist rubbing it in -- insult aimed at Gabe, not the wine
    const line = CRITIC_DUCK_LINES[criticDuckIndex % CRITIC_DUCK_LINES.length];
    criticDuckIndex++;
    boss.bubble = { text: [line], born: gameT };
    speakCritique(line);
  }
}
function checkBossHit(){
  boss.hp = Math.max(0, boss.hp-1);
  stats.bottlesLanded++;
  boss.recoilT = 0.3;
  if(boss.hp>0){
    // he takes the hit and insults Gabe anyway
    const line = CRITIC_HIT_LINES[criticHitIndex % CRITIC_HIT_LINES.length];
    criticHitIndex++;
    boss.bubble = { text: [line], born: gameT };
    speakCritique(line);
  }
  if(boss.hp<=0){
    if(!boss.fakeDeathDone){
      boss.fakeDeathDone = true;
      boss.hp = 1;
      boss.state = 'fakedeath';
      boss.fdT = 0; boss.fdJingleFired=false; boss.fdScratchFired=false; boss.fdCheerFired=false;
      boss.fdBubbleTw=null; boss.fdBubbleStage=0; boss.fdBubble2At=null; boss.fdDoneAt=null;
      // the HP bar "shatters" -- a burst where it was sitting, right as it vanishes
      spawnGlassShards(CW/2, 33, gameT);
    } else {
      boss.state = 'dead'; boss.deadT = 0;
      spawnBigHeart(boss.x, boss.y+50, gameT);
      // true-silence beat, then Sad Descent softly emerges underneath the
      // woman's sincere line (replaces the old drone+arp interlude)
      setBeatMusic('sad');
      if(actx) duckDown(actx.currentTime, 0.15);
    }
  }
}

/* ---------------- boss AI ---------------- */
/* clamp to the same playable interior every moving-target aim point uses, so
   a lead/cutoff prediction can never ask a napkin to target inside a wall */
function clampToArena(x, y){
  return {
    x: Math.max(WALL_SIDE+13, Math.min(CW-WALL_SIDE-13, x)),
    y: Math.max(WALL_TOP+13, Math.min(CH-13, y))
  };
}
/* where the player will be `leadTime` seconds from now, assuming their
   current input holds -- used by the LED/CUTOFF attack patterns below */
function predictPlayerPos(leadTime){
  return clampToArena(player.x + player.vx*leadTime, player.y + player.vy*leadTime);
}
/* ---- randomized attack patterns (anti-circling) ----
   A napkin that always aims at the player's live position rewards one fixed
   counter-strategy (hold a steady circular strafe). Every throw/volley now
   independently rolls one of 4 read-and-react patterns instead, so no single
   movement habit is ever safe -- see SPEC-game.md "Critic attack patterns". */
function pickAttackPattern(phase2){
  const table = phase2
    ? [['led',0.30],['direct',0.20],['scatter',0.20],['cutoff',0.30]]
    : [['led',0.35],['direct',0.30],['scatter',0.20],['cutoff',0.15]];
  let r = Math.random(), acc = 0;
  for(const [name,w] of table){ acc += w; if(r <= acc) return name; }
  return table[table.length-1][0];
}
/* n random points scattered 60-130px (tightened to 45-95px in phase 2) around
   the player's current position -- covers a circle path both ahead and behind */
function scatterPoints(n, phase2){
  const rMin = phase2 ? 45 : 60, rMax = phase2 ? 95 : 130;
  const pts = [];
  for(let i=0;i<n;i++){
    const ang = Math.random()*Math.PI*2;
    const r = rMin + Math.random()*(rMax-rMin);
    pts.push(clampToArena(player.x+Math.cos(ang)*r, player.y+Math.sin(ang)*r));
  }
  return pts;
}
/* single aim point for the non-scatter patterns */
function patternAimPoint(pattern, phase2){
  const leadTime = (phase2 ? 0.6 : 0.45) * D('leadTimeMul'); // hard mode: leads +30% harder
  if(pattern==='led') return predictPlayerPos(leadTime);
  if(pattern==='cutoff') return predictPlayerPos(leadTime*2); // lands where a circler is *about* to be
  return clampToArena(player.x, player.y); // 'direct' -- punishes stopping/reversing to bait the lead
}
const ATTACK_AIM_WOBBLE = 40; // small extra randomness on top of led/direct/cutoff aims
function fireSingleNapkin(){
  const pattern = pickAttackPattern(boss.phase2);
  if(pattern==='scatter'){
    const p = scatterPoints(1, boss.phase2)[0];
    spawnNapkin(boss.x, boss.y, p.x, p.y, 0.85);
  } else {
    const aim = patternAimPoint(pattern, boss.phase2);
    const tx = aim.x + (Math.random()*ATTACK_AIM_WOBBLE*2-ATTACK_AIM_WOBBLE);
    const ty = aim.y + (Math.random()*ATTACK_AIM_WOBBLE*2-ATTACK_AIM_WOBBLE);
    spawnNapkin(boss.x, boss.y, tx, ty, 0.85);
  }
  napkins[napkins.length-1].big = boss.phase2;
}
function fireVolley(){
  const volley = boss.phase2 ? D('volleyCountP2') : D('volleyCount');
  const pattern = pickAttackPattern(boss.phase2);
  if(pattern==='scatter'){
    for(const p of scatterPoints(volley, boss.phase2)){
      spawnNapkin(boss.x, boss.y, p.x, p.y, 0.95);
      napkins[napkins.length-1].big = boss.phase2;
    }
    return;
  }
  const aim = patternAimPoint(pattern, boss.phase2);
  for(let i=0;i<volley;i++){
    const off = (i-(volley-1)/2)*32;
    spawnNapkin(boss.x, boss.y, aim.x+off, aim.y+(Math.random()*20-10), 0.95);
    napkins[napkins.length-1].big = boss.phase2;
  }
}
function updateBossAttacks(dt){
  if(!bossIsFighting()) return;
  boss.napkinTimer -= dt;
  if(boss.napkinTimer<=0){
    const baseInterval = boss.phase2 ? D('napkinIntervalP2') : D('napkinInterval');
    boss.napkinTimer = baseInterval * (0.75 + Math.random()*0.5); // +/-25% jitter -- rhythm can't be memorized
    fireSingleNapkin();
  }
  boss.critiqueTimer -= dt;
  if(boss.critiqueTimer<=0){
    boss.critiqueTimer = 6.0 * (0.75 + Math.random()*0.5);
    const line = CRITIQUE_LINES[Math.floor(Math.random()*CRITIQUE_LINES.length)];
    boss.bubble = { text: line, born: gameT };
    speakCritique(line.join(' '));
    fireVolley();
  }
}
/* how long he stays slumped before the record scratch -- stretched way out
   (was 1.1s) so the player genuinely believes they won before the rug-pull;
   the diners even start a small premature cheer partway through */
const FD_SLUMP_DURATION = 3.5;
const FD_CHEER_AT = 2.0;
function updateFakeDeath(dt){
  boss.fdT += dt;
  if(!boss.fdJingleFired){ boss.fdJingleFired=true; if(actx) playJingleStart(actx.currentTime); }
  if(boss.fdT>=FD_CHEER_AT && !boss.fdCheerFired){
    boss.fdCheerFired = true;
    // premature cheer -- the table thinks it's over. Smaller/no burst-heart
    // than the real Beat 3 finale, just the visible reaction.
    for(const d of diners){
      if(!d.walking && !d.retired){ d.bounceT = 0.001; spawnHaBurst(d.x, d.y-40, gameT); }
    }
  }
  if(boss.fdT>=FD_SLUMP_DURATION && !boss.fdScratchFired){ boss.fdScratchFired=true; if(actx) playRecordScratch(actx.currentTime); }
  // bubble starts the instant he pops back up (same beat as the record
  // scratch) rather than after an extra pause -- otherwise there's a stretch
  // where he's already upright but nothing is visibly happening yet.
  if(boss.fdT>=FD_SLUMP_DURATION && !boss.fdBubbleTw){
    boss.fdBubbleTw = makeTypewriter([CONFIG.judge.fakeDeathLine1],18,0.4);
    boss.fdBubbleStart = boss.fdT;
    boss.fdBubbleStage = 1;
  }
  if(boss.fdBubbleStage===1){
    const t = boss.fdT-boss.fdBubbleStart;
    if(boss.fdBubbleTw.allDone(t) && boss.fdBubble2At==null){
      boss.fdBubble2At = boss.fdT+DIALOGUE_GAP;
    }
  }
  if(boss.fdBubble2At!=null && boss.fdT>=boss.fdBubble2At && boss.fdBubbleStage===1){
    boss.fdBubbleStage = 2;
    boss.fdBubbleTw = makeTypewriter([CONFIG.judge.fakeDeathLine2],18,0.4);
    boss.fdBubbleStart = boss.fdT;
  }
  if(boss.fdBubbleStage===2){
    const t = boss.fdT-boss.fdBubbleStart;
    if(boss.fdBubbleTw.allDone(t) && boss.fdDoneAt==null){
      boss.fdDoneAt = boss.fdT+DIALOGUE_HOLD;
    }
  }
  if(boss.fdDoneAt!=null && boss.fdT>=boss.fdDoneAt){
    boss.state = 'phase2active';
    boss.phase2 = true;
    boss.hp = D('bossPhase2Hp'); boss.maxHp = D('bossPhase2Hp');
    boss.napkinTimer = D('napkinIntervalP2'); boss.critiqueTimer = 6;
    boss.targetScale = 2.1; // presentation only -- hitbox/gameplay unchanged
    // Mission Plausible (already playing) carries phase 2's intensity on its
    // own -- no live layering to flip anymore now that it's a composed loop
  }
}
/* fold phase2active back into the same attack/duck logic as active */
function bossIsFighting(){ return boss.state==='active' || boss.state==='phase2active'; }

/* ======================================================================
   PER-FRAME UPDATE
   ====================================================================== */
const PLAYER_SPEED = 220;
const keys = Object.create(null);
let gpAPrev = false, gpDpadPrev = false;

/* ---------------- floating joystick (touch, left half of screen) ----------------
   pointerdown on the left half anchors the base at the touch point; drag
   offset (in LOGICAL 960x540 coords, same space everything else draws in)
   becomes a move vector once past the deadzone, saturating at JOY_SATURATION.
   touchMoveVector() always returns a properly-normalized direction (dividing
   by the raw drag distance first, then scaling by magnitude) so diagonal
   drags come out unit-length just like keyboard/gamepad diagonals do. */
let touchJoystick = { active:false, pointerId:null, baseX:0, baseY:0, curX:0, curY:0 };
const JOY_DEADZONE = 10, JOY_SATURATION = 48;
function touchMoveVector(){
  if(!touchJoystick.active) return {dx:0, dy:0};
  const dx = touchJoystick.curX-touchJoystick.baseX, dy = touchJoystick.curY-touchJoystick.baseY;
  const dist = Math.hypot(dx,dy);
  if(dist < JOY_DEADZONE) return {dx:0, dy:0};
  const eff = Math.min(dist, JOY_SATURATION) - JOY_DEADZONE;
  const mag = eff / (JOY_SATURATION-JOY_DEADZONE); // 0..1
  return { dx:(dx/dist)*mag, dy:(dy/dist)*mag };
}

function getMoveVector(){
  let dx=0, dy=0;
  if(keys['KeyW']||keys['ArrowUp']) dy -= 1;
  if(keys['KeyS']||keys['ArrowDown']) dy += 1;
  if(keys['KeyA']||keys['ArrowLeft']) dx -= 1;
  if(keys['KeyD']||keys['ArrowRight']) dx += 1;
  if(navigator.getGamepads){
    let pads = [];
    try{ pads = navigator.getGamepads(); }catch(e){}
    for(const gp of pads){
      if(!gp) continue;
      const ax = gp.axes[0]||0, ay = gp.axes[1]||0;
      if(Math.abs(ax)>0.3) dx += ax>0?1:-1;
      if(Math.abs(ay)>0.3) dy += ay>0?1:-1;
      if(gp.buttons[12] && gp.buttons[12].pressed) dy -= 1;
      if(gp.buttons[13] && gp.buttons[13].pressed) dy += 1;
      if(gp.buttons[14] && gp.buttons[14].pressed) dx -= 1;
      if(gp.buttons[15] && gp.buttons[15].pressed) dx += 1;
    }
  }
  const tv = touchMoveVector();
  dx += tv.dx; dy += tv.dy;
  const len = Math.hypot(dx,dy);
  if(len>1){ dx/=len; dy/=len; }
  return {dx,dy};
}
function pollGamepadAction(){
  if(rotatePromptActive) return;
  if(!navigator.getGamepads) return;
  let pads = [];
  try{ pads = navigator.getGamepads(); }catch(e){ return; }
  let pressed = false, dpad = false;
  for(const gp of pads){
    if(!gp) continue;
    if(gp.buttons[0] && gp.buttons[0].pressed) pressed = true;
    if((gp.buttons[12]&&gp.buttons[12].pressed) || (gp.buttons[13]&&gp.buttons[13].pressed) ||
       (gp.buttons[14]&&gp.buttons[14].pressed) || (gp.buttons[15]&&gp.buttons[15].pressed)) dpad = true;
  }
  if(modeSelectPending){
    if(dpad && !gpDpadPrev){ modeSelectIndex = 1-modeSelectIndex; if(actx) playBeep(actx.currentTime); }
    if(pressed && !gpAPrev) confirmModeSelect();
    gpAPrev = pressed; gpDpadPrev = dpad;
    return;
  }
  if(pressed && !gpAPrev) handleAction();
  gpAPrev = pressed;
  gpDpadPrev = dpad;
}

function updatePlayerMovement(dt){
  if(!player.canMove){ player.vx = 0; player.vy = 0; return; }
  const mv = getMoveVector();
  if(mv.dx!==0 || mv.dy!==0){
    hasMovedOnce = true;
    if(Math.abs(mv.dx) > Math.abs(mv.dy)) player.facing = mv.dx>0 ? 'right' : 'left';
    else player.facing = mv.dy>0 ? 'down' : 'up';
    player.walkAnimT += dt;
  } else {
    player.walkAnimT = 0;
  }
  // tracked for the critic's predictive-lead aim (see predictPlayerPos) --
  // intentionally the *requested* velocity, not a post-collision delta, so a
  // player sliding along a wall still reads as "moving that way" for aim
  // purposes rather than snapping to 0.
  player.vx = mv.dx*PLAYER_SPEED;
  player.vy = mv.dy*PLAYER_SPEED;
  const solids = arenaSolids(diners);
  moveAndCollide(player, mv.dx*PLAYER_SPEED*dt, mv.dy*PLAYER_SPEED*dt, solids, 13);
  if(player.iframes>0) player.iframes = Math.max(0, player.iframes-dt);
}
function updateDiners(dt){
  for(const d of diners){
    if(d.bounceT>0){ d.bounceT += dt; if(d.bounceT>1.2) d.bounceT=0; }
    if(d.shakeT>0){ d.shakeT += dt; if(d.shakeT>0.5) d.shakeT=0; }
  }
}
function updateBoss(dt){
  if(boss.duckT>0) boss.duckT = Math.max(0, boss.duckT-dt);
  if(boss.recoilT>0) boss.recoilT = Math.max(0, boss.recoilT-dt);
  if(boss.state==='fakedeath') updateFakeDeath(dt);
  if(boss.state==='dead') boss.deadT += dt;
  if(phase==='boss') updateBossAttacks(dt);
}
function damagePlayer(amount){
  if(player.iframes>0) return;
  player.hearts = Math.max(0, player.hearts-amount);
  player.iframes = 0.8;
  stats.hitsTaken++;
  if(actx) playThud(actx.currentTime);
}
function resolveLandings(){
  for(const n of napkins){
    if(n.landed && !n.resolved){
      n.resolved = true;
      const d = Math.hypot(player.x-n.targetX, player.y-n.targetY);
      if(d < (n.big?32:22)) damagePlayer(D('napkinDamage'));
    }
  }
  for(const b of bottles){
    if(b.landed && !b.resolved){
      b.resolved = true;
      if(actx) playGlassShatter(actx.currentTime);
      spawnGlassShards(b.targetX, b.targetY, gameT);
      if(b.willHit) checkBossHit();
    }
  }
}
function updateBottlePickup(){
  if(!bottlePickup.active){
    if(gameT >= bottlePickup.respawnAt) bottlePickup.active = true;
    return;
  }
  if(!player.hasBottle){
    const d = Math.hypot(player.x-bottlePickup.x, player.y-bottlePickup.y);
    if(d<34){ player.hasBottle=true; bottlePickup.active=false; bottlePickup.respawnAt=gameT+2.5; }
  }
}

/* ======================================================================
   BEAT 4 -- ARAM (post-finale final level: chase + beg for 5-star reviews)
   Reviewers are the *same* diners[]/woman/boss objects the rest of the game
   already draws (repurposing their x/y directly, per the established
   convention here) -- no parallel entity list, so every existing draw loop
   keeps working unchanged. New fields (reviewGiven/fleeing/begging/...) are
   just added onto them once Beat 4 starts.
   ====================================================================== */
/* only ever called when BEAT4_ENABLED, i.e. judge+savior+authority are all
   cast -- by that point woman is guaranteed properly present (arrived), and
   the Windowmaker beat has already restored diners[CRITIC_INDEX] to his
   seat (the former "boss" here, no more window-critic special-casing), so
   this list needs no additional filtering */
function getReviewerList(){ return [diners[0], diners[CRITIC_INDEX], diners[2], diners[3], woman]; }
/* the win-celebration crowd: everyone who can plausibly be on their feet by
   now. Unlike getReviewerList(), celebration ALWAYS runs regardless of which
   roles were cast, so this filters to whoever's actually present: woman only
   if she ever arrived (savior cast), the critic only if he's not
   retired (uncast judge: never retires, always present as a plain diner;
   judge-cast-but-savior-uncast: retired forever after the real kill, no
   Windowmaker to undo it, correctly excluded; full cast: the Windowmaker
   flips retired back to false before celebration is ever reached), Aram
   only if he actually turned good (beat 4 completed) -- the 2 non-role
   diners (diner0, and whichever of judge/butterfingers/builder didn't get
   a special beat this run) are always included. */
function celebrationParticipants(){
  return [diners[0], diners[2], diners[3]]
    .concat(woman.active ? [woman] : [])
    .concat(!diners[CRITIC_INDEX].retired ? [diners[CRITIC_INDEX]] : [])
    .concat(aram.turnedGood ? [aram] : []);
}
function resetReviewers(){
  stats.reviews = 0;
  for(const r of getReviewerList()){
    r.reviewGiven = false;
    r.fleeing = false;
    r.begging = false;
    r.beggingT = 0;
    r.wanderTX = r.x;
    r.wanderTY = r.y;
  }
}
/* picks a random floor waypoint, retrying a few times to avoid landing inside
   the table -- reviewers don't get full collision (a documented deviation
   from spec, kept simple since it's cosmetic-only wandering), but this keeps
   them from parking a waypoint dead-center on it */
function randomWanderPoint(){
  for(let tries=0; tries<8; tries++){
    const x = WALL_SIDE+30 + Math.random()*(CW-2*(WALL_SIDE+30));
    const y = WALL_TOP+30 + Math.random()*(CH-WALL_TOP-60);
    if(!rectsOverlap(x-14,y-14,28,28, TABLE.x-20,TABLE.y-20,TABLE.w+40,TABLE.h+40)) return {x,y};
  }
  return {x: WALL_SIDE+40, y: CH-60};
}
const REVIEWER_WANDER_SPEED = 50;
const REVIEWER_BEG_RADIUS = 40;
/* flee speed/radius and beg duration are difficulty-sensitive -- see DIFF
   (reviewerFleeSpeed/reviewerFleeRadius/begDuration). Normal-mode values
   below (130 / 120 / +40 resume gap / 1.2) are exactly the old literals. */
function updateReviewers(dt){
  if(phase!=='beat4_chase') return;
  const fleeSpeed = D('reviewerFleeSpeed');
  const fleeRadius = D('reviewerFleeRadius');
  const fleeResumeRadius = fleeRadius + 40; // hysteresis gap, same proportion as before
  const begDuration = D('begDuration');
  for(const r of getReviewerList()){
    if(r.reviewGiven) continue;
    if(r.begging){
      r.beggingT += dt;
      if(r.beggingT >= begDuration) completeReview(r);
      continue;
    }
    const dPlayer = Math.hypot(player.x-r.x, player.y-r.y);
    if(r.fleeing){ if(dPlayer > fleeResumeRadius) r.fleeing = false; }
    else if(dPlayer < fleeRadius){ r.fleeing = true; }
    let tx, ty, speed;
    if(r.fleeing){
      const ang = Math.atan2(r.y-player.y, r.x-player.x);
      tx = r.x + Math.cos(ang)*40; ty = r.y + Math.sin(ang)*40;
      speed = fleeSpeed;
    } else {
      if(Math.hypot(r.wanderTX-r.x, r.wanderTY-r.y) < 8){
        const wp = randomWanderPoint();
        r.wanderTX = wp.x; r.wanderTY = wp.y;
      }
      tx = r.wanderTX; ty = r.wanderTY;
      speed = REVIEWER_WANDER_SPEED;
    }
    const dx = tx-r.x, dy = ty-r.y, d = Math.hypot(dx,dy);
    if(d>1){
      const mx = dx/d*speed*dt, my = dy/d*speed*dt;
      r.x = Math.max(WALL_SIDE+16, Math.min(CW-WALL_SIDE-16, r.x+mx));
      r.y = Math.max(WALL_TOP+16, Math.min(CH-16, r.y+my));
    }
  }
}
function tryBeg(){
  let nearest = null, nearestD = Infinity;
  for(const r of getReviewerList()){
    if(r.reviewGiven || r.begging) continue;
    const d = Math.hypot(player.x-r.x, player.y-r.y);
    if(d < REVIEWER_BEG_RADIUS && d < nearestD){ nearest = r; nearestD = d; }
  }
  if(!nearest) return;
  nearest.begging = true;
  nearest.beggingT = 0;
  nearest.fleeing = false;
  playerBubble = { text: CONFIG.authority.beggingLine, born: gameT };
  if(speechWorked===true) speakLine('Please. Five stars.', 1.0, 0.7);
}
function completeReview(r){
  r.reviewGiven = true;
  r.begging = false;
  stats.reviews++;
  spawnStarRow(r.x, r.y-70, gameT);
  if(actx) playPickupChime(actx.currentTime);
}

/* ======================================================================
   BEAT 5 -- TECH SUPPORT (post-epilogue final level: pure comedy chase,
   no damage/drain/death). Target is always diners[3] -- the SAME "builder
   guy" who starred in Epilogue B (the one who flew home and built this exact
   game) -- that's the joke: he can't hear the sound in the game he built.
   A fixed pick, not stored in phaseData, so it survives enterPhase()'s
   phaseData reset between 'beat5_chase' and 'beat5_resolve' without extra
   plumbing. The wander/flee movement below is a deliberate copy+adapt of
   updateReviewers' algorithm (same codebase convention as the duplicated
   audio engine) rather than a shared call, since the two have unrelated
   completion semantics (review-given vs. catch-count/reply-cycling).
   ====================================================================== */
function beat5Target(){ return diners[3]; }
const TECH_SUPPORT_MID_REPLIES = BUILDER_CAST ? CONFIG.builder.resetReplies : [];
const TECH_SUPPORT_FINAL_REPLY = BUILDER_CAST ? CONFIG.builder.resetFinalReply : '';
/* normal mode's 4 catches map 1:1 onto the 3 mid-replies + the final one;
   hard mode's extra (5th) catch repeats the last mid-reply rather than
   inventing new dialogue, since only these 4 lines are tone-pre-cleared */
function techSupportReply(catchNum, isFinal){
  if(isFinal) return TECH_SUPPORT_FINAL_REPLY;
  const idx = Math.min(catchNum, TECH_SUPPORT_MID_REPLIES.length) - 1;
  return TECH_SUPPORT_MID_REPLIES[idx];
}
function tryAskReset(){
  const r = beat5Target();
  if(r.begging) return;
  const d = Math.hypot(player.x-r.x, player.y-r.y);
  if(d >= REVIEWER_BEG_RADIUS) return;
  r.begging = true; r.beggingT = 0; r.replied = false; r.fleeing = false;
  r.catchCount = (r.catchCount||0) + 1;
  stats.resets = (stats.resets||0) + 1;
  playerBubble = { text: CONFIG.builder.resetQuestionLine, born: gameT };
  if(speechWorked===true) speakLine('Did you reset it?', 1.0, 0.7);
}
function updateBeat5(dt){
  if(phase!=='beat5_chase') return;
  const r = beat5Target();
  if(r.begging){
    r.beggingT += dt;
    if(r.beggingT>=1.0 && !r.replied){
      r.replied = true;
      const need = D('resetsNeeded');
      const isFinal = r.catchCount >= need;
      r.bubble = { text: techSupportReply(r.catchCount, isFinal), born: gameT };
      if(isFinal){ enterPhase('beat5_resolve'); return; }
    } else if(r.replied && r.beggingT>=2.2){
      r.begging = false; r.replied = false; r.beggingT = 0;
    }
    // occasional idle bounce for the two bystanders while he's caught
    // (0 and 2 -- not the boss seat, not diners[3] who's the target here)
    if(Math.random()<0.003){
      const od = diners[Math.random()<0.5?0:2];
      if(!od.walking && !od.retired && od.bounceT<=0) od.bounceT = 0.001;
    }
    return;
  }
  const fleeSpeed = D('techFleeSpeed');
  const fleeRadius = 120, fleeResumeRadius = 160; // same feel as Beat 4's normal-mode default
  const dPlayer = Math.hypot(player.x-r.x, player.y-r.y);
  if(r.fleeing){ if(dPlayer > fleeResumeRadius) r.fleeing = false; }
  else if(dPlayer < fleeRadius){ r.fleeing = true; }
  let tx, ty, speed;
  if(r.fleeing){
    const ang = Math.atan2(r.y-player.y, r.x-player.x);
    tx = r.x + Math.cos(ang)*40; ty = r.y + Math.sin(ang)*40;
    speed = fleeSpeed;
  } else {
    if(Math.hypot(r.wanderTX-r.x, r.wanderTY-r.y) < 8){
      const wp = randomWanderPoint();
      r.wanderTX = wp.x; r.wanderTY = wp.y;
    }
    tx = r.wanderTX; ty = r.wanderTY;
    speed = REVIEWER_WANDER_SPEED;
  }
  const dx = tx-r.x, dy = ty-r.y, d = Math.hypot(dx,dy);
  if(d>1){
    const mx = dx/d*speed*dt, my = dy/d*speed*dt;
    r.x = Math.max(WALL_SIDE+16, Math.min(CW-WALL_SIDE-16, r.x+mx));
    r.y = Math.max(WALL_TOP+16, Math.min(CH-16, r.y+my));
  }
  if(gameT - (phaseData.lastBubbleAt===undefined?-999:phaseData.lastBubbleAt) > 4.0){
    phaseData.lastBubbleAt = gameT;
    r.bubble = { text: CONFIG.builder.cantHearLine, born: gameT };
  }
  // occasional idle bounce for the two bystanders (0 and 2 -- see above)
  if(Math.random()<0.003){
    const od = diners[Math.random()<0.5?0:2];
    if(!od.walking && !od.retired && od.bounceT<=0) od.bounceT = 0.001;
  }
}
const ARAM_CONTACT_RADIUS = 36, ARAM_CONTACT_COOLDOWN = 1.0, ARAM_IFRAMES = 1.0, ARAM_KNOCKBACK = 40;
/* dramatic entrance staging (see updatePhase's 'beat4_intro' case) */
const ARAM_SLAM_AT = 0.5;            // door slam fires this far into the beat
const ARAM_WALK_START = 1.0;         // slow walk begins once the slam/letterbox settle
const ARAM_WALK_DUR = 3.6;           // slow heavy walk (was an instant 1.0s stroll)
const ARAM_FOOTSTEP_INTERVAL = 0.55; // thud + small shake cadence while walking
const ARAM_BUBBLE_CPS = 10;          // slower typing for his intro lines specifically
const ARAM_LETTERBOX_OUT_DUR = 0.5;  // final beat: bars out, lights up, music slams back in

/* ---------------- win celebration (after Aram turns good, before freeze/end card) ---------------- */
const CELEBRATION_DURATION = 5.0;
const CELEB_BOUNCE_OFFSET = {0:0, 2:0.25, 3:0.5}; // per-diner phase offset so hops don't all sync up
function spawnConfettiField(n){
  const colors = [PAL.gold, PAL.cream, PAL.terracotta];
  const arr = [];
  for(let i=0;i<n;i++){
    arr.push({
      x: Math.random()*CW, y: -Math.random()*CH,
      vy: 70+Math.random()*70, vx: (Math.random()*30-15),
      w: 2+Math.random()*2, h: 3+Math.random()*3,
      color: colors[i%colors.length],
      rot: Math.random()*Math.PI, rotSpeed: (Math.random()*2-1)*3
    });
  }
  return arr;
}
function drawConfetti(ctx, confetti){
  for(const c of confetti){
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    ctx.fillStyle = c.color;
    ctx.fillRect(-c.w/2, -c.h/2, c.w, c.h);
    ctx.restore();
  }
}
function updateAram(dt){
  if(!aram.active) return;
  if(aram.contactCooldown>0) aram.contactCooldown = Math.max(0, aram.contactCooldown-dt);
  if(aram.state==='chase'){
    const dx = player.x-aram.x, dy = player.y-aram.y, d = Math.hypot(dx,dy);
    if(d>1){
      aram.facing = dx>=0 ? 'right' : 'left';
      aram.walkAnimT += dt;
      // resolved live (not a module-level const) since hardMode isn't known
      // until the mode-select card confirms, well after module load
      const aramSpeed = PLAYER_SPEED * D('aramSpeedMul');
      const mx = dx/d*aramSpeed*dt, my = dy/d*aramSpeed*dt;
      aram.x = Math.max(WALL_SIDE+18, Math.min(CW-WALL_SIDE-18, aram.x+mx));
      aram.y = Math.max(WALL_TOP+18, Math.min(CH-18, aram.y+my));
    } else {
      aram.walkAnimT = 0;
    }
    if(d < ARAM_CONTACT_RADIUS && aram.contactCooldown<=0) aramContactDamage();
  }
}
/* not reusing damagePlayer() -- Aram's contact needs longer iframes (1.0s vs
   0.8s) plus a knockback shove, since he's a persistent chaser rather than a
   one-shot projectile landing */
function aramContactDamage(){
  aram.contactCooldown = ARAM_CONTACT_COOLDOWN;
  if(player.iframes>0) return;
  player.hearts = Math.max(0, player.hearts-D('aramContactDamage'));
  player.iframes = ARAM_IFRAMES;
  stats.hitsTaken++;
  if(actx) playThud(actx.currentTime);
  const dx = player.x-aram.x, dy = player.y-aram.y, d = Math.hypot(dx,dy)||1;
  player.x = Math.max(WALL_SIDE+13, Math.min(CW-WALL_SIDE-13, player.x + dx/d*ARAM_KNOCKBACK));
  player.y = Math.max(WALL_TOP+13, Math.min(CH-13, player.y + dy/d*ARAM_KNOCKBACK));
  triggerShake(4, 0.25);
}

function updatePhase(dt){
  phaseElapsed += dt;
  switch(phase){
    case 'story': {
      // typeT only advances outside a too-soon pause window, so the typewriter
      // genuinely freezes (not just visually) and resumes where it left off
      if(gameT >= phaseData.pauseUntil) phaseData.typeT += dt;
      updateTypewriterAudio(phaseData.tw, phaseData.typeT);
      if(phaseData.tw.allDone(phaseData.typeT)) enterPhase('prompt');
      break;
    }
    case 'prompt': break;
    case 'capture': {
      updateHeartPickups(dt, gameT, player, stats);
      if(heartPickups.length===0 && phaseElapsed>0.8) enterPhase('breather');
      break;
    }
    case 'breather': {
      if(phaseElapsed>1.0){
        if(roundIndex < ROUNDS.length-1){ roundIndex++; enterPhase('story'); }
        else enterPhase(nextAfterDinner());
      }
      break;
    }
    case 'beat2_intro': {
      const d = diners[CRITIC_INDEX];
      if(phaseElapsed>1.6 && phaseElapsed<=3.2){
        d.walking = true;
        const t = clamp01((phaseElapsed-1.6)/1.6);
        d.x = lerp(560, boss.walkX, t);
        d.y = lerp(248, boss.walkY, t);
      } else if(phaseElapsed>3.2 && phaseElapsed<=3.7){
        boss.doorPopT = clamp01((phaseElapsed-3.2)/0.5);
        if(boss.doorPopT>=0.2 && !phaseData.popSpark){
          phaseData.popSpark = true;
          spawnSparkleBurst(BOSS_DOOR.x+BOSS_DOOR.w/2, BOSS_DOOR.y+BOSS_DOOR.h/2, 10, gameT);
          if(actx) playDing(actx.currentTime);
        }
      } else if(phaseElapsed>3.7 && phaseElapsed<=4.3){
        // the transformation: 0.6s of rumble while his silhouette scales up
        // from normal diner size to full looming size
        if(!d.retired){
          d.retired = true;
          boss.visible = true;
          boss.transforming = true;
          boss.transformT = 0;
          triggerShake(5, 0.6);
          if(actx) playRumble(actx.currentTime);
        }
        boss.transformT = phaseElapsed-3.7;
      } else if(phaseElapsed>4.3){
        boss.doorPopT = 1;
        boss.transforming = false;
        boss.transformT = 0.6;
        enterPhase('boss');
      }
      break;
    }
    case 'boss': {
      updateBottlePickup();
      if(player.hearts<=0 && bossIsFighting()){ gameOverReason='boss'; enterPhase('gameover'); break; }
      if(boss.state==='dead' && boss.deadT>2.5) enterPhase(nextAfterBossDeath());
      break;
    }
    case 'beat3_intro': {
      // slower walk-in (was 2.2s) so her entrance actually reads as a moment,
      // not a dash across the room
      const t = clamp01(phaseElapsed/BEAT3_WALK_DUR);
      woman.x = lerp(24, 830, t);
      woman.y = lerp(LEFT_DOOR.y+LEFT_DOOR.h/2, 400, t);
      if(t>=1 && !woman.arrived){
        woman.arrived = true;
        phaseData.stage = 1;
        phaseData.bubbleTw = makeTypewriter([fmt(CONFIG.savior.line1)], 15, 0.5);
        phaseData.bubbleStart = phaseElapsed;
      }
      // "EXCUSE ME..." and "I BROUGHT THE WAGYU." now type and hold as two
      // separate staged bubbles (each gets its own long read-hold) rather
      // than sharing one bubble with almost no pause after typing finishes.
      if(phaseData.stage===1){
        const local = phaseElapsed-phaseData.bubbleStart;
        updateTypewriterAudio(phaseData.bubbleTw, local);
        if(local > phaseData.bubbleTw.doneAt + BEAT3_LINE1_HOLD){
          phaseData.stage = 2;
          phaseData.bubbleTw = makeTypewriter([fmt(CONFIG.savior.line2)], 15, 0.5);
          phaseData.bubbleStart = phaseElapsed;
        }
      } else if(phaseData.stage===2){
        const local = phaseElapsed-phaseData.bubbleStart;
        updateTypewriterAudio(phaseData.bubbleTw, local);
        if(local > phaseData.bubbleTw.doneAt + BEAT3_LINE2_HOLD) enterPhase('beat3_revive');
      }
      break;
    }
    case 'beat3_revive': {
      // beat, then straight into the Widowmaker
      if(phaseData.stage===0 && phaseElapsed>0.8) enterPhase('beat3_windowmaker');
      break;
    }
    case 'beat3_windowmaker': {
      const d0 = diners[0];
      if(phaseData.stage===0){
        const local = phaseElapsed - phaseData.bubbleStart;
        updateTypewriterAudio(phaseData.bubbleTw, local);
        if(local > phaseData.bubbleTw.doneAt + WIDOWMAKER_MOCK1_HOLD){
          phaseData.stage = 1;
          phaseData.bubbleTw = makeTypewriter([WIDOWMAKER_MOCK_LINES[1]], 15, 0.4);
          phaseData.bubbleStart = phaseElapsed;
        }
      } else if(phaseData.stage===1){
        const local = phaseElapsed - phaseData.bubbleStart;
        updateTypewriterAudio(phaseData.bubbleTw, local);
        if(local > phaseData.bubbleTw.doneAt + WIDOWMAKER_MOCK2_HOLD){
          phaseData.stage = 2;
          d0.bounceT = 0.001; // "stands" -- a reaction bounce, no repositioning
          phaseData.bubbleTw = makeTypewriter([WIDOWMAKER_RETORT_LINE], 15, 0.4);
          phaseData.bubbleStart = phaseElapsed;
        }
      } else if(phaseData.stage===2){
        const local = phaseElapsed - phaseData.bubbleStart;
        updateTypewriterAudio(phaseData.bubbleTw, local);
        if(local > phaseData.bubbleTw.doneAt + WIDOWMAKER_RETORT_HOLD){
          phaseData.stage = 3;
          phaseData.throwStart = phaseElapsed;
          phaseData.throwFromX = d0.x; phaseData.throwFromY = d0.y-16;
          phaseData.throwToX = BOSS_DOOR.x+BOSS_DOOR.w/2;
          phaseData.throwToY = BOSS_DOOR.y+BOSS_DOOR.h*0.6;
        }
      } else if(phaseData.stage===3){
        const local = phaseElapsed - phaseData.throwStart;
        if(local >= WIDOWMAKER_THROW_DUR){
          phaseData.stage = 4;
          phaseData.impactAt = phaseElapsed;
          triggerShake(7, 0.4);
          flashAlpha = 0.7;
          if(actx) playGlassShatter(actx.currentTime);
          // the wall door crumbles -- shard burst, then it's just gone for
          // the rest of the run (doorPopT never gets set back to 1)
          spawnGlassShards(BOSS_DOOR.x+BOSS_DOOR.w/2, BOSS_DOOR.y+BOSS_DOOR.h*0.5, gameT);
          boss.doorPopT = 0;
          boss.shrinking = true; boss.shrinkT = 0;
        }
      } else if(phaseData.stage===4){
        boss.shrinkT = phaseElapsed - phaseData.impactAt;
        if(boss.shrinkT >= WIDOWMAKER_SHRINK_DUR){
          phaseData.stage = 5;
          boss.shrinking = false;
          boss.visible = false;
          boss.state = 'restored';
          phaseData.walkStart = phaseElapsed;
          // hand off to the normal "walking diner" render path (same one
          // beat2_intro's walk-to-the-door uses in reverse) -- normal
          // sprite, no tint, no aura, from this instant on
          diners[CRITIC_INDEX].walking = true;
          diners[CRITIC_INDEX].retired = false;
          diners[CRITIC_INDEX].x = boss.x; diners[CRITIC_INDEX].y = boss.y;
        }
      } else if(phaseData.stage===5){
        const t = clamp01((phaseElapsed-phaseData.walkStart)/WIDOWMAKER_WALK_DUR);
        const cd = diners[CRITIC_INDEX];
        cd.x = lerp(boss.x, 560, t);
        cd.y = lerp(boss.y, 248, t);
        if(t>=1){
          cd.x = 560; cd.y = 248;
          cd.walking = false;
          cd.bounceT = 0.001; // settle/sit cue
          phaseData.stage = 6;
          phaseData.bubbleTw = makeTypewriter([WIDOWMAKER_REDEMPTION_LINE], 15, 0.4);
          phaseData.bubbleStart = phaseElapsed;
        }
      } else if(phaseData.stage===6){
        const local = phaseElapsed - phaseData.bubbleStart;
        updateTypewriterAudio(phaseData.bubbleTw, local);
        if(local > phaseData.bubbleTw.doneAt + WIDOWMAKER_REDEMPTION_HOLD) enterPhase('beat3_tribute');
      }
      break;
    }
    case 'beat3_tribute': {
      const local = phaseElapsed - phaseData.bubbleStart;
      updateTypewriterAudio(phaseData.bubbleTw, local);
      if(local > phaseData.bubbleTw.doneAt + BEAT3_LINE3_HOLD) enterPhase('beat3_silence');
      break;
    }
    case 'beat3_silence': {
      if(phaseElapsed>0.9) enterPhase('beat3_finale');
      break;
    }
    case 'beat3_finale': {
      if(phaseElapsed>1.0) enterPhase(nextAfterBeat3());
      break;
    }
    case 'beat4_intro': {
      // door SLAMS open partway into the beat -- boom + strong shake, and
      // that's the moment he actually becomes visible
      if(!phaseData.slamFired && phaseElapsed>=ARAM_SLAM_AT){
        phaseData.slamFired = true;
        aram.active = true;
        triggerShake(9, 0.5);
        if(actx) playSlamBoom(actx.currentTime);
      }
      // slow, heavy walk-in with a thud + small shake per footstep
      if(phaseElapsed>=ARAM_WALK_START && phaseElapsed<ARAM_WALK_START+ARAM_WALK_DUR){
        const wt = clamp01((phaseElapsed-ARAM_WALK_START)/ARAM_WALK_DUR);
        aram.x = lerp(24, 480, wt);
        aram.y = lerp(LEFT_DOOR.y+LEFT_DOOR.h/2, 300, wt);
        aram.walkAnimT = phaseElapsed;
        if(phaseElapsed-phaseData.lastFootstepAt >= ARAM_FOOTSTEP_INTERVAL){
          phaseData.lastFootstepAt = phaseElapsed;
          triggerShake(3, 0.15);
          if(actx) playThud(actx.currentTime);
        }
      } else if(phaseElapsed>=ARAM_WALK_START+ARAM_WALK_DUR){
        aram.x = 480; aram.y = 300;
        if(phaseData.stage===0){
          phaseData.stage = 1;
          phaseData.bubbleTw = makeTypewriter([CONFIG.authority.entranceLine1], ARAM_BUBBLE_CPS, 0.4);
          phaseData.bubbleStart = phaseElapsed;
        }
      }
      // bubbles type slowly (ARAM_BUBBLE_CPS) with long holds
      if(phaseData.stage===1){
        const local = phaseElapsed-phaseData.bubbleStart;
        updateTypewriterAudio(phaseData.bubbleTw, local);
        if(local > phaseData.bubbleTw.doneAt + DIALOGUE_GAP){
          phaseData.stage = 2;
          phaseData.bubbleTw = makeTypewriter([CONFIG.authority.entranceLine2], ARAM_BUBBLE_CPS, 0.4);
          phaseData.bubbleStart = phaseElapsed;
        }
      } else if(phaseData.stage===2){
        const local = phaseElapsed-phaseData.bubbleStart;
        updateTypewriterAudio(phaseData.bubbleTw, local);
        if(local > phaseData.bubbleTw.doneAt + DIALOGUE_HOLD){
          // letterbox out / lights up / music slams back in, THEN the chase
          phaseData.stage = 3;
          phaseData.stage3At = phaseElapsed;
          if(actx) duckUp(actx.currentTime, 1.0);
        }
      } else if(phaseData.stage===3){
        if(phaseElapsed-phaseData.stage3At > ARAM_LETTERBOX_OUT_DUR) enterPhase('beat4_chase');
      }
      break;
    }
    case 'beat4_chase': {
      if(stats.reviews>=D('reviewsNeeded')){ enterPhase('beat4_turngood'); break; }
      if(player.hearts<=0){ gameOverReason='beat4'; enterPhase('gameover'); break; }
      break;
    }
    case 'beat4_turngood': {
      if(phaseData.stage===0 && phaseElapsed>1.5){
        phaseData.stage = 1;
        aram.turnedGood = true;
        triggerShake(5, 0.3);
        for(const d of diners){ if(!d.walking && !d.retired) d.bounceT = 0.001; }
        spawnHaBurst(diners[0].x, diners[0].y-40, gameT);
        spawnHaBurst(diners[2].x, diners[2].y-40, gameT);
        spawnHaBurst(diners[3].x, diners[3].y-40, gameT);
        spawnHaBurst(woman.x, woman.y-40, gameT);
        spawnHaBurst(boss.x, boss.y-40, gameT);
        spawnSparkleBurst(aram.x, aram.y-60, 14, gameT);
        phaseData.bubbleTw = makeTypewriter([CONFIG.authority.turnGoodLine1], 18, 0.4);
        phaseData.bubbleStart = phaseElapsed;
        setBeatMusic('celebration');
        if(actx){
          const now = actx.currentTime;
          playFanfare(now);
          duckUp(now, 1.0);
        }
      } else if(phaseData.stage===1){
        const local = phaseElapsed-phaseData.bubbleStart;
        updateTypewriterAudio(phaseData.bubbleTw, local);
        if(local > phaseData.bubbleTw.doneAt + DIALOGUE_GAP){
          phaseData.stage = 2;
          phaseData.bubbleTw = makeTypewriter([CONFIG.authority.turnGoodLine2], 18, 0.4);
          phaseData.bubbleStart = phaseElapsed;
        }
      } else if(phaseData.stage===2){
        const local = phaseElapsed-phaseData.bubbleStart;
        updateTypewriterAudio(phaseData.bubbleTw, local);
        if(local > phaseData.bubbleTw.doneAt + DIALOGUE_HOLD) enterPhase('celebration');
      }
      break;
    }
    case 'celebration': {
      const participants = phaseData.participants;
      const convT = clamp01(phaseElapsed/1.2);
      for(let i=0;i<participants.length;i++){
        const sp = phaseData.startPositions[i], tp = phaseData.targets[i];
        participants[i].x = lerp(sp.x, tp.x, convT);
        participants[i].y = lerp(sp.y, tp.y, convT);
      }
      // keep Aram's own bob animating (his bounce is driven by walkAnimT,
      // which normally only advances while actually chasing)
      aram.walkAnimT += dt;
      // continuous staggered hop for the 3 remaining seated diners (woman/
      // boss/Aram already bob continuously off gameT/walkAnimT on their own)
      for(const idx of [0,2,3]){
        const d = diners[idx];
        if(d.walking || d.retired) continue;
        if(d.bounceT<=0) d.bounceT = 0.001 + CELEB_BOUNCE_OFFSET[idx];
      }
      // continuous staggered HA + occasional sparkle bursts, one cadence per participant
      for(let i=0;i<participants.length;i++){
        const interval = 0.6 + (i%3)*0.15;
        if(phaseElapsed - phaseData.lastHaAt[i] >= interval){
          phaseData.lastHaAt[i] = phaseElapsed;
          spawnHaBurst(participants[i].x, participants[i].y-40, gameT);
          if((i+Math.floor(phaseElapsed))%2===0) spawnSparkleBurst(participants[i].x, participants[i].y-30, 4, gameT);
        }
      }
      // falling gold/cream/terracotta confetti, looping for the duration
      for(const c of phaseData.confetti){
        c.x += c.vx*dt; c.y += c.vy*dt; c.rot += c.rotSpeed*dt;
        if(c.y > CH+10){ c.y = -10; c.x = Math.random()*CW; }
      }
      // a couple of soft gold screen flashes
      for(let i=0;i<phaseData.flashesAt.length;i++){
        if(!phaseData.flashesFired[i] && phaseElapsed>=phaseData.flashesAt[i]){
          phaseData.flashesFired[i] = true;
          flashAlpha = 0.4;
        }
      }
      if(phaseElapsed>CELEBRATION_DURATION) enterPhase(nextAfterCelebration());
      break;
    }
    case 'epilogueA': {
      // stages: 0 walk to door -> 1 gallery pops in + "DELETE ALL?" -> 2 beat
      // -> 3 thumbnails visibly vanish -> 4 "DELETED." (empty grid) -> 5
      // "ALL MY PHOTOS." + shocked reaction -> 6 hold reaction -> 7 walk back
      const EP_A_WALK_DUR = EP(1.4);
      const d = phaseData.diner;
      if(phaseData.stage===0){
        const t = clamp01(phaseElapsed/EP_A_WALK_DUR);
        d.x = lerp(phaseData.startX, phaseData.doorX, t);
        d.y = lerp(phaseData.startY, phaseData.doorY, t);
        if(t>=1){
          phaseData.stage = 1;
          phaseData.galleryPopAt = phaseElapsed;
          phaseData.bubbleTw = makeTypewriter([CONFIG.butterfingers.deleteAllLine], 12, 0.4);
          phaseData.bubbleStart = phaseElapsed;
        }
      } else if(phaseData.stage===1){
        const local = phaseElapsed-phaseData.bubbleStart;
        updateTypewriterAudio(phaseData.bubbleTw, local);
        if(local > phaseData.bubbleTw.doneAt + EP(DIALOGUE_GAP)){
          phaseData.stage = 2;
          phaseData.beatAt = phaseElapsed;
        }
      } else if(phaseData.stage===2){
        // "...beat..." before the thumbnails start popping away
        if(phaseElapsed - phaseData.beatAt > EP(0.5)){
          phaseData.stage = 3;
          phaseData.vanishAt = phaseElapsed;
        }
      } else if(phaseData.stage===3){
        const local = phaseElapsed - phaseData.vanishAt;
        const goneCount = epaGoneCount(local);
        if(goneCount > (phaseData.lastGoneCount||0)){
          const rect = epAPhoneRect(d);
          const cols=4, gap=4, sw=rect.w-16, sh=rect.h-16;
          const cellW=(sw-gap*(cols-1))/cols, cellH=(sh-gap*(3))/4;
          for(let g=phaseData.lastGoneCount||0; g<goneCount; g++){
            const idx = EPA_VANISH_ORDER[g];
            const col = idx%cols, row = (idx/cols)|0;
            const px = rect.x+8+col*(cellW+gap)+cellW/2, py = rect.y+8+row*(cellH+gap)+cellH/2;
            phaseData.puffs.push({x:px, y:py, born:phaseElapsed});
          }
          phaseData.lastGoneCount = goneCount;
        }
        if(goneCount>=16 && local > EPA_VANISH_WAVE*4 + EP(0.4)){ // brief hold on the empty grid
          phaseData.stage = 4;
          phaseData.bubbleTw = makeTypewriter([CONFIG.butterfingers.deletedLine], 12, 0.4);
          phaseData.bubbleStart = phaseElapsed;
        }
      } else if(phaseData.stage===4){
        const local = phaseElapsed-phaseData.bubbleStart;
        updateTypewriterAudio(phaseData.bubbleTw, local);
        if(local > phaseData.bubbleTw.doneAt + EP(1.3)){ // "...beat..." -- a longer comedic pause
          phaseData.stage = 5;
          phaseData.bubbleTw = makeTypewriter([CONFIG.butterfingers.allMyPhotosLine], 12, 0.4);
          phaseData.bubbleStart = phaseElapsed;
        }
      } else if(phaseData.stage===5){
        const local = phaseElapsed-phaseData.bubbleStart;
        updateTypewriterAudio(phaseData.bubbleTw, local);
        if(local > phaseData.bubbleTw.doneAt + EP(0.3)){
          phaseData.stage = 6;
          phaseData.reactAt = phaseElapsed;
          d.bounceT = 0.001;
          if(actx) playSadGliss(actx.currentTime);
          for(const idx of [0,3]){ // "the rest of the table" (not the boss seat, not the diner who left)
            const od = diners[idx];
            if(!od.walking && !od.retired) spawnHaBurst(od.x, od.y-40, gameT);
          }
        }
      } else if(phaseData.stage===6){
        if(phaseElapsed - phaseData.reactAt > EP(1.2)){
          phaseData.stage = 7;
          phaseData.walkBackStart = phaseElapsed;
        }
      } else if(phaseData.stage===7){
        const t = clamp01((phaseElapsed-phaseData.walkBackStart)/EP_A_WALK_DUR);
        d.x = lerp(phaseData.doorX, phaseData.startX, t);
        d.y = lerp(phaseData.doorY, phaseData.startY, t);
        if(t>=1){
          d.x = phaseData.startX; d.y = phaseData.startY;
          enterPhase(nextAfterEpilogueA());
        }
      }
      break;
    }
    case 'epilogueB': {
      // stages: 1 dining room (builder guy thoughtful) -> 2 plane home ->
      // 3 desk build-up -> 4 sharing with the 4 guys -> beat5_chase
      const EPB_SHOT1_DUR = EP(4.0), EPB_SHOT2_DUR = EP(4.0), EPB_SHOT3_DUR = EP(6.0), EPB_SHOT4_DUR = EP(4.0);
      if(phaseData.stage===1){
        if(phaseElapsed > EPB_SHOT1_DUR){ phaseData.stage=2; phaseData.stage2At=phaseElapsed; }
      } else if(phaseData.stage===2){
        if(phaseElapsed - phaseData.stage2At > EPB_SHOT2_DUR){ phaseData.stage=3; phaseData.stage3At=phaseElapsed; }
      } else if(phaseData.stage===3){
        const local = phaseElapsed - phaseData.stage3At;
        if(local - phaseData.lastKeyBlipAt >= 0.18){
          phaseData.lastKeyBlipAt = local;
          if(actx) playKeyBlip(actx.currentTime);
        }
        if(local > EPB_SHOT3_DUR){ phaseData.stage=4; phaseData.stage4At=phaseElapsed; }
      } else if(phaseData.stage===4){
        const local = phaseElapsed - phaseData.stage4At;
        const pingTimes = [0.3,1.3,2.3,3.3].map(EP);
        if(phaseData.pingIndex<4 && local>=pingTimes[phaseData.pingIndex]){
          const idx = phaseData.pingIndex;
          spawnSparkleBurst(EPB_FACE_XS[idx], EPB_FACE_Y+10, 6, gameT);
          if(actx) playSoftChime(actx.currentTime);
          phaseData.pingIndex++;
        }
        if(local > EPB_SHOT4_DUR){ enterPhase('beat5_chase'); }
      }
      break;
    }
    case 'beat5_chase': {
      // no damage/drain/death here -- resolution happens inside updateBeat5
      // (called from update()) once the final catch lands
      break;
    }
    case 'beat5_resolve': {
      if(phaseElapsed > 2.2) enterPhase('freeze');
      break;
    }
    case 'freeze': {
      if(phaseElapsed>1.5) enterPhase('endcard');
      break;
    }
    case 'endcard': break;
    case 'gameover': {
      // hard mode: losing is real -- no mid-beat retry, straight to the lose card
      if(phaseElapsed>GAMEOVER_HOLD) enterPhase(hardMode ? 'losecard' : 'retrycard');
      break;
    }
    case 'retrycard': break;
    case 'losecard': break;
  }
}

function update(dt){
  updatePlayerMovement(dt);
  updateDiners(dt);
  updateBoss(dt);
  updateAram(dt);
  updateReviewers(dt);
  updateBeat5(dt);
  updateNapkins(dt, gameT);
  updateBottles(dt, gameT);
  resolveLandings();
  updatePhase(dt);
  updateLaughDrain(dt);
  if(flashAlpha>0) flashAlpha = Math.max(0, flashAlpha - 3*dt);
  if(controlsHintAlpha>0 && ((hasMovedOnce && hasActionedOnce) || gameT>=10)){
    controlsHintAlpha = Math.max(0, controlsHintAlpha - dt/0.5); // 0.5s fade
  }
  if(pendingCard && gameT>=pendingCardAt){
    activeCard = pendingCard;
    cardsShown[activeCard.key] = true;
    pendingCard = null;
    cardT = 0;
  }
}

/* ======================================================================
   ACTIONS
   ====================================================================== */
function ensureAudioStarted(){
  if(!actx){
    initAudio();
    setBeatMusic('dinner');
    // hold the loop understudy silent briefly -- on a normal connection the
    // real track decodes and starts well inside this window, so it never
    // makes a sound at all
    bgmGraceUntil = performance.now() + 3000;
    tryDecodeMusic(); // decode needs the context that now exists
  }
  if(actx.state==='suspended' && actx.resume){
    const p = actx.resume();
    if(p && typeof p.then==='function') p.then(tryStartMusic);
  }
  tryStartMusic(); // no-op unless decoded, context running, and not yet started
}
function handleAction(){
  // unlock/resume audio FIRST -- this must happen on every user gesture,
  // even ones the guards below swallow, or a mouse-only player can sit at
  // the mode-select screen with a permanently suspended AudioContext
  ensureAudioStarted();
  if(rotatePromptActive) return; // frozen until the phone is turned to landscape
  if(modeSelectPending) return; // selection is handled by the mode-select keydown/pointer branches
  hasActionedOnce = true;
  if(activeCard){ activeCard = null; return; }
  if(phase==='prompt') triggerForFree();
  else if(phase==='story') triggerTooSoon();
  else if(phase==='boss' && player.hasBottle) throwBottle();
  else if(phase==='beat4_chase') tryBeg();
  else if(phase==='beat5_chase') tryAskReset();
  else if(phase==='retrycard'){
    if(gameOverReason==='beat4') retryBeat4();
    else if(gameOverReason==='beat1') retryBeat1();
    else retryBeat2();
  }
  // both forward location.hash so a `#cfg=` fragment override stays attached
  // across the game->intro navigation (see intro/engine.js's triggerSkip for
  // the matching intro->game forward; '' when there's no fragment, a no-op
  // for every file-CONFIG game).
  else if(phase==='losecard') window.location.href = '../intro/' + location.hash;
  else if(phase==='endcard') window.location.href = '../intro/' + location.hash;
}
/* Beat 1 game over (hard-mode early-press death with no floor, or the new
   normal-mode laugh-drain death) -- restarts the CURRENT round at its story.
   roundIndex is left untouched on purpose ("round progress preserved") and
   stats keep counting, matching retryBeat2/retryBeat4's conventions. */
function retryBeat1(){
  player.hearts = 6; player.canMove = true;
  heartPickups = [];
  laughDrainTimer = 0;
  enterPhase('story');
}
function retryBeat2(){
  player.hearts = 6; player.hasBottle = false; player.canMove = true;
  napkins = []; bottles = []; heartPickups = [];
  bottlePickup.active = true;
  enterPhase('boss');
}
function retryBeat4(){
  player.hearts = 6; player.canMove = true;
  napkins = []; bottles = []; heartPickups = [];
  aram.contactCooldown = 0;
  // cardsShown deliberately untouched -- ARAM HAS ARRIVED already shown once
  enterPhase('beat4_chase');
}

/* ======================================================================
   HUD + END CARD
   ====================================================================== */
function drawHUD(ctx){
  const slots = player.maxHearts/2;
  // during Beat 1, the chip the next drain tick will hit pulses/fades so the
  // meter reads as "the laughter is dying" ahead of time, not just after
  const pulseSlot = BEAT1_PHASES.has(phase) ? drainTargetSlot() : -1;
  const drainProgress = BEAT1_PHASES.has(phase) ? laughDrainTimer/D('laughDrainInterval') : 0;
  for(let i=0;i<slots;i++){
    const unit = i*2;
    let fill = 0;
    if(player.hearts >= unit+2) fill = 1;
    else if(player.hearts >= unit+1) fill = 0.5;
    if(i===pulseSlot && fill>0){
      ctx.save();
      ctx.globalAlpha = drainPulseAlpha(drainProgress, gameT);
      drawHeart(ctx, 16+i*28, 16, 3.0, fill);
      ctx.restore();
    } else {
      drawHeart(ctx, 16+i*28, 16, 3.0, fill);
    }
  }
  updateAndDrawDrainPuffs(ctx);
  if(player.hasBottle) drawBottle(ctx, 18, 50, 2.2);
  // hidden during 'fakedeath' -- the bar "shatters" at the fake-kill hit and
  // only reappears (with 4 segments) once phase 2 actually starts.
  if(boss.visible && (boss.state==='active' || boss.state==='phase2active')){
    drawReadingTextOutlined(ctx, CONFIG.judge.title, CW/2, 8, 16, PAL.cream, '#000000', 'center');
    const segs = boss.maxHp, segW=24, gap=3;
    const totalW = segs*segW+(segs-1)*gap, bx = CW/2-totalW/2, by = 36;
    for(let i=0;i<segs;i++){
      ctx.fillStyle = (i<boss.hp) ? '#c9394a' : PAL.heartEmpty;
      ctx.fillRect(bx+i*(segW+gap), by, segW, 10);
    }
  }
  if(phase==='beat4_chase' || phase==='beat4_turngood'){
    const need = D('reviewsNeeded');
    drawReadingTextOutlined(ctx, stats.reviews+'/'+need, CW/2, 8, 18, PAL.gold, '#000000', 'center');
    const starsW = (need-1)*36, starsX0 = CW/2 - starsW/2;
    for(let i=0;i<need;i++) drawStarIcon(ctx, starsX0+i*36, 34, i<stats.reviews, 5);
  }
}
/* fading start-of-play hint, bottom-center. Suppressed whenever the
   'CATCH THE LAUGHS!' hint (also bottom-center) could be showing, rather
   than offsetting -- the capture window is short/frantic and doesn't need
   two lines of on-screen text competing for attention. */
function drawControlsHint(ctx){
  if(controlsHintAlpha<=0) return;
  ctx.save();
  ctx.globalAlpha = controlsHintAlpha;
  drawReadingTextOutlined(ctx, controlsHintText(), CW/2, CH-38, 16, PAL.cream, '#000000', 'center');
  ctx.restore();
}
function drawExclaimPrompt(ctx, x, y, t){
  const bob = Math.abs(Math.sin(t*6))*10;
  drawChunkyText(ctx, '!', x, y-50-bob, 26, PAL.gold, PAL.outline, 'center');
}
function drawUnisonBubbles(ctx, growT){
  const spots = [
    {x:diners[0].x, y:diners[0].y-64},
    {x:diners[CRITIC_INDEX].x, y:diners[CRITIC_INDEX].y-64},
    {x:diners[2].x, y:diners[2].y-64},
    {x:diners[3].x, y:diners[3].y-64},
    {x:woman.x, y:woman.y-64}
  ];
  for(const s of spots) drawAutoBubble(ctx, CONFIG.punchline, s.x, s.y, 16, growT);
}

/* ======================================================================
   BASE SCENE + PER-PHASE DRAW
   ====================================================================== */
function drawBaseScene(ctx){
  // gate every tile/character-sprite draw behind assetsReady (same convention
  // as the intro's drawScene2/3): calling rawTile/tintedSprite before the
  // sheet has loaded is now harmless (it no longer poisons the cache with a
  // blank canvas -- see rawTile/tintedSprite), but there's still no reason to
  // draw a guaranteed-blank sprite for the one or two frames before load.
  if(assetsReady) drawArena(ctx);
  drawTableAndProps(ctx);
  if(assetsReady){
    for(const d of diners){
      if(d.walking || d.retired) continue;
      let bx = d.x, by = d.y;
      if(d.bounceT>0) by -= Math.abs(Math.sin(d.bounceT*14))*8;
      if(d.shakeT>0) bx += Math.sin(d.shakeT*40)*3;
      drawDinerSprite(ctx, d.col, d.row, bx, by, d.flip);
    }
    const cd = diners[CRITIC_INDEX];
    if(cd.walking && !cd.retired) drawDinerSprite(ctx, cd.col, cd.row, cd.x, cd.y, false);
  }
  if(bottlePickup.active) drawBottlePickupCue(ctx, gameT);
  drawBottles(ctx);
  drawNapkins(ctx);
  if(boss.doorPopT>0) drawBossDoorFrame(ctx, boss.doorPopT);
  if(assetsReady && boss.visible && boss.state!=='dead' && !(boss.duckT>0)){
    // slumped only for the initial collapse (before the record-scratch pop-up)
    // -- NOT for the whole fakedeath state, or he'd never visibly "pop back
    // up" for the JUST KIDDING. bubble. Ducking is handled separately below
    // (fully hidden, not just slumped) so a dodged throw reads unmistakably.
    const slumped = boss.state==='fakedeath' && boss.fdT<1.1;
    const growT = boss.transforming ? clamp01(boss.transformT/0.6)
      : (boss.shrinking ? 1-clamp01(boss.shrinkT/WIDOWMAKER_SHRINK_DUR) : 1);
    drawCritic(ctx, boss.x, boss.y, gameT, slumped, growT, boss.targetScale, boss.phase2);
  }
  if(boss.duckT>0){
    // he's dropped fully out of sight into the door frame -- label it so a
    // dodged throw doesn't just read as "nothing happened". Positioned well
    // above the door frame (not just above it) since the looming ~2.1x-scale
    // sprite's head can reach up past y~222 when he IS visible -- this stays
    // clear of that with margin even though the two never actually show at
    // the same time (he's fully hidden while ducking).
    drawPixelText(ctx, 'DUCKED!', BOSS_DOOR.x+BOSS_DOOR.w/2, 170, 16, PAL.gold, 'center');
  }
  if(boss.state==='dead') drawBossSagged(ctx, Math.max(0, 1-boss.deadT/1.2));
  if(assetsReady && woman.active){
    // she turns toward the chef for her sincere Beat 3 tribute line (moved
    // out of beat3_revive when the Widowmaker beat was inserted between them)
    const facingPlayer = phase==='beat3_tribute' && player.x < woman.x;
    drawWoman(ctx, woman.x, woman.y, gameT, facingPlayer);
  }
  if(assetsReady && aram.active) drawAram(ctx, aram.x, aram.y, gameT, aram.walkAnimT, aram.turnedGood);
  if(phase==='beat4_chase' || phase==='beat4_turngood') drawReviewerOverlays(ctx);
  drawShadow(ctx, player.x, player.y, 10, 0.3);
  const blinking = player.iframes>0 && Math.floor(gameT*12)%2===0;
  if(assetsReady && !blinking) drawChef(ctx, player.x, player.y, player.facing, player.walkAnimT);
  if(player.hasBottle) drawHeldBottle(ctx, player.x, player.y, player.facing, player.walkAnimT);
  drawHeartPickups(ctx, gameT);
  updateAndDrawParticles(ctx, 0, gameT);
  // player's own speech bubble (wine-snob insults on every throw, "PLEASE.
  // FIVE STARS." while begging) -- lives here (not in a per-phase draw fn)
  // so it renders identically during both the boss fight and Beat 4.
  if(playerBubble && (gameT-playerBubble.born)<PLAYER_BUBBLE_HOLD){
    // clamp so it can't climb into the HP bar / review counter even if the
    // chef hugs the top wall
    const by = Math.max(70, player.y-64);
    drawAutoBubble(ctx, playerBubble.text, player.x, by, 16, 1);
  }
}
/* Beat 4: a small phone rect (blinking "tap") over a reviewer mid-beg, or a
   small permanent gold star once they've handed over their five stars */
/* small phone rect + tapping blink, held over a character's head -- shared by
   Beat 4's begging reviewers, Epilogue A's "delete all?" beat, and Beat 5's
   tech-support chase. `tapT` just needs to be *some* clock that keeps
   advancing (beggingT, phaseElapsed, gameT*k...) -- only its parity matters. */
function drawPhoneIcon(ctx, x, y, tapT){
  const tap = Math.floor(tapT*6)%2===0;
  ctx.save();
  ctx.fillStyle = '#1c1c1c';
  ctx.fillRect(x-9, y-96, 18, 26);
  ctx.fillStyle = tap ? '#8fd0ff' : '#4a6a80';
  ctx.fillRect(x-6, y-92, 12, 18);
  ctx.restore();
}
function drawReviewerOverlays(ctx){
  for(const r of getReviewerList()){
    if(r.begging){
      drawPhoneIcon(ctx, r.x, r.y, r.beggingT);
    } else if(r.reviewGiven){
      drawStarIcon(ctx, r.x-8, r.y-98, true, 4);
    }
  }
}

/* `revealed` is [count0, count1] chars-per-line to show; pass null to show
   the lines fully typed (used once the 'prompt' phase takes over from 'story'
   -- that phase resets phaseElapsed, so the typewriter's own live reveal
   calculation no longer applies, but the bubble should stay fully visible). */
function drawStoryBubble(ctx, tw, revealed){
  const d = diners[0];
  const lp = 16, pad = 12;
  const w0 = measureReadingText(ctx, tw.lines[0], lp), w1 = measureReadingText(ctx, tw.lines[1], lp);
  const w = Math.max(w0,w1)+pad*2, h = 80;
  const by = d.y-64-h-4;
  // clamped horizontally so the widest line (round B's) can never push the
  // bubble off either edge of the canvas
  const bx = Math.max(6, Math.min(CW-w-6, d.x-w/2));
  drawSpeechBubble(ctx, bx, by, w, h, 1);
  const state = revealed || [tw.lines[0].length, tw.lines[1].length];
  drawReadingText(ctx, tw.lines[0].slice(0,state[0]), bx+pad, by+14, lp, '#000000', 'left');
  drawReadingText(ctx, tw.lines[1].slice(0,state[1]), bx+pad, by+42, lp, '#000000', 'left');
}
function drawPhaseStory(ctx){
  drawBaseScene(ctx);
  // during the reaction window right after an early punchline, swap the
  // storyteller's bubble for "HE WASN'T DONE." instead of the (paused) story
  // text, so the two never have to share the same anchor point at once.
  if(phaseData.tooSoonBubbleAt!=null && gameT-phaseData.tooSoonBubbleAt<TOO_SOON_HOLD){
    drawAutoBubble(ctx, "HE WASN'T DONE.", diners[0].x, diners[0].y-64, 16, 1);
  } else {
    drawStoryBubble(ctx, phaseData.tw, phaseData.tw.getState(phaseData.typeT));
  }
  if(phaseData.tooSoonPopAt!=null){
    const age = gameT-phaseData.tooSoonPopAt;
    if(age<0.7){
      ctx.save(); ctx.globalAlpha = Math.max(0,1-age/0.7);
      drawChunkyText(ctx, CONFIG.punchline, player.x, player.y-70, 22, PAL.gold, PAL.outline, 'center');
      ctx.restore();
    }
  }
}
function drawPhasePrompt(ctx){
  drawBaseScene(ctx);
  drawStoryBubble(ctx, phaseData.tw, null);
  drawExclaimPrompt(ctx, player.x, player.y, gameT);
}
/* pop-in / hold / fade envelope for the capture-phase banner -- timed off
   phaseElapsed, which already correctly freezes while the (first-capture-only)
   tutorial card is up, so the banner effectively resumes/finishes playing out
   right after the card is dismissed rather than burning its time hidden
   behind the dim. Returns null once fully faded. */
function bannerAnim(t, popIn, hold, fade){
  if(t<0) return null;
  if(t<popIn){ const p=t/popIn; return {alpha:p, scale:0.6+0.4*p}; }
  if(t<popIn+hold) return {alpha:1, scale:1};
  if(t<popIn+hold+fade){ const p=(t-popIn-hold)/fade; return {alpha:1-p, scale:1}; }
  return null;
}
function drawPhaseCapture(ctx){
  drawBaseScene(ctx);
  if(phaseElapsed<0.7){
    drawChunkyText(ctx, CONFIG.punchline, CW/2, KITCHEN_GLOW.y-140, 56, PAL.gold, PAL.outline, 'center');
    if(phaseData.perfect) drawChunkyText(ctx, 'PERFECT!', CW/2, KITCHEN_GLOW.y-200, 24, PAL.cream, PAL.outline, 'center');
  }
  // prominent display-class banner, every capture phase (not just the first)
  const banner = bannerAnim(phaseElapsed, 0.2, 1.2, 0.4);
  if(banner){
    ctx.save();
    ctx.globalAlpha = banner.alpha;
    ctx.translate(CW/2, CH*0.28);
    ctx.scale(banner.scale, banner.scale);
    drawChunkyText(ctx, 'CATCH THE LAUGHS!', 0, 0, 30, PAL.gold, PAL.outline, 'center');
    ctx.restore();
  }
  if(roundIndex===0) drawReadingTextOutlined(ctx, 'CATCH THE LAUGHS!', CW/2, CH-36, 16, PAL.cream, '#000000', 'center');
}
function drawPhaseBreather(ctx){ drawBaseScene(ctx); }
function drawPhaseBeat2Intro(ctx){
  drawBaseScene(ctx);
  if(phaseElapsed<1.6){
    const d = diners[CRITIC_INDEX];
    drawAutoBubble(ctx, d.bubbleText, d.x, d.y-64, 16, 1);
  }
}
function drawPhaseBoss(ctx){
  drawBaseScene(ctx);
  if(boss.state==='fakedeath'){
    if(boss.fdBubbleStage===1 || boss.fdBubbleStage===2){
      const t = boss.fdT-boss.fdBubbleStart;
      const state = boss.fdBubbleTw.getState(t);
      drawAutoBubble(ctx, boss.fdBubbleTw.lines[0].slice(0,state[0]), boss.x, boss.y-64, 16, 1);
    }
  } else if(boss.bubble && (gameT-boss.bubble.born)<CRITIQUE_BUBBLE_HOLD){
    drawAutoBubble(ctx, boss.bubble.text, boss.x, boss.y-64, 16, 1);
  }
  // playerBubble itself now renders from inside drawBaseScene (see there) so
  // it also shows up during Beat 4's begging, not just the boss fight.
}
function drawPhaseBeat3Intro(ctx){
  drawBaseScene(ctx);
  if(phaseData.stage>=1 && phaseData.bubbleTw){
    const local = phaseElapsed-phaseData.bubbleStart;
    const state = phaseData.bubbleTw.getState(local);
    drawAutoBubble(ctx, phaseData.bubbleTw.lines[0].slice(0,state[0]), woman.x, woman.y-64, 16, 1);
  }
}
function drawPhaseBeat3Revive(ctx){ drawBaseScene(ctx); }
/* THE WIDOWMAKER -- see updatePhase's 'beat3_windowmaker' case for the
   stage machine. Stages 0/1: the critic's mock bubbles (drawn at his own
   position). Stage 2: diner0's retort bubble. Stage 3: the spider arcs
   from diner0 to the (about-to-be-former) boss door, with an item-get pop
   label. Stages 4-5 (impact/shrink, walk back) are presentation purely via
   boss.shrinking/diners[CRITIC_INDEX].walking -- drawBaseScene already
   renders both cases, nothing extra to draw here. Stage 6: the seated
   redemption bubble, at his own (now-restored) seat. */
function drawPhaseBeat3Windowmaker(ctx){
  drawBaseScene(ctx);
  if(phaseData.stage<=1 && phaseData.bubbleTw){
    const local = phaseElapsed-phaseData.bubbleStart;
    const state = phaseData.bubbleTw.getState(local);
    drawAutoBubble(ctx, phaseData.bubbleTw.lines[0].slice(0,state[0]), boss.x, boss.y-64, 16, 1);
  } else if(phaseData.stage===2 && phaseData.bubbleTw){
    const local = phaseElapsed-phaseData.bubbleStart;
    const state = phaseData.bubbleTw.getState(local);
    drawAutoBubble(ctx, phaseData.bubbleTw.lines[0].slice(0,state[0]), diners[0].x, diners[0].y-64, 16, 1);
  } else if(phaseData.stage===3){
    const local = phaseElapsed - phaseData.throwStart;
    const t = clamp01(local/WIDOWMAKER_THROW_DUR);
    const x = lerp(phaseData.throwFromX, phaseData.throwToX, t);
    const y = lerp(phaseData.throwFromY, phaseData.throwToY, t);
    const vz = 0.5*GRAVITY*WIDOWMAKER_THROW_DUR;
    const z = vz*local - 0.5*GRAVITY*local*local;
    drawShadow(ctx, phaseData.throwToX, phaseData.throwToY, 6, 0.3);
    drawWidowmaker(ctx, x, y-Math.max(0,z), 2, local*Math.PI*4);
    const banner = bannerAnim(local, 0.12, Math.max(0.1,WIDOWMAKER_THROW_DUR-0.24), 0.5);
    if(banner){
      ctx.save();
      ctx.globalAlpha = banner.alpha;
      ctx.translate(CW/2, CH*0.2);
      ctx.scale(banner.scale, banner.scale);
      drawChunkyText(ctx, WIDOWMAKER_ITEM_LABEL, 0, 0, 24, PAL.gold, PAL.outline, 'center');
      ctx.restore();
    }
  } else if(phaseData.stage===6 && phaseData.bubbleTw){
    const local = phaseElapsed-phaseData.bubbleStart;
    const state = phaseData.bubbleTw.getState(local);
    const cd = diners[CRITIC_INDEX];
    drawAutoBubble(ctx, phaseData.bubbleTw.lines[0].slice(0,state[0]), cd.x, cd.y-64, 16, 1);
  }
}
function drawPhaseBeat3Tribute(ctx){
  drawBaseScene(ctx);
  if(phaseData.bubbleTw){
    const local = phaseElapsed-phaseData.bubbleStart;
    const state = phaseData.bubbleTw.getState(local);
    drawAutoBubble(ctx, phaseData.bubbleTw.lines[0].slice(0,state[0]), woman.x, woman.y-64, 16, 1);
  }
}
function drawPhaseBeat3Silence(ctx){ drawBaseScene(ctx); }
function drawPhaseBeat3Finale(ctx){
  drawBaseScene(ctx);
  drawUnisonBubbles(ctx, 1);
  drawChunkyText(ctx, CONFIG.punchline, CW/2, CH/2-20, 60, PAL.gold, PAL.outline, 'center');
}
/* room darkens except a light pool at the left door, for Aram's entrance */
function drawAramDim(ctx, alpha){
  if(alpha<=0) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = '#000'; ctx.fillRect(0,0,CW,CH); ctx.restore();
  const cx = LEFT_DOOR.x+30, cy = LEFT_DOOR.y+LEFT_DOOR.h/2;
  const bands = [[160,0.05],[120,0.09],[85,0.14],[55,0.22],[28,0.34]];
  for(const [r,a] of bands){
    ctx.save(); ctx.globalAlpha = a;
    drawPixelCircle(ctx, cx, cy, r, '#fff3d6', 6);
    ctx.restore();
  }
}
function drawLetterbox(ctx, t){
  if(t<=0) return;
  const h = 70*t;
  ctx.save(); ctx.fillStyle = '#000';
  ctx.fillRect(0,0,CW,h);
  ctx.fillRect(0,CH-h,CW,h);
  ctx.restore();
}

/* ---------------- Epilogue B visuals (the meta-joke cutaway) ---------------- */
/* deterministic star field (no Math.random at draw time), same spirit as the
   intro's own "no flicker" skyline convention */
const EPB_STARS = (function(){
  const arr = [];
  for(let i=0;i<40;i++) arr.push({x:(i*53+17)%CW, y:(i*37+11)%260});
  return arr;
})();
const EPB_SKYLINE = [[0,90,70],[90,70,110],[170,100,50],[280,80,130],[380,120,90],[520,90,60],[630,110,100],[760,90,75],[860,100,60]];
function drawEpBNightSky(ctx){
  ctx.fillStyle = PAL.night; ctx.fillRect(0,0,CW,CH);
  ctx.fillStyle = '#fff3c9';
  for(const s of EPB_STARS) ctx.fillRect(s.x, s.y, 2, 2);
  ctx.fillStyle = '#1c1c36';
  for(const [bx,bw,bh] of EPB_SKYLINE) ctx.fillRect(bx, CH-bh, bw, bh);
}
function drawEpBPlane(ctx, x, y){
  ctx.fillStyle = '#cfd6de';
  ctx.fillRect(x-18, y-2, 36, 4);
  ctx.fillRect(x-4, y-8, 8, 4);
  ctx.fillRect(x+6, y-6, 3, 12);
  drawPixelCircle(ctx, x+16, y, 2, '#fff3c9', 2);
}
/* the "tiny recognizable dinner scene" that progressively builds in below the
   mini title on the desk screen -- reuses the real table/diner draw helpers
   (drawDinerSprite) at a small scale rather than bespoke art. */
function drawEpBMiniDinner(ctx, cx, cy){
  ctx.fillStyle = PAL.wood;
  ctx.fillRect(cx-17, cy-6, 34, 13);
  const offs = [ [-15,-10], [11,-10], [-15, 9], [11, 9] ];
  for(let i=0;i<4;i++){
    const def = DINER_DEFS[i];
    drawDinerSprite(ctx, def.col, def.row, cx+offs[i][0], cy+offs[i][1], def.flip, 0.5);
  }
}
function drawEpBDeskRoom(ctx, t){
  ctx.fillStyle = '#140f18'; ctx.fillRect(0,0,CW,CH);
  const deskX = CW/2, deskY = 360;
  // the screen "lights up" over the first beat of the shot
  const glowT = clamp01(t/0.8);
  ctx.save(); ctx.globalAlpha=0.25*glowT; drawPixelCircle(ctx, deskX, deskY-60, 90, '#8fd0ff', 8); ctx.restore();
  ctx.fillStyle = '#0a0e14'; ctx.fillRect(deskX-90, deskY-120, 180, 110);
  ctx.save();
  ctx.globalAlpha = 0.3+0.7*glowT;
  ctx.fillStyle = '#123047'; ctx.fillRect(deskX-80, deskY-110, 160, 90);
  ctx.restore();
  // 1) the mini title lockup pops in first
  const titleP = clamp01((t-1.0)/0.4);
  if(titleP>0){
    const tc = getMiniTitleCanvas();
    const scale = 0.5*(0.7+0.3*titleP);
    ctx.save();
    ctx.globalAlpha = titleP;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tc, deskX-tc.width*scale/2, deskY-104, tc.width*scale, tc.height*scale);
    ctx.restore();
  }
  // 2) then, below it, the tiny dinner scene builds in
  const sceneP = clamp01((t-2.6)/0.6);
  if(sceneP>0){
    ctx.save();
    ctx.globalAlpha = sceneP;
    drawEpBMiniDinner(ctx, deskX, deskY-58);
    ctx.restore();
  }
  ctx.fillStyle = PAL.wood; ctx.fillRect(deskX-100, deskY-10, 200, 14);
  drawTile(ctx, rawTile(imgDungeon, DINER_DEFS[3].col, DINER_DEFS[3].row), deskX-16, deskY-70, 2, false);
  // typing animation + key blips run the whole shot (handled by the caller)
  const tap = Math.floor(t*7)%2===0;
  ctx.fillStyle = tap ? '#f3e9d2' : '#c9b98a';
  ctx.fillRect(deskX-14, deskY-6, 10, 6);
  ctx.fillRect(deskX+4, deskY-6, 10, 6);
}
/* small drifting "thinking" dots, used above the builder guy's head in
   Epilogue B shot 1 (dining room). Purely time-driven (phaseElapsed), no
   Math.random, so it's deterministic/testable like the rest of the file. */
function drawThoughtDots(ctx, x, y, t){
  const cyc = t % 1.6;
  for(let i=0;i<3;i++){
    const start = i*0.3;
    const local = cyc-start;
    if(local<0 || local>1.0) continue;
    const p = clamp01(local/1.0);
    const dx = x + 14 + i*10, dy = y - 70 - i*14 - p*6;
    const alpha = Math.sin(p*Math.PI);
    if(alpha<=0) continue;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = PAL.cream;
    const s = 3+i*1.5;
    ctx.fillRect(dx-s/2, dy-s/2, s, s);
    ctx.restore();
  }
}
const EPB_FACE_XS = [300, 420, 540, 660], EPB_FACE_Y = 260;
function drawEpBSharing(ctx, pingIndex){
  ctx.fillStyle = '#140f18'; ctx.fillRect(0,0,CW,CH);
  for(let i=0;i<4;i++){
    const fx = EPB_FACE_XS[i], fy = EPB_FACE_Y;
    const def = DINER_DEFS[i];
    drawTile(ctx, rawTile(imgDungeon, def.col, def.row), fx-32, fy-64, 2.5, false);
    if(i < pingIndex) drawPhoneIcon(ctx, fx, fy+14, gameT*6);
  }
}
function drawPhaseBeat4Intro(ctx){
  drawBaseScene(ctx);
  const dimT = clamp01(phaseElapsed/ARAM_SLAM_AT);
  let dim = 0.6*dimT;
  let letterboxT = clamp01((phaseElapsed-ARAM_SLAM_AT*0.5)/0.6);
  if(phaseData.stage===3){
    // final beat: letterbox slides out, lights come back up
    const p = clamp01((phaseElapsed-phaseData.stage3At)/ARAM_LETTERBOX_OUT_DUR);
    dim = 0.6*(1-p);
    letterboxT = 1-p;
  }
  drawAramDim(ctx, dim);
  if(phaseData.stage>=1 && phaseData.bubbleTw){
    const local = phaseElapsed-phaseData.bubbleStart;
    const state = phaseData.bubbleTw.getState(local);
    drawAutoBubble(ctx, phaseData.bubbleTw.lines[0].slice(0,state[0]), aram.x, aram.y-130, 16, 1);
  }
  drawLetterbox(ctx, letterboxT);
}
function drawPhaseBeat4Chase(ctx){ drawBaseScene(ctx); }
function drawPhaseBeat4TurnGood(ctx){
  drawBaseScene(ctx);
  if(phaseData.stage>=1 && phaseData.bubbleTw){
    const local = phaseElapsed-phaseData.bubbleStart;
    const state = phaseData.bubbleTw.getState(local);
    drawAutoBubble(ctx, phaseData.bubbleTw.lines[0].slice(0,state[0]), aram.x, aram.y-130, 16, 1);
  }
}
function drawPhaseCelebration(ctx){
  drawBaseScene(ctx);
  // warm lighting lift
  ctx.save(); ctx.fillStyle = 'rgba(255,214,140,0.14)'; ctx.fillRect(0,0,CW,CH); ctx.restore();
  drawConfetti(ctx, phaseData.confetti||[]);
  for(const pop of (phaseData.textPops||[])){
    const banner = bannerAnim(phaseElapsed-pop.at, 0.15, 0.35, 0.25);
    if(banner){
      ctx.save();
      ctx.globalAlpha = banner.alpha;
      ctx.translate(pop.x, pop.y);
      ctx.scale(banner.scale, banner.scale);
      drawChunkyText(ctx, CONFIG.punchline, 0, 0, pop.px, PAL.gold, PAL.outline, 'center');
      ctx.restore();
    }
  }
  // one final giant centered slam near the end, held into the freeze phase
  if(phaseElapsed > CELEBRATION_DURATION-1.0){
    drawChunkyText(ctx, CONFIG.punchline, CW/2, CH/2-20, 60, PAL.gold, PAL.outline, 'center');
  }
}
/* ---------------- Epilogue A visuals (the bathroom photo deletion) ----------------
   A zoomed phone inset showing a 16-thumbnail photo gallery, then visibly
   popping the thumbnails away a few at a time -- the deletion has to be seen
   on screen, not just implied by the bubble text. */
const EPA_THUMB_COLORS = ['#e8b84b','#c96f4a','#7ec8e3','#8fd0ff','#e0645a','#a3d977','#f3e9d2','#6b2b1f','#ffb347','#4a6a80','#8a5a30','#d9a6c2','#5ac8a8','#c9b98a','#3c7a5e','#e89ba0'];
const EPA_VANISH_ORDER = [5,12,1,9,14,2,7,15,0,10,4,13,3,11,6,8]; // fixed pop-away order (deterministic)
const EPA_VANISH_WAVE = 0.12, EPA_VANISH_PER_WAVE = 4; // 4 waves of 4 = 16, ~0.48s total
const EPA_PHONE_W = 150, EPA_PHONE_H = 200;
function epaGoneCount(local){
  if(local<0) return 0;
  return Math.min(16, Math.floor(local/EPA_VANISH_WAVE)*EPA_VANISH_PER_WAVE);
}
function epAPhoneRect(d){
  const cx = Math.max(EPA_PHONE_W/2+10, Math.min(CW-EPA_PHONE_W/2-10, d.x));
  return { x: cx-EPA_PHONE_W/2, y: d.y+14, w: EPA_PHONE_W, h: EPA_PHONE_H };
}
function popInEnvelope(t, dur){
  const p = clamp01(t/dur);
  const eased = 1-(1-p)*(1-p);
  return { alpha: eased, scale: 0.7+0.3*eased };
}
/* thumbAliveCount thumbnails are shown, in EPA_VANISH_ORDER's surviving order
   (index 0 of the order array is the FIRST to vanish, so "still alive" means
   the tail of the order array once goneCount have been popped). */
function drawPhoneInset(ctx, rect, goneCount, envAlpha, envScale){
  ctx.save();
  ctx.globalAlpha = envAlpha;
  ctx.translate(rect.x+rect.w/2, rect.y+rect.h/2);
  ctx.scale(envScale, envScale);
  ctx.translate(-rect.w/2, -rect.h/2);
  ctx.fillStyle = '#1c1c1c';
  ctx.fillRect(0, 0, rect.w, rect.h);
  const sx = 8, sy = 8, sw = rect.w-16, sh = rect.h-16;
  ctx.fillStyle = '#0a0e14';
  ctx.fillRect(sx, sy, sw, sh);
  const cols = 4, rows = 4, gap = 4;
  const cellW = (sw-gap*(cols-1))/cols, cellH = (sh-gap*(rows-1))/rows;
  const goneSet = new Set(EPA_VANISH_ORDER.slice(0, goneCount));
  for(let i=0;i<16;i++){
    if(goneSet.has(i)) continue;
    const col = i%cols, row = (i/cols)|0;
    const tx = sx+col*(cellW+gap), ty = sy+row*(cellH+gap);
    ctx.fillStyle = EPA_THUMB_COLORS[i];
    ctx.fillRect(tx, ty, cellW, cellH);
  }
  ctx.restore();
}
function drawPhaseEpilogueA(ctx){
  drawBaseScene(ctx);
  const d = phaseData.diner;
  if(phaseData.stage>=1 && phaseData.stage<=6){
    drawPhoneIcon(ctx, d.x, d.y, phaseElapsed);
    const rect = epAPhoneRect(d);
    const fadeOutT = phaseData.stage===6 ? clamp01((phaseElapsed-phaseData.reactAt)/0.6) : 0;
    const env = popInEnvelope(phaseElapsed-(phaseData.galleryPopAt||0), 0.2);
    const alpha = env.alpha * (1-fadeOutT);
    if(alpha>0){
      const goneCount = phaseData.stage>=3 ? epaGoneCount(phaseElapsed-(phaseData.vanishAt||0)) : 0;
      drawPhoneInset(ctx, rect, goneCount, alpha, env.scale);
      for(const p of (phaseData.puffs||[])){
        const age = phaseElapsed-p.born;
        if(age<0 || age>0.4) continue;
        drawSparkle(ctx, p.x, p.y-age*20, 3, (1-age/0.4)*alpha, PAL.cream);
      }
    }
    if(phaseData.bubbleTw){
      const local = phaseElapsed-phaseData.bubbleStart;
      const state = phaseData.bubbleTw.getState(local);
      drawAutoBubble(ctx, phaseData.bubbleTw.lines[0].slice(0,state[0]), d.x, d.y-64, 16, 1);
    }
  }
}
function drawPhaseEpilogueB(ctx){
  if(phaseData.stage===1){
    drawBaseScene(ctx);
    drawThoughtDots(ctx, phaseData.builder.x, phaseData.builder.y, phaseElapsed);
    drawLetterbox(ctx, 1);
    drawReadingTextOutlined(ctx, CONFIG.builder.epBCaption1, CW/2, CH-70, 20, PAL.cream, '#000000', 'center');
    return;
  }
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,CW,CH);
  if(phaseData.stage===2){
    drawEpBNightSky(ctx);
    const t = clamp01((phaseElapsed-phaseData.stage2At)/4.0);
    drawEpBPlane(ctx, lerp(CW+40, -40, easeInOut(t)), 160);
    drawReadingTextOutlined(ctx, CONFIG.builder.epBCaption2, CW/2, CH-70, 20, PAL.cream, '#000000', 'center');
  } else if(phaseData.stage===3){
    drawEpBDeskRoom(ctx, phaseElapsed-phaseData.stage3At);
    drawReadingTextOutlined(ctx, CONFIG.builder.epBCaption3, CW/2, CH-70, 20, PAL.cream, '#000000', 'center');
  } else if(phaseData.stage===4){
    drawEpBSharing(ctx, phaseData.pingIndex);
    drawReadingTextOutlined(ctx, CONFIG.builder.epBCaption4, CW/2, CH-70, 20, PAL.cream, '#000000', 'center');
  }
  drawLetterbox(ctx, 1);
}
function drawPhaseBeat5Chase(ctx){
  drawBaseScene(ctx);
  const r = beat5Target();
  if(r.begging || r.fleeing) drawPhoneIcon(ctx, r.x, r.y, r.begging ? r.beggingT : gameT*6);
  if(r.bubble && (gameT-r.bubble.born)<CRITIQUE_BUBBLE_HOLD){
    drawAutoBubble(ctx, r.bubble.text, r.x, r.y-64, 16, 1);
  }
}
function drawPhaseBeat5Resolve(ctx){ drawBaseScene(ctx); }
/* 'freeze' is entered from Beat 5's resolution now -- just holds the final slam */
function drawPhaseFreeze(ctx){
  drawBaseScene(ctx);
  drawChunkyText(ctx, CONFIG.punchline, CW/2, CH/2-20, 60, PAL.gold, PAL.outline, 'center');
}
function drawPhaseEndcard(ctx){
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,CW,CH);
  drawChunkyText(ctx, CONFIG.punchline, CW/2, 130, 54, PAL.gold, PAL.outline, 'center');
  let y = 250;
  drawReadingText(ctx, 'LAUGHS CAUGHT: '+stats.heartsCaptured, CW/2, y, 18, PAL.cream, 'center'); y += 34;
  drawReadingText(ctx, 'HITS TAKEN: '+stats.hitsTaken, CW/2, y, 18, PAL.cream, 'center'); y += 34;
  if(BEAT2_ENABLED){
    drawReadingText(ctx, 'BOTTLES LANDED: '+stats.bottlesLanded, CW/2, y, 18, PAL.cream, 'center'); y += 34;
  }
  if(stats.tooSoon>0){
    drawReadingText(ctx, 'EARLY PUNCHLINES: '+stats.tooSoon, CW/2, y, 18, PAL.cream, 'center'); y += 34;
  }
  if(BEAT4_ENABLED){
    drawReadingText(ctx, 'FIVE-STAR REVIEWS: '+stats.reviews, CW/2, y, 18, PAL.cream, 'center'); y += 34;
  }
  if(EPILOGUE_B_ENABLED){
    drawReadingText(ctx, 'RESETS SUGGESTED: '+stats.resets, CW/2, y, 18, PAL.cream, 'center'); y += 34;
  }
  if(phaseData.hardCleared){
    y += 6;
    drawReadingText(ctx, 'SECOND SEATING CLEARED', CW/2, y, 18, PAL.gold, 'center'); y += 34;
  }
  y += 14;
  drawReadingText(ctx, phaseData.rank, CW/2, y, 24, PAL.gold, 'center');
  y += 60;
  if(!phaseData.wasBeatenBefore){
    // first-ever unlock -- shown prominently
    drawChunkyText(ctx, 'HARD MODE UNLOCKED', CW/2, y, 18, PAL.gold, PAL.outline, 'center'); y += 30;
    drawReadingText(ctx, 'SECOND SEATING AWAITS AT THE START', CW/2, y, 14, PAL.cream, 'center'); y += 34;
  } else {
    // already unlocked -- small corner note instead of taking over the card
    drawReadingText(ctx, 'HARD MODE UNLOCKED', CW-10, 10, 11, PAL.cream, 'right');
  }
  if(Math.floor(phaseElapsed)%2===0) drawPixelText(ctx, 'PRESS START', CW/2, y, 16, PAL.cream, 'center');
}
function drawPhaseLoseCard(ctx){
  // hard mode: no mid-beat retry -- this is a terminal screen, same stat
  // block style as the win end card, but with the loss headline + no rank
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,CW,CH);
  drawChunkyText(ctx, CONFIG.loseLine, CW/2, 130, 34, PAL.gold, PAL.outline, 'center');
  let y = 230;
  drawReadingText(ctx, 'LAUGHS CAUGHT: '+stats.heartsCaptured, CW/2, y, 18, PAL.cream, 'center'); y += 34;
  drawReadingText(ctx, 'HITS TAKEN: '+stats.hitsTaken, CW/2, y, 18, PAL.cream, 'center'); y += 34;
  if(BEAT2_ENABLED){
    drawReadingText(ctx, 'BOTTLES LANDED: '+stats.bottlesLanded, CW/2, y, 18, PAL.cream, 'center'); y += 34;
  }
  if(stats.tooSoon>0){
    drawReadingText(ctx, 'EARLY PUNCHLINES: '+stats.tooSoon, CW/2, y, 18, PAL.cream, 'center'); y += 34;
  }
  if(BEAT4_ENABLED){
    drawReadingText(ctx, 'FIVE-STAR REVIEWS: '+stats.reviews, CW/2, y, 18, PAL.cream, 'center'); y += 34;
  }
  y += 40;
  if(Math.floor(phaseElapsed)%2===0) drawPixelText(ctx, 'PRESS START', CW/2, y, 16, PAL.cream, 'center');
}
function drawPhaseGameover(ctx){
  drawBaseScene(ctx);
  ctx.save(); ctx.globalAlpha=0.55; ctx.fillStyle='#000'; ctx.fillRect(0,0,CW,CH); ctx.restore();
  const line = gameOverReason==='beat4' ? CONFIG.authority.failLine : CONFIG.dismissiveLine;
  drawAutoBubble(ctx, line, CW/2, CH/2+20, 16, 1);
}
function drawPhaseRetryCard(ctx){
  drawBaseScene(ctx);
  ctx.save(); ctx.globalAlpha=0.55; ctx.fillStyle='#000'; ctx.fillRect(0,0,CW,CH); ctx.restore();
  if(Math.floor(phaseElapsed*2)%2===0) drawChunkyText(ctx, 'TRY AGAIN', CW/2, CH/2, 30, PAL.gold, PAL.outline, 'center');
  // static (non-fading) reminder under the blinking prompt
  drawReadingTextOutlined(ctx, controlsHintText(), CW/2, CH/2+58, 16, PAL.cream, '#000000', 'center');
}

function draw(){
  let sx=0, sy=0;
  if(gameT < screenShakeUntil){
    const remain = screenShakeUntil-gameT;
    const mag = screenShakeMag*Math.max(0,remain/0.4);
    sx = (Math.random()*2-1)*mag; sy = (Math.random()*2-1)*mag;
  }
  ctx.save();
  ctx.translate(Math.round(sx), Math.round(sy));
  ctx.fillStyle = PAL.night; ctx.fillRect(-20,-20,CW+40,CH+40);
  switch(phase){
    case 'story': drawPhaseStory(ctx); break;
    case 'prompt': drawPhasePrompt(ctx); break;
    case 'capture': drawPhaseCapture(ctx); break;
    case 'breather': drawPhaseBreather(ctx); break;
    case 'beat2_intro': drawPhaseBeat2Intro(ctx); break;
    case 'boss': drawPhaseBoss(ctx); break;
    case 'beat3_intro': drawPhaseBeat3Intro(ctx); break;
    case 'beat3_revive': drawPhaseBeat3Revive(ctx); break;
    case 'beat3_windowmaker': drawPhaseBeat3Windowmaker(ctx); break;
    case 'beat3_tribute': drawPhaseBeat3Tribute(ctx); break;
    case 'beat3_silence': drawPhaseBeat3Silence(ctx); break;
    case 'beat3_finale': drawPhaseBeat3Finale(ctx); break;
    case 'beat4_intro': drawPhaseBeat4Intro(ctx); break;
    case 'beat4_chase': drawPhaseBeat4Chase(ctx); break;
    case 'beat4_turngood': drawPhaseBeat4TurnGood(ctx); break;
    case 'celebration': drawPhaseCelebration(ctx); break;
    case 'epilogueA': drawPhaseEpilogueA(ctx); break;
    case 'epilogueB': drawPhaseEpilogueB(ctx); break;
    case 'beat5_chase': drawPhaseBeat5Chase(ctx); break;
    case 'beat5_resolve': drawPhaseBeat5Resolve(ctx); break;
    case 'freeze': drawPhaseFreeze(ctx); break;
    case 'endcard': drawPhaseEndcard(ctx); break;
    case 'gameover': drawPhaseGameover(ctx); break;
    case 'retrycard': drawPhaseRetryCard(ctx); break;
    case 'losecard': drawPhaseLoseCard(ctx); break;
  }
  ctx.restore();
  if(phase!=='endcard' && phase!=='losecard') drawHUD(ctx);
  if(phase!=='capture' && phase!=='endcard' && phase!=='losecard') drawControlsHint(ctx);
  if(isTouch) drawJoystick(ctx); // no-op when no drag is active (see drawJoystick)
  if(flashAlpha>0){
    ctx.save(); ctx.globalAlpha=flashAlpha; ctx.fillStyle='#fff8ea'; ctx.fillRect(0,0,CW,CH); ctx.restore();
  }
}

/* ======================================================================
   TUTORIAL CARDS -- Zelda-style modal explainers. Each shows once per
   session (cardsShown persists across TRY AGAIN retries, so retries skip
   them all -- retryBeat2()/enterPhase('boss') never clears it). While a
   card is active, frame() skips gameT/update() entirely, which is what
   freezes every timer and stops napkins/hearts/everything else mid-motion;
   draw() still runs every frame (rendering the same frozen state each time)
   so the scene behind the dim genuinely holds still rather than needing a
   separate "paused snapshot" code path.
   ====================================================================== */
/* boss/aram/beat5 entries only exist when their role is cast -- each is only
   ever looked up from inside that role's own (already role-gated) phase
   code, but building them unconditionally would crash at load time for a
   config that omits an uncast role's content bucket entirely (as the
   test-group example config does), so they're conditional here too. */
const CARDS = {
  start: { key:'start', title:'DINNER IS SERVED', body:['THE GUYS TELL THEIR STORIES.','WAIT FOR THE LAST WORD...','THEN HIT SPACE.',"DON'T LET THE LAUGHTER DIE."] },
  capture: { key:'capture', title:'CATCH THE LAUGHS!', body:['THE TABLE IS LOSING IT.','RUN AROUND AND SOAK UP EVERY HA.'] },
};
if(JUDGE_CAST) CARDS.boss = { key:'boss', title:CONFIG.judge.title, body:CONFIG.judge.cardBody };
if(AUTHORITY_CAST) CARDS.aram = { key:'aram', title:CONFIG.authority.cardTitle, body:fmtLines(CONFIG.authority.cardBody) };
if(BUILDER_CAST) CARDS.beat5 = { key:'beat5', title:CONFIG.builder.cardTitle, body:CONFIG.builder.cardBody };
let activeCard = null;
let pendingCard = null, pendingCardAt = 0;
let cardT = 0;
const cardsShown = {};
function maybeShowCard(key){
  if(cardsShown[key]) return false;
  cardsShown[key] = true;
  activeCard = CARDS[key];
  cardT = 0;
  return true;
}
function drawCardOverlay(ctx){
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#000';
  ctx.fillRect(0,0,CW,CH);
  ctx.restore();
  const w = 580, h = 230;
  const x = CW/2-w/2, y = CH/2-h/2;
  ctx.fillStyle = PAL.cream; ctx.fillRect(x-4,y-4,w+8,h+8); // cream border
  ctx.fillStyle = '#1a1410'; ctx.fillRect(x,y,w,h); // dark fill
  drawChunkyText(ctx, activeCard.title, CW/2, y+24, 23, PAL.gold, PAL.outline, 'center');
  let ly = y+82;
  for(const line of activeCard.body){
    drawReadingText(ctx, line, CW/2, ly, 17, PAL.cream, 'center');
    ly += 30;
  }
  if(Math.floor(cardT*2)%2===0){
    drawReadingText(ctx, 'SPACE TO CONTINUE', CW/2, y+h-36, 15, PAL.gold, 'center');
  }
}
/* mode-select ("CHOOSE YOUR SEATING") -- only ever shown once at boot, and
   only if the player has beaten the game before (hasBeatenBefore). Reuses
   cardT for its own highlight blink, same freeze-the-game mechanism as the
   tutorial cards (see frame()), but has its own input handling (arrow keys/
   WASD/d-pad move the highlight, Space/A confirms) instead of "any key dismisses". */
const MODE_SELECT_ROWS = [
  'FIRST SEATING  --  A NICE DINNER',
  'SECOND SEATING  --  MUCH HARDER. YOU CAN LOSE.'
];
const MODE_SELECT_W = 620, MODE_SELECT_H = 210;
/* shared by draw and touch hit-testing so the two can never drift apart */
function modeSelectRowRect(i){
  const x = CW/2-MODE_SELECT_W/2, y = CH/2-MODE_SELECT_H/2;
  const ry = y+82 + i*38;
  return { x:x+16, y:ry-6, w:MODE_SELECT_W-32, h:28, textX:x+28, textY:ry, starX:x+MODE_SELECT_W-46 };
}
function drawModeSelectOverlay(ctx){
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#000';
  ctx.fillRect(0,0,CW,CH);
  ctx.restore();
  const w = MODE_SELECT_W, h = MODE_SELECT_H;
  const x = CW/2-w/2, y = CH/2-h/2;
  ctx.fillStyle = PAL.cream; ctx.fillRect(x-4,y-4,w+8,h+8);
  ctx.fillStyle = '#1a1410'; ctx.fillRect(x,y,w,h);
  drawChunkyText(ctx, 'CHOOSE YOUR SEATING', CW/2, y+20, 20, PAL.gold, PAL.outline, 'center');
  for(let i=0;i<MODE_SELECT_ROWS.length;i++){
    const selected = modeSelectIndex===i;
    const r = modeSelectRowRect(i);
    if(selected && Math.floor(cardT*2)%2===0){
      ctx.save(); ctx.fillStyle = 'rgba(232,184,75,0.25)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.restore();
    }
    drawReadingText(ctx, (selected?'> ':'  ')+MODE_SELECT_ROWS[i], r.textX, r.textY, 15, selected?PAL.gold:PAL.cream, 'left');
    if(i===1 && hardCleared) drawStarIcon(ctx, r.starX, r.textY-1, true, 4);
  }
  const hint = isTouch ? 'TAP TO CHOOSE   TAP AGAIN TO CONFIRM' : 'ARROWS/WASD: CHOOSE   SPACE: CONFIRM';
  drawReadingText(ctx, hint, CW/2, y+h-28, 13, PAL.cream, 'center');
}
/* touch hit-test for the mode-select rows -- tapping the already-highlighted
   row confirms, tapping any other row just moves the highlight to it */
function handleModeSelectTouch(p){
  for(let i=0;i<MODE_SELECT_ROWS.length;i++){
    const r = modeSelectRowRect(i);
    if(p.x>=r.x && p.x<=r.x+r.w && p.y>=r.y && p.y<=r.y+r.h){
      if(modeSelectIndex===i) confirmModeSelect();
      else { modeSelectIndex = i; if(actx) playBeep(actx.currentTime); }
      return;
    }
  }
}

/* ======================================================================
   VOLUME UI -- a small pixel speaker icon pinned top-right, always drawn
   last (on top of every other overlay, including the rotate prompt) so
   it's reachable from literally any screen. Tap it for a 4-option popup
   (OFF/LOW/MED/HIGH); tap anywhere while the popup is open picks an option
   if hit, or just closes it either way -- both are swallowed so a popup
   interaction never also fires a game action underneath it.
   ====================================================================== */
const VOL_ICON = { x: CW-44, y: 12, w: 28, h: 28 };
const VOL_OPTIONS = [ {label:'OFF', value:0}, {label:'LOW', value:0.12}, {label:'MED', value:0.25}, {label:'HIGH', value:0.6} ];
const VOL_POPUP_W = 208, VOL_POPUP_H = 34;
let volPopupOpen = false;
let volToastText = null, volToastUntil = 0;
function volPopupRect(){
  return { x: VOL_ICON.x+VOL_ICON.w-VOL_POPUP_W, y: VOL_ICON.y+VOL_ICON.h+8, w:VOL_POPUP_W, h:VOL_POPUP_H };
}
function volOptionRect(i){
  const p = volPopupRect();
  const cellW = p.w/VOL_OPTIONS.length;
  return { x:p.x+i*cellW, y:p.y, w:cellW, h:p.h };
}
function showVolToast(text){
  volToastText = text;
  volToastUntil = performance.now() + 1400;
}
function toggleMute(){
  volPopupOpen = false;
  if(volumeSetting>0){
    volumeBeforeMute = volumeSetting;
    setVolumeSetting(0);
    showVolToast('SOUND OFF');
  } else {
    setVolumeSetting(volumeBeforeMute>0 ? volumeBeforeMute : 0.55);
    showVolToast('SOUND ON');
  }
}
/* returns true if the tap was consumed by the icon/popup -- callers must
   check this FIRST, before any other pointerdown handling */
function handleVolumePointerdown(x, y){
  if(volPopupOpen){
    for(let i=0;i<VOL_OPTIONS.length;i++){
      const r = volOptionRect(i);
      if(x>=r.x && x<=r.x+r.w && y>=r.y && y<=r.y+r.h){
        setVolumeSetting(VOL_OPTIONS[i].value);
        break;
      }
    }
    volPopupOpen = false; // any tap while open closes it, hit or not
    return true;
  }
  if(x>=VOL_ICON.x && x<=VOL_ICON.x+VOL_ICON.w && y>=VOL_ICON.y && y<=VOL_ICON.y+VOL_ICON.h){
    volPopupOpen = true;
    return true;
  }
  return false;
}
function drawSpeakerIcon(ctx, x, y, level){
  ctx.save();
  ctx.fillStyle = PAL.cream;
  ctx.fillRect(x+2, y+10, 5, 8);   // speaker body
  ctx.fillRect(x+7, y+8, 3, 12);   // cone, stepped trapezoid (no ctx.rotate -- stays crisp)
  ctx.fillRect(x+10, y+5, 3, 18);
  ctx.fillRect(x+13, y+2, 2, 24);
  if(level<=0){
    ctx.fillStyle = '#e0645a';
    for(let i=0;i<8;i++){ // stepped diagonal X, same crisp-diagonal trick as the intro's knife
      ctx.fillRect(x+17+i, y+4+i, 2, 2);
      ctx.fillRect(x+17+i, y+18-i, 2, 2);
    }
  } else {
    ctx.fillStyle = PAL.gold;
    const barX0 = x+18, barW=2, gap=3;
    for(let i=0;i<3;i++){
      if(i>=level) continue;
      const h = 6+i*5;
      ctx.fillRect(barX0+i*gap, y+14-h, barW, h);
    }
  }
  ctx.restore();
}
function drawVolumeUI(ctx){
  const level = volumeSetting<=0 ? 0 : volumeSetting<0.4 ? 1 : volumeSetting<0.8 ? 2 : 3;
  drawSpeakerIcon(ctx, VOL_ICON.x, VOL_ICON.y, level);
  if(volPopupOpen){
    const p = volPopupRect();
    ctx.fillStyle = PAL.wood; ctx.fillRect(p.x-3, p.y-3, p.w+6, p.h+6);
    ctx.fillStyle = '#1a1410'; ctx.fillRect(p.x, p.y, p.w, p.h);
    for(let i=0;i<VOL_OPTIONS.length;i++){
      const r = volOptionRect(i);
      const selected = Math.abs(volumeSetting-VOL_OPTIONS[i].value)<0.01;
      if(selected){ ctx.fillStyle = 'rgba(232,184,75,0.3)'; ctx.fillRect(r.x+2, r.y+2, r.w-4, r.h-4); }
      drawReadingText(ctx, VOL_OPTIONS[i].label, r.x+r.w/2, r.y+7, 12, selected?PAL.gold:PAL.cream, 'center');
    }
  } else if(volToastText && performance.now() < volToastUntil){
    const p = volPopupRect();
    drawReadingTextOutlined(ctx, volToastText, p.x+p.w/2, p.y+8, 14, PAL.gold, '#000000', 'center');
  }
}
/* full-screen "turn your phone" gate -- same visual language as the card
   overlays, blocks all input (see handleAction/pollGamepadAction/pointerdown)
   until the device goes back to landscape */
function drawRotatePrompt(ctx){
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#000';
  ctx.fillRect(0,0,CW,CH);
  ctx.restore();
  const w = 680, h = 240;
  const x = CW/2-w/2, y = CH/2-h/2;
  ctx.fillStyle = PAL.cream; ctx.fillRect(x-4,y-4,w+8,h+8);
  ctx.fillStyle = '#1a1410'; ctx.fillRect(x,y,w,h);
  drawChunkyText(ctx, 'ROTATE YOUR PHONE', CW/2, y+60, 26, PAL.gold, PAL.outline, 'center');
  if(Math.floor(cardT*2)%2===0){
    drawReadingText(ctx, 'TURN TO LANDSCAPE TO PLAY', CW/2, y+150, 16, PAL.cream, 'center');
  }
}
/* ---------------- floating joystick visual (touch only) ---------------- */
function drawJoystick(ctx){
  if(!touchJoystick.active) return;
  ctx.save();
  ctx.globalAlpha = 0.35;
  drawPixelCircle(ctx, touchJoystick.baseX, touchJoystick.baseY, JOY_SATURATION, PAL.cream, 3);
  ctx.restore();
  const v = touchMoveVector();
  const nubX = touchJoystick.baseX + v.dx*JOY_SATURATION;
  const nubY = touchJoystick.baseY + v.dy*JOY_SATURATION;
  ctx.save();
  ctx.globalAlpha = 0.55;
  drawPixelCircle(ctx, nubX, nubY, 16, PAL.gold, 3);
  ctx.restore();
}

/* ======================================================================
   INPUT + MAIN LOOP
   ====================================================================== */
const MODE_SELECT_KEYS = new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD']);
window.addEventListener('keydown', (e)=>{
  keys[e.code] = true;
  ensureAudioStarted();
  if(e.code==='KeyM' && !e.repeat){ toggleMute(); return; } // works everywhere, even mid-freeze
  if(rotatePromptActive) return; // frozen until landscape
  if(modeSelectPending){
    if(!e.repeat && MODE_SELECT_KEYS.has(e.code)){
      modeSelectIndex = 1-modeSelectIndex;
      if(actx) playBeep(actx.currentTime);
    }
    if(e.code==='Space' && !e.repeat){ confirmModeSelect(); e.preventDefault(); }
    return; // swallow everything else while the mode-select card is up
  }
  if(e.code==='Space' && !e.repeat){ handleAction(); e.preventDefault(); }
});
window.addEventListener('keyup', (e)=>{ keys[e.code] = false; });

/* maps a pointer event's viewport coordinates into the same 960x540 logical
   space fitCanvas() draws into, via the canvas's own layout box -- stays
   correct regardless of the exact CSS scale/centering fitCanvas computed. */
function screenToLogical(clientX, clientY){
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX-rect.left)/rect.width*CW,
    y: (clientY-rect.top)/rect.height*CH
  };
}
/* pointer-type-aware routing: mouse keeps today's "any click = action"
   behavior; touch is zoned (left half = floating joystick, right half =
   action) during actual gameplay, but ANY tap dismisses cards / lose / end
   cards, same as it always could, since there's no joystick-relevant
   gameplay happening on those screens. */
window.addEventListener('pointerdown', (e)=>{
  ensureAudioStarted();
  // volume icon/popup hit-test FIRST, for both mouse and touch -- swallow if
  // hit so it never reaches handleAction/joystick/mode-select/card dismissal
  const volPoint = screenToLogical(e.clientX, e.clientY);
  if(handleVolumePointerdown(volPoint.x, volPoint.y)) return;
  if(e.pointerType!=='touch'){
    // mouse: any click must unlock audio even on screens where handleAction
    // early-returns (the mode-select guard was swallowing the unlock), and
    // clicking a seating row should work with a mouse too, not just touch
    if(modeSelectPending && !rotatePromptActive){ handleModeSelectTouch(volPoint); return; }
    handleAction();
    return;
  }
  isTouch = true; // confirmed by an actual touch, not just the 'ontouchstart' hint
  if(rotatePromptActive) return;
  const p = volPoint;
  if(modeSelectPending){ handleModeSelectTouch(p); return; }
  if(activeCard || phase==='endcard' || phase==='losecard' || phase==='retrycard' || phase==='gameover'){
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
function releaseTouchPointer(e){
  if(touchJoystick.active && e.pointerId===touchJoystick.pointerId){
    touchJoystick.active = false; touchJoystick.pointerId = null;
  }
  if(touchActionPointerId===e.pointerId) touchActionPointerId = null;
}
window.addEventListener('pointerup', releaseTouchPointer);
window.addEventListener('pointercancel', releaseTouchPointer);
window.addEventListener('load', ()=>{ try{ ensureAudioStarted(); }catch(e){} });

let touchActionPointerId = null;

/* ======================================================================
   URL ENTRY POINTS -- ?start=<dinner|boss|aram|ending|techsupport>
   Jump straight into a later part of the game without playing the rest.
   Each non-default entry is a proper state initializer (same idea as
   retryBeat1/retryBeat2/retryBeat4): it sets every flag the target phase's
   code expects -- boss/aram/woman/diner positions, which tutorial cards
   have already "shown" so they don't fire mid-jump, drums/music state,
   stats zeroed -- then calls enterPhase() to actually enter it. The jump is
   applied AFTER mode-select confirms (mode-select still shows first if
   kck_beaten is set), so hardMode/D() are always already resolved by the
   time any of this runs. Invalid/missing values fall back to 'dinner',
   which is byte-for-byte today's boot behavior (no code path change at all
   for the default case). */
const START_PARAM = (function(){
  try{
    const v = new URLSearchParams(location.search).get('start');
    const valid = new Set(['dinner','boss','aram','ending','techsupport']);
    return valid.has(v) ? v : 'dinner';
  }catch(e){ return 'dinner'; }
})();
function resetStatsForEntryPoint(){
  stats.heartsCaptured=0; stats.hitsTaken=0; stats.bottlesLanded=0; stats.tooSoon=0; stats.reviews=0; stats.resets=0;
}
/* shared "the boss fight (and the Widowmaker beat) already happened" setup
   for the aram/ending/techsupport entries: critic restored and back in his
   own seat (not revived-in-the-window -- the Widowmaker already un-made
   that window by this point in every one of these entry points), the wall
   door gone, the woman already arrived and delivered her lines. */
function setupPostFightState(){
  diners[CRITIC_INDEX].retired = false;
  diners[CRITIC_INDEX].walking = false;
  diners[CRITIC_INDEX].x = 560; diners[CRITIC_INDEX].y = 248;
  boss.visible = false;
  boss.state = 'restored';
  boss.doorPopT = 0; boss.duckT = 0; boss.phase2 = false;
  boss.transforming = false; boss.shrinking = false;
  boss.fakeDeathDone = true;
  woman.active = true; woman.arrived = true; woman.x = 830; woman.y = 400;
}
function startAtBoss(){
  resetStatsForEntryPoint();
  player.hearts = player.maxHearts;
  cardsShown.start = true; cardsShown.capture = true;
  enterPhase('beat2_intro'); // critic walk-out -> transform -> enterPhase('boss') shows its card once
}
function startAtAram(){
  resetStatsForEntryPoint();
  setupPostFightState();
  player.hearts = player.maxHearts;
  cardsShown.start = true; cardsShown.capture = true; cardsShown.boss = true;
  enterPhase('beat4_intro'); // dramatic staging -> beat4_chase shows the ARAM card once
}
/* the third five-star review just landed: Aram freezes mid-chase, checks his
   phone, turns good, then flows naturally into celebration -> epilogueA ->
   epilogueB -> beat5 -> end card, exactly like reaching this point by play. */
function startAtEnding(){
  resetStatsForEntryPoint();
  setupPostFightState();
  player.hearts = player.maxHearts;
  aram.active = true; aram.turnedGood = false; aram.state = 'chase';
  // both positioned on open floor, clear of the solid TABLE rect (336-624 x,
  // 248-368 y) -- starting a mobile entity already overlapping a solid
  // freezes it in place, since moveAndCollide reverts any delta that's still
  // inside the same rect it started in
  aram.x = 760; aram.y = 300;
  player.x = 700; player.y = 450;
  // scatter the 5 reviewer candidates around the room like a real completed
  // chase, and mark exactly D('reviewsNeeded') of them as already reviewed
  // (persistent star icon via reviewGiven, not the transient rising particle
  // -- that was the moment of completion, this is a beat after it)
  const need = D('reviewsNeeded');
  const spots = [{x:300,y:180},{x:640,y:200},{x:300,y:420},{x:640,y:420},{x:480,y:460}];
  getReviewerList().forEach((r,i)=>{
    r.reviewGiven = i<need;
    r.fleeing = false; r.begging = false; r.beggingT = 0;
    r.x = spots[i%spots.length].x; r.y = spots[i%spots.length].y;
    r.wanderTX = r.x; r.wanderTY = r.y;
  });
  stats.reviews = need;
  cardsShown.start = true; cardsShown.capture = true; cardsShown.boss = true; cardsShown.aram = true;
  setBeatMusic('chase'); // simulating "was mid-chase when caught," same as beat4_chase's own pick
  enterPhase('beat4_turngood');
}
function startAtTechSupport(){
  resetStatsForEntryPoint();
  setupPostFightState();
  player.hearts = player.maxHearts;
  aram.active = true; aram.turnedGood = true; aram.state = 'frozen';
  aram.x = 480; aram.y = 300;
  const need = D('reviewsNeeded');
  getReviewerList().forEach(r=>{ r.reviewGiven = true; r.fleeing=false; r.begging=false; r.beggingT=0; });
  stats.reviews = need;
  cardsShown.start = true; cardsShown.capture = true; cardsShown.boss = true; cardsShown.aram = true;
  enterPhase('beat5_chase'); // shows the TECH SUPPORT card once, room already in its post-win state
}
function applyStartParam(){
  if(START_PARAM==='boss') startAtBoss();
  else if(START_PARAM==='aram') startAtAram();
  else if(START_PARAM==='ending') startAtEnding();
  else if(START_PARAM==='techsupport') startAtTechSupport();
  else maybeShowCard('start'); // 'dinner' -- today's exact default behavior
}

enterPhase('story'); // populate phaseData.tw for the very first frame
if(hasBeatenBefore){
  // beaten before -- offer a seating choice before the usual DINNER IS
  // SERVED card (or the URL entry point). Without the flag, boot exactly as
  // before, except now branching on START_PARAM below.
  modeSelectPending = true;
  modeSelectIndex = 0; // default highlight: FIRST SEATING
} else {
  applyStartParam();
}

let lastFrameMs = performance.now();
function frame(nowMs){
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (nowMs-lastFrameMs)/1000);
  lastFrameMs = nowMs;
  rotatePromptActive = isTouch && window.innerHeight > window.innerWidth;
  // start the real track the moment it finishes decoding, even if the player
  // is mid-scene and not touching anything (cheap no-op until then)
  if(!useMp3Music && bgmBuffer) tryStartMusic();
  // self-heal a canvas that was sized while the viewport reported 0x0
  if(window.innerWidth > 0 && Math.abs(parseInt(canvas.style.width||'0') - Math.floor(CW*Math.min(window.innerWidth/CW, window.innerHeight/CH))) > 2 && window.innerHeight > 0){
    fitCanvas();
  }
  pollGamepadAction();
  if(rotatePromptActive || modeSelectPending || activeCard){
    cardT += dt; // independent clock so the card's/menu's/prompt's own blink keeps animating
  } else {
    gameT += dt;
    update(dt);
  }
  draw();
  if(rotatePromptActive) drawRotatePrompt(ctx);
  else if(modeSelectPending) drawModeSelectOverlay(ctx);
  else if(activeCard) drawCardOverlay(ctx);
  drawVolumeUI(ctx); // always last -- on top of every other overlay, reachable from any screen
  if(actx) updateBeatMusic();
}
requestAnimationFrame(frame);
