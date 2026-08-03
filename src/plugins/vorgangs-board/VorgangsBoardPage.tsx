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
import { BereichChip } from '@/components/bereich/BereichChip';
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { Badge } from '@/components/ui/badge';
import { SeitenHilfeButton } from '@/components/help/SeitenHilfeButton';
import { ROLLEN, ROLLE_LABEL, ROLLE_LANG, type Rolle } from '@/core/status';
import { AbgeleitetMarke, TodoHerleitung, WartetAuf } from '@/components/vorgang/TodoAnzeige';
import { bearbeiterScopeLabel } from '@/plugins/antraege/bearbeiterFilter';
import { useVorgangsBoard, sichtVon, type BoardTab, type BoardZeile } from './useVorgangsBoard';
import { AuswertungSicht, FristenSicht } from './CockpitSichten';

const feldStil: React.CSSProperties = {
  border: '1px solid var(--tf-border)',
  background: 'var(--tf-bg-secondary)',
};
const feldKlasse = 'text-[12.5px] rounded px-2 py-1 bg-[var(--tf-bg)] text-[var(--tf-text)]';

/**
 * Das To-do einer FREMDEN Rolle, gedämpft daneben.
 *
 * Nur echte Treffer — ein geliehenes Fremd-To-do wäre eine Aussage über eine
 * Rolle, die selbst noch keine hat. Solange nur der AB-Satz gepflegt ist,
 * erscheint hier deshalb nichts; mit dem ersten FB-Regelsatz erscheint es.
 */
function FremdeSpuren({ z, rolle }: { z: BoardZeile; rolle: Rolle | 'alle' }): React.ReactElement | null {
  const andere = ROLLEN.filter(r => r !== rolle)
    .map(r => ({ r, e: z.todos[r] }))
    .filter(x => x.e.todo !== null && x.e.quelle === 'regel');
  if (andere.length === 0) return null;
  return (
    <span className="shrink-0 text-[11px] text-[var(--tf-text-tertiary)] truncate max-w-[220px]">
      {andere.map(x => `${ROLLE_LABEL[x.r]}: ${x.e.todo}`).join(' · ')}
    </span>
  );
}

function Zeile({ z, rolle, onOeffnen }: {
  z: BoardZeile;
  rolle: Rolle | 'alle';
  onOeffnen: (z: BoardZeile) => void;
}): React.ReactElement {
  const [offen, setOffen] = useState(false);
  const e = sichtVon(z, rolle);
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
        {/* Nur „hängt" bekommt eine Marke. „unbewertet" schweigt hier bewusst:
            es steht im Kopf als Zahl, aber an der Zeile wäre es ein Alarm ohne
            Aussage. */}
        {z.waechter.urteil === 'haengt' && (
          <span
            className="shrink-0 text-[11px] text-[var(--tf-warning-text)] whitespace-nowrap"
            title={z.waechter.grund}
          >
            {/* „≥" wo genähert wird: das jüngste `D_`-Datum ist eine
                Untergrenze, weil mehrfach gesetzte Kürzel nur das letzte Datum
                tragen (V9). Wo das Journal die Änderung belegt, steht die
                Zahl ohne Vorbehalt. */}
            hängt {z.waechter.belegt ? '' : '≥'}{z.waechter.tage} T
          </span>
        )}
        {e.zustaendig.length > 0 && (
          <span className="shrink-0 text-[11px] text-[var(--tf-text-secondary)]">
            {e.zustaendig.map(r => ROLLE_LABEL[r]).join('/')}
          </span>
        )}
        <AbgeleitetMarke e={e} rolle={rolle} />
        <WartetAuf e={e} />
        <FremdeSpuren z={z} rolle={rolle} />
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
        <div className="px-2 pb-2" style={{ background: 'var(--tf-bg-secondary)' }}>
          <TodoHerleitung e={e} rolle={rolle} waechterGrund={z.waechter.grund} />
        </div>
      )}
    </li>
  );
}

