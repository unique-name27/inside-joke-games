'use strict';
/* ======================================================================
   tools/verify-mission.js -- THE MISSION's own verify driver (see
   SPEC-mission.md "Verification" and tools/verify-config.js's own header
   for the shared methodology: a Node `vm` harness, zero dependencies,
   never a live browser). Reuses tools/lib/sandbox.js's fake DOM/Canvas/
   AudioContext (the exact same sandbox mission/engine.js's own harness
   uses) and tools/verify-config.js's toneGateSource (identical tone-gate
   rule, not a second copy) -- everything ELSE here is mission-specific:
   mission/engine.js's script chain (shared/framework.js in place of
   game/skeletons.js -- the mission has no scene skeleton, same as
   gallery/flight/defense) and a driver that plays through mission/
   engine.js's own exposed tick/handleAction/fireBeam, the exact same
   functions round 1's own throwaway smoke scripts drove by hand.

     node tools/verify-mission.js games/<slug>/config.js

   Driver policy (SPEC-mission.md): a dodge-autopilot that steers toward
   the WIDEST SAFE X-CORRIDOR computed from the engine's own live entity
   list (enemies/meteors/enemy bullets/boss position -- never a duplicated
   literal), auto-fire implicit (mission/engine.js's own design -- "Auto-
   fire is always on"). THE BEAM is fired deliberately, not left to
   chance: as soon as it's ready during any stage EXCEPT THE LAST ONE, fire
   immediately (proves the normal-stage wipe); on the LAST stage, the
   charge is deliberately WITHHELD so it carries into the ambush/flagship
   unspent (mission/engine.js's own fireBeam split only resets crateCount/
   beamUsedThisEncounter at each new STAGE -- see that file's own comment
   on enterAmbush/enterFlagship -- a boss phase never spawns its own
   crates, so this carry-over is the ONLY way to ever charge THE BEAM
   during a boss phase at all); fired the moment it's ready during the
   flagship (proves the boss-phase damage-chunk + beamed retort).

   Round-2 fix folded into mission/engine.js alongside this file (not a
   pre-existing round-1 bug left for round 3): enterAmbush/enterEliteVolley/
   enterFlagship/enterFinaleVolley used to unconditionally reset
   crateCount/beamUsedThisEncounter to 0/false on entry, same as enterStage
   -- but none of those four phases ever populate `crates` themselves, so
   THE BEAM could never reach 3/3 during a boss phase, making the
   "fire during the flagship" assertion below literally impossible before
   the fix. Only enterStage (a real charge-cycle boundary, "once per
   stage" per spec) still resets on entry now.

   Zero dependencies.
   ====================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { buildSandbox } = require('./lib/sandbox');
const { toneGateSource } = require('./verify-config.js');

const REPO_ROOT = path.join(__dirname, '..');
const MISSION_ENGINE_PATH = path.join(REPO_ROOT, 'mission', 'engine.js');
const FRAMEWORK_PATH = path.join(REPO_ROOT, 'shared', 'framework.js');
const CFGCODEC_PATH = path.join(REPO_ROOT, 'game', 'cfgcodec.js');
const ROSTER_PATH = path.join(REPO_ROOT, 'game', 'roster.js');

const DT = 1 / 60; // matches every other engine's own harness tick

/* exposes mission/engine.js's own top-level functions/state to the
   harness -- `function` declarations attach to the vm context's global
   object (see tools/verify-config.js's PROBE for the identical
   `let`-vs-`function` note). Every field here reads the engine's OWN live
   state/helpers directly (phase/phaseData/player/pips/activeEnemies/
   activeMeteors/enemyBullets/crates/MISSION_SWARMS/STAGE_COUNT/
   AMBUSH_AFTER_INDEX/firstBossHeckleLine/finalBossQuirkLine/CONFIG.
   punchline) rather than re-typing any position/label/line as a literal
   here -- same "no duplicated literals" discipline every prior template's
   own PROBE documents. __debugForcePipLoss is the one test-only hook with
   no real-player equivalent, needed because handleHit()'s own
   invulnerability window (INVULN_TIME) would otherwise swallow all but
   the first of several back-to-back synchronous calls -- it replicates
   exactly the "real pip loss" branch of handleHit() (decrement, track
   totalPipsLostEver, trigger the retry card at 0) without the savior-
   absorb/invulnerability guards a real forced-stall test wants to bypass
   deterministically, the same "proven safe/correct" spirit defense/
   engine.js's own __debugForceLeaks precedent set. __steer is this
   driver's own movement input -- sets the framework's shared `keys` object
   directly (getMoveVector() reads it), same mechanism a real WASD press
   would use. */
