/**
 * Sektion „Prüfkatalog" des Skill-Editors — die fachlichen Kriterien EINES Prüfers.
 *
 * Abgegrenzt von den zwei Nachbarn, mit denen man sie verwechseln kann:
 *  - **Umfang & Form** (`VorgabenEditor`) ist deterministisch messbar und geht als
 *    „Formale Vorgaben" IN den Prompt des erzeugenden Skills;
 *  - **Abnahme-Kriterien** (`qsKriterien`) sind dasselbe Vokabular, hängen aber am
 *    einzelnen Abschnitt und schlagen den Katalog dort (die engere Angabe gewinnt);
 *  - der **Prüfkatalog** hängt am Prüfer und gilt für das ganze Artefakt. `giltFuer`
 *    schneidet ihn zu, wo ein Kriterium nur einen Abschnitt betrifft.
 *
 * Eigene Datei, weil `SkillEditor.tsx` schon Prompt, Slots, Transport-Policy,
 * Modifikatoren, Regeln, Vorgaben, Kategorie und Reifegrad trägt.
 */
import { X } from 'lucide-react';
import type { PruefItem } from '@/core/services/skills';

interface Props {
  katalog: PruefItem[];
  canEdit: boolean;
  onChange: (next: PruefItem[]) => void;
}

const ZELLE =
  'rounded-[7px] border-[0.5px] border-[var(--tf-border)] bg-transparent px-2 py-1 '
  + 'text-[12.5px] text-[var(--tf-text)] outline-none focus:border-[var(--tf-primary)] disabled:opacity-60';

/**
 * Nächste freie ID — laufende Nummer statt Zufall, damit derselbe Klick auf
 * demselben Stand immer dieselbe ID ergibt (Diff und Historie bleiben lesbar).
 */
function naechsteId(katalog: PruefItem[]): string {
  const zahlen = katalog
    .map(i => /^k(\d+)$/.exec(i.id)?.[1])
    .filter((x): x is string => x !== undefined)
    .map(Number);
  return `k${(zahlen.length > 0 ? Math.max(...zahlen) : 0) + 1}`;
}

export function PruefkatalogEditor({ katalog, canEdit, onChange }: Props): React.ReactElement {
  const setze = (idx: number, patch: Partial<PruefItem>): void => {
    onChange(katalog.map((i, n) => (n === idx ? { ...i, ...patch } : i)));
  };

  return (
    <div>
      <p className="text-[11.5px] leading-[1.5] text-[var(--tf-text-tertiary)] m-0 mb-2.5">
        Ein prüfbarer Satz je Zeile — der Prüfer bewertet genau diese Punkte statt der generischen
        Dimensionen und darf die betroffenen Sätze benennen. „Gilt für" leer lassen heißt: für jeden
        Abschnitt. Trägt ein Abschnitt eigene Abnahme-Kriterien, gelten dort nur diese.
      </p>

      {katalog.length === 0 && (
        <p className="text-[12.5px] text-[var(--tf-text-tertiary)] py-1">
          Noch kein Kriterium — der Prüfer bewertet dann die generischen Dimensionen
          (Erdung, Kohärenz, Vollständigkeit, Ton).
        </p>
      )}

      <div className="flex flex-col">
        {katalog.map((item, idx) => (
          <div
            key={item.id}
            className="flex items-center gap-2 flex-wrap py-2 border-b-[0.5px] border-[var(--tf-border)]"
          >
            <input
              value={item.kriterium}
              disabled={!canEdit}
              placeholder="Jede Aussage ist durch die Vorhabensbeschreibung gedeckt."
              onChange={e => setze(idx, { kriterium: e.target.value })}
              className={`${ZELLE} flex-1 min-w-[240px]`}
            />
            <input
              value={item.gruppe}
              disabled={!canEdit}
              placeholder="Gruppe"
              onChange={e => setze(idx, { gruppe: e.target.value })}
              className={`${ZELLE} w-[120px]`}
            />
            <input
              value={(item.giltFuer ?? []).join(', ')}
              disabled={!canEdit}
              placeholder="gilt für (A, C)"
              onChange={e => {
                const ids = e.target.value.split(',').map(x => x.trim()).filter(Boolean);
                setze(idx, { giltFuer: ids.length > 0 ? ids : undefined });
              }}
              className={`${ZELLE} w-[120px]`}
              title="Schritt-Kennungen, für die das Kriterium gilt. Leer = jeder Abschnitt."
            />
            <label
              className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--tf-text-secondary)]"
              title="Aus: das Kriterium bleibt erhalten, geht aber nicht mehr in den Prüf-Prompt."
            >
              <input
                type="checkbox"
                checked={item.aktiv !== false}
                disabled={!canEdit}
                onChange={e => setze(idx, { aktiv: e.target.checked ? undefined : false })}
                className="accent-[var(--tf-primary)]"
              />
              aktiv
            </label>
            {canEdit && (
              <button
                type="button"
                aria-label="Kriterium entfernen"
                onClick={() => onChange(katalog.filter((_, n) => n !== idx))}
                className="p-1 rounded-[6px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)]"
              >
                <X size={14} />
              </button>
            )}

            <label className="basis-full flex items-baseline gap-2 pt-1 text-[11.5px] text-[var(--tf-text-tertiary)]">
              <span className="shrink-0">Grund</span>
              <input
                value={item.herkunft ?? ''}
                disabled={!canEdit}
                placeholder={'Woher stammt das Kriterium? z.B. Richtlinie 4.5.1'}
                onChange={e => setze(idx, { herkunft: e.target.value.trim() || undefined })}
                className={`${ZELLE} flex-1 min-w-[220px] text-[12px] text-[var(--tf-text-secondary)]`}
              />
            </label>
          </div>
        ))}
      </div>

      {canEdit && (
        <button
          type="button"
          onClick={() => onChange([...katalog, { id: naechsteId(katalog), gruppe: 'Allgemein', kriterium: '' }])}
          className="mt-3 text-[12.5px] text-[var(--tf-primary)] hover:underline"
        >
          + Kriterium
        </button>
      )}
    </div>
  );
}
