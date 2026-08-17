/**
 * **Vorgangs-Regeln** — Vollbild-Seite: Statuswerte, Kürzel, To-do-Kaskade.
 *
 * Reine Darstellung über der `useStatusCockpit`-API: Seitenkopf + Export/Import,
 * Tab-Leiste (Statuswerte/Kürzel/To-do-Regeln) mit Zwecksatz, eine
 * Versions-Sektion und eine Speicher-Leiste, sobald der Entwurf von der aktiven
 * Fassung abweicht.
 *
 * Der Ordner heißt weiter `status-cockpit` — siehe `index.ts`, dort steht,
 * warum Anzeigename und Ordnername auseinanderfallen.
 *
 * Die Simulations-Leiste (Phasenverteilung Aktiv→Entwurf, Konflikte,
 * Phasenwechsel-Diff) ist mit v2.385 entfallen: sie schätzte die Wirkung von
 * RANG-Änderungen ab, und die gibt es nicht mehr.
 */
import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useCollapsedSection } from '@/core/hooks/useCollapsedSection';
import { Download, Upload, History } from 'lucide-react';
import { useStatusCockpit, type StatusCockpitApi } from './useStatusCockpit';
import { KatalogTab } from './KatalogTab';
import { FelderTab } from './FelderTab';
import { KlaerfragenTab } from './KlaerfragenTab';
import { RegelnTab } from './RegelnTab';
import { ReferenzdatenSektion } from './ReferenzdatenSektion';
import { KatalogKonfliktDialog } from './KatalogKonfliktDialog';
import {
  TAB_LABEL, TAB_ZWECK, feldStil, formatZeitpunkt, tabAusParameter, type TabKey,
} from './labels';
import { SeitenHilfeButton } from '@/components/help/SeitenHilfeButton';
import { isVorgangssystemEnabled } from '@/config/feature-flags';
import {
  letzterKatalogAktivWechsel, quittiereKatalogAktivWechsel,
  REGELSATZ_DEFAULT, FASSUNGEN_IN_HAUPTDATEI, type AenderungsGruppe,
} from '@/core/status';
import { useRegelAenderung } from './useRegelAenderung';

/** Seitentitel — der Anzeigename des Plugins, an einer Stelle. */
const SEITEN_TITEL = 'Vorgangs-Regeln';
/** Untertitel der Seite — sie trägt drei Reiter, nicht nur den Statuswert-Katalog. */
const SEITEN_UNTERTITEL = 'Die Grundlagen, auf denen Status, Fristen und To-dos beruhen';

function ExportImportButtons({ api }: { api: StatusCockpitApi }): React.ReactElement {
  const importieren = useAsyncAction(async () => { await api.importieren(); });
  return (
    <div className="flex items-center gap-1.5">
      <Button variant="ghost" size="sm" icon={Download} onClick={() => api.exportieren()} disabled={!api.aktiveVersion}>
        Exportieren
      </Button>
      <Button variant="ghost" size="sm" icon={Upload} disabled={importieren.busy} onClick={() => importieren.run()}>
        {importieren.busy ? 'Importiert …' : 'Importieren'}
      </Button>
      {importieren.error != null && (
        <span className="text-[11.5px] text-[var(--tf-danger-text)]">⚠ {importieren.error}</span>
      )}
    </div>
  );
}

/**
 * Der Katalog gilt team-weit — er liegt auf dem Daten-Share. Blieb eine Fassung
 * nur lokal, sieht sie niemand sonst; das muss dastehen statt eines stillen
 * Erfolgs (die Arbeit selbst ist gespeichert, nur eben nicht veröffentlicht).
 */
function NurLokalHinweis({ api }: { api: StatusCockpitApi }): React.ReactElement {
  const erneut = useAsyncAction(async () => { await api.erneutAufShare(); });
  return (
    <div className="mx-6 mt-3 rounded px-3 py-2 flex items-center gap-2 flex-wrap text-[12.5px] text-[var(--tf-warning-text)]" style={feldStil}>
      <span>
        Nur lokal gespeichert — der Daten-Share war nicht erreichbar. Diese Fassung gilt noch
        nicht für das Team.
      </span>
      <Button variant="ghost" size="sm" className="ml-auto" disabled={erneut.busy} onClick={() => erneut.run()}>
        {erneut.busy ? 'Versucht …' : 'Erneut veröffentlichen'}
      </Button>
    </div>
  );
}

