# Issues

This file tracks recurring conceptual/ops issues across OpenWork enterprise and its pinned repos.

## Submodule pin hygiene

- Do not force-push or delete refs that are used as submodule pins in `openwork-enterprise`.
- If a submodule commit is no longer reachable on the remote, teammates will see:
  `fatal: remote error: upload-pack: not our ref <sha>`
- If history must be rewritten in a submodule repo:
  - Create a branch/tag that keeps the old pinned SHA reachable until `openwork-enterprise` is repinned.
  - Land a PR in `openwork-enterprise` that repins the submodule to a reachable commit.

## Repo housekeeping

- Prefer `git pull --recurse-submodules=no` when recovering from broken submodule pins; then repin explicitly.
