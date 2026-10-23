export interface ProjectFileError { code: string; path: string }

interface ProjectIdentity {
  name: string;
  relativePath: string;
  readOnly: boolean;
}

export interface LocalProject extends ProjectIdentity {
  error?: undefined;
  absolutePath: string;
  displayPath?: string;
  updatedAt: string;
  hasSprites: boolean;
  hasVariants: boolean;
  hasSource?: boolean;
  rigFile?: 'rig.json' | 'rig.draft.json';
  stage?: 'setup';
  image?: { width: number; height: number };
}

export interface UnreadableProject extends ProjectIdentity { error: ProjectFileError }
export type LocalProjectEntry = LocalProject | UnreadableProject;
