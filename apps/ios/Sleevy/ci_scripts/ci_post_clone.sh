#!/bin/sh
# Xcode Cloud runs this after the clone. BuildConfig/Local.xcconfig is
# gitignored, so write it from the workflow's environment variables. Without it
# the build gets the placeholder Google client ids from Shared.xcconfig, and
# App Store Connect refuses the upload (ITMS-90158, invalid URL scheme).
set -eu

: "${GOOGLE_CLIENT_ID_IOS:?Set GOOGLE_CLIENT_ID_IOS in the Xcode Cloud workflow environment}"
: "${GOOGLE_SERVER_CLIENT_ID:?Set GOOGLE_SERVER_CLIENT_ID in the Xcode Cloud workflow environment}"

# The URL scheme is the iOS client id reversed:
# <id>.apps.googleusercontent.com -> com.googleusercontent.apps.<id>
reversed_client_id="com.googleusercontent.apps.${GOOGLE_CLIENT_ID_IOS%.apps.googleusercontent.com}"

cat > "$CI_PRIMARY_REPOSITORY_PATH/apps/ios/Sleevy/BuildConfig/Local.xcconfig" <<EOF
GOOGLE_CLIENT_ID_IOS = $GOOGLE_CLIENT_ID_IOS
GOOGLE_REVERSED_CLIENT_ID_IOS = $reversed_client_id
GOOGLE_SERVER_CLIENT_ID = $GOOGLE_SERVER_CLIENT_ID
EOF
