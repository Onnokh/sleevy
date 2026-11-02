#!/bin/zsh
# Render every board SVG to PNG with headless Chrome.
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p renders
for f in Construction*.svg; do
  out="renders/${f:r}.png"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size=2560,1440 \
    --screenshot="$PWD/$out" "file://$PWD/$f" >/dev/null 2>&1
  echo "$out"
done
