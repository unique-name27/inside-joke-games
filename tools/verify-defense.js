'use strict';
/* ======================================================================
   tools/verify-defense.js -- THE DEFENSE's own verify driver (see
   SPEC-defense.md "Verification" and tools/verify-config.js's own header
   for the shared methodology: a Node `vm` harness, zero dependencies,
   never a live browser). Reuses tools/lib/sandbox.js's fake DOM/Canvas/
   AudioContext (the exact same sandbox game/engine.js's own harness uses)
   and tools/verify-config.js's toneGateSource (identical tone-gate rule,
   not a second copy) -- everything ELSE here is defense-specific:
   defense/engine.js's script chain (shared/framework.js in place of
   game/skeletons.js -- the defense has no scene skeleton, same as the
   flight) and a driver that plays through defense/engine.js's own exposed
   tick/handleAction/setPriorityAt/trySwapPads, the exact same functions
   round 1's own throwaway smoke scripts drove by hand.

     node tools/verify-defense.js games/<slug>/config.js

   Driver policy (SPEC-defense.md): dismiss cards, READY each wave, each
   tick mark the frontmost enemy as priority, fire THE RALLY when charged
   during the final boss wave, let auto-placement stand. Two deliberate
   one-shot interventions are layered on top of that canonical policy for
   the full-cast run (round 2's own additions, on top of what SPEC-
   defense.md's Verification section already asked for):
     - a deliberate near-leak (withhold every priority tap until an enemy
       crosses the last corner) to reliably exercise THE SAVIOR's
       leak-triggered teleport, since the canonical frontmost-tap policy
       plays well enough that a near-leak may never happen on its own;
     - a deliberate off-frontmost priority tap (mark a NON-frontmost
       enemy, within a real tower's range, and watch a projectile actually
       retarget onto it) to prove the priority-override mechanism itself,
       not just that towers auto-fire by default;
     - a between-waves pad swap (tap host's pad, then diner0's pad, during
       the very first prep) to prove trySwapPads actually exchanges two
       towers' padIndex.
   See DIFFICULTY_TUNING below for the round-2 tuning assertions the
   coordinator asked for, encoded with deterministic seeds so a future
   BUDGET_UPTIME_FACTOR change can't silently regress the target range.

   Zero dependencies.
   ====================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { buildSandbox } = require('./lib/sandbox');
const { toneGateSource } = require('./verify-config.js');

const REPO_ROOT = path.join(__dirname, '..');
const DEFENSE_ENGINE_PATH = path.join(REPO_ROOT, 'defense', 'engine.js');
const FRAMEWORK_PATH = path.join(REPO_ROOT, 'shared', 'framework.js');
const CFGCODEC_PATH = path.join(REPO_ROOT, 'game', 'cfgcodec.js');
const ROSTER_PATH = path.join(REPO_ROOT, 'game', 'roster.js');

const DT = 1 / 60; // matches every other engine's own harness tick -- see tools/verify-flight.js's identical constant/comment

/* exposes defense/engine.js's own top-level functions/state to the
   harness -- `function` declarations attach to the vm context's global
   object (see tools/verify-config.js's PROBE for the identical
   `let`-vs-`function` note). Every field here reads the engine's OWN live
   state/helpers directly (phaseData, towers, activeEnemies, projectiles,
   TOWER_STATS, firstBossHeckleLine, DEFENSE_WAVE_LABELS, ...) rather than
   re-typing any position/label/stat as a literal here -- same "no
   duplicated literals" discipline tools/verify-flight.js's own PROBE
   documents. __debugForceLeaks is the one test-only hook with no real-
   player equivalent (round 1's own throwaway defense-retry-debug.js
   proved calling handleLeak() directly is a safe, correct way to force
   the retry-card path without needing to actually out-DPS three real
   leaks under a synthetic worst-case policy). */
