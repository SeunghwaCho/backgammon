#!/usr/bin/env bash
set -euo pipefail

# -------------------------------------------------------
# build.sh
# TypeScript를 컴파일하고 실행에 필요한 파일만
# release/ 폴더로 복사합니다.
# -------------------------------------------------------

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE_DIR="$PROJECT_ROOT/release"
DIST_DIR="$PROJECT_ROOT/dist"

echo "==> 빌드 시작: $(date '+%Y-%m-%d %H:%M:%S')"

# 1. TypeScript 컴파일
echo "==> TypeScript 컴파일 중..."
cd "$PROJECT_ROOT"
npx tsc -p tsconfig.json
echo "    컴파일 완료"

# 2. 기존 release 폴더 초기화
echo "==> release/ 폴더 초기화..."
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

# 3. 정적 파일 복사
# index.html의 "dist/main.js" 경로를 "main.js"로 교체해서 복사
echo "==> 정적 파일 복사..."
sed 's|src="dist/main\.js"|src="main.js"|g' "$PROJECT_ROOT/index.html" > "$RELEASE_DIR/index.html"
cp "$PROJECT_ROOT/style.css"  "$RELEASE_DIR/"

# 4. dist/ 에서 테스트 파일을 제외한 .js 파일만 복사
#    (소스맵 .js.map 은 제외, tests/ 디렉터리 제외)
echo "==> JavaScript 파일 복사 (tests 제외)..."

copy_js_dir() {
    local src_subdir="$1"           # e.g. dist/ai
    local rel_subdir="${src_subdir#$DIST_DIR/}"  # e.g. ai

    if [ ! -d "$src_subdir" ]; then
        return
    fi

    mkdir -p "$RELEASE_DIR/$rel_subdir"
    for f in "$src_subdir"/*.js; do
        [ -e "$f" ] || continue     # 파일이 없으면 건너뜀
        cp "$f" "$RELEASE_DIR/$rel_subdir/"
    done
}

# 최상위 dist/*.js
for f in "$DIST_DIR"/*.js; do
    [ -e "$f" ] || continue
    cp "$f" "$RELEASE_DIR/"
done

# 하위 디렉터리 (tests 제외)
for dir in "$DIST_DIR"/*/; do
    dirname="$(basename "$dir")"
    if [ "$dirname" = "tests" ]; then
        echo "    건너뜀: dist/tests/"
        continue
    fi
    copy_js_dir "$dir"
    echo "    복사됨: dist/$dirname/"
done

# 5. 결과 요약
echo ""
echo "==> 빌드 완료!"
echo "    출력 위치: $RELEASE_DIR"
echo ""
echo "    포함된 파일:"
ls -lR "$RELEASE_DIR" | grep "^[^d]" | awk '{print "      " $NF}' 2>/dev/null || true

echo ""
echo "실행 방법: 브라우저에서 release/index.html 을 열거나,"
echo "           'npx serve $RELEASE_DIR' 등의 정적 서버를 사용하세요."
