'use strict';
/* ======================================================================
   game/roster.js -- PHASE C: CHARACTERS ARE THEIR PEOPLE. The character
   sprite roster: which Tiny-family tile a cast slot (or the host) can be
   pointed at, so a group's cast can LOOK like the actual people. Loaded
   as a plain global (`ROSTER`/`ROSTER_BY_KEY`/`ROSTER_KEYS`/
   `ROSTER_SHEETS`/`rosterResolveSprite`) by BOTH game/engine.js and
   intro/engine.js, before either engine script -- same dual browser/
   Node-`require` load pattern as game/skeletons.js and game/cfgcodec.js
   (see those files' own header comments), so every name here is a plain
   top-level `var`/function that becomes a global in a classic <script>,
   and also exports via `module.exports` for this file's own Node
   harnesses (tools/verify-skeletons.js) and the /build/ wizard.

   ~26 curated tiles across four Tiny-family packs (Tiny Dungeon + Tiny
   Farm + Tiny Ski + Tiny Battle -- all confirmed 16x16px/1px-gap grids;
   see intro/assets/CREDITS.txt). Tiny Town was surveyed and excluded --
   it ships zero character tiles (scenery/props only; reserved for a
   later Phase S scene). Animal Pack Remastered was also surveyed and
   excluded -- its sprites are ~128-160px portrait icons with no shared
   tile grid, not a fit alongside the Tiny family sheets. Non-human picks
   (2-4, per the round's own steer) come from what the grid-compatible
   packs actually offer: slime + spider (Tiny Dungeon), cow (Tiny Farm),
   snowman (Tiny Ski).

   ROSTER_SHEETS maps each `sheet` enum used below to the actual PNG this
   repo ships (all under intro/assets/, alongside the pre-existing
   tiny_dungeon.png -- see game/engine.js/intro/engine.js's own asset-
   loading section for how ENGINE_ROOT + this path resolves in both a
   real page and the verify harness).

   Every roster entry is ENGINE-SHIPPED, static data: {key, label, sheet,
   col, row}. `key` is the only thing a config/fragment ever carries (see
   game/cfgcodec.js's CFG_CAST_ENTRY_FIELDS.sprite / CFG_ROSTER_KEYS enum)
   -- col/row/sheet are never fragment-supplied, so there's no path-
   injection surface here at all, only a whitelisted pick among these
   fixed entries.

   rosterResolveSprite(entry, fallbackCol, fallbackRow) is the ONE shared
   resolver both engines (and the wizard's own preview) use everywhere a
   cast slot's (or CONFIG.host's) sprite needs resolving to an actual
   {sheet, col, row} to draw:
     1. entry.sprite is a valid roster key -> that entry's {sheet,col,row}
        WINS OUTRIGHT (sheet+col+row together, never partially).
     2. else entry.spriteCol/spriteRow (legacy, back-compat, always on
        the 'dungeon' sheet -- the only sheet that existed before this
        phase) -- independently defaulted, matching the exact fallback
        shape castSprite() has always had.
     3. else the caller's own fallback col/row, also on 'dungeon' --
        every existing call site's fallback IS today's literal KCK tile,
        so an uncast/unpicked slot renders BYTE-IDENTICAL to before this
        phase existed. This is the whole KCK-regression guarantee: no
        entry.sprite anywhere (true of every pre-Phase-C config) means
        every single call always falls through to branch 3.
   ====================================================================== */

var ROSTER_SHEETS = {
  dungeon: { path: 'intro/assets/tiny_dungeon.png', pack: 'Tiny Dungeon' },
  farm:    { path: 'intro/assets/tiny_farm.png',    pack: 'Tiny Farm' },
  ski:     { path: 'intro/assets/tiny_ski.png',     pack: 'Tiny Ski' },
  battle:  { path: 'intro/assets/tiny_battle.png',  pack: 'Tiny Battle' },
};