const PROBE = `
function __probe(){
  return {
    phase: phase,
    waveIndex: (phaseData && phaseData.waveIndex),
    attempt: (phaseData && phaseData.attempt),
    isFinalWave: !!(phaseData && phaseData.isFinalWave),
    bossDefeated: !!(phaseData && phaseData.bossDefeated),
    hearts: hearts,
    totalHeartsLostEver: totalHeartsLostEver,
    wavesHeldCount: wavesHeldCount,
    activeCard: activeCard ? activeCard.key : null,
    rallyCharge: rallyCharge,
    rallyReady: rallyReady(),
    rallyUsedThisGame: rallyUsedThisGame,
    rallyBuffUntil: rallyBuffUntil,
    judgeHeckledThisWave: judgeHeckledThisWave,
    saviorTeleported: saviorTeleportedThisWave,
    barricadeHp: barricadeHp,
    barricadeMaxHp: barricadeMaxHp,
    gameT: gameT,
    bubbleText: bubble ? bubble.text : null,
    rank: (phaseData && phaseData.rank) || null,
  };
}
function __tick(dt){ tick(dt); }
function __handleAction(){ handleAction(); }
function __ensureAudio(){ ensureAudioStarted(); }
function __flags(){
  return { JUDGE_CAST: JUDGE_CAST, AUTHORITY_CAST: AUTHORITY_CAST, SAVIOR_CAST: SAVIOR_CAST, BUTTERFINGERS_CAST: BUTTERFINGERS_CAST, BUILDER_CAST: BUILDER_CAST };
}
function __listEnemies(){
  return activeEnemies.map(function(e){
    return { id:e.id, x:e.pos.x, y:e.pos.y, dist:e.dist, hp:e.hp, maxHp:e.maxHp, isBoss:e.isBoss, label:e.label };
  });
}
function __listTowers(){
  return towers.map(function(t){
    var stats = t.role==='authority' ? TURNGOOD_STATS : TOWER_STATS[t.role];
    var pos = towerPos(t);
    return { role:t.role, padIndex:t.padIndex, x:pos.x, y:pos.y, range: stats.range||0, rate: stats.rate||0,
      cooldown: t.cooldown||0, isSupport: !!stats.isSupport, isEngineer: !!stats.isEngineer, isChaos: !!stats.isChaos,
      teleported: !!t.teleported };
  });
}
function __listProjectiles(){
  return projectiles.map(function(p){ return { targetId:p.targetId, sourceRole:p.sourceRole, dmg:p.dmg }; });
}
function __setPriorityAt(x,y){ return setPriorityAt(x,y); }
function __trySwapPads(padIndex){ trySwapPads(padIndex); }
function __wavesCount(){ return WAVES_COUNT; }
function __finalWaveIndex(){ return FINAL_WAVE_INDEX; }
function __waveLabels(){ return DEFENSE_WAVE_LABELS.slice(); }
function __defending(){ return DEFENSE_DEFENDING; }
function __firstBossHeckleLine(){ return firstBossHeckleLine; }
function __finalBossQuirkLine(){ return finalBossQuirkLine; }
function __currentWaveDropsSpawnedCount(){
  return (phaseData && phaseData.schedule && phaseData.schedule.drops) ? phaseData.schedule.drops.filter(function(d){ return d.spawned; }).length : 0;
}
function __perWaveDownedTotal(i){
  var counts = perWaveDowned[i] || {};
  var total = 0;
  for(var k in counts) total += counts[k];
  return total;
}
function __debugForceLeaks(n){
  for(var i=0;i<n;i++) handleLeak({ isBoss:false });
}
`;

/* mirrors tools/verify-flight.js's loadFlightWithConfig exactly, just
   with defense/engine.js's own real script chain (config -> roster ->
   cfgcodec -> shared/framework -> defense/engine.js -- see defense/
   index.html) -- no game/skeletons.js, the defense has no scene skeleton. */
