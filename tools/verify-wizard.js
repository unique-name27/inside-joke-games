'use strict';
/* ======================================================================
   tools/verify-wizard.js -- PEOPLE FIRST (SPEC-people.md round 2) pure-
   logic verification for build/index.html's wizard: the v2 people+assign
   state model, the old-draft-shape migration, buildOverridesFromState's
   compile-down (per template), and the unassigned-overflow condition.
   Same Node `vm` harness methodology as tools/verify-config.js/tools/
   verify-skeletons.js (reuses tools/lib/sandbox.js's fake DOM/Canvas/
   AudioContext -- never a live browser); build/index.html's own header
   comment documents exactly why this works: the whole "PURE LOGIC"
   section has no `document`/`window` references, and the DOM-WIRING
   section below it is entirely guarded behind `initWizard()`, only ever
   invoked via a `DOMContentLoaded` listener that this harness's fake
   `document` never fires -- so loading the ENTIRE inline script (not
   just a hand-picked slice of it) is safe and never touches the DOM.

     node tools/verify-wizard.js

   Every top-level `function` declaration in build/index.html's inline
   script (normalizeWizardState, buildOverridesFromState,
   migrateToPeopleShape, personAt, unassignedPeople, assignedRoleCount,
   defaultWizardState, assembleConfig, stepSequence, ...) attaches
   directly to the vm context's global object (see tools/verify-config.js's
   PROBE comment for the identical `function`-vs-`const` note) -- so this
   file calls them straight off the loaded sandbox, no PROBE wrapper
   needed (unlike the per-template engine drivers, which DO need one,
   since their own state lives in module-scope `let`/`const`, not on
   objects this file constructs itself and hands in as arguments).

   Zero dependencies.
   ====================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { buildSandbox } = require('./lib/sandbox');

const REPO_ROOT = path.join(__dirname, '..');
const WIZARD_HTML_PATH = path.join(REPO_ROOT, 'build', 'index.html');
const ROSTER_PATH = path.join(REPO_ROOT, 'game', 'roster.js');
const CFGCODEC_PATH = path.join(REPO_ROOT, 'game', 'cfgcodec.js');

/* build/index.html has exactly ONE inline <script>...</script> block (the
   pure-logic + DOM-wiring script this whole file is about) -- the two
   <script src="../game/....js"> tags load separately, below, mirroring
   the real page's own <script> order. Throws loudly on a shape mismatch
   (zero or 2+ inline blocks) rather than silently grabbing the wrong one
   -- same "fail loud on a structural assumption" discipline
   tools/generate.js's safeReplace() documents for its own shell-string
   assumptions. */
function extractInlineScript(html){
  const matches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if(matches.length !== 1){
    throw new Error('expected exactly one inline <script> block in build/index.html, found ' + matches.length + ' -- has the file changed shape?');
  }
  return matches[0][1];
}

function loadWizard(){
  const html = fs.readFileSync(WIZARD_HTML_PATH, 'utf8');
  const inline = extractInlineScript(html);
  const rosterSrc = fs.readFileSync(ROSTER_PATH, 'utf8');
  const cfgcodecSrc = fs.readFileSync(CFGCODEC_PATH, 'utf8');
  // roster.js MUST precede cfgcodec.js (cfgcodec.js's CFG_CAST_ENTRY_FIELDS
  // reads the ROSTER_KEYS global at top-level eval time -- see that file's
  // own comment); both precede the inline script, mirroring build/
  // index.html's own <script> order.
  const combined = rosterSrc + '\n' + cfgcodecSrc + '\n' + inline;
  const sandbox = buildSandbox({ network: 'fail', currentScriptSrc: 'https://example.test/build/index.html' });
  const ctx = vm.createContext(sandbox);
  const script = new vm.Script(combined, { filename: 'verify-wizard-generated.js' });
  script.runInContext(ctx);
  return sandbox;
}

const results = []; // { label, ok, detail }
function record(label, ok, detail){
  results.push({ label, ok, detail: detail || '' });
  console.log((ok ? 'PASS' : 'FAIL') + ': ' + label + (detail ? ' -- ' + detail : ''));
}

