#!/usr/bin/env bash
# Copy the Lena-day workshop files into an OpenWork worktree, or remove them again.
# They never become part of the OpenWork repo: the copied paths are listed in that repo's
# local exclude file (.git/info/exclude), which is not committed or pushed.
#
#   bin/overlay.sh add    <openwork-worktree>
#   bin/overlay.sh remove <openwork-worktree>
#   bin/overlay.sh collect <openwork-worktree>   # copy edits made in the worktree back here
set -euo pipefail
mode=${1:?usage: overlay.sh add|remove <openwork-worktree>}
target=$(cd "${2:?usage: overlay.sh add|remove <openwork-worktree>}" && pwd)
here=$(cd "$(dirname "$0")/.." && pwd)
overlay="$here/overlay"
[ -f "$target/evals/package.json" ] || { echo "Not an OpenWork worktree: $target" >&2; exit 1; }
[ -f "$target/worlds/lib/open-workplace.ts" ] || { echo "This OpenWork checkout has no Open Workplace (worlds/lib/open-workplace.ts); use one that includes it." >&2; exit 1; }

exclude="$(git -C "$target" rev-parse --path-format=absolute --git-common-dir)/info/exclude"
mkdir -p "$(dirname "$exclude")"; touch "$exclude"
begin="# >>> lena-day workshop overlay (openwork-enterprise/workshops/lena-day)"
end="# <<< lena-day workshop overlay"
files=$(cd "$overlay" && find . -type f ! -name .DS_Store | sed 's#^\./##' | sort)

if [ "$mode" = collect ]; then
  n=0; for f in $files; do if [ -f "$target/$f" ] && ! cmp -s "$target/$f" "$overlay/$f"; then cp "$target/$f" "$overlay/$f"; echo "collected $f"; n=$((n+1)); fi; done
  echo "Collected $n changed file(s)."; exit 0
fi

# Drop any previous block, then (for add) write the current file list.
awk -v b="$begin" -v e="$end" '$0==b{skip=1;next} $0==e{skip=0;next} !skip' "$exclude" > "$exclude.tmp" && mv "$exclude.tmp" "$exclude"

case "$mode" in
  add)
    for f in $files; do
      if git -C "$target" ls-files --error-unmatch "$f" >/dev/null 2>&1; then echo "Refusing to overwrite tracked OpenWork file: $f" >&2; exit 1; fi
    done
    { echo "$begin"; for f in $files; do echo "/$f"; done; echo "$end"; } >> "$exclude"
    for f in $files; do mkdir -p "$target/$(dirname "$f")"; cp "$overlay/$f" "$target/$f"; done
    echo "Added $(echo "$files" | wc -l | tr -d ' ') workshop files to $target (git-excluded)."
    ;;
  remove)
    for f in $files; do rm -f "$target/$f"; done
    echo "Removed the workshop files from $target."
    ;;
  *) echo "usage: overlay.sh add|remove|collect <openwork-worktree>" >&2; exit 1 ;;
esac
