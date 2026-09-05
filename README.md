# Waiguru Drive — portfolio design 8

A portfolio you can drive around. A procedural low-poly 3D island (terrain from a noise function, water, 260 instanced trees, clouds) with five buildings mapped to portfolio sections. Park on the glowing pad outside a building to open it. Ten coins to collect, crates to knock over.

- **Three.js only** (vendored in `js/vendor/`, no CDN at runtime), no build step, no 3D asset files: every mesh is a primitive.
- **Cheap to run.** Under 60 draw calls, instanced trees/rocks/coins/clouds, one shadow-casting light that follows the car, and a frame-time governor that steps pixel ratio and shadow quality down before dropping frames.
- **Arcade car**, no physics engine: 40 lines of arithmetic, terrain-following with slope tilt, circle/box collisions, pushable crates, and a splash-and-respawn if you drive into the sea.
- **Two ways in.** Play, or skip: the whole portfolio is real HTML below the canvas and the in-game panels read from it.
- **Keyboard + touch.** WASD/arrows, R to reset, Esc to close; a virtual joystick on phones.
- **Day/night** follows the theme (lamps, lit windows and headlights at night), reduced-motion respected, progress saved locally, plain-HTML fallback without WebGL.

## Run

Any static server, e.g. `python3 -m http.server 8080`, then open http://localhost:8080. (ES modules need http, not `file://`.)

## Editing the island

- `ZONES` in `js/main.js` places the buildings and links each to a section id in `index.html`.
- `height(x, z)` is the terrain; `FLATS` and roads are graded flat automatically around zones.
- `COINS` are world coordinates; the facts they reveal are the `<li>`s in the Garage section.
