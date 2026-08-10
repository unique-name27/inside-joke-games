'use strict';
/* ======================================================================
   shared/framework.js -- THE GALLERY, round 1: framework extraction.

   Everything in this file used to be two independently-maintained,
   near-identical copies inside game/engine.js and intro/engine.js. Both
   engines now load this ONE file (as a plain classic <script>, before
   their own engine.js) and consume its declarations as ordinary globals --
   see README.md/SPEC-gallery.md for the multi-round plan this begins.

   WHY THIS WORKS (classic-script global sharing): every <script> tag on a
   page without type="module" shares ONE global scope. A later script can
   reference an earlier script's top-level const/let/function declarations
   directly, with no import/export machinery. The one subtlety: a function
   BODY only resolves its free variables at CALL time, not at the moment
   the function is DEFINED. So a function defined here can reference a
   global that doesn't exist yet when THIS script runs (e.g. STORAGE_PREFIX,
   which each engine.js declares AFTER this script loads) as long as that
   global exists by the time the function actually gets CALLED -- which is
   always true here, since every such function is only ever invoked well
   after both engine.js's own top-of-file setup has finished.

   WHAT DELIBERATELY DID NOT MOVE HERE, and why:
   - ENGINE_ROOT (document.currentScript.src-derived) and CFG_FRAGMENT (which
     depends on it) -- document.currentScript is only valid synchronously
     while THAT script tag is executing, so this can never be computed from
     a shared file loaded earlier. Stays in each engine.js.
   - CONFIG/CFG_FRAGMENT/STORAGE_PREFIX-dependent EAGER (top-level,
     immediately executed) statements -- e.g. `let volumeSetting =
     loadVolumeSetting();`, `if(USE_CUSTOM_SONG) prefetchMusic();`,
     SFX_DEFS/MUSIC_LOOP_DEFS content and their loaders. Framework.js as an
     EARLIER script would evaluate before each engine's own CONFIG-derived
     locals exist, so anything that needs to RUN (not just be callable)
     before engine.js's own setup finishes has to stay put. Pure function
     DEFINITIONS with no eager invocation are fine (see above).
   - SFX_DEFS/sfxLoader/tryDecodeAllSamples and every SFX_DEFS-keyed
     play*(t) wrapper (playDing, playSlamBoom, playFanfare, ...) -- each
     engine's sound list and wrapper set is genuinely different content
     (game has 16 SFX + 12 wrappers; intro has 3), not shared machinery.
     Only the GENERIC loader factory (makeBufferBank) and player
     (playSample) moved; the per-engine key lists and wrappers stay local.
   - MUSIC_LOOP_DEFS/loopLoader/tryDecodeAllLoops -- built from
     CONFIG.music.loops / CONFIG.music.introFallback, CONFIG-dependent.
   - CARDS content (game-only), pollGamepadAction/pollGamepad and every
     keydown/pointerdown/pointermove/pointerup listener registration --
     these WIRE the shared primitives below into each engine's own game
     logic (handleAction/modeSelectPending for game; triggerBoot/
     triggerSkip for intro), and that wiring is genuinely different per
     engine, not duplicated-by-convention.
   - drawRotatePrompt -- see "DELIBERATE NON-RECONCILIATION" below.
   - Sprite/tile helpers (tintedSprite, rawTile, drawTile, sheetImage,
     ROSTER_SHEET_IMAGES, imgDungeon/imgTown, assetsReady) -- game content
     asset loading, not framework, and intro loads a different image set
     (imgTown+imgDungeon vs. game's imgDungeon-only).
   - drawPixelCircle/drawBitmap/drawSparkle (pixel primitives) and PAL --
     byte-identical today but not named in SPEC-gallery.md's extraction
     list; left duplicated to keep this round's diff to exactly what was
     asked for. The particle/card code below calls them as ordinary globals
     at draw time, which works fine since each engine still defines them.

   RECONCILIATIONS (the audio engine + volume UI were "duplicated by
   convention" and had drifted -- per instructions, reconciled to
   game/engine.js's version unless intro's difference was deliberate,
   documented here):
   1. RECORD_MODE/recordDest (intro-only promo-recording feature, genuinely
      deliberate -- NOT dropped). Declared here as safe defaults (`let
      RECORD_MODE = false; let recordDest = null;`); intro/engine.js
      reassigns RECORD_MODE right after its own CFG_FRAGMENT resolution.
      game/engine.js never touches it, so RECORD_MODE is always false there
      and every `if(RECORD_MODE)` guard below is a permanent no-op for
      game -- zero behavior change for game, RECORD_MODE's real behavior
      preserved for intro. Volume UI (drawVolumeUI/toggleMute/
      handleVolumePointerdown/loadVolumeSetting/setVolumeSetting/initAudio)
      adopted intro's RECORD_MODE-aware bodies as the canonical shared
      version for the same reason.
   2. BUG FIX: intro's initAudio() called tryDecodeAllLoops() but NOT
      tryDecodeAllSamples() -- despite intro defining sfxLoader/SFX_DEFS and
      actually calling playDing/playSlamBoom/playFanfare from its own scene
      code. Its 3 SFX almost certainly never played in the shipped intro.
      Reconciled to game's version, which correctly decodes both banks.
      This is flagged prominently in this round's report -- it is a real
      behavior change for intro (its SFX will now audibly play), but it is
      a bug fix of non-deliberate drift, exactly the case the "reconcile to
      game's version" instruction covers.
   3. currentLoopOn (intro, single boolean flag, hardcoded to the one
      'fallback' key) vs. currentLoopKey (game, general multi-key) --
      adopted game's general version. Each engine now must explicitly seed
      its starting key via setBeatMusic(...) since the shared
      `pendingLoopKey` here defaults to null instead of a hardcoded key:
      game/engine.js calls setBeatMusic('dinner'), intro/engine.js calls
      setBeatMusic('fallback'), both right where their own MUSIC_LOOP_DEFS
      setup used to implicitly start the loop.
   4. BPM/BEAT (intro) vs. BEAT_DEFAULT (game) -- same value (60/112),
      adopted game's name; intro's one call site (playTwang(now+BEAT))
      updated to BEAT_DEFAULT.
   5. duckDown(t) (intro, 1 param) vs. duckDown(t, target) (game, 2 params)
      -- intro's 2 call sites never passed a 2nd arg, so adopting game's
      version is behavior-identical. Same for setMusicLevel(level, t)
      (intro, 2 params) vs. setMusicLevel(level, t, rampTime) (game, 3
      params) -- intro's call sites never passed a 3rd arg.
   6. makeTypewriter's exposed `doneAt` (game) vs. `totalDur`/`lineDoneTime`
      (intro) -- totalDur/lineDoneTime are dead code (verified via
      repo-wide grep: never referenced anywhere), doneAt is used at ~15
      call sites in game/engine.js. Adopted game's version; dropped the
      unused intro-only members.
   7. drawAutoBubble -- game-only today (intro never defined it). Moving it
      here is purely additive for intro (unreachable dead code, since intro
      never calls it) -- zero behavior change.

   DELIBERATE NON-RECONCILIATION: drawRotatePrompt stays duplicated in each
   engine.js, NOT moved here. The two versions have real behavioral
   differences -- different box height (240 vs 220), different text-render
   function (drawChunkyText+drawReadingText vs. drawReadingTextOutlined
   throughout), and a different blink-timing clock source (game's paused/
   freezable `cardT` accumulator vs. intro's raw `performance.now()`, since
   intro has no card/pause-clock system at all). Forcibly unifying either
   direction would be a real behavior change, which the instructions for
   this round rule out. isTouch/rotatePromptActive (the STATE the rotate
   gate reads/sets) did move here, since those are plain feature-detected
   booleans with no behavioral drift.
   ====================================================================== */