const PROBE = `
function __probe(){
  return {
    phase: phase,
    stageIndex: (phaseData && phaseData.stageIndex),
    attempt: (phaseData && phaseData.attempt),
    phaseIndex: (phaseData && phaseData.phaseIndex),
    duration: (phaseData && phaseData.duration),
    awaitingRetry: !!(phaseData && phaseData.awaitingRetry),
    pips: pips,
    totalPipsLostEver: totalPipsLostEver,
    crateCount: crateCount,
    beamUsedThisEncounter: beamUsedThisEncounter,
    beamReady: beamReady(),
    beamsFiredThisRun: beamsFiredThisRun,
    activeCard: activeCard ? activeCard.key : null,
    gameT: gameT,
    playerX: player.x, playerY: player.y,
    bannerText: bannerText,
    marqueeText: (marquee && gameT < marquee.until) ? marquee.text : null,
    bubbleText: (bubble && gameT < bubble.until) ? bubble.text : null,
    rank: (phaseData && phaseData.rank) || null,
  };
}
function __flags(){
  return { JUDGE_CAST: JUDGE_CAST, AUTHORITY_CAST: AUTHORITY_CAST, SAVIOR_CAST: SAVIOR_CAST, BUTTERFINGERS_CAST: BUTTERFINGERS_CAST, BUILDER_CAST: BUILDER_CAST };
}
function __tick(dt){ tick(dt); }
function __handleAction(){ handleAction(); }
function __ensureAudio(){ ensureAudioStarted(); }
function __steer(dx, dy){
  keys['KeyD'] = dx > 0.15; keys['KeyA'] = dx < -0.15;
  keys['KeyS'] = dy > 0.15; keys['KeyW'] = dy < -0.15;
}
function __listEnemies(){
  return activeEnemies.map(function(e){
    return { id:e.id, x:e.x, y:e.y, hp:e.hp, maxHp:e.maxHp, big:!!e.big, isUfo:!!e.isUfo, dead:!!e.dead, label:e.label, stageIndex:e.stageIndex };
  });
}
function __listMeteors(){
  return activeMeteors.map(function(m){ return { x:m.x, y:m.y, size:m.size, dead:!!m.dead }; });
}
function __listEnemyBullets(){
  return enemyBullets.map(function(b){ return { x:b.x, y:b.y }; });
}
function __listCrates(){
  return crates.map(function(c){ return { x:c.x, y:c.y, dead:!!c.dead }; });
}
function __bossState(){
  if((phase === 'ambush' || phase === 'flagship') && phaseData.boss){
    var b = phaseData.boss;
    return { hp: b.hp, maxHp: b.maxHp, x: (b.x!==undefined?b.x:b.cx), y: (b.y!==undefined?b.y:b.cy), active: b.active!==false };
  }
  return null;
}
function __stageCount(){ return STAGE_COUNT; }
function __ambushAfterIndex(){ return AMBUSH_AFTER_INDEX; }
function __missionSwarms(){ return MISSION_SWARMS.slice(); }
function __missionLine(){ return MISSION_LINE; }
function __punchline(){ return CONFIG.punchline; }
function __stageDownedTotal(i){ return stageDownedCount[i]; }
function __firstBossHeckleLine(){ return firstBossHeckleLine; }
function __finalBossQuirkLine(){ return finalBossQuirkLine; }
function __playerAccuracy(){ return { fired: playerShotsFired, hit: playerShotsHit }; }
function __debugForcePipLoss(n){
  for(var i=0;i<n;i++){
    pips--; totalPipsLostEver++;
    if(pips <= 0){ enterStallRetry(); break; }
  }
}
`;

/* mirrors tools/verify-defense.js's loadDefenseWithConfig exactly, just
   with mission/engine.js's own real script chain (config -> roster ->
   cfgcodec -> shared/framework -> mission/engine.js -- see mission/
   index.html) -- no game/skeletons.js, the mission has no scene skeleton. */
function loadMissionWithConfig(configSource, opts){
  opts = opts || {};
  const engineSrc = fs.readFileSync(MISSION_ENGINE_PATH, 'utf8');
  const frameworkSrc = fs.readFileSync(FRAMEWORK_PATH, 'utf8');
  const cfgcodecSrc = fs.readFileSync(CFGCODEC_PATH, 'utf8');
  const rosterSrc = fs.readFileSync(ROSTER_PATH, 'utf8');
  const combined = configSource + '\n' + rosterSrc + '\n' + cfgcodecSrc + '\n' + frameworkSrc + '\n' + engineSrc + '\n' + PROBE;
  const sandbox = buildSandbox({ network: 'fail', currentScriptSrc: 'https://example.test/mission/engine.js', locationHash: opts.locationHash });
  if(opts.beforeRun) opts.beforeRun(sandbox);
  const ctx = vm.createContext(sandbox);
  const script = new vm.Script(combined, { filename: 'verify-mission-generated.js' });
  script.runInContext(ctx);
  return sandbox;
}

