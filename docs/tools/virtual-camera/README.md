# Virtual camera

The practice camera on [Practice: dial in the shot](../../training/camera-basics/practice.md). It's plain static files with no build step, no packages and no network requests beyond its own folder. MkDocs copies the folder as-is.

## Files

| File | What it owns |
|---|---|
| `model.js` | The camera math: stops of exposure, white balance gains, noise, lens blur, motion blur, LED banding, and the "Director ready" checks. Pure, so Node can import it. |
| `scenarios.js` | The challenges. Each one is a title, a brief, the camera's starting settings and any extra checks. |
| `explain.js` | The one-line explainer under each control. |
| `layers.js` | Splits the photo into depth layers and fills each layer in behind the layers in front of it. |
| `scene-loader.js` | Loads `scene/scene.json`, the photo and the masks. |
| `renderer.js` | The WebGL2 pipeline: per-layer lens blur, then the camera pass (motion blur, exposure, LED banding, sensor noise, white balance, clipping), then the display pass (zebras, false color, focus peaking). |
| `app.js` | The controls, modes and render loop. |
| `scene/` | The scene description, photo and masks. |

Run the tests from the repository root with `node --test`.

## Swapping in a real photo

The scene is data. To use a real frame grab instead of the drawn placeholder:

1. Save the photo as `scene/stage.jpg`. Any size works. The tool scales it to 1280 pixels wide.
2. Paint one grayscale mask per layer, the same size as the photo. White means "this pixel belongs to this layer", black means it doesn't, and gray is a soft edge. Only the red channel is read.
    - `scene/mask-wall.png`: the LED wall. Banding only appears inside this mask.
    - `scene/mask-mid.png`: the curtains, truss and rails.
    - `scene/mask-subject.png`: the speaker. This is the layer that sways.
    - `scene/mask-lectern.png`: the lectern and anything on it. Delete this layer from `scene.json` if the lectern doesn't need its own mask.
3. Edit `scene/scene.json`:
    - Set `"image": "stage.jpg"`.
    - Set each layer's `distanceM` to its real distance from the camera in meters. The distances decide how soft each layer gets. Keep the speaker's distance as the lectern mark on the focus slider.
    - If the room light isn't 4000 K, change `lightK` and the `wbK` in `reference` to match.
4. Run `mkdocs build` and open the practice page.

One layer must use `"mask": "remainder"`. It gets every pixel the other masks leave empty, so the masks never have to cover the whole photo. Where masks overlap, the overlap is shared between them.

With a single photo there's nothing recorded behind the speaker. `layers.js` fills each layer in behind the layers in front of it, using the colors around the hole, so blur and sway don't leave dark halos or ghost outlines. Masks that hug the edges closely give the cleanest result.

### scene.json fields

| Field | Meaning |
|---|---|
| `image` | The photo file, relative to `scene/`. |
| `reference` | The settings the photo looks correctly exposed at. Exposure is counted in stops from here. |
| `lightK` | The color temperature of the room light. The photo as shot is the neutral result at this white balance. |
| `lens` | Focal length and sensor width in millimeters, for the depth of field math. |
| `layers` | Each depth layer: `id`, a `label` used in sentences ("the speaker is soft"), `distanceM`, and `mask`. Order doesn't matter. |
| `subject` | The layer the focus check and lectern mark use. |
| `ledWall` | Which layer is the LED wall, its refresh rate in Hz, and how many bands fit in the frame height. |
| `motion` | Which layer sways, how far (as a fraction of the image width), how long one sway takes in seconds, and its direction. |

## Regenerating the placeholder

`scene/make-placeholder.mjs` draws the placeholder stage and its masks with Node and no packages:

```sh
node docs/tools/virtual-camera/scene/make-placeholder.mjs
```

## Notes on the model

- Exposure counts f-numbers in thirds of a stop, so the marked numbers (2.8, 5.6, 11) land on whole stops the way the lessons teach.
- White balance compares two points on the blackbody (Planckian) curve. Setting the camera lower than the room light makes the picture bluer. Higher makes it warmer.
- The LED wall is modeled as refreshing at 60 Hz. Banding disappears when the shutter stays open for a whole number of refreshes, which at 30 fps is 180° and 360°. Gear that says "30 fps" actually runs at 29.97, so the bands crawl slowly.
- The focus check counts the speaker as sharp when the blur circle is smaller than 1/1200 of the sensor width.
