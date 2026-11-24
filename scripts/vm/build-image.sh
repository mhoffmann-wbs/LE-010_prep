#!/usr/bin/env bash
# Builds the guest filesystem for v86 into public/vm/ (git-ignored):
#   rootfs.json       the 9p filesystem index (zstd-compressed JSON)
#   rootfs/           one zstd file per file, named by hash and fetched on demand
#   seabios.bin, vgabios.bin, v86.wasm
# Then run scripts/vm/build-state.ts to boot it once and save the snapshot.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$DIR/../.."
OUT="$ROOT/public/vm"
WORK="$ROOT/node_modules/.tmp/vm"
IMAGE=le010/vm
CONTAINER=le010-vm-export

mkdir -p "$OUT" "$WORK"

docker build "$DIR" --platform linux/386 --tag "$IMAGE"

docker rm "$CONTAINER" >/dev/null 2>&1 || true
docker create --platform linux/386 --name "$CONTAINER" "$IMAGE" >/dev/null
docker export "$CONTAINER" > "$WORK/rootfs.tar"
docker rm "$CONTAINER" >/dev/null

python3 -I "$DIR/v86/fs2json.py" --zstd --out "$OUT/rootfs.json" "$WORK/rootfs.tar"
rm -rf "$OUT/rootfs"
mkdir -p "$OUT/rootfs"
python3 -I "$DIR/v86/copy-to-sha256.py" --zstd "$WORK/rootfs.tar" "$OUT/rootfs"

cp "$DIR/v86/seabios.bin" "$DIR/v86/vgabios.bin" "$OUT/"
cp "$ROOT/node_modules/v86/build/v86.wasm" "$OUT/"

echo "Built $OUT. Next: npm run vm:state"
