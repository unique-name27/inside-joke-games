#!/usr/bin/env node
'use strict';
/* ======================================================================
   tools/generate.js -- turns a user's INTAKE.md answers into a deployed
   games/<slug>/ folder, automatically. Zero dependencies (only Node
   builtins: fs, path, crypto).

     node tools/generate.js <answers.json> [--out=games] [--base-url=https://example.github.io/inside-joke-games] [--slug=<name>]

   What it does, in order:
   1. Reads and structurally validates the answers file (see
      tools/README.md for the exact schema, tools/example-answers.json
      for a worked example -- the-test group content, in this schema).
   2. Builds a CONFIG object: cfgBuildDefaultConfig() (game/cfgcodec.js,
      the SAME neutral template a URL-fragment game merges onto) is the
      base, deep-merged with the user's answers via cfgDeepMerge (also
      from cfgcodec.js -- Part 1's codec, reused rather than duplicated).
      This is genuine automation of STRUCTURE (names, stories, title,
      catchphrase, cast, forbidden words) -- the supporting dialogue
      lines (critique lines, entrance lines, epilogue captions, etc.)
      reuse cfgBuildDefaultConfig's own generic-but-complete, tone-gate-
      clean template text rather than attempting bespoke joke-writing in
      a dependency-free script. FULFILLMENT.md's human-operator playbook
      (hand-written dialogue per order) remains the path to bespoke
      wit; this CLI automates everything up to that.
   3. AUTO-VERIFIES the assembled config with tools/verify-config.js
      (syntax + a full generic playthrough through whatever roles got
      cast + the tone gate) BEFORE writing anything -- a failing config
      never reaches disk; the script exits non-zero with a readable
      error instead.
   4. Writes games/<slug>/config.js + the three shell HTML pages, copied
      from games/test-group/'s own CURRENT files (read fresh off disk,
      not a stale hardcoded template) with only the per-page <title> and
      script-src depth already being sibling-relative, exactly the
      Phase-C pattern documented in README.md "How games are added".
   5. Prints the shareable fragment link (game/cfgcodec.js's
      cfgEncodeConfigFragment -- an INSTANT, deployment-free way to play
      the exact same game) alongside the hosted games/<slug>/ URL -- "an
      order can be fulfilled EITHER as a hosted folder or an instant
      link."
   ====================================================================== */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO_ROOT = path.join(__dirname, '..');
const {
  cfgBuildDefaultConfig, cfgDeepMerge, cfgEncodeConfigFragment, cfgApplyMusicVibe, CFG_VIBE_KEYS, CFG_SCENE_KEYS, CFG_ROSTER_KEYS,
} = require(path.join(REPO_ROOT, 'game', 'cfgcodec.js'));
const { verifyConfigSource } = require('./verify-config.js');
const { verifyGallerySource } = require('./verify-gallery.js');
const { verifyFlightSource } = require('./verify-flight.js');
const { verifyDefenseSource } = require('./verify-defense.js');
const { verifyMissionSource } = require('./verify-mission.js');

/* ---------------------------------------------------------------------
   CLI args
   --------------------------------------------------------------------- */
function parseArgs(argv){
  const args = { _: [] };
  for(const a of argv){
    const m = /^--([^=]+)=(.*)$/.exec(a);
    if(m) args[m[1]] = m[2];
    else args._.push(a);
  }
  return args;
}

/* ---------------------------------------------------------------------
   Q1-Q12 answers -> CONFIG overrides
   --------------------------------------------------------------------- */
const ROLE_KEY = { critic: 'judge', boss: 'authority', savior: 'savior', butterfingers: 'butterfingers', builder: 'builder' };
const DEFAULT_SPRITE = {
  diner0: { spriteCol: 1, spriteRow: 7 },
  judge: { spriteCol: 4, spriteRow: 8 },
  butterfingers: { spriteCol: 3, spriteRow: 8 },
  builder: { spriteCol: 2, spriteRow: 8 },
};
// PHASE M: the vibe -> full 6-slot track SET mapping (CFG_VIBE_TRACK_SETS)
// and its resolver (cfgApplyMusicVibe, which also handles "no vibe picked"
// via a deterministic per-gameId hash rotation) both live in
// game/cfgcodec.js -- the single source of truth shared with the fragment
// codec's own load path and the /build/ wizard, applied below in main()
// once `merged` exists (cfgApplyMusicVibe mutates merged.music.loops
// in place, same call shape as the other two callers).

function requireField(answers, field, hint){
  const v = answers[field];
  if(v === undefined || v === null || (typeof v === 'string' && v.trim() === '')){
    throw new GenerateError('answers.' + field + ' is required' + (hint ? ' (' + hint + ')' : ''));
  }
  return v;
}

class GenerateError extends Error {}

/* naive uppercase word-wrap into at most 2 lines, each capped at ~36
   chars to stay comfortably inside the pixel-font layout the existing
   configs use -- long overflow is dropped rather than producing a 3rd/4th
   line no phase ever reads. */
