'use strict';
/* ======================================================================
   tools/verify-flight.js -- THE FLIGHT's own verify driver (see
   SPEC-flight.md "Verification" and tools/verify-config.js's own header
   for the shared methodology: a Node `vm` harness, zero dependencies,
   never a live browser). Reuses tools/lib/sandbox.js's fake DOM/Canvas/
   AudioContext (the exact same sandbox game/engine.js's own harness
   uses) and tools/verify-config.js's toneGateSource (identical tone-gate
   rule, not a second copy) -- everything ELSE here is flight-specific:
   flight/engine.js's script chain (shared/framework.js in place of
   game/skeletons.js -- the flight has no scene skeleton) and a driver
   that flies through flight/engine.js's own exposed tick/flap/
   handleAction/__listActiveGates, the exact same functions the round-1
   throwaway boot-smoke drove by hand -- see this file's
   driveFlightPlaythrough for the promoted, checked-in version of that.

     node tools/verify-flight.js games/<slug>/config.js

   Zero dependencies.
   ====================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { buildSandbox } = require('./lib/sandbox');
const { toneGateSource } = require('./verify-config.js');

const REPO_ROOT = path.join(__dirname, '..');
const FLIGHT_ENGINE_PATH = path.join(REPO_ROOT, 'flight', 'engine.js');
const FRAMEWORK_PATH = path.join(REPO_ROOT, 'shared', 'framework.js');
const CFGCODEC_PATH = path.join(REPO_ROOT, 'game', 'cfgcodec.js');
const ROSTER_PATH = path.join(REPO_ROOT, 'game', 'roster.js');

const DT = 1 / 60; // matches the physics tuning proven out by round 1's own throwaway smoke -- flappy-style collision is timestep-sensitive, a coarser tick risks tunneling through a gate the real 60fps game never would

/* exposes flight/engine.js's own top-level functions/state to the harness
   -- `function` declarations attach to the vm context's global object
   (see tools/verify-config.js's PROBE for the identical `let`-vs-`function`
   note). __listActiveGates/__playfieldBounds read the engine's OWN gate
   objects/constants directly (activeGates, GROUND_Y, PLANE_R) rather than
   re-typing any position/size as a literal here -- the anti-pattern this
   file is explicitly asked not to repeat (see verify-gallery.js's row-Y
   duplication, called out in SPEC-flight.md's Verification section). */
const PROBE = `
function __probe(){
  return {
    phase: phase, stage: phaseData && phaseData.stage,
    legIndex: phaseData && phaseData.legIndex, toLegIndex: phaseData && phaseData.toLegIndex,
    isBossLeg: !!(phaseData && phaseData.isBossLeg),
    hearts: hearts, mode: currentMode, charge: shoutCharged(), stars: starsCollectedThisRun,
    shoutFired: shoutFiredAt >= 0, crashes: crashesThisRun, distancePct: distancePctNow(),
    activeCard: activeCard ? activeCard.key : null, legsCount: LEGS_COUNT,
    beatsShown: legReached.slice(),
    playerY: player.y, playerVy: player.vy,
    finalBossY: (phase==='finalboss' && phaseData.stage==='live') ? finalBossY(gameT-phaseData.sweepStartT) : null,
    landed: phaseData && phaseData.landed, stalled: phaseData && phaseData.stalled,
    assetsReady: assetsReady,
  };
}
function __listActiveGates(){
  return activeGates.slice().sort(function(a,b){ return a.x-b.x; }).map(function(g){
    return { x:g.x, gapCenterY:g.gapCenterY, gapHalf:g.gapHalf, label:g.label, hasStar:g.hasStar, starTaken:g.starTaken, passed:g.passed };
  });
}
function __playfieldBounds(){ return { groundY: GROUND_Y, planeR: PLANE_R }; }
function __configHazards(){ return FLIGHT_HAZARDS.slice(); }
function __tick(dt){ tick(dt); }
function __flap(){ flap(); }
function __handleAction(){ handleAction(); }
function __ensureAudio(){ ensureAudioStarted(); }
function __flags(){
  return { JUDGE_CAST: JUDGE_CAST, AUTHORITY_CAST: AUTHORITY_CAST, SAVIOR_CAST: SAVIOR_CAST, BUTTERFINGERS_CAST: BUTTERFINGERS_CAST, BUILDER_CAST: BUILDER_CAST };
}
function __setModeSelectIndex(i){ modeSelectIndex = i; }
function __oneTankUnlocked(){ return oneTankUnlocked(); }
function __oneTankBestPct(){ return oneTankBestPct(); }
`;

