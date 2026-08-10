'use strict';
/* ======================================================================
   game/skeletons.js -- STORY SKELETONS (scene templates): THE DINNER
   PARTY, THE ROAD TRIP, THE OFFICE PARTY, THE WEDDING WEEKEND. Engine-
   shipped presentation code ONLY -- per-scene palettes, draw functions,
   and mechanic-flavor strings. Loaded as a plain global (`SKELETONS`) by
   BOTH game/engine.js and intro/engine.js, before either engine script --
   same dual browser/Node-`require` load pattern as game/cfgcodec.js (see
   that file's own header comment), so every name here is a plain
   top-level `var`/function that becomes a global in a classic <script>,
   and also exports via `module.exports` for this file's own Node
   harnesses (tools/verify-skeletons.js).

   THE ONE RULE: skeletons are paint and text, never gameplay. Every
   skeleton draws around the IDENTICAL collision geometry the engine owns
   (TABLE 336,248,288,120; the four seats; the left main door; the
   elevated boss door; the top-wall bathroom door; the bottom-right
   KITCHEN_DOOR 760,500,152,40 + KITCHEN_GLOW center 840,508) -- so every
   pixel position below is a literal chosen to sit inside that same fixed
   footprint, not a rect this file defines or owns. `dinner`'s own values
   are the original hardcoded literals moved verbatim (byte-identical
   regression proof for the extraction); the other three are new art in
   the same economy (~30 lines per prop).

   Each draw function's signature is `(ctx, t, H)` for scene-level props
   (t = elapsed gameT/localT, for cheap animation) or `(ctx, x, y, size, H)`
   for the projectile/throwable sprites (size = the existing per-call
   radius/cell the engine already varies -- napkin `r` for the boss's
   normal vs. phase-2-big throw, bottle `cell` for the world/held/HUD-icon
   sizes -- so this is a deliberate, minimal widening of the spec's
   illustrative `draw(ctx,x,y,H)` shape: without a size parameter, the
   existing "big napkin"/HUD-icon-scale behavior couldn't survive the
   extraction byte-identically). `H` is the small helpers bag each engine
   passes: { PAL, drawPixelCircle, drawBitmap, drawSparkle, drawChunkyText }
   -- whatever the extracted dinner code already used, kept minimal.
   Every color used below is a literal (not read from PAL/H at draw time)
   on purpose, even where it duplicates a value also present in this same
   skeleton's `palette` object -- so a future palette-only tweak (which
   only affects the arena's generic floor/wall tint pass) can never
   silently reflow a prop's own art, and vice versa.

   Universal/engine-owned (NOT here, never move): "CATCH THE LAUGHS!",
   laugh tokens, hearts, the HA particles, the "LAUGHS CAUGHT:" stat
   label, "HARD MODE UNLOCKED" -- laughter is the currency in every scene.

   The tone gate itself (tools/verify-config.js's toneGateSource) is
   per-group now -- it checks a CONFIG's own forbiddenWords list, which
   this file (engine-shipped, shared by every group) has no equivalent
   of. Every string below is still ordinary, generic dinner/road-trip/
   office/wedding flavor text -- nothing that presumes any one group's
   specific off-limits words.
   ====================================================================== */