function wrapStoryLine(raw, maxLineLen, maxLines){
  maxLineLen = maxLineLen || 36;
  maxLines = maxLines || 2;
  const words = String(raw).trim().toUpperCase().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  const lines = [];
  let cur = '';
  for(const w of words){
    if(lines.length >= maxLines) break;
    const candidate = cur ? cur + ' ' + w : w;
    if(candidate.length > maxLineLen){
      if(cur) lines.push(cur);
      cur = w.length > maxLineLen ? w.slice(0, maxLineLen) : w;
      if(lines.length >= maxLines){ cur=''; break; }
    } else {
      cur = candidate;
    }
  }
  if(cur && lines.length < maxLines) lines.push(cur);
  return lines.length ? lines : ['...'];
}

/* title.lockupLines wants roughly-BALANCED short lines (e.g. test-group's
   own ['THE TEST','GROUP']) rather than greedily packing every word onto
   line 1 -- splits at the word-count
   midpoint when there's more than one word, each line still capped at
   maxLineLen as a hard backstop. */
function wrapTitleLines(raw, maxLineLen, maxLines){
  maxLineLen = maxLineLen || 14;
  maxLines = maxLines || 2;
  const words = String(raw).trim().toUpperCase().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if(words.length <= 1) return wrapStoryLine(raw, maxLineLen, maxLines);
  const mid = Math.ceil(words.length / 2);
  const line1 = words.slice(0, mid).join(' ');
  const line2 = words.slice(mid).join(' ');
  const lines = [line1, line2].filter(Boolean).slice(0, maxLines);
  return lines.map(l => l.length > maxLineLen ? l.slice(0, maxLineLen) : l);
}

/* THE FLIGHT (template #3): trip beats keep the group's TYPED case (see
   SPEC-flight.md's wizard bullet -- "beats keep typed case, hazards
   uppercase like targets") -- they read as the breather's narrated prose,
   not a shouty plaque label, so this is the one text field in this whole
   ALL-CAPS-by-convention pipeline that deliberately does NOT uppercase.
   Still collapses whitespace and caps length, same as every other field. */
function wrapLineKeepCase(raw, maxLen){
  return String(raw).trim().replace(/\s+/g, ' ').slice(0, maxLen);
}
const FLIGHT_PLANE_COLORS = ['yellow', 'red', 'blue', 'green'];
const MISSION_SHIP_COLORS = ['blue', 'green', 'orange', 'red'];

function slugify(title){
  return String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'game';
}
function randomSuffix(){
  return crypto.randomBytes(3).toString('hex'); // 6 hex chars -- "obscure, not secured" per FULFILLMENT.md's Privacy note
}

/* builds the CONFIG override object from answers.json -- NOT run through
   cfgSanitizeConfig's fragment whitelist (that schema deliberately
   excludes gameId/music, which a FILE-based deployment legitimately
   needs to set) -- answers.json is trusted local/operator input, not an
   untrusted URL.

   THE GALLERY (template #2) / THE FLIGHT (template #3) / THE DEFENSE
   (template #4): `answers.template` switches the whole content shape --
   gallery gets `answers.targets` (4-8 short labels), flight gets
   `answers.beats` (3-6 trip legs) + `answers.hazards` (2-6 short labels) +
   `answers.planeColor`, defense gets `answers.defending` (THE THING's
   plaque label) + `answers.waves` (3-6 wave labels), hangout gets
   `answers.stories`; none of gallery/flight/defense read `answers.scene`
   (none has a scene skeleton), and all three get the two optional boss
   lines (`answers.firstBossHeckle`/`finalBossQuirk`) instead of judge.
   title/authority.cardTitle content blocks (gallery/engine.js, flight/
   engine.js, and defense/engine.js each build their own boss-card/banner/
   tower-label titles straight from CAST.judge.name/CAST.authority.name --
   see any of those files' headers). Every other answer (host/catchphrase/
   title/cast/anecdotes/offLimits/spellings/music) is read identically
   across all four -- same shared-fields principle SPEC-gallery.md's/
   SPEC-flight.md's/SPEC-defense.md's config sections all state. */