/* ----------------------------------------------------------------------
   DODGE AUTOPILOT -- steers toward the widest safe x-corridor computed
   from the engine's OWN live entity list (never a duplicated literal
   position/gap). Looks at every hazard (enemy/meteor/enemy bullet) inside
   a lookahead band ABOVE the player (things falling toward it), sorts
   their x positions, and returns the midpoint of the widest gap between
   consecutive hazards (and the play-area edges). No hazards in the band ->
   null (no steering needed, drift stays put). PLAY_X_MIN/MAX below mirror
   mission/engine.js's own constants (40/CW-40, CW=960) -- structural
   layout, not gameplay content, so mirroring them here (rather than
   reading them off the sandbox) matches the same convention tools/verify-
   flight.js's PLANE_X mirroring already established for genuinely fixed
   layout numbers.
   ---------------------------------------------------------------------- */
const PLAY_X_MIN = 40, PLAY_X_MAX = 920;
const LOOKAHEAD_ABOVE = 260, LOOKAHEAD_BELOW = 40;
function widestSafeX(sb, playerY){
  const xs = [];
  for(const e of sb.__listEnemies()){ if(!e.dead && e.y > playerY - LOOKAHEAD_ABOVE && e.y < playerY + LOOKAHEAD_BELOW) xs.push(e.x); }
  for(const m of sb.__listMeteors()){ if(!m.dead && m.y > playerY - LOOKAHEAD_ABOVE && m.y < playerY + LOOKAHEAD_BELOW) xs.push(m.x); }
  for(const b of sb.__listEnemyBullets()){ if(b.y > playerY - LOOKAHEAD_ABOVE && b.y < playerY + LOOKAHEAD_BELOW) xs.push(b.x); }
  const boss = sb.__bossState();
  if(boss && boss.active && boss.y > playerY - LOOKAHEAD_ABOVE - 40 && boss.y < playerY + LOOKAHEAD_BELOW + 40) xs.push(boss.x);
  if(!xs.length) return null;
  xs.sort((a, b) => a - b);
  const points = [PLAY_X_MIN, ...xs, PLAY_X_MAX];
  let bestMid = (PLAY_X_MIN + PLAY_X_MAX) / 2, bestGap = -1;
  for(let i = 0; i < points.length - 1; i++){
    const gap = points[i + 1] - points[i];
    if(gap > bestGap){ bestGap = gap; bestMid = (points[i] + points[i + 1]) / 2; }
  }
  return bestMid;
}
function steerToward(sb, targetX, curX){
  if(targetX === null){ sb.__steer(0, 0); return; }
  const dx = targetX - curX;
  sb.__steer(Math.abs(dx) < 6 ? 0 : (dx > 0 ? 1 : -1), 0);
}

/* ----------------------------------------------------------------------
   DRIVERS -- one per flying phase, all sharing the same dodge-autopilot
   tick shape. `trackers` (optional) accumulates the mechanic proofs
   verifyMissionSource/verifyMissionHostOnlySource assert on afterward.

   trackSignals runs UNCONDITIONALLY, every tick, BEFORE any beam-fire
   decision -- not folded into driveFlyingTick's own body, because a
   charge carried over from the preceding stage (this file's own central
   mechanic-carry-over fix) can already be ready the INSTANT a boss phase
   is entered, and firing immediately overwrites the ambush's/flagship's
   own entry marquee (the heckle/quirk line) with the beam's retort line
   in that same tick -- so a driver that only checked marqueeText on the
   "didn't fire" branch could catch the retort and never the heckle/quirk
   it replaced. Reading it FIRST, before deciding whether to fire, closes
   that race.
   ---------------------------------------------------------------------- */
function trackSignals(sb, st, trackers){
  if(!trackers) return;
  for(const e of sb.__listEnemies()) if(e.big && !e.dead) trackers.bigEnemyPlaqueSeen = true;
  if(st.marqueeText){
    if(st.marqueeText === trackers.firstBossHeckleLine) trackers.ambushHeckleSeen = true;
    if(st.marqueeText === trackers.finalBossQuirkLine) trackers.flagshipQuirkSeen = true;
    if(trackers.retortLinesSoFar.indexOf(st.marqueeText) === -1 && st.marqueeText !== trackers.firstBossHeckleLine && st.marqueeText !== trackers.finalBossQuirkLine){
      trackers.retortLinesSoFar.push(st.marqueeText);
    }
  }
  if(st.bubbleText && st.bubbleText.indexOf('HAD YOU') !== -1) trackers.saviorAbsorbSeen = true;
}
function driveFlyingTick(sb, trackers, stKnown){
  const st = stKnown || sb.__probe();
  trackSignals(sb, st, trackers);
  const target = widestSafeX(sb, st.playerY);
  steerToward(sb, target, st.playerX);
  sb.__tick(DT);
}

/* STAGE -- dodge-autopilot; fires THE BEAM the instant it's charged,
   EXCEPT on the last stage (index STAGE_COUNT-1), where the charge is
   deliberately withheld so it carries into the ambush/flagship unspent
   (see this file's own header -- a boss phase never spawns its own
   crates, so this is the only way a boss-phase beam fire is ever
   reachable at all). Records the normal-stage wipe proof the first time
   it fires. */
