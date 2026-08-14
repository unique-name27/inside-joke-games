'use strict';
/* ======================================================================
   tools/verify-gallery.js -- THE GALLERY's own verify driver (see
   SPEC-gallery.md "Verification" and tools/verify-config.js's own header
   for the shared methodology: a Node `vm` harness, zero dependencies,
   never a live browser). Reuses tools/lib/sandbox.js's fake DOM/Canvas/
   AudioContext (the exact same sandbox game/engine.js's own harness
   uses) and tools/verify-config.js's toneGateSource (identical tone-gate
   rule, not a second copy) -- everything ELSE here is gallery-specific:
   gallery/engine.js's script chain (shared/framework.js in place of
   game/skeletons.js -- the gallery has no scene skeleton) and a driver
   that aims through gallery/engine.js's own exposed tick/fireAt/
   targetDrawPos/slotX, the exact same functions this template's own
   round-2 development smoke tests drove by hand -- see this file's
   driveGalleryPlaythrough for the promoted, checked-in version of that.

     node tools/verify-gallery.js games/<slug>/config.js

   Zero dependencies.
   ====================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { buildSandbox } = require('./lib/sandbox');
const { toneGateSource } = require('./verify-config.js');

const REPO_ROOT = path.join(__dirname, '..');
const GALLERY_ENGINE_PATH = path.join(REPO_ROOT, 'gallery', 'engine.js');
const FRAMEWORK_PATH = path.join(REPO_ROOT, 'shared', 'framework.js');
const CFGCODEC_PATH = path.join(REPO_ROOT, 'game', 'cfgcodec.js');
const ROSTER_PATH = path.join(REPO_ROOT, 'game', 'roster.js');

/* exposes gallery/engine.js's own top-level functions to the harness --
   `function` declarations attach to the vm context's global object (see
   tools/verify-config.js's PROBE for the identical `let`-vs-`function`
   note); `tick`/`fireAt`/`handleAction`/`targetDrawPos`/`slotX` are all
   already plain top-level functions in gallery/engine.js, so these
   wrappers are one-line pass-throughs, not new logic. */
const PROBE = `
function __probe(){
  return {
    phase: phase, stage: phaseData && phaseData.stage, roundKey: phaseData && phaseData.roundKey,
    activeCard: activeCard ? activeCard.key : null, assetsReady: assetsReady,
    boss: (typeof boss!=='undefined' && boss) ? { x: boss.x, exposed: boss.exposed, hitsLanded: boss.hitsLanded } : null,
    finale: (typeof finale!=='undefined' && finale) ? { wave: finale.wave, timeLeft: finale.timeLeft,
      slots: finale.slots.map(function(s){ return { row:s.row, slot:s.slot, real:s.real, hit:s.hit }; }) } : null,
    stats: stats, rank: phaseData && phaseData.rank,
  };
}
function __tick(dt){ tick(dt); }
function __handleAction(){ handleAction(); }
function __fireAt(x,y){ fireAt(x,y); }
function __ensureAudio(){ ensureAudioStarted(); }
function __listTargets(){
  return activeTargets.map(function(t){
    var p = targetDrawPos(t);
    return { x:p.x, y:p.y, kind:t.kind, state:t.state, row:t.row, slot:t.slot };
  });
}
function __finaleSlotPos(row, slot){
  var rowY = [196, 292, 396][row];
  return { x: slotX(slot), y: rowY - 6 };
}
function __flags(){
  return { JUDGE_CAST: JUDGE_CAST, AUTHORITY_CAST: AUTHORITY_CAST, SAVIOR_CAST: SAVIOR_CAST, BUTTERFINGERS_CAST: BUTTERFINGERS_CAST, BUILDER_CAST: BUILDER_CAST };
}
/* PEOPLE FIRST (SPEC-people.md round 1) -- see tools/verify-config.js's
   own identical __quotesCoverage/__crewCredits comment; the pattern (and
   the split between "who actually has quotes in this config" vs. "who
   the engine's own QUOTES_SHOWN log says actually showed one") is the
   same for every template's driver. */
function __quotesCoverage(){
  function hasQ(e){ return !!(e && e.quotes && e.quotes.length); }
  var expected = [];
  if(hasQ(CONFIG.host)) expected.push('host');
  ['judge','authority','savior','butterfingers','builder'].forEach(function(r){ if(hasQ(CAST[r])) expected.push(r); });
  if(hasQ(CAST.diner0)) expected.push('diner0');
  return { expected: expected, shown: Object.keys(QUOTES_SHOWN) };
}
function __crewCredits(){
  var extrasNames = (CONFIG.extras || []).filter(function(e){ return e && e.name; }).map(function(e){ return e.name; });
  var creditsShown = CREW_CREDITS.map(function(c){ return c.name; });
  return { extrasNames: extrasNames, creditsShown: creditsShown };
}
`;

