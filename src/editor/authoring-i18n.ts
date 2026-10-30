const en = {
  title: 'Avatar production', loading: 'Checking progress…', failed: 'Progress could not be checked. Existing artwork is preserved.',
  complete: 'Drawings, registration and visual review recorded.', inProgress: 'Production or review is pending.',
  drawingCount: 'Full drawing set: COUNT images (before retries).', stale: 'Changed; check affected work', reviewed: 'Visual review recorded',
  needsHead: 'Head drawing needed', needsGeometry: 'Rig and head boundary review needed', needsDrawings: 'COUNT eye/mouth drawings needed', needsReview: 'Import or visual review needed',
  next: 'Next', copyResume: 'Copy continuation request', consent: 'Copying a request does not grant image-transfer permission.',
  resume: 'Continue PROJECT. First run `npm run authoring -- status PROJECT`, then follow docs/authoring-workflow.md and the indicated stage guide. Preserve source, accepted art and custom masks. Complete the default 39-image drawn workflow; skip only unchanged work with current receipts. Confirm image-transfer consent in this conversation before imagegen. Inspect all required poses and report remaining defects.',
  views: { neutral: 'Front', left: 'Image left', right: 'Image right', up: 'Up', down: 'Down' },
  actions: { 'draw-head': 'Draw head', 'trace-rig': 'Trace rig', build: 'Build layers', render: 'Prepare review', 'review-geometry': 'Review rig and boundary', requests: 'Prepare masks', 'draw-variants': 'Draw eyes and mouths', sprites: 'Import drawings', 'review-final': 'Review expressions and motion', pack: 'Register directions' },
};
const ko: typeof en = {
  title: '아바타 제작 진행', loading: '진행 상태 확인 중…', failed: '진행 상태를 확인하지 못했습니다. 기존 원화는 유지됩니다.',
  complete: '원화 제작·등록·육안 검토 기록이 준비됐습니다.', inProgress: '제작 또는 검토가 남아 있습니다.',
  drawingCount: '전체 원화 COUNT장 기준입니다(재시도 제외).', stale: '변경됨 · 관련 작업 확인 필요', reviewed: '육안 검토 기록 있음',
  needsHead: '고개 원화 필요', needsGeometry: '리그·고개 경계 검토 필요', needsDrawings: '눈·입 원화 COUNT장 필요', needsReview: '가져오기 또는 육안 검토 필요',
  next: '다음 작업', copyResume: '이어서 제작 요청 복사', consent: '요청문 복사는 이미지 전송 동의가 아닙니다.',
  resume: 'PROJECT 제작을 이어가세요. 먼저 `npm run authoring -- status PROJECT`를 실행하고 docs/authoring-workflow.md와 표시된 단계 지침을 따르세요. 원본·확정 원화·보정 마스크를 보존하세요. 기본 39장 원화 제작을 완료하되 변경이 없고 유효한 기록이 있는 작업만 건너뛰세요. imagegen 전송 동의는 현재 대화에서 확인하세요. 모든 필수 포즈를 육안 검토하고 남은 결함을 보고하세요.',
  views: { neutral: '정면', left: '이미지 왼쪽', right: '이미지 오른쪽', up: '위', down: '아래' },
  actions: { 'draw-head': '고개 원화 제작', 'trace-rig': '리그 좌표 작성', build: '레이어 빌드', render: '검토 자료 준비', 'review-geometry': '리그·경계 검토', requests: '마스크 준비', 'draw-variants': '눈·입 원화 제작', sprites: '원화 가져오기', 'review-final': '표정·움직임 검토', pack: '방향별 등록' },
};
const ja: typeof en = {
  ...en, title: 'アバター制作の進行', loading: '進行状況を確認中…', failed: '進行状況を確認できません。既存の原画は保持されます。',
  complete: '原画・登録・目視確認の記録があります。', inProgress: '制作または確認が残っています。', drawingCount: '原画全COUNT枚（再試行を除く）。',
  stale: '変更あり・関連作業を確認', reviewed: '目視確認の記録あり', needsHead: '頭部原画が必要', needsGeometry: 'リグ・境界の確認が必要', needsDrawings: '目・口の原画COUNT枚が必要', needsReview: '取り込みまたは目視確認が必要',
  next: '次の作業', copyResume: '続きの依頼をコピー', consent: '依頼のコピーは画像送信の同意ではありません。',
  views: { neutral: '正面', left: '画像の左', right: '画像の右', up: '上', down: '下' },
  resume: 'PROJECT の制作を続けてください。まず `npm run authoring -- status PROJECT` を実行し、docs/authoring-workflow.md と該当段階の指示に従います。元画像・確定原画・補正マスクを保持し、標準39枚を完成させてください。変更がなく有効な記録のある作業だけを省略し、imagegen 送信の許可は現在の会話で確認してください。全必須ポーズを目視確認し、残る問題を報告します。',
  actions: { 'draw-head': '頭部原画を制作', 'trace-rig': 'リグ座標を作成', build: 'レイヤーを生成', render: '確認資料を準備', 'review-geometry': 'リグと境界を確認', requests: 'マスクを準備', 'draw-variants': '目と口の原画を制作', sprites: '原画を取り込む', 'review-final': '表情と動きを確認', pack: '方向別に登録' },
};
const zh: typeof en = {
  ...en, title: '虚拟形象制作进度', loading: '正在检查进度…', failed: '无法检查进度。现有原画会保留。',
  complete: '原画、注册和目视检查已有记录。', inProgress: '仍有制作或检查工作。', drawingCount: '完整原画COUNT张（不含重试）。',
  stale: '已更改，请检查相关工作', reviewed: '已有目视检查记录', needsHead: '需要头部原画', needsGeometry: '需要检查绑定和边界', needsDrawings: '需要COUNT张眼口原画', needsReview: '需要导入或目视检查',
  next: '下一步', copyResume: '复制继续制作请求', consent: '复制请求不代表同意传输图片。',
  views: { neutral: '正面', left: '图片左侧', right: '图片右侧', up: '上', down: '下' },
  resume: '请继续制作 PROJECT。先运行 `npm run authoring -- status PROJECT`，再遵循 docs/authoring-workflow.md 和当前阶段指引。保留源图、已确认原画和修正蒙版，完成默认39张原画。仅跳过未更改且记录有效的工作，在当前对话中确认 imagegen 图片传输许可。目视检查所有必需姿态并报告剩余问题。',
  actions: { 'draw-head': '制作头部原画', 'trace-rig': '绘制绑定坐标', build: '生成图层', render: '准备检查材料', 'review-geometry': '检查绑定和边界', requests: '准备蒙版', 'draw-variants': '制作眼口原画', sprites: '导入原画', 'review-final': '检查表情和动作', pack: '注册各个方向' },
};
export const authoringText = { en, ko, ja, zh };