function driveMissionStage(sb, trackers, maxIter){
  let iter = 0;
  const stageCount = sb.__stageCount();
  while(iter++ < (maxIter || 6000) && sb.__probe().phase === 'stage'){
    const st = sb.__probe();
    if(st.activeCard){ sb.__handleAction(); sb.__tick(DT); continue; }
    trackSignals(sb, st, trackers);
    if(trackers) trackers.stagesEntered.add(st.stageIndex);
    const isLastStage = st.stageIndex === stageCount - 1;
    if(st.beamReady && !isLastStage && trackers && !trackers.stageWipeProof.done){
      const before = sb.__listEnemies().filter(e => !e.dead);
      sb.__handleAction(); // fires THE BEAM (handleAction -> beamReady() short-circuits to fireBeam())
      const after = sb.__probe();
      const stillAlive = sb.__listEnemies().filter(e => !e.dead);
      trackers.stageWipeProof.done = true;
      trackers.stageWipeProof.ok = (before.length === 0 || stillAlive.length === 0) && after.beamsFiredThisRun > st.beamsFiredThisRun && after.bannerText === trackers.punchline;
      trackers.stageWipeProof.detail = 'before=' + before.length + ' after=' + stillAlive.length + ' beamsFired ' + st.beamsFiredThisRun + '->' + after.beamsFiredThisRun + ' banner=' + JSON.stringify(after.bannerText);
      sb.__tick(DT);
      continue;
    }
    driveFlyingTick(sb, trackers, st);
  }
}

/* AMBUSH -- dodge-autopilot; fires THE BEAM the instant it's ready (the
   charge carried in from the preceding stage, per this file's own
   header), proving the boss-phase damage-chunk + beamed retort.
   trackSignals runs BEFORE the fire check every tick (see that function's
   own header) so a beam fired on the very first ambush tick still gets
   credit for the heckle marquee it displaced. */
function driveMissionAmbush(sb, trackers, maxIter){
  let iter = 0;
  while(iter++ < (maxIter || 4000) && sb.__probe().phase === 'ambush'){
    const st = sb.__probe();
    if(st.activeCard){ sb.__handleAction(); sb.__tick(DT); continue; }
    trackSignals(sb, st, trackers);
    if(st.beamReady && trackers && !trackers.bossPhaseBeamProof.done){
      const bossBefore = sb.__bossState();
      sb.__handleAction();
      const bossAfter = sb.__bossState();
      const after = sb.__probe();
      trackers.bossPhaseBeamProof.done = true;
      trackers.bossPhaseBeamProof.ok = !!(bossBefore && bossAfter && bossAfter.hp < bossBefore.hp && after.beamsFiredThisRun > st.beamsFiredThisRun && after.marqueeText);
      trackers.bossPhaseBeamProof.detail = 'bossHp ' + (bossBefore && bossBefore.hp) + '->' + (bossAfter && bossAfter.hp) + ' marquee=' + JSON.stringify(after.marqueeText);
      trackers.bossPhaseBeamProof.where = 'ambush';
      sb.__tick(DT);
      continue;
    }
    const target = widestSafeX(sb, st.playerY);
    steerToward(sb, target, st.playerX);
    sb.__tick(DT);
  }
}
function driveMissionEliteVolley(sb, trackers, maxIter){
  let iter = 0;
  while(iter++ < (maxIter || 4000) && sb.__probe().phase === 'eliteVolley'){
    const st = sb.__probe();
    if(st.activeCard){ sb.__handleAction(); sb.__tick(DT); continue; }
    driveFlyingTick(sb, trackers, st);
  }
}
function driveMissionLull(sb, trackers, maxIter){
  let iter = 0;
  while(iter++ < (maxIter || 1000) && sb.__probe().phase === 'lull'){
    sb.__tick(DT);
  }
}

/* FLAGSHIP -- dodge-autopilot; fires THE BEAM the instant it's ready (see
   AMBUSH's own comment -- same carry-over mechanic), proving the second
   boss-phase damage-chunk + beamed retort site. Tracks every phaseIndex
   observed (0/1/2) so the caller can confirm the multi-phase mechanic
   actually cycles when the fight runs long enough to. */
