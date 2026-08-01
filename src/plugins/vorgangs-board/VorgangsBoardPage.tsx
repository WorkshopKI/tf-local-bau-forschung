/**
 * Das **Vorgangs-Board**: welche Aufgabe steht an welchem Antrag an?
 *
 * Der geteilte Ersatz für das private AB-XLSX-Dashboard. Drei Sichten desselben
 * Regelsatzes (Konzept 6.5): was ich tue, worauf ich warte, und was keine Regel
 * trifft. Die dritte ist keine Restekiste, sondern die Ehrlichkeits-Anzeige —
 * Anträge ohne Treffer verschwinden nicht, sie stehen dort.
 *
 * Gruppiert wird in **Kaskaden-Reihenfolge** des Regelsatzes, nicht nach
 * Häufigkeit: so liest sich das Board in derselben Ordnung wie die Regeln, und
 * ein Vergleich beider ist möglich.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { Badge } from '@/components/ui/badge';
import { SeitenHilfeButton } from '@/components/help/SeitenHilfeButton';
import { ROLLEN, ROLLE_LABEL, ROLLE_LANG, type Rolle } from '@/core/status';
import { bearbeiterScopeLabel } from '@/plugins/antraege/bearbeiterFilter';
import { useVorgangsBoard, type BoardTab, type BoardZeile } from './useVorgangsBoard';

const feldStil: React.CSSProperties = {
  border: '1px solid var(--tf-border)',
  background: 'var(--tf-bg-secondary)',
};
const feldKlasse = 'text-[12.5px] rounded px-2 py-1 bg-[var(--tf-bg)] text-[var(--tf-text)]';

/** Wer wartet: eine Rolle, der Antragsteller oder niemand Benanntes. */
function WartetAuf({ z }: { z: BoardZeile }): React.ReactElement | null {
  if (z.wartetAuf === null) return null;
  const text = z.wartetAuf === 'ast' ? 'Antragsteller' : ROLLE_LANG[z.wartetAuf];
  return <span className="text-[11px] text-[var(--tf-text-tertiary)]">wartet auf {text}</span>;
}

