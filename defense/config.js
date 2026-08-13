'use strict';
/* ======================================================================
   defense/config.js -- NO FILE CONFIG. Identical convention/rationale to
   game/config.js, gallery/config.js, and flight/config.js (see any of
   those files' own header comment in full) -- the bare /defense/ page
   ships no game of its own; a real game only ever exists as a shareable
   `#cfg=` link (built by /build/) or a deployed games/<slug>/config.js.
   `let`, not `const`, for the same reassignment reason game/config.js
   documents.
   ====================================================================== */
let CONFIG = null;