function buildOverrides(answers, slug){
  const host = requireField(answers, 'host', 'Q6: who is the host?');
  const catchphrase = requireField(answers, 'catchphrase', 'Q3: what\'s your group\'s catchphrase?');
  const title = requireField(answers, 'title', 'Q5: what should we call your game?');
  const isGallery = answers.template === 'gallery';
  const isFlight = answers.template === 'flight';
  const isDefense = answers.template === 'defense';
  const isMission = answers.template === 'mission';

  const overrides = {
    gameId: slug,
    // absent -> cfgBuildDefaultConfig's own 'hangout' default; a five-way
    // pick now (THE MISSION is template #5, see SPEC-mission.md).
    template: isGallery ? 'gallery' : (isFlight ? 'flight' : (isDefense ? 'defense' : (isMission ? 'mission' : undefined))),
    title: {
      lockupLines: wrapTitleLines(title, 14, 2),
      introPageTitle: String(title),
      gamePageTitle: String(title) + ' -- Playable Demo',
    },
    punchline: String(catchphrase).toUpperCase().slice(0, 40),
    host: { name: String(host).toUpperCase().slice(0, 40) },
    cast: { diner0: Object.assign({ name: 'THE FOURTH FRIEND', anecdote: 'Always up for anything.' }, DEFAULT_SPRITE.diner0) },
  };

  if(isGallery){
    const targetsIn = requireField(answers, 'targets', 'Gallery Q4: 4-8 things your group can\'t stop roasting, as an array of strings');
    if(!Array.isArray(targetsIn) || targetsIn.length < 4) throw new GenerateError('answers.targets must be an array of at least 4 strings (gallery.targets wants 4-8)');
    overrides.gallery = { targets: targetsIn.slice(0, 8).map(t => String(t).toUpperCase().trim().replace(/\s+/g,' ').slice(0, 24)) };
    if(answers.firstBossHeckle) overrides.gallery.firstBossHeckle = String(answers.firstBossHeckle).toUpperCase().trim().slice(0, 60);
    if(answers.finalBossQuirk) overrides.gallery.finalBossQuirk = String(answers.finalBossQuirk).toUpperCase().trim().slice(0, 60);
  } else if(isFlight){
    // THE FLIGHT (template #3, see SPEC-flight.md's config/codec/wizard
    // section) -- beats/hazards instead of stories/targets, no `scene`
    // (the flight has no scene skeleton either, same as the gallery).
    const beatsIn = requireField(answers, 'beats', 'Flight Q4: 3-6 trip legs, in order, as an array of strings');
    if(!Array.isArray(beatsIn) || beatsIn.length < 3) throw new GenerateError('answers.beats must be an array of at least 3 strings (flight.beats wants 3-6)');
    const hazardsIn = requireField(answers, 'hazards', 'Flight Q4b: 2-6 short hazard labels, as an array of strings');
    if(!Array.isArray(hazardsIn) || hazardsIn.length < 2) throw new GenerateError('answers.hazards must be an array of at least 2 strings (flight.hazards wants 2-6)');
    overrides.flight = {
      beats: beatsIn.slice(0, 6).map(b => wrapLineKeepCase(b, 90)),
      hazards: hazardsIn.slice(0, 6).map(h => String(h).toUpperCase().trim().replace(/\s+/g, ' ').slice(0, 24)),
      planeColor: FLIGHT_PLANE_COLORS.indexOf(answers.planeColor) !== -1 ? answers.planeColor : 'yellow',
    };
    if(answers.firstBossHeckle) overrides.flight.firstBossHeckle = String(answers.firstBossHeckle).toUpperCase().trim().slice(0, 60);
    if(answers.finalBossQuirk) overrides.flight.finalBossQuirk = String(answers.finalBossQuirk).toUpperCase().trim().slice(0, 60);
  } else if(isDefense){
    // THE DEFENSE (template #4, see SPEC-defense.md's config/codec/wizard
    // section) -- defending + waves instead of stories/targets/beats, no
    // `scene` (the defense has no scene skeleton either). Both fields
    // uppercase like the gallery's targets (this template has no "keep
    // typed case" field the way the flight's beats do -- every defense
    // label is a shouted plaque/banner).
    const defendingIn = requireField(answers, 'defending', 'Defense Q4: what does your group defend? (a short label, THE THING\'s plaque)');
    const wavesIn = requireField(answers, 'waves', 'Defense Q4b: 3-6 short labels for what keeps coming, as an array of strings');
    if(!Array.isArray(wavesIn) || wavesIn.length < 3) throw new GenerateError('answers.waves must be an array of at least 3 strings (defense.waves wants 3-6)');
    overrides.defense = {
      defending: String(defendingIn).toUpperCase().trim().replace(/\s+/g, ' ').slice(0, 24),
      waves: wavesIn.slice(0, 6).map(w => String(w).toUpperCase().trim().replace(/\s+/g, ' ').slice(0, 24)),
    };
    if(answers.firstBossHeckle) overrides.defense.firstBossHeckle = String(answers.firstBossHeckle).toUpperCase().trim().slice(0, 60);
    if(answers.finalBossQuirk) overrides.defense.finalBossQuirk = String(answers.finalBossQuirk).toUpperCase().trim().slice(0, 60);
  } else if(isMission){
    // THE MISSION (template #5, see SPEC-mission.md's config/codec/wizard
    // section) -- mission + swarms instead of stories/targets/beats/
    // defending+waves, no `scene` (the mission has no scene skeleton
    // either). Both fields uppercase like the defense's own (this template
    // has no "keep typed case" field the way the flight's beats do -- the
    // mission line is a shouted banner, not narrated prose).
    const missionIn = requireField(answers, 'mission', 'Mission Q4: what\'s the mission? (a short banner line, the sillier the better)');
    const swarmsIn = requireField(answers, 'swarms', 'Mission Q4b: 2-6 short labels for what you\'re up against, as an array of strings');
    if(!Array.isArray(swarmsIn) || swarmsIn.length < 2) throw new GenerateError('answers.swarms must be an array of at least 2 strings (mission.swarms wants 2-6)');
    overrides.mission = {
      mission: String(missionIn).toUpperCase().trim().replace(/\s+/g, ' ').slice(0, 40),
      swarms: swarmsIn.slice(0, 6).map(sw => String(sw).toUpperCase().trim().replace(/\s+/g, ' ').slice(0, 24)),
      shipColor: MISSION_SHIP_COLORS.indexOf(answers.shipColor) !== -1 ? answers.shipColor : 'blue',
    };
    if(answers.firstBossHeckle) overrides.mission.firstBossHeckle = String(answers.firstBossHeckle).toUpperCase().trim().slice(0, 60);
    if(answers.finalBossQuirk) overrides.mission.finalBossQuirk = String(answers.finalBossQuirk).toUpperCase().trim().slice(0, 60);
  } else {
    const storiesIn = requireField(answers, 'stories', 'Q4: 2-4 real, boring stories, as an array of strings');
    if(!Array.isArray(storiesIn) || storiesIn.length === 0) throw new GenerateError('answers.stories must be a non-empty array of strings');
    // STORY SKELETONS: optional, defaults to 'dinner' -- see SPEC-skeletons.md
    // / game/skeletons.js. CFG_SCENE_KEYS (game/cfgcodec.js) is the single
    // source of truth for the four valid keys, shared with the fragment
    // schema and the /build/ wizard, so this can never drift out of sync
    // with what the engine actually knows how to resolve.
    const scene = answers.scene === undefined || answers.scene === null || answers.scene === '' ? 'dinner' : answers.scene;
    if(CFG_SCENE_KEYS.indexOf(scene) === -1){
      throw new GenerateError('answers.scene must be one of: ' + CFG_SCENE_KEYS.join(', ') + ' (got "' + scene + '")');
    }
    overrides.scene = scene;
    overrides.lengthPreset = answers.lengthPreset === 'full' ? 'full' : 'five_min';
    overrides.stories = storiesIn.slice(0, 4).map(s => ({ lines: wrapStoryLine(s) }));
  }

  // PHASE C (characters are their people) -- OPTIONAL: answers.hostSprite is
  // a game/roster.js key ("which tile is the host?"); unset/unrecognized
  // silently no-ops (host keeps its default 'plain' roster tile, same as always --
  // see game/roster.js's rosterResolveSprite for the exact precedence).
  // Not part of tools/README.md's required schema -- this CLI's answers.json
  // predates the roster and every existing answers file keeps working
  // byte-identically without ever setting this.
  if(answers.hostSprite && CFG_ROSTER_KEYS.indexOf(answers.hostSprite) !== -1){
    overrides.host.sprite = answers.hostSprite;
  }

  // the tone gate is entirely per-group -- no baseline/universal word list
  // (see tools/verify-config.js's toneGateSource) -- so this order's own
  // Q11 answer IS the whole forbiddenWords list. Nothing off-limits ->
  // forbiddenWords: [], by design.
  const offLimits = Array.isArray(answers.offLimits) ? answers.offLimits.map(String) : [];
  overrides.forbiddenWords = offLimits.map(w => w.toUpperCase());

  const cast = answers.cast || {};
  const anecdotes = answers.anecdotes || {};
  for(const introKey in ROLE_KEY){
    const cfgKey = ROLE_KEY[introKey];
    const name = cast[introKey];
    if(name){
      const entry = { name: String(name).toUpperCase().slice(0, 40) };
      if(anecdotes[introKey]) entry.anecdote = String(anecdotes[introKey]).slice(0, 160);
      if(DEFAULT_SPRITE[cfgKey]) Object.assign(entry, DEFAULT_SPRITE[cfgKey]);
      // PHASE C -- OPTIONAL: answers.spriteCast[introKey] is a game/roster.js
      // key; wins over the DEFAULT_SPRITE col/row above (rosterResolveSprite's
      // precedence -- see game/roster.js), same "unset/unrecognized no-ops"
      // convention as hostSprite just above.
      const spriteCast = answers.spriteCast || {};
      if(spriteCast[introKey] && CFG_ROSTER_KEYS.indexOf(spriteCast[introKey]) !== -1){
        entry.sprite = spriteCast[introKey];
      }
      overrides.cast[cfgKey] = entry;
      if(!isGallery && !isFlight && !isDefense && !isMission){
        // BOSS SLOTS (Hangout only -- see this function's own header): the
        // boss HP bar / entrance card reads the actual person's name, not
        // cfgBuildDefaultConfig's generic "THE CRITIC"/"THE BOSS HAS
        // ARRIVED" fallback text -- entry.name is already uppercase above,
        // matching the "'<NAME> HAS ARRIVED'" pattern (see FULFILLMENT.md's
        // "Boss slots read as real people"). This written-to-file config.js
        // path doesn't run through cfgSanitizeConfig (see this function's
        // own doc comment -- answers.json is trusted operator input), so a
        // name at the full 40-char cap plus " HAS ARRIVED" can run long
        // here; the instant #cfg= link built from the same overrides
        // further below does go through cfgEncodeConfigFragment ->
        // cfgSanitizeConfig, whose cfgStr(40) on judge.title/authority.
        // cardTitle truncates that copy safely.
        if(cfgKey === 'judge') overrides.judge = { title: entry.name };
        if(cfgKey === 'authority') overrides.authority = { cardTitle: entry.name + ' HAS ARRIVED' };
      }
    } else {
      overrides.cast[cfgKey] = null;
    }
  }

  // Q10 spellings: [{from, to}, ...] -- applied as a literal find/replace
  // pass over every string in the assembled config, AFTER the merge (see
  // applySpellings below) -- covers names quoted inside dialogue lines
  // too, not just the cast entries themselves.
  overrides.__spellings = Array.isArray(answers.spellings) ? answers.spellings.filter(s => s && s.from && s.to) : [];

  // Q9 music -- customSongPath only; the vibe -> loops resolution (now a
  // full 6-slot set, or a deterministic rotation with no vibe picked --
  // see cfgApplyMusicVibe) happens in main() below, once `merged` exists,
  // the same shape as the fragment codec's own load path.
  const music = answers.music || {};
  if(music.songFile){
    overrides.music = { customSongPath: '../assets/theme.mp3' }; // see tools/README.md -- this is the CORRECTED page-relative path (FULFILLMENT.md's existing note undercounts a directory level; fixed here and flagged in that doc)
  }

  return overrides;
}

