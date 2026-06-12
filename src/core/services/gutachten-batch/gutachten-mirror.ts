/**
 * Batch-lokaler Disk-Spiegel: schreibt einen im Batch erzeugten Abschnitts-
 * Entwurf zusätzlich als `.md` in den persönlichen Ordner
 * (`ZAH/antraege/{FKZ}/gutachten/{stepId}-{slug}.md`). NUR die Batch-Schleife
 * ruft das (der Einzellauf bleibt unangetastet); best-effort (Fehler werden im
 * Runner gefangen, blockieren die Generierung nie).
 */
import { atomicWrite } from '@/core/services/infrastructure/atomic-write';
import { gutachtenMdPath } from '@/core/services/personal-storage/personal-layout';
import { ZIM_EP_WORKFLOW } from '@/plugins/antraege/gutachten/workflow-definition';
import type { StepId } from '@/plugins/antraege/gutachten/types';

/** ASCII-Slug aus dem Abschnitts-Label (für den Dateinamen). */
export function slugFor(stepId: StepId): string {
  const label = ZIM_EP_WORKFLOW.find(d => d.id === stepId)?.label ?? stepId;
  const slug = label.toLowerCase().normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // kombinierende Diakritika entfernen (ö→o)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || stepId.toLowerCase();
}

function frontmatter(fkz: string, stepId: StepId, label: string, now: string): string {
  return [
    '---',
    `abschnitt: ${stepId}`,
    `fkz: ${fkz}`,
    `erzeugt_am: ${now}`,
    'status: entwurf',
    '---',
    '',
    `# Abschnitt ${stepId} — ${label}`,
    '',
  ].join('\n');
}

/** Schreibt EINEN erzeugten Abschnitt als .md in den persönlichen Ordner. */
export async function spiegeleAbschnitt(
  root: FileSystemDirectoryHandle, fkz: string, stepId: StepId, finalerText: string, now: string,
): Promise<void> {
  const label = ZIM_EP_WORKFLOW.find(d => d.id === stepId)?.label ?? stepId;
  const md = `${frontmatter(fkz, stepId, label, now)}${finalerText}\n`;
  await atomicWrite(root, gutachtenMdPath(fkz, stepId, slugFor(stepId)), md, { skipBackup: true });
}
