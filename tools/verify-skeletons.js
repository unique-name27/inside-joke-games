'use strict';
/* ======================================================================
   tools/verify-skeletons.js -- STORY SKELETONS verification (see
   SPEC-skeletons.md / game/skeletons.js). Zero dependencies, same Node
   `vm` harness methodology as tools/verify-config.js (reuses that file's
   own loadEngineWithConfig/drivePlaythrough rather than re-implementing
   the sandbox plumbing -- see its own module.exports comment).

     node tools/verify-skeletons.js

   Runs, in order:
   1. Dinner literal parity -- SKELETONS.dinner.strings equal the exact
      strings KCK's engine hardcoded before this feature existed.
   2. KCK (game/config.js) full playthrough, NORMAL mode -- no `scene`
      field in that file, proving absent-scene -> 'dinner' end to end.
   3. KCK full playthrough, HARD mode ("SECOND SEATING") -- localStorage
      pre-seeded so the mode-select card appears at boot, then
      __selectHardMode() picks row 1, same as a real returning player.
   4. examples/test-group.config.js playthrough -- also no `scene` field;
      proves the same absent-scene default through a degraded (JUDGE
      uncast) cast.
   5. examples/roadtrip.config.js playthrough (the new example).
   6. Scene matrix -- for EACH of the four scene keys, a
      cfgBuildDefaultConfig(root, scene) base + a fully-cast override, run
      through the full generic playthrough + tone gate.
   7. Tone gate over the whole of game/skeletons.js's own source.
   8. Round-trip -- cfgEncodeConfigFragment -> cfgDecompress for each
      scene key (survives), an unknown key, and an absent key (both
      sanitize to absent).
   ====================================================================== */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const {
  cfgBuildDefaultConfig, cfgDeepMerge, cfgEncodeConfigFragment, cfgDecompress, CFG_SCENE_KEYS,
} = require(path.join(REPO_ROOT, 'game', 'cfgcodec.js'));
const { SKELETONS } = require(path.join(REPO_ROOT, 'game', 'skeletons.js'));
const {
  verifyConfigFile, verifyConfigSource, toneGateSource, loadEngineWithConfig, drivePlaythrough,
} = require('./verify-config.js');

const SKELETONS_PATH = path.join(REPO_ROOT, 'game', 'skeletons.js');
const GAME_CONFIG_PATH = path.join(REPO_ROOT, 'game', 'config.js');
const TEST_GROUP_EXAMPLE_PATH = path.join(REPO_ROOT, 'examples', 'test-group.config.js');
const ROADTRIP_EXAMPLE_PATH = path.join(REPO_ROOT, 'examples', 'roadtrip.config.js');

const results = []; // { ok, label, detail }
function record(label, ok, detail){
  results.push({ label, ok, detail: detail || '' });
  console.log((ok ? 'PASS' : 'FAIL') + ': ' + label + (detail ? ' -- ' + detail : ''));
}

/* ----------------------------------------------------------------------
   1. Dinner literal parity -- these are EXACTLY the strings KCK's
   engine.js hardcoded before the extraction (game/engine.js's old
   CARDS.start / MODE_SELECT_ROWS / 'CHOOSE YOUR SEATING' / 'SECOND
   SEATING AWAITS AT THE START' / 'SECOND SEATING CLEARED' literals --
   see SPEC-skeletons.md's "dinner -- THE DINNER PARTY (parity skeleton)").
   ---------------------------------------------------------------------- */
