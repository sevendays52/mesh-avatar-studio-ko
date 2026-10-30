import { useEffect, useState } from 'react';
import { useI18n } from './i18n';
import { CopyButton } from './CopyButton';
import { authoringText } from './authoring-i18n';

export interface AuthoringProgress {
  complete: boolean;
  requiredDrawings: number;
  views: { id: string; source: boolean; missingDrawings: string[]; steps: Record<string, 'pending' | 'stale' | 'current'> }[];
  next: { action: string; view: string } | null;
}

export function AuthoringStatus({ name, projectPath }: { name: string; projectPath: string }) {
  const { language } = useI18n(), t = authoringText[language];
  const [result, setResult] = useState<{ name: string; progress?: AuthoringProgress; failed: boolean }>();
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const response = await fetch(`/__studio/projects/${encodeURIComponent(name)}/authoring`, { signal: controller.signal });
        if (!response.ok) throw new Error('Status unavailable');
        const progress = await response.json() as AuthoringProgress;
        if (!controller.signal.aborted) setResult({ name, progress, failed: false });
      } catch {
        if (!controller.signal.aborted) setResult({ name, failed: true });
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(() => { void refresh(); }, 15000);
      }
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [name]);
  const current = result?.name === name ? result : undefined;
  const progress = current?.progress;
  const request = t.resume.replaceAll('PROJECT', projectPath);
  return <section className="panel authoring-status" data-testid="authoring-status" aria-label={t.title}>
    <h3>{t.title}</h3>
    <p role="status">{current?.failed ? t.failed : !progress ? t.loading : progress.complete ? t.complete : t.inProgress}</p>
    {progress && <>
      <p>{t.drawingCount.replace('COUNT', String(progress.requiredDrawings))}</p>
      <ul>{progress.views.map(view => {
        const stale = Object.values(view.steps).includes('stale');
        const done = view.steps.review === 'current' && !stale;
        return <li key={view.id}><strong>{t.views[view.id as keyof typeof t.views] ?? view.id}</strong>: {stale ? t.stale : done ? t.reviewed : !view.source ? t.needsHead : view.steps.geometry !== 'current' ? t.needsGeometry : view.missingDrawings.length ? t.needsDrawings.replace('COUNT', String(view.missingDrawings.length)) : t.needsReview}</li>;
      })}</ul>
      {progress.next && <p>{t.next}: {t.views[progress.next.view as keyof typeof t.views] ?? progress.next.view} · {t.actions[progress.next.action as keyof typeof t.actions] ?? t.inProgress}</p>}
    </>}
    <CopyButton value={request} label={t.copyResume} />
    <p className="workflow-note">{t.consent}</p>
  </section>;
}
