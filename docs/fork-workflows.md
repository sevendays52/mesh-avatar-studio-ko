# Fork authoring workflows / 포크 제작 안내 / フォークの制作案内

[한국어 README](../README.md) · [English README](../README.en.md) · [日本語 README](../README.ja.md)

## 한국어

기본 제작은 [agent-guide.md](agent-guide.md)를 순서대로 따르세요. 좌표 교정,
확대 격자, 오버레이, 리그 검증과 포즈 검토는 추가 기능을 사용할 때도 필요합니다.
이미지와 모든 파생물은 `projects/<이름>/` 안에 보관합니다.

### Codex에 요청할 수 있는 작업

- **기본 아바타:** 원본 분석, 리그 배치, 레이어 생성, 편집기에서 열기, 포즈 검토.
- **눈·입·표정:** Studio의 표정 그림 요청문으로 마스크·프롬프트 준비, 허용된 이미지 생성,
  `build-sprites.py`로 적용, 포즈 재검토. 이미지 생성 도구가 없으면 준비 단계까지 가능합니다.
- **리그 효과:** `head.pitch`, `body.motion`, `cheekPuff`를 이미지에 맞게 선택적으로 설정.
  필수 필드와 범위는 [rig-fields.md](rig-fields.md)를 따르며 기존 값을 일괄 변경하지 않습니다.
- **고개 각도별 원화:** 아래 절차에 따라 원화·리그·스프라이트·전환 데이터를 별도로 구성.

예시 요청:

> projects/my-avatar에 선택적인 머리 끄덕임, 상체 따라 움직임, 볼 부풀림을 적용해 줘.
> docs/rig-fields.md에 따라 리그를 검증하고 docs/agent-guide.md의 격자·오버레이·포즈 검토를
> 진행해 줘. 기존 원본은 유지하고, 추가 이미지 생성이 필요하면 전송 전에 허용을 받아 줘.

### 고개 각도별 원화의 제작 범위

이 기능은 재생 엔진과 데이터 형식을 제공합니다. Studio의 눈·입 요청이나
`build-sprites.py`가 고개 각도별 원화를 자동으로 제작·등록하지는 않습니다.

1. 정면 아바타를 완성하고 검증합니다. 숙임 각도와 원화 범위를 정하고, 외부 이미지
   생성이 필요하면 먼저 허용을 받습니다. 원화는 원본 크기·투명도·목 아래 몸을 맞춥니다.
2. 각 원화를 `projects/` 안의 별도 작업 프로젝트로 준비합니다. 각 원화의 격자와
   오버레이를 확인하고 전용 리그·레이어·선택적 눈·입 그림을 빌드합니다.