function checkDinnerParity(){
  const expected = {
    startCardTitle: 'DINNER IS SERVED',
    startCardBody: ['THE GUYS TELL THEIR STORIES.','WAIT FOR THE LAST WORD...','THEN HIT SPACE.',"DON'T LET THE LAUGHTER DIE."],
    modeSelectTitle: 'CHOOSE YOUR SEATING',
    modeRowNormal: 'FIRST SEATING  --  A NICE DINNER',
    modeRowHard: 'SECOND SEATING  --  MUCH HARDER. YOU CAN LOSE.',
    hardUnlockLine: 'SECOND SEATING AWAITS AT THE START',
    hardClearedLine: 'SECOND SEATING CLEARED',
  };
  const actual = SKELETONS.dinner && SKELETONS.dinner.strings;
  if(!actual) return record('dinner literal parity', false, 'SKELETONS.dinner.strings is missing');
  const mismatches = [];
  for(const key in expected){
    const exp = JSON.stringify(expected[key]);
    const act = JSON.stringify(actual[key]);
    if(exp !== act) mismatches.push(key + ': expected ' + exp + ', got ' + act);
  }
  record('dinner literal parity (strings match KCK\'s old hardcoded literals)', mismatches.length === 0, mismatches.join('; '));
}

/* ----------------------------------------------------------------------
   2/3. KCK (game/config.js), normal + hard mode. Hard mode needs
   hasBeatenBefore true BEFORE the combined script evaluates (that's a
   one-time top-level check, not something a probe hook can flip after
   the fact) -- loadEngineWithConfig's beforeRun hook patches
   sandbox.localStorage.getItem to answer '1' for ANY "*_beaten" key
   (works regardless of this config's own gameId) before the script runs;
   __selectHardMode() (tools/verify-config.js's own PROBE addition) then
   picks SECOND SEATING and confirms it, same as a real returning player.
   ---------------------------------------------------------------------- */
function checkKckPlaythroughs(){
  const configSource = fs.readFileSync(GAME_CONFIG_PATH, 'utf8');
  try{
    const result = verifyConfigSource(configSource, {});
    record('KCK (game/config.js) normal-mode playthrough', result.ok, result.ok ? ('reached ' + result.phaseReached) : result.errors.join('; '));
  }catch(e){
    record('KCK (game/config.js) normal-mode playthrough', false, 'threw: ' + (e && e.stack ? e.stack : e));
  }
  try{
    const sb = loadEngineWithConfig(configSource, {
      beforeRun(sandbox){
        const origGetItem = sandbox.localStorage.getItem;
        sandbox.localStorage.getItem = function(k){ return /_beaten$/.test(k) ? '1' : origGetItem(k); };
      },
    });
    sb.__selectHardMode();
    const phase = drivePlaythrough(sb);
    record('KCK (game/config.js) hard-mode ("SECOND SEATING") playthrough', phase === 'endcard', 'reached ' + phase);
  }catch(e){
    record('KCK (game/config.js) hard-mode playthrough', false, 'threw: ' + (e && e.stack ? e.stack : e));
  }
}

/* ----------------------------------------------------------------------
   4/5. Existing examples -- proves absent-scene -> dinner through the
   shell/codec path (neither file has a `scene` field), plus the new
   roadtrip example.
   ---------------------------------------------------------------------- */
function checkExamples(){
  for(const [label, filePath] of [
    ['examples/test-group.config.js (degraded, no scene field)', TEST_GROUP_EXAMPLE_PATH],
    ['examples/roadtrip.config.js', ROADTRIP_EXAMPLE_PATH],
  ]){
    try{
      const result = verifyConfigFile(filePath, {});
      record(label, result.ok, result.ok ? ('reached ' + result.phaseReached) : result.errors.join('; '));
    }catch(e){
      record(label, false, 'threw: ' + (e && e.stack ? e.stack : e));
    }
  }
}

/* ----------------------------------------------------------------------
   6. Scene matrix -- every scene key, fully cast, full generic
   playthrough + tone gate (verifyConfigSource already runs both).
   ---------------------------------------------------------------------- */