function loadDefenseWithConfig(configSource, opts){
  opts = opts || {};
  const engineSrc = fs.readFileSync(DEFENSE_ENGINE_PATH, 'utf8');
  const frameworkSrc = fs.readFileSync(FRAMEWORK_PATH, 'utf8');
  const cfgcodecSrc = fs.readFileSync(CFGCODEC_PATH, 'utf8');
  const rosterSrc = fs.readFileSync(ROSTER_PATH, 'utf8');
  const combined = configSource + '\n' + rosterSrc + '\n' + cfgcodecSrc + '\n' + frameworkSrc + '\n' + engineSrc + '\n' + PROBE;
  const sandbox = buildSandbox({ network: 'fail', currentScriptSrc: 'https://example.test/defense/engine.js', locationHash: opts.locationHash });
  if(opts.beforeRun) opts.beforeRun(sandbox);
  const ctx = vm.createContext(sandbox);
  const script = new vm.Script(combined, { filename: 'verify-defense-generated.js' });
  script.runInContext(ctx);
  return sandbox;
}

/* ----------------------------------------------------------------------
   DRIVERS
   ---------------------------------------------------------------------- */

/* PREP -- between waves. `trackers` (optional) carries the one-shot
   pad-swap proof: on the very first prep of the game, tap host's pad then
   diner0's pad (both are ALWAYS present -- host is the anchor, diner0 is
   never null, see defense/engine.js's buildTowerRoster) and confirm the
   two towers' padIndex values actually exchanged. READY (handleAction)
   always immediately starts the wave -- prep never shows a card. */
function driveDefensePrep(sb, trackers){
  if(trackers && trackers.padSwapCheck && !trackers.padSwapCheck.attempted){
    trackers.padSwapCheck.attempted = true;
    const before = sb.__listTowers();
    if(before.length >= 2){
      const a = before[0], b = before[1];
      sb.__trySwapPads(a.padIndex);
      sb.__trySwapPads(b.padIndex);
      const after = sb.__listTowers();
      const afterA = after.find(t => t.role === a.role);
      const afterB = after.find(t => t.role === b.role);
      trackers.padSwapCheck.ok = !!afterA && !!afterB && afterA.padIndex === b.padIndex && afterB.padIndex === a.padIndex;
    }
  }
  sb.__handleAction(); // prep -> wave
}

/* WAVE -- the main tick loop. Canonical policy: tap the frontmost enemy
   every tick (SPEC-defense.md), fire THE RALLY the moment it's ready
   during the final boss wave. Two one-shot interventions run BEFORE that
   canonical policy kicks in (see this file's own header):
     1. if SAVIOR_CAST and no teleport has been observed yet, withhold
        EVERY priority tap (towers still auto-fire at their own natural
        frontmost-in-range target -- this is exactly the "naive" policy
        the tuning driver below also uses) until saviorTeleportedThisWave
        flips true, i.e. an enemy actually crossed the last corner.
     2. once that resolves (or immediately, if no savior is cast), prove
        the priority-override mechanism itself: find a NON-frontmost
        enemy that's within a real tower's range, tap it, and confirm a
        projectile retargets onto it within a bounded window. Only
        attempted once per game. */
