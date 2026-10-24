#!/bin/zsh -l
# Finder starts this in an arbitrary directory with a limited PATH.
cd -- "${0:A:h}" || exit 1
export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$HOME/.volta/bin"

node_supported() {
  command -v node >/dev/null 2>&1 && node -e '
    const [major, minor] = process.versions.node.split(".").map(Number);
    process.exit(major > 22 || (major === 22 && minor >= 17) ? 0 : 1);
  ' >/dev/null 2>&1
}

# Version managers such as nvm/fnm may be initialized only in .zshrc.
if ! node_supported; then
  studio_shell_path=$(/bin/zsh -lic 'printf "\n%s\n" "$PATH"' 2>/dev/null | /usr/bin/tail -n 1)
  if [[ -n "$studio_shell_path" ]]; then export PATH="$studio_shell_path:$PATH"; fi
fi

if ! node_supported; then
  print -u2 -- 'Node.js 22.17 이상과 npm이 필요합니다. 설치 후 다시 실행하세요.'
  print -u2 -- 'Node.js 22.17+ with npm is required. Install it from https://nodejs.org/'
  if [[ -t 0 ]]; then read -r '?Enter 키를 눌러 종료 / Press Enter to exit: '; fi
  exit 1
fi

print -- '편집·Live·OBS 사용 중에는 이 터미널을 유지하세요. 종료: Control+C 또는 창 닫기.'
print -- 'Keep this terminal open while using Studio. Stop with Control+C or close the window.'
exec node tools/start-studio.mjs --check-environment "$@"
