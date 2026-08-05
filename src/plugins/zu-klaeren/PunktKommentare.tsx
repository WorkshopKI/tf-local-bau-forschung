/**
 * Der Kommentarfaden zu einem Punkt: Beiträge chronologisch, darunter die Eingabe.
 *
 * Bewusst ~80 eigene Zeilen statt eines Forks von `FeedbackCommentThread` — der
 * hängt fest an `FeedbackItem` und `addComment`. Ihn zu verallgemeinern hieße,
 * zwei Domänen in einer Komponente zu verheiraten, für die zweite Domäne, die es
 * je geben wird.
 *
 * Zurückziehen betrifft immer den **eigenen jüngsten** Beitrag; fremde Beiträge
 * hat hier niemand anzufassen.
 */
import { useState } from 'react';
import { Undo2 } from 'lucide-react';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { Button } from '@/components/ui/button';
import { beitragDatum, rahmenStil } from './labels';
import { normalisiereAutor, type Beitrag } from './typen';
import type { EintragEingabe } from './fold';

interface Props {
  punktId: string;
  beitraege: readonly Beitrag[];
  meinName: string | undefined;
  gesperrt: boolean;
  sperrGrund: string;
  aeussern: (eingabe: Omit<EintragEingabe, 'autor'>) => Promise<void>;
}

export function PunktKommentare({
  punktId, beitraege, meinName, gesperrt, sperrGrund, aeussern,
}: Props): React.ReactElement {
  const [text, setText] = useState('');
  // Beiträge tragen die Schreibweise des Profils; verglichen wird normalisiert.
  const ich = meinName === undefined ? undefined : normalisiereAutor(meinName);
  const habeEigenen = beitraege.some(b => normalisiereAutor(b.autor) === ich);

  const senden = useAsyncAction(async () => {
    const t = text.trim();
    if (t === '') return;
    await aeussern({ punktId, kommentar: t });
    setText('');
  });
  const zurueck = useAsyncAction(async () => {
    await aeussern({ punktId, kommentarZurueck: true });
  });

  return (
    <div className="flex flex-col gap-2">
      {beitraege.length === 0 && (
        <p className="text-[12px] text-[var(--tf-text-tertiary)]">Noch kein Beitrag.</p>
      )}

      {beitraege.map(b => (
        <div key={`${b.autor}-${b.ts}`} className="flex flex-col gap-0.5">
          <div className="flex items-baseline gap-2">
            <span className="text-[11.5px] font-medium text-[var(--tf-text)]">{b.autor}</span>
            <span className="text-[11px] text-[var(--tf-text-tertiary)] tabular-nums">
              {beitragDatum(b.ts)}
            </span>
          </div>
          <p className="text-[12.5px] text-[var(--tf-text-secondary)] whitespace-pre-wrap leading-snug">
            {b.text}
          </p>
        </div>
      ))}

      {gesperrt ? (
        // Kurz halten: den vollen Grund sagt die Seite EINMAL oben. Stünde er an
        // jedem der acht Fäden, läse man ihn achtmal und den Rest nicht mehr.
        <p className="text-[11.5px] text-[var(--tf-text-tertiary)]" title={sperrGrund}>
          Beitragen ist gesperrt — der Grund steht oben auf der Seite.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <textarea
            aria-label="Beitrag"
            rows={2}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Deine Einschätzung …"
            className="w-full text-[12.5px] rounded px-2 py-1.5 bg-[var(--tf-bg)] text-[var(--tf-text)] resize-y"
            style={rahmenStil}
          />
          <div className="flex items-center gap-2">
            <Button
              variant="primary" size="sm"
              disabled={senden.busy || text.trim() === ''}
              onClick={() => senden.run()}
            >
              {senden.busy ? 'Sichert …' : 'Beitragen'}
            </Button>
            {habeEigenen && (
              <Button
                variant="ghost" size="sm"
                disabled={zurueck.busy}
                title="Zieht Deinen jüngsten Beitrag zu diesem Punkt zurück"
                onClick={() => zurueck.run()}
              >
                <Undo2 size={13} /> Eigenen zurückziehen
              </Button>
            )}
          </div>
          {(senden.error ?? zurueck.error) != null && (
            <span className="text-[11.5px] text-[var(--tf-danger-text)]">
              ⚠ {senden.error ?? zurueck.error}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
