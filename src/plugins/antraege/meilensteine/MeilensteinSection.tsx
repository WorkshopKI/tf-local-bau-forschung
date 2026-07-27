/**
 * Sektion „Fristen & Meilensteine" (`#meilensteine`) der Verbund-Detailseite.
 * Zeigt den Zeitstrahl Soll gegen Ist, die Restzeit zur Gesamtfrist und die
 * Risiko-Meldung an die Projektleitung.
 *
 * Rendert nichts, solange kein freigegebener Plan oder keine Bewertung vorliegt
 * — eine leere Überschrift wäre schlechter als gar keine Sektion.
 *
 * Einklappbar mit Default ZU; Prognose, Frist und Restzeit stehen im Kopf und
 * bleiben damit auch eingeklappt sichtbar.
 */
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useCollapsedSection } from '@/core/hooks/useCollapsedSection';
import { isMeilensteinMonitoringEnabled } from '@/config/feature-flags';
import { sortiereKnoten, type MeilensteinRisiko } from '@/core/meilensteine';
import { MeilensteinLeiste } from '@/plugins/meilensteine/MeilensteinLeiste';
import { PROGNOSE_FARBE, PROGNOSE_LABEL, feldStil, formatDatum } from '@/plugins/meilensteine/labels';
import { useVerbundMeilensteine } from './useVerbundMeilensteine';

function RisikoFormular({ knotenAuswahl, onMelden }: {
  knotenAuswahl: { id: string; nummer: string; label: string }[];
  onMelden: (knotenId: string, text: string, tage?: number) => Promise<void>;
}): React.ReactElement {
  const [knotenId, setKnotenId] = useState(knotenAuswahl[0]?.id ?? '');
  const [text, setText] = useState('');
  const [tage, setTage] = useState('');
  const melden = useAsyncAction(async () => {
    await onMelden(knotenId, text, tage.trim() ? Number(tage) : undefined);
    setText('');
    setTage('');
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

function RisikoZeile({ risiko, nummer, onErledigen }: {
  risiko: MeilensteinRisiko;
  nummer: string;
  onErledigen: (id: string) => Promise<void>;
}): React.ReactElement {
  const erledigen = useAsyncAction(async () => { await onErledigen(risiko.id); });
  return (
    <li className="flex items-center gap-2 rounded px-2 py-1 text-[12px]" style={feldStil}>
      <span className="shrink-0 font-mono text-[10.5px] text-[var(--tf-text-tertiary)]">{nummer}</span>
      <span className="flex-1 min-w-0 truncate text-[var(--tf-text)]" title={risiko.text}>
        {risiko.text}
      </span>
      {risiko.erwarteteVerzoegerungTage !== undefined && (
        <span className="shrink-0 text-[11px] text-[var(--tf-warning-text)]">
          +{risiko.erwarteteVerzoegerungTage} T
        </span>
      )}
      <span className="shrink-0 text-[11px] text-[var(--tf-text-tertiary)]">
        {formatDatum(risiko.gemeldetAm)}
      </span>
      <Button variant="ghost" size="sm" disabled={erledigen.busy} onClick={() => erledigen.run()}>
        {erledigen.busy ? '…' : 'Erledigt'}
      </Button>
    </li>
  );
}

export function MeilensteinSection({ verbundId }: { verbundId: string }): React.ReactElement | null {
  const api = useVerbundMeilensteine(verbundId);
  // Einklappbar, Default ZU (ein bereits persistierter Zustand gewinnt): die
  // Detailseite ist lang, der Zeitstrahl ist Nachschlagen — die Kennzahlen im
  // Kopf bleiben sichtbar. Body via CSS verstecken statt unmounten, damit ein
  // halb getippter Risiko-Text das Zuklappen überlebt. Hook VOR den Early
  // Returns (Hook-Reihenfolge, React #310).
  const [open, toggleOpen] = useCollapsedSection('verbund_meilensteine_collapsed', { defaultOpen: false });

  if (!isMeilensteinMonitoringEnabled()) return null;
  if (api.laden) {
    return <div className="text-[13px] text-[var(--tf-text-tertiary)]">Lädt …</div>;
  }
  if (!api.plan || !api.bewertung) return null;

  const b = api.bewertung;
  const auswahl = sortiereKnoten(api.plan.knoten)
    .filter(k => k.aktiv)
    .map(k => ({ id: k.id, nummer: k.nummer, label: k.label }));
  const gemeldet = [...api.risiken.values()];
  const knotenById = new Map(api.plan.knoten.map(k => [k.id, k]));

  return (
    <div>
      {/* Kopf: Titel + die Kennzahlen, die auch eingeklappt sichtbar bleiben
          müssen — Prognose und Restzeit sind der Grund, warum es die Sektion
          gibt; der Zeitstrahl ist die Begründung dazu. */}
      <div className="flex items-center gap-3 flex-wrap text-[12px] mb-3">
        <button
          type="button"
          onClick={toggleOpen}
          aria-expanded={open}
          className="flex items-center gap-1.5 cursor-pointer"
        >
          <ChevronRight
            size={15}
            className="text-[var(--tf-text-tertiary)] transition-transform duration-200 shrink-0"
            style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
          />
          <span className="text-[16px] font-medium text-[var(--tf-text)]">Fristen &amp; Meilensteine</span>
        </button>
        <span style={{ color: PROGNOSE_FARBE[b.prognose] }}>{PROGNOSE_LABEL[b.prognose]}</span>
        <span className="text-[var(--tf-text-secondary)]">Eingang {formatDatum(b.antragsdatum)}</span>
        <span className="text-[var(--tf-text-secondary)]">Frist {formatDatum(b.fristDatum)}</span>
        <span className="text-[var(--tf-text-secondary)]">
          {b.restTage === null
            ? 'Restzeit unbekannt'
            : b.restTage >= 0 ? `noch ${b.restTage} Tage` : `${-b.restTage} Tage überfällig`}
        </span>
        {b.wocheAktuell !== null && (
          <span className="text-[var(--tf-text-tertiary)]">Bearbeitungswoche {b.wocheAktuell}</span>
        )}
      </div>

      <div className={open ? undefined : 'hidden'}>
      <MeilensteinLeiste bewertung={b} knoten={api.plan.knoten} />

      <div className="mt-4 flex flex-col gap-2">
        <div className="text-[12px] font-medium text-[var(--tf-text-secondary)]">
          Meilenstein absehbar nicht zu halten?
        </div>
        <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          Die Meldung geht in Ihren persönlichen Ordner; die Projektleitung sammelt sie von dort ein.
        </p>
        <RisikoFormular knotenAuswahl={auswahl} onMelden={api.melden} />
        {api.nurLokal && (
          <p className="text-[11.5px] text-[var(--tf-warning-text)]">
            Kein persönlicher Ordner verbunden — die Meldung liegt nur auf diesem Gerät und
            erreicht die Projektleitung nicht.
          </p>
        )}

        {gemeldet.length > 0 && (
          <ul className="flex flex-col gap-1">
            {gemeldet.map(r => (
              <RisikoZeile
                key={r.id}
                risiko={r}
                nummer={knotenById.get(r.knotenId)?.nummer ?? '—'}
                onErledigen={api.erledigen}
              />
            ))}
          </ul>
        )}
      </div>
      </div>
    </div>
  );
}
