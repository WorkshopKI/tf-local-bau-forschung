/**
 * Die **To-do-Kaskade** pflegen — der geteilte Ersatz für die WENN-Formeln der
 * AB-Mappe.
 *
 * Jede Regel steht als deutscher Satz da: „WENN … DANN «…», zuständig AB". Wer
 * eine Regel lesen kann, kann sie prüfen — und darum geht es, denn die Kaskade
 * ersetzt eine Rechnung, die bisher nur eine Person überblickte.
 *
 * **Reihenfolge über Pfeile, nicht über Ziehen.** Die Position IST das Ergebnis
 * (erste zutreffende Regel gewinnt), deshalb muss sie präzise und
 * nachvollziehbar änderbar sein — ein Pfeilklick verschiebt um genau eine
 * Position, mit der Tastatur bedienbar und ohne Drop-Ziel-Raten. Der
 * Ordner-Editor zieht, weil dort eine Baum-Struktur das Ziel bestimmt; hier gibt
 * es nur ein Davor und ein Danach.
 *
 * Der Bedingungs-Editor ist der **domänenfreie** aus den Meilensteinen — kein
 * zweiter, der beim nächsten Operator auseinanderliefe. Sein Feld-Vorrat und
 * seine Prüfung kommen hier aus der **Fassung** (`baueTodoFeldVorrat` /
 * `referenzierbareFelder`), nicht aus den CSV-Schemas: die Kaskade wird gegen den
 * Katalog ausgewertet, und wer ein Feld anbietet, das dort fehlt, lädt zu einer
 * Regel ein, die nie zutrifft (v2.386).
 */
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import { BedingungEditor } from '@/plugins/meilensteine/BedingungEditor';
import type { SpaltenEintrag } from '@/core/services/csv/spalten-inventar';
import {
  ROLLEN, ROLLE_LABEL, ROLLE_LANG, bedingungSatz, bedingungFeldRefs, referenzierbareFelder,
  ALLE_STRAENGE, regelsatzVon, sperreGiltFuer, REGELSATZ_DEFAULT,
  type Bedingung, type MappingVersion, type PlatzhalterGruppe, type Rolle, type TodoRegel,
} from '@/core/status';
import { feldKlasse, feldStil } from './labels';
import { baueTodoFeldVorrat } from './todoFeldVorrat';
import type { PlatzhalterLauf } from './usePlatzhalterErhebung';

/** Wer wartet — Rollen plus „Antragsteller", der außerhalb des Hauses steht. */
const WARTET_WAHL: { wert: string; label: string }[] = [
  { wert: '', label: '—' },
  { wert: 'ab', label: ROLLE_LANG.ab },
  { wert: 'fb', label: ROLLE_LANG.fb },
  { wert: 'qs', label: ROLLE_LANG.qs },
  { wert: 'pa', label: ROLLE_LANG.pa },
  { wert: 'jur', label: ROLLE_LANG.jur },
  { wert: 'ast', label: 'Antragsteller' },
];

const ROLLEN_WAHL: readonly Rolle[] = ['ab', 'fb', 'qs', 'pa', 'jur'];

/** Was eine Sperre stilllegt — und was sie bewusst durchlässt. */
function sperrSatz(r: TodoRegel): string {
  const ids = r.sperrt ?? [];
  const ausnahmen = (r.sperrtNicht ?? []).join(', ');
  const rest = ausnahmen ? ` — außer ${ausnahmen}` : '';
  return ids.includes(ALLE_STRAENGE)
    ? `kein To-do mehr${rest}`
    : `${ids.length} Regeln überspringen (${ids.join(', ')})${rest}`;
}

function RegelSatz({ r, version }: { r: TodoRegel; version: MappingVersion }): React.ReactElement {
  const istSperre = (r.sperrt?.length ?? 0) > 0;
  return (
    <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
      <span className="text-[var(--tf-text-tertiary)]">WENN</span>{' '}
      {bedingungSatz(r.bedingung, version)}{' '}
      <span className="text-[var(--tf-text-tertiary)]">DANN</span>{' '}
      {istSperre ? (
        <span className="text-[var(--tf-text)]">{sperrSatz(r)}</span>
      ) : (
        <>
          <span className="text-[var(--tf-text)]">„{r.todo}"</span>
          {r.zustaendig.length > 0 && (
            <>, zuständig {r.zustaendig.map(x => ROLLE_LABEL[x]).join('/')}</>
          )}
          {r.wartetAuf && (
            <>, wartet auf {r.wartetAuf === 'ast' ? 'Antragsteller' : ROLLE_LABEL[r.wartetAuf]}</>
          )}
        </>
      )}
    </p>
  );
}