/* ======================================================================
   FIT CANVAS / DPR / MOBILE
   canvas/ctx: byte-identical in both engines, no CONFIG dependency, and
   the <canvas id="c"> element is already parsed (it's in the HTML body
   before any <script> tag) by the time this file runs -- safe to own here.
   ====================================================================== */
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
// NOTE: the initial fitCanvas() call itself is NOT made here, deliberately.
// fitCanvas() reads CW/CH, which each engine.js declares AFTER this script
// loads (CW/CH live in engine.js, not here -- they're the 960x540 logical
// canvas size, a per-engine constant today, not CONFIG-derived, but not
// moved here either since nothing forced the choice and leaving it local
// keeps this round's diff smaller). Calling fitCanvas() from here eagerly
// would run before that declaration exists and throw. Each engine.js makes
// the one initial call itself, right after its own CW/CH declaration --
// see the "canvas/ctx/fitCanvas/isTouch/rotatePromptActive now live in
// shared/framework.js" comment in game/engine.js and intro/engine.js.

/* ---------------- mobile / touch ---------------- */
let isTouch = ('ontouchstart' in window);
let rotatePromptActive = false;

/* ======================================================================
   CHUNKY / READING TEXT RENDERERS
   ====================================================================== */
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

/* ======================================================================
   STORAGE HELPERS
   skey() is a plain function definition -- it references STORAGE_PREFIX,
   which each engine.js declares AFTER this script loads (CFG_FRAGMENT/
   CONFIG-dependent, so it can't live here -- see header). Safe because
   skey() is never CALLED until well after that declaration has run (see
   header's "function bodies resolve free variables at CALL time" note).
   ====================================================================== */
