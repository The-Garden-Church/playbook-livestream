# Hardware

Reference for every piece of gear the Livestream Team operates. Operational use (when to power on, what to confirm before doors open, how to use focus assist on a serve) lives in the [Weekend Process](weekend-process/pre-service.md) and [Role-Specific Guides](training/roles.md). This page is the inventory and the spec sheet.

!!! info "Credentials"
    Login credentials for hardware management interfaces are stored in the team password vault. See [Credentials](credentials.md).

## Case map

All Livestream gear lives in one of two containers when not deployed:

| Container | Contents |
|-----------|----------|
| **Nanuk 935** (gray hard case) | Camera bodies, lenses, switcher, Hollyland Pyro S kit, camera cage, battery grip, small cables |
| **Blue tub** (generic plastic tub) | Streaming MacBook + charger, external monitor, big cables, headphones, livestream badges |

The Samsung T7 SSD stays mounted in the switcher.

Reference: [Nanuk 935 product page](https://nanuk.com/products/nanuk-935).

## Cameras

Both cameras are **Blackmagic Pocket Cinema Camera 4K** bodies running **Camera OS 8.1**.

| Item | Body | Lens | Accessory | Location | Signal path to switcher |
|------|------|------|-----------|----------|-------------------------|
| Camera 1 (Main) | BMPCC 4K | Lumix G X Vario 35-100mm f/2.8 II POWER O.I.S. (H-HSA35100), 58mm filter thread | SmallRig cage | Center of the room, next to the table | Wired HDMI directly into the switcher's Camera 1 input |
| Camera 2 | BMPCC 4K | Lumix G Vario 100-300mm f/4.0-5.6 II POWER O.I.S. (H-FSA100300), 67mm filter thread | Blackmagic Pocket Camera Battery Grip | Right side of the room, on the walkway | Wireless via Hollyland Pyro S (transmitter at camera, receiver at switcher) |

**Camera power.** Both cameras are powered via the Blackmagic-supplied 12V DC adapter through the barrel jack on the left side of the body. The team does not run on battery during a service.

### Manuals

- [Blackmagic Pocket Cinema Camera 4K, Installation and Operation Manual (PDF)](https://documents.blackmagicdesign.com/UserManuals/BlackmagicCinemaCamerasManual.pdf)
- [Lumix G X Vario 35-100mm f/2.8 II, Owner's Manual (PDF)](https://help.na.panasonic.com/wp-content/uploads/2023/02/HHSA35100_DVQX1200ZA_ENG_FRE_ESP.pdf)
- [Lumix G Vario 100-300mm f/4.0-5.6 II, Owner's Manual (PDF)](https://help.na.panasonic.com/wp-content/uploads/2023/02/HFSA100300_DVQX1184ZA_ENG_FRE_ESP.pdf)
- [Blackmagic Pocket Camera Battery Grip, product page](https://www.blackmagicdesign.com/uk/store/blackmagic-cameras/camera-accessories/W-CIN-14)
- [SmallRig Camera Cage for BMPCC 4K & 6K (2203B), product page](https://www.smallrig.com/smallrig-cage-for-blackmagic-design-pocket-cinema-camera-4k-2203.html)

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

## Wireless video link

Camera 2 sends its program feed back to the switcher wirelessly using the **Hollyland Pyro S** transmitter and receiver kit.

| Component | Where it lives |
|-----------|----------------|
| Pyro S transmitter | Mounted on Camera 2, fed from the camera's HDMI out |
| Pyro S receiver | At the switcher, output into the switcher's Camera 2 HDMI input |

Reference: [Hollyland Pyro S product page](https://www.hollyland.com/product/pyro-s).

## Tripods

Both cameras sit on identical tripod setups.

| Component | Model | Quantity |
|-----------|-------|----------|
| Legs | Manfrotto 190X, aluminum, 3-section (MT190X3) | 2 |
| Head | Manfrotto MVH500AH fluid video head | 2 |

### Manuals

- [Manfrotto MT190X3, product page with manual download](https://www.manfrotto.com/global-en/190x-aluminium-3-section-camera-tripod-mt190x3/)
- [Manfrotto MVH500AH, product page with instructions](https://www.manfrotto.com/global-uk/500-fluid-video-head-with-flat-base-mvh500ah/)

## Switcher

The **Blackmagic ATEM Mini Extreme Pro** is the sole hardware switcher. Its job during a service is narrow: selecting which camera is live. It also embeds audio from the FOH send into the program feed, sends the multiview to the external monitor, sends the program feed over USB-C to the streaming MacBook (where OBS picks it up as a webcam source), and records the program output to the Samsung T7 SSD plugged into its USB-C disk port.

The team interacts with the ATEM in two places:

- **Physical buttons on the unit** for live camera switching during the service
- **ATEM Software Control** on the streaming MacBook, opened before the service only to rename the recording file

Everything else about the broadcast (scenes, intro video, NDI overlays, encoding, streaming to YouTube) is handled by OBS, not the ATEM. See [Broadcast control and streaming](#broadcast-control-and-streaming) below.

| Output | Destination |
|--------|-------------|
| USB-C webcam | Streaming MacBook (OBS picks this up as a webcam input source, used in the live cameras scene) |
| HDMI Out 2 (multiview) | External multiview monitor at the booth |
| USB-C disk | Samsung Portable SSD T7 (recording target) |

Reference: [ATEM Mini Manual (PDF)](https://documents.blackmagicdesign.com/UserManuals/ATEM_Mini_Manual.pdf) (covers all ATEM Mini models, including Extreme Pro).

## Recording

The ATEM Mini Extreme Pro records the program feed directly to a USB-C external SSD. No camera records locally; there are no SD cards or CFast cards in either Pocket Cinema Camera.

| Item | Model | Notes |
|------|-------|-------|
| Recording target | ATEM Mini Extreme Pro internal recorder | Records program out (camera feeds with embedded audio) |
| Recording media | Samsung Portable SSD T7 | Plugged into the ATEM's USB-C disk port; stays mounted in the switcher |

Reference: [Samsung Portable SSD T7, support page](https://www.samsung.com/us/business/support/owners/product/t7-series-1tb/).

## Broadcast control and streaming

**OBS Studio** on the streaming MacBook is the primary driver of the broadcast. The ATEM produces the live camera feed, but OBS is what the audience actually sees on YouTube. OBS handles:

- Scene management (intro video loop, live cameras scene, etc.)
- NDI compositing for lower thirds and graphics overlays sent from the ProPresenter machine
- Audio mute/unmute and level riding
- Encoding the program output
- Streaming to YouTube

| Item | Model / Software | Notes |
|------|------------------|-------|
| Streaming Laptop | MacBook (specific model not material) | Runs OBS. Charger and brick live in the blue tub with the laptop. |
| Broadcast software | OBS Studio | Primary driver. Takes the ATEM program feed (audio embedded) via the ATEM's USB-C webcam output, composites NDI overlays, encodes, and streams. |
| Streaming Platform | YouTube | Destination for the live stream. |

## Multiview monitor

A generic unbranded HDMI monitor (bought off Amazon, no model markings) sits at the booth and shows the ATEM multiview grid. It is fed from **HDMI Out 2** on the back of the ATEM. No manual reference is available since the monitor is unbranded.

## Audio

| Item | Source / Destination | Notes |
|------|----------------------|-------|
| FOH Audio Send | Sound Board, Output 13 | Dedicated output that feeds the livestream rig |
| Audio Cable | Sound Board Output 13 → ATEM Mini Extreme Pro 3.5mm audio input | Dedicated cable kept with the rig for this purpose |
| Audio Routing | Sound Board → ATEM → OBS | The ATEM embeds the audio into the program feed; OBS mutes/unmutes and rides the level |

### Headphones

Audio-Technica ATH-M50. Lives in the blue tub.

Reference: [Audio-Technica ATH-M50, product page](https://www.audio-technica.com/en-us/ath-m50).

## Networking

The streaming MacBook gets internet via a wired Ethernet connection through a USB-C to Gigabit Ethernet adapter.

| Item | Notes |
|------|-------|
| Ethernet path | Router LAN1 port → Cat cable → USB-C to Gigabit Ethernet adapter → MacBook USB-C |
| Router | Managed by the ProPresenter team; out of scope for this playbook. The router must carry NDI traffic between the ProPresenter machine and the streaming MacBook. |
| Backup hotspot | None. The wired connection is the single network source for the stream. |

!!! warning "Single point of failure"
    The wired Ethernet from the building's router is the only path to the internet for the stream. If it drops mid-service, there is no automatic fallback. Flag this to the Team Lead if the team wants to add a hotspot or LTE backup.

## Out of scope (managed by other teams)

These pieces of gear show up in the signal flow but are owned and documented by other teams.

| Item | Owner | Why we still care |
|------|-------|-------------------|
| ProPresenter machine | ProPresenter team | Sends lower thirds and graphics overlays to OBS over NDI |
| Building router / switch | ProPresenter team | Carries NDI between ProPresenter machine and streaming MacBook; also the only internet path for the stream |

## Accessories

- Dedicated audio cable (Sound Board Output 13 → ATEM 3.5mm audio input)
- USB-C to Gigabit Ethernet adapter (brand not material)
- MacBook charger and brick (kept in the blue tub with the laptop)
- HDMI cables (Camera 1 to switcher, Pyro S receiver to switcher, switcher HDMI Out 2 to multiview monitor)
- Blackmagic 12V DC power adapters for both cameras (Blackmagic-supplied)

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