/**
 * Der Share-Abgleich setzt den Aktiv-Zeiger auf die Team-Fassung — auch dann,
 * wenn hier lokal gerade eine ältere Fassung zum Vergleich reaktiviert war. Bis
 * v2.410 geschah das spurlos; die alte Fassung stand danach zwar noch in der
 * Liste, aber niemand wusste, warum die Seite plötzlich etwas anderes zeigte.
 *
 * Ein Satz, keine Rückfrage: was die App von sich aus tut, sagt sie. Der Wechsel
 * ist zu diesem Zeitpunkt längst vollzogen (Start der App), rückgängig macht ihn
 * ein Klick in der Versions-Liste.
 *
 * Beim ERSTEN Rendern gelesen und sofort quittiert — der Hinweis gilt für diese
 * Sitzung einmal, nicht bei jedem Zurückkehren auf die Seite.
 */
function AktivWechselHinweis(): React.ReactElement | null {
  const [wechsel] = useState(() => {
    const w = letzterKatalogAktivWechsel();
    quittiereKatalogAktivWechsel();
    return w;
  });
  const [weg, setWeg] = useState(false);
  if (!wechsel || weg) return null;
  return (
    <div className="mx-6 mt-3 rounded px-3 py-2 flex items-center gap-2 flex-wrap text-[12.5px] text-[var(--tf-text-secondary)]" style={feldStil}>
      <span>
        Beim Laden wurde auf die Team-Fassung v{wechsel.aktivNachher} gesetzt; Deine zuvor
        reaktivierte v{wechsel.aktivVorher} steht weiter in der Liste.
      </span>
      <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setWeg(true)}>
        Verstanden
      </Button>
    </div>
  );
}

/**
 * Zwei ruhige Zustände über der Seite, beide ohne Warnrot:
 * - Der Konflikt ist noch offen (Dialog weggeklickt) — die eigene Fassung gilt
 *   dann NICHT team-weit, und das darf nicht unsichtbar sein.
 * - Auf dem Share liegt eine neuere Fassung (Frühwarnung beim Fensterfokus).
 *   Umgeschaltet wird nur auf Klick.
 */
function ShareStandHinweis({ api }: { api: StatusCockpitApi }): React.ReactElement | null {
  const laden = useAsyncAction(async () => { await api.fremdeFassungLaden(); });

  if (api.konflikt && !api.konfliktOffen) {
    const { konflikt, eigene } = api.konflikt;
    return (
      <div className="mx-6 mt-3 rounded px-3 py-2 flex items-center gap-2 flex-wrap text-[12.5px] text-[var(--tf-text-secondary)]" style={feldStil}>
        <span>
          {eigene == null ? 'Deine Fassung' : `Fassung v${eigene}`} ist noch nicht veröffentlicht —
          auf dem Share liegt v{konflikt.fremde.version}
          {konflikt.fremde.autor ? ` von ${konflikt.fremde.autor}` : ''}.
        </span>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={api.konfliktOeffnen}>
          Klären
        </Button>
      </div>
    );
  }

  if (api.neueFassungAufShare == null) return null;
  return (
    <div className="mx-6 mt-3 rounded px-3 py-2 flex items-center gap-2 flex-wrap text-[12.5px] text-[var(--tf-text-secondary)]" style={feldStil}>
      <span>
        Auf dem Share liegt inzwischen Fassung v{api.neueFassungAufShare}. Dein Entwurf beruht
        auf einem älteren Stand.
      </span>
      <Button variant="ghost" size="sm" className="ml-auto" disabled={laden.busy} onClick={() => laden.run()}>
        {laden.busy ? 'Lädt …' : 'Laden'}
      </Button>
      {laden.error != null && (
        <span className="text-[11.5px] text-[var(--tf-danger-text)]">⚠ {laden.error}</span>
      )}
    </div>
  );
}