function driveDefenseWave(sb, trackers, maxIter){
  let iter = 0;
  while(iter++ < (maxIter || 8000) && sb.__probe().phase === 'wave'){
    const st = sb.__probe();
    if(st.activeCard){ sb.__handleAction(); sb.__tick(DT); continue; } // retry card -- dismiss, resume (attempt++ reseeds, hearts refill)

    if(trackers){
      const wi = st.waveIndex;
      if(wi != null){
        trackers.barricadeSeen[wi] = Math.max(trackers.barricadeSeen[wi] || 0, st.barricadeHp);
        trackers.dropsSeen[wi] = Math.max(trackers.dropsSeen[wi] || 0, sb.__currentWaveDropsSpawnedCount());
      }
      if(st.judgeHeckledThisWave) trackers.heckleSeen = true;
      if(st.saviorTeleported) trackers.saviorTeleportSeen = true;
    }

    // ---- intervention 1: deliberate near-leak for THE SAVIOR ----
    if(trackers && trackers.saviorCast && !trackers.saviorTeleportSeen){
      sb.__tick(DT);
      continue;
    }

    // ---- intervention 2: priority-override retarget proof (one-shot) ----
    let tapped = false;
    if(trackers && !trackers.priorityCheck.done){
      const enemies = sb.__listEnemies();
      if(enemies.length >= 2){
        const sorted = enemies.slice().sort((a, b) => b.dist - a.dist);
        const frontDist = sorted[0].dist;
        const liveTowers = sb.__listTowers().filter(t => t.range > 0 && !t.isSupport && !t.isEngineer && !t.isChaos);
        if(!trackers.priorityCheck.target){
          const candidate = sorted.find(e => e.dist < frontDist - 1 && liveTowers.some(t => Math.hypot(t.x - e.x, t.y - e.y) <= t.range));
          if(candidate){
            sb.__setPriorityAt(candidate.x, candidate.y);
            trackers.priorityCheck.target = candidate.id;
            trackers.priorityCheck.until = iter + 200; // ~3.3s window -- comfortably longer than THE FIRST BOSS's slowest cooldown (rate 0.4 -> 2.5s)
            tapped = true;
          }
        }
      }
      if(trackers.priorityCheck.target != null){
        const proj = sb.__listProjectiles();
        if(proj.some(p => p.targetId === trackers.priorityCheck.target)){
          trackers.priorityCheck.done = true;
          trackers.priorityCheck.ok = true;
        } else if(iter > trackers.priorityCheck.until){
          trackers.priorityCheck.done = true; // window expired without a match -- recorded as a failure, not silently dropped
          trackers.priorityCheck.ok = false;
        }
      }
    }

    // ---- canonical policy: tap the frontmost enemy every other tick ----
    if(!tapped && (!trackers || trackers.priorityCheck.done)){
      const enemies = sb.__listEnemies();
      if(enemies.length){
        const front = enemies.reduce((a, b) => (b.dist > a.dist ? b : a));
        sb.__setPriorityAt(front.x, front.y);
      }
    }

    // ---- THE RALLY -- fire when charged during the final boss wave ----
    if(st.isFinalWave && st.rallyReady){
      sb.__handleAction(); // rallyReady() short-circuits handleAction's 'wave' branch straight to fireRally()
      if(trackers){ trackers.rallyCheck.fired = true; trackers.rallyCheck.firedAtGameT = st.gameT; }
    }

    sb.__tick(DT);

    // ---- double-rate window check -- right after any tower fires while the buff is live ----
    if(trackers && trackers.rallyCheck.fired && !trackers.rallyCheck.doubleRateObserved){
      const now = sb.__probe();
      if(now.gameT < now.rallyBuffUntil){
        for(const t of sb.__listTowers()){
          if(t.rate > 0 && t.cooldown > 0 && Math.abs(t.cooldown - 1 / (t.rate * 2)) < 0.02){
            trackers.rallyCheck.doubleRateObserved = true;
            break;
          }
        }
      }
    }
  }
}

/* TURN-GOOD -- THE FINAL BOSS's mini-wave, same frontmost-tap policy.
   `trackers.turnGoodParticipation` proves the turned-good tower
   (role:'authority', pushed onto `towers` by enterTurnGood) actually
   fires, not just that it exists on the board. */
function driveDefenseTurnGood(sb, trackers, maxIter){
  let iter = 0;
  while(iter++ < (maxIter || 3000) && sb.__probe().phase === 'turngood'){
    const enemies = sb.__listEnemies();
    if(enemies.length){
      const front = enemies.reduce((a, b) => (b.dist > a.dist ? b : a));
      sb.__setPriorityAt(front.x, front.y);
    }
    sb.__tick(DT);
    if(trackers && !trackers.turnGoodParticipation){
      if(sb.__listProjectiles().some(p => p.sourceRole === 'authority')) trackers.turnGoodParticipation = true;
    }
  }
}