function applySpellings(obj, spellings){
  if(!spellings || !spellings.length) return obj;
  const json = JSON.stringify(obj);
  let out = json;
  for(const { from, to } of spellings){
    // most in-game text is ALL CAPS by this project's established style
    // (see examples/roadtrip.config.js's own header comment) -- Q10's
    // answers come in as a user would naturally type them ("Kathryn not
    // Catherine"), so an uppercased pass catches that majority;
    // title.introPageTitle/gamePageTitle are the one deliberately
    // mixed-case exception (rendered as literal <title> text), so an
    // exact-case pass runs too, covering both without double-processing
    // (an already-uppercase `from` makes both passes identical, harmless).
    out = out.split(String(from).toUpperCase()).join(String(to).toUpperCase());
    out = out.split(String(from)).join(String(to));
  }
  return JSON.parse(out);
}

/* ---------------------------------------------------------------------
   config.js serialization -- JSON.stringify produces valid JS object-
   literal syntax (JSON is a syntactic subset of it), which sidesteps any
   hand-rolled-string-escaping risk entirely: a user's story text
   containing a quote or backslash can never break out of a literal the
   way naive string concatenation could. Slightly different quoting style
   from the rest of the codebase's hand-authored configs (double quotes,
   no trailing commas) -- a deliberate, documented trade: correctness
   over style-matching for machine-generated output.
   --------------------------------------------------------------------- */
