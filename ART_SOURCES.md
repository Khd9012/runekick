# RUNEKICK art sources

Final project files:
- `C:/Users/devco/Documents/fast-fix/runekick/dist/assets/striker.png`
- `C:/Users/devco/Documents/fast-fix/runekick/dist/assets/rival.png`
- `C:/Users/devco/Documents/fast-fix/runekick/dist/assets/youth-stadium.png`

Characters, coaches, equipment, card action silhouettes and background were created specifically for this prototype with the built-in OpenAI image generation tool on 2026-10-26. They are not downloaded third-party asset-pack artwork. Final generated PNGs are bundled unchanged in dist/assets and precached for offline play. Procedural fallback sprites, effects and the tactics map are drawn in code. Runtime source-rectangle cropping selects sprites from the seven atlases; background desaturation is applied in the renderer. No third-party runtime assets or requests are used.

v0.4 atlases:
- `C:/Users/devco/Documents/fast-fix/runekick/dist/assets/coaches.png` (4 columns x 2 rows, seven coaches)
- `C:/Users/devco/Documents/fast-fix/runekick/dist/assets/equipment.png` (4 columns x 3 rows, ten relics)

Coach characters are stylized depictions of the seven named public football managers. Their dialogue and battle mechanics are fictional game adaptations.

### coaches atlas generation

Use case: stylized-concept. Asset type: ONE transparent sprite atlas for a pixel-art football fantasy card battle game. A precise 4-column by 2-row grid, equal rectangular cells, canvas landscape 1536x1024, NO grid lines. Each occupied cell contains exactly one complete full-body older adult football manager caricature facing LEFT in a three-quarter side view, holding a tactics clipboard or gesturing toward a football pitch. Same scale, feet on the same baseline in each row, generous transparent margins between figures, absolutely no overlap across cells. Top row left to right: Jose Mourinho (short silver-grey hair, dark navy suit, focused folded-arm stance); Carlo Ancelotti (silver hair, distinctive lifted eyebrow, charcoal suit and tie, calm clipboard stance); Pep Guardiola (bald head, short greying beard, black fitted sweater and trousers, animated pointing stance); Mikel Arteta (neatly cropped black hair, clean-shaven, black polo and trousers, tactical clipboard stance). Bottom row left to right: Arsene Wenger (tall lean figure, silver hair, long navy coat, composed stance); Alex Ferguson (older rounder face, grey hair, glasses, dark suit and red tie, emphatic pointing stance); Jurgen Klopp (brown/grey beard, black baseball cap, glasses, dark tracksuit, energetic clenched fist); last cell EMPTY transparent. Distinct recognizable stylized features, original game art, no logos or club badges. Style: polished 16-bit pixel illustration, finely controlled crisp pixel clusters, readable faces, 4-head-tall proportions to match an indie RPG battle sprite, indigo shadows, cream highlights, restrained vivid accents, clean outer silhouette. This is a single game sprite sheet, not a poster. No text, no names, no labels, no background, no floor rectangle, no border, no watermark. Every figure fully visible, never crop heads or feet.

### equipment atlas generation

Create a production game asset: a transparent PNG sprite atlas of TEN football relic inventory icons for RUNEKICK, a refined pixel-art deck-building game. Canvas 1536 by 1024, EXACTLY four columns and three rows, equal cells. Every icon centered inside its own cell with wide empty margins. No frames, no labels, no background, no floor, no glow, no shadows outside objects, no UI. Crisp hand-placed 16-bit pixel clusters with clear silhouettes; restrained ivory, blue-grey, navy, oxblood and antique-gold palette; light source upper left; polished detailed game props, no cute cartoon or flat emoji. Maintain coherent scale and detail. Row 1 left to right: (1) a single pearl-white football boot with dark navy trim and grey studs, (2) a single black football boot with understated gold studs and burgundy laces, (3) a folded dark red football training shirt with cream collar, (4) a rolled deep blue captain wristband with a simple gold stripe, NO text. Row 2 left to right: (5) a pair of cream ribbed football socks with navy bands, (6) a worn navy canvas football duffel bag with leather straps, (7) a brushed steel water bottle with dark cap and a small teal accent, (8) a thick antique gold coin embossed with a football geometry. Row 3 left to right: (9) a polished brass referee whistle attached to a short black cord, (10) an antique gold shield medal on a folded navy ribbon, (11) EMPTY, (12) EMPTY. All ten icons fully visible, no elements crossing between cells, all unused space must be alpha transparent. This is artwork for an inventory asset sheet, not a poster.

