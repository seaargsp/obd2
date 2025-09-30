# OBD2 Scanner — Design Document

**Target:** React Native app for **Android 16** (API level 34+).
**Device:** connects via Bluetooth to an ELM327 (classic SPP or BLE variant) OBD-II adapter.

**References:**
- OBD2 primer: https://www.csselectronics.com/pages/obd2-explained-simple-intro
- Reference C implementation (protocol & decoding): https://github.com/ejvaughan/obdii/blob/master/src/OBDII.c

---

## 1. Goals & Scope (high level)

- Connect to ELM327-style OBD2 adapter over **Bluetooth** (support ELM327 Classic SPP adapters — most common — and optionally BLE variant).
- Provide diagnostics operations in 6 different views/screens. I can access each screen from a main hamburger menu:
  - Read Diagnostic Trouble Codes (DTCs).
  - Erase DTCs (Clear codes).
  - Fetch & display Freeze Frame data.
  - Show diagnostic information (VIN, supported PIDs, ECU responses).
  - Live data streaming of selected PIDs with an organizational UI (grouping PIDs into user groups).
  - Plot live data charts for selected PIDs.
- App must work offline (no cloud). Local storage only (user profiles, saved PID groups, chart configs, logs).
- UX: simple, single-screen live dashboard with configurable PID groups + separate details screens for codes & freeze frame accesible through menu.

---

## 2. Platform notes & constraints

