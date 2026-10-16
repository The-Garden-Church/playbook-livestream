# Virtual camera

The practice camera on [Practice: dial in the shot](../../training/camera-basics/practice.md). It's plain static files with no build step, no packages and no network requests beyond its own folder. MkDocs copies the folder as-is.

## Files

| File | What it owns |
|---|---|
| `model.js` | The camera math: stops of exposure, white balance gains, noise, lens blur, LED banding, and the "Director ready" checks. Pure, so Node can import it. |
| `scenarios.js` | The challenges. Each has a title, a brief, the camera's starting settings and any extra checks. |
| `explain.js` | The one-line explainer under each control. |
| `layers.js` | Splits the photo into depth layers and fills each layer in behind the layers in front of it. |
| `scene-loader.js` | Loads `scene/scene.json`, then the photo and its masks. |
| `renderer.js` | The WebGL2 pipeline: per-layer lens blur, then the camera pass (exposure, LED banding, sensor noise, white balance, clipping), then the display pass (zebras, false color, focus peaking). |
| `app.js` | The controls, modes and render loop. |
| `scene/` | `scene.json`, the photo and the masks. |

Run the tests from the repository root with `node --test docs/tools/virtual-camera/*.test.mjs`.

## The scene

The photo is a frame grab from the main camera on a real church stage. The numbers in `scene.json` are the team's real ones, so the blur you see is honest. There isn't much of it.

| Speaker | Lens | Standard aperture | Behind the speaker |
|---|---|---|---|
| 7 m | 55 mm | f/2.8 | Curtains, truss and rails at 10 m, LED wall at 11 m |

It uses an 18.96 mm wide sensor, 4000 K room light, 180° at 30 fps, ISO 400 and tint 0. The photo is a still, so nothing in it moves and the shutter teaches through brightness and LED wall banding.

## Replacing the photo

1. Put the new frame grab at `figures/virtual-camera/source/main.png`.
2. Run `python figures/virtual-camera/make-scenes.py`. It needs `pip install "rembg[cpu]" pillow`. It writes `wide.jpg`, `wide-mask-subject.png` and `wide-mask-wall.png` into `scene/`. If the LED wall's bottom edge moved, change `wall_bottom` in the script first. Look at the subject mask before you use it.
3. Edit `scene/scene.json`:
    - Set each layer's `distanceM` to its real distance from the camera in meters.
    - Change `lens`, `reference` and `lightK` if the camera, its standard settings or the room light are different.
4. Run the tests, then `mkdocs build --strict`, and open the practice page.

### scene.json fields

| Field | Meaning |
|---|---|
| `alt` | What a screen reader says the picture shows. |
| `image` | The photo file, relative to `scene/`. |
| `reference` | The camera's standard settings, the ones the photo looks correctly exposed at. Exposure is counted in stops from here, and "Reset to standard settings" goes back to it. |
| `lightK` | The color temperature of the room light. The photo as shot is the neutral result at this white balance. |
| `lens` | Focal length and sensor width in millimeters, for the depth of field math. |
| `layers` | Each depth layer: `id`, a `label` used in sentences ("the speaker is soft"), `distanceM`, and `mask`. Order doesn't matter. |
| `subject` | The layer the focus check and the focus mark use. |
| `ledWall` | Which layer is the LED wall, its refresh rate in Hz, how many bands fit in the frame height, and how many bands per second they roll. `null` when the shot has no LED wall. |

A layer's `mask` is either a file name or `"remainder"`. In a mask file, white means "this pixel belongs to this layer", black means it doesn't, and gray is a soft edge. Only the red channel is read. Exactly one layer uses `"remainder"`, and it gets every pixel the other masks leave empty. Where masks overlap, the nearer layer wins.

With a single photo there's nothing recorded behind the speaker. `layers.js` fills each layer in behind the layers in front of it, using the colors of the nearby pixels at that depth or farther back. So blur doesn't leave dark halos.

## Notes on the model

- Exposure counts f-numbers in thirds of a stop, so the marked numbers (2.8, 5.6, 11) land on whole stops the way the lessons teach.
- White balance compares two points on the blackbody (Planckian) curve. Setting the camera lower than the room light makes the picture bluer. Higher makes it warmer.
- The LED wall is modeled as refreshing at 60 Hz. Banding disappears when the shutter stays open for a whole number of refreshes, which at 30 fps is 180° and 360°. How fast real bands roll depends on the wall and the camera, so `rollBandsPerS` is set to a speed that's easy to see.
- The focus check counts the speaker as sharp when the blur circle is smaller than 1/1200 of the sensor width.
