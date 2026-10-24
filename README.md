# Mesh Avatar Studio KO

**한국어** · [English](README.en.md) · [日本語](README.ja.md)

[원본 Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio)의 비공식 포크입니다. 한국어 UI와 아바타 움직임 확장, Codex를 이용한 제작·검토 흐름을 제공합니다. 원본 개발자는 **Yuki Shindo (shinshin86)**이며, 이 포크는 [sevendays52/mesh-avatar-studio-ko](https://github.com/sevendays52/mesh-avatar-studio-ko)에서 별도로 관리합니다.

한 장의 일러스트를 눈 깜박임·입 모양·고개 회전·호흡·머리카락 흔들림이 있는 2D 메쉬 아바타로 만들고, 로컬 편집기에서 조정할 수 있습니다.

![Miko 샘플을 연 편집기 — 원본의 영어 UI 예시](docs/images/en/01-overview.png)

## 원본과 포크의 차이

기본 편집기, WebGL 엔진, 표정·립싱크, 카메라 추적, 조명, `.mavatar` 공유는 원본의 기능입니다. 이 포크는 다음을 추가하거나 개선합니다.

| 영역 | 이 포크의 변경 사항 |
|---|---|
| 한국어 | 편집기, Live, 조명, 가져오기·내보내기, 에이전트 요청문, 환경 점검의 한국어 안내. 영어·일본어와 기존 중국어 UI도 유지합니다. |
| 고개·상체 | 선택적 리그 데이터로 목 중심 끄덕임, 얼굴 비율 보존, 상체 따라 움직임을 적용합니다. |
| 각도별 원화 | Codex가 상하좌우 원화와 전용 리그·눈·입 그림을 제작하고 자동 등록합니다. 기존 pitch 전용 원화·대응 격자도 유지합니다. |
| 얼굴 추적 | 정면 교정 기준 상대 회전, 끄덕임 방향·감도·반전, 입 벌림·입 모양 감도를 조정합니다. |
| 볼·미리보기 | 볼 부풀림과 입 모양·상체 끄덕임 테스트를 제공합니다. 볼 변형에는 리그 설정이 필요합니다. |
| 방송 구도 | Live에서 확대·축소·위치를 조절하고 OBS 스트림 화면에 같은 구도를 전달합니다. |
| 제작 도구 | 추가 리그·원화 데이터 검증, 스프라이트 재빌드 시 원화 데이터 보존, 포즈 검토와 회귀 테스트를 확장합니다. |

새 리그·스프라이트 데이터는 선택 사항입니다. 해당 데이터가 없는 기존 아바타의 변형은 그대로 유지하며 공개 런타임 API와 기존 형식의 의미를 보존합니다. 구형 런타임에서는 새 효과가 표시되지 않을 수 있습니다. 중간 각도에서는 원화의 선·명암 차이로 선이 부드럽거나 겹쳐 보일 수 있습니다.

이 포크의 한국어 지원 범위는 로컬 Studio와 Live입니다. 상세 기술 문서와 별도 소개 사이트·Player에는 영어·일본어 자료가 남아 있습니다. [원본 소개 사이트](https://shinshin86.github.io/mesh-avatar-studio/)와 [원본 Player](https://shinshin86.github.io/mesh-avatar-studio/play/)는 원본 서비스이며 이 포크의 추가 기능을 포함하지 않습니다.

## 설치와 실행

Codex에 일반 아바타 제작을 맡기면 [자동 원화 제작 지침](docs/codex-authoring.md)에 따라
감은 눈·반감은 눈·웃는 눈, 발화 입 모양과 상하좌우 고개 그림을 편집하고 각 그림의 전용
리그·레이어에 적용합니다. 외부 이미지 전송은 그림 세트를 설명하고 동의를 받은 뒤 진행합니다.
생성 도구가 없거나 동의하지 않은 경우에는 원화가 미완성임을 알리고 메쉬 미리보기를 제공합니다.
Studio가 생성 서비스를 직접 호출하는 방식은 아니며, Codex가 제작 도구를 실행합니다.

다른 컴퓨터에서 제작을 이어가려면 [제작 가이드](docs/agent-guide.md#working-on-another-machine)에 따라 코드 버전과 의존성을 맞추고 전체 프로젝트 폴더를 준비하세요. `projects/`는 Git에 포함되지 않습니다.

### Windows 실행파일로 시작

처음 clone한 뒤 저장소 폴더에서 Codex에 **“실행 준비해줘”**라고 요청하면 됩니다.
Codex는 `AGENTS.md`에 따라 필요한 환경과 패키지를 확인하고 실행파일·런타임을 빌드합니다.
그다음부터는 아래 실행파일을 더블클릭해 사용합니다.

이 작업 폴더의 **`MeshAvatarStudio.exe`를 더블클릭**하면 로컬 서버와 브라우저가 열립니다.
실행파일은 저장소 폴더 안에 두고 `tools/launcher-runtime/`도 함께 유지하세요. 함께 준비된
Node.js·npm을 사용하며, 패키지가 없으면 첫 실행에서 자동 설치합니다(인터넷 연결 필요).
실행 창을 닫거나 **종료 / Stop Studio**를 누르면 서버도 종료됩니다. 편집·Live·OBS 사용 중에는
이 창을 켜 두세요. 이미 실행 중이면 다시 실행해 브라우저를 열 수 있습니다.

브라우저에서 **프로젝트 선택 → 새 프로젝트 만들기 → 이미지 선택 → 프로젝트 만들기**를
진행합니다. 이미지가 저장되면 Codex 안내 화면으로 넘어갑니다. **저장소 폴더 경로 복사**로
해당 폴더에서 Codex를 열고 **Codex 요청문 복사**를 붙여 넣으세요. 페이지는 리그·레이어 제작
완료를 확인하며, 준비되면 **완성된 아바타 열기**를 누를 수 있습니다. 제작 대기 프로젝트는
목록에서 다시 열 수 있습니다. PNG 원본은 그대로 보존하고 JPEG·WebP는 로컬에서 PNG로 변환합니다.

실행파일과 포함된 런타임은 로컬 빌드 결과이며 Git에 포함하지 않습니다. 새로 clone한 폴더에서
실행파일을 만들려면 Node.js·npm이 설치된 Windows에서 한 번 실행하세요:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/build-launcher.ps1
```

이 명령은 Windows 기본 C# 컴파일러로 실행파일을 만들고 설치된 Node.js·npm을 로컬 런타임으로
복사합니다. 실행파일만 빌드하려면 `-WithoutRuntime`을 사용하세요(실행할 PC에 Node.js 필요).
이미지 인식·리그 제작은 Codex에서 진행하며, Python·uv·Chromium 등 제작 도구는 별도 준비합니다.

### macOS에서 더블클릭으로 시작

Node.js **22.17 이상과 npm**을 설치한 뒤, 이 저장소 폴더의
**`MeshAvatarStudio.command`를 더블클릭**하세요. 터미널이 열리고 환경 점검 후
한국어 프로젝트 선택 화면을 브라우저로 엽니다. 패키지가 없으면 첫 실행에서
`npm ci`로 자동 설치합니다(인터넷 연결 필요). Windows용 `.exe`와 포함된
`node.exe`는 사용하지 않으며, 맥에 설치한 Node.js·npm을 사용합니다.

편집·Live·OBS 사용 중에는 열린 터미널을 유지하세요. **Control+C를 누르거나
터미널 창을 닫으면 서버가 종료**됩니다. 다시 시작할 때는 `.command`를 더블클릭하세요.
프로젝트 만들기 → 이미지 선택 → Codex 요청문 복사 → 완성된 아바타 열기 흐름은 Windows와 같습니다.

Git으로 clone하면 실행 권한이 함께 내려옵니다. ZIP 압축 해제 등으로 실행 권한이
없어졌다면 저장소 폴더의 터미널에서 `chmod +x MeshAvatarStudio.command`를 실행하세요.
Node 버전 관리자를 사용한다면 로그인/대화형 zsh에서 Node가 보이도록 설정하세요.
스크립트는 Homebrew·사용자 도구 경로와 로그인 셸의 PATH를 확인합니다.

아바타 제작과 레이어 재생성을 위해서는 **uv와 일반 Python 3.10~3.13**,
포즈 이미지 검토를 위해서는 **Playwright Chromium**도 준비하세요.
uv가 설치된 상태에서 다음을 한 번 실행합니다:

```sh
npm ci
uv python install 3.12
npx playwright install chromium
node tools/doctor.mjs --lang ko
```

uv 설치: [공식 설치 안내](https://docs.astral.sh/uv/getting-started/installation/).
환경 점검의 경고는 편집기 실행과 별개이며, 아바타 제작 전에 해결해야 합니다.
Live의 카메라·마이크는 브라우저 권한과 macOS의 개인정보 보호 설정도 확인하세요.

### 터미널에서 실행

Node.js **22.17 이상**과 Git이 필요합니다. 레이어 제작·재생성에는 **일반 Python 3.10~3.13과 uv**, 포즈 이미지 검토에는 **Playwright Chromium**도 필요합니다.

```sh
git clone https://github.com/sevendays52/mesh-avatar-studio-ko.git
cd mesh-avatar-studio-ko
npm ci
node tools/doctor.mjs --lang ko
npm start
```

`npm start`는 한국어 프로젝트 선택 화면을 브라우저로 엽니다. 개발용 `npm run dev`는 터미널에 표시된 주소(예: `http://127.0.0.1:5173/`)를 직접 열며 기본적으로 Miko 샘플을 표시합니다. 상단 언어 선택은 브라우저에 저장됩니다. 샘플 수정 시 **복사하고 편집 계속**을 선택하면 `projects/`의 사본으로 작업합니다.

제작 도구가 없다면 먼저 uv를 설치한 뒤 다음을 실행하세요. 설치 상태는 `node tools/doctor.mjs --lang ko`로 다시 확인할 수 있습니다.

```sh
uv python install 3.12
npx playwright install chromium
```

`npx create-mesh-avatar-studio`는 **원본 저장소**를 설치합니다. 이 포크를 사용하려면 위의 `git clone` 절차를 따르세요. Windows에서는 가능하면 Git으로 내려받고, 에이전트 작업 전에 본인 계정으로 `projects/` 폴더를 만들어 두세요. 접근 오류가 나면 폴더의 **속성 → 보안**에서 하위 파일까지 권한이 상속되는지 확인하세요.

## Codex로 아바타 만들기

Studio의 **에이전트에게 요청** 기능은 작업 요청문을 만들어 복사합니다. Codex를 자동 실행하거나 이미지 생성 API를 직접 호출하지는 않습니다. 저장소 폴더에서 실행하는 이미지 인식 가능한 코딩 에이전트가 로컬 제작 도구를 사용합니다. 별도의 Codex Skill 설치나 모델 재학습은 제공하지 않습니다.

1. 실행파일로 연 화면에서 **새 프로젝트 만들기**로 이미지를 선택하고 Codex 요청문을 복사하세요. 직접 준비한다면 원본 이미지를 `projects/<이름>/` 아래에 보관하고 다음처럼 요청합니다.

   > docs/agent-guide.md를 순서대로 따라 projects/my-avatar/source.png로 아바타를 만들어 줘. 좌표 교정, 확대 격자, 리그 오버레이, 검증, 레이어 빌드와 포즈 이미지 육안 검토까지 진행하고 남은 결함도 알려 줘.

2. 완성된 프로젝트를 **프로젝트 열기**에서 선택합니다. **포즈 테스트**와 **입 모양 테스트**로 확인하고, 왼쪽 부위와 이미지 위 점을 조절합니다. 눈·손 윤곽처럼 레이어에 영향을 주는 값을 바꾸면 **저장하고 레이어 다시 만들기**를 실행합니다.
3. 기본 Codex 제작에는 눈·입 원화 편집과 상하좌우 고개 원화가 포함됩니다. 제작할 그림 세트와 이미지 전송 범위를 설명하고 한 번 동의받은 뒤, 생성·리그 배치·적용·검토까지 진행합니다. 생성이 불가능하면 원화가 미완성임을 알립니다. **표정 그림** 탭은 이후 추가 편집이나 선택적 표정을 요청할 때 사용하세요.
4. 각 고개 원화는 같은 프로젝트 안의 작업 폴더에서 전용 리그·눈·입 그림을 제작하고 `head-views.py pack`으로 자동 등록합니다. [자동 제작 지침](docs/codex-authoring.md)에 전체 절차가 있습니다. 기존 pitch 전용 수동 방식은 [추가 기능 제작 가이드](docs/fork-workflows.md)에 남아 있습니다.

정면에 가까운 상반신 PNG와 투명 배경이 가장 적합합니다. 이미지마다 리그·마스크·원화 정렬을 조정해야 하므로 모든 그림의 품질이 자동으로 보장되지는 않습니다. 전체 순서는 [에이전트 가이드](docs/agent-guide.md), 필드 의미는 [리그 필드](docs/rig-fields.md)를 참고하세요.

문장을 입력하는 입 모양 미리보기는 현재 일본어 히라가나·가타카나만 지원하며 소리를 재생하지 않습니다. 한국어 UI에서 모음 버튼과 카메라·마이크 기반 입 움직임은 사용할 수 있습니다.

## Live와 OBS

프로젝트에서 **Live**를 열고 카메라를 시작한 뒤 정면·편안한 눈·닫힌 입 상태로 교정하세요. 반전·감도·부드러움, 입 모양, 화면 구도와 조명을 조정할 수 있습니다. 마이크만 사용하면 대기 동작에 음성 입 움직임을 더할 수 있습니다.

카메라 미리보기의 초록 테두리는 실제 검출된 얼굴 범위입니다. 화면 전체를 원래 비율로 표시하며, 얼굴이 작거나 가장자리에 걸리면 안내합니다. 놓침이 잦으면 시작 전에 **약한 얼굴 신호도 인식** 또는 **세밀한 영상으로 인식**을 선택해 비교하세요. 오인식·처리량이 늘 수 있으며 다시 시작해야 적용됩니다. 표정이 약하면 교정 후 **눈 감기 감도**, **눈썹 감도**, 입 감도를 각각 조절하세요. 실제 카메라·조명·거리에서의 인식률은 별도 확인이 필요합니다.

**OBS URL 복사**로 얻은 주소를 OBS의 브라우저 소스(예: 1080 × 1080)에 넣고 Live 페이지와 개발 서버를 계속 켜 두세요. 투명 배경을 사용할 수 있습니다. 카메라 영상과 마이크 음성은 로컬에서 처리하며, 스트림에는 수치 형태의 움직임과 표시 설정을 전달합니다. Live를 별도 창에 두고 추적이 느려졌다는 안내가 나오면 창을 앞으로 가져오세요. 자세한 사용법은 [참고 문서](docs/reference.md#live-and-streaming)에 있습니다.

## 저장·공유와 개인정보

**리그 저장**은 설정을 저장하고, **.mavatar 내보내기**는 저장된 리그·레이어·표정·메타데이터를 한 파일로 묶습니다. 편집하려면 원본 이미지를 포함해야 합니다. 원본을 제외해도 생성된 레이어 이미지가 들어 있으므로 이미지 자체가 비공개 처리되는 것은 아닙니다. 가져오기는 개발 서버에서 최대 128 MiB까지 지원합니다.

사용자 이미지와 모든 파생물은 무시된 `projects/` 안에만 두고 커밋·업로드하지 마세요. 외부 이미지 생성에 보낼 때는 먼저 허용을 받으세요. `samples/`와 `reference/`는 수정하지 않습니다. 코드의 MIT 라이선스가 개별 이미지의 이용·배포 권한을 주지는 않습니다.

## 개발과 검증

```sh
npm run lint
npm test
npm run build
npm run build:runtime
npm run build:element
npm run build:react
npm run build:site
npm run e2e
uv run --with numpy --with pillow --with opencv-python-headless tools/test_build_layers.py
uv run tools/test_agent_tools.py
uv run tools/test_head_views.py
```

기존 변형의 수치 회귀는 **0px**를 유지해야 합니다(물리는 부동소수점 허용 오차). 아바타 빌드 전에는 `npm run validate-rig -- projects/<이름>/rig.draft.json`, 빌드 후에는 `npm run render-poses -- projects/<이름>`을 실행하고 결과를 직접 확인하세요. 새 효과는 해당 데이터를 설정한 프로젝트로도 검토해야 합니다.

`packages/` 변경에는 changeset을 추가합니다(기능 minor, 수정 patch). 루트 Studio만 변경하면 필요 없습니다. 패키지 이름은 원본과 공유하므로 이 포크의 npm 배포에는 별도 이름과 배포 설정이 필요합니다. 원본의 자동 npm 릴리스는 원본 저장소에서만 실행하도록 제한합니다.

- [추가 기능 제작 가이드](docs/fork-workflows.md)
- [에이전트 가이드](docs/agent-guide.md)
- [참고 문서](docs/reference.md)
- [리그 필드](docs/rig-fields.md)
- [아바타 형식](docs/format.md)

## 라이선스와 출처

코드: [MIT](LICENSE), 원본 Copyright (c) 2026 Yuki Shindo. 재배포 시 원본 저작권·허가 고지를 유지하세요.

샘플 Miko(`samples/miko-qipao/`)는 MIT 대상이 아닙니다. © Yuki Shindo (AITuber OnAir). [Miko 이용 규약](https://miko.aituberonair.com/#terms)과 [샘플 이용 조건](samples/miko-qipao/MIKO_ASSET_TERMS.md)을 따르며, 이미지 단독·소재 모음 재배포는 허용되지 않습니다. 이 프로젝트는 공식 AITuber OnAir 제품이 아닙니다.

얼굴 추적의 MediaPipe와 Face Landmarker는 © The MediaPipe Authors, Apache License 2.0입니다. [MediaPipe 라이선스](vendor/mediapipe/LICENSE)를 확인하세요.