- **Android 16** — handle the Android 12+ Bluetooth permission model (runtime permissions `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, `BLUETOOTH_ADVERTISE` when relevant).
- **ELM327 adapters**: most low-cost adapters for Android use **Classic Bluetooth (SPP / RFCOMM)**; some newer adapters support BLE. The app must default to Classic SPP and optionally handle BLE if adapter exposes a serial-like GATT service.

---

## 3. Architecture overview

```
[React Native (pure, native modules)]  <-- RN Bluetooth Bridge -->  [Bluetooth Adapter (ELM327)]
      |                                                |
      | UI/State (Redux/Context)                        | OBD-II: ASCII command / response
      |                                                |
 Local Storage (Realm / AsyncStorage)         |
```

### Major modules

1. **Bluetooth Layer (native bridge)**
   - Responsibilities: discover, pair (if needed), open RFCOMM/serial, send/receive bytes, handle reconnect/backoff, and expose an event stream to JS.
   - Implementation options:
     - `react-native-bluetooth-classic` or `react-native-bluetooth-serial-next` — Classic SPP support.
     - Optionally support BLE using React Native BLE libraries (if adapter is BLE).
   - Must request Android runtime permissions (`BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`) at runtime.

2. **OBD Protocol Layer (JS + optional native helper)**
   - Build/send ASCII requests (e.g. `01 0C` for RPM), parse responses, handle ISO-TP multi-frame if needed. Follow SAE J1979/ISO 15765 conventions; use the CSS Electronics guide for PID semantics.
   - Reuse/port decoding logic from the C reference `OBDII.c` where useful (e.g., request/response formation, PID decoding, DTC parsing).
   - Provide robust timeouts, retry logic, and queueing — the OBD adapter is serial and often only processes one request at a time.

3. **Live Data Manager**
   - Manage subscriptions for PIDs, configurable sampling intervals (e.g., 250ms, 500ms, 1s), queue and decode frames, and dispatch updates to UI and charting system.

4. **UI Layer**
   - Screens/components (see Section 6).

5. **Storage**
   - Save: paired adapter info, saved PID groups, chart configurations, logs (optionally export), user preferences.
   - AsyncStorage okay for small settings.

6. **Charts & Visualization**
   - Use a RN charting library that supports real-time streaming (e.g., `react-native-svg-charts`, `victory-native`, or other maintained libraries). Keep data window ring buffers to limit memory.

---

## 4. Protocol & command handling (technical)

### 4.1 OBD-II basics (requests & responses)
- Use **Mode 01** for current data (PIDs), Mode 03 for stored DTCs, Mode 04 to clear codes, Mode 02 for freeze frame, Mode 09 for vehicle info (VIN). The CSS Electronics page describes PID semantics and request/response framing.

### 4.2 Example simple request flows
- **Request supported PIDs**: `01 00` → response bytes indicate which PIDs supported. Decode bitmask per SAE J1979.
- **Request single PID (e.g., engine RPM)**: `01 0C` → response `41 0C A B` → RPM = ((A*256)+B)/4.
- **Request DTCs**: Mode 03 (`03`) returns packed DTC bytes; parse into Pxx/ Uxx codes using bit masks described in references.

### 4.3 Multi-frame & ISO-TP
- If you need multi-frame ISO-TP support (for some PIDs / extended responses), handle ISO-TP segmentation & reassembly. CSS Electronics covers ISO-TP overview for OBD2 (ISO 15765).
- The C reference (ejvaughan/obdii) implements protocol framing & ISO-TP support — use it as behavioral reference for reassembly rules and error handling.

### 4.4 ELM327 specifics
- ELM327 devices expose a serial ASCII interface:
  - Client writes ASCII commands (e.g. `ATZ`, `ATE0`, `ATL0`, `ATS0`, `010C\r`) and reads ASCII responses (`41 0C 1A F8\r>`).
  - App must initialize adapter: `ATZ` (reset), `ATE0` (echo off), `ATL0` (linefeeds), `ATS0` (spaces off), `ATSP0` (auto protocol) or `ATSP6` (CAN). Use standard ELM327 initialization sequence.

---

## 5. Bluetooth: discovery, connect, stream

### 5.1 Discovery & pairing
- Scan for devices and filter by typical ELM327 names (e.g., `OBDII`, `ELM327`, `OBD2`), but allow manual device address entry.
- For Classic SPP (RFCOMM) adapters: use a Classic Bluetooth RN library (e.g., `react-native-bluetooth-classic` or `react-native-bluetooth-serial-next`). These libraries provide discover/connect/read/write APIs and RFCOMM streaming.

### 5.2 Permissions
- On Android 12+ (targeting Android 16), request runtime permissions:
  - `android.permission.BLUETOOTH_CONNECT` (required for connecting to Bluetooth devices).
  - `android.permission.BLUETOOTH_SCAN` (if scanning).
  - `android.permission.BLUETOOTH_ADVERTISE` (only if advertising).
- For Android < 12 fallbacks, declare `BLUETOOTH`, `BLUETOOTH_ADMIN` and `ACCESS_FINE_LOCATION` where scanning requires it.

### 5.3 Connection handling
- Use a serial queue: only send next OBD request after a response or timeout. Expose a `sendCommand(command, timeoutMs)` that resolves with decoded response or rejects with timeout/parse error.
- Implement automatic reconnect/backoff on disconnect; report to UI.

---

## 6. UI / Screens & Components

### 6.1 Main screens (priority order)
1. **Start / Device List (Pair screen)**
   - Scan / Refresh button, list of devices, show paired devices. Manual connect via MAC/address. Show connection status, RSSI, last seen.
   - Buttons: Connect, Disconnect, Forget.

2. **Dashboard (Live Data) — primary screen**
   - Top bar: connected adapter name + connection status + sample rate control.
   - Grid of **PID Groups**: each group is a card that contains N PID widgets (value + unit + small trend sparkline). Users can create/edit groups.
   - Quick actions: Start/Stop streaming, Add PID to Group, Export snapshot.

3. **Charts / Graph Builder**
   - Select PIDs (from supported list or favorites), timeframe, sampling interval, and start live chart (one chart per screen or multi-trace chart). Allow toggling traces on/off. Chart uses ring buffer and shows e.g., last N minutes.

4. **DTCs (Codes)**
   - Read stored DTCs (Mode 03) with textual description lookup (basic mapping built-in for common PIDs; allow manual notes). Show Clear Codes button (with confirmation).

5. **Freeze Frame / Diagnostic Info**
   - Show last freeze frame data (Mode 02) as decoded PIDs. Also show Mode 09 info (VIN, etc.).

6. **Settings**
   - Adapter init commands (customizable), sample intervals, storage settings, CSV export, units (metric/imperial), chart settings.

### 6.2 Components
- `DeviceList`, `ConnectionBanner`, `PIDCard` (single PID display: name, value, units, small sparkline), `PIDGroupEditor`, `ChartScreen`, `DTCList`, `LogViewer`.

### 6.3 UX details
- Real-time updates must be smooth; debounce UI updates to maintain 30–60fps. Use small sparklines in cards and full charts in chart screen.
- When adding a PID to a group, show only supported PIDs (query with `01 00` and check bits); allow free text custom PID entry (for advanced users).

---

## 7. Data model (DB schema suggestions)

**Tables**
- `adapters` { id, name, address, type, last_paired_at, init_commands_json }
- `pid_defs` { pid_hex, name, units, decoding_formula, min, max, default_group } — preload with common PIDs using CSS Electronics reference.
- `pid_groups` { id, name, ordered_pid_list_json, color }
- `charts` { id, name, pid_list, config_json }
- `dtc_logs` { id, code, description, timestamp }
- `live_samples` — ephemeral (in-memory ring buffers per PID), persist snapshots on user request.

---

## 8. Decoding rules / PID library
- Include a PID registry JSON (PID → decode formula). Example entries:
  - `0C` (Engine RPM): `(A*256 + B)/4` → units `rpm`.
  - `0D` (Vehicle speed): `A` → `km/h`.
- The coding LLM should be instructed to port the relevant decode snippets from `OBDII.c` for correctness and to re-use the C repo as a decoding spec where appropriate.

---

## 9. Charts & performance
- Maintain per-PID circular buffer (e.g., 10k points or time-bounded e.g., last 5 minutes).
- Chart library must support streaming; keep sampling intervals adjustable.
- Limit CPU & memory: aggregate/decimate older samples for long durations (e.g., store 1 sample per second for >10 minutes).

---

## 10. Error handling & edge cases
- Adapter not responding: show UI error and automatic retry.
- Partial/invalid responses: increment error counter, back off, re-init ELM (send `ATZ`, reconfigure) after N failures.
- Clearing codes: require user confirmation (explicit "Clear codes and freeze frame?") — do not auto-clear.
- Multi-ECU vehicles: for some queries physical addressing may be required — expose advanced controls for per ECU ID requests (0x7E0..0x7E7 / 0x7E8..0x7EF).

---

## 11. Security & privacy
- Do NOT upload data off device. Allow export via CSV/Share intent only on user action.
- Warn users about potential security issues if manufacturers block OBD access while driving (some OEM policy trends are noted in reference).

---

## 12. Implementation tasks & API surface (deliverables for coding LLM)

### 12.1 Native / Bridge layer
- Implement `BluetoothAdapter` (JS wrapper) with following promises/events:
  - `scan() -> list of devices`
  - `connect(address) -> connectionHandle`
  - `disconnect()`
  - `write(bytesOrString)`
  - `on('data', (chunk) => {})`
  - `on('status', (connected|disconnected|error) => {})`
- Must request runtime permissions for Android 12+.

**Note:** This is a pure React Native project (no Expo/EAS). Use native modules (autolinking) or community libraries and update AndroidManifest/Gradle config accordingly.

### 12.2 Protocol layer (JS)
- `OBD2Client` class:
  - `init()`: send ELM init commands (`ATZ`, `ATE0`, `ATL0`, `ATS0`, `ATSP0`) — make commands configurable.
  - `sendRequest(service, pidHex, timeoutMs)` → promise.
  - `parseResponse(rawAscii)` → structured object `{ service, pid, values: [A,B,C,...], decodedValue }`
  - `getSupportedPIDs()`, `getDTCs()`, `clearDTCs()`, `getFreezeFrame()`, `getVIN()`.
- Implement queueing: only 1 outstanding request to adapter.

### 12.3 Live streaming
- `LiveManager`:
  - `subscribe(pidHex, sampleRateMs)` and combine multiple PIDs into single request batches where possible to reduce bus load (e.g., poll multiple PIDs sequentially at pace).
  - For each sample, emit `liveUpdate` with timestamp.

### 12.4 UI components & flows
- Implement screens and components described in Section 6. Provide a demo mode with fake data for UI testing when no adapter connected.

### 12.5 Data storage & export
- CSV export for selected logs.

---

## 13. Tests & QA
- **Unit tests** for OBD decoding functions (port sample vectors from `OBDII.c` into JS tests).
- **Integration tests** with a virtualized OBD adapter (or simulator) that sends canned responses; the ejvaughan repo and other simulators can be used to create expected response sequences.
- Manual test checklist:
  - Pair & connect to ELM327 Classic adapter.
  - Read supported PIDs, sample engine RPM, speed, MAF, O₂, MAP.
  - Create PID group and confirm values update and stay in sync.
  - Create chart with 2 traces and verify rendering & buffering.
  - Read/clear DTCs and verify confirmation.

---

## 14. Developer notes & references (explicit list to include in repo)
- Primary OBD primer (for PID lists, CAN IDs, ISO-TP): https://www.csselectronics.com/pages/obd2-explained-simple-intro
- C protocol reference & decoding (port helpers / examples): https://github.com/ejvaughan/obdii/blob/master/src/OBDII.c
- React Native Classic Bluetooth libraries:
  - `react-native-bluetooth-classic`
  - `react-native-bluetooth-serial-next`
- Android Bluetooth permissions & runtime model: Android developer docs (Bluetooth permissions)
- ELM327 AT command basics & serial behavior — use `OBDII.c` and common ELM327 docs as guide.

---

## 15. Example sequences & pseudo-code

### 15.1 Connect flow (pseudo)
```js
await Permissions.request(['BLUETOOTH_CONNECT', 'BLUETOOTH_SCAN']);
const devices = await BluetoothAdapter.scan();
const adapter = devices.find(d => d.name?.includes('ELM') || d.name?.includes('OBD'));
await BluetoothAdapter.connect(adapter.address);
await OBD2Client.init(/* send ATZ, ATE0, ATSP0, etc. */);
const supported = await OBD2Client.getSupportedPIDs(); // ask 01 00 etc.
```

### 15.2 Polling a PID (pseudo)
```js
// queue-based single outstanding request
const resp = await OBD2Client.sendRequest(0x01, 0x0C); // 01 0C => RPM
// resp.values = [A,B] => rpm = ((A<<8) + B) / 4
```

### 15.3 Streaming loop (simplified)
```js
// LiveManager holds subscriptions
every(sampleInterval) {
  for each pid in subscriptionList {
    const r = await OBD2Client.sendRequest(0x01, pid);
    LiveManager.pushSample(pid, decode(pid, r.values));
  }
  emit UI update (batched)
}
```

---

## 16. Implementation priorities / milestones
1. Bluetooth bridge + permission handling + connect/discover. (Core)
2. OBD client: init commands + basic PID request/response + supported PID detection. (Core)
3. Dashboard UI + single PID card + sample display. (Core)
4. DTC read/clear + Freeze frame. (Core)
5. PID grouping & management UI. (Feature)
6. Charts / chart builder. (Feature)
7. Storage, export, tests, simulator. (Polish)

---

## 17. Developer tips & gotchas
- Many ELM327 clones behave slightly differently (timeouts, extra characters, different prompts). Always trim CR/LF and the `>` prompt when parsing. Use the C implementation as a guide for robust parsing.
- Polling too many PIDs at high frequency will flood the adapter / car bus. Recommend grouping and allowing users to set sample rate per group.
- Android background execution: streaming while app is backgrounded has additional OS constraints (not covered in MVP) — implement foreground service only if background operation is required.

---

## 18. Deliverables for coding LLM
- Full React Native project skeleton (pure RN) with:
  - `BluetoothAdapter` native wrapper + docs for native module installation.
  - `OBD2Client` JS module (queueing + decoding).
  - UI screens (DeviceList, Dashboard, DTCs, Freeze Frame, Chart).
  - PID registry JSON (preloaded).
  - Unit tests for decode functions (vectors from `OBDII.c`).
  - Integration test harness with a simple OBD simulator script (send canned responses).

---

## 19. References (explicit)
- CSS Electronics — *OBD2 Explained — A Simple Intro*. Use as the main protocol/PID/CAN reference. https://www.csselectronics.com/pages/obd2-explained-simple-intro
- `ejvaughan/obdii` — C reference implementation: `src/OBDII.c`. Use as decoding / request/response behavior reference. https://github.com/ejvaughan/obdii/blob/master/src/OBDII.c
- React Native Classic Bluetooth libraries (examples): `react-native-bluetooth-classic`, `react-native-bluetooth-serial-next`
- Android Bluetooth runtime permissions: Android developer docs

---

## 20. Final notes (how to hand this to a coding LLM)
- Give the LLM this entire document plus the two URLs verbatim.
- Tell the LLM to:
  1. install the chosen react-native Bluetooth library and include exact native module installation steps and Android manifest/Gradle entries for Android 16 permissions,
  2. port or re-implement the relevant parsing logic from `OBDII.c` at https://github.com/ejvaughan/obdii/blob/master/src/OBDII.c

Pay special attention to the array OBDIIMode1Commands where all the PIDs we want to support and their labels are listed.