function Zeile({ z, onOeffnen }: {
  z: BoardZeile;
  onOeffnen: (z: BoardZeile) => void;
}): React.ReactElement {
  const [offen, setOffen] = useState(false);
  return (
    <li className="border-b border-[var(--tf-border)] last:border-b-0">
      <div className="flex items-baseline gap-2 px-2 py-1.5 hover:bg-[var(--tf-hover)]">
        <button
          type="button" onClick={() => onOeffnen(z)}
          className="font-mono text-[12px] text-[var(--tf-primary)] hover:underline cursor-pointer shrink-0"
        >
          {z.aktenzeichen}
        </button>
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--tf-text)]" title={z.titel}>
          {z.titel || '(ohne Titel)'}
        </span>
        <span className="shrink-0 text-[11px] text-[var(--tf-text-tertiary)]">{z.statusRoh}</span>
        {z.zustaendig.length > 0 && (
          <span className="shrink-0 text-[11px] text-[var(--tf-text-secondary)]">
            {z.zustaendig.map(r => ROLLE_LABEL[r]).join('/')}
          </span>
        )}
        <WartetAuf z={z} />
        {/* Die Herleitung: welche Regel, welche Felder. Ohne sie ist ein To-do
            eine Behauptung — mit ihr eine nachvollziehbare Ableitung. */}
        <button
          type="button" onClick={() => setOffen(v => !v)} aria-expanded={offen}
          title="Warum dieses To-do?"
          className="shrink-0 text-[11px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
        >
          warum?
        </button>
      </div>
      {offen && (
        <div className="px-2 pb-2 flex flex-col gap-0.5" style={{ background: 'var(--tf-bg-secondary)' }}>
          <span className="text-[11.5px] text-[var(--tf-text-secondary)]">{z.beschreibung}</span>
          <ul className="flex flex-wrap gap-x-3 gap-y-0.5">
            {z.belege.map(b => (
              <li key={b.feldId} className="text-[11px] text-[var(--tf-text-tertiary)]">
                <span className="font-mono">{b.feldId}</span>
                {' = '}
                {b.werte.length > 0 ? b.werte.join(', ') : <em>leer</em>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

function Gruppe({ todo, zeilen, onOeffnen }: {
  todo: string;
  zeilen: BoardZeile[];
  onOeffnen: (z: BoardZeile) => void;
}): React.ReactElement {
  const [offen, setOffen] = useState(true);
  return (
    <section className="rounded" style={feldStil}>
      <button
        type="button" onClick={() => setOffen(v => !v)} aria-expanded={offen}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 cursor-pointer"
      >
        <ChevronRight
          size={13} className="text-[var(--tf-text-tertiary)] transition-transform duration-200 shrink-0"
          style={{ transform: offen ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
        <span className="text-[13px] font-medium text-[var(--tf-text)]">{todo}</span>
        <span className="text-[11px] text-[var(--tf-text-tertiary)]">{zeilen.length}</span>
      </button>
      {offen && (
        <ul className="bg-[var(--tf-bg)]">
          {zeilen.map(z => <Zeile key={z.aktenzeichen} z={z} onOeffnen={onOeffnen} />)}
        </ul>
      )}
    </section>
  );
}

export function VorgangsBoardPage(): React.ReactElement {
  const api = useVorgangsBoard();
  const navigate = useNavigate();

  const oeffnen = (z: BoardZeile): void => {
    navigate(z.verbundId ? `/antraege/${z.verbundId}` : `/antraege?az=${z.aktenzeichen}`);
  };

  const TABS: { key: BoardTab; label: string }[] = [
    { key: 'meine', label: 'Meine Aufgaben' },
    { key: 'warten', label: 'Wartet auf andere' },
    { key: 'ohne', label: 'Kein To-do ermittelt' },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-6 pt-5 pb-3 flex flex-col gap-3 border-b border-[var(--tf-border)]">
        <PageHeader
          title="Vorgangs-Board"
          subtitle="Was steht an — abgeleitet aus den To-do-Regeln"
          actions={<SeitenHilfeButton pluginId="vorgangs-board" />}
        />
        <ScopeTabs
          variant="tabs"
          aria-label="Sicht"
          activeKey={api.tab}
          onChange={(k: string) => api.setTab(k as BoardTab)}
          items={TABS.map(t => ({ ...t, count: api.zaehler[t.key] }))}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {([ 'alle', ...ROLLEN ] as const).map(r => (
            <ToggleChip
              key={r}
              label={r === 'alle' ? 'Alle Rollen' : ROLLE_LABEL[r]}
              title={r === 'alle' ? undefined : ROLLE_LANG[r]}
              selected={api.rolle === r}
              onToggle={() => api.setRolle(r as Rolle | 'alle')}
            />
          ))}
          <span className="w-2" />
          <ToggleChip
            label={bearbeiterScopeLabel(api.kuerzelModus)}
            selected={api.nurMeine}
            onToggle={() => api.setNurMeine(!api.nurMeine)}
          />
          <span className="w-2" />
          <select value={api.jahr} className={feldKlasse} style={feldStil}
            aria-label="Jahr" onChange={e => api.setJahr(e.target.value)}>
            <option value="letzte3">Letzte 3 Jahrgänge</option>
            <option value="alle">Alle Jahre</option>
            {api.jahre.map(j => <option key={j} value={j}>{j}</option>)}
          </select>
          <select value={api.variante} className={feldKlasse} style={feldStil}
            aria-label="Fördervariante" onChange={e => api.setVariante(e.target.value)}>
            <option value="alle">Alle Fördervarianten</option>
            {api.varianten.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={api.phase} className={feldKlasse} style={feldStil}
            aria-label="ZAH-Phase" onChange={e => api.setPhase(e.target.value)}>
            <option value="alle">Alle ZAH-Phasen</option>
            {api.phasen.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 flex flex-col gap-2">
        {api.laden && (
          <p className="text-[13px] text-[var(--tf-text-tertiary)]">Lädt …</p>
        )}
        {api.fehler != null && (
          <p className="text-[12.5px] text-[var(--tf-danger-text)]">⚠ {api.fehler}</p>
        )}
        {!api.laden && api.ohneRegeln && (
          <div className="rounded px-2.5 py-2 flex items-center gap-2" style={feldStil}>
            <Badge variant="warning">keine Regeln</Badge>
            <span className="text-[12.5px] text-[var(--tf-text)]">
              Diese Katalog-Fassung führt keine To-do-Regeln. Im Status-Katalog unter
              „Referenzdaten" nachziehen — bis dahin kann das Board nichts ableiten.
            </span>
          </div>
        )}
        {/* Der Altbestand ist kein Rückstand: viele Spalten wurden früher nicht
            geführt, und eine Regel, die auf „leer" prüft, trifft dort
            massenhaft. Gemessen: 6 607 „ZuwB erstellen" über alle Jahrgänge,
            davon 0 im laufenden Jahr. */}
        {!api.laden && api.alleJahrgaenge && (
          <p className="text-[11.5px] text-[var(--tf-warning-text)]">
            Alle Jahrgänge: ältere Vorgänge führen viele Spalten gar nicht (etwa den
            Zuwendungsbescheid). Regeln, die auf „leer" prüfen, melden dort Aufgaben, die keine
            sind. Für die tägliche Arbeit sind die letzten drei Jahrgänge gemeint.
          </p>
        )}
        {!api.laden && !api.ohneRegeln && api.gruppen.length === 0 && (
          <p className="text-[12.5px] text-[var(--tf-text-tertiary)]">
            Keine Anträge in dieser Sicht.
          </p>
        )}
        {api.gruppen.map(g => (
          <Gruppe key={g.todo} todo={g.todo} zeilen={g.zeilen} onOeffnen={oeffnen} />
        ))}
        {!api.laden && (
          <p className="text-[11px] text-[var(--tf-text-tertiary)] pt-1">
            {api.zeilen.length} von {api.gesamt} Anträgen nach Filter ·
            {' '}{api.zaehler.meine} eigene · {api.zaehler.warten} wartend ·
            {' '}{api.zaehler.ohne} ohne To-do
          </p>
        )}
      </div>
    </div>
  );
}
