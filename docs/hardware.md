# Hardware

Reference for every piece of gear the Livestream Team operates. Operational use (when to power on, what to confirm before doors open, how to use focus assist on a serve) lives in the [Weekend Process](weekend-process/pre-service.md) and [Role-Specific Guides](training/roles.md). This page is the inventory and the spec sheet.

!!! info "Credentials"
    Login credentials for hardware management interfaces are stored in the team password vault. See [Credentials](credentials.md).

<!-- TODO: Fill in remaining gear specifics (camera models, primary switcher model, MacBook spec, networking) -->

## Cameras

Both cameras are Blackmagic Pocket Cinema Cameras (specific model TBD).

| Item | Model | Location | Notes |
|------|-------|----------|-------|
| Camera 1 (Main) | Blackmagic Pocket Cinema Camera | Center of the room, next to the table | Wired directly into the primary switcher's Camera 1 input over HDMI |
| Camera 2 | Blackmagic Pocket Cinema Camera | Right side of the room, on the walkway | Sends signal back to the switcher wirelessly (wireless transmitter / receiver pair) |

### Standard camera settings

These are the baseline settings both cameras run with. Adjust only if room lighting clearly demands it, and reset to these defaults at teardown.

| Setting | Value |
|---------|-------|
| Shutter | 180° (1/50s at 25fps, 1/60s at 30fps) |
| ISO | 400 |
| White Balance | 4000K |
| Aperture | f/4.0 |

### Function buttons

The Pocket Cinema Camera body has function buttons along the top.

| Button | Function | What it does |
|--------|----------|--------------|
| Function 1 (closest to power switch) | Focus assist | Highlights anything in focus in green directly on the camera screen |
| Function 3 (right-most) | Framing guides | Shows horizontal guide lines near the top and bottom of the frame |

### Screen overlays

The Pocket Cinema Camera screen shows shooting info (ISO, shutter, WB, levels) on top of the live image.

- **Swipe up** on the screen to hide the overlay content for a clean view of the shot
- **Swipe down** to bring the overlay back

How and when to use focus assist and framing guides on a serve is covered in the [Camera Operator role guide](training/roles.md#camera-operator).

## Switcher / Vision Mixer

| Item | Model | Location | Notes |
|------|-------|----------|-------|
| Primary Switcher | TBD (hardware switcher) | Livestream Booth | Physical switcher; performs all live camera switching and embeds audio into the program feed |
| Fallback Switcher | Blackmagic ATEM | Livestream Booth | Hardware switcher used as a virtual fallback if the primary switcher goes down; also handles recording (see below) |
| Scene Management | OBS Studio | Streaming MacBook | Not a switcher. Manages OBS scenes (Intro Video loop, live program, etc.), composites NDI overlays, mutes/unmutes audio, encodes, and streams to YouTube |

## Encoding & Streaming

| Item | Model/Software | Notes |
|------|---------------|-------|
| Encoder | OBS Studio | Runs on the streaming MacBook; takes program feed (with embedded audio) from the primary switcher and pushes to YouTube |
| Streaming Platform | YouTube | Primary destination for the live stream |

## Recording

| Item | Model/Software | Notes |
|------|---------------|-------|
| Recorder | Blackmagic ATEM | Records program output for archive and Dropbox upload |
| Recording Drive | External SSD | Small portable SSD plugged into the ATEM over USB 2 |

## Audio

| Item | Source / Destination | Notes |
|------|----------------------|-------|
| FOH Audio Send | Sound Board, Output 13 | Dedicated output that feeds the livestream rig |
| Audio Cable | Sound Board Output 13 → Primary Switcher headphone port | Dedicated cable kept with the rig for this purpose |
| Audio Routing | Sound Board → Primary Switcher → OBS | The switcher embeds the audio into the program feed; OBS mutes/unmutes and rides the level |

## Computers

| Item | Model / Specs | Role | Notes |
|------|---------------|------|-------|
| Streaming Laptop | MacBook (model TBD) | Runs OBS for scene management, audio mute/unmute, encoding, and streaming to YouTube | Charging cable and power brick live in the rig box with the laptop |
| ProPresenter Laptop | TBD | Sends lower thirds and graphics overlays to OBS over NDI | |

## Networking

| Item | Model | Notes |
|------|-------|-------|
| Primary Router/Switch | TBD | Must carry NDI traffic between the ProPresenter laptop and the streaming MacBook |
| Backup Hotspot | TBD | |

## Accessories

<!-- TODO: Cables, mounts, power strips, etc. -->

- Dedicated audio cable (Sound Board Output 13 → Primary Switcher headphone port)
- MacBook charger and brick (kept in the rig box with the streaming laptop)

## Care and maintenance

Keep the booth clean, the gear cared for, and never let an issue go unreported.

- Don't eat or drink directly over gear. Keep drinks tucked away from surfaces where you're working
- Keep lens caps on cameras when not in use
- Coil cables loosely. Never wrap tightly around your hand or elbow
- Label both ends of any cable that isn't obvious
- Store cables in designated bins or cases
- Report fraying cables right away. Do not patch them and leave them in service

### Reporting issues

If something isn't working right:

1. Note the issue during the service debrief
2. Flag it to the Team Lead before you leave
3. Do not attempt repairs beyond basic troubleshooting

<!-- TODO: Add issue log link or process. Document recurring maintenance tasks, firmware update schedules, etc. -->