function Gruppe({ todo, zeilen, rolle, onOeffnen }: {
  todo: string;
  zeilen: BoardZeile[];
  rolle: Rolle | 'alle';
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
        {/* Eine Gruppe, die nur geliehen dasteht, sagt das am Kopf — sonst liest
            man sie als gepflegtes Ergebnis eines Regelsatzes, den es nicht gibt. */}
        {zeilen.every(z => sichtVon(z, rolle).quelle === 'abgeleitet') && (
          <span
            className="text-[11px] italic text-[var(--tf-text-tertiary)]"
            title="Alle Einträge dieser Gruppe sind aus einer fremden Regel abgeleitet — für diese Rolle gibt es dazu noch keine eigene."
          >
            geliehen
          </span>
        )}
      </button>
      {offen && (
        <ul className="bg-[var(--tf-bg)]">
          {zeilen.map(z => (
            <Zeile key={z.aktenzeichen} z={z} rolle={rolle} onOeffnen={onOeffnen} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function VorgangsBoardPage(): React.ReactElement {
  const api = useVorgangsBoard();
  const navigate = useNavigate();

  const oeffnen = (z: BoardZeile): void => {
    // Beides über den Pfad: `?az=` liest niemand — der Parameter war ein toter
    // Link, der still auf einer leeren Liste landete. `/antraege/<akz>` setzt
    // die Auswahl über den Router und öffnet den Antrag auch dann, wenn er
    // außerhalb des Betrachtungsbereichs liegt.
    navigate(`/antraege/${z.verbundId ?? z.aktenzeichen}`);
  };

  const TABS: { key: BoardTab; label: string }[] = [
    { key: 'meine', label: 'Meine Aufgaben' },
    { key: 'warten', label: 'Wartet auf andere' },
    { key: 'ohne', label: 'Kein To-do ermittelt' },
    // Dieselbe Menge unter zwei anderen Fragen: wann läuft es ab, und wo steht
    // der Bestand insgesamt.
    { key: 'fristen', label: 'Fristen' },
    { key: 'auswertung', label: 'Auswertung' },
  ];
  const cockpit = api.tab === 'fristen' || api.tab === 'auswertung';

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-6 pt-5 pb-3 flex flex-col gap-3 border-b border-[var(--tf-border)]">
        <PageHeader
          title="Vorgangs-Board"
          subtitle="Was steht an, wo klemmt es, wann läuft es ab"
          meta={<BereichChip ausgeblendet={api.ausgeblendet} />}
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
          <ToggleChip
            label="hängt fest"
            title="Keine Vorgangs-Aktivität länger als die Zieltage des Status"
            selected={api.nurHaengt}
            onToggle={() => api.setNurHaengt(!api.nurHaengt)}
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
        {/* Die Spuren nebeneinander. „davon N abgeleitet" ist die eigentliche
            Aussage: so viel von dem, was diese Rolle sieht, stammt aus einer
            FREMDEN Regel — und ist damit offene Regelarbeit, keine gepflegte
            Kaskade. */}
        {!api.laden && api.rollenBilanz.length > 0 && (
          <p className="text-[12px] text-[var(--tf-text-secondary)]">
            {api.rollenBilanz.map(b => (
              `${b.todos} ${ROLLE_LABEL[b.rolle]}-To-dos${
                b.abgeleitet > 0 ? `, davon ${b.abgeleitet} abgeleitet` : ''}`
            )).join(' · ')}
          </p>
        )}

        {/* Der Stau je Rolle — die PL-Frage „wo klemmt es?". `unbewertet` steht
            DANEBEN und wird nie unter eine Rolle gezählt: es sind Vorgänge, für
            deren Status niemand Zieltage gepflegt hat. */}
        {!api.laden && (api.stau.length > 0 || api.unbewertet > 0) && (
          <p className="text-[12px] text-[var(--tf-text-secondary)]">
            {api.stau.length > 0 && (
              <>
                Hängt fest:{' '}
                {api.stau.map(s => `${s.anzahl} bei ${
                  s.rolle === 'offen' ? 'niemandem zugeordnet'
                    : s.rolle === 'ast' ? 'Antragsteller' : ROLLE_LABEL[s.rolle]
                }`).join(' · ')}
              </>
            )}
            {api.unbewertet > 0 && (
              <span className="text-[var(--tf-text-tertiary)]">
                {api.stau.length > 0 ? ' · ' : ''}
                {api.unbewertet} nicht bewertbar (keine Zieltage für den Status)
              </span>
            )}
          </p>
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
        {!api.laden && api.tab === 'fristen' && <FristenSicht api={api} />}
        {!api.laden && api.tab === 'auswertung' && <AuswertungSicht api={api} />}
        {!api.laden && !cockpit && !api.ohneRegeln && api.gruppen.length === 0 && (
          <p className="text-[12.5px] text-[var(--tf-text-tertiary)]">
            Keine Anträge in dieser Sicht.
          </p>
        )}
        {api.gruppen.map(g => (
          <Gruppe key={g.todo} todo={g.todo} zeilen={g.zeilen} rolle={api.rolle} onOeffnen={oeffnen} />
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
