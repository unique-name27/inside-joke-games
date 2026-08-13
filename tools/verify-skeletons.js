'use strict';
/* ======================================================================
   tools/verify-skeletons.js -- STORY SKELETONS verification (see
   SPEC-skeletons.md / game/skeletons.js) + PHASE C roster verification
   (see game/roster.js). Zero dependencies, same Node `vm` harness
   methodology as tools/verify-config.js (reuses that file's own
   loadEngineWithConfig/drivePlaythrough rather than re-implementing the
   sandbox plumbing -- see its own module.exports comment).

     node tools/verify-skeletons.js

   Runs, in order:
   1. examples/test-group.config.js playthrough -- no `scene` field;
      proves absent-scene -> 'dinner' through a degraded (JUDGE uncast)
      cast.
   2. examples/roadtrip.config.js playthrough.
   3. Scene matrix -- for EACH of the four scene keys, a
      cfgBuildDefaultConfig(root, scene) base + a fully-cast override, run
      through the full generic playthrough (no baseline/universal tone
      gate anymore -- see tools/verify-config.js's toneGateSource; this
      neutral config has nothing in forbiddenWords to check).
   4. Neutral default config, HARD MODE ("SECOND SEATING") playthrough --
      localStorage pre-seeded so the mode-select card appears at boot,
      then __selectHardMode() picks row 1, same as a real returning
      player. (game/config.js is a stub now (no file config of its own),
      so this exercises the same hard-mode code path off the neutral
      scene-matrix base instead.)
   5. Round-trip -- cfgEncodeConfigFragment -> cfgDecompress for each
      scene key (survives), an unknown key, and an absent key (both
      sanitize to absent).
   6. Roster resource check -- every roster entry's backing sheet ships
      on disk, and every entry's `sheet` resolves to a real ROSTER_SHEETS
      mapping.
   7. Roster defaults -- with no `sprite` (or spriteCol/spriteRow) pick
      set anywhere, every cast/host sprite resolution comes out exactly
      equal to game/roster.js's own documented default entry for that
      slot (villager/grandma/braid/vest/plain) -- proves the "absent pick
      -> the roster's own documented default" guarantee end to end (not
      just per-function in isolation).
   ====================================================================== */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const {
  cfgBuildDefaultConfig, cfgDeepMerge, cfgEncodeConfigFragment, cfgDecompress, CFG_SCENE_KEYS,
} = require(path.join(REPO_ROOT, 'game', 'cfgcodec.js'));
const { ROSTER, ROSTER_SHEETS, ROSTER_BY_KEY } = require(path.join(REPO_ROOT, 'game', 'roster.js'));
const {
  verifyConfigFile, verifyConfigSource, loadEngineWithConfig, drivePlaythrough,
} = require('./verify-config.js');
const { verifyGalleryFile, verifyGallerySource } = require('./verify-gallery.js');
const { verifyFlightFile, verifyFlightSource, verifyFlightHostOnlySource } = require('./verify-flight.js');

const TEST_GROUP_EXAMPLE_PATH = path.join(REPO_ROOT, 'examples', 'test-group.config.js');
const ROADTRIP_EXAMPLE_PATH = path.join(REPO_ROOT, 'examples', 'roadtrip.config.js');
const GALLERY_SAMPLE_EXAMPLE_PATH = path.join(REPO_ROOT, 'examples', 'gallery-sample.config.js');
const FLIGHT_SAMPLE_EXAMPLE_PATH = path.join(REPO_ROOT, 'examples', 'flight-sample.config.js');

const results = []; // { ok, label, detail }
function record(label, ok, detail){
  results.push({ label, ok, detail: detail || '' });
  console.log((ok ? 'PASS' : 'FAIL') + ': ' + label + (detail ? ' -- ' + detail : ''));
}

/* ----------------------------------------------------------------------
   1/2. Existing examples -- proves absent-scene -> dinner through the
   shell/codec path (neither file has a `scene` field).
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
   3. Scene matrix -- every scene key, fully cast, full generic
   playthrough (verifyConfigSource also runs the tone gate, but this
   neutral config's forbiddenWords is empty -- see cfgBuildDefaultConfig
   -- so that step is a no-op here by design, not skipped).
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
   4. Hard mode, off the same neutral 'dinner' scene-matrix base
   (game/config.js is a stub now and can't run a playthrough at all --
   this is the generic replacement). Hard mode needs
   hasBeatenBefore true BEFORE the combined script evaluates (that's a
   one-time top-level check, not something a probe hook can flip after
   the fact) -- loadEngineWithConfig's beforeRun hook patches
   sandbox.localStorage.getItem to answer '1' for ANY "*_beaten" key;
   __selectHardMode() then picks SECOND SEATING and confirms it, same as
   a real returning player.
   ---------------------------------------------------------------------- */