3. [아바타 형식](format.md#drawn-pitch-views)에 따라 정면 리그의 `head.pitch.views`에
   고유 ID와 각도(−30…30°, 0 제외, 최대 4개)를 등록합니다. `sprites.json.pitchViews`에
   각 원화의 완성된 리그와 레이어 별칭을 넣고 PNG를 `built/sprites/pitch_view_*.png`로 준비합니다.
4. 연속 변형이 필요하면 인접 원화 사이의 대응 격자를 로컬에서 만들고 `pitchMorphs`에
   등록합니다. 이는 수작업·추가 도구가 필요한 고급 데이터 제작이며, 단순 블렌딩만으로
   이중 윤곽이나 선 차이가 해결되지는 않습니다. 범위 검증은 시각 품질 보장이 아닙니다.
5. `npm run validate-avatar -- projects/<이름>`과 `npm run render-poses -- projects/<이름>`을
   실행합니다. 중간 각도, 눈 감기, 말하기, 볼 부풀림, 상체와 복합 회전을 확인합니다.
   원화를 수정하면 해당 원화의 리그·레이어·별칭·대응 격자도 다시 확인합니다.

기존 원화 메타데이터와 PNG는 일반 표정 스프라이트 재빌드 시 보존됩니다.
그 보존이 수정된 원화의 레이어를 다시 만든다는 뜻은 아닙니다.

## English

Follow [agent-guide.md](agent-guide.md) in order, including calibration, zoomed grids,
overlays, validation and visual pose review. Keep images and derivatives under `projects/`.

Codex can prepare a basic rig/layers, generate local eye/mouth/expression requests, import
drawings and review poses. Actual image generation requires an available generation tool
and explicit permission before transmission. Studio copies requests; it does not run Codex.
Optional `head.pitch`, `body.motion` and `cheekPuff` data must fit the illustration and the
[field reference](rig-fields.md).

Drawn head views require separate authoring; ordinary eye/mouth requests and
`build-sprites.py` do not create/register them automatically:

1. Finish the neutral avatar. Prepare same-size angle drawings, preserving alpha and the
   body below the neck. Obtain permission before external generation.
2. In separate working projects under `projects/`, calibrate each drawing's rig using
   grids/overlays, build its layers and prepare any eye/mouth sprites.
3. Follow [the view format](format.md#drawn-pitch-views): add up to four unique nonzero
   −30…30° entries to `head.pitch.views`; supply complete per-view rigs and layer aliases
   in `sprites.json.pitchViews`, with `pitch_view_*` PNGs under `built/sprites/`.
4. For continuous morphing, author local correspondence grids for adjacent views as
   `pitchMorphs`. This requires manual work or additional tooling. Valid bounds do not
   guarantee good alignment or remove double linework.
5. Run `npm run validate-avatar -- projects/<name>` and
   `npm run render-poses -- projects/<name>`. Inspect intermediate angles, closed eyes,
   speech, puffed cheeks, torso motion and combined rotations. When artwork changes,
   update its rig, layers, aliases and correspondence grids.

Ordinary sprite rebuilds preserve existing view data and PNGs; they do not regenerate
layers for a changed angle drawing.

## 日本語

[agent-guide.md](agent-guide.md) を順番に進め、座標校正、拡大格子、オーバーレイ、
検証、ポーズ画像の目視確認を行います。画像と派生物は `projects/` 内に保存します。

Codex には基本リグ・レイヤー、目・口・表情のマスクと依頼文、画像の取り込み、
ポーズ確認を依頼できます。画像生成には利用可能な生成ツールと、送信前の明示的な許可が
必要です。Studio は依頼文をコピーする機能を提供し、Codex 自体は実行しません。
任意の `head.pitch`、`body.motion`、`cheekPuff` は画像と [各項目の定義](rig-fields.md)
に合わせて設定します。

角度別原画は別途制作します。目・口の依頼や `build-sprites.py` では自動生成・登録されません。

1. 正面アバターを完成させ、同じサイズ・透過・首から下の体を保った角度別原画を準備します。
   外部生成の前に許可を得てください。
2. `projects/` 内の別の作業プロジェクトで、各原画の格子・オーバーレイ・リグを確認し、
   レイヤーと必要な目・口の画像を作ります。
3. [形式の説明](format.md#drawn-pitch-views) に従い、`head.pitch.views` に固有 ID と
   0 を除く −30…30° の角度を最大4件登録します。`sprites.json.pitchViews` に各原画の
   完成リグと別名を設定し、`built/sprites/` に `pitch_view_*` PNG を置きます。
4. 連続変形には、隣り合う原画の対応格子をローカルで制作して `pitchMorphs` に登録します。
   手作業や追加ツールが必要です。数値検証だけでは線の重なりや位置ずれを保証できません。
5. `npm run validate-avatar -- projects/<名前>` と `npm run render-poses -- projects/<名前>`
   を実行し、中間角度、目の開閉、発話、頬、上体、複合回転を確認します。原画を変更したら
   そのリグ・レイヤー・別名・対応格子も見直します。

通常のスプライト再生成は既存の原画データと PNG を維持しますが、変更した角度別原画の
レイヤーを作り直す処理ではありません。
