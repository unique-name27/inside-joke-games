'use strict';
/* ======================================================================
   tools/verify-config.js -- reusable CONFIG verification: syntax check,
   a full headless playthrough (driven generically off whichever roles
   are cast -- BEAT2/3/4_ENABLED, EPILOGUE_A/B_ENABLED -- not hardcoded to
   any one config), and the tone gate (baseline safety words + the
   config's own forbiddenWords + the FREE-only-inside-punchline rule).

   Used by tools/generate.js (refuses to write games/<slug>/ on failure)
   and directly runnable on its own against any existing config file --
   this is the same Node `vm` harness methodology this project's engine
   rounds have used throughout (never a live browser), now promoted from
   a one-off per-round script into a real, reusable, checked-in tool, so
   FULFILLMENT.md's step 5 ("the vm-harness playthrough... built fresh per
   verification round") has an actual command to run instead of a
   from-scratch write-up each time:

     node tools/verify-config.js games/<slug>/config.js

   Zero dependencies.
   ====================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { buildSandbox } = require('./lib/sandbox');

const REPO_ROOT = path.join(__dirname, '..');
const GAME_ENGINE_PATH = path.join(REPO_ROOT, 'game', 'engine.js');
const CFGCODEC_PATH = path.join(REPO_ROOT, 'game', 'cfgcodec.js');

/* ---------------------------------------------------------------------
   BASELINE_FORBIDDEN -- "always-on safety words": KCK's own baseline
   (COIN/BILL/COST/NOTHING), enforced on EVERY config regardless of what
   its own `forbiddenWords` says, mirroring FULFILLMENT.md's existing
   convention ("append to forbiddenWords... in addition to the baseline").
   A generated config's off-limits list only ever ADDS words to check,
   never removes from this floor.
   --------------------------------------------------------------------- */
const BASELINE_FORBIDDEN = ['COIN', 'BILL', 'COST', 'NOTHING'];

