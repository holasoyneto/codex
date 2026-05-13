#!/bin/bash
# Install CODEX as a macOS LaunchAgent — starts on login, restarts on crash,
# survives terminal close. One-time setup.

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$(command -v node || echo /usr/local/bin/node)"
PLIST_NAME="com.codex.bible-study"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"
LOG_DIR="$APP_DIR/logs"

mkdir -p "$LOG_DIR"

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_NAME}</string>

  <!-- caffeinate -i prevents idle sleep for as long as the wrapped process
       (node) is running. The Mac can still be locked, but it will not
       sleep, so the phone can always reach the server. -->
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/caffeinate</string>
    <string>-i</string>
    <string>${NODE_BIN}</string>
    <string>${APP_DIR}/server.js</string>
  </array>

  <key>WorkingDirectory</key>
  <string>${APP_DIR}</string>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>

  <key>ProcessType</key>
  <string>Background</string>

  <key>StandardOutPath</key>
  <string>${LOG_DIR}/codex.log</string>

  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/codex.err.log</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>
EOF

# Reload (unload first in case it's already installed).
launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load "$PLIST_PATH"

sleep 1

echo
echo "✓ CODEX installed as a service."
echo "  plist:  $PLIST_PATH"
echo "  logs:   $LOG_DIR/codex.log"
echo
echo "Status:"
launchctl list | grep "$PLIST_NAME" || echo "  (not yet visible — check log file)"
echo
echo "URLs:"
sleep 1
tail -n 12 "$LOG_DIR/codex.log" 2>/dev/null | grep -E "phone|desktop|port" || true
echo
echo "It will auto-start every time you log in, and restart if it ever crashes."
echo "Stop:    launchctl unload $PLIST_PATH"
echo "Restart: launchctl unload $PLIST_PATH && launchctl load $PLIST_PATH"
echo "Logs:    tail -f $LOG_DIR/codex.log"
