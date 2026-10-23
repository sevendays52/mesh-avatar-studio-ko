import { useEffect, useRef, type RefObject } from 'react';
import type { AvatarViewport, Rig } from 'mesh-avatar';
import { defaultViewport, frameViewport, parseViewport } from './viewport';
import { liveText } from './i18n';

export function AvatarFraming({ value, onChange, canvas, rig, fit, language }: {
  value: AvatarViewport; onChange: (value: AvatarViewport) => void;
  fit: 'contain' | 'cover'; canvas: RefObject<HTMLCanvasElement | null>;
  rig: Rig | null; language: keyof typeof liveText;
}) {
  const t = liveText[language], current = useRef(value); current.current = value;
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let drag: { id: number; x: number; y: number; view: AvatarViewport } | null = null;
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault(); element.focus(); element.setPointerCapture(event.pointerId);
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, view: current.current };
    };
    const move = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return;
      const rect = element.getBoundingClientRect();
      onChange(parseViewport({ ...drag.view, x: drag.view.x + (event.clientX - drag.x) / rect.width, y: drag.view.y + (event.clientY - drag.y) / rect.height }));
    };
    const up = (event: PointerEvent) => {
      if (drag?.id !== event.pointerId) return;
      drag = null;
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect(), view = current.current;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
      const zoom = parseViewport({ zoom: view.zoom * Math.exp(-delta * 0.0015) }).zoom, ratio = zoom / view.zoom;
      const x = (event.clientX - rect.left) / rect.width - 0.5, y = (event.clientY - rect.top) / rect.height - 0.5;
      onChange(parseViewport({ zoom, x: x - (x - view.x) * ratio, y: y - (y - view.y) * ratio }));
    };
    const key = (event: KeyboardEvent) => {
      const view = current.current, step = event.shiftKey ? 0.1 : 0.02;
      const directions: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (directions[event.key]) { event.preventDefault(); const [x, y] = directions[event.key]; onChange(parseViewport({ ...view, x: view.x + x, y: view.y + y })); }
      else if (['+', '=', '-'].includes(event.key)) { event.preventDefault(); onChange(parseViewport({ ...view, zoom: view.zoom * (event.key === '-' ? 1 / 1.1 : 1.1) })); }
    };
    element.addEventListener('pointerdown', down); element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up); element.addEventListener('pointercancel', up); element.addEventListener('lostpointercapture', up);
    element.addEventListener('wheel', wheel, { passive: false }); element.addEventListener('keydown', key);
    return () => {
      element.removeEventListener('pointerdown', down); element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up); element.removeEventListener('pointercancel', up); element.removeEventListener('lostpointercapture', up);
      element.removeEventListener('wheel', wheel); element.removeEventListener('keydown', key);
    };
  }, [canvas, onChange]);
  const preset = (name: 'face' | 'upper') => {
    if (!rig || !canvas.current) return;
    onChange(frameViewport(rig, canvas.current.clientWidth, canvas.current.clientHeight, name, fit));
  };
  return <section className="avatar-framing"><h2>{t.avatarFraming}</h2>
    <div className="live-buttons"><button disabled={!rig} onClick={() => preset('face')}>{t.faceFrame}</button><button disabled={!rig} onClick={() => preset('upper')}>{t.upperFrame}</button><button onClick={() => onChange({ ...defaultViewport })}>{t.resetFrame}</button></div>
    <label>{t.zoom}<input type="range" aria-label={t.zoom} min="0.25" max="8" step="0.01" value={value.zoom} onChange={e => onChange({ ...value, zoom: Number(e.target.value) })} /><output>{Math.round(value.zoom * 100)}%</output></label>
    {(['x', 'y'] as const).map(axis => <label key={axis}>{t[axis === 'x' ? 'positionX' : 'positionY']}<input type="range" aria-label={t[axis === 'x' ? 'positionX' : 'positionY']} min="-4" max="4" step="0.01" value={value[axis]} onChange={e => onChange({ ...value, [axis]: Number(e.target.value) })} /><output>{Math.round(value[axis] * 100)}%</output></label>)}
    <small>{t.frameHint}</small>
  </section>;
}
