# Figures

Interactive figures for the training pages, drawn with the [Anatomy](https://github.com/wheresryan22/anatomy) kit (MIT, vendored in `anatomy/` from commit `e948829`).

Each folder holds one figure's `build.mjs`. Building it writes a self-contained page to `docs/figures/<name>.html`, which a training page embeds with:

```html
<iframe class="figure-embed" src="../../../figures/<name>.html" title="..." loading="lazy"></iframe>
```

The `src` is relative to the page URL, so a page at `docs/training/camera-basics/aperture.md` (served at `/training/camera-basics/aperture/`) climbs three levels. The embedded page reports its height to `docs/javascripts/figure-embeds.js`, so the frame fits the figure at any width.

Rebuild every figure (Node 20.10 or later, no packages to install):

```sh
for f in figures/*/build.mjs; do node "$f"; done
```

The built pages are committed, so the site deploy never runs Node.
