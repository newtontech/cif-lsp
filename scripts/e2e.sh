#!/usr/bin/env bash
set -euo pipefail

export CODE_TESTS_PATH="$(pwd)/client/out/test"
export CODE_TESTS_WORKSPACE="$(pwd)/client/testFixture"

# On Linux without a display (e.g. CI), wrap with xvfb-run for headless execution
runner=(node)
if [ "$(uname -s)" = "Linux" ] && [ -z "${DISPLAY:-}" ] && command -v xvfb-run >/dev/null 2>&1; then
  runner=(xvfb-run -a node)
fi

"${runner[@]}" "$(pwd)/client/out/test/runTest"