function driveMissionFlagship(sb, trackers, maxIter){
  let iter = 0;
  while(iter++ < (maxIter || 8000) && sb.__probe().phase === 'flagship'){
    const st = sb.__probe();
    if(st.activeCard){ sb.__handleAction(); sb.__tick(DT); continue; }
    trackSignals(sb, st, trackers);
    if(trackers && st.phaseIndex !== undefined && st.phaseIndex !== null) trackers.flagshipPhasesSeen.add(st.phaseIndex);
    if(st.beamReady && trackers && !trackers.bossPhaseBeamProof.done){
      const bossBefore = sb.__bossState();
      sb.__handleAction();
      const bossAfter = sb.__bossState();
      const after = sb.__probe();
      trackers.bossPhaseBeamProof.done = true;
      trackers.bossPhaseBeamProof.ok = !!(bossBefore && bossAfter && bossAfter.hp < bossBefore.hp && after.beamsFiredThisRun > st.beamsFiredThisRun && after.marqueeText);
      trackers.bossPhaseBeamProof.detail = 'bossHp ' + (bossBefore && bossBefore.hp) + '->' + (bossAfter && bossAfter.hp) + ' marquee=' + JSON.stringify(after.marqueeText);
      trackers.bossPhaseBeamProof.where = 'flagship';
      sb.__tick(DT);
      continue;
    }
    const target = widestSafeX(sb, st.playerY);
    steerToward(sb, target, st.playerX);
    sb.__tick(DT);
  }
}
function driveMissionFinaleVolley(sb, trackers, maxIter){
  let iter = 0;
  while(iter++ < (maxIter || 4000) && sb.__probe().phase === 'finaleVolley'){
    const st = sb.__probe();
    if(st.activeCard){ sb.__handleAction(); sb.__tick(DT); continue; }
    driveFlyingTick(sb, trackers, st);
  }
}
function driveMissionTurnGood(sb, trackers, maxIter){
  let iter = 0;
  while(iter++ < (maxIter || 1000) && sb.__probe().phase === 'turngood'){
    if(trackers) trackers.turnGoodSeen = true;
    sb.__tick(DT);
  }
}
function driveThrough(sb, phaseName, maxIter){
  let iter = 0;
  while(iter++ < (maxIter || 2000) && sb.__probe().phase === phaseName){
    if(sb.__probe().activeCard) sb.__handleAction();
    sb.__tick(DT);
  }
}

/* full attentive (dodge-autopilot) playthrough: title -> stage x
   STAGE_COUNT (with the ambush/eliteVolley interstitial where SPEC-
   mission.md's AMBUSH_AFTER_INDEX places it) -> lull ->
   (flagship -> turngood, if AUTHORITY_CAST and the boss was beaten, or
   finaleVolley otherwise) -> celebration -> endcard. Degradation-agnostic
   by construction (same principle as every prior template's own top-level
   driver) -- it just follows whatever `phase` the config's own cast
   produces at each junction. */
function driveMissionPlaythrough(sb, trackers){
  sb.__ensureAudio();
  sb.__handleAction(); // title -> stage 0
  let guard = 0;
  while(sb.__probe().phase !== 'endcard' && guard++ < 400){
    const phase = sb.__probe().phase;
    if(phase === 'stage') driveMissionStage(sb, trackers);
    else if(phase === 'ambush') driveMissionAmbush(sb, trackers);
    else if(phase === 'eliteVolley') driveMissionEliteVolley(sb, trackers);
    else if(phase === 'lull') driveMissionLull(sb, trackers);
    else if(phase === 'flagship') driveMissionFlagship(sb, trackers);
    else if(phase === 'finaleVolley') driveMissionFinaleVolley(sb, trackers);
    else if(phase === 'turngood') driveMissionTurnGood(sb, trackers);
    else if(phase === 'celebration') driveThrough(sb, 'celebration');
    else break; // unknown phase -- stop rather than spin forever
  }
  return sb.__probe().phase;
}

/* DIFFICULTY TUNING (round 2, see mission/engine.js's own BUDGET_DPS/
   enemyHpScale comments) -- a NAIVE policy: dodge-autopilot steering
   still runs (mission/engine.js's own auto-fire is unconditional -- there
   is no "do nothing at all" baseline that isn't just "stand still and
   probably get hit constantly", which would test something closer to
   "can THE SAVIOR alone carry a run" than squadron DPS tuning), but THE
   BEAM is NEVER fired deliberately -- coordinator's round-2 requirement
   (a): a full-cast naive run should lose roughly 1-2 pips total by the
   end but complete without a forced stall more often than not.
   Deterministic seed (same configSource, same gameId) -- this can never
   flake, only regress if the tuning itself changes. */
function driveMissionNaive(sb, maxIter){
  sb.__ensureAudio();
  sb.__handleAction(); // title -> stage 0
  let iter = 0;
  while(iter++ < (maxIter || 60000)){
    const st = sb.__probe();
    if(st.phase === 'endcard') return { ok: true, phaseReached: 'endcard', pipsLost: st.totalPipsLostEver, iters: iter };
    if(st.activeCard){ sb.__handleAction(); sb.__tick(DT); continue; } // retry card -- still a naive policy, just dismiss and keep going
    const target = widestSafeX(sb, st.playerY);
    steerToward(sb, target, st.playerX);
    sb.__tick(DT);
  }
  const end = sb.__probe();
  return { ok: false, phaseReached: end.phase, pipsLost: end.totalPipsLostEver, iters: maxIter };
}

