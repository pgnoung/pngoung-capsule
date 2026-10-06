#!/usr/bin/env bash
set -euo pipefail
CAPSULE_DIR="${PNGOUNG_CAPSULE_DIR:-$HOME/pngoung-capsule}"
CAPSULE_URL="${PNGOUNG_CAPSULE_ARCHIVE_URL:-https://codeload.github.com/pgnoung/pngoung-capsule/tar.gz/refs/heads/main}"
if [ -e "$CAPSULE_DIR" ] || [ -L "$CAPSULE_DIR" ]; then
  echo 'Destination already exists. Launch its installer, or choose a new PNGOUNG_CAPSULE_DIR. Existing files were preserved.' >&2; exit 1
fi
capsule_parent="$(dirname "$CAPSULE_DIR")"
while [ "$capsule_parent" != / ] && [ "$capsule_parent" != . ]; do
  if [ -L "$capsule_parent" ]; then
    capsule_alias_ok=0
    case "$capsule_parent" in
      /var|/tmp|/etc) if [ "$(uname -s)" = Darwin ] && [ "$(cd "$capsule_parent" && pwd -P)" = "/private$capsule_parent" ]; then capsule_alias_ok=1; fi ;;
    esac
    [ "$capsule_alias_ok" = 1 ] || { echo 'Destination parent must not be a symbolic link' >&2; exit 1; }
  fi
  capsule_parent="$(dirname "$capsule_parent")"
done
capsule_tmp="$(mktemp -d)"
trap 'rm -rf "$capsule_tmp"' EXIT
curl -fsSL "$CAPSULE_URL" -o "$capsule_tmp/kit.tgz"
tar -tzf "$capsule_tmp/kit.tgz" > "$capsule_tmp/list"
if grep -E '(^/|(^|/)\.\.(/|$))' "$capsule_tmp/list" >/dev/null; then echo 'Unsafe archive path' >&2; exit 1; fi
tar -tvzf "$capsule_tmp/kit.tgz" > "$capsule_tmp/types"
if awk 'substr($0,1,1) != "-" && substr($0,1,1) != "d" { bad=1 } END { exit !bad }' "$capsule_tmp/types"; then echo 'Archive links and special files are not supported' >&2; exit 1; fi
mkdir "$capsule_tmp/src"
tar -xzf "$capsule_tmp/kit.tgz" -C "$capsule_tmp/src" --strip-components=1
if [ ! -f "$capsule_tmp/src/package.json" ] || ! grep -q '"name": "pngoung-capsule"' "$capsule_tmp/src/package.json"; then echo 'Wrong package' >&2; exit 1; fi
if [ -n "$(find "$capsule_tmp/src" -type l -print -quit)" ]; then echo 'Archive symlinks are not supported' >&2; exit 1; fi
mkdir -p "$CAPSULE_DIR"
cp -R "$capsule_tmp/src/." "$CAPSULE_DIR/"
printf '%s\n' '{"owner":"pngoung-capsule"}' > "$CAPSULE_DIR/.capsule-install.json"
chmod +x "$CAPSULE_DIR"/*.command "$CAPSULE_DIR"/install/*.sh
if [ "${PNGOUNG_CAPSULE_NO_START:-}" = '1' ]; then exec bash "$CAPSULE_DIR/install/pngoung-capsule.sh" install; fi
exec bash "$CAPSULE_DIR/install/pngoung-capsule.sh" start
