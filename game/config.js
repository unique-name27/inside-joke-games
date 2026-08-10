'use strict';
/* ======================================================================
   game/config.js -- NO FILE CONFIG.

   The bare /game/ (and /intro/) pages ship no game of their own anymore --
   this repo is the shared engine + builder, not any one group's game. A
   real game only ever exists two ways: a shareable `#cfg=` link (built by
   /build/, or by tools/generate.js) or a deployed games/<slug>/config.js
   (which replaces this file entirely, same as it always has).

   `let`, not `const` -- every real config.js (games/<slug>/config.js,
   examples/*.config.js) declares CONFIG `const`, and game/engine.js /
   intro/engine.js mutate it in place (delete-all-keys + Object.assign) to
   respect that binding. This file has nothing to mutate INTO -- when a
   `#cfg=` fragment is present, the engine does a straight reassignment of
   this binding instead, which only works if it's declared `let`. See the
   CONFIG-resolution block near the top of game/engine.js / intro/engine.js
   for the full 3-way branch (real config + fragment / this stub + fragment
   / this stub + no fragment -- the last one redirects to ../build/).
   ====================================================================== */
let CONFIG = null;