/* celebration -- nothing to steer, just let time pass to the end card. */
function driveThrough(sb, phaseName, maxIter){
  let iter = 0;
  while(iter++ < (maxIter || 3000) && sb.__probe().phase === phaseName){
    if(sb.__probe().activeCard) sb.__handleAction();
    sb.__tick(DT);
  }
}

/* full attentive playthrough: title -> prep/wave x WAVES_COUNT ->
   (turngood -> celebration, if AUTHORITY_CAST and the boss was beaten, or
   straight to celebration otherwise) -> endcard. Degradation-agnostic by
   construction (same principle as tools/verify-gallery.js's/tools/verify-
   flight.js's own top-level drivers) -- it just follows whatever `phase`
   the config's own cast produces at each junction. `trackers` threads
   through to driveDefenseWave/driveDefenseTurnGood for the mechanic
   proofs described above. */
function driveDefensePlaythrough(sb, trackers){
  sb.__ensureAudio();
  sb.__handleAction(); // title -> prep (wave 0)
  let guard = 0;
  while(sb.__probe().phase !== 'endcard' && guard++ < 200){
    const phase = sb.__probe().phase;
    if(phase === 'prep') driveDefensePrep(sb, trackers);
    else if(phase === 'wave') driveDefenseWave(sb, trackers);
    else if(phase === 'turngood') driveDefenseTurnGood(sb, trackers);
    else if(phase === 'celebration') driveThrough(sb, 'celebration');
    else break; // unknown phase -- stop rather than spin forever
  }
  return sb.__probe().phase;
}

/* DIFFICULTY TUNING (round 2, see defense/engine.js's own BUDGET_UPTIME_
   FACTOR comment) -- a completely NAIVE policy: dismiss cards, READY each
   wave, but NEVER tap a priority target at all (towers still auto-fire at
   their own default frontmost-in-range pick, which ignores enemy SPEED --
   see that same comment for why this makes "naive" meaningfully weaker
   than the attentive canonical driver above). Mirrors the throwaway
   tuning script's own runNaive() that picked the shipped tuning value. */
function driveDefenseNaive(sb, maxIter){
  sb.__ensureAudio();
  sb.__handleAction(); // title -> prep
  let iter = 0;
  while(iter++ < (maxIter || 40000)){
    const st = sb.__probe();
    if(st.phase === 'endcard') return { ok: true, phaseReached: 'endcard', heartsLost: st.totalHeartsLostEver, iters: iter };
    if(st.activeCard){ sb.__handleAction(); sb.__tick(DT); continue; } // retry card -- still a no-op policy, just dismiss and keep going
    if(st.phase === 'prep'){ sb.__handleAction(); continue; } // READY, no swap
    sb.__tick(DT);
  }
  const end = sb.__probe();
  return { ok: false, phaseReached: end.phase, heartsLost: end.totalHeartsLostEver, iters: maxIter };
}

/* `configSource` is the FULL text of a config.js file (a `const CONFIG =
   {...}` statement, matching games/<slug>/config.js's own shape when
   template is 'defense'). Returns { ok, errors, warnings, phaseReached,
   flags } -- same shape as tools/verify-flight.js's verifyFlightSource,
   never throws for a content/gameplay failure (a SyntaxError propagates,
   same "fundamentally different, always-fatal" split). Every cast-
   dependent assertion below is gated behind that role's own *_CAST flag,
   read straight off the running sandbox -- this makes the function
   degradation-agnostic by construction, safe to run against ANY config a
   real order produces (tools/generate.js calls this unconditionally), not
   just the full-cast sample. */
