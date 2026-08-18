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
import { MultiSelectDropdown } from '@/components/ui/MultiSelectDropdown';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SeitenHilfeButton } from '@/components/help/SeitenHilfeButton';
import { ROLLEN, ROLLE_LABEL, ROLLE_LANG, type Rolle } from '@/core/status';
import { antragDetailPfad } from '@/plugins/antraege/detailPfad';
import { AbgeleitetMarke, TodoHerleitung, WartetAuf } from '@/components/vorgang/TodoAnzeige';
import { bearbeiterScopeLabel } from '@/plugins/antraege/bearbeiterFilter';
import { useVorgangsBoard, sichtVon, type BoardTab, type BoardZeile } from './useVorgangsBoard';
import {
  istArbeitsvorrat, schalteZustaendigkeit, ZUSTAENDIGKEIT_DEFAULT, ZUSTAENDIGKEIT_LABEL,
  ZUSTAENDIGKEIT_TITEL, ZUSTAENDIGKEITEN,
} from './zustaendigkeit';
import { AuswertungSicht, FristenSicht } from './CockpitSichten';

/** Rahmen der Gruppen-Karten und des „keine Regeln"-Hinweises. */
const feldStil: React.CSSProperties = {
  border: '1px solid var(--tf-border)',
  background: 'var(--tf-bg-secondary)',
};

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
        {/* Eine Gruppe, die nur abgeleitet dasteht, sagt das am Kopf — sonst
            liest man sie als gepflegtes Ergebnis eines Regelsatzes, den es
            nicht gibt. */}
        {zeilen.every(z => sichtVon(z, rolle).quelle === 'abgeleitet') && (
          <span
            className="text-[11px] italic text-[var(--tf-text-tertiary)]"
            title="Alle Einträge dieser Gruppe sind aus einer fremden Regel abgeleitet — für diese Rolle gibt es dazu noch keine eigene."
          >
            abgeleitet
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
    // Über den Pfad, nicht über `?az=`: den Parameter liest niemand, er war ein
    // toter Link, der still auf einer leeren Liste landete. Welche der beiden
    // Detail-Routen ein Schlüssel trifft, entscheidet `antragDetailPfad` — die
    // Verbund-Nummer landete hier bis v4.82 im Aktenzeichen-Slot und damit in
    // „Antrag ZDS26026 nicht gefunden."
    navigate(antragDetailPfad({ verbundId: z.verbundId, aktenzeichen: z.aktenzeichen }));
  };

  // Trifft die Auswahl genau die Vorbelegung? Dann trägt sie deren Namen.
  const istLetzteDrei = api.jahre.length === api.letzteDrei.length
    && api.letzteDrei.every(j => api.jahre.includes(j));

  // Drei FRAGEN, nicht fünf Mengen. Bis v4.95 standen hier eine Partition
  // (meine/wartet/kein To-do), eine Risiko-Teilmenge (Fristen) und die
  // Gesamtmenge (Auswertung) nebeneinander — gleich aussehend, aber nicht
  // gegeneinander lesbar. Wer dran ist, steht jetzt als Filter darunter.
  const TABS: { key: BoardTab; label: string }[] = [
    { key: 'arbeit', label: 'Arbeit' },
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
          actions={
            <div className="flex items-center gap-2">
              {/* Der Verweis trifft die Frage im Moment ihres Entstehens: Wer
                  wissen will, warum eine Karte hier steht, sitzt davor — und
                  nicht in der Navigation auf der Suche nach dem Modul, das die
                  Regel dazu führt. */}
              <Button
                variant="ghost" size="sm"
                title="Die Kaskade pflegen, aus der diese Karten entstehen"
                onClick={() => navigate('/status-cockpit?tab=regeln')}
              >
                Regeln bearbeiten
              </Button>
              <SeitenHilfeButton pluginId="vorgangs-board" />
            </div>
          }
        />
        <ScopeTabs
          variant="tabs"
          aria-label="Sicht"
          activeKey={api.tab}
          onChange={(k: string) => api.setTab(k as BoardTab)}
          items={TABS.map(t => ({ ...t, count: api.zaehler[t.key] }))}
        />

        {/* Eigene Zeile, weil sie eine eigene Sorte Frage stellt: die Reiter
            sagen WAS gefragt wird, diese Chips WELCHER TEIL des Vorrats, die
            Filterzeile darunter WELCHER AUSSCHNITT des Bestands. Die vier
            Zahlen addieren sich zur Gesamtmenge — genau das konnte die alte
            Reiterleiste nicht. */}
        {api.tab === 'arbeit' && (
          <div className="flex flex-wrap items-center gap-1.5">
            {ZUSTAENDIGKEITEN.map(z => (
              <ToggleChip
                key={z}
                label={`${ZUSTAENDIGKEIT_LABEL[z]} ${api.zustZaehler[z].toLocaleString('de-DE')}`}
                title={ZUSTAENDIGKEIT_TITEL[z]}
                selected={api.zustaendig.includes(z)}
                onToggle={() => api.setZustaendig(schalteZustaendigkeit(api.zustaendig, z))}
              />
            ))}
            {/* Rückweg aus jedem abweichenden Zustand — ein Filter, der sich
                nur über vier Einzelklicks zurücknehmen lässt, ist eine
                Einbahnstraße. */}
            {!istArbeitsvorrat(api.zustaendig) && (
              <button
                type="button"
                onClick={() => api.setZustaendig([...ZUSTAENDIGKEIT_DEFAULT])}
                className="text-[11.5px] underline underline-offset-2 cursor-pointer
                  text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)]"
              >
                zurück zum Arbeitsvorrat
              </button>
            )}
          </div>
        )}

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
          <MultiSelectDropdown
            einheit="Jahre"
            alleLabel="Alle Jahre"
            optionen={api.jahrOptionen}
            ausgewaehlt={api.jahre}
            onChange={api.setJahre}
            // Die Vorbelegung hat einen Namen — „3 Jahre" wäre richtig, aber
            // nichtssagend.
            labelOverride={istLetzteDrei ? 'Letzte 3 Jahre' : null}
            aktionen={[
              {
                label: 'Letzte 3 Jahre',
                onClick: () => api.setJahre(api.letzteDrei),
                aktiv: istLetzteDrei,
              },
              {
                label: 'Alle Jahre',
                onClick: () => api.setJahre([]),
                aktiv: api.jahre.length === 0,
              },
            ]}
          />
          <MultiSelectDropdown
            einheit="Fördervarianten"
            alleLabel="Alle Fördervarianten"
            optionen={api.variantenOptionen}
            ausgewaehlt={api.varianten}
            onChange={api.setVarianten}
            aktionen={[{
              label: 'Alle Fördervarianten',
              onClick: () => api.setVarianten([]),
              aktiv: api.varianten.length === 0,
            }]}
          />
          <MultiSelectDropdown
            einheit="ZAH-Phasen"
            alleLabel="Alle ZAH-Phasen"
            optionen={api.phasenOptionen}
            ausgewaehlt={api.phasen}
            onChange={api.setPhasen}
            aktionen={[{
              label: 'Alle ZAH-Phasen',
              onClick: () => api.setPhasen([]),
              aktiv: api.phasen.length === 0,
            }]}
          />
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
              Diese Katalog-Fassung führt keine To-do-Regeln. Unter <strong>Vorgangs-Regeln</strong>
              {' '}im Reiter „To-do-Regeln" nachziehen — bis dahin kann das Board nichts ableiten.
            </span>
            <Button
              variant="secondary" size="sm" className="ml-auto"
              onClick={() => navigate('/status-cockpit?tab=regeln')}
            >
              Regeln öffnen
            </Button>
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
        {!api.laden && api.zeigtAltbestand && (
          <p className="text-[11.5px] text-[var(--tf-warning-text)]">
            Die Auswahl reicht in den Altbestand: ältere Vorgänge führen viele Spalten gar nicht
            (etwa den Zuwendungsbescheid). Regeln, die auf „leer" prüfen, melden dort Aufgaben,
            die keine sind. Für die tägliche Arbeit sind die letzten drei Jahrgänge gemeint.
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
            {' '}{api.zustZaehler.meine} eigene · {api.zustZaehler.warten} wartend ·
            {' '}{api.zustZaehler.ohne} ohne To-do · {api.zustZaehler.fertig} abgeschlossen
          </p>
        )}
      </div>
    </div>
  );
}
