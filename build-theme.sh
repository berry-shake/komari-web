#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
export VERSION=${VERSION:-$(git describe --tags --exact-match --match '[0-9]*.[0-9]*.[0-9]*' --exclude '*-*' --exclude '*+*' 2>/dev/null || echo dev)}
if [[ "$VERSION" != dev && ! "$VERSION" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
    echo "Expected a numeric VERSION such as 1.2.4" >&2
    exit 1
fi

npm ci
npm audit --audit-level=low
npm test
npm run build
python3 - <<'PACKAGE'
import json
import os
from pathlib import Path
import zipfile

folder = Path('build')
folder.mkdir(exist_ok=True)
theme = json.loads(Path('komari-theme.json').read_text())
theme['version'] = os.environ['VERSION']
with zipfile.ZipFile(folder / 'dist-release.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    archive.writestr('komari-theme.json', json.dumps(theme, ensure_ascii=False, indent=2) + '\n')
    archive.write('preview.png')
    for path in sorted(Path('dist').rglob('*')):
        if path.is_file():
            archive.write(path)
print(f"Built {folder / 'dist-release.zip'} ({theme['version']})")
PACKAGE