function verifyDefenseSource(configSource, opts){
  opts = opts || {};
  const errors = [];
  const warnings = [];

  const toneViolations = toneGateSource(configSource, opts.extraForbidden);
  for(const v of toneViolations) errors.push('tone gate: ' + v);

  let sb, flags = null, phaseReached = null;
  const trackers = {
    padSwapCheck: { attempted: false, ok: false },
    priorityCheck: { done: false, ok: false, target: null, until: 0 },
    saviorCast: false, saviorTeleportSeen: false,
    heckleSeen: false,
    barricadeSeen: {}, dropsSeen: {},
    rallyCheck: { fired: false, doubleRateObserved: false, firedAtGameT: null },
    turnGoodParticipation: false,
  };
  try{
    sb = loadDefenseWithConfig(configSource);
    flags = sb.__flags();
    trackers.saviorCast = flags.SAVIOR_CAST;
    phaseReached = driveDefensePlaythrough(sb, trackers);
    if(phaseReached !== 'endcard'){
      errors.push('full-cast playthrough did not reach the end card (stopped at "' + phaseReached + '")');
    } else {
      const end = sb.__probe();
      const wavesCount = sb.__wavesCount();

      // every wave label banner shown -- structural: DEFENSE_WAVE_LABELS is
      // exactly WAVES_COUNT long and the only way forward is enterPrep
      // (waveIndex+1)/enterWave in sequence (drawHUD reads DEFENSE_WAVE_
      // LABELS[waveIdx] straight off that same array every wave) -- so
      // wavesHeldCount===wavesCount already proves every index's banner
      // was shown, same "read straight off the sample's own data, don't
      // scrape draw calls" principle tools/verify-flight.js's hazard-label
      // check uses.
      if(end.wavesHeldCount !== wavesCount) errors.push('not every wave was held -- wavesHeldCount=' + end.wavesHeldCount + ', expected ' + wavesCount);

      if(flags.JUDGE_CAST && !trackers.heckleSeen) errors.push('THE FIRST BOSS never heckled (JUDGE_CAST is true but no first-kill heckle was observed)');
      if(flags.SAVIOR_CAST && !trackers.saviorTeleportSeen) errors.push('THE SAVIOR never teleported (SAVIOR_CAST is true but the deliberate near-leak never triggered one)');
      if(flags.BUILDER_CAST){
        const missingBarricadeWaves = [];
        for(let i = 0; i < wavesCount; i++) if(!(trackers.barricadeSeen[i] > 0)) missingBarricadeWaves.push(i);
        if(missingBarricadeWaves.length) errors.push('THE BUILDER\'s barricade was never observed with HP>0 in wave(s): ' + JSON.stringify(missingBarricadeWaves));
      }
      if(flags.BUTTERFINGERS_CAST){
        const totalDrops = Object.keys(trackers.dropsSeen).reduce((s, k) => s + trackers.dropsSeen[k], 0);
        if(totalDrops < 1) errors.push('BUTTERFINGERS never dropped anything (BUTTERFINGERS_CAST is true but 0 drops were observed across the whole game)');
      }
      if(!trackers.rallyCheck.fired) errors.push('THE RALLY never fired during the final boss wave');
      else if(!trackers.rallyCheck.doubleRateObserved) errors.push('THE RALLY fired but the double-rate window was never observed on any tower');

      if(flags.AUTHORITY_CAST && !trackers.turnGoodParticipation) errors.push('THE FINAL BOSS\'s turned-good tower never fired during the mini-wave');

      if(!trackers.padSwapCheck.ok) errors.push('between-waves pad swap did not exchange two towers\' padIndex values');
      if(!trackers.priorityCheck.ok) errors.push('priority-target tap did not cause a tower to retarget the marked (non-frontmost) enemy');

      if(!end.rank) errors.push('end card reached with no rank set');
    }
  }catch(e){
    if(e instanceof SyntaxError) throw e;
    errors.push('playthrough threw: ' + (e && e.stack ? e.stack : e));
  }

  // DIFFICULTY TUNING -- see this file's own driveDefenseNaive header and
  // defense/engine.js's BUDGET_UPTIME_FACTOR comment. Coordinator's round-2
  // requirement (a): a naive (no-priority-tap) full-cast playthrough loses
  // roughly 2-4 hearts across the game but still wins. Deterministic seed
  // (same configSource, same gameId) -- this can never flake, only regress
  // if the tuning itself changes.
  if(errors.length === 0){
    try{
      const naiveSb = loadDefenseWithConfig(configSource);
      const naive = driveDefenseNaive(naiveSb);
      if(!naive.ok) errors.push('DIFFICULTY TUNING: naive (no-priority-tap) full-cast playthrough did not reach the end card (stopped at "' + naive.phaseReached + '", hearts lost so far=' + naive.heartsLost + ')');
      else if(naive.heartsLost < 2 || naive.heartsLost > 4) errors.push('DIFFICULTY TUNING: naive full-cast playthrough lost ' + naive.heartsLost + ' hearts -- expected roughly 2-4 (BUDGET_UPTIME_FACTOR may have drifted)');
    }catch(e){
      errors.push('DIFFICULTY TUNING naive playthrough threw: ' + (e && e.stack ? e.stack : e));
    }
  }

  if(flags){
    const castCount = ['JUDGE_CAST', 'AUTHORITY_CAST', 'SAVIOR_CAST', 'BUTTERFINGERS_CAST', 'BUILDER_CAST'].filter(k => flags[k]).length;
    if(castCount === 0) warnings.push('no optional roles cast -- THE FIRST/FINAL BOSS both degrade (no sniper heckle, grand-rush finale instead of a boss), no savior teleport, no butterfingers drops, no builder barricade');
  }

  return { ok: errors.length === 0, errors: errors, warnings: warnings, phaseReached: phaseReached, flags: flags };
}