/* ----------------------------------------------------------------------
   test fixtures
   ---------------------------------------------------------------------- */
/* a fully-populated v2 state: 6 people, 4 of the 6 assign slots filled
   (host + 3 roles), 2 people left unassigned (-> diner0 + 1 extra) --
   exercises every branch of buildOverridesFromState's compile-down (host,
   3 cast roles present, 2 cast roles null, diner0, extras) in one state,
   per template. `template`-specific content fields (stories/targets/
   beats+hazards/defending+waves/mission+swarms) are filled in too, so the
   SAME state also round-trips cleanly through assembleConfig. */
function buildFullState(sb, template){
  const state = sb.defaultWizardState();
  state.template = template;
  state.people = [
    { name: 'Alex', sprite: 'plain', quotes: ['I am the host.', 'Second host quote.', ''], anecdote: 'Hosts everything.' },
    { name: 'Bob', sprite: 'grandma', quotes: ['Heckle-pool quote.', '', ''], anecdote: 'Judges harshly.' },
    { name: 'Cami', sprite: 'beard', quotes: ['Quirk-pool quote.', '', ''], anecdote: 'Storms in.' },
    { name: 'Dee', sprite: 'vest', quotes: ['Saves the day.', '', ''], anecdote: 'Shows up.' },
    { name: 'Evan', sprite: null, quotes: ['I am unassigned.', '', ''], anecdote: '' },
    { name: 'Fay', sprite: null, quotes: ['I am also unassigned.', '', ''], anecdote: '' },
  ];
  state.assign = { host: 0, critic: 1, boss: 2, savior: 3, butterfingers: null, builder: null };
  state.roleLines = { critic: 'Custom heckle line', boss: 'Custom quirk line' };
  state.catchphrase = 'CATCHPHRASE.';
  state.title = 'Test Title';
  state.offLimits = '';
  state.stories = [ { l1: 'A story line.', l2: '' }, { l1: 'Another story.', l2: '' } ];
  state.targets = ['Target one', 'Target two', 'Target three', 'Target four'];
  state.beats = ['Leg one.', 'Leg two.', 'Leg three.'];
  state.hazards = ['Hazard one', 'Hazard two'];
  state.defending = 'The couch';
  state.waves = ['Wave one', 'Wave two', 'Wave three'];
  state.mission = 'Find the taco';
  state.swarms = ['Swarm one', 'Swarm two'];
  state.vibe = 'warm';
  return state;
}

function buildOldRoleKeyedDraft(withTemplate){
  const draft = {
    host: 'Jordan', otherFriendName: 'Casey',
    hostSprite: 'plain', otherFriendSprite: 'villager',
    catchphrase: 'SO TRUE.', title: 'The Test Group',
    step: 3,
    cast: {
      critic: { cast: true, name: 'Bob', anecdote: 'Judges.', sprite: 'grandma', heckle: 'Call that aim?' },
      boss: { cast: false, name: '', anecdote: '', sprite: null, quirk: '' },
      savior: { cast: true, name: 'Dee', anecdote: 'Saves.', sprite: null },
      butterfingers: { cast: false, name: '', anecdote: '', sprite: null },
      builder: { cast: true, name: 'Riley', anecdote: 'Builds.', sprite: null },
    },
    vibe: 'warm',
  };
  if(withTemplate) draft.template = 'hangout';
  return draft;
}

/* ----------------------------------------------------------------------
   1. MIGRATION MATRIX -- pre-Gallery draft, role-keyed (post-Gallery)
      draft, v2 draft. Never crashes, never drops a typed name.
   ---------------------------------------------------------------------- */
