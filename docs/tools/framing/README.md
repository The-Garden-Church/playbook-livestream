# Frame the shot

The framing practice tool on [Framing the shot](../../training/camera-basics/framing.md). It's plain static files with no build step, no packages and no network requests beyond the site. MkDocs copies the folder as-is.

## Files

| File | What it owns |
|---|---|
| `model.js` | The framing rules: the shot size table, what a frame measures (headroom, eye line, placement, lead room, cuts at joints, lower third clearance), the "Director ready" checks and their coaching, and the bump detector for live moves. Pure, so Node can import it. |
| `calls.js` | The shot calls. Each has the director's words, a brief, the shot it wants, where the speaker goes, the frame it starts in, and any extra checks (lower third, widest, live). |
| `app.js` | The viewfinder, the drag, pinch, key and zoom controls, the guides, the tally light and the modes. |
| `framing.css` | The layout. It copies the practice camera's tokens and phone pattern, with a pinned viewfinder, solid-fill selected states and a 44 px slider touch area. |
| `scene/scene.json` | The landmarks and settings. The photo itself is the practice camera's, at `../virtual-camera/scene/wide.jpg`. |

Run the tests from the repository root with `node --test docs/tools/framing/*.test.mjs`. They check that every shot call starts wrong and has a framing that passes.

## The frame

A frame is `{ cx, cy, width }` in photo pixels. It's always 16:9, so its height is `width * 9 / 16`. The frame can't leave the picture and can't be wider than the photo, which is as wide as the main camera went when the photo was taken.

The speaker stands right of center in the photo. To let a knees-up shot center him, the tool mirrors the right edge of the photo outward by `mirrorRight` pixels (420). The mirrored strip is curtains, rails and the LED wall, so it reads as more of the same stage, but the LED wall picture is mirrored there if you look closely.

## Shot sizes

The size is named by the body part the bottom of the frame lands nearest. Each size has an anchor line between two landmarks. `["waist", "hips", 0.7]` means 70% of the way from the waist down to the hips. The nearest anchor wins.

| Size | Bottom of the frame | Anchor | Headroom rule |
|---|---|---|---|
| ECU, extreme close-up | just under the mouth | eyes to chin, 0.6 | eyes at 28% to 52% of the frame, top of head may be cut |
| CU, close-up | just below the shoulders | shoulders to chest, 0.3 | eyes at 28% to 45%, up to 8% of the frame may trim off the top of the head |
| MCU, medium close-up | middle of the chest | chest to elbows, 0.3 | eyes at 25% to 40% |
| MS, medium shot | just below the belt | waist to hips, 0.7 | eyes at 18% to 38% |
| Cowboy shot | mid-thigh | mid-thigh | 2% to 14% of the frame above the head |
| MLS, medium long shot (knee shot) | just above the knees | knees to mid-thigh, 0.4 | 2% to 14% |
| WS, wide shot | a little below the feet | 12% past the feet | 2% to 20% |
| EWS, extreme wide shot | well below the feet | far past the feet | any |

The tighter shots use the eye line on the top third. The wider shots use the gap above the head, because in a wide shot the eyes sit well above the third line. In the tighter shots the head can't be cut off except where the table says.

A wide shot and an extreme wide can't be framed from this photo, because his feet are below its bottom edge. The "Go wide" call asks for the widest the camera goes instead. A photo that includes his feet would make both sizes work with no code changes.

## Other checks

- **Placement.** Centered means the point between his eyes is within 5% of the frame's width of the middle. Lead room means his face is 56% to 72% of the way across, away from the side he looks toward. He looks toward frame left (`lookDirection`), so he goes on the right third.
- **Joints.** It's a cut at a joint when the bottom edge is within 2% of the frame height of the chin (neck), elbows, waist, knees or ankles, or a side edge is within 2% of the frame width of an elbow.
- **Lower third.** His chin has to sit above the top of the lower third area.
- **Smooth moves.** While the tally is on, the tool samples the frame every animation frame, measures it over 0.1 second steps, and counts a bump when the pan or tilt is faster than 0.9 frame widths per second, the zoom is faster than 0.6 (natural log of the width) per second, or the speed changes by more than 9 per second per second. Bumps less than 0.4 seconds apart count once. The numbers are in `LIVE_LIMITS` and are meant to be forgiving.

## scene.json fields

| Field | Meaning |
|---|---|
| `alt` | What a screen reader says the picture shows. |
| `image` | The photo, relative to `scene/`. |
| `photo` | The photo's width and height in pixels. |
| `mirrorRight` | How many pixels to mirror past the right edge. |
| `zoom` | The widest and tightest frame widths, in photo pixels. |
| `landmarks` | Each body line in photo pixels: `y`, plus `x` for the top of the head and the point between the eyes, and `xs` for the elbows. `estimated` marks a line placed by body proportions because it's hidden (under the shirt, behind the lectern or in the folds of his pants). `belowPhoto` marks a line below the photo's bottom edge. |
| `lookDirection` | Which way he faces. `x: -1` is frame left. |
| `houseHeadroom` | Where the headroom guide line sits, as a share of the frame height from the top. 0.07 suits the knees-up house shot. |
| `lowerThird` | The lower third safe area as shares of the frame: `left`, `right`, `top`, `bottom`. |

### Where the landmarks came from

`headTop` is the top row of the subject mask (`../virtual-camera/scene/wide-mask-subject.png`), which is the top of his cap. The rest were placed by eye on the photo and checked with `python figures/framing/overlay.py`, which draws every line on the photo into `figures/framing/landmarks.jpg` and `landmarks-detail.jpg`. Run it again after any change to the landmarks and look at the result at full size.

His knees are just above the photo's bottom edge, so `knees` is placed from the folds in his pants and from body proportions. His ankles and feet are below the photo, estimated from his head height (about 7.5 heads tall).

### The lower third

The team lead confirmed the lower third sits at the bottom center of the frame, with space on both sides. The size is approximate: 15% to 85% of the frame's width, from 76% to 94% of its height. Change `lowerThird` when the real graphics template is measured.

## Replacing the photo

1. Point `image` at the new photo and set `photo` to its size.
2. Move every landmark, then run `python figures/framing/overlay.py` and check each line sits on the body part.
3. Set `mirrorRight` to 0 if the speaker can be centered without it.
4. Run the tests. If a shot call's `start` frame no longer starts wrong, the tests say which one.
5. Run `python figures/framing/make-crops.py` to rebuild the lesson's pictures, then `mkdocs build --strict`.
