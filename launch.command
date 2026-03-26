#!/bin/zsh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

if [ ! -d "node_modules" ]; then
  echo "node_modules 가 없어서 npm install 을 먼저 실행합니다..."
  npm install
  if [ $? -ne 0 ]; then
    echo ""
    echo "의존성 설치에 실패했습니다. 아무 키나 누르면 종료합니다."
    read -r
    exit 1
  fi
fi

echo "메이플 보스 대시보드 개발 서버를 시작합니다."
echo "브라우저에서 http://localhost:5173 를 열어 주세요."
echo ""

npm run dev

echo ""
echo "서버가 종료되었습니다. 아무 키나 누르면 창을 닫습니다."
read -r
