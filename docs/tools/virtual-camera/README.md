# Virtual camera

The practice camera on [Practice: dial in the shot](../../training/camera-basics/practice.md). It's plain static files with no build step, no packages and no network requests beyond its own folder. MkDocs copies the folder as-is.

## Files

| File | What it owns |
|---|---|
| `model.js` | The camera math: stops of exposure, white balance gains, noise, lens blur, motion blur, the hand gesture, LED banding, and the "Director ready" checks. Pure, so Node can import it. |
| `scenarios.js` | The challenges. Each one names its scene and has a title, a brief, the camera's starting settings and any extra checks. |
| `explain.js` | The one-line explainer under each control. |
| `layers.js` | Splits a photo into depth layers, builds rectangle masks, and fills each layer in behind the layers in front of it. |
| `scene-loader.js` | Loads `scene/scenes.json`, then each scene's photo and masks the first time it's shown. |
| `renderer.js` | The WebGL2 pipeline: per-layer lens blur, then the camera pass (motion blur, exposure, LED banding, sensor noise, white balance, clipping), then the display pass (zebras, false color, focus peaking). |
| `app.js` | The camera picker, controls, modes and render loop. |
| `scene/` | `scenes.json`, the photos and the masks. |

Run the tests from the repository root with `node --test docs/tools/virtual-camera/*.test.mjs`.

## The scenes

Both photos are frame grabs from a real church stage. The numbers in `scenes.json` are the team's real ones, so the blur you see is honest. There isn't much of it.

| Scene | Camera | Speaker | Lens | Standard aperture | Behind the speaker |
|---|---|---|---|---|---|
| `wide` | Main camera, center of the room | 7 m | 55 mm | f/2.8 | Curtains, truss and rails at 10 m, LED wall at 11 m |
| `close` | Side camera, farther back, zoomed in | 14 m | 135 mm | f/4 | Lectern, keyboard and road case at 14.7 m, curtains at 17 m |

Both use an 18.96 mm wide sensor, 4000 K room light, 180° at 30 fps, ISO 400 and tint 0. In the close scene the speaker's hands sweep 6 cm to the right and back, about four times a second, at up to 0.8 m/s. That smears about 18 pixels at 360° and about 2 pixels at 45° on the 1280 pixel wide picture. They sweep toward the face because the left hand touches it in the photo, so moving away would uncover cheek that was never photographed.

## Changing or replacing a photo

1. Put the new frame grab in `figures/virtual-camera/source/` with the same name as the one it replaces (`main.png` for the wide scene, `side.png` for the close scene).
2. Run `python figures/virtual-camera/make-scenes.py wide` (or `close`). It needs `pip install "rembg[cpu]" pillow`. It writes `<scene>.jpg`, `<scene>-mask-subject.png` and, for a scene with an LED wall, `<scene>-mask-wall.png` into `scene/`. Look at the subject mask before you use it.
3. Edit that scene in `scene/scenes.json`:
    - Set each layer's `distanceM` to its real distance from the camera in meters.
    - Check the rectangles in pixel coordinates of the source photo. In the close scene they mark the lectern zone and the hands, and they have to move if the photo changes.
    - Change `lens`, `reference` and `lightK` if the camera, its standard settings or the room light are different.
4. Run the tests, then `mkdocs build --strict`, and open the practice page.

To add a third camera, add another entry to `scenes`. The picker, the focus mark and the checks all read from it.

### scenes.json fields

| Field | Meaning |
|---|---|
| `id`, `label` | The scene's id (scenarios use it) and the picker label. |
| `alt` | What a screen reader says the picture shows. |
| `image` | The photo file, relative to `scene/`. |
| `reference` | The camera's standard settings, the ones the photo looks correctly exposed at. Exposure is counted in stops from here, and "Reset to standard settings" goes back to it. |
| `lightK` | The color temperature of the room light. The photo as shot is the neutral result at this white balance. |
| `lens` | Focal length and sensor width in millimeters, for the depth of field and motion math. |
| `layers` | Each depth layer: `id`, a `label` used in sentences ("the speaker is soft"), `distanceM`, and `mask`. Order doesn't matter. |
| `subject` | The layer the focus check and the focus mark use. |
| `ledWall` | Which layer is the LED wall, its refresh rate in Hz, and how many bands fit in the frame height. `null` when the shot has no LED wall. |
| `motion` | Which layer moves, a `label` for the explainer ("the speaker's hands"), `travelM` (how far it goes from where it is in the photo, in meters), `peakSpeedMps` (its top speed in meters per second), and `direction` in the picture. It goes out and back smoothly. |

A layer's `mask` is one of these:

- A file name. White means "this pixel belongs to this layer", black means it doesn't, and gray is a soft edge. Only the red channel is read.
- `"remainder"`. Exactly one layer per scene uses it. It gets every pixel the other masks leave empty.
- `{ "rects": [[x0, y0, x1, y1], ...], "featherPx": n }`. Rectangles in source photo pixels with a soft edge `n` pixels wide.

Where masks overlap, the nearer layer wins. So the close scene's lectern zone is just a rectangle across the bottom of the frame, and the speaker in front of it takes the pixels it covers.

A layer with `"partOf": "speaker"` is cut out of that layer with its rectangles, like the close scene's hands. It sits in front of the layer it's cut from and moves on its own. Along the cut, the speaker keeps its real colors, so the cut doesn't show while the hands are still. Behind the rectangles, the speaker is filled in with the colors around them, so a moving hand never shows its own outline.

With a single photo there's nothing recorded behind the speaker. `layers.js` fills each layer in behind the layers in front of it, using the colors of the nearby pixels at that depth or farther back. So blur and motion don't leave dark halos, and a moving hand reveals curtain instead of a smear of skin.

## Notes on the model

- Exposure counts f-numbers in thirds of a stop, so the marked numbers (2.8, 5.6, 11) land on whole stops the way the lessons teach.
- White balance compares two points on the blackbody (Planckian) curve. Setting the camera lower than the room light makes the picture bluer. Higher makes it warmer.
- The LED wall is modeled as refreshing at 60 Hz. Banding disappears when the shutter stays open for a whole number of refreshes, which at 30 fps is 180° and 360°. Gear that says "30 fps" actually runs at 29.97, so the bands crawl slowly.
- The focus check counts the speaker as sharp when the blur circle is smaller than 1/1200 of the sensor width.
- Motion turns meters into pixels with the lens: one meter at the subject's distance covers `focal / (distance - focal)` meters on the sensor.