/* mirrors tools/verify-config.js's loadEngineWithConfig exactly, just with
   gallery/engine.js's own real script chain (config -> roster -> cfgcodec
   -> shared/framework -> gallery/engine.js -- see gallery/index.html) --
   no game/skeletons.js, the gallery has no scene skeleton. */
function loadGalleryWithConfig(configSource, opts){
  opts = opts || {};
  const engineSrc = fs.readFileSync(GALLERY_ENGINE_PATH, 'utf8');
  const frameworkSrc = fs.readFileSync(FRAMEWORK_PATH, 'utf8');
  const cfgcodecSrc = fs.readFileSync(CFGCODEC_PATH, 'utf8');
  const rosterSrc = fs.readFileSync(ROSTER_PATH, 'utf8');
  const combined = configSource + '\n' + rosterSrc + '\n' + cfgcodecSrc + '\n' + frameworkSrc + '\n' + engineSrc + '\n' + PROBE;
  const sandbox = buildSandbox({ network: 'fail', currentScriptSrc: 'https://example.test/gallery/engine.js', locationHash: opts.locationHash });
  if(opts.beforeRun) opts.beforeRun(sandbox);
  const ctx = vm.createContext(sandbox);
  const script = new vm.Script(combined, { filename: 'verify-gallery-generated.js' });
  script.runInContext(ctx);
  return sandbox;
}

/* drives one round-like phase (round1/round2/round3/elitevolley/
   grandvolley) to completion: fires at the first 'up' roastable target
   every tick, ticks through otherwise, dismisses cards/retry prompts as
   they appear. Never targets friends/butterfingers on purpose (a real
   quota only needs roastable hits) -- the savior-rescue/retry paths still
   get exercised naturally if a config's own tuning ever makes a round
   tight (see SPEC-gallery.md's savior rescue), same as an attentive real
   player. maxIter bounds every phase so a genuine engine bug (a phase that
   never advances) fails the harness instead of hanging it. */
function driveRoundLike(sb, maxIter){
  let iter = 0;
  while(iter++ < (maxIter || 4000) && sb.__probe().phase === 'roundlike'){
    const st = sb.__probe();
    if(st.activeCard){ sb.__handleAction(); sb.__tick(0.03); continue; }
    if(st.stage === 'live'){
      const targets = sb.__listTargets();
      let fired = false;
      for(const t of targets){
        if(t.state === 'up' && t.kind === 'roastable'){ sb.__fireAt(t.x, t.y); fired = true; break; }
      }
      if(!fired) sb.__tick(0.03);
    } else {
      sb.__tick(0.03);
    }
  }
}
/* THE FIRST BOSS -- fires at the boss whenever it's exposed, through the
   fake-death gag and into phase 2, same technique round 2's own
   development smoke test proved out. */
function driveBoss(sb, maxIter){
  let iter = 0;
  while(iter++ < (maxIter || 3000) && sb.__probe().phase === 'boss'){
    const st = sb.__probe();
    if(st.activeCard){ sb.__handleAction(); sb.__tick(0.03); continue; }
    if(st.boss && st.boss.exposed && (st.stage === 'live' || st.stage === 'phase2')) sb.__fireAt(st.boss.x, 168);
    sb.__tick(0.05);
  }
}
/* THE FINAL BOSS -- reads the seeded REAL slot straight off __probe()
   (the driver "knows" the tell the same way the harness reads any other
   scheduled/seeded state -- see SPEC-gallery.md's verification bullet:
   "the driver reads the seeded real-slot index") and fires there every
   wave, through to the win stage. */
function driveFinale(sb, maxIter){
  let iter = 0;
  while(iter++ < (maxIter || 3000) && sb.__probe().phase === 'finale'){
    const st = sb.__probe();
    if(st.activeCard){ sb.__handleAction(); sb.__tick(0.03); continue; }
    if(st.stage === 'live' && st.finale){
      const real = st.finale.slots.find(s => s.real && !s.hit);
      if(real){ const p = sb.__finaleSlotPos(real.row, real.slot); sb.__fireAt(p.x, p.y); }
    }
    sb.__tick(0.05);
  }
}
function driveThrough(sb, phase, maxIter){
  let iter = 0;
  while(iter++ < (maxIter || 2000) && sb.__probe().phase === phase){
    const st = sb.__probe();
    if(st.activeCard) sb.__handleAction();
    sb.__tick(0.05);
  }
}

