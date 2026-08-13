'use strict';
/* ======================================================================
   flight/config.js -- NO FILE CONFIG. Identical convention/rationale to
   game/config.js and gallery/config.js (see either file's own header
   comment in full) -- the bare /flight/ page ships no game of its own; a
   real game only ever exists as a shareable `#cfg=` link (built by
   /build/) or a deployed games/<slug>/config.js. `let`, not `const`, for
   the same reassignment reason game/config.js documents.
   ====================================================================== */
let CONFIG = null;
