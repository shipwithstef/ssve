# model-intel check — daily schedule

Documented only. Nothing in this file is installed, enabled, or started by the framework.

`node scripts/model-intel.mjs check` is read-only. It detects installed harness CLIs with `--version` and `--help` only, joins that output with flag verify, and exits 1 when it finds drift. It never un-pins a slot and never deletes store files. Replace `<svc-repo>` with the checkout you want checked. Do not point it at a home directory or a secret store.

The snippets below run the check once a day. They do not open a pull request and they do not fetch a vendor changelog.

## cron

```cron
15 6 * * * cd <svc-repo> && /usr/bin/node scripts/model-intel.mjs check
```

## systemd

`model-intel-check.service`:

```ini
[Unit]
Description=Read-only model-intel drift check

[Service]
Type=oneshot
WorkingDirectory=<svc-repo>
ExecStart=/usr/bin/node scripts/model-intel.mjs check
```

`model-intel-check.timer`:

```ini
[Unit]
Description=Daily model-intel drift check

[Timer]
OnCalendar=daily
Persistent=true
Unit=model-intel-check.service

[Install]
WantedBy=timers.target
```

## launchd

`local.model-intel-check.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>local.model-intel-check</string>
  <key>WorkingDirectory</key>
  <string><svc-repo></string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/node</string>
    <string>scripts/model-intel.mjs</string>
    <string>check</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>6</integer>
    <key>Minute</key>
    <integer>15</integer>
  </dict>
</dict>
</plist>
```
