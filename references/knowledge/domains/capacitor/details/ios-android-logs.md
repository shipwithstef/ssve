# iOS and Android Device Logs

## Mechanism

Capacitor apps run in a native WebView on both platforms. Logs come from three sources: JavaScript console (WebView), native plugin code (Swift/Kotlin), and the OS itself. This skill covers CLI and GUI tools to stream, filter, and persist logs from all three sources.

## Procedures

### Quick Commands

```bash
# iOS — Stream logs from connected device
xcrun devicectl device log stream --device <UUID>

# iOS — Stream from simulator
xcrun simctl spawn booted log stream

# Android — Stream all logs
adb logcat

# Android — Filter by package
adb logcat --pid=$(adb shell pidof com.yourapp.id)
```

### iOS Logs

**Method 1: Console.app (GUI)**

1. Open Console.app (Applications > Utilities)
2. Select device in sidebar
3. Click "Start Streaming"
4. Filter:
   - By process: `process:YourApp`
   - By subsystem: `subsystem:com.yourapp`
   - By message: `"error"`

**Method 2: devicectl (CLI — Recommended)**

```bash
# List connected devices
xcrun devicectl list devices

# Stream logs from specific device
xcrun devicectl device log stream --device <DEVICE_UUID>

# Stream with predicate filter
xcrun devicectl device log stream --device <DEVICE_UUID> \
  --predicate 'process == "YourApp"'

# Stream specific log levels
xcrun devicectl device log stream --device <DEVICE_UUID> \
  --level error

# Save to file
xcrun devicectl device log stream --device <DEVICE_UUID> \
  --predicate 'process == "YourApp"' > app_logs.txt
```

**Method 3: simctl for Simulators**

```bash
# Stream from booted simulator
xcrun simctl spawn booted log stream

# Filter by process
xcrun simctl spawn booted log stream --predicate 'process == "YourApp"'

# Filter by subsystem
xcrun simctl spawn booted log stream --predicate 'subsystem == "com.yourapp"'

# Show only errors
xcrun simctl spawn booted log stream --level error

# Combine filters
xcrun simctl spawn booted log stream \
  --predicate 'process == "YourApp" AND messageType == error'
```

**iOS Log Predicates**

```bash
# Process name
--predicate 'process == "YourApp"'

# Contains text
--predicate 'eventMessage contains "error"'

# Subsystem
--predicate 'subsystem == "com.yourapp.plugin"'

# Category
--predicate 'category == "network"'

# Log level
--predicate 'messageType == error'

# Combined
--predicate 'process == "YourApp" AND messageType >= error'

# Time-based (last 5 minutes)
--predicate 'timestamp > now - 5m'
```

**iOS Log Levels**

| Level | Description |
|-------|-------------|
| `default` | Default messages |
| `info` | Informational |
| `debug` | Debug (hidden by default) |
| `error` | Error conditions |
| `fault` | Fault/critical |

### Android Logs

**Method 1: adb logcat (CLI)**

```bash
# Basic log stream
adb logcat

# Clear logs first, then stream
adb logcat -c && adb logcat

# Filter by tag
adb logcat -s MyTag:D

# Filter by priority
adb logcat *:E  # Only errors and above

# Filter by package name
adb logcat --pid=$(adb shell pidof com.yourapp.id)

# Filter by multiple tags
adb logcat -s "MyPlugin:D" "Capacitor:I"

# Save to file
adb logcat > logs.txt

# Save to file with timestamp
adb logcat -v time > logs.txt

# Format options
adb logcat -v brief     # Default
adb logcat -v process   # PID only
adb logcat -v tag       # Tag only
adb logcat -v time      # With timestamp
adb logcat -v threadtime # With thread and time
adb logcat -v long      # All metadata
adb logcat -v color     # Colorized output

# Show recent logs (last N lines)
adb logcat -d -t 100

# Show logs since timestamp
adb logcat -v time -T "01-25 10:00:00.000"
```

