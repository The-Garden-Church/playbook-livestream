# During Service

## Role responsibilities

<!-- TODO: Expand each role with specific instructions once roles are defined -->

Each Team Member has a defined role for the service. Roles are assigned in advance by the Team Lead.

| Role | Responsibility |
|------|---------------|
| Stream Operator | Monitors encode, bitrate, and stream health end-to-end |
| Camera Operator | Operates assigned camera per shot list and director cues |
| Graphics Operator | Advances slides, fires lower thirds, manages countdowns |
| Team Lead | Overall production, communication, and problem resolution |

## Communication protocol

<!-- TODO: Document IEM/comms setup or however the team communicates during service -->

All communication during the service happens over comms. Keep chatter minimal and call-out focused.

- Call your name before speaking: *"Stream, bitrate is dropping"*
- Acknowledge cues: *"Copy"*
- Flag problems immediately, don't wait

## Stream monitoring

The stream operator monitors the live stream throughout the service on a dedicated device. Check for:

- Bitrate stability
- Audio sync
- Video quality / artifacts
- Platform health (comments, stream status)

## Going live

The stream is live on YouTube from the moment doors open, but it does not show the room until the speaker is ready.

- OBS holds on the **Intro Video** scene, which loops while people are arriving
- Program audio stays muted in OBS for the duration of the loop
- When the speaker is ready, the Stream Operator switches OBS to the live scene and unmutes audio
- Lower thirds are sent from the ProPresenter laptop into OBS over NDI; the Graphics Operator triggers them from ProPresenter

## Recording

The ATEM records program output to the external SSD plugged into it over USB 2. OBS is not the recording source.

- Start the ATEM recording during the final song before the sermon. Starting earlier fills the file with looping intro footage.
- Confirm the ATEM record indicator is active before the sermon begins
- Do not unplug the SSD or stop the recording until after the service has ended