/* `configSource` is the FULL text of a config.js file (a `const CONFIG =
   {...}` statement, matching games/<slug>/config.js's own shape when
   template is 'mission'). Returns { ok, errors, warnings, phaseReached,
   flags } -- same shape as every prior template's own verify*Source,
   never throws for a content/gameplay failure (a SyntaxError propagates,
   same "fundamentally different, always-fatal" split). Every cast-
   dependent assertion below is gated behind that role's own *_CAST flag,
   read straight off the running sandbox -- degradation-agnostic by
   construction, safe to run against ANY config a real order produces. */
function verifyMissionSource(configSource, opts){
  opts = opts || {};
  const errors = [];
  const warnings = [];

  const toneViolations = toneGateSource(configSource, opts.extraForbidden);
  for(const v of toneViolations) errors.push('tone gate: ' + v);

  let sb, flags = null, phaseReached = null;
  const trackers = {
    stagesEntered: new Set(),
    bigEnemyPlaqueSeen: false,
    ambushHeckleSeen: false, flagshipQuirkSeen: false,
    retortLinesSoFar: [],
    saviorAbsorbSeen: false,
    turnGoodSeen: false,
    flagshipPhasesSeen: new Set(),
    stageWipeProof: { done: false, ok: false, detail: null },
    bossPhaseBeamProof: { done: false, ok: false, detail: null, where: null },
    firstBossHeckleLine: null, finalBossQuirkLine: null, punchline: null,
  };
  try{
    sb = loadMissionWithConfig(configSource);
    flags = sb.__flags();
    trackers.firstBossHeckleLine = sb.__firstBossHeckleLine();
    trackers.finalBossQuirkLine = sb.__finalBossQuirkLine();
    trackers.punchline = sb.__punchline();
    phaseReached = driveMissionPlaythrough(sb, trackers);
    if(phaseReached !== 'endcard'){
      errors.push('full-cast playthrough did not reach the end card (stopped at "' + phaseReached + '")');
    } else {
      const end = sb.__probe();
      const stageCount = sb.__stageCount();

      // every swarm banner shown -- structural: entering stage i
      // unconditionally calls showBanner with that stage's own
      // MISSION_SWARMS[i] label (enterStage), so observing every index
      // 0..STAGE_COUNT-1 as phaseData.stageIndex during the playthrough IS
      // the proof, same "read straight off the sample's own data, don't
      // scrape draw calls" principle every prior template's own PROBE uses.
      for(let i = 0; i < stageCount; i++){
        if(!trackers.stagesEntered.has(i)) errors.push('stage index ' + i + ' (swarm "' + sb.__missionSwarms()[i] + '") was never entered -- its banner was never shown');
      }

      if(!trackers.bigEnemyPlaqueSeen) errors.push('no big-enemy plaque was ever observed on screen (every stage should spawn at least one "big" enemy)');

      if(flags.JUDGE_CAST && !trackers.ambushHeckleSeen) errors.push('THE FIRST BOSS\'s ambush heckle was never beamed across the screen (JUDGE_CAST is true but the marquee never showed firstBossHeckleLine)');
      if(flags.AUTHORITY_CAST && !trackers.flagshipQuirkSeen) errors.push('THE FINAL BOSS\'s quirk was never beamed between volleys (AUTHORITY_CAST is true but the marquee never showed finalBossQuirkLine)');
      if(flags.SAVIOR_CAST && !trackers.saviorAbsorbSeen) warnings.push('THE SAVIOR never visibly absorbed a hit this run (SAVIOR_CAST is true, but the dodge-autopilot may simply never have been hit while the shield was up -- not a hard failure)');

      if(!trackers.stageWipeProof.done) errors.push('THE BEAM was never fired during a normal stage (never reached 3/3 crates before the last stage) -- ' + trackers.stageWipeProof.detail);
      else if(!trackers.stageWipeProof.ok) errors.push('THE BEAM fired mid-stage but the wipe/flag/spoken-path proof failed -- ' + trackers.stageWipeProof.detail);

      if(!trackers.bossPhaseBeamProof.done) errors.push('THE BEAM was never fired during a boss phase (ambush/flagship) -- the charge withheld on the last stage never carried through, or was never ready in time');
      else if(!trackers.bossPhaseBeamProof.ok) errors.push('THE BEAM fired during "' + trackers.bossPhaseBeamProof.where + '" but the chunk/retort proof failed -- ' + trackers.bossPhaseBeamProof.detail);

      if(flags.JUDGE_CAST && phaseReached === 'endcard' && !trackers.stagesEntered.has(sb.__ambushAfterIndex() + 1) && sb.__ambushAfterIndex() + 1 < stageCount){
        errors.push('the ambush never appeared to hand off to the following stage');
      }

      if(flags.AUTHORITY_CAST){
        if(!trackers.turnGoodSeen) errors.push('THE FINAL BOSS never turned good (AUTHORITY_CAST is true but the "turngood" phase was never reached)');
        if(trackers.flagshipPhasesSeen.size < 1) errors.push('the flagship fight never ran a single volley phase');
      }

      if(!end.rank) errors.push('end card reached with no rank set');
    }
  }catch(e){
    if(e instanceof SyntaxError) throw e;
    errors.push('playthrough threw: ' + (e && e.stack ? e.stack : e));
  }

  // DIFFICULTY TUNING -- see driveMissionNaive's own header and mission/
  // engine.js's BUDGET_DPS/enemyHpScale comments. Coordinator's round-2
  // requirement (a): a naive (dodge-only, no deliberate BEAM) full-cast
  // playthrough loses roughly 1-2 pips total but completes without a
  // stall more often than not. Deterministic seed -- can never flake, only
  // regress if the tuning itself drifts.
  if(errors.length === 0){
    try{
      const naiveSb = loadMissionWithConfig(configSource);
      const naive = driveMissionNaive(naiveSb);
      if(!naive.ok) errors.push('DIFFICULTY TUNING: naive (dodge-only, no deliberate BEAM) full-cast playthrough did not reach the end card (stopped at "' + naive.phaseReached + '", pips lost so far=' + naive.pipsLost + ')');
      else if(naive.pipsLost > 2) warnings.push('DIFFICULTY TUNING: naive full-cast playthrough lost ' + naive.pipsLost + ' pips total -- expected roughly 1-2 (enemyHpScale/BUDGET_DPS may have drifted); not a hard failure since the retry loop still recovers it, but worth a look');
    }catch(e){
      errors.push('DIFFICULTY TUNING naive playthrough threw: ' + (e && e.stack ? e.stack : e));
    }
  }

  if(flags){
    const castCount = ['JUDGE_CAST', 'AUTHORITY_CAST', 'SAVIOR_CAST', 'BUTTERFINGERS_CAST', 'BUILDER_CAST'].filter(k => flags[k]).length;
    if(castCount === 0) warnings.push('no optional roles cast -- an elite swarm volley substitutes for the ambush, a grand finale volley substitutes for the flagship, no savior shield/butterfingers crates/builder drone');
  }

  return { ok: errors.length === 0, errors: errors, warnings: warnings, phaseReached: phaseReached, flags: flags };
}

