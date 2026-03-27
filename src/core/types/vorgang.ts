export type VorgangStatus =
  | 'neu'
  | 'in_bearbeitung'
  | 'nachforderung'
  | 'in_pruefung'
  | 'genehmigt'
  | 'abgelehnt'
  | 'archiviert';

export interface Vorgang {
  id: string;
  type: 'bauantrag' | 'forschung';
  title: string;
  status: VorgangStatus;
  priority: 'niedrig' | 'normal' | 'hoch' | 'dringend';
  assignee: string;
  created: string;
  modified: string;
  deadline?: string;
  tags: string[];
  notes: string;
}

export interface Artifact {
  id: string;
  type: 'nachforderung' | 'gutachten' | 'email' | 'pruefbericht' | 'bewilligung';
  filename: string;
  content: string;
  created: string;
  author: string;
  tags: string[];
  vorgangId: string;
}
