#!/bin/sh
# Takes the still images of Share Setup in the real share sheet of Safari, in
# a clean simulator, in light and dark mode, and puts them in the asset
# catalog. Run it again when iOS changes the share sheet.
set -eu
cd "$(dirname "$0")/.."
SIM=${SIM:-$(xcrun simctl list devices available | grep -m1 -E "iPhone 17 \(" | grep -oE "[0-9A-F-]{36}")}
ASSETS=Sleevy/Assets.xcassets
NAMES="ShareSetupRow ShareSetupMore ShareSetupEdit ShareSetupPlus ShareSetupFirst"

# The App Store name and icon, not the Dev Variant's.
xcodebuild build-for-testing -project Sleevy.xcodeproj -scheme Sleevy \
  -destination "platform=iOS Simulator,id=$SIM" -derivedDataPath /tmp/sleevy-stills-dd \
  SLEEVY_DISPLAY_NAME=Sleevy SLEEVY_APP_ICON=AppIcon -quiet

for APPEARANCE in light dark; do
  # A clean simulator: Sleevy is not yet in the share sheet Favorites.
  xcrun simctl shutdown "$SIM" 2>/dev/null || true
  xcrun simctl erase "$SIM"
  xcrun simctl boot "$SIM"
  xcrun simctl bootstatus "$SIM" -b >/dev/null
  xcrun simctl ui "$SIM" appearance "$APPEARANCE"
  rm -rf "/tmp/sleevy-stills/$APPEARANCE"
  TEST_RUNNER_SLEEVY_CAPTURE_SHARE_STILLS=1 TEST_RUNNER_SLEEVY_STILLS_DIR="/tmp/sleevy-stills/$APPEARANCE" \
    xcodebuild test-without-building -project Sleevy.xcodeproj -scheme Sleevy \
    -parallel-testing-enabled NO -destination "platform=iOS Simulator,id=$SIM" \
    -derivedDataPath /tmp/sleevy-stills-dd \
    -only-testing:SleevyUITests/ShareSetupStillsUITests 2>&1 | grep -E "error:|TEST (SUCCEEDED|FAILED)" || true
done

for NAME in $NAMES; do
  for APPEARANCE in light dark; do
    [ -f "/tmp/sleevy-stills/$APPEARANCE/$NAME.png" ] || { echo "missing $APPEARANCE/$NAME"; exit 1; }
  done
  SET="$ASSETS/$NAME.imageset"
  rm -rf "$SET"; mkdir -p "$SET"
  cp "/tmp/sleevy-stills/light/$NAME.png" "$SET/$NAME.png"
  cp "/tmp/sleevy-stills/dark/$NAME.png" "$SET/$NAME-dark.png"
  cat > "$SET/Contents.json" <<JSON
{
  "images" : [
    { "filename" : "$NAME.png", "idiom" : "universal", "scale" : "3x" },
    {
      "appearances" : [ { "appearance" : "luminosity", "value" : "dark" } ],
      "filename" : "$NAME-dark.png", "idiom" : "universal", "scale" : "3x"
    }
  ],
  "info" : { "author" : "xcode", "version" : 1 }
}
JSON
  echo "wrote $SET"
done
