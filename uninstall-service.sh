#!/bin/bash
# Remove the CODEX LaunchAgent. Stops it and unregisters from auto-start.

PLIST_PATH="$HOME/Library/LaunchAgents/com.codex.bible-study.plist"

if [ -f "$PLIST_PATH" ]; then
  launchctl unload "$PLIST_PATH" 2>/dev/null || true
  rm "$PLIST_PATH"
  echo "✓ CODEX service uninstalled."
else
  echo "No CODEX service installed."
fi