function checkHardModePlaythrough(){
  try{
    const configSource = buildSceneConfigSource('dinner');
    const sb = loadEngineWithConfig(configSource, {
      beforeRun(sandbox){
        const origGetItem = sandbox.localStorage.getItem;
        sandbox.localStorage.getItem = function(k){ return /_beaten$/.test(k) ? '1' : origGetItem(k); };
      },
    });
    sb.__selectHardMode();
    const phase = drivePlaythrough(sb);
    record('neutral default config, hard-mode ("SECOND SEATING") playthrough', phase === 'endcard', 'reached ' + phase);
  }catch(e){
    record('neutral default config, hard-mode playthrough', false, 'threw: ' + (e && e.stack ? e.stack : e));
  }
}

/* ----------------------------------------------------------------------
   5. Round-trip: cfgEncodeConfigFragment -> cfgDecompress -> JSON.parse.
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

/* ----------------------------------------------------------------------
   6. PHASE C (characters are their people) -- resource check: the harness
   never draws a tile (tools/lib/sandbox.js's FakeImage never actually
   decodes a PNG), so this is the one place that can actually prove every
   roster entry's backing sheet ships as a real file on disk, and that
   every entry's `sheet` key resolves to a real ROSTER_SHEETS mapping (no
   typo pointing an entry at an unlisted sheet).
   ---------------------------------------------------------------------- */
function checkRosterAssets(){
  const missing = [];
  for(const entry of ROSTER){
    const sheetDef = ROSTER_SHEETS[entry.sheet];
    if(!sheetDef){ missing.push(entry.key + ': unknown sheet "' + entry.sheet + '"'); continue; }
    const abs = path.join(REPO_ROOT, sheetDef.path);
    if(!fs.existsSync(abs)) missing.push(entry.key + ': ' + sheetDef.path + ' does not exist');
  }
  record('roster: every entry\'s backing sheet ships in assets/ (' + ROSTER.length + ' entries, ' + Object.keys(ROSTER_SHEETS).length + ' sheets)', missing.length === 0, missing.join('; '));
}

/* ----------------------------------------------------------------------
   7. PHASE C -- roster defaults: a fully-cast neutral config with no
   `sprite`/spriteCol/spriteRow set anywhere -- every cast/host sprite
   resolution must come out EXACTLY equal to game/roster.js's own
   documented default entry for that slot. Expected values are read
   straight off ROSTER_BY_KEY (not re-typed as literals) so this can never
   silently drift from the roster's own data if it changes.
   __rosterProbe (tools/verify-config.js's PROBE) exposes the resolved
   values directly off the running sandbox.
   ---------------------------------------------------------------------- */
const ROSTER_DEFAULTS_OVERRIDE = {
  cast: {
    judge: { name: 'THE CRITIC GUY' },
    authority: { name: 'THE BOSS GUY' },
    savior: { name: 'THE SAVIOR GUY' },
    butterfingers: { name: 'THE PHONE GUY' },
    builder: { name: 'THE BUILDER GUY' },
  },
};
function rosterTile(key){
  const r = ROSTER_BY_KEY[key];
  return { sheet: r.sheet, col: r.col, row: r.row };
}
function checkRosterDefaults(){
  const expected = {
    diners: [
      rosterTile('villager'),  // diner0
      rosterTile('grandma'),   // judge
      rosterTile('braid'),     // butterfingers
      rosterTile('vest'),      // builder
    ],
    host: rosterTile('plain'),
    critic: rosterTile('grandma'),  // same tile as judge, tinted for the boss form
    savior: rosterTile('braid'),    // same tile as butterfingers, drawn plain
    authorityPick: null,            // no pick -- bespoke tinted rendering stays
  };
  try{
    const base = cfgBuildDefaultConfig('../', 'dinner');
    const cfg = cfgDeepMerge(base, ROSTER_DEFAULTS_OVERRIDE);
    cfg.gameId = 'roster-defaults-check';
    const configSource = "'use strict';\nconst CONFIG = " + JSON.stringify(cfg) + ";\n";
    const sb = loadEngineWithConfig(configSource, {});
    const actual = sb.__rosterProbe();
    const mismatches = [];
    for(const key in expected){
      const exp = JSON.stringify(expected[key]);
      const act = JSON.stringify(actual[key]);
      if(exp !== act) mismatches.push(key + ': expected ' + exp + ', got ' + act);
    }
    record('roster: no-sprite-pick path resolves every seat to the roster\'s documented defaults', mismatches.length === 0, mismatches.join('; '));
  }catch(e){
    record('roster: no-sprite-pick defaults', false, 'threw: ' + (e && e.stack ? e.stack : e));
  }
}

