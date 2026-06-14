#!/usr/bin/env bash
set -euo pipefail

ran=0

has_npm_script() {
  local script="$1"
  [ -f package.json ] || return 1
  node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts[process.argv[1]] ? 0 : 1)" "$script"
}

# Compile TypeScript before running tests if compile script exists
# This ensures compiled test runners are available (e.g., client/out/test/runTest)
if has_npm_script compile; then
  npm run compile
fi

# Run server unit tests (mocha) when compiled output exists.
# Invoking bin/mocha.js via node avoids the mocha CLI shim, which loads a
# yargs version that is incompatible with newer Node ESM handling.
if [ -f ./node_modules/mocha/bin/mocha.js ] && ls server/out/test/*.test.js >/dev/null 2>&1; then
  node ./node_modules/mocha/bin/mocha.js --recursive "server/out/test/*.js"
  ran=1
fi

if has_npm_script test; then
  npm test
  ran=1
fi

if [ -f Cargo.toml ]; then
  cargo test --all-targets --all-features
  ran=1
fi

if ([ -d tests ] || [ -d test ] || [ -f pytest.ini ]) && ([ -f pyproject.toml ] || [ -f setup.py ] || [ -f pytest.ini ]); then
  python -m pytest
  ran=1
fi

if [ "$ran" -eq 0 ]; then
  echo "No test command configured; skipping."
fi