function checkMigration(sb){
  for(const [label, draft] of [
    ['pre-Gallery draft (no `template` key at all)', buildOldRoleKeyedDraft(false)],
    ['role-keyed draft (has `template`, old cast shape)', buildOldRoleKeyedDraft(true)],
  ]){
    try{
      const out = sb.normalizeWizardState(draft);
      const errors = [];
      if(!Array.isArray(out.people) || out.people.length < 3 || out.people.length > 6) errors.push('people array not 3-6 long: ' + JSON.stringify(out.people && out.people.length));
      if(typeof out.assign !== 'object' || out.assign === null) errors.push('assign missing/not an object');
      const hostPerson = out.people[out.assign.host];
      if(!hostPerson || hostPerson.name !== 'Jordan') errors.push('host (Jordan) not migrated to person 0/assign.host -- got ' + JSON.stringify(hostPerson));
      const bobIdx = out.people.findIndex(p => p.name === 'Bob');
      if(bobIdx === -1 || out.assign.critic !== bobIdx) errors.push('critic (Bob) not migrated correctly -- people=' + JSON.stringify(out.people.map(p=>p.name)) + ' assign=' + JSON.stringify(out.assign));
      if(out.roleLines.critic !== 'Call that aim?') errors.push('critic heckle line not carried into roleLines.critic -- got ' + JSON.stringify(out.roleLines));
      const deeIdx = out.people.findIndex(p => p.name === 'Dee');
      if(deeIdx === -1 || out.assign.savior !== deeIdx) errors.push('savior (Dee) not migrated correctly');
      const rileyIdx = out.people.findIndex(p => p.name === 'Riley');
      if(rileyIdx === -1 || out.assign.builder !== rileyIdx) errors.push('builder (Riley) not migrated correctly');
      if(out.assign.boss !== null) errors.push('uncast boss role should stay unassigned (null), got ' + out.assign.boss);
      const caseyIdx = out.people.findIndex(p => p.name === 'Casey');
      if(caseyIdx === -1) errors.push('otherFriendName (Casey) was dropped entirely');
      else {
        const caseyAssigned = Object.keys(out.assign).some(k => out.assign[k] === caseyIdx);
        if(caseyAssigned) errors.push('otherFriendName (Casey) should be UNASSIGNED (becomes diner0/extras downstream), but ended up assigned to a role');
      }
      if(out.step !== 0) errors.push('migrated draft should reset to step 0, got ' + out.step);
      record('migration: ' + label, errors.length === 0, errors.join('; '));
    }catch(e){
      record('migration: ' + label, false, 'threw: ' + (e && e.stack ? e.stack : e));
    }
  }

  // v2 (already-migrated) draft round-trips as v2 -- same people/assign
  // survive a normalizeWizardState pass unchanged in substance (order,
  // names, indices).
  try{
    const full = buildFullState(sb, 'hangout');
    const out = sb.normalizeWizardState(full);
    const names = out.people.map(p => p.name);
    const expectedNames = full.people.map(p => p.name);
    const namesMatch = JSON.stringify(names) === JSON.stringify(expectedNames);
    const assignMatch = JSON.stringify(out.assign) === JSON.stringify(full.assign);
    record('migration: v2 draft round-trips as v2', namesMatch && assignMatch,
      namesMatch && assignMatch ? '' : ('names=' + JSON.stringify(names) + ' assign=' + JSON.stringify(out.assign)));
  }catch(e){
    record('migration: v2 draft round-trips as v2', false, 'threw: ' + (e && e.stack ? e.stack : e));
  }

  // never crashes on garbage/absent input, and always returns a
  // structurally valid v2 state.
  const garbageCases = [null, undefined, {}, { people: 'not an array', assign: 42 }, { cast: 'garbage', host: 12345 }, 'a whole string, not an object', 7];
  let garbageOk = true, garbageDetail = '';
  for(const g of garbageCases){
    try{
      const out = sb.normalizeWizardState(g);
      if(!out || !Array.isArray(out.people) || out.people.length < 3 || out.people.length > 6 || !out.assign){
        garbageOk = false; garbageDetail = 'bad shape for input ' + JSON.stringify(g) + ': ' + JSON.stringify(out && { peopleLen: out.people && out.people.length, assign: out.assign });
        break;
      }
    }catch(e){
      garbageOk = false; garbageDetail = 'threw on input ' + JSON.stringify(g) + ': ' + (e && e.stack ? e.stack : e);
      break;
    }
  }
  record('migration: never crashes on garbage/absent input', garbageOk, garbageDetail);
}