function verifyMissionFile(filePath, opts){
  const src = fs.readFileSync(filePath, 'utf8');
  return verifyMissionSource(src, opts);
}

/* FORCED-STALL PATH -- run under a no-dodge policy (steer never called,
   matching driveMissionNaive's own "still auto-fires regardless of input"
   design note) until __debugForcePipLoss(3) forces the retry card, confirm
   it shows, then resume the normal dodge-autopilot policy and confirm the
   game still reaches the end card (proves the retry/reseed loop,
   SPEC-mission.md's Verification section). */
function driveMissionForcedStall(sb, maxIter){
  sb.__ensureAudio();
  sb.__handleAction(); // title -> stage 0
  const before = sb.__probe();
  sb.__debugForcePipLoss(3);
  const afterForce = sb.__probe();
  if(afterForce.activeCard !== 'stallretry') return { ok: false, reason: 'retry card did not appear after 3 forced pip losses (activeCard=' + JSON.stringify(afterForce.activeCard) + ', pips=' + afterForce.pips + ')' };
  const trackers = {
    stagesEntered: new Set(), bigEnemyPlaqueSeen: true, ambushHeckleSeen: true, flagshipQuirkSeen: true,
    retortLinesSoFar: [], saviorAbsorbSeen: true, turnGoodSeen: false, flagshipPhasesSeen: new Set(),
    stageWipeProof: { done: true, ok: true, detail: null }, bossPhaseBeamProof: { done: true, ok: true, detail: null, where: null },
    firstBossHeckleLine: sb.__firstBossHeckleLine(), finalBossQuirkLine: sb.__finalBossQuirkLine(), punchline: sb.__punchline(),
  };
  sb.__handleAction(); // dismiss the retry card -> reseeded attempt of the SAME stage, pips refilled
  let guard = 0;
  while(sb.__probe().phase !== 'endcard' && guard++ < 400){
    const phase = sb.__probe().phase;
    if(phase === 'stage') driveMissionStage(sb, trackers);
    else if(phase === 'ambush') driveMissionAmbush(sb, trackers);
    else if(phase === 'eliteVolley') driveMissionEliteVolley(sb, trackers);
    else if(phase === 'lull') driveMissionLull(sb, trackers);
    else if(phase === 'flagship') driveMissionFlagship(sb, trackers);
    else if(phase === 'finaleVolley') driveMissionFinaleVolley(sb, trackers);
    else if(phase === 'turngood') driveMissionTurnGood(sb, trackers);
    else if(phase === 'celebration') driveThrough(sb, 'celebration');
    else break;
  }
  const end = sb.__probe();
  return { ok: end.phase === 'endcard', reason: end.phase === 'endcard' ? null : ('did not reach end card after resuming, stopped at "' + end.phase + '"'), pipsBeforeForce: before.pips };
}

