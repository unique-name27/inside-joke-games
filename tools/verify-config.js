'use strict';
/* ======================================================================
   tools/verify-config.js -- reusable CONFIG verification: syntax check,
   a full headless playthrough (driven generically off whichever roles
   are cast -- BEAT2/3/4_ENABLED, EPILOGUE_A/B_ENABLED -- not hardcoded to
   any one config), and the tone gate (this config's own forbiddenWords
   list, and nothing else -- see forbiddenWords' own comment in
   game/cfgcodec.js's cfgBuildDefaultConfig for why there's no baseline/
   universal word list: the off-limits words were always one specific
   group's own list, never a rule the product itself imposes).

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
const SKELETONS_PATH = path.join(REPO_ROOT, 'game', 'skeletons.js');
const ROSTER_PATH = path.join(REPO_ROOT, 'game', 'roster.js');
const FRAMEWORK_PATH = path.join(REPO_ROOT, 'shared', 'framework.js');

function escapeRegex(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/* Scans the raw config SOURCE TEXT (not a parsed object) for whole-word,
   case-sensitive forbidden-word hits against this config's OWN
   `forbiddenWords` list (plus `extraForbidden`, a caller-supplied add-on
   -- tools/generate.js/the /build/ wizard don't currently pass one, but
   the hook stays for anything that wants to layer on more without
   touching the config's own list). There's no universal/baseline word
   list and no special-cased punchline exception anymore -- the tone gate
   is entirely per-group, matching a normal person's actual worry ("don't
   let the game say THIS"), not a rule the product itself imposes. A
   config with nothing off-limits (forbiddenWords: []) ships with zero
   forbidden-word checks, by design. The `forbiddenWords` array/field
   DEFINITION line is excluded from the scan (that's the gate's own data,
   not player-facing text). */