var SKELETONS = {
  dinner: {
    key: 'dinner',
    label: 'THE DINNER PARTY',
    palette: {
      floorA: '#3a2a1c', floorB: '#3a2a1c', wallTop: '#241a22',
      propBase: '#8a5a30', propTop: '#c96f4a', doorGlow: '#ffb347', decor: '#f3e9d2',
    },
    /* today's table draw (game/engine.js's old drawTableAndProps), moved
       verbatim: two fillRects (wood base + terracotta top), four cream
       "plate" pixel-circles, two dark-red "wine glass" marks. */
    drawCenterProp: function(ctx, t, H){
      ctx.fillStyle = '#8a5a30'; ctx.fillRect(336, 248, 288, 120);
      ctx.fillStyle = '#c96f4a'; ctx.fillRect(340, 252, 280, 112);
      H.drawPixelCircle(ctx, 400, 272, 10, '#f3e9d2', 2);
      H.drawPixelCircle(ctx, 560, 272, 10, '#f3e9d2', 2);
      H.drawPixelCircle(ctx, 400, 332, 10, '#f3e9d2', 2);
      H.drawPixelCircle(ctx, 560, 332, 10, '#f3e9d2', 2);
      [460, 500].forEach(function(gx){
        ctx.fillStyle = '#7a1f2a'; ctx.fillRect(gx-6, 286, 12, 10);
        ctx.fillStyle = '#8a5a30'; ctx.fillRect(gx-1, 296, 2, 10); ctx.fillRect(gx-5, 306, 10, 3);
      });
    },
    /* today's kitchen doorway: low wall stub, stepped warm-glow bands
       spilling from the gap, dark gap + wood frame -- moved verbatim. */
    drawFlavorDoor: function(ctx, t, H){
      ctx.fillStyle = '#241a22';
      ctx.fillRect(760, 500, 152, 40);
      var bands = [[200,0.05],[150,0.08],[100,0.12],[60,0.16]];
      for(var i=0;i<bands.length;i++){
        ctx.save(); ctx.globalAlpha = bands[i][1];
        H.drawPixelCircle(ctx, 840, 508, bands[i][0], '#ffb347', 8);
        ctx.restore();
      }
      ctx.fillStyle = '#120c14';
      ctx.fillRect(800, 500, 80, 40);
      ctx.fillStyle = '#8a5a30';
      ctx.fillRect(796, 500, 4, 40);
      ctx.fillRect(880, 500, 4, 40);
    },
    drawWallDecor: function(ctx, t, H){ /* dinner: nothing -- today has no top-wall decor */ },
    projectile: { draw: function(ctx, x, y, r, H){
      H.drawPixelCircle(ctx, x, y, r, '#efe6d0', 2);
      H.drawPixelCircle(ctx, x-1, y+1, Math.max(1,r-2), '#cbbf9e', 2);
    }},
    throwable: { draw: function(ctx, x, y, cell, H){
      H.drawBitmap(ctx, ['.11.','.11.','1111','1111','1111','1111','1111','1111'], {'1':'#5a8a3c'}, x, y, cell);
      ctx.fillStyle = '#3a6024'; ctx.fillRect(Math.round(x+cell), Math.round(y), 2*cell, cell);
      ctx.fillStyle = '#dff0e8'; ctx.fillRect(Math.round(x+cell), Math.round(y+3*cell), cell, 3*cell);
    }},
    strings: {
      startCardTitle: 'DINNER IS SERVED',
      startCardBody: ['THE TABLE TELLS ITS STORIES.','WAIT FOR THE LAST WORD...','THEN HIT SPACE.',"DON'T LET THE LAUGHTER DIE."],
      modeSelectTitle: 'CHOOSE YOUR SEATING',
      modeRowNormal: 'FIRST SEATING  --  A NICE DINNER',
      modeRowHard: 'SECOND SEATING  --  MUCH HARDER. YOU CAN LOSE.',
      hardUnlockLine: 'SECOND SEATING AWAITS AT THE START',
      hardClearedLine: 'SECOND SEATING CLEARED',
    },
  },

  roadtrip: {
    key: 'roadtrip',
    label: 'THE ROAD TRIP',
    palette: {
      floorA: '#332a1a', floorB: '#332a1a', wallTop: '#10160f',
      propBase: '#4a4038', propTop: '#6b5a48', doorGlow: '#ffcf8a', decor: '#f3e9d2',
    },
    /* a campfire ring inside the exact same TABLE footprint: a charred
       ground patch, a loose ring of stones, two log benches along the
       table's long (top/bottom) edges, a flickering flame, a small warm
       halo (the same stepped-glow technique the kitchen door already
       uses, just a smaller radius). */
    drawCenterProp: function(ctx, t, H){
      H.drawPixelCircle(ctx, 480, 308, 66, '#2a2420', 4);
      var stoneAngles = [0, 0.79, 1.57, 2.36, 3.14, 3.93, 4.71, 5.5];
      for(var i=0;i<stoneAngles.length;i++){
        var a = stoneAngles[i];
        H.drawPixelCircle(ctx, 480+Math.cos(a)*58, 308+Math.sin(a)*40, 8, '#8a8378', 3);
      }
      ctx.fillStyle = '#6b5a48'; ctx.fillRect(360, 254, 240, 14); ctx.fillRect(360, 362, 240, 14);
      ctx.fillStyle = '#4a3e30'; ctx.fillRect(360, 254, 240, 4); ctx.fillRect(360, 362, 240, 4);
      var flick = Math.sin(t*9)*3, flick2 = Math.sin(t*13+1)*2;
      ctx.fillStyle = '#e8b84b'; ctx.fillRect(472, 294+flick, 16, 26-flick);
      ctx.fillStyle = '#ff8a3c'; ctx.fillRect(476, 300+flick2, 8, 16-flick2);
      ctx.save(); ctx.globalAlpha = 0.14; H.drawPixelCircle(ctx, 480, 304, 50, '#ffcf8a', 6); ctx.restore();
    },
    /* the parked van: recolored wall stub (dark blue-gray body), the same
       stepped warm-glow bands (now the headlights), the same dark gap +
       frame, plus two small round headlight pixels flanking the gap. */
    drawFlavorDoor: function(ctx, t, H){
      ctx.fillStyle = '#2a3a44'; ctx.fillRect(760, 500, 152, 40);
      ctx.fillStyle = '#1c2830'; ctx.fillRect(760, 500, 152, 8);
      var bands = [[180,0.06],[130,0.10],[85,0.16],[50,0.22]];
      for(var i=0;i<bands.length;i++){
        ctx.save(); ctx.globalAlpha = bands[i][1];
        H.drawPixelCircle(ctx, 840, 508, bands[i][0], '#ffcf8a', 8);
        ctx.restore();
      }
      ctx.fillStyle = '#120c14'; ctx.fillRect(800, 500, 80, 40);
      ctx.fillStyle = '#3f5560'; ctx.fillRect(796, 500, 4, 40); ctx.fillRect(880, 500, 4, 40);
      H.drawPixelCircle(ctx, 780, 520, 5, '#ffe8b8', 2);
      H.drawPixelCircle(ctx, 900, 520, 5, '#ffe8b8', 2);
    },
    /* sparse stars, top wall -- fixed positions (no per-frame randomness)
       with a slow per-star twinkle so it never flickers/reflows. */
    drawWallDecor: function(ctx, t, H){
      var stars = [[40,20],[120,44],[210,16],[300,38],[420,22],[520,46],[610,18],[700,40],[790,24],[860,44],[920,16],[70,50]];
      for(var i=0;i<stars.length;i++){
        ctx.save(); ctx.globalAlpha = 0.55 + 0.25*Math.sin(t*2+i);
        ctx.fillStyle = '#f3e9d2'; ctx.fillRect(stars[i][0], stars[i][1], 2, 2);
        ctx.restore();
      }
    },
    projectile: { draw: function(ctx, x, y, r, H){ // crumpled maps, pale paper tint
      H.drawPixelCircle(ctx, x, y, r, '#e8e2c8', 2);
      H.drawPixelCircle(ctx, x-1, y+1, Math.max(1,r-2), '#c9c2a0', 2);
    }},
    throwable: { draw: function(ctx, x, y, cell, H){ // the thermos: steel gray + red cap
      H.drawBitmap(ctx, ['.11.','.11.','1111','1111','1111','1111','1111','1111'], {'1':'#8a97a3'}, x, y, cell);
      ctx.fillStyle = '#c9394a'; ctx.fillRect(Math.round(x+cell), Math.round(y), 2*cell, cell);
      ctx.fillStyle = '#c7ced4'; ctx.fillRect(Math.round(x+cell), Math.round(y+3*cell), cell, 3*cell);
    }},
    strings: {
      startCardTitle: 'THE FIRE IS LIT',
      startCardBody: ['THE CREW TELLS THEIR STORIES.','WAIT FOR THE LAST WORD...','THEN HIT SPACE.',"DON'T LET THE LAUGHTER DIE."],
      modeSelectTitle: 'CHOOSE YOUR ROUTE',
      modeRowNormal: 'SCENIC ROUTE  --  A NICE DRIVE',
      modeRowHard: 'WHITE-KNUCKLE ROUTE  --  MUCH HARDER. YOU CAN LOSE.',
      hardUnlockLine: 'WHITE-KNUCKLE ROUTE AWAITS AT THE START',
      hardClearedLine: 'WHITE-KNUCKLE ROUTE CLEARED',
    },
  },

  office: {
    key: 'office',
    label: 'THE OFFICE PARTY',
    palette: {
      floorA: '#4a4a54', floorB: '#3c3c46', wallTop: '#1c2230',
      propBase: '#6b7078', propTop: '#868c94', doorGlow: '#bfe6ff', decor: '#e8d97a',
    },
    /* the break-room table: cool-gray top, a small coffee pot (body +
       coffee level + lid) and a tiny potted plant (pot + two foliage
       circles), both well inside the table's own footprint. */
    drawCenterProp: function(ctx, t, H){
      ctx.fillStyle = '#6b7078'; ctx.fillRect(336, 248, 288, 120);
      ctx.fillStyle = '#868c94'; ctx.fillRect(340, 252, 280, 112);
      ctx.fillStyle = '#2a2a2e'; ctx.fillRect(392, 272, 16, 20);
      ctx.fillStyle = '#4a3222'; ctx.fillRect(394, 276, 12, 10);
      ctx.fillStyle = '#2a2a2e'; ctx.fillRect(390, 268, 20, 4);
      ctx.fillStyle = '#7a4a30'; ctx.fillRect(548, 326, 20, 14);
      H.drawPixelCircle(ctx, 558, 320, 12, '#3a6a3a', 3);
      H.drawPixelCircle(ctx, 550, 314, 8, '#4a7a44', 3);
    },
    /* the vending machine: recolored wall stub, a cool glow standing in
       for the hum of its light, a glowing display strip behind the gap,
       and a small row of buttons. */
    drawFlavorDoor: function(ctx, t, H){
      ctx.fillStyle = '#2c3244'; ctx.fillRect(760, 500, 152, 40);
      ctx.fillStyle = '#1c2230'; ctx.fillRect(760, 500, 152, 6);
      ctx.save(); ctx.globalAlpha = 0.16 + 0.06*Math.sin(t*3);
      H.drawPixelCircle(ctx, 840, 508, 130, '#bfe6ff', 8);
      ctx.restore();
      ctx.fillStyle = '#120c14'; ctx.fillRect(800, 500, 80, 40);
      ctx.save(); ctx.globalAlpha = 0.5 + 0.2*Math.sin(t*3);
      ctx.fillStyle = '#8fd0ff'; ctx.fillRect(804, 506, 72, 10);
      ctx.restore();
      ctx.fillStyle = '#3f4a5c'; ctx.fillRect(796, 500, 4, 40); ctx.fillRect(880, 500, 4, 40);
      ctx.fillStyle = '#e8b84b';
      for(var i=0;i<4;i++) ctx.fillRect(770+i*8, 522, 4, 4);
    },
    /* a dark window-strip band with small lit/dark "city window" pixels,
       most lit, a few dark, a slow flicker on which ones. */
    drawWallDecor: function(ctx, t, H){
      ctx.fillStyle = '#141b28'; ctx.fillRect(360, 18, 240, 36);
      var lights = [[380,26],[400,34],[420,22],[440,38],[460,28],[480,20],[500,36],[520,24],[540,32],[560,26],[580,38]];
      for(var i=0;i<lights.length;i++){
        var on = (Math.floor(t*0.5+i) % 5) !== 0;
        ctx.fillStyle = on ? '#e8d97a' : '#0e1420';
        ctx.fillRect(lights[i][0], lights[i][1], 3, 4);
      }
    },
    projectile: { draw: function(ctx, x, y, r, H){ // crumpled memos, white/blue tint
      H.drawPixelCircle(ctx, x, y, r, '#eef2f8', 2);
      H.drawPixelCircle(ctx, x-1, y+1, Math.max(1,r-2), '#c9d6e8', 2);
    }},
    throwable: { draw: function(ctx, x, y, cell, H){ // the red stapler
      var rows = ['.1111.','111111','111111','222222','111111','111111','111111','.1111.'];
      H.drawBitmap(ctx, rows, {'1':'#c9394a','2':'#8a97a3'}, x, y, cell);
    }},
    strings: {
      startCardTitle: 'THE PARTY HAS STARTED',
      startCardBody: ['THE OFFICE TELLS ITS STORIES.','WAIT FOR THE LAST WORD...','THEN HIT SPACE.',"DON'T LET THE LAUGHTER DIE."],
      modeSelectTitle: 'CHOOSE YOUR SHIFT',
      modeRowNormal: 'DAY SHIFT  --  A NICE PARTY',
      modeRowHard: 'NIGHT SHIFT  --  MUCH HARDER. YOU CAN LOSE.',
      hardUnlockLine: 'NIGHT SHIFT AWAITS AT THE START',
      hardClearedLine: 'NIGHT SHIFT CLEARED',
    },
  },

  wedding: {
    key: 'wedding',
    label: 'THE WEDDING WEEKEND',
    palette: {
      floorA: '#5a4530', floorB: '#5a4530', wallTop: '#241a28',
      propBase: '#f3ece0', propTop: '#fdf8f0', doorGlow: '#ff9fc9', decor: '#ffd9a0',
    },
    /* a white-clothed table with a small tiered cake (three stacked
       rects narrowing upward) and a tiny gold topper accent, centered. */
    drawCenterProp: function(ctx, t, H){
      ctx.fillStyle = '#f3ece0'; ctx.fillRect(336, 248, 288, 120);
      ctx.fillStyle = '#fdf8f0'; ctx.fillRect(340, 252, 280, 112);
      ctx.fillStyle = '#fff6e6'; ctx.fillRect(456, 286, 48, 20);
      ctx.fillStyle = '#fdeccb'; ctx.fillRect(466, 270, 28, 18);
      ctx.fillStyle = '#fff6e6'; ctx.fillRect(474, 258, 12, 14);
      ctx.fillStyle = '#e8b84b'; ctx.fillRect(478, 254, 4, 6);
    },
    /* the DJ booth: two speaker boxes flanking the gap, a slow pulsing
       glow (pink, on the same stepped-radius technique), and pulsing
       speaker cones synced to the same pulse. */
    drawFlavorDoor: function(ctx, t, H){
      ctx.fillStyle = '#241a28'; ctx.fillRect(760, 500, 152, 40);
      var pulse = 0.5 + 0.5*Math.sin(t*4);
      ctx.save(); ctx.globalAlpha = 0.10 + 0.10*pulse;
      H.drawPixelCircle(ctx, 840, 508, 150, '#ff9fc9', 8);
      ctx.restore();
      ctx.fillStyle = '#120c14'; ctx.fillRect(800, 500, 80, 40);
      ctx.fillStyle = '#2e2130'; ctx.fillRect(764, 506, 26, 30); ctx.fillRect(870, 506, 26, 30);
      ctx.save(); ctx.globalAlpha = 0.5 + 0.4*pulse;
      H.drawPixelCircle(ctx, 777, 518, 8, '#e8b84b', 3);
      H.drawPixelCircle(ctx, 883, 518, 8, '#e8b84b', 3);
      ctx.restore();
    },
    /* a string of lights along the top wall: an evenly-spaced dot row,
       each dot slowly cycling through a small warm palette. */
    drawWallDecor: function(ctx, t, H){
      var colors = ['#e8b84b', '#ff9fc9', '#f3e9d2', '#c96f4a'];
      for(var i=0;i<20;i++){
        var x = 30 + i*46;
        var colorIdx = Math.floor(t*0.6 + i*0.7) % colors.length;
        H.drawPixelCircle(ctx, x, 30 + Math.sin(i*1.3)*6, 3, colors[colorIdx], 2);
      }
    },
    projectile: { draw: function(ctx, x, y, r, H){ // crumpled toasts, cream paper tint
      H.drawPixelCircle(ctx, x, y, r, '#f5ecd8', 2);
      H.drawPixelCircle(ctx, x-1, y+1, Math.max(1,r-2), '#d9cba8', 2);
    }},
    throwable: { draw: function(ctx, x, y, cell, H){ // the bouquet: pink bloom + green stems
      ctx.fillStyle = '#4a7a3a'; ctx.fillRect(Math.round(x+2*cell), Math.round(y+3*cell), cell, 4*cell);
      H.drawPixelCircle(ctx, x+2*cell, y+2*cell, 2.4*cell, '#ff9fc9', 2);
      H.drawPixelCircle(ctx, x+1*cell, y+1.4*cell, 1.6*cell, '#ffd0e6', 2);
    }},
    strings: {
      startCardTitle: 'THE RECEPTION BEGINS',
      startCardBody: ['THE WEDDING PARTY TELLS ITS STORIES.','WAIT FOR THE LAST WORD...','THEN HIT SPACE.',"DON'T LET THE LAUGHTER DIE."],
      modeSelectTitle: 'CHOOSE YOUR DANCE',
      modeRowNormal: 'FIRST DANCE  --  A NICE RECEPTION',
      modeRowHard: 'LAST DANCE  --  MUCH HARDER. YOU CAN LOSE.',
      hardUnlockLine: 'LAST DANCE AWAITS AT THE START',
      hardClearedLine: 'LAST DANCE CLEARED',
    },
  },
};

if(typeof module !== 'undefined' && module.exports){
  module.exports = { SKELETONS: SKELETONS };
}