/**
 * Die Warnung, die an jedem Nicht-AB-Regelsatz steht.
 *
 * `status-katalog.json` ist für alle Build-Varianten gleichzeitig live. Eine
 * aktive FB-Regel würde von jeder Installation unter v2.391 in der AB-Kaskade
 * mitgewertet, weil deren Engine das Feld `regelsatz` nicht kennt — und dort
 * eine Aufgabe erzeugen, die es nicht gibt.
 */
const ROLLOUT_HINWEIS = 'Regelsätze außer AB werden von Installationen unter v2.391 in der '
  + 'AB-Kaskade mitgewertet. Erst aktivieren, wenn alle Varianten aktualisiert sind.';

function RegelKarte({ r, version, index, anzahl, satz, api, vorrat, pruefeFeld }: {
  r: TodoRegel;
  version: MappingVersion;
  index: number;
  anzahl: number;
  /** Der gerade gezeigte Regelsatz — nicht zwingend der der Regel (Sperren). */
  satz: Rolle;
  api: TodoRegelnApi;
  vorrat: SpaltenEintrag[];
  pruefeFeld: (feldId: string) => string | null;
}): React.ReactElement {
  const [offen, setOffen] = useState(false);
  const istSperre = (r.sperrt?.length ?? 0) > 0;
  // Eine vorgangsweite Sperre erscheint in JEDEM Satz — verschieben lässt sie
  // sich aber nur dort, wo sie zu Hause ist: sonst bewegte ein Klick im FB-Tab
  // eine Regel, die im AB-Tab an anderer Stelle steht.
  const eigen = regelsatzVon(r) === satz;
  const set = (patch: Partial<TodoRegel>): void => api.setTodoRegel(r.id, patch);
  const setzeAktiv = (an: boolean): void => {
    if (an && regelsatzVon(r) !== REGELSATZ_DEFAULT
      && !window.confirm(`${ROLLOUT_HINWEIS}\n\nRegel „${r.beschreibung}" trotzdem aktivieren?`)) return;
    set({ aktiv: an });
  };
  // Am Kopf sichtbar, auch wenn die Bearbeitung zu ist: sonst findet man die
  // stumme Regel erst, wenn jemand sie aufklappt.
  const unbekannte = bedingungFeldRefs(r.bedingung).filter(f => pruefeFeld(f) !== null);

  return (
    <div className="rounded px-3 py-2 flex flex-col gap-1.5" style={{ ...feldStil, opacity: r.aktiv ? 1 : 0.6 }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-mono text-[var(--tf-text-tertiary)] w-[26px]">{index + 1}</span>
        <div className="flex items-center gap-0.5">
          <button
            type="button" disabled={index === 0 || !eigen}
            title={eigen ? 'eine Position nach oben' : 'Diese Sperre gilt für alle Regelsätze — verschieben im Satz AB'}
            onClick={() => api.verschiebeTodoRegel(r.id, -1)}
            className="p-0.5 rounded text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer disabled:opacity-30 disabled:cursor-default"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button" disabled={index === anzahl - 1 || !eigen}
            title={eigen ? 'eine Position nach unten' : 'Diese Sperre gilt für alle Regelsätze — verschieben im Satz AB'}
            onClick={() => api.verschiebeTodoRegel(r.id, 1)}
            className="p-0.5 rounded text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer disabled:opacity-30 disabled:cursor-default"
          >
            <ChevronDown size={14} />
          </button>
        </div>
        <span className="text-[12.5px] font-medium text-[var(--tf-text)]">{r.beschreibung}</span>
        {istSperre && <Badge variant="default">Sperre</Badge>}
        {istSperre && !eigen && (
          <span title="Sie trägt kein giltFuer und wirkt deshalb in jedem Regelsatz.">
            <Badge variant="default">gilt für alle Regelsätze</Badge>
          </span>
        )}
        {!r.aktiv && <Badge variant="default">stillgelegt</Badge>}
        {unbekannte.length > 0 && (
          <Badge variant="error">trifft nie zu: {unbekannte.join(', ')}</Badge>
        )}
        <span className="ml-auto flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-[12px] text-[var(--tf-text-secondary)] cursor-pointer">
            <input
              type="checkbox" className="accent-[var(--tf-primary)] cursor-pointer" checked={r.aktiv}
              onChange={e => setzeAktiv(e.target.checked)}
            />
            aktiv
          </label>
          <span className="text-[11px] font-mono text-[var(--tf-text-tertiary)]">{r.id}</span>
        </span>
      </div>

      <RegelSatz r={r} version={version} />

      <button
        type="button" onClick={() => setOffen(v => !v)} aria-expanded={offen}
        className="self-start text-[11.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer underline"
      >
        {offen ? 'Bearbeitung schließen' : 'Bearbeiten'}
      </button>

      {offen && (
        <div className="flex flex-col gap-2 pt-1">
          <input
            value={r.beschreibung} placeholder="Beschreibung" className={feldKlasse} style={feldStil}
            onChange={e => set({ beschreibung: e.target.value })}
          />
          {!istSperre && (
            <>
              <input
                value={r.todo} placeholder="To-do-Text (Gruppe im Board)" className={feldKlasse} style={feldStil}
                onChange={e => set({ todo: e.target.value })}
              />
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">zuständig</span>
                {ROLLEN_WAHL.map(x => {
                  const an = r.zustaendig.includes(x);
                  return (
                    <button
                      key={x} type="button" aria-pressed={an} title={ROLLE_LANG[x]}
                      onClick={() => set({
                        zustaendig: an ? r.zustaendig.filter(y => y !== x) : [...r.zustaendig, x],
                      })}
                      className={`text-[11px] leading-none rounded px-1.5 py-1 cursor-pointer ${
                        an ? 'text-white' : 'text-[var(--tf-text-tertiary)]'}`}
                      style={an ? { background: 'var(--tf-primary)' } : feldStil}
                    >
                      {ROLLE_LABEL[x]}
                    </button>
                  );
                })}
                <span className="w-2" />
                <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">wartet auf</span>
                <select
                  value={r.wartetAuf ?? ''} className={feldKlasse} style={feldStil}
                  onChange={e => set({ wartetAuf: (e.target.value || null) as TodoRegel['wartetAuf'] })}
                >
                  {WARTET_WAHL.map(w => <option key={w.wert} value={w.wert}>{w.label}</option>)}
                </select>
              </div>
            </>
          )}
          <BedingungEditor
            bedingung={r.bedingung}
            spalten={vorrat}
            pruefeFeld={pruefeFeld}
            onChange={(b: Bedingung) => set({ bedingung: b })}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Die **Tagesordnung** eines Nicht-AB-Regelsatzes — nicht „nichts da".
 *
 * „Keine Regeln" wäre wahr und nutzlos. Was der FB-Termin braucht, ist die
 * Liste der Situationen, in denen die AB-Regeln schon heute auf ihn warten: je
 * Zeile die Herkunftsregel, wie oft sie im Bestand auftritt und ein
 * Beispiel-Aktenzeichen zum Nachsehen. Aus jeder Zeile lässt sich die fehlende
 * Regel direkt anlegen — vorbefüllt mit der Bedingung, die schon feststeht.
 *
 * **Steht immer da, nicht nur im Leerzustand.** Die erste angelegte Regel darf
 * die Arbeitsgrundlage nicht wegnehmen: im Termin entstehen die Regeln nach und
 * nach, und die übrigen Platzhalter (samt Export) werden bis zum Schluss
 * gebraucht.
 */
function PlatzhalterListe({ satz, anzahlRegeln, lauf, onRegelErzeugen, onExportieren }: {
  satz: Rolle;
  /** Wie viele eigene Regeln der Satz schon führt — bestimmt nur den Text. */
  anzahlRegeln: number;
  lauf: PlatzhalterLauf;
  onRegelErzeugen: (g: PlatzhalterGruppe) => void;
  onExportieren: (rolle: Rolle) => void;
}): React.ReactElement {
  const gruppen = (lauf.erhebung?.platzhalter.gruppen ?? []).filter(g => g.rolle === satz);
  return (
    <div className="flex flex-col gap-2 rounded px-2.5 py-2" style={feldStil}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[12.5px] text-[var(--tf-text)]">
          {anzahlRegeln === 0 && <>Für <strong>{ROLLE_LABEL[satz]}</strong> ist noch keine Regel gepflegt.</>}
          {anzahlRegeln === 1 && <>Für <strong>{ROLLE_LABEL[satz]}</strong> ist eine Regel gepflegt.</>}
          {anzahlRegeln > 1 && <>Für <strong>{ROLLE_LABEL[satz]}</strong> sind {anzahlRegeln} Regeln gepflegt.</>}
          {' '}
          Wo keine davon greift, leiht sich das Board die Aussage der Regel, die auf{' '}
          {ROLLE_LABEL[satz]} wartet — dort als „geliehen" markiert.
        </span>
        <Button
          variant="secondary" size="sm" disabled={lauf.aktion.busy}
          onClick={() => lauf.aktion.run()}
        >
          {lauf.aktion.busy ? 'Zählt …' : 'Platzhalter im Bestand zählen'}
        </Button>
      </div>
      {lauf.aktion.error !== null && (
        <p className="text-[12px] text-[var(--tf-danger-text)]">⚠ {lauf.aktion.error}</p>
      )}
      {lauf.erhebung !== null && (
        <>
          {/* Der Jahrgang gehört dazu: das Board zeigt vorbelegt die letzten
              drei, diese Erhebung alle. Ohne den Satz rechnet jemand die 43
              hier gegen die 38 dort und sucht einen Fehler, der keiner ist. */}
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            {lauf.erhebung.platzhalter.gesamt.toLocaleString('de-DE')} Vorgänge ausgewertet
            {lauf.bereichText !== null && <> · Betrachtungsbereich: {lauf.bereichText}</>}
            {' '}· <strong>alle Jahrgänge</strong> (das Board zeigt vorbelegt die letzten drei und
            kommt deshalb auf kleinere Zahlen)
          </p>
          {/* Gemessen: aus 38 Platzhaltern wurden 153 Treffer, als die Regel
              wirklich stand. Der Platzhalter zählt nur, wo die AB-Regel ihre
              Kaskade GEWINNT; die neue Regel steht in ihrem eigenen Satz allein
              und greift überall, wo ihre Bedingung gilt. Wer das nicht weiß,
              plant den Termin mit der falschen Größenordnung. */}
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            Die Anzahl ist eine <strong>Untergrenze</strong>: sie zählt die Vorgänge, bei denen die
            AB-Regel die Kaskade gewinnt. Eine eigene Regel steht in ihrem Satz allein und trifft
            deshalb in der Regel deutlich mehr Vorgänge.
          </p>
          {/* Die blinden Flecken stehen im Export ausführlich; hier die eine
              Zahl, die zählt. Sie nur in die Datei zu schreiben hieße, die
              ergiebigste Auswertung vor dem zu verstecken, der sie auslöst. */}
          <p className="text-[12px] text-[var(--tf-text)]">
            <strong>{lauf.erhebung.flecken.ohneTodo.toLocaleString('de-DE')}</strong> Vorgänge tragen
            in <em>keinem</em> Regelsatz ein To-do.
            {lauf.erhebung.flecken.paare.length > 0 ? (
              <> Bei {lauf.erhebung.flecken.paare.reduce((n, p) => n + p.anzahl, 0).toLocaleString('de-DE')}
                {' '}davon steht ein Kürzel-Paar einseitig offen —{' '}
                {lauf.erhebung.flecken.paare.slice(0, 3).map(p => (
                  `${p.gesetzt} ohne ${p.fehlt} (${p.anzahl}×, Median ${p.medianTage} T)`
                )).join(' · ')}
                {lauf.erhebung.flecken.paare.length > 3 && ` · +${lauf.erhebung.flecken.paare.length - 3} weitere`}.
                {' '}Das sind die rein fachlichen Lagen, für die die AB-Kaskade blind ist.
              </>
            ) : (
              <> Kein Kürzel-Paar steht dabei einseitig offen.</>
            )}
          </p>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[11.5px] text-[var(--tf-text-secondary)]">
              Für den Termin: drei Auswertungen als Arbeitsmappe (Platzhalter, blinde Flecken,
              Kürzel-Landkarte) plus eine Kurzfassung für die Einladung.
            </span>
            <Button variant="secondary" size="sm" onClick={() => onExportieren(satz)}>
              Erhebung exportieren
            </Button>
          </div>
          {gruppen.length === 0 ? (
            <p className="text-[12px] text-[var(--tf-text-secondary)]">
              Keine Platzhalter für {ROLLE_LABEL[satz]} — keine AB-Regel wartet im aktuellen Bestand
              auf diese Rolle.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {gruppen.map(g => (
                <li key={g.quellRegelId} className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[12px] font-mono text-[var(--tf-text-tertiary)] w-[64px] shrink-0">
                    {g.anzahl.toLocaleString('de-DE')}×
                  </span>
                  <span className="text-[12.5px] text-[var(--tf-text)]">„{g.todo}"</span>
                  <span className="text-[11.5px] text-[var(--tf-text-secondary)]">{g.beschreibung}</span>
                  <span className="text-[11px] font-mono text-[var(--tf-text-tertiary)]">
                    {g.beispiele.join(', ')}
                  </span>
                  <Button
                    variant="secondary" size="sm" className="ml-auto"
                    onClick={() => onRegelErzeugen(g)}
                  >
                    Regel erzeugen
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

/** Der Ausschnitt der Cockpit-API, den dieser Bereich braucht. */
export interface TodoRegelnApi {
  setTodoRegel: (id: string, patch: Partial<TodoRegel>) => void;
  verschiebeTodoRegel: (id: string, richtung: -1 | 1) => void;
  todoRegelnNachziehen: () => void;
  /** Was die Auslieferung gegenüber der gepflegten Kaskade anders sagt. */
  todoDrift: { neu: string[]; geaendert: string[]; entfallen: string[] };
  /** Eine Regel aus einem Platzhalter erzeugen — stillgelegt, vorbefüllt. */
  todoRegelAusPlatzhalter: (g: PlatzhalterGruppe) => void;
}

export function TodoRegelnBereich({ version, api, platzhalter, onExportieren }: {
  version: MappingVersion;
  api: TodoRegelnApi;
  platzhalter: PlatzhalterLauf;
  /** Erhebung als XLSX + Markdown herunterladen — schreibrechtsunabhängig. */
  onExportieren: (rolle: Rolle) => void;
}): React.ReactElement {
  const alleRegeln = version.todoRegeln ?? [];
  const [satz, setSatz] = useState<Rolle>(REGELSATZ_DEFAULT);
  // Sichtbar sind AB und FB immer — sie sind die beiden Achsen, um die es geht.
  // Weitere Rollen erscheinen erst, wenn für sie etwas existiert; eine leere
  // Juristen-Kaskade wäre ein Tab, der nie etwas zu sagen hat.
  const saetze = useMemo(() => {
    const belegt = new Set<Rolle>(alleRegeln.filter(r => (r.sperrt?.length ?? 0) === 0).map(regelsatzVon));
    return ROLLEN.filter(r => r === 'ab' || r === 'fb' || belegt.has(r));
  }, [alleRegeln]);
  // Sperren erscheinen in jedem Satz, in dem sie greifen — eine unsichtbare
  // Sperre wäre genau die stille Leere, die das Board vermeidet.
  const regeln = useMemo(() => alleRegeln
    .filter(r => ((r.sperrt?.length ?? 0) > 0 ? sperreGiltFuer(r, satz) : regelsatzVon(r) === satz))
    .sort((a, b) => a.reihenfolge - b.reihenfolge), [alleRegeln, satz]);
  const eigeneRegeln = regeln.filter(r => (r.sperrt?.length ?? 0) === 0);
  const vorrat = useMemo(() => baueTodoFeldVorrat(version.felder), [version.felder]);
  const pruefeFeld = useMemo(() => {
    const erlaubt = referenzierbareFelder(version.felder);
    return (feldId: string): string | null => erlaubt.has(feldId)
      ? null
      : `„${feldId}" steht nicht im Katalog — diese Bedingung träfe nie zu.`;
  }, [version.felder]);

  const { neu, geaendert, entfallen } = api.todoDrift;
  const driftGesamt = neu.length + geaendert.length + entfallen.length;
  const driftSatz = [
    neu.length > 0 ? `${neu.length} neue Regeln (${neu.join(', ')})` : null,
    geaendert.length > 0 ? `${geaendert.length} geändert (${geaendert.join(', ')})` : null,
    entfallen.length > 0 ? `${entfallen.length} entfallen (${entfallen.join(', ')})` : null,
  ].filter(Boolean).join(' · ');

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-[13px] font-medium text-[var(--tf-text)]">To-do-Regeln</h3>
        <span className="text-[11px] text-[var(--tf-text-tertiary)]">{alleRegeln.length}</span>
      </div>
      <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
        Geordnete Kaskade: die <strong>erste zutreffende</strong> Regel bestimmt das To-do — die
        Reihenfolge ist also Teil des Ergebnisses, keine Sortierung der Anzeige. Sperren stehen vorn
        und erzeugen kein To-do, sondern legen ganze Stränge stumm. Trifft nichts, steht der Antrag
        im Board unter „Kein To-do ermittelt".
      </p>

      {/* Je Rolle ein Regelsatz — ausgewertet wird immer genau einer. */}
      <ScopeTabs
        variant="pills"
        aria-label="Regelsatz"
        activeKey={satz}
        onChange={(k: string) => setSatz(k as Rolle)}
        items={saetze.map(r => ({
          key: r,
          label: ROLLE_LABEL[r],
          title: ROLLE_LANG[r],
          count: alleRegeln.filter(x => (x.sperrt?.length ?? 0) === 0 && regelsatzVon(x) === r).length,
        }))}
      />

      {/* Steht dauerhaft da, nicht nur beim Aktivieren: wer den Tab öffnet, soll
          wissen, warum hier alles stillgelegt ist. */}
      {satz !== REGELSATZ_DEFAULT && (
        <p className="text-[11.5px] text-[var(--tf-warning-text)]">{ROLLOUT_HINWEIS}</p>
      )}

      {/* Der Regelsatz wächst — ohne diese Zeile bliebe eine gepflegte Fassung
          stumm auf dem Stand ihres ersten Seeds stehen. Die Bilanz steht dran,
          weil das Nachziehen die GELIEFERTEN Regeln ersetzt. */}
      {driftGesamt > 0 && (
        <div className="flex items-center justify-between gap-2 rounded px-2.5 py-2" style={feldStil}>
          <span className="text-[12.5px] text-[var(--tf-text)]">
            Die Auslieferung sagt {driftSatz}. Nachziehen legt neue Regeln an, <strong>ersetzt</strong>{' '}
            die gelieferten und legt entfallene still — eigene Regeln bleiben unangetastet.
          </span>
          <Button variant="secondary" size="sm" onClick={api.todoRegelnNachziehen}>Nachziehen</Button>
        </div>
      )}

      {/* Zwei verschiedene Leerzustände, zwei verschiedene Antworten: dem
          AB-Satz fehlt die AUSLIEFERUNG (ein Klick), dem FB-Satz fehlen die
          REGELN (ein Termin). Ein gemeinsamer Text würde beides verwischen. */}
      {eigeneRegeln.length === 0 && satz === REGELSATZ_DEFAULT && (
        <div className="flex items-center justify-between gap-2 rounded px-2.5 py-2" style={feldStil}>
          <span className="text-[12.5px] text-[var(--tf-text)]">
            Diese Fassung führt keine To-do-Regeln. Die Auslieferung bringt den AB-Regelsatz mit
            (26 Regeln + 4 Sperren, transkribiert aus der Mappe „AB Anträge").
          </span>
          <Button variant="secondary" size="sm" onClick={api.todoRegelnNachziehen}>Nachziehen</Button>
        </div>
      )}
      {satz !== REGELSATZ_DEFAULT && (
        <PlatzhalterListe
          satz={satz} anzahlRegeln={eigeneRegeln.length} lauf={platzhalter}
          onRegelErzeugen={api.todoRegelAusPlatzhalter} onExportieren={onExportieren}
        />
      )}

      {regeln.map((r, i) => (
        <RegelKarte
          key={r.id} r={r} version={version} index={i} anzahl={regeln.length} satz={satz} api={api}
          vorrat={vorrat} pruefeFeld={pruefeFeld}
        />
      ))}
    </section>
  );
}
