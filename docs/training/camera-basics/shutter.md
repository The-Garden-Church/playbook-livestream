# Shutter

Video is a quick series of still pictures called **frames**. We shoot at 30 frames per second, so the camera takes a new picture every 1/30 of a second. The shutter decides how much of that time the sensor actually spends collecting light.

## What 180° means

Our cameras show the shutter as an angle, usually **180°**. That number comes from old film cameras.

A film camera had a spinning disc in front of the film. The disc turned exactly once for every frame. A pie slice was cut out of it, and light reached the film only while that open slice passed in front. The size of the slice, in degrees, is the **shutter angle**. A 180° slice is half the disc, so the film got light for half of every frame.

<iframe class="figure-embed" src="../../../figures/shutter.html" title="Interactive figure of a rotary shutter disc" loading="lazy"></iframe>

Digital cameras don't have a spinning disc anymore, but they still use the number. 180° still means "collect light for half of each frame." At 30 frames per second, half of 1/30 is **1/60 of a second**.

| Shutter angle | Open for | At 30 fps |
|---|---|---|
| 90° | One quarter of each frame | 1/120 s |
| 180° | Half of each frame | 1/60 s |
| 360° | The whole frame | 1/30 s |

Some cameras show shutter speed (1/60) instead of angle (180°). They mean the same thing. The nice part about the angle is that it stays right if the frame rate ever changes.

## Why we lock it at 180°

The shutter changes brightness, but we never use it for that. We leave it at 180° for two reasons.

**Motion looks natural.** At 180°, a moving hand has a little bit of blur, the way your eye expects. A much smaller angle makes motion look choppy and stuttery. A bigger angle makes it smeary.

**No flicker or banding.** Stage lights and LED walls don't shine steadily. They pulse many times a second, too fast for your eye to see. If the shutter doesn't line up with that pulsing, the camera sees it as flicker, or as dark bands rolling across an LED wall. In countries with 60 Hz power (like the United States), 1/60 lines up with the lights. That's another reason 180° at 30 fps works.

!!! warning "Don't touch the shutter"
    If the picture is too bright or too dark, fix it with the aperture or ISO, not the shutter. If you see bands on the LED wall, tell the Team Lead. They may fine-tune the shutter before service, but nobody changes it during a service.

??? note "If your power is 50 Hz"
    Much of the world outside the Americas uses 50 Hz power. There, a 1/50 shutter matches the lights. At 30 fps that's a shutter angle of 216°. Your team lead should decide this once and write it down.

??? note "On Blackmagic cameras"
    Tap the shutter value on the touchscreen to see it. The menu can show either angle or speed. Many Blackmagic cameras also suggest "flicker free" shutter values for your power frequency.

## What to remember

- The camera takes 30 pictures a second, and the shutter is how long each one collects light.
- 180° means half of each frame, which is 1/60 s at 30 fps.
- We lock it at 180° for natural motion and no flicker. Never fix brightness with the shutter.