function skey(name){ return STORAGE_PREFIX + '_' + name; }

/* ======================================================================
   CARD / TUTORIAL SYSTEM
   CARDS itself (the actual title/body content) stays per-engine -- it's
   game content, not framework, and today only game/engine.js defines/uses
   it at all. maybeShowCard/drawCardOverlay resolve CARDS/PAL/CW/CH as
   ordinary globals at call time.
   ====================================================================== */
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

/* ======================================================================
   TYPEWRITER + SPEECH BUBBLES
   ====================================================================== */
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
/* per-character typewriter beep + per-line ding, tied to the typewriter's
   own reveal-count state (see makeTypewriter). playBeep/playDing resolve as
   ordinary globals at call time -- playDing is SFX_DEFS-keyed content that
   stays defined locally per engine (see header); playBeep (below, in the
   audio core) is a shared no-op stub today. */
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

/* ======================================================================
   PARTICLE HELPERS
   The 'starrow' branch below calls drawStarIcon, which stays game-content
   (defined locally in game/engine.js only, alongside STAR_ROWS) -- resolved
   as an ordinary global at draw time, exactly like drawSparkle/drawPixelText
   above. intro/engine.js never spawns a 'starrow' particle, so it never
   reaches that branch.
   ====================================================================== */
let particles = [];
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
   INPUT LAYER -- keyboard/touch joystick/gamepad -> move vector, plus raw
   pointer plumbing. The actual keydown/pointerdown event LISTENERS, and the
   action-button poll (pollGamepadAction in game, pollGamepad in intro), stay
   local to each engine.js -- they wire these primitives into genuinely
   different per-engine logic (handleAction/modeSelectPending vs.
   triggerBoot/triggerSkip), not duplicated-by-convention framework code.
   ====================================================================== */
const keys = Object.create(null);

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
let touchActionPointerId = null;
function releaseTouchPointer(e){
  if(touchJoystick.active && e.pointerId===touchJoystick.pointerId){
    touchJoystick.active = false; touchJoystick.pointerId = null;
  }
  if(touchActionPointerId===e.pointerId) touchActionPointerId = null;
}

/* ======================================================================
   AUDIO CORE -- real Kenney CC0 samples (one-shot SFX + a per-beat music
   loop score) over WebAudio, a generalized buffer-bank loader, the
   Karplus-Strong jaw-harp "twang" synth, master-volume/mute + the volume UI,
   and the SpeechSynthesis wrapper. See the header for every reconciliation
   made merging game's and intro's drifted copies of this subsystem.
   ====================================================================== */
const BEAT_DEFAULT = 60/112;
/* PHASE M (mix discipline): music sits clearly UNDER the SFX layer -- the
   comedy reads through speech bubbles and SFX, music is bed, not lead. The
   ONE shared constant both engines use as their "full" music level --
   musicGain's resting value at initAudio() AND the ceiling duckUp()/
   setMusicLevel() ramp back up to. duckDown/duckUp/setMusicLevel all still
   take their target/level argument as a 0..1 FRACTION of "full"; each just
   multiplies by this constant internally. */
const MUSIC_BASE_GAIN = 0.35;
let actx = null, masterGain = null, compressor = null, musicGain = null, fxGain = null, loopGain = null;
let noiseBuffer = null;
/* RECONCILIATION 1 (see header): RECORD_MODE/recordDest are a genuine,
   deliberate intro-only feature (promo recording), not dropped. Declared
   here as safe defaults; intro/engine.js reassigns RECORD_MODE right after
   its own CFG_FRAGMENT resolution. game/engine.js never touches it, so
   every RECORD_MODE guard below is a permanent no-op there. */
let RECORD_MODE = false;
let recordDest = null; // MediaStreamAudioDestinationNode when recording

