#!/bin/sh
# Rebuilds sinovai's share card, card/og.jpg, from card/brand.json, and copies it to ../public/og.jpg, where the
# Worker serves it. It uses the artcraft-brand skill's generator (brandkit.py 1.8, vectorcraft-cli 0.17.0).
#
# The generator always builds a whole kit. This recipe builds it in a temporary folder, keeps web/og.jpg only, and
# deletes everything else unread, icon files included: sinovai has no mark, and choosing one is its owner's.
#
# usage, from brand/:   sh card/recipe.sh
#   ARTCRAFT_BRAND   the skill's folder (default: ~/.kingdom/tools/artcraft-brand)
set -eu

here=$(cd "$(dirname "$0")" && pwd)
skill=${ARTCRAFT_BRAND:-"$HOME/.kingdom/tools/artcraft-brand"}
work=$(mktemp -d "${TMPDIR:-/tmp}/sinovai-card.XXXXXX")
trap 'rm -rf "$work"' EXIT

cp "$here/brand.json" "$work/brand.json"
ARTCRAFT_NO_TRASH=1 python3 -B "$skill/scripts/brandkit.py" "$work/brand.json" --out "$work/kit" --rebuild-check \
  > "$work/build.log" 2>&1 || { cat "$work/build.log"; echo "recipe: the build failed; card/og.jpg is unchanged" >&2; exit 1; }
grep '^verify:' "$work/build.log"

if [ -f "$here/og.jpg" ] && cmp -s "$work/kit/web/og.jpg" "$here/og.jpg"; then
  echo "recipe: card/og.jpg is unchanged (byte for byte)"
else
  cp "$work/kit/web/og.jpg" "$here/og.jpg"
  echo "recipe: card/og.jpg rebuilt; a changed card reaches cached previews only under a new URL"
fi
cp "$here/og.jpg" "$here/../../public/og.jpg"
shasum -a 256 "$here/og.jpg" | sed 's#  .*/brand/#  brand/#'