var ROSTER = [
  // ---- Tiny Dungeon (col,row on the existing tiny_dungeon.png) ----
  // the 5 starred entries are today's KCK hardcoded literals -- their
  // labels double as "what this slot looks like if you don't touch the
  // sprite picker at all" in the wizard.
  { key:'sage',      label:'Sage',       sheet:'dungeon', col:0, row:7 },
  { key:'villager',  label:'Villager',   sheet:'dungeon', col:1, row:7 }, // * diner0 default
  { key:'plain',     label:'Plain',      sheet:'dungeon', col:2, row:7 }, // * host/player default
  { key:'helm',      label:'Helm',       sheet:'dungeon', col:3, row:7 },
  { key:'mohawk',    label:'Mohawk',     sheet:'dungeon', col:4, row:7 },
  { key:'visor',     label:'Visor',      sheet:'dungeon', col:0, row:8 },
  { key:'squire',    label:'Squire',     sheet:'dungeon', col:1, row:8 },
  { key:'vest',      label:'Vest',       sheet:'dungeon', col:2, row:8 }, // * builder default
  { key:'braid',     label:'Braid',      sheet:'dungeon', col:3, row:8 }, // * butterfingers default
  { key:'grandma',   label:'Grandma',    sheet:'dungeon', col:4, row:8 }, // * judge default
  { key:'barbarian', label:'Barbarian',  sheet:'dungeon', col:1, row:9 },
  { key:'bandana',   label:'Bandana',    sheet:'dungeon', col:3, row:9 },
  { key:'beard',     label:'Beard',      sheet:'dungeon', col:4, row:9 },
  { key:'slime',     label:'Slime',      sheet:'dungeon', col:0, row:9 },  // non-human
  { key:'spider',    label:'Spider',     sheet:'dungeon', col:2, row:10 }, // non-human

  // ---- Tiny Farm ----
  { key:'overalls',  label:'Overalls',   sheet:'farm', col:0, row:9 },
  { key:'strawhat',  label:'Straw Hat',  sheet:'farm', col:1, row:9 },
  { key:'cow',       label:'Cow',        sheet:'farm', col:1, row:10 }, // non-human

  // ---- Tiny Ski ----
  { key:'skigreen',  label:'Ski (Green)',  sheet:'ski', col:10, row:5 },
  { key:'skipurple', label:'Ski (Purple)', sheet:'ski', col:10, row:6 },
  { key:'snowman',   label:'Snowman',      sheet:'ski', col:9,  row:5 }, // non-human

  // ---- Tiny Battle (only its 5 color-coded "commander" figures read as
  // usable individual characters -- everything else in this pack is
  // vehicles/terrain/UI, see intro/assets/CREDITS.txt) ----
  { key:'armygray',   label:'Army (Gray)',   sheet:'battle', col:16, row:5 },
  { key:'armygreen',  label:'Army (Green)',  sheet:'battle', col:16, row:6 },
  { key:'armyblue',   label:'Army (Blue)',   sheet:'battle', col:16, row:7 },
  { key:'armyred',    label:'Army (Red)',    sheet:'battle', col:16, row:8 },
  { key:'armyorange', label:'Army (Orange)', sheet:'battle', col:16, row:9 },
];

var ROSTER_BY_KEY = {};
for(var __ri=0; __ri<ROSTER.length; __ri++){ ROSTER_BY_KEY[ROSTER[__ri].key] = ROSTER[__ri]; }
var ROSTER_KEYS = ROSTER.map(function(r){ return r.key; });

/* entry = a CAST[slot]-shaped object (or CONFIG.host) -- may be null/
   undefined (uncast role). Returns { sheet, col, row }, always. See this
   file's header comment for the exact 3-branch precedence. */
function rosterResolveSprite(entry, fallbackCol, fallbackRow){
  var picked = (entry && entry.sprite && Object.prototype.hasOwnProperty.call(ROSTER_BY_KEY, entry.sprite))
    ? ROSTER_BY_KEY[entry.sprite] : null;
  if(picked) return { sheet: picked.sheet, col: picked.col, row: picked.row };
  return {
    sheet: 'dungeon',
    col: (entry && entry.spriteCol !== undefined) ? entry.spriteCol : fallbackCol,
    row: (entry && entry.spriteRow !== undefined) ? entry.spriteRow : fallbackRow,
  };
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    ROSTER: ROSTER,
    ROSTER_BY_KEY: ROSTER_BY_KEY,
    ROSTER_KEYS: ROSTER_KEYS,
    ROSTER_SHEETS: ROSTER_SHEETS,
    rosterResolveSprite: rosterResolveSprite,
  };
}