### final atlas transparency edit (applied independently to both atlases)

Edit this existing game sprite atlas. Preserve EXACTLY the same canvas size, grid, positions, scale, silhouettes, colors and details of every character or object. Remove ALL background, all ambient glow, all blurry halos, all grey/brown/gold light clouds and all floor/contact shadows. Every pixel outside the actual physical silhouettes must be fully alpha-transparent (alpha 0). Restore the solid physical figures/objects to opaque colors. Clean cutout edges. Do not redesign, add or move any element. No background, no gradients, no glow whatsoever. Return a transparent PNG sprite sheet.

Final source images, copied without changing the originals:
- coaches: `C:/Users/devco/.codex/generated_images/01a16751-3adc-7df2-b565-8bdf7a5a1cea/exec-45f8b9c9-24a2-4db1-8ead-012354dc2b0f.png`
- equipment: `C:/Users/devco/.codex/generated_images/01a16751-3adc-7df2-b565-8bdf7a5a1cea/exec-0f71291e-9e35-46e1-b629-37dffb52296a.png`

External candidates inspected but NOT included: [Soccorpia by Gamer Goon](https://ggstudios4.itch.io/soccorpia-pixel-art-asset-pack) (small 16x16-style sprites), [Goals in Pixels](https://n3cloud.itch.io/goals-in-pixels) (paid). No paid assets were purchased.

## Final generation prompts

### hero

Use case: stylized-concept. Asset type: transparent 2D pixel art game character sprite for RUNEKICK, a football fantasy roguelike card battler. A single full-body original young adult athletic soccer striker, facing right in a dynamic three-quarter side view, confident poised stance, one foot lightly atop a small enchanted soccer ball. Expressive determined face, spiky dark brown hair, red headband with short flowing tail, crimson-red jersey with warm ivory trim, dark navy shorts, white knee socks, worn golden boots. High quality hand-crafted 16-bit pixel art with finely controlled pixel clusters, a 96x128 logical pixel aesthetic scaled up cleanly, subtle dithering, 4-head-tall athletic proportions, appealing detailed anatomy and bold silhouette. Rich warm crimson/cream highlights and indigo shadows. Full body fully visible with generous transparent margins; character centered, no background, no ground rectangle, no text, no logo, no badge, no UI, no other people. Must look like polished indie RPG battle sprite, not a blocky rectangular placeholder or 3D voxel art.

### rival

Use case: stylized-concept. Asset type: transparent 2D pixel art game character sprite for RUNEKICK, a football fantasy roguelike card battler. A single full-body original young adult athletic soccer rival, facing LEFT in a dynamic three-quarter side view, alert defensive ready stance with knees slightly bent and fists loose. Expressive confident face, swept silver-blue hair, azure-blue jersey with ivory trim, navy shorts, blue-and-white knee socks, dark blue boots. High quality hand-crafted 16-bit pixel art with finely controlled pixel clusters, a 96x128 logical pixel aesthetic scaled up cleanly, subtle dithering, 4-head-tall athletic proportions, appealing detailed anatomy and bold silhouette. Bright cyan and ivory highlights, indigo shadows, restrained fantasy sparkling blue aura around ankles. Full body fully visible with generous transparent margins; character centered, no background, no ground rectangle, no text, no logo, no badge, no UI, no other people. Must look like polished indie RPG battle sprite, not a blocky rectangular placeholder or 3D voxel art.

### stadium

Use case: stylized-concept. Asset type: wide 2D pixel art background for a side-view football fantasy card battle game RUNEKICK. A beautifully detailed small youth football stadium at golden hour, viewed from field level. Landscape composition approx 2.4:1. Layered background with terracotta European-style village rooftops, distant rolling mountains, warm apricot clouds in a dusky teal sky, tall floodlights at far edges, rows of small colorful spectator pixel shapes, weathered stone entry arch at center and low advertising-free barriers. Lower third is broad empty side-view grassy playing field with subtle field markings, space for two large characters on left and right. Polished indie game 16-bit pixel art, crisp intentional square pixel clusters, a logical 480x200 art aesthetic cleanly scaled, rich but controlled palette of deep teal, warm ochre, muted brick red, cream lighting. Strong depth and storytelling details, luminous sunset atmosphere, darker lower corners to blend into dark UI. NO characters in foreground, NO UI, no readable text, no logos, no trophy centerpiece. Not a top-down pitch, not a photograph, not 3D.


## v0.5 card action silhouette atlases

These three original PNG assets were generated with the built-in OpenAI image generation tool on 2026-10-26, following the imagegen skill. One generation call produced each complete six-action atlas. Each call set `transparent_background: true`. The prompt requested 1536×768; the returned originals are 1774×887 RGBA PNGs with verified transparent pixels and opaque silhouette/ball pixels. All originals remain intact and were copied without image edits or resampling. No character portrait asset is used in the normal card-art renderer.

Each atlas has three columns and two rows. Runtime source rectangles trim transparent margins once during `initArt`; the horizontal row boundary is at 46% of image height, in the empty gutter shared by all three sheets. This preserves the focus halo that extends slightly above the mathematical midpoint. The renderer contains each complete action without stretching on a pale red, blue or green panel and maps `options.id` to its own sprite. The procedural type illustrations remain as a missing-asset fallback.

### cards-technique.png

- Project file: `C:/Users/devco/Documents/fast-fix/runekick/dist/assets/cards-technique.png`
- Original generated file: `C:/Users/devco/.codex/generated_images/01a175e8-707a-7d42-a923-ec30ab946fb7/exec-4b950906-0033-4d01-9342-db24ed33653c.png`
- Top row, left to right: through-pass — 빈틈 파고들기; quick-pass — 가벼운 터치; one-two — 리듬 체인지.
- Bottom row, left to right: wall-pass — 발끝 컨트롤; long-pass — 폭발적인 돌파; dribble — 전진 드리블.

Final generation prompt:

Use case: stylized-concept. Asset type: ONE production sprite atlas containing exactly SIX distinct football action illustrations for a pixel-art deckbuilding card game. Generate a landscape 1536x768 PNG with actual transparent alpha background. Precisely 3 columns by 2 rows of equal invisible cells. Every cell is an independent composition centered within its own cell, with at least 10 percent empty margins; no parts or motion trails may cross cell boundaries. Read row-major, left to right then next row. No grid lines, frames, labels, letters, numerals, logos, watermarks, UI, or background scenery.
Art style: refined crisp 16-bit pixel illustration with deliberate small square clusters and clean stepped edges. These are action silhouettes, NOT character portraits. Athletes are solid near-black/charcoal shadow silhouettes with strong readable anatomy and football boots; NO face, NO eyes, NO hair details, NO jersey details, NO badges, NO real character identity. The pose itself must clearly explain each action. Bright ivory-white football with a crisp charcoal outline and a few dark football panels; restrained charcoal/grey motion arcs and small warm ivory highlights only. The final icons will sit on light muted ivory card panels. Prefer strong varied full-body poses and visible feet/ball positions over decorative effects. All bodies, limbs, ball and essential action trails fully visible. No blurred glow, no gradients, no haze, no floor rectangle. Each cell must look unmistakably different.
Atlas A, six technical movements. TOP LEFT: one black attacker carrying the bright ball through a narrow gap between two smaller desaturated-grey defender silhouettes; attacker leaning decisively forward, ball already beyond their feet. TOP MIDDLE: one upright player making a very short controlled toe tap on the ball directly in front of one foot, small precise touch ticks, compact quiet pose. TOP RIGHT: one low agile player shifting the ball from left foot to right foot with two crisp ghosted leg positions and a short zigzag ball trail, clearly rhythmic changing direction. BOTTOM LEFT: one player juggling the bright ball up on the top of a raised foot, bent standing leg, ball at shin level, a short upward arc. BOTTOM MIDDLE: one player blasting forward with a forceful first step, torso forward, long backward speed streaks and ball propelled ahead, explosive breakthrough. BOTTOM RIGHT: one player calmly carrying the ball forward at a medium running stride, ball close to the leading foot and two short evenly spaced dribble marks. These are six separate complete compositions, not a continuous scene.

### cards-attack.png

- Project file: `C:/Users/devco/Documents/fast-fix/runekick/dist/assets/cards-attack.png`
- Original generated file: `C:/Users/devco/.codex/generated_images/01a175e8-707a-7d42-a923-ec30ab946fb7/exec-1b7b2863-06f9-4c66-9472-b1e416c24a9f.png`
- Top row, left to right: feint — 바디 페인트; sprint — 전력 질주; shot — 정확한 슈팅.
- Bottom row, left to right: power-shot — 파워 슈팅; volley — 발리 슈팅; clutch — 마지막 한 발.

Final generation prompt:

Use case: stylized-concept. Asset type: ONE production sprite atlas containing exactly SIX distinct football action illustrations for a pixel-art deckbuilding card game. Generate a landscape 1536x768 PNG with actual transparent alpha background. Precisely 3 columns by 2 rows of equal invisible cells. Every cell is an independent composition centered within its own cell, with at least 10 percent empty margins; no parts or motion trails may cross cell boundaries. Read row-major, left to right then next row. No grid lines, frames, labels, letters, numerals, logos, watermarks, UI, or background scenery.
Art style: refined crisp 16-bit pixel illustration with deliberate small square clusters and clean stepped edges. These are action silhouettes, NOT character portraits. Athletes are solid near-black/charcoal shadow silhouettes with strong readable anatomy and football boots; NO face, NO eyes, NO hair details, NO jersey details, NO badges, NO real character identity. The pose itself must clearly explain each action. Bright ivory-white football with a crisp charcoal outline and a few dark football panels; restrained charcoal/grey motion arcs and small warm ivory highlights only. The final icons will sit on light muted ivory card panels. Prefer strong varied full-body poses and visible feet/ball positions over decorative effects. All bodies, limbs, ball and essential action trails fully visible. No blurred glow, no gradients, no haze, no floor rectangle. Each cell must look unmistakably different.
Atlas B, six evasive and shooting movements. TOP LEFT: one black attacker performing a body feint, knees bent and shoulders leaning to one side while the ball stays on the other side; two subtle grey shoulder afterimages showing left-right deception. TOP MIDDLE: one sprinter in a very low accelerating run, almost horizontal torso, powerful stretched stride and short racing streaks, bright ball ahead of the foot near the ground. TOP RIGHT: one player taking a technically precise grounded instep shot with the planted foot beside the ball, kicking leg extended forward, a thin straight ball trajectory toward a small simple target crosshair at the far right. BOTTOM LEFT: one player striking a powerful rotational shot, torso twisting, kicking leg following through high and a broad curved force arc around the bright ball. BOTTOM MIDDLE: one player making a dynamic airborne volley, both feet visibly off the ground, one knee tucked and the other leg stretched horizontally to meet a ball at chest height, elegant diagonal body. BOTTOM RIGHT: one exhausted but determined player stretching the last step to finish, long reaching leg poking the ball just ahead of the toe, torso pitched forward, one narrow decisive finishing streak. These are six separate complete compositions, not a continuous scene.

### cards-control.png

- Project file: `C:/Users/devco/Documents/fast-fix/runekick/dist/assets/cards-control.png`
- Original generated file: `C:/Users/devco/.codex/generated_images/01a175e8-707a-7d42-a923-ec30ab946fb7/exec-6c568536-2b1f-4d8a-a521-f2beea88d0ec.png`
- Top row, left to right: cover — 안정된 자세; intercept — 흐름 끊기; tackle — 슬라이딩 태클.
- Bottom row, left to right: focus — 집중의 순간; switch — 균형 잡기; captain — 승부욕.

Final generation prompt:

Use case: stylized-concept. Asset type: ONE production sprite atlas containing exactly SIX distinct football action illustrations for a pixel-art deckbuilding card game. Generate a landscape 1536x768 PNG with actual transparent alpha background. Precisely 3 columns by 2 rows of equal invisible cells. Every cell is an independent composition centered within its own cell, with at least 10 percent empty margins; no parts or motion trails may cross cell boundaries. Read row-major, left to right then next row. No grid lines, frames, labels, letters, numerals, logos, watermarks, UI, or background scenery.
Art style: refined crisp 16-bit pixel illustration with deliberate small square clusters and clean stepped edges. These are action silhouettes, NOT character portraits. Athletes are solid near-black/charcoal shadow silhouettes with strong readable anatomy and football boots; NO face, NO eyes, NO hair details, NO jersey details, NO badges, NO real character identity. The pose itself must clearly explain each action. Bright ivory-white football with a crisp charcoal outline and a few dark football panels; restrained charcoal/grey motion arcs and small warm ivory highlights only. The final icons will sit on light muted ivory card panels. Prefer strong varied full-body poses and visible feet/ball positions over decorative effects. All bodies, limbs, ball and essential action trails fully visible. No blurred glow, no gradients, no haze, no floor rectangle. Each cell must look unmistakably different.
Atlas C, three defensive actions and three mental/balance techniques. TOP LEFT: one black defender in a stable low defensive stance, knees wide and bent, weight centered, arms out for balance, bright ball at ground level just in front, a restrained shield-shaped outline behind the torso. TOP MIDDLE: one black player stepping sideways across an incoming ball path to intercept, lead foot cutting across a horizontal dashed trajectory, ball stopped at the inside of the boot, clear sideways body orientation. TOP RIGHT: one player performing a very low sliding tackle, body nearly on the ground, one straight leg extended to meet the ball, supporting hand behind, crisp ground-level sliding streaks. BOTTOM LEFT: one upright still player concentrating, bright ball under one foot, three crisp nested focus rings around the featureless head, hands calm at sides, contemplative silhouette. BOTTOM MIDDLE: one player balancing on one leg, other knee raised, both arms out, ball suspended just above the lifted foot, a simple curved balance arc underneath. BOTTOM RIGHT: one determined player stepping forward with a clenched fist raised close to the chest, powerful upright posture and other arm pulled back, bright ball at the leading foot, two short emphatic forward ticks. These are six separate complete compositions, not a continuous scene.

## Elite opponents and their exclusive relics

The two new atlases below were produced with the built-in OpenAI image generation tool under the imagegen skill on 2026-10-26. The existing striker, rival and equipment PNGs were inspected as local style references. Each atlas was generated as one unified asset, followed by a layout-only imagegen edit to separate its frames. All generation and edit calls set `transparent_background: true`. The final generated originals were copied unchanged into the project; both initial and final source files remain preserved. No CLI image model or external asset pack was used.

### legends.png

- Project: `C:/Users/devco/Documents/fast-fix/runekick/dist/assets/legends.png`
- Final source: `C:/Users/devco/.codex/generated_images/01a175e8-707a-7d42-a923-ec30ab946fb7/exec-2ee71e76-e07d-4d43-8071-2023aa8b7d5b.png`
- Initial source (not bundled): `C:/Users/devco/.codex/generated_images/01a175e8-707a-7d42-a923-ec30ab946fb7/exec-79f0ac2c-807a-4311-ba0c-3d5e29762022.png`
- Actual final image: 1254×1254 RGBA PNG, 1,193,522 bytes; two columns × two rows.
- Top left: `legend`, Paolo Maldini-inspired red-and-black defender.
- Top right: `legend-zidane`, Zinedine Zidane-inspired white-clad playmaker.
- Bottom left: `legend-ronaldo`, Brazilian Ronaldo Nazario-inspired yellow-and-blue striker.
- Bottom right: `elite`, original purple-clad street dribbler Doyoon.
- All four figures face left. Public footballers are stylized fictional game adaptations, without sponsor logos or club crests.
- Source cropping uses the existing connected-silhouette reader with a row gutter at 52% and a 24-pixel search allowance to retain the wide Ronaldo stance. These bounds are cached once during loading. Frame selection uses `drawPitch(..., { opponentId })`; the existing rival remains the missing-asset fallback.

Initial prompt:

Use case: stylized-concept.
Asset type: ONE production transparent football character sprite atlas for the RUNEKICK pixel-art card battler.
Input images: Image 1 and Image 2 are STYLE REFERENCES ONLY. Match their polished detailed 16-bit pixel-art illustration, stepped pixel contours, cloth folds, bold dark indigo outlines, warm skin shading, athletic proportions and readable expressions. Do not duplicate the characters shown in the references.
Composition: Landscape PNG approximately 2048 by 1024, exactly FOUR equal invisible columns in ONE row. Exactly ONE full-body adult footballer in each cell. Every figure faces LEFT in a three-quarter side view, ready to confront a protagonist standing on the left. All heads and boots fully visible, same standing height, feet aligned near the bottom. Keep at least 12 percent transparent margin on every side of every cell. No character, ball or effect may cross a cell boundary.
Left to right:
1. Paolo Maldini-inspired legendary defender, recognizably long dark brown hair swept back and strong composed facial features. Athletic adult in a black football shirt with restrained deep-red vertical panels, black shorts, black socks with red trim, black cleats. Low stable defensive stance, knees bent, one open hand extended toward the left, calm watchful face. No ball.
2. Zinedine Zidane-inspired legendary playmaker, bald head and distinctive mature composed facial features. White football shirt and white shorts with subtle antique-gold trim, white socks, pearl-grey cleats. Elegant upright technical stance, one foot resting lightly beside a small ivory football, body and head facing left.
3. Brazilian Ronaldo Nazario-inspired legendary striker, NOT Cristiano Ronaldo. Stocky powerful adult athlete with medium-brown skin, very short dark cropped hair and broad characteristic face. Saturated golden-yellow shirt with green collar, royal-blue shorts, white socks with yellow trim, dark cleats. Explosive forward-ready stance angled LEFT, strong legs and shoulders, poised to accelerate. No ball.
4. Doyoon, original young adult Korean male street dribbler. Tousled dark hair, playful confident face, purple jersey with charcoal panels and pale trim, black shorts, purple-black socks, silver-purple cleats. Loose low agile dribbling stance facing LEFT with a small ivory football beside the front boot. No identity resemblance to either reference character.
Style: cohesive polished indie RPG battle sprites, crisp intentional small square pixel clusters, controlled 16-bit highlights and shadows; match reference detail. Characters are solid opaque artwork inside their silhouettes. Transparent alpha outside physical figures and the two small balls. This is a sprite sheet, NOT a poster, lineup photograph, UI mockup or stadium scene.
Avoid: background, floor, contact shadows, glows, halos, smoky clouds, scenery, frames, grid lines, labels, names, lettering, numbers, watermarks, sponsor logos, actual club crests, national badges, cropped feet, extra people, weapons, photorealism, 3D voxel blocks. Preserve wide clean transparent gutters.

Final layout edit prompt:

Edit this existing football sprite atlas for precise production layout. Preserve all FOUR character identities, clothing, colors, detailed crisp pixel-art style, faces, poses, balls, and LEFT-facing orientation. Change the canvas and placement ONLY: make a SQUARE 1536 by 1536 transparent PNG, with EXACTLY TWO equal columns and TWO equal rows. Top-left: long-haired red-and-black legendary defender. Top-right: bald white-clad playmaker. Bottom-left: yellow-and-blue Brazilian striker. Bottom-right: purple street dribbler. One complete full-body figure per cell. Center each full silhouette inside its own 768 by 768 invisible cell, with at least 80 pixels of actual transparent padding on ALL four sides. Scale each complete figure uniformly to FIT inside a 600 by 600 box, preserving proportions, even if this makes some slightly shorter. All hands, heads, boots and balls fully visible. Restore the complete defender's left fingertips if previously cropped. No sprite or object may cross any cell boundary. Do not add new characters. No grid lines or frames, no text, no labels, no logos. Keep all physical characters and balls opaque; every other pixel must have zero alpha. No glow, no halo, no background, no floor, no shadows. This is a reusable separated sprite sheet, not a scene.

### elite-relics.png

- Project: `C:/Users/devco/Documents/fast-fix/runekick/dist/assets/elite-relics.png`
- Final source: `C:/Users/devco/.codex/generated_images/01a175e8-707a-7d42-a923-ec30ab946fb7/exec-ee436533-04a9-492e-96c2-f60acb704720.png`
- Initial source (not bundled): `C:/Users/devco/.codex/generated_images/01a175e8-707a-7d42-a923-ec30ab946fb7/exec-ce0f9d31-e849-45f9-846d-ff8ffa8f4eb8.png`
- Actual final image: 1536×1024 RGBA PNG, 2,189,436 bytes; four columns × three rows.
- Row 1: `libero-seal`, `catenaccio-band`, `clean-sheet-crest`, `maestro-touch`.
- Row 2: `roulette-rune`, `playmaker-lens`, `fenom-cleats`, `nine-crest`.
- Row 3: `burst-laces`, `street-rhythm`, `ankle-tape`, `tempo-charm`.
- All twelve icons have opaque physical surfaces and transparent backgrounds. The numeral 9 appears only on the requested attacking crest.
- Source row gutters are at one-third and 65% of image height to preserve the pendant cord. Frames are trimmed and cached once at load time, then selected with `drawItemArt(..., { id })`. The new Libero Seal image takes precedence over its old equipment-atlas frame; existing equipment/category drawings remain the fallback.

Initial prompt:

Use case: stylized-concept.
Asset type: ONE production transparent sprite atlas of TWELVE elite football relic inventory icons for RUNEKICK.
Input image 1 is a STYLE REFERENCE ONLY. Match the detailed refined pixel clusters, fabric/leather/metal material rendering, bold silhouette, muted indigo shading and antique-gold highlights of its football inventory objects. Do not copy its background, halos or arrangement.
Composition: landscape PNG 1536 by 1024, exactly FOUR equal columns by THREE equal rows, twelve separate icons, one centered complete object per cell. Equal invisible grid, generous transparent gutters, no parts crossing cell boundaries. Keep every icon fully visible with at least 12 percent empty margins. Read row-major from top left.
TOP ROW left to right:
1. Libero Seal: antique-gold defensive shield medal suspended from a short folded navy ribbon, embossed with a small football and laurel. A polished football defender's medal.
2. Catenaccio Band: a heavy rolled steel-grey captain armband with black woven fabric lining and two restrained red bands, squared locking clasp, defensive sturdy silhouette.
3. Clean Sheet Crest: a compact upright silver shield emblem with navy enamel inset and a small clean ivory goal-net motif, a defensive heraldic football badge without lettering.
4. Maestro Touch: a single elegant golden football control boot, fine ivory laces, dark sole and subtle white leather panels, slim technical shape.
MIDDLE ROW left to right:
5. Roulette Rune: a round antique-gold medal with two interlocking curved spiral arrows embossed around a small pale football, navy rim, suggesting a graceful spin.
6. Playmaker Lens: a single round tactical magnifying lens with brass ring, steel-blue glass, short navy leather handle, tiny etched pitch lines visible through the lens, no text.
7. Fenomeno Cleats: a single bold yellow football boot with green trim and a jagged ivory lightning motif, dark studs, muscular explosive design.
8. Nine Crest: a dark navy angular attacking crest bordered in gold with one large clear ivory numeral "9" centered inside. Exactly the numeral 9, no other text.
BOTTOM ROW left to right:
9. Burst Laces: a neatly looped pair of electric-blue boot laces with small crisp pale-blue flame-shaped tips, dark blue fabric core. Physical threads, no ambient glow.
10. Street Rhythm: a purple faceted street-football pendant on a short black cord, metallic grey outline, three angular rhythmic wave marks engraved into the purple face, no letters.
11. Ankle Tape: one rolled ivory athletic ankle tape spool with a short unrolled curling strip, understated charcoal inner spool, tiny purple edge.
12. Tempo Charm: a compact silver winged stopwatch charm with a purple enamel face, one clear hand and small tick marks but no numerals, speed motif and small loop.
Art style: cohesive refined crisp 16-bit pixel illustration; deliberate small square clusters, clean stepped silhouettes, dimensional metal/leather/fabric props. Consistent upper-left lighting. Solid opaque icons with a TRUE fully transparent alpha background everywhere outside their physical silhouette. Make all twelve visually distinct and readable when rendered at 120 by 96 pixels.
Avoid: background, gradient, floor rectangle, ambient glow, haze, contact shadow, framing, labels, grid lines, letters, watermarks, logos, brand marks, club crests, extra objects, blurred edges, photorealism, 3D voxels. Only the eighth icon contains the single requested numeral 9.

Final layout edit prompt:

Edit this existing twelve-icon football relic atlas for precise production layout. Preserve EXACTLY all TWELVE object designs, their identity and order, shapes, colors, materials, the numeral 9 on its crest, and the detailed pixel-art style. Canvas MUST remain 1536 by 1024. Keep EXACTLY FOUR columns by THREE rows, one icon per cell in the SAME row-major order. Scale each complete icon down uniformly and recenter it at the exact center of its own equal grid cell, so the entire icon including ribbon, cords, flames and handle fits within a box at most 270 pixels wide and 240 pixels tall. Use substantial TRUE transparent margins between every icon. Explicit cell centers: x=192,576,960,1344; y=171,512,853. No parts may cross the invisible cell boundaries. Keep the objects solid opaque and make ALL pixels outside physical icons fully alpha-transparent (alpha 0). Remove ambient glows, colored haze, halos, floor shadows and all background. Do not redesign, replace, omit, duplicate or merge any object. No lines, grid, borders, labels, additional lettering or new decorations.