function serializeConfig(configObj, headerComment){
  return "'use strict';\n" + headerComment + '\nconst CONFIG = ' + JSON.stringify(configObj, null, 2) + ';\n';
}

/* String.prototype.replace silently no-ops when `search` isn't found --
   chaining several of these blind (THE GALLERY's own two-file deploy
   block originally did exactly this) means a future edit to
   gallery/index.html's or flight/index.html's exact markup (a
   whitespace tweak, a re-quoted attribute) would silently ship a shell
   that still points at the WRONG engine/config paths, with no error
   anywhere. Both the gallery's and the flight's own deploy blocks use
   this instead: throws immediately, naming exactly which replacement
   no-op'd, so a shape mismatch between either template's index.html and
   this function fails LOUDLY at generate time -- never a
   silently-broken shipped shell. */
function safeReplace(str, search, replacement, label){
  if(str.indexOf(search) === -1){
    throw new GenerateError('template replacement "' + label + '" did not match anything -- expected to find ' + JSON.stringify(search) + ' in the source shell (has the file changed shape?)');
  }
  return str.split(search).join(replacement);
}

/* ---------------------------------------------------------------------
   main
   --------------------------------------------------------------------- */
function main(){
  const args = parseArgs(process.argv.slice(2));
  const answersPath = args._[0];
  if(!answersPath){
    console.error('Usage: node tools/generate.js <answers.json> [--out=games] [--base-url=https://<pages-domain>] [--slug=<name>]');
    process.exit(2);
  }
  const outDir = args.out || 'games';
  const baseUrl = args['base-url'] || '<PAGES_DOMAIN>';

  let answers;
  try{
    answers = JSON.parse(fs.readFileSync(path.resolve(answersPath), 'utf8'));
  }catch(e){
    console.error('Could not read/parse ' + answersPath + ': ' + e.message);
    process.exit(1);
  }

  let slug, overrides, merged, fragmentPayload;
  try{
    requireField(answers, 'email', 'Q12: delivery email');
    const titleForSlug = requireField(answers, 'title', 'Q5');
    // --slug=<name> overrides the default random-suffixed slug -- real
    // orders always take the default (a stable, guessable folder name is
    // undesirable for someone else's game); this exists for reproducible
    // checked-in examples like games/gallery-sample/ (see tools/gallery-
    // sample-answers.json), the same deterministic-naming spirit as
    // games/test-group/'s own hand-picked slug.
    slug = args.slug || (slugify(titleForSlug) + '-' + randomSuffix());
    overrides = buildOverrides(answers, slug);
    const spellings = overrides.__spellings; delete overrides.__spellings;
    const isGallery = overrides.template === 'gallery';
    const isFlight = overrides.template === 'flight';
    const isDefense = overrides.template === 'defense';
    const isMission = overrides.template === 'mission';
    // page-relative root matching this template's own shell nesting depth:
    // the Hangout writes games/<slug>/{game,intro}/ (3 levels deep -- see
    // games/test-group/config.js for the identical convention); THE
    // GALLERY, THE FLIGHT, THE DEFENSE, and THE MISSION each write a single
    // games/<slug>/index.html (2 levels deep, mirroring gallery/
    // index.html's/flight/index.html's/defense/index.html's/mission/
    // index.html's own page -- see below). `overrides.scene` picks up
    // CFG_SCENE_DEFAULTS' text overlay here, same as the wizard's own
    // assembleConfig/cfgLoadFragmentOverride; overrides (below) still wins
    // over it for anything answers.json specifies itself.
    const engineRoot = (isGallery || isFlight || isDefense || isMission) ? '../../' : '../../../';
    const base = cfgBuildDefaultConfig(engineRoot, overrides.scene, overrides.template);
    merged = cfgDeepMerge(base, overrides);
    merged = applySpellings(merged, spellings);

    // PHASE M: resolve the vibe -> full 6-slot music.loops set now that
    // `merged` exists (cfgApplyMusicVibe mutates merged.music.loops in
    // place) -- same call shape as cfgLoadFragmentOverride/the wizard's
    // assembleConfig. No vibe picked (or an unrecognized one) falls back
    // to cfgApplyMusicVibe's own deterministic per-seed rotation; the hash
    // seed here is the real gameId (`slug`) this file is about to be
    // written under, so it's stable for this order specifically.
    const pickedVibe = (answers.music || {}).vibe;
    cfgApplyMusicVibe(merged, pickedVibe, engineRoot, slug);

    // The instant #cfg= link carries the OVERRIDE DELTA, not `merged`.
    // `music` is deliberately not fragment-settable (see CFG_FRAGMENT_SCHEMA
    // -- no link may point the engine's fetch() at an arbitrary URL), so
    // encoding a config whose music lives in music.loops silently dropped
    // the user's chosen track from the link. The whitelisted `musicVibe`
    // enum is the supported way to say "use this stock track", so translate
    // the pick back into it here. A user's UPLOADED song still can't ride
    // in a link at all -- that's the hosted tier's job (noted in the output
    // below).
    fragmentPayload = applySpellings(cfgDeepMerge({}, overrides), spellings);
    delete fragmentPayload.music;
    if(pickedVibe && CFG_VIBE_KEYS.indexOf(pickedVibe) !== -1){
      fragmentPayload.musicVibe = pickedVibe;
    }
  }catch(e){
    if(e instanceof GenerateError){ console.error('Invalid answers file: ' + e.message); process.exit(1); }
    throw e;
  }

  const header = '/* ======================================================================\n' +
    '   ' + merged.title.introPageTitle.toUpperCase() + ' -- generated by tools/generate.js from ' + path.basename(answersPath) + '\n' +
    '   Do not hand-edit lightly -- re-running the generator will overwrite this\n' +
    '   file. See FULFILLMENT.md for the human-review steps this still needs\n' +
    '   before an order is actually delivered (content review is NOT automated).\n' +
    '   ====================================================================== */';
  const configSource = serializeConfig(merged, header);

  const isGallery = merged.template === 'gallery';
  const isFlight = merged.template === 'flight';
  const isDefense = merged.template === 'defense';
  const isMission = merged.template === 'mission';
  const templateLabel = isGallery ? 'gallery' : (isFlight ? 'flight' : (isDefense ? 'defense' : (isMission ? 'mission' : 'hangout')));
  console.log('Verifying generated config for "' + merged.title.introPageTitle + '" (slug: ' + slug + ', template: ' + templateLabel + ')...');
  // THE GALLERY / THE FLIGHT / THE DEFENSE / THE MISSION: each template's
  // own driver (tick/fireAt through the seeded rounds/boss/finale for the
  // gallery; tick/flap through the seeded legs/boss gate for the flight;
  // tick/priority-tap through the seeded waves/boss for the defense;
  // tick/handleAction/fireBeam through the seeded stages/ambush/flagship
  // for the mission) in place of verify-config.js's beat-by-beat one -- see
  // any of those files' own header for why.
  const verifyFn = isGallery ? verifyGallerySource : (isFlight ? verifyFlightSource : (isDefense ? verifyDefenseSource : (isMission ? verifyMissionSource : verifyConfigSource)));
  let result;
  try{
    result = verifyFn(configSource, { extraForbidden: merged.forbiddenWords });
  }catch(e){
    console.error('REFUSING TO EMIT -- generated config.js has a syntax error:');
    console.error(e.stack || e);
    process.exit(1);
  }
  if(!result.ok){
    console.error('REFUSING TO EMIT -- verification failed for "' + merged.title.introPageTitle + '":');
    for(const err of result.errors) console.error('  - ' + err);
    process.exit(1);
  }
  for(const w of result.warnings) console.log('  warning: ' + w);
  console.log('Verification passed (reached "' + result.phaseReached + '"). Cast: ' + JSON.stringify(result.flags));

  const gameDir = path.join(REPO_ROOT, outDir, slug);
  fs.mkdirSync(gameDir, { recursive: true });
  fs.writeFileSync(path.join(gameDir, 'config.js'), configSource);

  if(isGallery){
    // THE GALLERY writes ONE page (no separate intro) -- mirror gallery/
    // index.html's own current script tags verbatim (read fresh off disk,
    // same "never a stale hardcoded template" principle FULFILLMENT.md's
    // step 4 already established for the Hangout copy below), just
    // shifted one directory level deeper (games/<slug>/ vs. gallery/
    // itself) and pointed at the ONE shared gallery/engine.js rather than
    // a per-game copy -- same "shared engine, only config.js is per-game"
    // shape the Hangout path already uses. Every replacement below is
    // verified to have actually matched something (see safeReplace's own
    // header) -- these five strings MUST match gallery/index.html
    // byte-for-byte or this throws instead of silently shipping a shell
    // with the wrong paths/title (this used to be a blind `.replace()`
    // chain with no such check -- fixed to match THE FLIGHT's own block
    // just below, which never had the gap in the first place).
    try{
      let galleryShell = fs.readFileSync(path.join(REPO_ROOT, 'gallery', 'index.html'), 'utf8');
      galleryShell = safeReplace(galleryShell, '<title>The Gallery -- Playable Demo</title>', '<title>' + merged.title.gamePageTitle + '</title>', 'title');
      galleryShell = safeReplace(galleryShell, '<script src="../game/roster.js"></script>', '<script src="../../game/roster.js"></script>', 'roster.js src');
      galleryShell = safeReplace(galleryShell, '<script src="../game/cfgcodec.js"></script>', '<script src="../../game/cfgcodec.js"></script>', 'cfgcodec.js src');
      galleryShell = safeReplace(galleryShell, '<script src="../shared/framework.js"></script>', '<script src="../../shared/framework.js"></script>', 'framework.js src');
      galleryShell = safeReplace(galleryShell, '<script src="engine.js"></script>', '<script src="../../gallery/engine.js"></script>', 'engine.js src');
      fs.writeFileSync(path.join(gameDir, 'index.html'), galleryShell);
    }catch(e){
      console.error('REFUSING TO EMIT -- could not build the gallery shell for "' + merged.title.introPageTitle + '":');
      console.error('  ' + (e && e.message ? e.message : e));
      process.exit(1);
    }
  } else if(isFlight){
    // THE FLIGHT writes ONE page (no separate intro), same shape as THE
    // GALLERY above -- mirror flight/index.html's own current script tags
    // verbatim, shifted one directory level deeper and pointed at the ONE
    // shared flight/engine.js. Unlike the gallery block above, every
    // replacement here is verified to have actually matched something
    // (see safeReplace's own header) -- these five strings MUST match
    // flight/index.html byte-for-byte or this throws instead of silently
    // shipping a shell with the wrong paths/title.
    try{
      let flightShell = fs.readFileSync(path.join(REPO_ROOT, 'flight', 'index.html'), 'utf8');
      flightShell = safeReplace(flightShell, '<title>The Flight -- Playable Demo</title>', '<title>' + merged.title.gamePageTitle + '</title>', 'title');
      flightShell = safeReplace(flightShell, '<script src="../game/roster.js"></script>', '<script src="../../game/roster.js"></script>', 'roster.js src');
      flightShell = safeReplace(flightShell, '<script src="../game/cfgcodec.js"></script>', '<script src="../../game/cfgcodec.js"></script>', 'cfgcodec.js src');
      flightShell = safeReplace(flightShell, '<script src="../shared/framework.js"></script>', '<script src="../../shared/framework.js"></script>', 'framework.js src');
      flightShell = safeReplace(flightShell, '<script src="engine.js"></script>', '<script src="../../flight/engine.js"></script>', 'engine.js src');
      fs.writeFileSync(path.join(gameDir, 'index.html'), flightShell);
    }catch(e){
      console.error('REFUSING TO EMIT -- could not build the flight shell for "' + merged.title.introPageTitle + '":');
      console.error('  ' + (e && e.message ? e.message : e));
      process.exit(1);
    }
  } else if(isDefense){
    // THE DEFENSE writes ONE page (no separate intro), same shape as THE
    // GALLERY/THE FLIGHT above -- mirror defense/index.html's own current
    // script tags verbatim, shifted one directory level deeper and pointed
    // at the ONE shared defense/engine.js. Every replacement here is
    // verified to have actually matched something (see safeReplace's own
    // header) -- these five strings MUST match defense/index.html
    // byte-for-byte or this throws instead of silently shipping a shell
    // with the wrong paths/title.
    try{
      let defenseShell = fs.readFileSync(path.join(REPO_ROOT, 'defense', 'index.html'), 'utf8');
      defenseShell = safeReplace(defenseShell, '<title>The Defense -- Playable Demo</title>', '<title>' + merged.title.gamePageTitle + '</title>', 'title');
      defenseShell = safeReplace(defenseShell, '<script src="../game/roster.js"></script>', '<script src="../../game/roster.js"></script>', 'roster.js src');
      defenseShell = safeReplace(defenseShell, '<script src="../game/cfgcodec.js"></script>', '<script src="../../game/cfgcodec.js"></script>', 'cfgcodec.js src');
      defenseShell = safeReplace(defenseShell, '<script src="../shared/framework.js"></script>', '<script src="../../shared/framework.js"></script>', 'framework.js src');
      defenseShell = safeReplace(defenseShell, '<script src="engine.js"></script>', '<script src="../../defense/engine.js"></script>', 'engine.js src');
      fs.writeFileSync(path.join(gameDir, 'index.html'), defenseShell);
    }catch(e){
      console.error('REFUSING TO EMIT -- could not build the defense shell for "' + merged.title.introPageTitle + '":');
      console.error('  ' + (e && e.message ? e.message : e));
      process.exit(1);
    }
  } else if(isMission){
    // THE MISSION writes ONE page (no separate intro), same shape as THE
    // GALLERY/THE FLIGHT/THE DEFENSE above -- mirror mission/index.html's
    // own current script tags verbatim, shifted one directory level deeper
    // and pointed at the ONE shared mission/engine.js. Every replacement
    // here is verified to have actually matched something (see
    // safeReplace's own header) -- these five strings MUST match
    // mission/index.html byte-for-byte or this throws instead of silently
    // shipping a shell with the wrong paths/title.
    try{
      let missionShell = fs.readFileSync(path.join(REPO_ROOT, 'mission', 'index.html'), 'utf8');
      missionShell = safeReplace(missionShell, '<title>The Mission -- Playable Demo</title>', '<title>' + merged.title.gamePageTitle + '</title>', 'title');
      missionShell = safeReplace(missionShell, '<script src="../game/roster.js"></script>', '<script src="../../game/roster.js"></script>', 'roster.js src');
      missionShell = safeReplace(missionShell, '<script src="../game/cfgcodec.js"></script>', '<script src="../../game/cfgcodec.js"></script>', 'cfgcodec.js src');
      missionShell = safeReplace(missionShell, '<script src="../shared/framework.js"></script>', '<script src="../../shared/framework.js"></script>', 'framework.js src');
      missionShell = safeReplace(missionShell, '<script src="engine.js"></script>', '<script src="../../mission/engine.js"></script>', 'engine.js src');
      fs.writeFileSync(path.join(gameDir, 'index.html'), missionShell);
    }catch(e){
      console.error('REFUSING TO EMIT -- could not build the mission shell for "' + merged.title.introPageTitle + '":');
      console.error('  ' + (e && e.message ? e.message : e));
      process.exit(1);
    }
  } else {
    const gameSubDir = path.join(gameDir, 'game');
    const introSubDir = path.join(gameDir, 'intro');
    fs.mkdirSync(gameSubDir, { recursive: true });
    fs.mkdirSync(introSubDir, { recursive: true });
    // per FULFILLMENT.md step 4: copy games/test-group/'s CURRENT shell
    // files verbatim -- read fresh off disk (not a hardcoded template
    // string) so a future change to the shell pattern (e.g. an added
    // <script> tag) is picked up automatically the next time this CLI runs.
    const templateDir = path.join(REPO_ROOT, 'games', 'test-group');
    fs.writeFileSync(path.join(gameDir, 'index.html'),
      fs.readFileSync(path.join(templateDir, 'index.html'), 'utf8').replace(/The Test Group/g, merged.title.introPageTitle));
    fs.writeFileSync(path.join(gameSubDir, 'index.html'),
      fs.readFileSync(path.join(templateDir, 'game', 'index.html'), 'utf8').replace(/The Test Group -- Playable Demo/g, merged.title.gamePageTitle));
    fs.writeFileSync(path.join(introSubDir, 'index.html'),
      fs.readFileSync(path.join(templateDir, 'intro', 'index.html'), 'utf8').replace(/The Test Group/g, merged.title.introPageTitle));
  }

  if(answers.music && answers.music.songFile){
    const assetsDir = path.join(gameDir, 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.copyFileSync(path.resolve(answers.music.songFile), path.join(assetsDir, 'theme.mp3'));
    console.log('Copied uploaded song to ' + path.join('games', slug, 'assets', 'theme.mp3'));
  }

  const fragment = cfgEncodeConfigFragment(fragmentPayload);
  const hostedUrl = baseUrl.replace(/\/$/, '') + '/' + outDir + '/' + slug + '/';
  // THE GALLERY / THE FLIGHT / THE DEFENSE / THE MISSION: one page each, no
  // separate intro -- the instant link goes straight at /gallery/#cfg=.../
  // /flight/#cfg=.../ /defense/#cfg=.../ /mission/#cfg=..., matching
  // /build/'s own single-page preview links (see build/index.html's
  // renderStepPreview).
  const instantUrl = isGallery
    ? baseUrl.replace(/\/$/, '') + '/gallery/#cfg=' + fragment
    : isFlight
      ? baseUrl.replace(/\/$/, '') + '/flight/#cfg=' + fragment
      : isDefense
        ? baseUrl.replace(/\/$/, '') + '/defense/#cfg=' + fragment
        : isMission
          ? baseUrl.replace(/\/$/, '') + '/mission/#cfg=' + fragment
          : baseUrl.replace(/\/$/, '') + '/intro/#cfg=' + fragment;

  console.log('');
  console.log('Wrote ' + path.relative(REPO_ROOT, gameDir));
  console.log('');
  console.log('HOSTED (after this is committed + pushed):');
  console.log('  ' + hostedUrl);
  console.log('');
  console.log('INSTANT LINK (works right now, no deployment -- uses the repo\'s own shared engine):');
  console.log('  ' + instantUrl);
  console.log('  (fragment length: ' + fragment.length + ' chars' + (baseUrl === '<PAGES_DOMAIN>' ? ' -- pass --base-url=https://<your-pages-domain> for a real link' : '') + ')');
  console.log('');
  console.log('Reminder: FULFILLMENT.md step 2 (content review) is a human judgment call');
  console.log('this CLI does NOT automate -- read the user\'s free-text answers before delivering.');
}

if(require.main === module) main();

module.exports = { buildOverrides, wrapStoryLine, slugify, serializeConfig, applySpellings, GenerateError };