/* host-only degradation: every optional role uncast -- host+diner0 is the
   minimum roster (diner0 is never null, see mission/engine.js's own cast
   default). Uses the SAME dodge-autopilot policy as the full-cast run
   above -- this IS the coordinator's round-2 requirement (b): "host-only
   remains winnable with an attentive (dodge) policy -- this is the
   floor." Also asserts the ABSENCE of every optional mechanic, not just
   that they were never checked (SPEC-mission.md's Host-only bullet: "no
   wingmates/shield/crates-from-butterfingers ... elite-volley ambush,
   finale volley, still winnable"). THE BEAM is still asserted reachable
   here too -- SPEC-mission.md's own decision: "crates still drop from a
   neutral seeded schedule at a lower rate so THE BEAM stays reachable". */
function verifyMissionHostOnlySource(configSource, opts){
  opts = opts || {};
  const errors = [];
  let sb, phaseReached = null, flags = null;
  const trackers = {
    stagesEntered: new Set(), bigEnemyPlaqueSeen: false,
    ambushHeckleSeen: false, flagshipQuirkSeen: false, retortLinesSoFar: [],
    saviorAbsorbSeen: false, turnGoodSeen: false, flagshipPhasesSeen: new Set(),
    stageWipeProof: { done: false, ok: false, detail: null },
    bossPhaseBeamProof: { done: false, ok: false, detail: null, where: null },
    firstBossHeckleLine: null, finalBossQuirkLine: null, punchline: null,
  };
  try{
    sb = loadMissionWithConfig(configSource);
    flags = sb.__flags();
    trackers.firstBossHeckleLine = sb.__firstBossHeckleLine();
    trackers.finalBossQuirkLine = sb.__finalBossQuirkLine();
    trackers.punchline = sb.__punchline();
    phaseReached = driveMissionPlaythrough(sb, trackers);
    if(phaseReached !== 'endcard'){
      errors.push('host-only playthrough did not reach the end card (stopped at "' + phaseReached + '") -- this is the round-2 winnability floor (dodge-autopilot policy)');
    } else {
      const end = sb.__probe();
      const stageCount = sb.__stageCount();
      for(let i = 0; i < stageCount; i++){
        if(!trackers.stagesEntered.has(i)) errors.push('stage index ' + i + ' was never entered');
      }
      if(trackers.ambushHeckleSeen) errors.push('an ambush heckle marquee was observed with JUDGE uncast (should be impossible -- the elite-volley substitute has no boss line)');
      if(trackers.flagshipQuirkSeen) errors.push('a flagship quirk marquee was observed with AUTHORITY uncast (should be impossible -- the finale-volley substitute has no boss line)');
      if(trackers.saviorAbsorbSeen) errors.push('a savior absorb was observed with SAVIOR uncast');
      if(trackers.turnGoodSeen) errors.push('a turn-good phase was observed with AUTHORITY uncast (should be impossible -- the finale-volley substitute skips straight to celebration)');

      // THE BEAM must still be reachable host-only -- SPEC-mission.md's own
      // "neutral seeded schedule at a lower rate" decision (see
      // buildStageSchedule's crateInterval, mission/engine.js).
      if(!trackers.stageWipeProof.done) errors.push('THE BEAM was never fired during a normal stage with every optional role uncast -- the host-only neutral crate schedule may not be reachable');
      else if(!trackers.stageWipeProof.ok) errors.push('THE BEAM fired mid-stage (host-only) but the wipe/flag/spoken-path proof failed -- ' + trackers.stageWipeProof.detail);

      if(!end.rank) errors.push('end card reached with no rank set');
    }
  }catch(e){
    if(e instanceof SyntaxError) throw e;
    errors.push('host-only playthrough threw: ' + (e && e.stack ? e.stack : e));
  }
  return { ok: errors.length === 0, errors: errors, warnings: [], phaseReached: phaseReached, flags: flags };
}

module.exports = {
  verifyMissionSource, verifyMissionFile, verifyMissionHostOnlySource,
  loadMissionWithConfig, driveMissionPlaythrough,
  driveMissionStage, driveMissionAmbush, driveMissionEliteVolley, driveMissionLull,
  driveMissionFlagship, driveMissionFinaleVolley, driveMissionTurnGood, driveThrough,
  driveMissionNaive, driveMissionForcedStall, widestSafeX,
};

if(require.main === module){
  const target = process.argv[2];
  if(!target){
    console.error('Usage: node tools/verify-mission.js <path-to-config.js>');
    process.exit(2);
  }
  let result;
  try{
    result = verifyMissionFile(path.resolve(target));
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
