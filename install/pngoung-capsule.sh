#!/usr/bin/env bash
# pngoung capsule: install | start | doctor | demo | cli COMMAND
# Private Node.js 22 from nodejs.org when needed; no admin or API key.

set -euo pipefail

APP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME="$APP/.runtime"
NODE_MAJOR=22
cd "$APP"

say() { printf '%s\n' "$*"; }
die() { printf '❌ %s\n' "$*" >&2; exit 1; }

sha256_of() {
  if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'
  else sha256sum "$1" | awk '{print $1}'; fi
}

node_is_new_enough() {
  command -v node >/dev/null 2>&1 || return 1
  local major
  major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  [ "$major" -ge "$NODE_MAJOR" ] 2>/dev/null
}

portable_node() {
  local os arch plat cpu base sums file sha tmp got
  os="$(uname -s)"; arch="$(uname -m)"
  case "$os" in Darwin) plat=darwin ;; Linux) plat=linux ;; *) die "ระบบ $os ยังไม่รองรับ — ติดตั้ง Node.js 22 เองจาก nodejs.org แล้วรันใหม่" ;; esac
  case "$arch" in arm64|aarch64) cpu=arm64 ;; x86_64|amd64) cpu=x64 ;; *) die "CPU แบบ $arch ยังไม่รองรับ" ;; esac
  base="https://nodejs.org/dist/latest-v${NODE_MAJOR}.x"
  say "⬇️  กำลังดาวน์โหลด Node.js ${NODE_MAJOR} (ตัวทางการจาก nodejs.org) มาไว้ในโฟลเดอร์ .runtime"
  sums="$(curl -fsSL "$base/SHASUMS256.txt")" || die "ดาวน์โหลด Node.js ไม่ได้ — เช็กอินเทอร์เน็ตแล้วลองใหม่"
  file="$(printf '%s\n' "$sums" | awk -v want="-${plat}-${cpu}.tar.gz" '{ n = length($2) - length(want) + 1 } n > 0 && substr($2, n) == want && $2 ~ /^node-v/ { print $2; exit }')"
  [ -n "$file" ] || die "ไม่พบ Node.js สำหรับ ${plat}-${cpu}"
  sha="$(printf '%s\n' "$sums" | awk -v f="$file" '$2 == f { print $1 }')"
  tmp="$(mktemp -d)"
  curl -fL --progress-bar -o "$tmp/$file" "$base/$file" || { rm -rf "$tmp"; die "ดาวน์โหลด Node.js ไม่สำเร็จ"; }
  got="$(sha256_of "$tmp/$file")"
  if [ "$got" != "$sha" ]; then rm -rf "$tmp"; die "ไฟล์ Node.js ที่ได้ไม่ตรงกับที่ nodejs.org ประกาศ — หยุดเพื่อความปลอดภัย"; fi
  rm -rf "$RUNTIME/node"; mkdir -p "$RUNTIME"
  tar -xzf "$tmp/$file" -C "$RUNTIME"
  mv "$RUNTIME/${file%.tar.gz}" "$RUNTIME/node"
  rm -rf "$tmp"
  say "✅ Node.js $("$RUNTIME/node/bin/node" -v) พร้อม (อยู่ในโฟลเดอร์Capsuleเท่านั้น ไม่แตะระบบ)"
}

ensure_node() {
  if [ -x "$RUNTIME/node/bin/node" ]; then export PATH="$RUNTIME/node/bin:$PATH"; fi
  if node_is_new_enough && [ -z "${PNGOUNG_CAPSULE_FORCE_PORTABLE_NODE:-}" ]; then return 0; fi
  if [ -n "${PNGOUNG_CAPSULE_FORCE_PORTABLE_NODE:-}" ] && [ -x "$RUNTIME/node/bin/node" ]; then return 0; fi
  portable_node
  export PATH="$RUNTIME/node/bin:$PATH"
}


command_name="${1:-start}"
if [ "$#" -gt 0 ]; then shift; fi
ensure_node
case "$command_name" in
  install|setup) node scripts/setup.mjs ;;
  start|menu) node scripts/setup.mjs; exec node src/server.mjs "$@" ;;
  doctor) exec node src/cli.mjs doctor "$@" ;;
  demo) exec node src/cli.mjs demo "$@" ;;
  cli) exec node src/cli.mjs "$@" ;;
  *) die "Use install, start, doctor, demo, or cli" ;;
esac
