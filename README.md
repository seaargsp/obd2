# OBD2 Scanner - React Native App

A comprehensive OBD2 diagnostic scanner app for Android, built with React Native. This app connects to ELM327-compatible OBD2 adapters via Bluetooth Classic to provide real-time vehicle diagnostics, live data streaming, and trouble code management.

## Features

### 🚗 Core Functionality
- **Bluetooth Classic Support**: Connect to ELM327 OBD2 adapters
- **Live Data Dashboard**: Real-time monitoring of engine parameters
- **Diagnostic Trouble Codes (DTCs)**: Read and clear error codes
- **Live Charts**: Visualize sensor data over time
- **PID Group Management**: Organize parameters into logical groups
- **Offline Operation**: No cloud dependencies, local storage only

### 📱 User Interface
- **Drawer Navigation**: Easy access to all features via hamburger menu
- **Device Management**: Scan, pair, and manage Bluetooth OBD2 adapters
- **Real-time Updates**: Live data with configurable sampling rates
- **Chart Visualization**: Interactive charts for up to 3 parameters simultaneously
- **Material Design**: Clean, intuitive Android interface

### 🔧 Technical Features
- **SAE J1979 Compliance**: Standard OBD2 protocol implementation
- **ELM327 AT Commands**: Full initialization and control
- **PID Auto-detection**: Query supported parameters from vehicle
- **Error Handling**: Robust connection management and error recovery
- **Permission Management**: Android 12+ Bluetooth permission handling

## Requirements

### Hardware
- Android device (API level 21+, targeting Android 16/API 34)
- ELM327-compatible OBD2 adapter with Bluetooth Classic (SPP)
- Vehicle with OBD2 port (1996+ cars in US, 2001+ in EU)

### Software
- React Native 0.81+
- Android SDK with API level 34
- Node.js 20+

## Installation

### 1. Clone and Install Dependencies
```bash
git clone <repository-url>
cd obd2
npm install
```

### 2. Android Setup
The app requires specific Bluetooth permissions for Android 12+:

#### Permissions (already configured in AndroidManifest.xml):
- `BLUETOOTH_CONNECT` - Required for connecting to devices
- `BLUETOOTH_SCAN` - Required for device discovery
- `ACCESS_FINE_LOCATION` - Required for Bluetooth scanning on older Android versions

#### Install and Configure react-native-bluetooth-classic:
```bash
# Already included in package.json
npm install react-native-bluetooth-classic

# For React Native 0.60+, autolinking should handle the native module
# If needed, run:
cd android && ./gradlew clean && cd ..
```

### 3. Build and Run
```bash
# Start Metro bundler
npm start

# Build and run on Android device/emulator
npm run android
```

## Usage

### 1. Device Connection
1. Open the app and navigate to "Devices" screen
2. Grant Bluetooth permissions when prompted
3. Scan for available OBD2 adapters
4. Connect to your ELM327 adapter
5. The app will automatically initialize the adapter

### 2. Live Data Dashboard
- Navigate to "Dashboard" to view real-time vehicle data
- Toggle PID groups on/off using the switches
- Start/stop streaming with the control button
- Data is organized into logical groups (Engine, Fuel, Air Intake, etc.)

### 3. Diagnostic Codes (DTCs)
- Go to "Error Codes" to read diagnostic trouble codes
- Refresh to get latest codes from the vehicle
- Clear codes using the "Clear Codes" button (requires confirmation)
- View code descriptions and timestamps

### 4. Live Charts
- Navigate to "Charts" for data visualization
- Select up to 3 PIDs to chart simultaneously
- Start streaming to see real-time charts
- Clear chart data as needed

### 5. Settings
- Configure sample rates, units, and other preferences
- Export diagnostic data (feature placeholder)
- View app information and OBD2 protocol details

## Supported PIDs

The app includes definitions for common OBD2 Parameter IDs (PIDs):

### Engine Parameters
- **0C**: Engine RPM
- **0D**: Vehicle Speed
- **04**: Calculated Engine Load
- **05**: Engine Coolant Temperature
- **0F**: Intake Air Temperature

