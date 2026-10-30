import { useEffect, useState } from 'react';
import type { LocalProject, LocalProjectEntry } from './project';
import { createImageProject, CreateImageProjectError, localProjects } from './project';
import { useI18n } from './i18n';
import { projectFlowText } from './project-flow-i18n';
import { CopyButton } from './CopyButton';
import { AuthoringStatus } from './AuthoringStatus';

export function ProjectHub({ projects, rootPath, pending, onSelect, onCreated, onProjects, onBack, onEditor, opening }: {
  projects: LocalProjectEntry[] | null; rootPath?: string; pending: LocalProject | null;
  onSelect(project: LocalProjectEntry): void; onCreated(project: LocalProject): void;
  onProjects(projects: LocalProjectEntry[] | null): void; onBack(): void; onEditor(): void; opening: boolean;
}) {
  const { language, t: ui } = useI18n(), t = projectFlowText[language];
  const [creating, setCreating] = useState(false), [refreshError, setRefreshError] = useState(false);
  const refresh = async () => {
    const list = await localProjects(); setRefreshError(list === null); onProjects(list); return list;
  };
  useEffect(() => {
    if (!pending) return;
    let active = true, timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const list = await localProjects();
      if (!active) return;
      setRefreshError(list === null);
      if (list) onProjects(list);
      timer = setTimeout(() => { void poll(); }, 2500);
    };
    timer = setTimeout(() => { void poll(); }, 1500);
    return () => { active = false; clearTimeout(timer); };
  }, [pending?.name, onProjects]);
  if (pending) {
    const current = projects?.find(project => project.name === pending.name);
    const ready = current && !current.error && current.stage !== 'setup';
    const prompt = t.prompt.replaceAll('PROJECT', pending.relativePath).replaceAll('NAME', pending.name);
    return <section className="project-hub" data-testid="project-handoff">
      <button onClick={onBack}>{t.back}</button>
      <div className="hub-heading"><span className="hub-step">02 / 02</span><h2>{t.handoffTitle}</h2><p>{t.handoffHelp}</p></div>
      <div className="handoff-grid">
        <div className="panel handoff-image"><img src={`/__studio/projects/${encodeURIComponent(pending.name)}/source.png`} alt={t.source} /><strong>{pending.name}</strong></div>
        <div className="panel handoff-instructions"><ol>{t.steps.map(step => <li key={step}>{step}</li>)}</ol>
          {rootPath && <CopyButton value={rootPath} label={t.folder} />}
          <label className="handoff-prompt">{t.request}<textarea readOnly value={prompt} rows={8} /></label>
          <CopyButton value={prompt} label={t.request} />
          <p role="status">{ready ? t.completed : t.waiting}</p>
          <AuthoringStatus key={pending.name} name={pending.name} projectPath={pending.relativePath} />
          {refreshError && <p role="alert" className="error">{t.checkFailed}</p>}
          <div className="hub-actions"><button onClick={() => { void refresh(); }}>{t.refresh}</button><button className="primary" disabled={!ready || opening} onClick={() => { if (ready) onSelect(current); }}>{opening ? t.checking : t.open}</button></div>
        </div>
      </div>
    </section>;
  }
  if (creating) return <NewProjectForm onCancel={() => setCreating(false)} onCreated={project => { setCreating(false); onCreated(project); }} />;
  return <section className="project-hub" data-testid="project-hub">
    <div className="hub-heading"><h2>{t.title}</h2><p>{t.intro}</p></div>
    <div className="hub-actions"><button className="primary" disabled={!rootPath} onClick={() => setCreating(true)}>{t.newProject}</button><button onClick={() => { void refresh(); }}>{t.refresh}</button><button onClick={onEditor}>{t.editor}</button></div>
    {!rootPath && <p role="status">{t.unavailable}</p>}
    {refreshError && <p role="alert" className="error">{t.checkFailed}</p>}
    <div className="hub-projects">{projects?.map(project => <button className="panel hub-project" data-testid={`hub-project-${project.name}`} key={project.name} disabled={opening || !!project.error} onClick={() => onSelect(project)}>
      <strong>{project.readOnly ? t.sample : project.name}</strong>
      <span>{project.error ? ui.unreadableProject : project.stage === 'setup' ? t.pending : t.ready}</span>
      <small>{project.relativePath}</small>
    </button>)}</div>
    {projects?.length === 0 && <p>{t.empty}</p>}
  </section>;
}

function NewProjectForm({ onCancel, onCreated }: { onCancel(): void; onCreated(project: LocalProject): void }) {
  const { language } = useI18n(), t = projectFlowText[language];
  const [name, setName] = useState('my-avatar'), [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const create = async () => {
    if (!file || busy) return;
    setBusy(true); setError('');
    try { onCreated(await createImageProject(name.trim(), file)); }
    catch (error) {
      const code = error instanceof CreateImageProjectError ? error.message : 'failed';
      setError(code === 'invalidName' ? t.invalidName : code === 'invalidImage' ? t.invalidImage : code === 'imageTooLarge' ? t.imageTooLarge : t.failed);
    } finally { setBusy(false); }
  };
  return <section className="project-hub" data-testid="new-project-form">
    <button disabled={busy} onClick={onCancel}>{t.back}</button>
    <div className="hub-heading"><span className="hub-step">01 / 02</span><h2>{t.createTitle}</h2><p>{t.createHelp}</p></div>
    <form className="panel new-project-form" onSubmit={event => { event.preventDefault(); void create(); }}>
      <label>{t.name}<input value={name} onChange={event => setName(event.target.value)} required pattern="[A-Za-z0-9][A-Za-z0-9_\-]{0,79}" maxLength={80} disabled={busy} autoComplete="off" /></label><p>{t.nameHelp}</p>
      <label>{t.image}<input type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" required disabled={busy} onChange={event => { setFile(event.target.files?.[0] ?? null); setError(''); }} /></label><p>{t.imageHelp}</p>
      {preview && <img className="new-project-preview" src={preview} alt={t.source} />}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="hub-actions"><button type="button" disabled={busy} onClick={onCancel}>{t.cancel}</button><button className="primary" type="submit" disabled={!file || busy}>{busy ? t.creating : t.create}</button></div>
    </form>
  </section>;
}