/* ----------------------------------------------------------------------
   8. THE GALLERY (template #2, see SPEC-gallery.md "Verification") --
   fully-cast + host-only-degraded playthroughs (tools/verify-gallery.js's
   own driver, same methodology as every playthrough above) plus a
   fragment round-trip: `template` + `gallery.targets` survive encode/
   decode, and an unrecognized `template` sanitizes away entirely (falls
   back to cfgBuildDefaultConfig's own 'hangout' default, exactly like an
   absent one always has).
   ---------------------------------------------------------------------- */
function checkGalleryPlaythroughs(){
  try{
    const result = verifyGalleryFile(GALLERY_SAMPLE_EXAMPLE_PATH, {});
    record('examples/gallery-sample.config.js (full cast)', result.ok, result.ok ? ('reached ' + result.phaseReached + ', cast=' + JSON.stringify(result.flags)) : result.errors.join('; '));
  }catch(e){
    record('examples/gallery-sample.config.js (full cast)', false, 'threw: ' + (e && e.stack ? e.stack : e));
  }
  try{
    // host-only: every optional role stripped -- both boss rounds degrade
    // to their volley substitutes, no savior/butterfingers/named barker
    // (see SPEC-gallery.md's degradation map).
    const fullSrc = fs.readFileSync(GALLERY_SAMPLE_EXAMPLE_PATH, 'utf8');
    const hostOnlySrc = fullSrc.replace(/cast: \{[\s\S]*?\n  \},/, 'cast: {},');
    if(hostOnlySrc === fullSrc) throw new Error('cast block not found/replaced -- example file shape changed');
    const result = verifyGallerySource(hostOnlySrc, {});
    record('gallery-sample, host-only (every optional role uncast)', result.ok, result.ok ? ('reached ' + result.phaseReached + ', cast=' + JSON.stringify(result.flags)) : result.errors.join('; '));
  }catch(e){
    record('gallery-sample, host-only', false, 'threw: ' + (e && e.stack ? e.stack : e));
  }
}
function checkGalleryRoundTrip(){
  try{
    const encoded = cfgEncodeConfigFragment({
      template: 'gallery',
      gallery: { targets: ['THE KAYAK', 'MARCOS SIX TEN', 'THE GROUP CHAT', 'THAT ONE TEXT'], firstBossHeckle: 'CALL THAT AIM' },
      host: { name: 'ROUNDTRIP' },
    });
    const decoded = JSON.parse(cfgDecompress(encoded));
    const targetsOk = Array.isArray(decoded.gallery && decoded.gallery.targets) && decoded.gallery.targets.length === 4;
    record('round-trip: template "gallery" + gallery.targets survive encode/decode', decoded.template === 'gallery' && targetsOk,
      'got template=' + JSON.stringify(decoded.template) + ', targets=' + JSON.stringify(decoded.gallery && decoded.gallery.targets));
  }catch(e){
    record('round-trip: template "gallery" survives encode/decode', false, 'threw: ' + (e && e.stack ? e.stack : e));
  }
  try{
    const encodedUnknown = cfgEncodeConfigFragment({ template: 'not-a-real-template' });
    const decodedUnknown = JSON.parse(cfgDecompress(encodedUnknown));
    const fallsBackToHangout = decodedUnknown.template === undefined && !('gallery' in cfgBuildDefaultConfig('../', undefined, decodedUnknown.template));
    record('round-trip: unknown template sanitizes away -> hangout default', fallsBackToHangout, 'got template=' + JSON.stringify(decodedUnknown.template));
  }catch(e){
    record('round-trip: unknown template sanitizes away', false, 'threw: ' + (e && e.stack ? e.stack : e));
  }
}

/* ----------------------------------------------------------------------
   9. THE FLIGHT (template #3, see SPEC-flight.md "Verification") --
   fully-cast + host-only-degraded playthroughs (tools/verify-flight.js's
   own driver -- bang-bang gate piloting + the reactive final-boss dodge,
   THE SHOUT driven deliberately, ONE TANK unlock+stall -- see that file's
   own header) plus a fragment round-trip: `template` + all five
   `flight.*` fields survive encode/decode, and an oversized beats/hazards
   array clamps to the schema's ceiling (6 each) -- same methodology as
   checkGalleryPlaythroughs/checkGalleryRoundTrip just above.
   ---------------------------------------------------------------------- */
