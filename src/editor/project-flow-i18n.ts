const en = {
  home: 'Projects', title: 'Choose your avatar project', intro: 'Open an avatar, try the sample, or start with an illustration.',
  newProject: 'New project', back: 'Back to projects', editor: 'Back to editor', refresh: 'Refresh projects',
  createTitle: 'Start with your illustration', createHelp: 'Choose an image. It stays in this repository on your computer.',
  name: 'Project folder name', nameHelp: '1–80 letters (A–Z), digits, hyphens or underscores. Existing folders are kept; a suffix is added.',
  image: 'Choose illustration', imageHelp: 'PNG, JPEG or WebP · up to 24 MiB · 8192 px per side · 16 megapixels. Transparency is recommended.',
  create: 'Create project', creating: 'Preparing project…', cancel: 'Cancel', sample: 'Sample avatar', ready: 'Ready to open', pending: 'Needs Codex setup',
  empty: 'No projects yet. Start by choosing an illustration.', unavailable: 'Project creation needs the local launcher or development server.',
  invalidName: 'Use a folder name with letters, digits, hyphens or underscores. Reserved Windows names are unavailable.',
  invalidImage: 'Choose a valid PNG, JPEG or WebP image up to 24 MiB.', imageTooLarge: 'Use an image up to 8192 px per side and 16 megapixels.',
  failed: 'Could not create the project. Your existing projects are unchanged. Try again.',
  handoffTitle: 'Your image is ready for Codex', handoffHelp: 'The illustration is saved. The avatar still needs a rig and animation layers.',
  steps: ['Open Codex in this repository folder.', 'Copy the request below and paste it into Codex.', 'Keep this page open. When Codex finishes, open the prepared avatar.'],
  request: 'Copy Codex request', folder: 'Copy repository folder', source: 'Original illustration', waiting: 'Waiting for rig and layers', completed: 'Avatar files are ready',
  open: 'Open avatar', checking: 'Checking project…', checkFailed: 'Could not refresh projects. Check that the launcher is running and try again.',
  prompt: 'Continue the existing project PROJECT using PROJECT/source.png. The browser has already saved the source image and avatar.json. Keep this same project folder and preserve source.png; do not create another project. Follow docs/agent-guide.md in order: perform coordinate calibration, then initialize the draft with `uv run tools/new-project.py PROJECT/source.png NAME --in-place` only if no rig.draft.json or rig.json exists. Use zoomed grids and overlays, validate the draft, build the layers and visually inspect every review pose. Keep all images and derivatives under this project. Ask before sending images to an external generator unless permission has already been explicitly granted in this conversation. Report remaining defects and tell me when I can open this project from Studio.',
};
type FlowText = Omit<typeof en, 'steps'> & { steps: string[] };
const ko: FlowText = {
  home: '프로젝트 선택', title: '어떤 아바타로 시작할까요?', intro: '기존 아바타를 열거나 샘플을 체험하고, 새 이미지로 제작을 시작하세요.',
  newProject: '새 프로젝트 만들기', back: '프로젝트 목록으로', editor: '편집기로 돌아가기', refresh: '목록 새로고침',
  createTitle: '일러스트로 새 프로젝트 시작', createHelp: '이미지를 선택하세요. 이 컴퓨터의 저장소 안에만 보관됩니다.',
  name: '프로젝트 폴더 이름', nameHelp: '영문·숫자·하이픈·밑줄 1~80자. 같은 이름이 있으면 번호를 붙여 기존 폴더를 보존합니다.',
  image: '일러스트 선택', imageHelp: 'PNG·JPEG·WebP · 최대 24MiB · 한 변 8192px · 1600만 화소. 투명 배경을 권장합니다.',
  create: '프로젝트 만들기', creating: '프로젝트 준비 중…', cancel: '취소', sample: '샘플 아바타', ready: '편집 가능', pending: 'Codex 제작 필요',
  empty: '아직 프로젝트가 없습니다. 일러스트를 선택해 시작하세요.', unavailable: '프로젝트를 만들려면 로컬 실행파일이나 개발 서버로 실행하세요.',
  invalidName: '폴더 이름은 영문·숫자·하이픈·밑줄로 입력하세요. Windows 예약 이름은 사용할 수 없습니다.',
  invalidImage: '24MiB 이하의 올바른 PNG·JPEG·WebP 이미지를 선택하세요.', imageTooLarge: '한 변 8192px 이하, 1600만 화소 이하의 이미지를 사용하세요.',
  failed: '프로젝트를 만들지 못했습니다. 기존 프로젝트는 유지됩니다. 다시 시도하세요.',
  handoffTitle: 'Codex에 맡길 준비가 됐어요', handoffHelp: '이미지를 저장했습니다. 이제 움직임을 위한 리그와 레이어를 제작하면 됩니다.',
  steps: ['이 저장소 폴더에서 Codex를 여세요.', '아래 요청을 복사해 Codex에 붙여 넣으세요.', '이 페이지를 열어 두세요. Codex 작업이 끝나면 완성된 아바타를 열 수 있습니다.'],
  request: 'Codex 요청문 복사', folder: '저장소 폴더 경로 복사', source: '원본 일러스트', waiting: '리그·레이어 제작 대기 중', completed: '아바타 파일이 준비됐습니다',
  open: '완성된 아바타 열기', checking: '프로젝트 확인 중…', checkFailed: '목록을 새로고침하지 못했습니다. 실행파일이 켜져 있는지 확인하고 다시 시도하세요.',
  prompt: '기존 프로젝트 PROJECT에서 PROJECT/source.png로 아바타 제작을 이어서 진행해 주세요. 브라우저에서 source.png와 avatar.json을 이미 저장했습니다. 이 폴더와 원본 이미지를 유지하고 다른 프로젝트를 만들지 마세요. docs/agent-guide.md를 순서대로 따라 좌표 교정을 먼저 수행하세요. rig.draft.json과 rig.json이 모두 없을 때만 `uv run tools/new-project.py PROJECT/source.png NAME --in-place`로 초안을 초기화하세요. 확대 격자와 오버레이로 좌표를 검토하고, 리그 검증·레이어 빌드·모든 포즈 이미지 육안 검토까지 진행하세요. 이미지와 모든 파생물은 이 프로젝트 안에 보관하세요. 이 대화에서 명시적으로 허용하지 않았다면 외부 이미지 생성에 보내기 전에 동의를 받으세요. 남은 결함을 보고하고 Studio에서 이 프로젝트를 열 수 있게 되면 알려 주세요.',
};
const ja: FlowText = {
  home: 'プロジェクト選択', title: 'アバターのプロジェクトを選ぶ', intro: '既存のアバター、サンプル、または新しいイラストから始めます。',
  newProject: '新規プロジェクト', back: '一覧に戻る', editor: 'エディタに戻る', refresh: '一覧を更新',
  createTitle: 'イラストから始める', createHelp: '画像を選んでください。この端末のリポジトリ内だけに保存します。',
  name: 'プロジェクトのフォルダ名', nameHelp: '英数字・ハイフン・下線の1〜80文字。既存の名前には番号を付けます。',
  image: 'イラストを選択', imageHelp: 'PNG・JPEG・WebP、24 MiB 以下、1辺8192 px・1600万画素以下。透過背景を推奨します。',
  create: '作成', creating: '準備中…', cancel: 'キャンセル', sample: 'サンプル', ready: '編集可能', pending: 'Codex で制作待ち',
  empty: 'プロジェクトはありません。イラストから始めてください。', unavailable: '作成にはローカル起動アプリか開発サーバーが必要です。',
  invalidName: '英数字・ハイフン・下線を使ってください。Windows の予約名は使えません。',
  invalidImage: '24 MiB 以下の有効な PNG・JPEG・WebP を選んでください。', imageTooLarge: '1辺8192 px・1600万画素以下にしてください。',
  failed: '作成できませんでした。既存のプロジェクトは保持しています。もう一度お試しください。',
  handoffTitle: 'Codex に依頼する準備ができました', handoffHelp: '画像を保存しました。次にリグとアニメーションレイヤーを制作します。',
  steps: ['このリポジトリのフォルダで Codex を開きます。', '下の依頼文をコピーして Codex に貼り付けます。', 'このページを開いたままにし、制作完了後にアバターを開きます。'],
  request: 'Codex の依頼文をコピー', folder: 'リポジトリの場所をコピー', source: '元のイラスト', waiting: 'リグとレイヤーの制作待ち', completed: 'アバターの準備ができました',
  open: '完成したアバターを開く', checking: '確認中…', checkFailed: '一覧を更新できません。起動アプリが動いているか確認してください。',
  prompt: '既存の PROJECT で PROJECT/source.png からアバターを制作してください。ブラウザで source.png と avatar.json は保存済みです。同じフォルダと元画像を維持し、別のプロジェクトは作らないでください。docs/agent-guide.md の順に座標校正から始め、rig.draft.json と rig.json が両方ない場合だけ `uv run tools/new-project.py PROJECT/source.png NAME --in-place` で初期化してください。拡大格子、オーバーレイ、リグ検証、レイヤー生成、全ポーズ画像の目視確認まで行ってください。画像と派生物はこのプロジェクト内に保存し、この会話で明示的な許可がない場合は外部画像生成に送る前に許可を得てください。残った問題と Studio で開けるようになったことを報告してください。',
};
const zh: FlowText = {
  ...en,
  home: '选择项目', title: '选择虚拟形象项目', intro: '打开现有项目、体验示例，或从插画开始。',
  newProject: '新建项目', back: '返回项目列表', editor: '返回编辑器', refresh: '刷新列表',
  createTitle: '从插画开始', createHelp: '选择图片，仅保存在本机仓库内。', name: '项目文件夹名称',
  nameHelp: '1–80 个英文字母、数字、连字符或下划线。重名时自动添加编号。', image: '选择插画',
  create: '创建项目', creating: '准备中…', cancel: '取消', sample: '示例', ready: '可编辑', pending: '等待 Codex 制作',
  empty: '尚无项目，请先选择插画。', unavailable: '创建项目需要本地启动器或开发服务器。',
  handoffTitle: '已准备好交给 Codex', handoffHelp: '插画已保存，接下来制作绑定和动画图层。',
  steps: ['在仓库文件夹中打开 Codex。', '复制下方请求并粘贴到 Codex。', '保持本页打开，制作完成后打开虚拟形象。'],
  request: '复制 Codex 请求', folder: '复制仓库路径', source: '原始插画', waiting: '等待绑定和图层', completed: '文件已准备就绪', open: '打开虚拟形象', checking: '检查中…',
};
en.prompt += ' Complete the default drawn-avatar workflow in docs/codex-authoring.md: use imagegen edits for closed/half/smiling eyes, speaking mouths and up/down/left/right head drawings; rig each view and its own eye/mouth sprites, then register with tools/head-views.py pack. Prepare locally and ask once for consent covering this drawing set before transmission. A copied request is not consent. Do not stop at masks when generation is available and authorized; if unavailable or declined, report drawn assets as pending rather than calling the mesh preview complete.';
ko.prompt += ' docs/codex-authoring.md의 기본 원화 제작 흐름까지 완료하세요. imagegen 편집으로 감은 눈·반감은 눈·웃는 눈, 발화 입 모양, 상하좌우 고개 원화를 만들고, 각 원화의 전용 리그와 눈·입 그림을 제작한 뒤 tools/head-views.py pack으로 등록하세요. 먼저 로컬 요청을 준비하고, 이 그림 세트의 이미지 전송 동의를 한 번에 받으세요. 요청문 복사는 동의가 아닙니다. 생성 가능하고 허용됐다면 마스크 준비에서 멈추지 말고 실제 생성·적용·검토까지 진행하세요. 도구가 없거나 거절됐다면 원화가 미완성임을 알리고 메쉬 미리보기를 완성본으로 보고하지 마세요.';
ja.prompt += ' docs/codex-authoring.md の標準制作を完了してください。imagegen 編集で閉眼・半眼・笑顔の目、発話の口、上下左右の頭部原画を制作し、各原画専用のリグと目・口画像を作って tools/head-views.py pack で登録します。送信前に画像セット全体の許可を一度得てください。依頼文のコピーは同意ではありません。生成可能かつ許可済みならマスク準備だけで止まらず、生成・適用・目視確認まで進めます。生成できない場合は原画が未完成と報告してください。';
zh.prompt = en.prompt;
export const projectFlowText = { en, ko, ja, zh };
