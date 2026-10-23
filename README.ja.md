# Mesh Avatar Studio KO

[한국어](README.md) · [English](README.en.md) · **日本語**

**Yuki Shindo (shinshin86)** が開発した [Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio) の非公式フォークです。[sevendays52/mesh-avatar-studio-ko](https://github.com/sevendays52/mesh-avatar-studio-ko) で独立して管理し、韓国語 UI、アバターの動きの拡張、Codex による制作・確認フローを追加しています。

1枚のイラストから、まばたき・口パク・首振り・呼吸・髪の揺れがある 2D メッシュアバターを作り、ローカルエディタで調整できます。

![ミコのサンプルを開いたエディタ — 原版の日本語 UI の例](docs/images/ja/01-overview.png)

## 原版との違い

基本エディタ、WebGL エンジン、表情・口パク、カメラ追跡、照明、`.mavatar` 共有は原版の機能です。

| 項目 | このフォークの変更 |
|---|---|
| 韓国語 | エディタ、Live、照明、読み込み・書き出し、エージェント依頼文、環境チェック。英語・日本語・既存の中国語 UI も維持します。 |
| 頭・上体 | 任意のリグデータで首を中心としたうなずき、顔の比率保持、上体の追従を有効にします。 |
| 角度別の原画 | うつむいた原画とリグを登録できます。対応格子があれば原画間を変形・ブレンドします。追加の原画と設定が必要です。 |
| 顔追跡 | 正面補正を基準とした相対回転、うなずきの方向・感度・反転、口の開き・形の感度を調整します。 |
| 頬・プレビュー | 頬の膨らみ、口の形、上体のうなずきを確認できます。頬の変形にはリグ設定が必要です。 |
| 配信の構図 | Live の拡大率・位置調整を OBS の配信画面にも反映します。 |
| 制作ツール | 新しいリグ・原画データの検証、スプライト再生成時の原画データ保持、ポーズ確認と回帰テストを拡張します。 |

新しいリグ・スプライトデータは任意です。データを持たない既存アバターの変形、公開 API、既存形式の意味を維持します。古いランタイムでは新しい効果が表示されない場合があります。原画の線や陰影が異なると、中間角度で線が柔らかくなったり重なったりする場合があります。

韓国語化の対象はローカル Studio と Live です。詳細技術文書や別の紹介サイト・Player には英語・日本語の資料が残っています。[原版の紹介サイト](https://shinshin86.github.io/mesh-avatar-studio/ja/) と [原版 Player](https://shinshin86.github.io/mesh-avatar-studio/ja/play/) は原版のサービスであり、このフォークの追加機能は含みません。

## インストールと起動

### Windows 起動アプリ

clone 後、このリポジトリで Codex を開き、**「実行できるように準備して」**と依頼してください。
Codex は `AGENTS.md` に従って環境とパッケージを確認し、実行ファイルとランタイムをビルドします。
以後は実行ファイルをダブルクリックして使えます。

この作業フォルダの **`MeshAvatarStudio.exe` をダブルクリック**すると、ローカルサーバーと
ブラウザが開きます。実行ファイルはリポジトリ内に置き、`tools/launcher-runtime/` も維持してください。
同梱の Node.js・npm を使い、パッケージがない場合は初回起動時に自動インストールします
（インターネット接続が必要です）。編集・配信中は起動ウィンドウを開いたままにしてください。
閉じるか **Stop Studio** を押すとサーバーが終了します。再実行すると既存のブラウザ画面を開けます。

**プロジェクト選択 → 新規プロジェクト → イラストを選択 → 作成** と進めます。画像を保存すると
Codex への依頼画面になります。リポジトリの場所と依頼文をコピーし、そのフォルダで Codex に
貼り付けます。リグとレイヤーが揃うと **完成したアバターを開く** を押せます。制作待ちの
プロジェクトは一覧から再度開けます。PNG は元のバイトを保存し、JPEG・WebP はローカルで PNG に変換します。

実行ファイルとランタイムはローカルのビルド成果物で、Git には含みません。新規 clone 後は
Node.js・npm をインストールした Windows で一度実行します。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/build-launcher.ps1
```

Windows の C# コンパイラを使い、インストール済みの Node.js・npm をローカルにコピーします。
`-WithoutRuntime` は実行ファイルだけを作ります（実行先の Node.js が必要です）。
リグ制作は Codex で進め、Python・uv・Chromium などの制作ツールは別途準備します。

### ターミナルから起動

**Node.js 22.17 以上**と Git が必要です。レイヤーの制作・再生成には **Python 3.10 以上と uv**、ポーズ画像の確認には **Playwright Chromium** も必要です。

```sh
git clone https://github.com/sevendays52/mesh-avatar-studio-ko.git
cd mesh-avatar-studio-ko
npm ci
node tools/doctor.mjs --lang ja
npm run dev
```

表示された URL（例: `http://127.0.0.1:5173/`）を開き、上部で **日本語**を選びます。言語はブラウザに保存されます。最初はミコのサンプルが開きます。変更時に **コピーして編集を続ける** を選ぶと `projects/` のコピーで作業できます。

制作ツールが不足している場合は uv をインストールしてから、次を実行して環境チェックをやり直してください。

```sh
uv python install 3.12
npx playwright install chromium
```

`npx create-mesh-avatar-studio` は **原版のリポジトリ**を取得します。このフォークには上記の clone を使ってください。Windows では Git を推奨します。エージェント作業の前に自分のアカウントで `projects/` を作成してください。読み込めない場合は **プロパティ → セキュリティ** で、子ファイル・フォルダへのアクセス権の継承を確認します。

## Codex でアバターを作る

**エージェントに依頼** はコピー用の依頼文を作ります。Studio 自体は Codex を起動したり画像生成 API を呼び出したりしません。このリポジトリで動く画像認識可能なコーディングエージェントが、ローカル制作ツールを使います。別途インストールする Codex Skill や学習済みモデルは提供しません。

1. **新規プロジェクト**で画像を選び、Codex の依頼文をコピーします。手動の場合は画像を `projects/<名前>/` に置き、このリポジトリで Codex に依頼します。

   > docs/agent-guide.md に順番に従い、projects/my-avatar/source.png からアバターを作ってください。座標校正、拡大格子、リグのオーバーレイ、検証、レイヤー生成、ポーズ画像の目視確認まで行い、残った問題も報告してください。

2. **プロジェクトを開く** から結果を選び、**ポーズ確認**と**口の動き**を確認します。パーツの点をドラッグして調整します。レイヤーに影響する輪郭を変更したら **保存してレイヤーを作り直す** を使います。
3. **描き分け画像**で目・口・表情を選び、Codex 用の依頼文をコピーします。画像生成が利用できる環境では原画とマスクから画像を作り、取り込めます。画像送信にはユーザーの明示的な許可が必要です。生成できない場合はローカルでマスク・依頼文を用意し、別途準備した PNG を取り込んでください。
4. 角度別の原画は別の高度な作業です。[追加機能の制作ガイド](docs/fork-workflows.md) に従い、各原画のリグ・スプライトと切り替えを確認します。目・口の依頼だけで角度別原画が自動生成されるわけではありません。

正面に近い上半身の透過 PNG が適しています。画像ごとにリグ、マスク、位置合わせの調整が必要で、品質は自動では保証されません。詳しくは [エージェントガイド](docs/agent-guide.md) と [リグの各項目](docs/rig-fields.md) を参照してください。

文章による口のプレビューは現在ひらがな・カタカナに対応し、音声は再生しません。韓国語 UI でも母音ボタンとカメラ・マイクによる口の動きを利用できます。

## Live と OBS

プロジェクトから **Live** を開き、カメラを開始し、正面・自然な目・閉じた口で基準を合わせます。反転、感度、滑らかさ、口の形、構図、照明を調整できます。マイクだけなら、待機中の動きに声による口パクを加えられます。

**OBS 用 URL をコピー** で得た URL を OBS のブラウザソース（例: 1080 × 1080）に追加し、Live と開発サーバーを起動したままにします。透過背景を利用できます。映像・音声はローカル処理し、配信画面には動きの数値と表示設定を渡します。Live は別ウィンドウに置き、追跡が遅くなった場合は前面に戻してください。[配信の詳細](docs/reference.md#live-and-streaming) も参照できます。

## 保存・共有と画像の扱い

**設定を保存**はリグを保存します。`.mavatar` の書き出しでは保存済みリグ・レイヤー・表情・メタデータをまとめます。再編集には元画像を含めてください。元画像を除いてもレイヤー画像は残ります。読み込みは開発サーバー上で最大 128 MiB です。

ユーザー画像と派生物は Git の対象外の `projects/` に置き、コミット・アップロードしないでください。外部の画像生成に送信する前に許可を得てください。`samples/` と `reference/` は変更しません。コードの MIT ライセンスは個々の画像の利用・配布権を与えません。

## 開発と検証

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
```

既存変形の数値回帰は **0 px** を維持します（物理演算は浮動小数点誤差を許容）。制作前に `npm run validate-rig -- projects/<名前>/rig.draft.json`、制作後に `npm run render-poses -- projects/<名前>` を実行し、画像を目視確認してください。新しい効果は対応データを設定したプロジェクトでも確認します。

`packages/` の変更には changeset を追加します（機能 minor、修正 patch）。Studio のみなら不要です。パッケージ名は原版と共通のため、このフォークの npm 公開には別名と設定が必要です。原版向けの自動 npm リリースは原版リポジトリでのみ動作します。

- [追加機能の制作ガイド](docs/fork-workflows.md)
- [エージェントガイド](docs/agent-guide.md)
- [リファレンス](docs/reference.md)
- [リグの各項目](docs/rig-fields.md)
- [アバター形式](docs/format.md)

## ライセンスとクレジット

コード: [MIT](LICENSE)、原版 Copyright (c) 2026 Yuki Shindo。再配布時は原版の著作権・許諾表示を維持してください。

ミコのサンプル（`samples/miko-qipao/`）は MIT の対象外です。© Yuki Shindo (AITuber OnAir)。[ミコの利用規約](https://miko.aituberonair.com/#terms) と [素材の利用条件](samples/miko-qipao/MIKO_ASSET_TERMS.md) に従い、画像単独・素材集として再配布しないでください。このプロジェクトは公式 AITuber OnAir 製品ではありません。

MediaPipe と Face Landmarker: © The MediaPipe Authors、Apache License 2.0。[MediaPipe ライセンス](vendor/mediapipe/LICENSE) を参照してください。