### Fuel System
- **06/07**: Short Term Fuel Trim (Bank 1/2)
- **08/09**: Long Term Fuel Trim (Bank 1/2)
- **0A**: Fuel Pressure
- **10**: Mass Air Flow (MAF) Rate

### Air & Intake
- **0B**: Intake Manifold Absolute Pressure (MAP)
- **11**: Throttle Position
- **33**: Barometric Pressure

### Additional Parameters
- **0E**: Timing Advance
- **14/15**: Oxygen Sensor Values
- **1F**: Runtime Since Engine Start
- **21**: Distance with MIL On
- **42**: Control Module Voltage
- And many more...

## Architecture

### Core Services
- **BluetoothAdapter**: Handles Bluetooth Classic connectivity
- **OBD2Client**: Implements OBD2/ELM327 protocol
- **LiveDataManager**: Manages real-time data subscriptions and streaming

### Data Flow
```
[Android Bluetooth] <-> [BluetoothAdapter] <-> [OBD2Client] <-> [LiveDataManager] <-> [UI Components]
```

### Key Components
- **DeviceListScreen**: Bluetooth device scanning and connection
- **DashboardScreen**: Live data display with PID groups
- **DTCScreen**: Diagnostic trouble code management
- **ChartsScreen**: Real-time data visualization
- **SettingsScreen**: App configuration and preferences

## Troubleshooting

### Common Issues

#### Bluetooth Connection Fails
- Ensure the OBD2 adapter is properly plugged into the vehicle's OBD2 port
- Verify the adapter is powered on (usually indicated by LED)
- Check that the adapter is paired in Android Bluetooth settings
- Try forgetting and re-pairing the device

#### No Data Received
- Confirm the vehicle is running (some PIDs require engine on)
- Check that the adapter supports your vehicle's protocol
- Verify the adapter is properly initialized (ATZ, ATE0, etc.)
- Some vehicles may require specific protocols (ATSP commands)

#### Permission Denied
- Grant all required Bluetooth permissions in Android settings
- For Android 12+, ensure BLUETOOTH_CONNECT and BLUETOOTH_SCAN are allowed
- Location permission may be required for Bluetooth scanning

#### Slow Data Updates
- Adjust sample rate in Settings
- Reduce number of active PIDs in dashboard
- Some adapters have limited bandwidth

### Debug Mode
Check console logs for detailed error messages:
```bash
npx react-native log-android
```

## Development

### Project Structure
```
src/
├── components/        # Reusable UI components
├── screens/          # Main app screens
├── services/         # Core business logic
│   ├── BluetoothAdapter.ts
│   ├── OBD2Client.ts
│   └── LiveDataManager.ts
├── types/            # TypeScript type definitions
├── data/             # Static data (PID definitions)
└── utils/            # Helper functions
```

### Adding New PIDs
1. Update `PID_DEFINITIONS` in `src/data/pidDefinitions.ts`
2. Add decoding formula to `OBD2Client.decodePIDValue()`
3. Update default groups if needed

### Testing
```bash
# Run unit tests
npm test

# Run specific test file
npm test -- --testPathPattern=OBD2Client
```

## References

- **OBD2 Protocol**: [CSS Electronics OBD2 Guide](https://www.csselectronics.com/pages/obd2-explained-simple-intro)
- **Reference Implementation**: [ejvaughan/obdii](https://github.com/ejvaughan/obdii/blob/master/src/OBDII.c)
- **SAE Standards**: SAE J1979 (OBD2), ISO 15765 (CAN/ISO-TP)
- **ELM327 Commands**: ELM327 datasheet and AT command reference

## License

This project is licensed under the GNU GENERAL PUBLIC LICENSE - see the LICENSE file for details.

## Disclaimer

This app is for diagnostic and monitoring purposes only. Always follow safe driving practices and comply with local laws regarding device usage while driving. The authors are not responsible for any damage or issues that may arise from using this software.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Search existing issues in the repository
3. Create a new issue with detailed information about your problem
4. Include device model, Android version, and adapter type