/* ----------------------------------------------------------------------
   2. COMPILE-DOWN per template -- buildOverridesFromState on the same
      fully-populated state (see buildFullState), once per template.
   ---------------------------------------------------------------------- */
function checkCompileDown(sb){
  const CFG_KEY_FOR_ROLE = { critic: 'judge', boss: 'authority', savior: 'savior', butterfingers: 'butterfingers', builder: 'builder' };
  for(const template of ['hangout', 'gallery', 'flight', 'defense', 'mission']){
    try{
      const state = buildFullState(sb, template);
      const overrides = sb.buildOverridesFromState(state);
      const errors = [];
      if(overrides.template !== (template === 'hangout' ? undefined : template)) errors.push('template mismatch: ' + JSON.stringify(overrides.template));
      if(overrides.host.name !== 'ALEX') errors.push('host.name: ' + JSON.stringify(overrides.host.name));
      if(!overrides.host.quotes || overrides.host.quotes[0] !== 'I AM THE HOST.') errors.push('host.quotes: ' + JSON.stringify(overrides.host.quotes));
      if(overrides.cast.judge.name !== 'BOB') errors.push('cast.judge.name (critic->judge): ' + JSON.stringify(overrides.cast.judge));
      if(!overrides.cast.judge.quotes || overrides.cast.judge.quotes[0] !== 'HECKLE-POOL QUOTE.') errors.push('cast.judge.quotes: ' + JSON.stringify(overrides.cast.judge && overrides.cast.judge.quotes));
      if(overrides.cast.authority.name !== 'CAMI') errors.push('cast.authority.name (boss->authority): ' + JSON.stringify(overrides.cast.authority));
      if(overrides.cast.savior.name !== 'DEE') errors.push('cast.savior.name: ' + JSON.stringify(overrides.cast.savior));
      if(overrides.cast.butterfingers !== null) errors.push('cast.butterfingers should be null (unassigned role): ' + JSON.stringify(overrides.cast.butterfingers));
      if(overrides.cast.builder !== null) errors.push('cast.builder should be null (unassigned role): ' + JSON.stringify(overrides.cast.builder));
      if(overrides.cast.diner0.name !== 'EVAN') errors.push('cast.diner0.name (first unassigned person): ' + JSON.stringify(overrides.cast.diner0));
      if(!overrides.cast.diner0.quotes || overrides.cast.diner0.quotes[0] !== 'I AM UNASSIGNED.') errors.push('cast.diner0.quotes: ' + JSON.stringify(overrides.cast.diner0 && overrides.cast.diner0.quotes));
      if(!overrides.extras || overrides.extras.length !== 1 || overrides.extras[0].name !== 'FAY') errors.push('extras[] (2nd unassigned person): ' + JSON.stringify(overrides.extras));
      if(template === 'hangout'){
        if(!overrides.judge || overrides.judge.title !== 'BOB') errors.push('hangout judge.title (boss slot reads as the real person): ' + JSON.stringify(overrides.judge));
        if(!overrides.authority || overrides.authority.cardTitle !== 'CAMI HAS ARRIVED') errors.push('hangout authority.cardTitle: ' + JSON.stringify(overrides.authority));
      } else {
        const bucket = overrides[template];
        if(!bucket || bucket.firstBossHeckle !== 'CUSTOM HECKLE LINE') errors.push(template + '.firstBossHeckle (from state.roleLines.critic): ' + JSON.stringify(bucket));
        if(!bucket || bucket.finalBossQuirk !== 'CUSTOM QUIRK LINE') errors.push(template + '.finalBossQuirk (from state.roleLines.boss): ' + JSON.stringify(bucket));
      }
      // full assembleConfig integration -- proves the compiled overrides
      // also survive cfgSanitizeConfig/cfgDeepMerge/cfgBuildDefaultConfig
      // (the exact same pipeline a real preview/share link runs through),
      // not just that buildOverridesFromState's own return value looks
      // right in isolation.
      const assembled = sb.assembleConfig(state, 'https://example.test/');
      if(assembled.merged.host.name !== 'ALEX') errors.push('assembleConfig merged.host.name: ' + JSON.stringify(assembled.merged.host.name));
      record('compile-down: ' + template, errors.length === 0, errors.join('; '));
    }catch(e){
      record('compile-down: ' + template, false, 'threw: ' + (e && e.stack ? e.stack : e));
    }
  }
}

