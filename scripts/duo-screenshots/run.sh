#!/bin/zsh
# Screenshots of the Sleevy iOS app on the iPhone Duo simulator, in each
# posture (folded, creased, flat) and orientation, plus one contact sheet
# (sheet.png: a row per posture, a column per orientation).
#
#   scripts/duo-screenshots/run.sh [output-dir]
#   DUO_SCREEN=profile scripts/duo-screenshots/run.sh   # inbox (default), library, folder, profile, search, reader
#   DUO_ORIENTATIONS="portrait landscapeRight landscapeLeft" scripts/duo-screenshots/run.sh
#
# By default one portrait and one landscape shot per posture: upside down
# matches portrait on the inner display and never rotates on the cover, and
# the two landscapes are mirror images. Add landscapeLeft when the side of the
# system rail matters; it moves to the leading edge there.
#
# Needs: the Duo booted with Sleevy installed, Device Hub open on the Duo, and
# Accessibility access for the process that runs this. Posture and rotation go
# through Device Hub's toolbar buttons: there is no posture command, and
# `devicectl device orientation set` turns the device without rotating the
# app's UI. Orientation, display state and the hinge angle are read back with
# `devicectl`, which needs no extra access.
# The app runs in demo mode, so no screenshot shows a real account.
set -euo pipefail

here=${0:A:h}
out=${1:-${here:h:h}/artifacts/duo}
udid=${DUO_UDID:-$(xcrun simctl list devices booted | awk -F'[()]' '/iPhone Duo/ {print $2; exit}')}
[[ -n $udid ]] || { echo "No booted iPhone Duo" >&2; exit 1; }

duoctl=${TMPDIR:-/tmp}/duoctl-$(shasum "$here/duoctl.swift" | cut -c1-12)
[[ -x $duoctl ]] || swiftc -O "$here/duoctl.swift" -o "$duoctl"

postures=(${=DUO_POSTURES:-folded creased flat})
orientations=(${=DUO_ORIENTATIONS:-portrait landscapeRight})

mkdir -p "$out"

active_display() {
  xcrun devicectl device info displays --device "$udid" 2>/dev/null |
    awk '/^\? [0-9]+:/ {id=$2; sub(":", "", id)} /active: true/ {print id; exit}'
}

# Presses a Device Hub button. The toolbar is briefly rebuilt after a posture
# or rotation change, so a missing button is retried.
press() {
  for _ in {1..5}; do
    "$duoctl" press "$1" 2>/dev/null && return
    sleep 1
  done
  "$duoctl" press "$1"
}

orientation() {
  xcrun devicectl device orientation get --device "$udid" 2>&1 | sed -nE 's/.*Orientation: *//p'
}

# Presses Rotate Right until the device reports $1.
rotate_to() {
  for _ in {1..4}; do
    [[ $(orientation) == $1 ]] && return
    press "Rotate Right"
    sleep 2
  done
  [[ $(orientation) == $1 ]] || { echo "could not rotate to $1, at '$(orientation)'" >&2; exit 1; }
}

# True when $1 is wider than it is tall.
is_wide() {
  local w h
  w=$(sips -g pixelWidth "$1" | awk '/pixel/ {print $2}')
  h=$(sips -g pixelHeight "$1" | awk '/pixel/ {print $2}')
  (( w > h ))
}

hinge_angle() {
  # Prints "Angle: 92.5" or "Angle:180.0"; the monitor never exits by itself.
  xcrun devicectl device motion hinge-angle --device "$udid" --timeout 6 2>&1 |
    sed -nE 's/.* Angle: *([0-9.]+).*/\1/p' | head -1 || true
}

# posture label -> Device Hub button, expected active display
typeset -A button=(folded Closed creased Book flat Open)
typeset -A display=(folded 1 creased 3 flat 3)

SIMCTL_CHILD_SLEEVY_DEMO_MODE=1 SIMCTL_CHILD_SLEEVY_DEMO_SCREEN=${DUO_SCREEN:-inbox} \
  xcrun simctl launch --terminate-running-process "$udid" app.sleevy >/dev/null

for posture in $postures; do
  press "${button[$posture]}"
  # The fold animates; wait for the expected display to take over.
  for _ in {1..20}; do
    sleep 1
    shown=$(active_display)
    [[ $shown == ${display[$posture]} ]] && break
  done
  sleep 1
  [[ $shown == ${display[$posture]} ]] ||
    { echo "$posture: expected display ${display[$posture]} active, got '${shown}'" >&2; exit 1; }
  echo "$posture: display $shown active, hinge ${$(hinge_angle):-unknown}°"

  # Rotate Right only turns one way, so start from where the device already
  # is and walk on from there.
  current=$(orientation)
  start=${orientations[(i)$current]}
  (( start > $#orientations )) && start=1
  for orientation in ${orientations[$start,-1]} ${orientations[1,$start-1]}; do
    rotate_to $orientation
    file="$out/$posture-$orientation.png"
    # The UI rotates after the device reports the new orientation. The cover
    # (display 1) is tall in portrait, the inner display (3) is wide.
    [[ $orientation == landscape* ]] && want_wide=1 || want_wide=0
    [[ $shown == 3 ]] && want_wide=$(( 1 - want_wide ))
    for _ in {1..8}; do
      sleep 1
      xcrun simctl io "$udid" screenshot --display "$shown" "$file" >/dev/null 2>&1
      is_wide "$file" && wide=1 || wide=0
      (( wide == want_wide )) && break
    done
    (( wide == want_wide )) && note= || note=" (UI did not rotate)"
    echo "  $orientation -> ${file:t}$note"
  done
done
rotate_to portrait

montage=${TMPDIR:-/tmp}/duo-montage-$(shasum "$here/montage.swift" | cut -c1-12)
[[ -x $montage ]] || swiftc -O "$here/montage.swift" -o "$montage"
sheet=()
for posture in $postures; do
  for orientation in $orientations; do sheet+=("$out/$posture-$orientation.png"); done
done
"$montage" "$out/sheet.png" 420 $#orientations $sheet
echo "sheet -> $out/sheet.png"