/* mirrors tools/verify-gallery.js's loadGalleryWithConfig exactly, just
   with flight/engine.js's own real script chain (config -> roster ->
   cfgcodec -> shared/framework -> flight/engine.js -- see flight/
   index.html) -- no game/skeletons.js, the flight has no scene skeleton. */
function loadFlightWithConfig(configSource, opts){
  opts = opts || {};
  const engineSrc = fs.readFileSync(FLIGHT_ENGINE_PATH, 'utf8');
  const frameworkSrc = fs.readFileSync(FRAMEWORK_PATH, 'utf8');
  const cfgcodecSrc = fs.readFileSync(CFGCODEC_PATH, 'utf8');
  const rosterSrc = fs.readFileSync(ROSTER_PATH, 'utf8');
  const combined = configSource + '\n' + rosterSrc + '\n' + cfgcodecSrc + '\n' + frameworkSrc + '\n' + engineSrc + '\n' + PROBE;
  const sandbox = buildSandbox({ network: 'fail', currentScriptSrc: 'https://example.test/flight/engine.js', locationHash: opts.locationHash });
  if(opts.beforeRun) opts.beforeRun(sandbox);
  const ctx = vm.createContext(sandbox);
  const script = new vm.Script(combined, { filename: 'verify-flight-generated.js' });
  script.runInContext(ctx);
  return sandbox;
}

/* ----------------------------------------------------------------------
   DRIVERS -- bang-bang autopilot, not a precomputed schedule (SPEC-
   flight.md): each tick, flap when the plane sits below the next gap's
   center with non-negative-ish fall speed. `trackers` (optional) is how
   the top-level playthrough accumulates state ACROSS phases without the
   engine itself carrying any test-only instrumentation:
     - trackers.labelsSeen: a Set, fed every tick from __listActiveGates()
       (the same real gate objects the game itself scrolls/draws) so
       "every hazard label seen" never re-types the sample's own label
       strings.
     - trackers.shoutCheck: records the moment THE SHOUT charges and the
       moment it fires, straight off __probe()'s own hearts/gate state --
       see driveLeg's own comment on the deliberate withhold.
   ---------------------------------------------------------------------- */
function driveLeg(sb, maxIter, trackers){
  let iter = 0;
  while(iter++ < (maxIter || 8000) && sb.__probe().phase === 'flying'){
    const st = sb.__probe();
    const gates = sb.__listActiveGates();
    if(trackers){
      for(const g of gates) trackers.labelsSeen.add(g.label);
      if(st.charge && trackers.shoutCheck && trackers.shoutCheck.chargedAt === null){
        trackers.shoutCheck.chargedAt = sb.__probe().crashes === 0 ? 'clean' : 'dirty';
        trackers.shoutCheck.heartsAtCharge = st.hearts;
      }
      if(st.shoutFired && trackers.shoutCheck && !trackers.shoutCheck.firedObserved){
        trackers.shoutCheck.firedObserved = true;
        trackers.shoutCheck.heartsAtFire = st.hearts;
        trackers.shoutCheck.gatesAtFireAllPassed = gates.every(g => g.passed || g.x >= 960); // off-screen-at-fire-time gates are legitimately untouched, see flight/engine.js's SCREEN_CLEAR_MARGIN
      }
    }
    if(st.activeCard){ sb.__handleAction(); sb.__tick(DT); continue; }
    const target = gates.find(g => !g.passed);
    if(st.charge && !st.shoutFired){
      // deliberately WITHHOLD the normal gap-avoidance once charged --
      // steer just inside the target gate's rock instead of its gap, a
      // genuine collision course, and let THE SHOUT's own deterministic
      // imminent-impact prediction (flight/engine.js's
      // predictedImminentGateCollision) auto-fire before actual contact.
      // No target yet (still between gates) -> just hold safe altitude,
      // same as normal piloting, until one comes into range.
      if(target){
        const bounds = sb.__playfieldBounds();
        const dangerY = Math.min(bounds.groundY - bounds.planeR - 4, target.gapCenterY + target.gapHalf + 30);
        if(st.playerY > dangerY && st.playerVy >= -30) sb.__flap();
      } else if(st.playerVy >= 0) sb.__flap();
      sb.__tick(DT);
      continue;
    }
    if(target){
      if(st.playerY > target.gapCenterY && st.playerVy >= -30) sb.__flap();
    } else if(st.playerVy >= 0) sb.__flap();
    sb.__tick(DT);
  }
}
/* THE FINAL BOSS -- pure reactive flee (steer away only once actually
   close), not a computed mirror target: two same-amplitude sinusoids
   180-degrees out of phase cross exactly at every zero-crossing, which
   round 1's own investigation found makes "mirror the boss" collide on
   schedule rather than dodge it. Proven survivable at the shipped tuning
   by that same investigation. */