/* ---------------- master volume ----------------
   0..1, multiplied into masterGain (masterGain.gain = 0.8 * volumeSetting)
   so every existing gain-staging/ducking downstream of it is untouched --
   this just scales the final output. Persisted so the choice carries
   between the intro and the game and across visits. RECORD_MODE forces
   full volume at load (recordings must stay full-volume) and hides/
   disables the icon so it can't be undone mid-recording. */
function loadVolumeSetting(){
  if(RECORD_MODE) return 1.0;
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
  if(RECORD_MODE) return; // locked at 1.0 for the duration of a recording
  volumeSetting = Math.max(0, Math.min(1, v));
  saveVolumeSetting(volumeSetting);
  applyMasterVolume(false);
}

/* RECONCILIATION 2 (BUG FIX, see header): adopts game's version, which
   correctly decodes BOTH banks. intro's previous version called
   tryDecodeAllLoops() only, silently never playing its 3 defined SFX. */
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
  musicGain = actx.createGain(); musicGain.gain.value = MUSIC_BASE_GAIN;
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
  if(RECORD_MODE){
    recordDest = actx.createMediaStreamDestination();
    masterGain.connect(recordDest);
  }
}

/* ---------------- generalized sample buffer bank ----------------
   Fetches every SFX + music-loop file immediately at page load (fetch needs
   no user gesture); once the AudioContext exists (first user gesture),
   decodes whatever's already arrived and anything that finishes later.
   Same proven fetch+decodeAudioData pattern as the theme.mp3 loader. A 404
   or decode failure just leaves that key silent forever (playSample()/
   startLoopNow() no-op) -- no thrown errors. SFX_DEFS/MUSIC_LOOP_DEFS
   themselves stay per-engine (CONFIG-dependent content); this is just the
   generic loader factory + player both engines feed their own defs into. */
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

/* RECONCILIATION 3 (see header): general multi-key design (game's), not
   intro's old single-boolean currentLoopOn hardcoded to 'fallback'. Each
   engine now explicitly seeds its own starting key via setBeatMusic(...)
   right where its own MUSIC_LOOP_DEFS setup used to implicitly start the
   loop (game: setBeatMusic('dinner'); intro: setBeatMusic('fallback')). */
let currentLoopKey = null, currentLoopSource = null, currentLoopNodeGain = null;
let pendingLoopKey = null;
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
   lapsed or the custom track is already known to have failed. */
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
/* RECONCILIATION 5 (see header): adopted game's extra optional params
   (duckDown's `target`, setMusicLevel's `rampTime`) -- verified both of
   intro's call sites never passed those args, so this is behavior-identical
   for intro and just gives both engines the same, more general signature. */
function duckDown(t, target){
  const g = musicGain.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime((target===undefined?0.02:target) * MUSIC_BASE_GAIN, t+0.08);
}
function duckUp(t, level){
  level = level===undefined ? 1.0 : level;
  const g = musicGain.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(level * MUSIC_BASE_GAIN, t+0.3);
}
function setMusicLevel(level, t, rampTime){
  const g = musicGain.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(level * MUSIC_BASE_GAIN, t+(rampTime===undefined?1.0:rampTime));
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

/* ======================================================================
   VOLUME UI -- a small pixel speaker icon pinned top-right, always drawn
   last (on top of every other overlay, including the rotate prompt) so
   it's reachable from literally any screen. Tap it for a 4-option popup
   (OFF/LOW/MED/HIGH); tap anywhere while the popup is open picks an option
   if hit, or just closes it either way -- both are swallowed so a popup
   interaction never also fires a game action underneath it. Grouped under
   audio core since it's purely the volume control surface -- RECONCILED
   (RECONCILIATION 1, see header) to intro's RECORD_MODE-aware version.
   ====================================================================== */
// x is CW-44 with CW pinned at its value in every existing engine.js (960)
// -- written as a literal, not `CW-44`, because this is an EAGER top-level
// statement and CW is declared in engine.js, which loads AFTER this file
// (see this file's fitCanvas() note above for the same load-order
// constraint). Every other CW/CH reference in this file lives inside a
// function body, resolved at call time, well after CW exists -- this is
// the one EAGER exception.
const VOL_ICON = { x: 916, y: 12, w: 28, h: 28 };
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
  if(RECORD_MODE) return;
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
  if(RECORD_MODE) return false;
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
  if(RECORD_MODE) return;
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
