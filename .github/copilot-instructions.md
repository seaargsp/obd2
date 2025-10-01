# OBD2 Scanner – Developer Notes

This React Native (Expo) Android app connects to ELM327 OBD2 adapters over Bluetooth Classic (SPP) for real-time diagnostics. It follows a small set of singletons for transport, protocol, and streaming, with a simple drawer-free UI via expo-router.

References
- Protocol reference: https://github.com/ejvaughan/obdii/blob/master/src/OBDII.c
- OBD2 primer: https://www.csselectronics.com/pages/obd2-explained-simple-intro

Tech stack
- Expo ~54, React Native 0.81, TypeScript
- Bluetooth: react-native-bluetooth-classic ^1.73.0-rc.15 (Classic SPP)
- Navigation: expo-router stack (see `app/_layout.tsx`)

Permissions (Android)
- Declared in `app.json`: BLUETOOTH, BLUETOOTH_ADMIN, BLUETOOTH_CONNECT, BLUETOOTH_SCAN, ACCESS_FINE_LOCATION
- Runtime handling for Android 12+ (SCAN/CONNECT) and pre-12 (FINE_LOCATION) in `BluetoothAdapter`

Core services (Singletons)
- `src/services/BluetoothAdapter.ts`
   - Manages SPP connection, bonded device listing, connect/disconnect, and line-delimited reads (CRLF).
   - Emits: `state:change`, `device:list`, `connected`, `disconnected`, `error`, `data`.
- `src/services/OBD2Client.ts`
   - ELM327 init: ATZ, ATE0, ATL0, ATS0, ATSP0 (≈100ms between commands).
   - Serial request queue: one outstanding command; default timeout ≈5s; responses parsed on `>` prompt.
   - SAE J1979 Mode 01/03/04/09 helpers:
      - `query(mode,pid)`: validates 0x40+mode and PID when applicable; decodes via `pidDefinitions`.
      - `readDTCs()`/`clearDTCs()`.
      - Basic VIN (09 02) ASCII extraction.
   - Supported PIDs (Mode 01) detection:
      - `refreshSupportedPIDs(0x01)`: parses bitmasks for 0x00, 0x20, … ranges; caches result; emits `supported:update`.
      - `isSupported(mode,pid)`, `getSupported(mode)`.
   - Emits: `data`, `error`, `connected`, `disconnected`, `supported:update`.
- `src/services/LiveDataManager.ts`
   - PID subscriptions with min interval ≥100ms; `start()`/`stop()` loop polls `OBD2Client`.
   - Skips subscribing to unsupported Mode 01 PIDs once support map is known.
   - Emits: `sample`, `error`, `started`, `stopped`.

Data & definitions
- `src/data/pidDefinitions.ts`: 50+ Mode 01 PIDs with formulas (rpm, speed, temps, trims, voltage, O2 families, etc.).
- Default dashboard groups: Engine Basic, Air & Intake, Temperature.
- `src/types/obd2.ts`, `src/types/bluetooth.ts`, `src/types/dtc.ts` define app types.

Screens (expo-router)
- `app/devices.tsx` → `src/screens/DeviceListScreen.tsx` (bonded list, connect/disconnect, refresh).
- `app/dashboard.tsx` → `src/screens/DashboardScreen.tsx` (live values, start/stop; hides unsupported Mode 01 PIDs using `supported:update`).
- `app/dtc.tsx` → `src/screens/DTCScreen.tsx` (read/clear DTCs).
- `app/diag.tsx` → `src/screens/DiagInfoScreen.tsx` (read VIN).
- `app/settings.tsx` → `src/screens/SettingsScreen.tsx` (sample interval control).

Key behaviors
- Offline only; no cloud.
- Request queue serializes ELM327 access; prompt '>' marks response end.
- Live updates are event-driven; UI subscribes via `useEffect` to service events.
- Dashboard filters Mode 01 PIDs as soon as supported list is known; before that, shows defaults.

Add a new PID
1) Add entry to `PID_DEFINITIONS` with mode, pid, unit, bytes, formula.
2) If special parsing is needed, handle in `OBD2Client.query()` before formula path.
3) Add to a dashboard group (optional).

Known limitations / follow-ups
- VIN (09 02) parsing is basic (ASCII extraction); full ISO‑TP multi-frame assembly is not implemented.
- Freeze frame and charts are not implemented.
- UI is stack-based (expo-router); no drawer; styling is minimal.

Troubleshooting
- If no data appears: ensure permissions are granted, device is connected, and streaming is started on Dashboard.
- If some PIDs don’t show: they may be unsupported; check `client.getSupported(0x01)` or listen for `supported:update`.

## ELM327 Communications

Communicating with the ELM327
All of the responses from the ELM327 are terminated with
a single carriage return character and, optionally, a
linefeed character (depending on your settings).
Properly connected and powered, the ELM327 will
energize the four LED outputs in sequence (as a lamp
test) and will then send the message:
```
ELM327 v2.0
>
```
In addition to identifying the version of this IC,
receiving this string is a good way to confirm that the
computer connections and terminal software settings are correct 
(however, at this point no communications
have taken place with the vehicle, so the state of that
connection is still unknown).
The ‘>’ character that is shown on the second line
is the ELM327’s prompt character. It indicates that the
device is in the idle state, ready to receive characters
on the RS232 port. If you did not see the identification
string, you might try resetting the IC again with the AT
Z (reset) command. Simply type the letters A T and Z
(spaces are optional), then press the return key:
>AT Z
That should cause the leds to flash again, and the
identification string to be printed. If you see strange
looking characters, then check your baud rate - you
have likely set it incorrectly.
Characters sent from the computer can either be
intended for the ELM327’s internal use, or for
reformatting and passing on to the vehicle. The
ELM327 can quickly determine where the received
characters are to be directed by monitoring the
contents of the message. Commands that are
intended for the ELM327’s internal use will begin with
the characters ‘AT’, while OBD commands for the
vehicle are only allowed to contain the ASCII codes for
hexadecimal digits (0 to 9 and A to F).
Whether it is an ‘AT’ type internal command or a
hex string for the OBD bus, all messages to the
ELM327 must be terminated with a carriage return
character (hex ‘0D’) before it will be acted upon. The
one exception is when an incomplete string is sent and
no carriage return appears. In this case, an internal
timer will automatically abort the incomplete message
after about 20 seconds, and the ELM327 will print a
single question mark (‘?’) to show that the input was
not understood (and was not acted upon).
Messages that are not understood by the ELM327
(syntax errors) will always be signalled by a single
question mark. These include incomplete messages,
incorrect AT commands, or invalid hexadecimal digit
strings, but are not an indication of whether or not the
message was understood by the vehicle. One must
keep in mind that the ELM327 is a protocol interpreter
that makes no attempt to assess the OBD messages
for validity – it only ensures that hexadecimal digits
were received, combined into bytes, then sent out the
OBD port, and it does not know if a message sent to
the vehicle was in error.