function driveFinalBoss(sb, maxIter){
  let iter = 0;
  while(iter++ < (maxIter || 4000) && sb.__probe().phase === 'finalboss'){
    const st = sb.__probe();
    if(st.activeCard){ sb.__handleAction(); sb.__tick(DT); continue; }
    if(st.stage === 'live' && st.finalBossY != null){
      const d = st.playerY - st.finalBossY;
      if(Math.abs(d) < 90){ if(d < 0) sb.__flap(); }
      else if(st.playerVy >= 60) sb.__flap();
    } else if(st.playerVy >= 0) sb.__flap();
    sb.__tick(DT);
  }
}
/* breather / landing / celebration -- nothing to steer (auto-cruise),
   just dismiss any card and let time pass. */
function driveThrough(sb, phaseName, maxIter){
  let iter = 0;
  while(iter++ < (maxIter || 3000) && sb.__probe().phase === phaseName){
    const st = sb.__probe();
    if(st.activeCard) sb.__handleAction();
    sb.__tick(DT);
  }
}

/* full attentive playthrough: title -> (modeselect, if already unlocked)
   -> getready -> flying/breather x LEGS_COUNT -> finalboss (real or
   clear-sky landing) -> landing -> celebration -> endcard. Degradation-
   agnostic by construction (same principle as tools/verify-gallery.js's
   driveGalleryPlaythrough) -- it just follows whatever `phase` the
   config's own cast produces at each junction. `trackers` threads through
   to driveLeg for the labelsSeen/shoutCheck accumulation described above. */
function driveFlightPlaythrough(sb, trackers){
  sb.__ensureAudio();
  sb.__handleAction(); // title -> getready, or modeselect if ONE TANK is already unlocked
  let st = sb.__probe();
  if(st.phase === 'modeselect'){ sb.__setModeSelectIndex(0); sb.__handleAction(); st = sb.__probe(); } // THE FULL TRIP
  if(st.phase === 'getready') sb.__handleAction(); // -> flying leg 0 (also applies the first flap)
  let guard = 0;
  while(sb.__probe().phase !== 'endcard' && guard++ < 40){
    const phase = sb.__probe().phase;
    if(phase === 'flying') driveLeg(sb, undefined, trackers);
    else if(phase === 'breather') driveThrough(sb, 'breather');
    else if(phase === 'finalboss') driveFinalBoss(sb);
    else if(phase === 'landing') driveThrough(sb, 'landing');
    else if(phase === 'celebration') driveThrough(sb, 'celebration');
    else break; // unknown phase -- stop rather than spin forever
  }
  return sb.__probe().phase;
}

/* ONE TANK: reuses a sandbox that has ALREADY landed once in THE FULL
   TRIP (localStorage's oneTankUnlocked flag persists on the same
   sandbox instance -- see game/roster.js-style module state, this is
   just localStorage) -- resets to title, confirms the mode-select screen
   is now reachable, selects ONE TANK, then deliberately never flaps so
   the very first tick ends the run at the ground -- proving the single-
   life/no-retry/distance-% path independent of gate-dodging skill. */