function verifyDefenseFile(filePath, opts){
  const src = fs.readFileSync(filePath, 'utf8');
  return verifyDefenseSource(src, opts);
}

/* FORCED-STALL PATH -- run one wave under a no-op policy (equivalent to
   driveDefenseNaive's own "never tap" policy, since towers auto-fire
   regardless of input under this engine's design -- see that function's
   own header) until 3 leaks force the retry card, confirm it shows, then
   resume the normal attentive policy and confirm the game still reaches
   the end card (proves the retry/reseed loop, SPEC-defense.md's
   Verification section). Uses __debugForceLeaks -- proven safe/correct by
   round 1's own throwaway defense-retry-debug.js -- rather than trying to
   organically force 3 real leaks through worse play, which wouldn't
   reliably differ from the naive policy under this engine's always-auto-
   fires-regardless-of-input design (see this file's own header). */
function driveDefenseForcedStall(sb, maxIter){
  sb.__ensureAudio();
  sb.__handleAction(); // title -> prep (wave 0)
  sb.__handleAction(); // prep -> wave 0
  const before = sb.__probe();
  sb.__debugForceLeaks(3);
  const afterForce = sb.__probe();
  if(afterForce.activeCard !== 'retry') return { ok: false, reason: 'retry card did not appear after 3 forced leaks (activeCard=' + JSON.stringify(afterForce.activeCard) + ', hearts=' + afterForce.hearts + ')' };
  // resume normal play -- dismiss the card, then finish the game with the
  // canonical (frontmost-tap) policy the rest of the way.
  const trackers = {
    padSwapCheck: { attempted: true, ok: true }, // already exercised once elsewhere -- not this run's job
    priorityCheck: { done: true, ok: true, target: null, until: 0 },
    saviorCast: false, saviorTeleportSeen: false,
    heckleSeen: false, barricadeSeen: {}, dropsSeen: {},
    rallyCheck: { fired: true, doubleRateObserved: true, firedAtGameT: null },
    turnGoodParticipation: false,
  };
  sb.__handleAction(); // dismiss the retry card -> reseeded attempt of the SAME wave, hearts refilled
  let guard = 0;
  while(sb.__probe().phase !== 'endcard' && guard++ < 200){
    const phase = sb.__probe().phase;
    if(phase === 'prep') driveDefensePrep(sb, trackers);
    else if(phase === 'wave') driveDefenseWave(sb, trackers);
    else if(phase === 'turngood') driveDefenseTurnGood(sb, trackers);
    else if(phase === 'celebration') driveThrough(sb, 'celebration');
    else break;
  }
  const end = sb.__probe();
  return { ok: end.phase === 'endcard', reason: end.phase === 'endcard' ? null : ('did not reach end card after resuming, stopped at "' + end.phase + '"'), heartsBeforeForce: before.hearts };
}

