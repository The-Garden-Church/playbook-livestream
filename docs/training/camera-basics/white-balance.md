# White balance and tint

Light has a color, even when it looks white to you. Your eyes and brain adjust automatically, so a white sheet of paper looks white under a warm lamp and under bright daylight. A camera can't do that by itself. **White balance** tells the camera what color the light in the room is, so white comes out white.

## Color temperature

Light color is measured as **color temperature** in kelvin (K). Lower numbers are warm and orange. Higher numbers are cool and blue.

<div class="kelvin-strip" role="img" aria-label="A strip from orange at 2000 kelvin to blue at 7500 kelvin">
  <span>2000K candle</span>
  <span>3200K tungsten</span>
  <span>5600K daylight</span>
  <span>7500K shade</span>
</div>

Two numbers come up all the time. **3200K** is classic tungsten stage light. **5600K** is daylight. Most LED stage lights can be set to either one, or anywhere in between.

## The setting works backwards

You set the camera to the color of the light, and the camera corrects for it. That means the picture moves the **opposite** way from the number.

- If the camera is set **lower** than the room's light, the picture turns **blue**.
- If the camera is set **higher** than the room's light, the picture turns **orange**.

If faces look orange, lower the white balance number a little. If they look blue, raise it.

## Match the light you actually have

The number printed on a light, or typed into the lighting console, isn't always the color of the light on stage. House lights, LED fixtures and the LED wall all mix together. The reliable way to find the real number is to measure it. Hold a white or gray card where the speaker stands and let the camera's auto white balance read it once. Whatever number it lands on is the color of your room.

From there, adjusting by taste is fine. Setting the camera a few hundred kelvin **higher** than the measured number warms skin up a little, which many people find flattering. Just keep every camera on the same value.

## Tint

Color temperature fixes orange and blue. **Tint** fixes the other direction, green and magenta. LED lights and LED walls are often a little green or a little magenta, which temperature alone can't fix. Tint is a small slider. If skin looks a bit sickly green, move tint toward magenta. If it looks pink, move it toward green.

## Why we lock it

Auto white balance changes as the shot changes. Point the camera at a blue LED wall and the whole picture shifts. Worse, two cameras on auto won't match each other, so every switch between them changes the color of the room.

So we measure the room once, set white balance by hand, and every camera uses **the same values**. When the cameras match, the director can cut between them without the color jumping.

??? note "On Blackmagic cameras"
    Tap the white balance value on the touchscreen to set temperature and tint. You can also hold a white or gray card in the light and use the auto white balance button once to measure it, then leave it alone. Write down the result so every camera can match it.

## What to remember

- White balance tells the camera what color the light is, so white looks white.
- Setting the camera to a lower number makes the picture bluer. A higher number makes it more orange.
- Tint fixes green and magenta.
- Set it by hand and match every camera.