function driveOneTankStall(sb){
  sb.__handleAction(); // endcard -> resetGame() -> title
  sb.__handleAction(); // title -> modeselect (must be unlocked by now)
  const afterTitle = sb.__probe();
  if(afterTitle.phase !== 'modeselect') return { ok: false, reason: 'expected modeselect after title action, got "' + afterTitle.phase + '"' };
  sb.__setModeSelectIndex(1); // ONE TANK
  sb.__handleAction(); // confirm -> getready
  const afterConfirm = sb.__probe();
  if(afterConfirm.mode !== 'onetank') return { ok: false, reason: 'expected mode "onetank" after confirming, got "' + afterConfirm.mode + '"' };
  sb.__handleAction(); // getready -> flying leg 0 (first flap)
  let iter = 0;
  while(iter++ < 3600 && sb.__probe().phase !== 'endcard'){
    if(sb.__probe().activeCard) sb.__handleAction();
    sb.__tick(DT); // never flap -- gravity ends the run almost immediately
  }
  const final = sb.__probe();
  return { ok: final.phase === 'endcard' && final.stalled === true, phase: final.phase, stalled: final.stalled, distancePct: final.distancePct };
}

/* `configSource` is the FULL text of a config.js file (a `const CONFIG =
   {...}` statement, matching games/<slug>/config.js's own shape when
   template is 'flight'). Returns { ok, errors, warnings, phaseReached,
   flags } -- same shape as tools/verify-gallery.js's verifyGallerySource,
   never throws for a content/gameplay failure (a SyntaxError propagates,
   same "fundamentally different, always-fatal" split). */
function verifyFlightSource(configSource, opts){
  opts = opts || {};
  const errors = [];
  const warnings = [];

  const toneViolations = toneGateSource(configSource, opts.extraForbidden);
  for(const v of toneViolations) errors.push('tone gate: ' + v);

  let sb, flags = null, phaseReached = null;
  const trackers = { labelsSeen: new Set(), shoutCheck: { chargedAt: null, heartsAtCharge: null, firedObserved: false, heartsAtFire: null, gatesAtFireAllPassed: null } };
  try{
    sb = loadFlightWithConfig(configSource);
    flags = sb.__flags();
    phaseReached = driveFlightPlaythrough(sb, trackers);
    if(phaseReached !== 'endcard'){
      errors.push('attentive playthrough did not reach the end card (stopped at "' + phaseReached + '")');
    } else {
      const end = sb.__probe();
      if(end.landed !== true) errors.push('attentive playthrough reached the end card but did not land (landed=' + end.landed + ')');
      if(end.beatsShown.some(shown => !shown)) errors.push('not every leg was reached -- beatsShown=' + JSON.stringify(end.beatsShown));

      // every hazard label seen on a gate plaque at some point -- checked
      // against the RUNNING config's own flight.hazards (read straight off
      // the sandbox, never re-typed from the sample file), so this works
      // unmodified for any config, not just the checked-in sample.
      const configHazards = sb.__configHazards();
      const missingHazards = configHazards.filter(h => !trackers.labelsSeen.has(h));
      if(missingHazards.length) errors.push('hazard label(s) never seen on a gate plaque: ' + JSON.stringify(missingHazards));

      // THE SHOUT -- charged (3 stars) then deliberately driven into an
      // imminent collision (see driveLeg's withhold branch); asserts it
      // auto-fired, cost no heart, and cleared the on-screen gates.
      const sc = trackers.shoutCheck;
      if(!sc.firedObserved){
        errors.push('THE SHOUT never fired during the attentive playthrough (stars collected but the imminent-collision prediction never triggered, or fewer than 3 stars were ever collected)');
      } else {
        if(sc.heartsAtFire !== sc.heartsAtCharge) errors.push('THE SHOUT cost a heart between charging and firing (hearts at charge=' + sc.heartsAtCharge + ', at fire=' + sc.heartsAtFire + ')');
        if(!sc.gatesAtFireAllPassed) errors.push('THE SHOUT fired but did not clear the on-screen gates at that moment');
      }

      // THE FIRST BOSS's leg and THE FINAL BOSS's approach gate are both
      // just phases driveFlightPlaythrough loops through like any other --
      // reaching "endcard" + landed=true already proves both were survived
      // when JUDGE_CAST/AUTHORITY_CAST are true (a crash there costs a
      // heart/retries, same as any leg, but never blocks forward progress
      // in THE FULL TRIP -- see flight/engine.js's enterStallRetry).
    }
  }catch(e){
    if(e instanceof SyntaxError) throw e;
    errors.push('playthrough threw: ' + (e && e.stack ? e.stack : e));
  }

  // ONE TANK -- only meaningful once the attentive run above has actually
  // landed (the unlock flag is set on landing, see flight/engine.js's
  // markOneTankUnlocked); reuses the SAME sandbox so localStorage carries
  // the unlock across the reset, exactly like a real returning player.
  if(sb && errors.length === 0){
    try{
      if(!sb.__oneTankUnlocked()) errors.push('ONE TANK was not unlocked after landing in THE FULL TRIP');
      else{
        const stall = driveOneTankStall(sb);
        if(!stall.ok) errors.push('ONE TANK stall run did not end at a stalled end card: ' + JSON.stringify(stall));
        else{
          const best = sb.__oneTankBestPct();
          if(typeof best !== 'number' || best < 0) errors.push('ONE TANK best-% was not persisted after the stall run (got ' + JSON.stringify(best) + ')');
        }
      }
    }catch(e){
      errors.push('ONE TANK run threw: ' + (e && e.stack ? e.stack : e));
    }
  }

  if(flags){
    const castCount = ['JUDGE_CAST', 'AUTHORITY_CAST', 'SAVIOR_CAST', 'BUTTERFINGERS_CAST', 'BUILDER_CAST'].filter(k => flags[k]).length;
    if(castCount === 0) warnings.push('no optional roles cast -- THE FIRST/FINAL BOSS both degrade (ordinary leg / clear-sky landing), no savior save, no butterfingers gag');
  }

  return { ok: errors.length === 0, errors: errors, warnings: warnings, phaseReached: phaseReached, flags: flags };
}