/* ----------------------------------------------------------------------
   3. OVERFLOW GATE -- the pure-logic condition renderStepPreview's own
      blocking message (build/index.html, DOM-wiring section) reads:
      unassignedPeople(state).slice(3) is the "won't fit" list (only
      diner0 + 2 extras -- 3 people -- ever compile in unassigned).
   ---------------------------------------------------------------------- */
function checkOverflowGate(sb){
  try{
    const state = sb.defaultWizardState();
    state.people = [
      { name:'A', sprite:null, quotes:['','',''], anecdote:'' },
      { name:'B', sprite:null, quotes:['','',''], anecdote:'' },
      { name:'C', sprite:null, quotes:['','',''], anecdote:'' },
      { name:'D', sprite:null, quotes:['','',''], anecdote:'' },
      { name:'E', sprite:null, quotes:['','',''], anecdote:'' },
      { name:'F', sprite:null, quotes:['','',''], anecdote:'' },
    ];
    state.assign = { host:0, critic:null, boss:null, savior:null, butterfingers:null, builder:null };
    const unassigned = sb.unassignedPeople(state);
    const overflow = unassigned.slice(3);
    const ok1 = unassigned.length === 5 && overflow.length === 2;
    record('overflow gate: 6 people, only host assigned -> 2 people overflow', ok1, ok1 ? '' : ('unassigned=' + unassigned.length + ' overflow=' + overflow.length));

    state.assign = { host:0, critic:1, boss:2, savior:3, butterfingers:null, builder:null };
    const unassigned2 = sb.unassignedPeople(state);
    const overflow2 = unassigned2.slice(3);
    const ok2 = unassigned2.length === 2 && overflow2.length === 0;
    record('overflow gate: 6 people, 4 roles assigned -> no overflow (fits diner0+1 extra)', ok2, ok2 ? '' : ('unassigned=' + unassigned2.length + ' overflow=' + overflow2.length));
  }catch(e){
    record('overflow gate', false, 'threw: ' + (e && e.stack ? e.stack : e));
  }
}

/* ----------------------------------------------------------------------
   4. off-limits check covers people names/quotes/anecdotes + role lines
   ---------------------------------------------------------------------- */
function checkOffLimits(sb){
  try{
    const state = buildFullState(sb, 'hangout');
    state.offLimits = 'heckle-pool';
    const violations = sb.checkStateForbidden(state);
    const ok = violations.length > 0 && violations.some(v => /HECKLE-POOL/.test(v));
    record('off-limits check scans person quotes', ok, ok ? '' : JSON.stringify(violations));
  }catch(e){
    record('off-limits check scans person quotes', false, 'threw: ' + (e && e.stack ? e.stack : e));
  }
}

function main(){
  let sb;
  try{
    sb = loadWizard();
  }catch(e){
    record('load build/index.html into the vm sandbox', false, 'threw: ' + (e && e.stack ? e.stack : e));
    console.log('');
    console.log('1 checks, 0 passed, 1 failed.');
    process.exit(1);
  }
  checkMigration(sb);
  checkCompileDown(sb);
  checkOverflowGate(sb);
  checkOffLimits(sb);

  const failed = results.filter(r => !r.ok);
  console.log('');
  console.log(results.length + ' checks, ' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed.');
  process.exit(failed.length ? 1 : 0);
}

if(require.main === module) main();

module.exports = {
  loadWizard, checkMigration, checkCompileDown, checkOverflowGate, checkOffLimits, buildFullState, buildOldRoleKeyedDraft,
  // tools/verify-skeletons.js merges this array into its own `results` so
  // one wizard check failing actually fails that file's own overall exit
  // code/tally, not just this file's own standalone run -- see its
  // checkWizard()'s own comment. A live reference (not a snapshot): every
  // record() call above keeps mutating the SAME array object this exports.
  results,
};