function checkFlightPlaythroughs(){
  try{
    const result = verifyFlightFile(FLIGHT_SAMPLE_EXAMPLE_PATH, {});
    record('examples/flight-sample.config.js (full cast)', result.ok, result.ok ? ('reached ' + result.phaseReached + ', cast=' + JSON.stringify(result.flags)) : result.errors.join('; '));
  }catch(e){
    record('examples/flight-sample.config.js (full cast)', false, 'threw: ' + (e && e.stack ? e.stack : e));
  }
  try{
    // host-only: every optional role stripped -- THE FIRST BOSS's leg
    // plays as an ordinary leg, THE FINAL BOSS is skipped (clear-sky
    // landing), no savior save, no butterfingers gag (see SPEC-flight.md's
    // cast-mapping bullet: "uncast = skip, no substitutes").
    const fullSrc = fs.readFileSync(FLIGHT_SAMPLE_EXAMPLE_PATH, 'utf8');
    const hostOnlySrc = fullSrc.replace(/cast: \{[\s\S]*?\n  \},/, 'cast: {},');
    if(hostOnlySrc === fullSrc) throw new Error('cast block not found/replaced -- example file shape changed');
    const result = verifyFlightHostOnlySource(hostOnlySrc, {});
    record('flight-sample, host-only (every optional role uncast)', result.ok, result.ok ? ('reached ' + result.phaseReached + ', cast=' + JSON.stringify(result.flags)) : result.errors.join('; '));
  }catch(e){
    record('flight-sample, host-only', false, 'threw: ' + (e && e.stack ? e.stack : e));
  }
}
function checkFlightRoundTrip(){
  try{
    const encoded = cfgEncodeConfigFragment({
      template: 'flight',
      flight: { beats: ['LEG ONE.', 'LEG TWO.', 'LEG THREE.'], hazards: ['THE WEATHER', 'THE DIRECTIONS'], planeColor: 'red', firstBossHeckle: 'CALL THAT FLYING', finalBossQuirk: 'ALWAYS LATE' },
      host: { name: 'ROUNDTRIP' },
    });
    const decoded = JSON.parse(cfgDecompress(encoded));
    const f = decoded.flight || {};
    const ok = decoded.template === 'flight'
      && Array.isArray(f.beats) && f.beats.length === 3
      && Array.isArray(f.hazards) && f.hazards.length === 2
      && f.planeColor === 'red' && f.firstBossHeckle === 'CALL THAT FLYING' && f.finalBossQuirk === 'ALWAYS LATE';
    record('round-trip: template "flight" + all five flight fields survive encode/decode', ok,
      'got template=' + JSON.stringify(decoded.template) + ', flight=' + JSON.stringify(f));
  }catch(e){
    record('round-trip: template "flight" survives encode/decode', false, 'threw: ' + (e && e.stack ? e.stack : e));
  }
  try{
    // beats: cfgArr(6, ...), hazards: cfgArr(6, ...) -- CFG_FLIGHT_SCHEMA
    // caps the ceiling only (the 3-beat/2-hazard minimums are wizard/
    // generator UX, never codec-enforced -- see that schema's own comment).
    const encoded = cfgEncodeConfigFragment({
      flight: { beats: ['1', '2', '3', '4', '5', '6', '7', '8'], hazards: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] },
    });
    const decoded = JSON.parse(cfgDecompress(encoded));
    const f = decoded.flight || {};
    const ok = Array.isArray(f.beats) && f.beats.length === 6 && Array.isArray(f.hazards) && f.hazards.length === 6;
    record('round-trip: oversized flight.beats/hazards clamp to 6', ok, 'got beats.length=' + (f.beats && f.beats.length) + ', hazards.length=' + (f.hazards && f.hazards.length));
  }catch(e){
    record('round-trip: oversized flight.beats/hazards clamp', false, 'threw: ' + (e && e.stack ? e.stack : e));
  }
}

function main(){
  checkExamples();
  checkSceneMatrix();
  checkHardModePlaythrough();
  checkRoundTrip();
  checkRosterAssets();
  checkRosterDefaults();
  checkGalleryPlaythroughs();
  checkGalleryRoundTrip();
  checkFlightPlaythroughs();
  checkFlightRoundTrip();

  const failed = results.filter(r => !r.ok);
  console.log('');
  console.log(results.length + ' checks, ' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed.');
  process.exit(failed.length ? 1 : 0);
}

if(require.main === module) main();

module.exports = {
  checkExamples, checkSceneMatrix, checkHardModePlaythrough, checkRoundTrip, checkRosterAssets, checkRosterDefaults,
  checkGalleryPlaythroughs, checkGalleryRoundTrip, checkFlightPlaythroughs, checkFlightRoundTrip,
};
