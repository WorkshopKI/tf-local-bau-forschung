/**
 * „Meilenstein absehbar nicht zu halten?" — die eine schreibende Aktion, die an
 * einem Verbund hängt.
 *
 * Bis v3.39 lag das Formular modul-lokal in
 * [MeilensteinSection](MeilensteinSection.tsx). Es steht jetzt hier, weil die
 * Kopfkarte des aufgeklappten Bereichs dieselbe Meldung anbietet — mit dem
 * Blocker vorausgewählt. Zwei Formulare wären zwei Verhaltensweisen für
 * denselben Schreibvorgang.
 *
 * **Die Meldung geht in den persönlichen Ordner**, nie auf den Daten-Share
 * (Pitfall #24/#26). Ob sie dort ankam, sagt `nurLokal` am Aufrufer — dieses
 * Bauteil kennt den Ordner nicht.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { feldStil } from '@/plugins/meilensteine/labels';

export interface RisikoKnoten {
  id: string;
  nummer: string;
  label: string;
}

export function RisikoFormular({ knotenAuswahl, vorauswahlId, onMelden, onFertig }: {
  knotenAuswahl: RisikoKnoten[];
  /** Meilenstein, der vorgewählt sein soll — sonst der erste der Liste. */
  vorauswahlId?: string;
  onMelden: (knotenId: string, text: string, tage?: number) => Promise<void>;
  /** Läuft nach einer erfolgreichen Meldung — z. B. um das Formular zuzuklappen. */
  onFertig?: () => void;
}): React.ReactElement {
  const [knotenId, setKnotenId] = useState(
    vorauswahlId !== undefined && knotenAuswahl.some(k => k.id === vorauswahlId)
      ? vorauswahlId
      : knotenAuswahl[0]?.id ?? '',
  );
  const [text, setText] = useState('');
  const [tage, setTage] = useState('');
  const melden = useAsyncAction(async () => {
    await onMelden(knotenId, text, tage.trim() ? Number(tage) : undefined);
    setText('');
    setTage('');
    onFertig?.();
  });

  const bereit = knotenId !== '' && text.trim().length > 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <select
          value={knotenId}
          onChange={e => setKnotenId(e.target.value)}
          aria-label="Meilenstein"
          // Breit genug für die ausgeschriebenen Meilenstein-Titel — bei 280px
          // brach der gewählte Eintrag mitten im Wort ab.
          title={knotenAuswahl.find(k => k.id === knotenId)?.label}
          className="text-[12px] rounded px-1.5 py-1 bg-[var(--tf-bg)] text-[var(--tf-text)] cursor-pointer max-w-[440px]"
          style={feldStil}
        >
          {knotenAuswahl.map(k => (
            <option key={k.id} value={k.id}>{k.nummer} · {k.label}</option>
          ))}
        </select>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Woran hängt es?"
          aria-label="Begründung"
          className="flex-1 min-w-[200px] text-[12px] rounded px-2 py-1 bg-[var(--tf-bg)] text-[var(--tf-text)]"
          style={feldStil}
        />
        <label className="flex items-center gap-1 text-[11.5px] text-[var(--tf-text-tertiary)]">
          Verzug ca.
          <input
            type="number" min={0} value={tage}
            onChange={e => setTage(e.target.value)}
            className="w-[64px] text-[12px] rounded px-1.5 py-1 bg-[var(--tf-bg)] text-[var(--tf-text)] text-right"
            style={feldStil}
            aria-label="Erwartete Verzögerung in Tagen"
          />
          Tage
        </label>
        <Button variant="ghost" size="sm" disabled={!bereit || melden.busy} onClick={() => melden.run()}>
          {melden.busy ? 'Meldet …' : 'Risiko melden'}
        </Button>
      </div>
      {melden.error != null && (
        <p className="text-[11.5px] text-[var(--tf-danger-text)]">⚠ {melden.error}</p>
      )}
    </div>
  );
}