/* full attentive playthrough: title -> round1/2/3 -> boss (real or elite
   volley) -> finale (real or grand volley) -> celebration -> endcard.
   Degradation-agnostic by construction (same principle as tools/verify-
   config.js's drivePlaythrough) -- it just follows whatever `phase` the
   config's own cast produces at each junction, never hardcodes which
   roles exist. */
function driveGalleryPlaythrough(sb){
  sb.__ensureAudio();
  sb.__handleAction(); // title -> first roundlike's intro card
  let guard = 0;
  while(sb.__probe().phase !== 'endcard' && guard++ < 30){
    const phase = sb.__probe().phase;
    if(phase === 'roundlike') driveRoundLike(sb);
    else if(phase === 'boss') driveBoss(sb);
    else if(phase === 'finale') driveFinale(sb);
    else if(phase === 'celebration') driveThrough(sb, 'celebration');
    else if(phase === 'title'){ sb.__handleAction(); sb.__tick(0.03); }
    else break; // unknown phase -- stop rather than spin forever
  }
  return sb.__probe().phase;
}

/* `configSource` is the FULL text of a config.js file (a `const CONFIG =
   {...}` statement, matching games/<slug>/config.js's own shape when
   template is 'gallery'). Returns { ok, errors, warnings, phaseReached,
   flags } -- same shape as tools/verify-config.js's verifyConfigSource,
   never throws for a content/gameplay failure (a SyntaxError propagates,
   same "fundamentally different, always-fatal" split). */
function verifyGallerySource(configSource, opts){
  opts = opts || {};
  const errors = [];
  const warnings = [];

  const toneViolations = toneGateSource(configSource, opts.extraForbidden);
  for(const v of toneViolations) errors.push('tone gate: ' + v);

  let sb, flags = null, phaseReached = null;
  try{
    sb = loadGalleryWithConfig(configSource);
    flags = sb.__flags();
    phaseReached = driveGalleryPlaythrough(sb);
    if(phaseReached !== 'endcard'){
      errors.push('attentive playthrough did not reach the end card (stopped at "' + phaseReached + '")');
    } else {
      // PEOPLE FIRST (SPEC-people.md round 1) -- see tools/verify-config.js's
      // identical assertion pair for the full rationale.
      const qc = sb.__quotesCoverage();
      for(const key of qc.expected){
        if(qc.shown.indexOf(key) === -1) errors.push('quotes: "' + key + '" has quotes but none ever showed on screen');
      }
      const cc = sb.__crewCredits();
      for(const name of cc.extrasNames){
        if(cc.creditsShown.indexOf(name) === -1) errors.push('credits: extras entry "' + name + '" missing from THE WHOLE CREW end-card block');
      }
    }
  }catch(e){
    if(e instanceof SyntaxError) throw e;
    errors.push('playthrough threw: ' + (e && e.stack ? e.stack : e));
  }

  if(flags){
    const castCount = ['JUDGE_CAST','AUTHORITY_CAST','SAVIOR_CAST','BUTTERFINGERS_CAST','BUILDER_CAST'].filter(k => flags[k]).length;
    if(castCount === 0) warnings.push('no optional roles cast -- both bosses degrade to their volley substitutes, the barker falls back to the sign');
  }

  return { ok: errors.length === 0, errors: errors, warnings: warnings, phaseReached: phaseReached, flags: flags };
}

function verifyGalleryFile(filePath, opts){
  const src = fs.readFileSync(filePath, 'utf8');
  return verifyGallerySource(src, opts);
}

module.exports = {
  verifyGallerySource, verifyGalleryFile,
  loadGalleryWithConfig, driveGalleryPlaythrough, driveRoundLike, driveBoss, driveFinale,
};

if(require.main === module){
  const target = process.argv[2];
  if(!target){
    console.error('Usage: node tools/verify-gallery.js <path-to-config.js>');
    process.exit(2);
  }
  let result;
  try{
    result = verifyGalleryFile(path.resolve(target));
  }catch(e){
    console.error('SYNTAX ERROR in ' + target + ':');
    console.error(e.stack || e);
    process.exit(1);
  }
  console.log((result.ok ? 'PASS' : 'FAIL') + ': ' + target);
  console.log('  phase reached: ' + result.phaseReached);
  if(result.flags) console.log('  cast: ' + JSON.stringify(result.flags));
  for(const w of result.warnings) console.log('  warning: ' + w);
  for(const e of result.errors) console.log('  error: ' + e);
  process.exit(result.ok ? 0 : 1);
}