/**
 * Was eine Phasen-Übernahme bewirkt hat — der Satz, der die Rückfrage davor
 * ersetzt.
 *
 * Angewendet wird auf den ENTWURF; veröffentlicht erst die Speicherleiste, und
 * „Als Entwurf laden" ist der Rückweg. Ein Bestätigungsdialog vor einer
 * Änderung, die noch niemanden erreicht, wäre eine Hürde ohne Schutzwirkung —
 * ein ehrliches Ergebnis hinterher ist mehr wert.
 */
function PhasenMeldungStreifen({ api }: { api: StatusCockpitApi }): React.ReactElement | null {
  const m = api.phasenMeldung;
  if (!m) return null;
  return (
    <div
      className="mx-6 mt-3 rounded px-3 py-2 flex items-center gap-2 flex-wrap text-[12.5px]"
      style={feldStil}
    >
      <span className={m.ok ? 'text-[var(--tf-text-secondary)]' : 'text-[var(--tf-danger-text)]'}>
        {m.ok ? '' : '⚠ '}{m.text}
      </span>
      <Button variant="ghost" size="sm" className="ml-auto" onClick={api.phasenMeldungWeg}>
        Verstanden
      </Button>
    </div>
  );
}

function VersionsPanel({ api }: { api: StatusCockpitApi }): React.ReactElement {
  // Zu per Default, aber gemerkt — wer die Fassungen offen lässt, findet sie
  // beim nächsten Aufruf wieder offen.
  const [offen, toggleOffen] = useCollapsedSection(
    'status-cockpit:versionen', { defaultOpen: false },
  );
  const laden = useAsyncAction(async (version: number) => { await api.reaktivieren(version); });
  const phasen = useAsyncAction(async (version: number) => { await api.phasenAusFassung(version); });
  const aktivNr = api.aktiveVersion?.version ?? null;

  // Das Archiv wird gelesen, wenn die Liste OFFEN ist — nicht beim App-Start.
  // Es ist genau die Datei, die aus der Startzeit herausgehalten werden soll;
  // sie beim Laden mitzulesen machte die Rotation sinnlos.
  //
  // Auslöser ist der Zustand, nicht der Klick: `offen` wird gemerkt, wer die
  // Liste offen gelassen hat findet sie beim nächsten Aufruf offen vor — und
  // hätte ohne diesen Effekt nie einen Klick, der das Archiv nachlädt.
  const archiv = useAsyncAction(async () => { await api.archivLaden(); });
  const archivRun = useRef(archiv.run);
  archivRun.current = archiv.run;
  useEffect(() => {
    if (offen && !api.archivGeladen) void archivRun.current();
  }, [offen, api.archivGeladen]);

  const lokaleNummern = new Set(api.versionen.map(v => v.version));
  const nurImArchiv = api.archivFassungen.filter(v => !lokaleNummern.has(v.version));
  const versionen = [...api.versionen, ...nurImArchiv].sort((a, b) => b.version - a.version);
  // Archiviert ist, was nicht mehr in der Hauptdatei steht — abgeleitet aus der
  // Rotationsregel (die jüngsten n), kein zweiter Zustand, der driften könnte.
  const inHauptdatei = new Set(
    [...api.versionen].sort((a, b) => a.version - b.version)
      .slice(-FASSUNGEN_IN_HAUPTDATEI).map(v => v.version),
  );

  return (
    <section className="mt-6 rounded" style={feldStil}>
      <button
        type="button"
        onClick={toggleOffen}
        aria-expanded={offen}
        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
      >
        <History size={15} />
        Versionen ({versionen.length})
        {archiv.busy && <span className="text-[11px] text-[var(--tf-text-tertiary)]">Archiv lädt …</span>}
        <span className="ml-auto text-[11px] text-[var(--tf-text-tertiary)]">{offen ? 'einklappen' : 'ausklappen'}</span>
      </button>
      {offen && (
        <div className="flex flex-col divide-y divide-[var(--tf-border)] border-t border-[var(--tf-border)]">
          {versionen.map(v => {
            const istAktiv = v.version === aktivNr;
            const archiviert = !istAktiv && !inHauptdatei.has(v.version);
            return (
              <div key={v.version} className="flex items-center gap-2 px-3 py-2 flex-wrap">
                <span className="text-[12.5px] font-mono text-[var(--tf-text)]">v{v.version}</span>
                {istAktiv && <Badge variant="success">aktiv</Badge>}
                {archiviert && (
                  <span title="Steht nicht mehr in der Hauptdatei, sondern im Archiv daneben — erreichbar bleibt sie.">
                    <Badge variant="default">archiviert</Badge>
                  </span>
                )}
                <span className="text-[12px] text-[var(--tf-text-secondary)]">{v.autor ?? '—'}</span>
                <span className="text-[11px] text-[var(--tf-text-tertiary)]">{formatZeitpunkt(v.zeitstempel)}</span>
                {v.kommentar && (
                  <span className="text-[12px] text-[var(--tf-text-secondary)] italic min-w-0 truncate">„{v.kommentar}"</span>
                )}
                {/* Zwei Wege aus derselben Fassung: die ganze zurückholen —
                    oder nur ihren Verfahrensschnitt, wenn die Kürzel des
                    aktuellen Standes die richtigen sind. */}
                <Button
                  variant="ghost" size="sm" className="ml-auto"
                  disabled={phasen.busy}
                  title={'Nur Phasen, Zuordnungen und Zieltage dieser Fassung in den Entwurf '
                    + 'holen. Kürzel, Ordner und Regeln bleiben unberührt.'}
                  onClick={() => phasen.run(v.version)}
                >
                  Nur Phasen übernehmen
                </Button>
                {!istAktiv && (
                  <Button
                    variant="ghost" size="sm"
                    disabled={laden.busy} onClick={() => laden.run(v.version)}
                  >
                    Als Entwurf laden
                  </Button>
                )}
              </div>
            );
          })}
          {laden.error != null && (
            <p className="text-[11.5px] text-[var(--tf-danger-text)] px-3 py-1.5">⚠ {laden.error}</p>
          )}
          {phasen.error != null && (
            <p className="text-[11.5px] text-[var(--tf-danger-text)] px-3 py-1.5">⚠ {phasen.error}</p>
          )}
          {archiv.error != null && (
            <p className="text-[11.5px] text-[var(--tf-danger-text)] px-3 py-1.5">
              ⚠ Archiv nicht lesbar: {archiv.error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/** „Kein To-do ermittelt" ist ein Ergebnis und braucht ein Wort, kein leeres Feld. */
const todoText = (t: string | null): string => t ?? 'kein To-do';

/** Eine Zeile der Änderungs-Bilanz: alt → neu, wie oft, mit Beispielen. */
function AenderungsZeile({ g }: { g: AenderungsGruppe }): React.ReactElement {
  return (
    <li className="flex items-baseline gap-2 flex-wrap text-[11.5px]">
      <span className="font-mono tabular-nums text-[var(--tf-text)] w-[52px] shrink-0">
        {g.anzahl.toLocaleString('de-DE')}×
      </span>
      <span className="text-[var(--tf-text-secondary)]">
        „{todoText(g.vorher)}" → <strong className="text-[var(--tf-text)]">„{todoText(g.nachher)}"</strong>
      </span>
      <span className="font-mono text-[11px] text-[var(--tf-text-tertiary)]">
        {g.beispiele.join(', ')}
      </span>
    </li>
  );
}

/**
 * Die Speicherleiste — und davor die Frage, die sie aufwirft: **was ändert das
 * am Bestand?**
 *
 * Veröffentlichte Regeln sind sofort für alle scharf. Die Messung blockiert das
 * Speichern nicht (das wäre Bevormundung bei einer Kuration, die jemand
 * verantwortet), sie steht nur davor. Gemessen wird der AB-Satz: er ist der
 * einzige, der heute aktiv ausgewertet wird — die übrigen starten stillgelegt
 * (Pitfall #47).
 */
function SaveBar({ api }: { api: StatusCockpitApi }): React.ReactElement {
  const [kommentar, setKommentar] = useState('');
  const aenderung = useRegelAenderung(api.aktiveVersion, api.entwurf, REGELSATZ_DEFAULT);
  const speichern = useAsyncAction(async () => {
    await api.speichern(kommentar);
    setKommentar('');
  });
  const busy = speichern.busy || api.speichernBusy;
  const fehler = api.speichernFehler ?? speichern.error;
  const bilanz = aenderung.bilanz;
  return (
    <div className="shrink-0 border-t border-[var(--tf-border)] bg-[var(--tf-bg-secondary)] px-6 py-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[12.5px] text-[var(--tf-text-secondary)]">Entwurf weicht ab.</span>
        <input
          value={kommentar} placeholder="Kommentar (optional)"
          className="flex-1 min-w-[200px] max-w-[420px] text-[12.5px] rounded px-2.5 py-1.5 bg-[var(--tf-bg)] text-[var(--tf-text)]"
          style={feldStil}
          onChange={e => setKommentar(e.target.value)}
        />
        <Button
          variant="ghost" size="sm" disabled={aenderung.aktion.busy}
          title="Beide Fassungen über denselben Bestand auswerten — gemessen, nicht geschätzt"
          onClick={() => aenderung.aktion.run()}
        >
          {aenderung.aktion.busy ? 'Misst …' : 'Änderung am Bestand messen'}
        </Button>
        <Button variant="primary" size="sm" disabled={busy} onClick={() => speichern.run()}>
          {busy ? 'Speichert …' : 'Für das Team speichern'}
        </Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => api.verwerfen()}>
          Verwerfen
        </Button>
      </div>

      {aenderung.aktion.error != null && (
        <p className="text-[11.5px] text-[var(--tf-danger-text)]">⚠ {aenderung.aktion.error}</p>
      )}

      {/* Ohne Lauf steht hier nichts — eine Aussage über den Bestand entsteht
          nur durch Messen. */}
      {bilanz !== null && (
        <div className="flex flex-col gap-1">
          <p className="text-[12px] text-[var(--tf-text)]">
            {bilanz.geaendert === 0 ? (
              <>Keine Änderung am Bestand: bei allen{' '}
                {bilanz.gesamt.toLocaleString('de-DE')} ausgewerteten Vorgängen bleibt das To-do
                gleich.</>
            ) : (
              <>Bei <strong>{bilanz.geaendert.toLocaleString('de-DE')}</strong> von{' '}
                {bilanz.gesamt.toLocaleString('de-DE')} Vorgängen ändert sich das To-do
                {aenderung.bereichText !== null && <> · {aenderung.bereichText}</>}
                {' '}· Regelsatz AB</>
            )}
          </p>
          {bilanz.gruppen.length > 0 && (
            <ul className="flex flex-col gap-0.5">
              {bilanz.gruppen.slice(0, 8).map(g => (
                <AenderungsZeile key={`${g.vorher ?? ''}>${g.nachher ?? ''}`} g={g} />
              ))}
              {/* Was abgeschnitten wird, wird BENANNT — eine stille Kürzung
                  läse sich wie Vollständigkeit. */}
              {bilanz.gruppen.length > 8 && (
                <li className="text-[11px] text-[var(--tf-text-tertiary)]">
                  … und {bilanz.gruppen.length - 8} weitere Übergänge.
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {fehler != null && <p className="text-[11.5px] text-[var(--tf-danger-text)]">⚠ {fehler}</p>}
    </div>
  );
}

export function StatusCockpitPage(): React.ReactElement {
  const api = useStatusCockpit();
  const [tab, setTab] = useState<TabKey>('katalog');

  // Deep-Link von außerhalb: `/status-cockpit?tab=regeln` (Vorgangs-Board →
  // „Regeln bearbeiten"). Einmal je Wert behandeln — sonst zöge der Effekt jeden
  // späteren Reiter-Wechsel zurück, solange der Parameter in der URL steht.
  const [searchParams] = useSearchParams();
  const behandelterTab = useRef<string | null>(null);
  useEffect(() => {
    const roh = searchParams.get('tab');
    if (roh === null || behandelterTab.current === roh) return;
    behandelterTab.current = roh;
    const ziel = tabAusParameter(roh);
    if (ziel) setTab(ziel);
  }, [searchParams]);

  if (api.laden) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="px-6 pt-5 pb-3">
          <PageHeader title={SEITEN_TITEL} subtitle={SEITEN_UNTERTITEL} />
        </div>
        <div className="flex-1 grid place-items-center text-[13px] text-[var(--tf-text-tertiary)]">Lädt …</div>
      </div>
    );
  }

  const werteCount = api.entwurf?.werte.length ?? 0;
  const felderCount = api.entwurf?.felder.length ?? 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-6 pt-5 pb-3 flex flex-col gap-3 border-b border-[var(--tf-border)]">
        <PageHeader
          title={SEITEN_TITEL}
          subtitle={SEITEN_UNTERTITEL}
          actions={
            <div className="flex items-center gap-2">
              <ExportImportButtons api={api} />
              <SeitenHilfeButton pluginId="status-cockpit" />
            </div>
          }
        />
        <ScopeTabs
          variant="tabs"
          aria-label="Bereich"
          activeKey={tab}
          onChange={k => setTab(k as TabKey)}
          items={[
            { key: 'katalog', label: TAB_LABEL.katalog, count: werteCount },
            { key: 'felder', label: TAB_LABEL.felder, count: felderCount },
            { key: 'regeln', label: TAB_LABEL.regeln, count: api.entwurf?.todoRegeln?.length ?? 0 },
            // Ohne Zähler: die Zahl entsteht erst durch einen Bestandslauf, und
            // eine „0" an der Lasche läse sich als „nichts offen".
            { key: 'klaerfragen', label: TAB_LABEL.klaerfragen },
          ]}
        />
        {/* Der Zwecksatz steht als eigene Zeile unter der Leiste, nicht als
            Tooltip an der Lasche: er soll gelesen werden, ohne dass jemand
            danach sucht — das Modul ist neu, und kein Reitername erklärt sich
            von selbst. */}
        <p className="text-[12.5px] text-[var(--tf-text-secondary)]">{TAB_ZWECK[tab]}</p>
      </div>

      {api.fehler != null && (
        <div className="mx-6 mt-3 rounded px-3 py-2 text-[12.5px] text-[var(--tf-danger-text)] bg-[var(--tf-danger-bg)]">
          ⚠ {api.fehler}
        </div>
      )}

      {api.nurLokal && <NurLokalHinweis api={api} />}
      <AktivWechselHinweis />
      <ShareStandHinweis api={api} />
      <PhasenMeldungStreifen api={api} />

      {api.konflikt && (
        <KatalogKonfliktDialog
          stand={api.konflikt}
          offen={api.konfliktOffen}
          onSchliessen={api.konfliktSchliessen}
          onTrotzdem={api.trotzdemVeroeffentlichen}
          onFremdeLaden={api.fremdeFassungLaden}
        />
      )}


      {/* Der Regeln-Tab füllt die Höhe selbst: sein Master-Detail-Split scrollt
          seine beiden Spalten getrennt und braucht dafür einen Flex-Spalten-
          Kontext OHNE Seiten-Scroll. Referenzdaten und Versionen stehen deshalb
          in den Reitern Katalog/Kürzel — ein Split mit Sektionen darunter hätte
          keine definite Höhe mehr. */}
      {tab === 'regeln' ? (
        <div className="flex-1 min-h-0 flex flex-col px-6 pb-4 pt-3">
          <RegelnTab api={api} />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
          {tab === 'katalog' && <KatalogTab api={api} />}
          {tab === 'felder' && <FelderTab api={api} />}
          {tab === 'klaerfragen' && <KlaerfragenTab api={api} />}
          {isVorgangssystemEnabled() && <ReferenzdatenSektion api={api} />}
          <VersionsPanel api={api} />
        </div>
      )}

      {api.geaendert && <SaveBar api={api} />}
    </div>
  );
}
