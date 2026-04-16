#!/usr/bin/env bash
set -euo pipefail

# -------------------------------------------------------
# build.sh
# esbuild로 번들링하여 CSS + JS가 인라인된
# 단일 index.html 파일을 release/ 에 생성합니다.
# -------------------------------------------------------

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE_DIR="$PROJECT_ROOT/release"

echo "==> 빌드 시작: $(date '+%Y-%m-%d %H:%M:%S')"

# 1. 기존 release 폴더 초기화
echo "==> release/ 폴더 초기화..."
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

# 2. esbuild: TypeScript → 단일 번들 JS (minify)
echo "==> esbuild 번들링 중..."
npx esbuild src/main.ts \
  --bundle \
  --minify \
  --target=es2020 \
  --outfile="$RELEASE_DIR/bundle.js"
echo "    번들 완료: $(wc -c < "$RELEASE_DIR/bundle.js") bytes"

# 3. CSS + JS를 index.html에 인라인하여 단일 파일 생성
echo "==> 단일 index.html 생성 중..."
node - "$PROJECT_ROOT" "$RELEASE_DIR" <<'EOF'
const fs   = require('fs');
const path = require('path');

const [,, projectRoot, releaseDir] = process.argv;

const html   = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const css    = fs.readFileSync(path.join(projectRoot, 'style.css'),  'utf8');
const js     = fs.readFileSync(path.join(releaseDir,  'bundle.js'),  'utf8');

const result = html
  .replace('<link rel="stylesheet" href="style.css" />', `<style>\n${css}\n</style>`)
  .replace('<script type="module" src="dist/main.js"></script>', `<script>\n${js}\n</script>`);

fs.writeFileSync(path.join(releaseDir, 'index.html'), result, 'utf8');
EOF

# 4. 임시 bundle.js 삭제
rm "$RELEASE_DIR/bundle.js"

# 5. 결과 요약
SIZE=$(wc -c < "$RELEASE_DIR/index.html")
echo ""
echo "==> 빌드 완료!"
echo "    출력 위치: $RELEASE_DIR/index.html  (단일 파일)"
echo "    파일 크기: ${SIZE} bytes ($(node -e "process.stdout.write((${SIZE}/1024).toFixed(1))") KB)"
echo ""
echo "실행 방법: release/index.html 을 브라우저에서 직접 열면 됩니다."
