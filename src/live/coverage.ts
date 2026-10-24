import type { FaceResult } from './tracking';
export type FaceBounds = NonNullable<FaceResult['faceBounds']>;
export function checkedBounds(value: unknown): FaceBounds | null {
  const b = value as FaceBounds | null;
  if (!b || ![b.x, b.y, b.width, b.height].every(Number.isFinite) || b.width <= 0 || b.height <= 0 || b.width > 2 || b.height > 2) return null;
  return { x: b.x, y: b.y, width: b.width, height: b.height };
}
export function coverageHint(bounds: FaceBounds | null) {
  if (!bounds) return 'waiting';
  if (bounds.x < .02 || bounds.y < .02 || bounds.x + bounds.width > .98 || bounds.y + bounds.height > .98) return 'edge';
  if (bounds.height < .22 || bounds.width < .12) return 'small';
  return 'good';
}
export const coverageText = {
  en: { region: 'Detected face region', profile: 'Face detection', balanced: 'Standard', sensitive: 'Recognize weaker faces', detail: 'Capture more detail', hint: 'Higher detection sensitivity may mistake background shapes for a face. Detail mode uses more processing. Restart the camera to apply.', eye: 'Eye closure sensitivity', brow: 'Eyebrow sensitivity', waiting: 'Keep your full face in view; check lighting, distance and camera angle.', edge: 'Part of the face is near the edge. Move toward the centre.', small: 'The face is small in the image. Move closer or try detail mode.', good: 'Face region detected. Calibrate with relaxed eyes and a closed mouth.' },
  ko: { region: '얼굴 인식 영역', profile: '얼굴 인식', balanced: '표준', sensitive: '약한 얼굴 신호도 인식', detail: '세밀한 영상으로 인식', hint: '인식 민감도가 높으면 배경을 얼굴로 오인할 수 있습니다. 세밀한 영상은 처리량이 늘어납니다. 카메라를 다시 시작하면 적용됩니다.', eye: '눈 감기 감도', brow: '눈썹 감도', waiting: '얼굴 전체가 보이도록 조명·거리·카메라 각도를 확인하세요.', edge: '얼굴이 화면 가장자리에 가깝습니다. 중앙 쪽으로 이동하세요.', small: '화면에서 얼굴이 작습니다. 가까이 오거나 세밀한 영상을 사용하세요.', good: '얼굴 영역이 인식됐습니다. 눈과 입의 힘을 빼고 정면을 교정하세요.' },
  ja: { region: '顔の検出領域', profile: '顔の検出', balanced: '標準', sensitive: '弱い顔信号も検出', detail: '高精細な映像で検出', hint: '感度を上げると背景を顔と誤認する場合があります。高精細映像は処理量が増えます。カメラの再起動で適用します。', eye: 'まばたきの感度', brow: '眉の感度', waiting: '顔全体が映るよう、照明・距離・カメラ角度を確認してください。', edge: '顔が画面の端に近いため中央へ移動してください。', small: '顔が小さく映っています。近づくか高精細映像を試してください。', good: '顔を検出しました。目と口の力を抜いて正面を登録してください。' },
  zh: { region: '人脸识别区域', profile: '人脸识别', balanced: '标准', sensitive: '识别较弱的人脸信号', detail: '使用更清晰的视频', hint: '提高灵敏度可能将背景误识别为人脸。高清视频需要更多处理。重启摄像头后生效。', eye: '闭眼灵敏度', brow: '眉毛灵敏度', waiting: '请保持整张脸可见，并检查光线、距离和摄像头角度。', edge: '脸部靠近画面边缘，请向中央移动。', small: '画面中的脸部太小，请靠近或尝试高清视频。', good: '已识别人脸区域。请放松眼睛并闭嘴校准正面姿态。' },
};
