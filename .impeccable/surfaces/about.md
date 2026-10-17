---
version: 1
slug: "about"
primary_target: "docs/.vitepress/theme/components/AboutPage.vue"
related_targets: ["docs/.vitepress/theme/components/AboutCharacter.vue", "docs/.vitepress/theme/character/runtime.js"]
---

# 关于我 · 实时三维人物

Mode: Experience. Narrow asset/interaction replacement within the existing dark cartoon portfolio. The user approved rebuilding a similar character and direct integration without an intermediate likeness approval. No new identity, no extra page sections, no changes to personal facts or ticket/modal content.

THESIS: The author is a rounded, tangible 3D cartoon person who notices the visitor, not a cut-out slideshow. Eyes lead a continuous bounded head turn; mild smiles and raised brows settle naturally.

OWN-WORLD: Retain the navy #121923 ground, warm-white #f7f5ef type, coral #ef766e accents and paper ticket shapes. Reference the supplied black-haired, silver-glasses, navy-tie/suit portrait and expression video. Source inputs remain private; do not promise exact reconstruction. A genuine modeled face, independent eyeballs, swept hair locks, fitted glasses and cheek stickers are required.

FIRST VIEWPORT: Preserve the central bust and four surrounding tickets. Keep the face unobstructed, DOM controls accessible and visible ahead of GLB loading. A same-model poster occupies precisely the renderer's frame; no blank canvas or portrait-scale flash.

MOTION: Eye damping 80ms, head 170ms, face 230ms, all delta-time based. Pointer exit and modal opening return the character to neutral without snapping. Modal opens immediately. No fake eyelid overlay or direction-sector image switching. Pause offscreen/hidden; reduced motion uses the poster. Touch devices render a cheaper neutral pose without pointer tracking.

FORM: Approved code-led, incumbent-composition extension; the actual Blender scene and exported GLB are the asset source, not a generated page comp. No concept tournament or new world selection is needed. Bound first-pass captures at 390/1440/1920/3440, then at most one main-thread confirmation batch; fresh finish review and ordinary-extension documentation handoffs are required.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Shipped extension evidence · 2026-10-17

This is an ordinary extension of the incumbent portfolio. `DESIGN.md` and `.impeccable/design.json` were compared with the shipped sources and preserved byte-for-byte. The about page's composition, personal facts, four ticket destinations and modal content remain surface concerns; none are promoted into a new global visual system.

### Implemented artifact

- `docs/.vitepress/theme/components/AboutPage.vue` retains the dark one-screen composition, four paper tickets, personal identity and keyboard-accessible archive dialog. The portrait now mounts `AboutCharacter.vue`; the new square portrait frame keeps the face clear at the captured widths.
- `docs/.vitepress/theme/components/AboutCharacter.vue` supplies a same-frame poster before the first completed WebGL frame, restores it after renderer failure, and uses it for reduced motion. Runtime loading is deferred to this mounted surface. Visibility and intersection observers suspend rendering; coarse pointers use a neutral pose without pointer tracking.
- `docs/.vitepress/theme/character/runtime.js` renders a genuine Blender GLB with independent head, neck and eye controls plus Smile, BrowRaise and MouthOpen morph targets. `motion.js` supplies delta-time damping: eyes 80ms, head 170ms, expression 230ms; pointer exit and opening a modal settle toward neutral. Broad studio lighting and smooth geometry normals establish form without miniature shadow-map artifacts. Rendering stops when settled; device pixel ratio is capped and rendering quality adapts to slow frames.
- `scripts/build-character.py` is the procedural Blender source. `docs/public/models/okzu-character.glb` is 1,644,568 bytes with 65,819 triangles and 37 meshes. Binary inspection found zero embedded images and zero textures; this is modeled geometry rather than portrait planes. `docs/public/models/okzu-character.json` records Blender 4.5.14 LTS, controls and authorship. Private `.blend` source, personal references and local tooling stay outside the public artifact.
- `scripts/render-character-poster.js` captures the exact website runtime, camera, neutral pose and lighting to `docs/public/models/okzu-character-poster.png`. The shipping raster is transparent 900×900 and contains the `impeccable:prompt` PNG provenance entry. The Blender reference render is a private authoring artifact, not the runtime fallback.

### Review and validation evidence

Full settled captures: `.impeccable/review/about-390.png` (390×844), `about-1440.png` (1440×900), `about-1920.png` (1920×1080), `about-3440.png` (3440×1440), plus `about-look-right.png` and `about-modal.png`. These are implementation evidence, not a page comp or quality board. The documenter inspected the 390, 1440 and modal captures against source and the incumbent system.

`.impeccable/review/about-results.json` records zero browser errors and successful continuous gaze, modal reset, WebGL fallback, touch mode, reduced motion and lazy loading checks. Its desktop measurement is 179 frames in 2.977 seconds on an NVIDIA GeForce GTX 1650 (approximately 60 frames/second); this does not establish physical phone performance. The fresh finish-review handoff reports **ship**, with its three initial findings resolved together: geometry shading, matching poster lighting and modal skill badges. The skill badges now use restrained inline SVGs.

### Incumbent comparison and exclusions

Shared identity still uses the public Manrope / Noto Sans SC and DM Mono stacks, a navy ground, warm-white text, coral emphasis and cartoon author. The named global Surface Scope and Resting Panel rules remain exactly as recorded in `DESIGN.md`; no color, type, spacing, motion or component token was added.

Pre-existing about-page differences remain reported rather than repaired or canonized: local navy `#121923`, warm white `#f7f5ef`, coral `#ef766e` and paper `#f1f0eb` differ from the global palette; the about headline has its own tighter display scale; tickets and brand avatar carry hard offset shadows; the oversized ABOUT ME label, generic cursive Stay curious and text-glyph ticket dots/arrows remain existing surface craft debt. The committed pre-extension `AboutPage.vue` confirms these predate this asset replacement. They are not new reusable system rules, and expanding the approved asset task to redesign them was not authorized.

Preservation evidence (SHA-256, before and after documentation): `DESIGN.md` = `49AF2EAE2B6FBAA22290A15FD7961C90B17235F26521BB69D6EB99FA8C71ABBA`; `.impeccable/design.json` = `E637CC636AB1D117394A76BFD72301BBB3EAA907647F23E8925365DA2A54C0A7`.