/* host-only degradation: every optional role uncast -- host+diner0 is the
   minimum roster (diner0 is never null, see defense/engine.js's own cast
   default). Uses the SAME canonical (frontmost-tap) attentive policy as
   the full-cast run above -- SAVIOR_CAST is false so the near-leak
   withhold never engages, falling straight through to the priority-
   override proof and then the normal frontmost tap for the rest of the
   game -- this IS the coordinator's round-2 requirement (b): "host-only
   remains winnable with an attentive policy (priority-targeting used) --
   this is the floor." Also asserts the ABSENCE of every optional
   mechanic, not just that they were never checked (SPEC-defense.md's Host-
   only run bullet: "no heckle/teleport/barricade/drops"). Simpler than
   verifyDefenseSource above -- no rally/turn-good gating needed since
   THE RALLY doesn't depend on cast and no authority tower exists to
   participate in a mini-wave that never happens. */
function verifyDefenseHostOnlySource(configSource, opts){
  opts = opts || {};
  const errors = [];
  let sb, phaseReached = null, flags = null;
  const trackers = {
    padSwapCheck: { attempted: false, ok: false },
    priorityCheck: { done: false, ok: false, target: null, until: 0 },
    saviorCast: false, saviorTeleportSeen: false,
    heckleSeen: false, barricadeSeen: {}, dropsSeen: {},
    rallyCheck: { fired: false, doubleRateObserved: false, firedAtGameT: null },
    turnGoodParticipation: false,
  };
  try{
    sb = loadDefenseWithConfig(configSource);
    flags = sb.__flags();
    phaseReached = driveDefensePlaythrough(sb, trackers);
    if(phaseReached !== 'endcard'){
      errors.push('host-only playthrough did not reach the end card (stopped at "' + phaseReached + '") -- this is the round-2 winnability floor (attentive policy, priority-targeting used)');
    } else {
      const end = sb.__probe();
      const wavesCount = sb.__wavesCount();
      if(end.wavesHeldCount !== wavesCount) errors.push('not every wave was held -- wavesHeldCount=' + end.wavesHeldCount + ', expected ' + wavesCount);
      if(trackers.heckleSeen) errors.push('a heckle was observed with JUDGE uncast (should be impossible -- no judge tower exists)');
      if(trackers.saviorTeleportSeen) errors.push('a savior teleport was observed with SAVIOR uncast');
      const barricadeTotal = Object.keys(trackers.barricadeSeen).reduce((s, k) => s + trackers.barricadeSeen[k], 0);
      if(barricadeTotal > 0) errors.push('a barricade was observed with BUILDER uncast');
      const dropsTotal = Object.keys(trackers.dropsSeen).reduce((s, k) => s + trackers.dropsSeen[k], 0);
      if(dropsTotal > 0) errors.push('a butterfingers drop was observed with BUTTERFINGERS uncast');
      if(!trackers.padSwapCheck.ok) errors.push('between-waves pad swap did not exchange host/diner0\'s padIndex values (host+diner0 are always present)');
    }
  }catch(e){
    if(e instanceof SyntaxError) throw e;
    errors.push('host-only playthrough threw: ' + (e && e.stack ? e.stack : e));
  }
  return { ok: errors.length === 0, errors: errors, warnings: [], phaseReached: phaseReached, flags: flags };
}

module.exports = {
  verifyDefenseSource, verifyDefenseFile, verifyDefenseHostOnlySource,
  loadDefenseWithConfig, driveDefensePlaythrough, driveDefenseWave, driveDefensePrep, driveDefenseTurnGood, driveThrough,
  driveDefenseNaive, driveDefenseForcedStall,
};

if(require.main === module){
  const target = process.argv[2];
  if(!target){
    console.error('Usage: node tools/verify-defense.js <path-to-config.js>');
    process.exit(2);
  }
  let result;
  try{
    result = verifyDefenseFile(path.resolve(target));
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
