#!/usr/bin/env bash
# Copies alternate app icon PNGs into the app bundle with iOS naming (e.g. WarmGradientIcon60x60@3x.png).
# actool only emits @2x phone icons; @3x loose files are required for alternate icons on 3x iPhones.
# iOS rejects alternate icons with an alpha channel — flatten each PNG when copying.
set -euo pipefail

ASSETS_DIR="${SRCROOT}/App/Assets.xcassets"
DEST_DIR="${TARGET_BUILD_DIR}/${WRAPPER_NAME}"

if [[ ! -d "$ASSETS_DIR" ]]; then
  echo "warning: Assets.xcassets not found at ${ASSETS_DIR}" >&2
  exit 0
fi

mkdir -p "$DEST_DIR"

python3 - "$ASSETS_DIR" "$DEST_DIR" <<'PY'
import json
import os
import shutil
import subprocess
import sys
import tempfile

assets_dir, dest_dir = sys.argv[1:3]
alternates = ("MonoLightIcon",)


def flatten_png_no_alpha(src: str, dest: str) -> None:
    """Composite onto opaque background; iOS alternate icons must not have alpha."""
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        jpg_path = tmp.name
    try:
        subprocess.run(
            ["sips", "-s", "format", "jpeg", src, "--out", jpg_path],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        subprocess.run(
            ["sips", "-s", "format", "png", jpg_path, "--out", dest],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    finally:
        if os.path.exists(jpg_path):
            os.remove(jpg_path)


for icon_name in alternates:
    set_dir = os.path.join(assets_dir, f"{icon_name}.appiconset")
    contents_path = os.path.join(set_dir, "Contents.json")
    if not os.path.isfile(contents_path):
        print(f"warning: missing {contents_path}", file=sys.stderr)
        continue

    with open(contents_path, encoding="utf-8") as f:
        data = json.load(f)

    for img in data.get("images", []):
        filename = img.get("filename")
        if not filename:
            continue
        if img.get("idiom") == "ios-marketing":
            continue

        src = os.path.join(set_dir, filename)
        if not os.path.isfile(src):
            continue

        size = img["size"]
        scale = img["scale"]
        idiom = img["idiom"]
        dest = f"{icon_name}{size}@{scale}"
        if idiom == "ipad":
            dest += "~ipad"
        dest += ".png"

        dest_path = os.path.join(dest_dir, dest)
        flatten_png_no_alpha(src, dest_path)
        print(f"Copied alternate icon (no alpha): {dest}")

stamp = os.environ.get("SCRIPT_OUTPUT_FILE_0")
if stamp:
    with open(stamp, "w", encoding="utf-8") as f:
        f.write("ok\n")

PY