function escapeRegex(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/* Scans the raw config SOURCE TEXT (not a parsed object) for whole-word,
   case-sensitive forbidden-word hits and any bare "FREE" outside "FOR
   FREE?" -- the same convention used throughout this project's own
   verification rounds. The `forbiddenWords`/`punchline` array/field
   DEFINITION lines are excluded from the scan (that's the gate's own
   data, not player-facing text). */
function toneGateSource(configSource, extraForbidden){
  const words = Array.from(new Set(
    BASELINE_FORBIDDEN.concat(extraForbidden || []).map(w => String(w).toUpperCase()).filter(Boolean)
  ));
  // exclude the ENTIRE forbiddenWords array literal from the scan -- that's
  // the gate's own data, not player-facing text. A plain per-LINE exclusion
  // (this project's convention for hand-authored single-line configs) isn't
  // enough for machine-generated (JSON.stringify-pretty-printed) config.js
  // files, where the array's own words each land on their own line and
  // never contain the literal substring "forbiddenWords" -- so this matches
  // the whole `forbiddenWords: [...]`/`"forbiddenWords": [...]` span,
  // single- or multi-line alike ([^\]]* matches newlines, unlike `.`).
  const scanText = configSource.replace(/["']?forbiddenWords["']?\s*:\s*\[[^\]]*\]/g, '');
  const violations = [];
  if(words.length){
    const pattern = new RegExp('\\b(' + words.map(escapeRegex).join('|') + ')\\b');
    const globalPattern = new RegExp(pattern.source, 'g');
    let m;
    while((m = globalPattern.exec(scanText))){
      const lineNo = scanText.slice(0, m.index).split('\n').length;
      violations.push('forbidden word "' + m[0] + '" on line ' + lineNo);
    }
  }
  const freePattern = /FREE/g;
  let fm;
  while((fm = freePattern.exec(scanText))){
    const start = fm.index;
    const window = scanText.slice(Math.max(0, start-8), start+10);
    if(window.indexOf('FOR FREE?') === -1){
      const lineNo = scanText.slice(0, start).split('\n').length;
      violations.push('bare "FREE" outside "FOR FREE?" on line ' + lineNo + ' (context: ' + window.replace(/\n/g,' ') + ')');
    }
  }
  return violations;
}

const PROBE = `
function __probe(){
  return { phase: phase, phaseElapsed: phaseElapsed };
}
function __tick(dt){ gameT += dt; update(dt); }
function __enterPhase(name){ enterPhase(name); }
function __handleAction(){ handleAction(); }
function __firstUncollectedHeart(){
  for(const h of heartPickups){ if(!h.collected) return {x:h.x,y:h.y}; }
  return null;
}
function __setPlayerPos(x,y){ player.x = x; player.y = y; }
function __tryAskReset(){ tryAskReset(); }
function __beat5TargetPos(){ const t = beat5Target(); return { x:t.x, y:t.y }; }
function __flags(){
  return {
    JUDGE_CAST: JUDGE_CAST, AUTHORITY_CAST: AUTHORITY_CAST, SAVIOR_CAST: SAVIOR_CAST,
    BUTTERFINGERS_CAST: BUTTERFINGERS_CAST, BUILDER_CAST: BUILDER_CAST,
    BEAT2_ENABLED: BEAT2_ENABLED, BEAT3_ENABLED: BEAT3_ENABLED, BEAT4_ENABLED: BEAT4_ENABLED,
    EPILOGUE_A_ENABLED: EPILOGUE_A_ENABLED, EPILOGUE_B_ENABLED: EPILOGUE_B_ENABLED,
  };
}
`;

/* throws SyntaxError (with a real stack/message) on malformed JS -- callers
   should catch this separately from a "gameplay didn't reach endcard"
   failure, since a syntax error means the file is fundamentally broken. */
function loadEngineWithConfig(configSource){
  const engineSrc = fs.readFileSync(GAME_ENGINE_PATH, 'utf8');
  const cfgcodecSrc = fs.readFileSync(CFGCODEC_PATH, 'utf8');
  const combined = configSource + '\n' + cfgcodecSrc + '\n' + engineSrc + '\n' + PROBE;
  const sandbox = buildSandbox({ network: 'fail', currentScriptSrc: 'https://example.test/game/engine.js' });
  const ctx = vm.createContext(sandbox);
  const script = new vm.Script(combined, { filename: 'verify-config-generated.js' });
  script.runInContext(ctx);
  return sandbox;
}

function driveBeat1(sb, maxIter){
  const beat1Phases = { story:1, prompt:1, capture:1, breather:1 };
  let iter = 0;
  while(iter++ < (maxIter || 8000)){
    const st = sb.__probe();
    if(!beat1Phases[st.phase]) break;
    if(st.phase === 'prompt') sb.__handleAction();
    if(st.phase === 'capture'){ const h = sb.__firstUncollectedHeart(); if(h) sb.__setPlayerPos(h.x, h.y); }
    sb.__tick(0.03);
  }
}
function tickUntilPhase(sb, phases, maxIter){
  const set = new Set(Array.isArray(phases) ? phases : [phases]);
  let iter = 0;
  while(iter++ < (maxIter || 6000) && !set.has(sb.__probe().phase)) sb.__tick(0.03);
  return sb.__probe().phase;
}
function driveBeat5(sb, maxIter){
  let iter = 0;
  while(iter++ < (maxIter || 300) && sb.__probe().phase === 'beat5_chase'){
    const pos = sb.__beat5TargetPos();
    sb.__setPlayerPos(pos.x, pos.y);
    sb.__tryAskReset();
    for(let k=0;k<120;k++){ sb.__tick(0.03); if(sb.__probe().phase !== 'beat5_chase') break; }
  }
}

/* Generic full playthrough: attentive Beat 1, then follows WHATEVER
   degradation path this config's own cast implies (no hardcoded
   assumptions about which roles exist). Where a beat's own MECHANICS are
   pure gameplay unrelated to config content (the boss dodge/hit fight,
   the Aram chase), it jumps straight past them via the same
   enterPhase(...) shortcut this project's own verification harnesses
   have used all along -- the point is exercising every CONFIG string
   actually getting read (intro lines, critique/duck/hit lines, the
   Widowmaker beat, entrance/turn-good lines, epilogue captions, rank
   names), not re-simulating combat this round didn't touch. */
function drivePlaythrough(sb){
  driveBeat1(sb);
  const flags = sb.__flags();
  if(flags.JUDGE_CAST){
    tickUntilPhase(sb, 'boss', 4000);
    sb.__enterPhase('beat3_revive'); // exercises the Widowmaker beat + the savior's tribute line
    tickUntilPhase(sb, ['beat4_intro', 'celebration'], 8000);
    if(flags.BEAT4_ENABLED){
      tickUntilPhase(sb, 'beat4_chase', 4000); // exercises authority.entranceLine1/2
      sb.__enterPhase('beat4_turngood'); // exercises authority.turnGoodLine1/2, skips the chase minigame itself
    }
  }
  let phase = tickUntilPhase(sb, 'celebration', 4000);
  phase = tickUntilPhase(sb, ['epilogueA', 'epilogueB', 'freeze', 'beat5_chase', 'endcard'], 4000);
  if(phase === 'epilogueA') phase = tickUntilPhase(sb, ['epilogueB', 'freeze', 'beat5_chase', 'endcard'], 4000);
  if(phase === 'epilogueB') phase = tickUntilPhase(sb, ['beat5_chase', 'freeze', 'endcard'], 4000);
  if(phase === 'beat5_chase'){ driveBeat5(sb); phase = tickUntilPhase(sb, ['freeze', 'endcard'], 400); }
  if(phase === 'freeze') phase = tickUntilPhase(sb, 'endcard', 400);
  return sb.__probe().phase;
}

/* the main entry point. `configSource` is the FULL text of a config.js
   file (a `const CONFIG = {...}` statement, 'use strict' and all -- the
   same shape every games/<slug>/config.js already has). `opts.hardMode`
   also runs the hard-mode variant. Returns { ok, errors, warnings,
   phaseReached, flags } -- never throws for a content/gameplay failure
   (a SyntaxError from malformed JS is allowed to propagate, since that's
   a fundamentally different, always-fatal kind of failure callers should
   handle separately). */
function verifyConfigSource(configSource, opts){
  opts = opts || {};
  const errors = [];
  const warnings = [];

  const toneViolations = toneGateSource(configSource, opts.extraForbidden);
  for(const v of toneViolations) errors.push('tone gate: ' + v);

  let sb, flags = null, phaseReached = null;
  try{
    sb = loadEngineWithConfig(configSource);
    flags = sb.__flags();
    phaseReached = drivePlaythrough(sb);
    if(phaseReached !== 'endcard'){
      errors.push('attentive playthrough did not reach the end card (stopped at "' + phaseReached + '")');
    }
  }catch(e){
    if(e instanceof SyntaxError) throw e; // malformed JS -- let the caller treat this distinctly
    errors.push('playthrough threw: ' + (e && e.stack ? e.stack : e));
  }

  if(flags){
    const castCount = ['JUDGE_CAST','AUTHORITY_CAST','SAVIOR_CAST','BUTTERFINGERS_CAST','BUILDER_CAST'].filter(k => flags[k]).length;
    if(castCount === 0) warnings.push('no optional roles cast -- the game is just Beat 1 straight to celebration/end card');
  }

  return { ok: errors.length === 0, errors: errors, warnings: warnings, phaseReached: phaseReached, flags: flags };
}

function verifyConfigFile(filePath, opts){
  const src = fs.readFileSync(filePath, 'utf8');
  return verifyConfigSource(src, opts);
}

module.exports = { verifyConfigSource, verifyConfigFile, toneGateSource, BASELINE_FORBIDDEN };

if(require.main === module){
  const target = process.argv[2];
  if(!target){
    console.error('Usage: node tools/verify-config.js <path-to-config.js>');
    process.exit(2);
  }
  let result;
  try{
    result = verifyConfigFile(path.resolve(target));
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