const FULL_CAST_OVERRIDE = {
  cast: {
    judge: { name: 'THE CRITIC GUY', spriteCol: 4, spriteRow: 8 },
    authority: { name: 'THE BOSS GUY' },
    savior: { name: 'THE SAVIOR GUY' },
    butterfingers: { name: 'THE PHONE GUY', spriteCol: 3, spriteRow: 8 },
    builder: { name: 'THE BUILDER GUY', spriteCol: 2, spriteRow: 8 },
  },
};
function buildSceneConfigSource(sceneKey){
  const base = cfgBuildDefaultConfig('../', sceneKey);
  const cfg = cfgDeepMerge(base, FULL_CAST_OVERRIDE);
  cfg.gameId = 'scene-matrix-' + sceneKey;
  return "'use strict';\nconst CONFIG = " + JSON.stringify(cfg) + ";\n";
}
function checkSceneMatrix(){
  for(const sceneKey of CFG_SCENE_KEYS){
    const label = 'scene matrix: ' + sceneKey + ' (full cast, cfgBuildDefaultConfig default base)';
    try{
      const configSource = buildSceneConfigSource(sceneKey);
      const result = verifyConfigSource(configSource, {});
      record(label, result.ok, result.ok ? ('reached ' + result.phaseReached + ', cast=' + JSON.stringify(result.flags)) : result.errors.join('; '));
    }catch(e){
      record(label, false, 'threw: ' + (e && e.stack ? e.stack : e));
    }
  }
}

/* ----------------------------------------------------------------------
   7. Tone gate over the whole of game/skeletons.js's own source (baseline
   forbidden words + the FREE-only-inside-"FOR FREE?" rule) -- every
   skeleton's strings AND any stray text in a comment/draw function alike.
   ---------------------------------------------------------------------- */
function checkSkeletonsToneGate(){
  const src = fs.readFileSync(SKELETONS_PATH, 'utf8');
  const violations = toneGateSource(src, []);
  record('tone gate over game/skeletons.js source', violations.length === 0, violations.join('; '));
}

/* ----------------------------------------------------------------------
   8. Round-trip: cfgEncodeConfigFragment -> cfgDecompress -> JSON.parse.
   `scene` survives for each valid key; an unknown or absent scene
   sanitizes to absent (dropped key) either way.
   ---------------------------------------------------------------------- */
function checkRoundTrip(){
  for(const sceneKey of CFG_SCENE_KEYS){
    try{
      const encoded = cfgEncodeConfigFragment({ scene: sceneKey, host: { name: 'ROUNDTRIP' } });
      const decoded = JSON.parse(cfgDecompress(encoded));
      record('round-trip: scene "' + sceneKey + '" survives encode/decode', decoded.scene === sceneKey, 'got scene=' + JSON.stringify(decoded.scene));
    }catch(e){
      record('round-trip: scene "' + sceneKey + '"', false, 'threw: ' + (e && e.stack ? e.stack : e));
    }
  }
  try{
    const encodedUnknown = cfgEncodeConfigFragment({ scene: 'not-a-real-scene' });
    const decodedUnknown = JSON.parse(cfgDecompress(encodedUnknown));
    record('round-trip: unknown scene sanitizes to absent', decodedUnknown.scene === undefined, 'got scene=' + JSON.stringify(decodedUnknown.scene));
  }catch(e){
    record('round-trip: unknown scene sanitizes to absent', false, 'threw: ' + (e && e.stack ? e.stack : e));
  }
  try{
    const encodedAbsent = cfgEncodeConfigFragment({});
    const decodedAbsent = JSON.parse(cfgDecompress(encodedAbsent));
    record('round-trip: absent scene sanitizes to absent', decodedAbsent.scene === undefined, 'got scene=' + JSON.stringify(decodedAbsent.scene));
  }catch(e){
    record('round-trip: absent scene sanitizes to absent', false, 'threw: ' + (e && e.stack ? e.stack : e));
  }
}

function main(){
  checkDinnerParity();
  checkKckPlaythroughs();
  checkExamples();
  checkSceneMatrix();
  checkSkeletonsToneGate();
  checkRoundTrip();

  const failed = results.filter(r => !r.ok);
  console.log('');
  console.log(results.length + ' checks, ' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed.');
  process.exit(failed.length ? 1 : 0);
}

if(require.main === module) main();

module.exports = { checkDinnerParity, checkKckPlaythroughs, checkExamples, checkSceneMatrix, checkSkeletonsToneGate, checkRoundTrip };