function toneGateSource(configSource, extraForbidden){
  const words = Array.from(new Set(
    (extraForbidden || []).map(w => String(w).toUpperCase()).filter(Boolean)
  ));
  // exclude the ENTIRE forbiddenWords array literal from the scan -- that's
  // the gate's own data, not player-facing text. A plain per-LINE exclusion
  // (this project's convention for hand-authored single-line configs) isn't
  // enough for machine-generated (JSON.stringify-pretty-printed) config.js
  // files, where the array's own words each land on their own line and
  // never contain the literal substring "forbiddenWords" -- so this matches
  // the whole `forbiddenWords: [...]`/`"forbiddenWords": [...]` span,
  // single- or multi-line alike ([^\]]* matches newlines, unlike `.`).
  // The config's OWN list is read back out of that same span (rather than
  // requiring every caller to also pass it in) so `node tools/verify-
  // config.js <file>` keeps working as a single-argument, no-extra-setup
  // command against any real config file.
  const forbiddenMatch = /["']?forbiddenWords["']?\s*:\s*\[([^\]]*)\]/.exec(configSource);
  if(forbiddenMatch){
    const listedWords = forbiddenMatch[1].match(/["']([^"']*)["']/g) || [];
    for(const w of listedWords) words.push(w.slice(1, -1).toUpperCase());
  }
  const uniqueWords = Array.from(new Set(words.filter(Boolean)));
  const scanText = configSource.replace(/["']?forbiddenWords["']?\s*:\s*\[[^\]]*\]/g, '');
  const violations = [];
  if(uniqueWords.length){
    const pattern = new RegExp('\\b(' + uniqueWords.map(escapeRegex).join('|') + ')\\b');
    const globalPattern = new RegExp(pattern.source, 'g');
    let m;
    while((m = globalPattern.exec(scanText))){
      const lineNo = scanText.slice(0, m.index).split('\n').length;
      violations.push('forbidden word "' + m[0] + '" on line ' + lineNo);
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
/* only reachable/meaningful when the sandbox's localStorage was pre-seeded
   (before script load) with a truthy "<gameId>_beaten" key, which is what
   makes hasBeatenBefore true and modeSelectPending true at boot -- see
   tools/verify-skeletons.js's hard-mode playthrough, the one caller of
   this. Picks SECOND SEATING/hard mode and confirms it, same as a real
   player choosing row 1 on the mode-select card. */
function __selectHardMode(){
  if(typeof modeSelectPending !== 'undefined' && modeSelectPending){
    modeSelectIndex = 1;
    confirmModeSelect();
  }
}
/* PEOPLE FIRST (SPEC-people.md round 1) -- __quotesCoverage reports which
   host/cast members ACTUALLY have quotes in this config (\`expected\`) vs.
   which ones the engine's own QUOTES_SHOWN log recorded as having shown
   one on screen this playthrough (\`shown\`) -- the driver below just
   diffs the two arrays, never re-typing a name/role here (see this
   engine's own buildCrewCredits/nextQuoteFor/pickBreatherQuoteSpeaker/
   CRITIC_*_LINES hookups for how each gets covered). __crewCredits
   reports the extras names this config defines vs. the names THE WHOLE
   CREW end-card block actually listed (built once at enterPhase(
   'endcard'), see buildCrewCredits). Both are empty/trivially-satisfied
   for any quote-less config, by construction. */
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
/* PHASE C (characters are their people) -- tools/verify-skeletons.js's own
   roster-defaults check reads this: every place a cast/host sprite
   resolves to an actual {sheet,col,row}, so it can assert an unpicked
   config still resolves to game/roster.js's own documented default tile
   for every seat. */
function __rosterProbe(){
  return {
    diners: DINER_DEFS.map(function(d){ return { sheet:d.sheet, col:d.col, row:d.row }; }),
    host: HOST_SPRITE,
    critic: CRITIC_SPRITE_SRC,
    savior: SAVIOR_SPRITE,
    authorityPick: (typeof AUTHORITY_SPRITE_PICK !== 'undefined') ? AUTHORITY_SPRITE_PICK : null,
  };
}
`;

/* throws SyntaxError (with a real stack/message) on malformed JS -- callers
   should catch this separately from a "gameplay didn't reach endcard"
   failure, since a syntax error means the file is fundamentally broken.
   game/skeletons.js loads between cfgcodec and the engine, mirroring the
   real pages' own <script> order (see README.md/SPEC-skeletons.md) --
   every engine.js now resolves SKEL off SKELETONS at boot, so this harness
   needs it in scope exactly like a real page does. `opts.beforeRun(sandbox)`,
   if given, runs AFTER the sandbox is built but BEFORE the combined script
   executes -- the one hook tools/verify-skeletons.js needs to pre-seed
   localStorage (sandbox.localStorage is a plain object reference, still
   mutable from here even after vm.createContext) for its hard-mode
   playthrough, without this file needing to know anything about hard mode
   itself. */
function loadEngineWithConfig(configSource, opts){
  opts = opts || {};
  const engineSrc = fs.readFileSync(GAME_ENGINE_PATH, 'utf8');
  const cfgcodecSrc = fs.readFileSync(CFGCODEC_PATH, 'utf8');
  const skeletonsSrc = fs.readFileSync(SKELETONS_PATH, 'utf8');
  const rosterSrc = fs.readFileSync(ROSTER_PATH, 'utf8');
  const frameworkSrc = fs.readFileSync(FRAMEWORK_PATH, 'utf8');
  // roster.js MUST precede cfgcodec.js in this concatenation -- cfgcodec.js's
  // CFG_CAST_ENTRY_FIELDS reads the ROSTER_KEYS global at top-level eval
  // time (see its own comment). shared/framework.js loads right before
  // engine.js, mirroring every real index.html's own <script> order (THE
  // GALLERY round 1 -- see shared/framework.js's header).
  const combined = configSource + '\n' + rosterSrc + '\n' + cfgcodecSrc + '\n' + skeletonsSrc + '\n' + frameworkSrc + '\n' + engineSrc + '\n' + PROBE;
  const sandbox = buildSandbox({ network: 'fail', currentScriptSrc: 'https://example.test/game/engine.js', locationHash: opts.locationHash });
  if(opts.beforeRun) opts.beforeRun(sandbox);
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
   the final-boss chase), it jumps straight past them via the same
   enterPhase(...) shortcut this project's own verification harnesses
   have used all along -- the point is exercising every CONFIG string
   actually getting read (intro lines, critique/duck/hit lines, the
   comeback beat, entrance/turn-good lines, epilogue captions, rank
   names), not re-simulating combat this round didn't touch. */
function drivePlaythrough(sb){
  driveBeat1(sb);
  const flags = sb.__flags();
  if(flags.JUDGE_CAST){
    tickUntilPhase(sb, 'boss', 4000);
    sb.__enterPhase('beat3_revive'); // exercises the comeback beat + the savior's tribute line
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
    } else {
      // PEOPLE FIRST (SPEC-people.md round 1) -- every host/cast member with
      // quotes surfaced >=1 of them somewhere this playthrough, and every
      // named `extras` entry made it into THE WHOLE CREW end-card block.
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

module.exports = {
  verifyConfigSource, verifyConfigFile, toneGateSource,
  // exposed for tools/verify-skeletons.js -- the scene matrix reuses these
  // directly (rather than duplicating the vm/PROBE plumbing) for its own
  // per-scene playthroughs and its hard-mode variant (which needs
  // loadEngineWithConfig's beforeRun hook to pre-seed localStorage before
  // the combined script evaluates).
  loadEngineWithConfig, drivePlaythrough, driveBeat1, tickUntilPhase, driveBeat5,
};

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