function verifyFlightFile(filePath, opts){
  const src = fs.readFileSync(filePath, 'utf8');
  return verifyFlightSource(src, opts);
}

/* host-only degradation: every optional role uncast -> THE FIRST BOSS's
   leg plays as an ordinary leg, THE FINAL BOSS is skipped entirely
   (clear-sky landing straight off the final-approach breather), no
   savior save, no butterfingers gag. Simpler assertion than the full
   attentive run above -- just needs to reach the end card, landed, every
   leg reached; no shout/hazard-label bookkeeping (a bare-bones config may
   not even guarantee 3 stars fall in reach of a single clean pass, and
   that's not what this run is testing). */
function verifyFlightHostOnlySource(configSource, opts){
  opts = opts || {};
  const errors = [];
  let sb, phaseReached = null;
  try{
    sb = loadFlightWithConfig(configSource);
    phaseReached = driveFlightPlaythrough(sb);
    if(phaseReached !== 'endcard') errors.push('host-only playthrough did not reach the end card (stopped at "' + phaseReached + '")');
    else{
      const end = sb.__probe();
      if(end.landed !== true) errors.push('host-only playthrough reached the end card but did not land');
      if(end.beatsShown.some(shown => !shown)) errors.push('not every leg was reached -- beatsShown=' + JSON.stringify(end.beatsShown));
    }
  }catch(e){
    if(e instanceof SyntaxError) throw e;
    errors.push('host-only playthrough threw: ' + (e && e.stack ? e.stack : e));
  }
  return { ok: errors.length === 0, errors: errors, warnings: [], phaseReached: phaseReached, flags: sb ? sb.__flags() : null };
}

module.exports = {
  verifyFlightSource, verifyFlightFile, verifyFlightHostOnlySource,
  loadFlightWithConfig, driveFlightPlaythrough, driveLeg, driveFinalBoss, driveThrough, driveOneTankStall,
};

if(require.main === module){
  const target = process.argv[2];
  if(!target){
    console.error('Usage: node tools/verify-flight.js <path-to-config.js>');
    process.exit(2);
  }
  let result;
  try{
    result = verifyFlightFile(path.resolve(target));
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