**Method 2: Android Studio Logcat (GUI)**

1. View > Tool Windows > Logcat
2. Use filter dropdown:
   - Package: `package:com.yourapp`
   - Tag: `tag:MyPlugin`
   - Level: `level:error`
3. Create saved filters for quick access

**Method 3: pidcat (Better CLI Tool)**

```bash
# Install pidcat
pip install pidcat

# Stream logs for package
pidcat com.yourapp.id

# With tag filter
pidcat -t MyPlugin com.yourapp.id
```

**Android Log Priority Levels**

| Letter | Priority |
|--------|----------|
| V | Verbose |
| D | Debug |
| I | Info |
| W | Warn |
| E | Error |
| F | Fatal |
| S | Silent |

**Common Android Filters**

```bash
# Capacitor core logs
adb logcat -s "Capacitor:*"

# Plugin-specific logs
adb logcat -s "CapacitorNativeBiometric:*"

# WebView logs (JavaScript console)
adb logcat -s "chromium:*"

# JavaScript errors
adb logcat | grep -i "js error\|uncaught"

# Crash logs
adb logcat | grep -iE "fatal|crash|exception"

# Network logs
adb logcat -s "OkHttp:*" "NetworkSecurityConfig:*"
```

### Viewing Crash Logs

**iOS Crash Logs**

```bash
# Copy crash logs from device
xcrun devicectl device copy crashlog --device <UUID> ./crashes/

# Or find at:
# Device: Settings > Privacy > Analytics & Improvements > Analytics Data
# Mac: ~/Library/Logs/DiagnosticReports/
```

**Android Crash Logs**

```bash
# Get tombstone (native crash)
adb shell cat /data/tombstones/tombstone_00

# Get ANR traces
adb pull /data/anr/traces.txt

# Get bugreport (comprehensive)
adb bugreport > bugreport.zip
```

### Log Parsing Tips

```bash
# iOS — JavaScript console logs
xcrun simctl spawn booted log stream \
  --predicate 'eventMessage contains "JS:"'

# Android — WebView console
adb logcat chromium:I *:S | grep "console"

# iOS — Network requests
xcrun simctl spawn booted log stream \
  --predicate 'subsystem == "com.apple.network"'

# Android — Network requests
adb logcat -s "NetworkSecurityConfig:*" "OkHttp:*"

# iOS — Memory pressure
xcrun simctl spawn booted log stream \
  --predicate 'eventMessage contains "memory"'

# Android — Memory info
adb shell dumpsys meminfo com.yourapp.id
```

## Error Handling

### No Logs Showing

**iOS:**
- Ensure device is trusted: Xcode > Window > Devices
- Try restarting log stream
- Check Console.app filters

**Android:**
- Enable USB debugging
- Run `adb devices` to verify connection
- Try `adb kill-server && adb start-server`

### Too Many Logs

```bash
# iOS — Only your app
--predicate 'process == "YourApp" AND messageType >= info'

# Android — Only your package
adb logcat --pid=$(adb shell pidof com.yourapp.id)
```

### Missing Debug Logs

**iOS:** Debug logs are hidden by default
```bash
xcrun simctl spawn booted log stream --level debug
```

**Android:** Ensure log level is set correctly
```kotlin
Log.d("Tag", "Debug message")  // D level
```

## Example Marketplace Relevance

Example Marketplace runs on Capacitor v6 with a React frontend talking to Base44 APIs. When a user reports "the check-in button doesn't work" on a physical device, the fastest diagnostic path is:

1. `adb logcat --pid=$(adb shell pidof com.example-marketplace.app)` to see if the plugin call reached native code.
2. `xcrun simctl spawn booted log stream --predicate 'process == "Example Marketplace"'` for iOS simulator reproductions.
3. Filter for `chromium:*` on Android or `subsystem == "com.example-marketplace"` on iOS to isolate WebView console errors (e.g., CORS, missing env vars, Base44 API failures).
