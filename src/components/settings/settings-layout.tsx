/**
 * Layout-Schicht der EINSTELLUNGS-SEITENFORM (Design-Handoff
 * `_design/handoff/einstellungen-zweispaltig`).
 *
 * „Settings" meint hier das **Muster**, nicht das Einstellungen-Plugin: eine
 * Seite aus Gruppen von Optionen, deren Erklaerungen hinter ⓘ liegen. Zwei
 * Wirte benutzen es — `plugins/einstellungen` und der Kuration-Hub
 * `plugins/kuration`. Deshalb steht die Schicht seit v4.33 hier und nicht
 * mehr unter `plugins/einstellungen/_shared` (CLAUDE.md: geteilte,
 * domaenenfreie Layout-Schicht in `src/components/`).
 *
 * Vier Bauteile tragen jede solche Seite:
 *
 * - `SettingsZweiSpalten` — links Hauptbereich (weisse Karten), rechts
 *   Nebenspalte (getoente Karten, Trennlinie). Der Umbruch auf einspaltig
 *   misst die INHALTSBREITE ueber eine Container-Query
 *   (`./settings-layout.css`), nicht den Viewport.
 * - `SettingsGruppe` — die Karte um eine Gruppe zusammengehoeriger Optionen.
 * - `SettingsOption` — die Zeile: links Label (+ ⓘ + Badge) und HOECHSTENS
 *   eine Kurzzeile, rechts die Steuerung. Nie zwei Erklaerzeilen, nie
 *   Steuerung links. Alles, was laenger als eine Zeile ist, gehoert ins ⓘ.
 * - `SettingsKlappe` — Seltenes steht eingeklappt, mit Zaehler in der Zeile.
 *
 * Bewusst KEIN eigenes Control-Vokabular: Schalter, Segmente, Badges, Knoepfe
 * und Chips kommen aus `@/components/ui` (Switch, SegmentedToggle, Badge,
 * Button, ToggleChip) — der Prototyp bringt eigene `.toggle`/`.seg`/`.badge`
 * mit, die App hat fuer jedes davon laengst ein Primitive.
 */
import { createContext, useContext, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Minus, Plus } from 'lucide-react';
import { useCollapsedSection } from '@/core/hooks/useCollapsedSection';
import { InfoHint } from './InfoHint';
// Das Modul bringt sein CSS SELBST mit. Bis v4.32 importierte die Seite es
// (`EinstellungenPage`) — ein zweiter Wirt, der das nicht spiegelt, stuende
// einspaltig und ohne Trefferring da, ohne dass irgendetwas fehlschlaegt.
import './settings-layout.css';

// ───────────────────────── Sprung-Ziel ─────────────────────────

/**
 * Anker-Id, auf die die Einstellungs-Suche (oder ein `?sektion=`-Deep-Link)
 * gerade springt. Eine `SettingsKlappe`, die das Ziel traegt oder enthaelt,
 * oeffnet sich dann selbst — ohne das landet der Sprung auf einem
 * zugeklappten Kopf und der Treffer bleibt unsichtbar.
 *
 * `nr` zaehlt die Spruenge: derselbe Treffer zweimal hintereinander muss die
 * Klappe wieder aufziehen, auch wenn der Nutzer sie zwischendurch zugeklappt
 * hat — eine reine Id-Gleichheit wuerde das nicht bemerken.
 */
export interface SettingsSprungZiel {
  id: string;
  nr: number;
}

const SprungZielContext = createContext<SettingsSprungZiel | null>(null);

export function SettingsSprungProvider({
  ziel,
  children,
}: {
  ziel: SettingsSprungZiel | null;
  children: React.ReactNode;
}): React.ReactElement {
  return <SprungZielContext.Provider value={ziel}>{children}</SprungZielContext.Provider>;
}

/**
 * Ist dieser Anker gerade das Sprung-Ziel? Die vier Layout-Bauteile setzen
 * daraufhin `data-tf-treffer` und bekommen den Ring aus
 * `./settings-layout.css`.
 *
 * Die Markierung BLEIBT stehen, bis der Nutzer das naechste Mal klickt oder
 * tippt (`SettingsHubPage` setzt das Ziel dann zurueck). Bis v4.31 blitzte
 * sie 1,8 s auf — und wenn die Seite fuer den Sprung gar nicht scrollen muss,
 * bewegt sich nichts, der Blitz ist vorbei, bevor der Blick ankommt.
 *
 * Exportiert, weil nicht jeder Anker eines der vier Bauteile ist (z.B.
 * `sec-programm` auf der Zusammenfassungszeile in `AccountGruppe`).
 */
export function useSprungTreffer(id?: string): boolean {
  const ziel = useContext(SprungZielContext);
  return id != null && ziel?.id === id;
}

// ───────────────────────── Kopf-Status ─────────────────────────

/**
 * Anker fuer die Status-Anzeige rechts im Seitenkopf. Sie steht dort, weil das
 * der Handoff so zeigt — der WERT kommt aber aus der Gruppe, die wirklich
 * speichert (`FachprofilGruppe`). Eine feste Textmarke „Automatisch
 * gespeichert" waere eine Behauptung; hier steht der echte Zustand oder nichts.
 */
const KopfStatusContext = createContext<HTMLElement | null>(null);

export function SettingsKopfStatusAnker({
  el,
  children,
}: {
  el: HTMLElement | null;
  children: React.ReactNode;
}): React.ReactElement {
  return <KopfStatusContext.Provider value={el}>{children}</KopfStatusContext.Provider>;
}

/** Haengt seinen Inhalt in den Seitenkopf. Rendert nichts an Ort und Stelle. */
export function SettingsKopfStatus({ children }: { children: React.ReactNode }): React.ReactNode {
  const el = useContext(KopfStatusContext);
  return el ? createPortal(children, el) : null;
}

// ───────────────────────── Spalten ─────────────────────────

/**
 * Zweispaltiger Panel-Rumpf. `haupt` traegt die weissen Karten links,
 * `neben` die getoenten rechts; unter ~900 px Inhaltsbreite stehen sie
 * untereinander (dann ohne Trennlinie).
 */
export function SettingsZweiSpalten({
  haupt,
  neben,
}: {
  haupt: React.ReactNode;
  neben?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="tf-set-cols">
      <div className="tf-set-grid">
        <div className="min-w-0 flex flex-col gap-3">{haupt}</div>
        {neben != null && (
          <div className="tf-set-neben min-w-0 flex flex-col gap-3">
            <SpaltenTon>{neben}</SpaltenTon>
          </div>
        )}
      </div>
    </div>
  );
}

/** Signalisiert den Karten darunter, dass sie in der Nebenspalte stehen. */
const NebenspalteContext = createContext(false);

function SpaltenTon({ children }: { children: React.ReactNode }): React.ReactElement {
  return <NebenspalteContext.Provider value={true}>{children}</NebenspalteContext.Provider>;
}

// ───────────────────────── Gruppe ─────────────────────────

/**
 * Karte um eine Gruppe von Optionen. Links (Hauptbereich) weiss mit Rand,
 * rechts (Nebenspalte) getoent und randlos — die Hierarchie der beiden
 * Spalten liegt in der Flaeche, nicht in der Schriftgroesse.
 */
export function SettingsGruppe({
  id,
  titel,
  hint,
  unterzeile,
  aktion,
  rechts,
  children,
}: {
  /** Optionaler Anker fuer Suche/Deep-Link (`sec-…`). */
  id?: string;
  titel: string;
  /** Langtext hinter dem ⓘ am Gruppentitel. */
  hint?: string;
  /** Eine Zeile Zweck unter dem Titel — nie mehr als eine. */
  unterzeile?: string;
  /** Textaktion rechts im Kopf (z.B. „Jetzt aktualisieren"). */
  aktion?: React.ReactNode;
  /** Tertiaerer Zustandstext rechts im Kopf (z.B. „team-weit sichtbar"). */
  rechts?: React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement {
  const neben = useContext(NebenspalteContext);
  const treffer = useSprungTreffer(id);
  return (
    <section
      id={id}
      data-tf-treffer={treffer ? '' : undefined}
      className={`scroll-mt-20 rounded-[10px] px-[15px] pt-[13px] pb-[11px] ${
        neben ? 'bg-[var(--tf-bg-secondary)]' : 'bg-[var(--tf-bg)]'
      }`}
      style={neben ? undefined : { border: '0.5px solid var(--tf-border)' }}
    >
      <div className="flex items-center gap-2.5">
        <h3
          className={`text-[13.5px] font-medium leading-tight ${
            neben ? 'text-[var(--tf-text-secondary)]' : 'text-[var(--tf-text)]'
          }`}
        >
          {titel}
        </h3>
        {hint && <InfoHint text={hint} titel={titel} />}
        {(aktion != null || rechts != null) && (
          <span className="ml-auto flex items-center gap-3 shrink-0">
            {rechts != null && (
              <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">{rechts}</span>
            )}
            {aktion}
          </span>
        )}
      </div>
      {unterzeile && (
        <p className="text-[12px] leading-[1.5] text-[var(--tf-text-tertiary)] mt-0.5">
          {unterzeile}
        </p>
      )}
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

/**
 * Textaktion im Gruppenkopf (Handoff `.ga`) — Akzentfarbe, kein Knopf-Rahmen.
 * Fuer echte Aktionsflaechen bleibt `<Button>` zustaendig.
 */
export function SettingsGruppenAktion({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-[12px] text-[var(--tf-primary)] hover:underline disabled:opacity-45 disabled:cursor-default cursor-pointer"
    >
      {children}
    </button>
  );
}

// ───────────────────────── Option-Zeile ─────────────────────────

/**
 * Eine Einstellungs-Zeile: links Label mit optionalem ⓘ und Badge, darunter
 * HOECHSTENS eine Kurzzeile; rechts die Steuerung.
 *
 * `gesperrt` dimmt Label und Kurzzeile (z.B. „Persoenliches Gedaechtnis",
 * solange das Arbeitsprotokoll aus ist) — die Steuerung selbst wird vom
 * Aufrufer deaktiviert, damit der Grund (`kurzzeile`) am Ort steht.
 */
export function SettingsOption({
  id,
  label,
  badge,
  hint,
  kurzzeile,
  gesperrt = false,
  oben = false,
  children,
}: {
  id?: string;
  label: React.ReactNode;
  badge?: React.ReactNode;
  hint?: string;
  kurzzeile?: React.ReactNode;
  gesperrt?: boolean;
  /** Steuerung oben ausrichten statt mittig (mehrzeilige Controls). */
  oben?: boolean;
  children?: React.ReactNode;
}): React.ReactElement {
  const treffer = useSprungTreffer(id);
  return (
    <div
      id={id}
      data-tf-treffer={treffer ? '' : undefined}
      // `flex-wrap` + Mindestbreite an der Label-Spalte: eine Steuerung, die in
      // der schmalen Nebenspalte nicht mehr neben das Label passt, rutscht in
      // die zweite Zeile — statt (wie bis v4.31) die Label-Spalte auf zwei
      // gequetschte Silben zu druecken und sich darueberzuschieben.
      //
      // 110 px ist am ENGSTEN Wirt gemessen: die Nebenspalte laesst der Karte
      // 375 px, das laengste Label dort („Kontextfenster") braucht ~100 px und
      // die breiteste Steuerung (Segment + Zahlenfeld) 238 px — beides passt
      // damit weiter nebeneinander. Groesser gewaehlt, und heute heile Zeilen
      // braechen ohne Not um.
      className={`flex flex-wrap ${oben ? 'items-start' : 'items-center'} gap-3.5 py-2 scroll-mt-20 border-t first:border-t-0`}
      style={{ borderTopColor: 'var(--tf-border)', borderTopWidth: '0.5px' }}
    >
      <div className="flex-1 min-w-[110px]">
        <div className="flex items-center gap-[7px] flex-wrap">
          <span
            className={`text-[13.5px] leading-[1.35] ${
              gesperrt ? 'text-[var(--tf-text-tertiary)]' : 'text-[var(--tf-text)]'
            }`}
          >
            {label}
          </span>
          {hint && <InfoHint text={hint} titel={typeof label === 'string' ? label : undefined} />}
          {badge}
        </div>
        {kurzzeile != null && (
          <p className="text-[12px] leading-[1.5] text-[var(--tf-text-tertiary)] mt-0.5">
            {kurzzeile}
          </p>
        )}
      </div>
      {children != null && (
        <div className="flex items-center gap-2 shrink-0 ml-auto">{children}</div>
      )}
    </div>
  );
}

/**
 * Unterblock innerhalb einer Gruppe (Handoff `.fb`): Label + Zusatz in einer
 * Zeile, der Inhalt (Chips, Eingabe) darunter. Fuer Auswahlen, die nicht in
 * eine `SettingsOption`-Zeile passen.
 */
export function SettingsBlock({
  id,
  label,
  zusatz,
  hint,
  children,
}: {
  id?: string;
  label: string;
  /** Kurzer Zusatz neben dem Label (z.B. „ein Bereich", „mehrere moeglich"). */
  zusatz?: string;
  hint?: string;
  children: React.ReactNode;
}): React.ReactElement {
  const treffer = useSprungTreffer(id);
  return (
    <div
      id={id}
      data-tf-treffer={treffer ? '' : undefined}
      className="py-2 scroll-mt-20 border-t first:border-t-0"
      style={{ borderTopColor: 'var(--tf-border)', borderTopWidth: '0.5px' }}
    >
      <div className="flex items-center gap-2">
        <span className="text-[13.5px] leading-[1.35] text-[var(--tf-text)]">{label}</span>
        {zusatz && <span className="text-[12px] text-[var(--tf-text-tertiary)]">{zusatz}</span>}
        {hint && <InfoHint text={hint} titel={label} />}
      </div>
      <div className="mt-[7px]">{children}</div>
    </div>
  );
}

// ───────────────────────── Klappe ─────────────────────────

/**
 * Eingeklappter Bereich mit Zaehler in der Zeile (Handoff `.fold`).
 * Standard ist ZU — die Klappe traegt das Seltene, das den Blick sonst
 * verstellt (Widget-Liste, Tastenkuerzel, Roh-Ereignisse, dev-Panels).
 *
 * Der `<section id>`-Anker bleibt auch zugeklappt im DOM, damit Suche und
 * Deep-Links zum Kopf springen koennen; springt die Suche genau hierher
 * (oder auf eine Id aus `enthaelt`), oeffnet sich die Klappe selbst.
 */
export function SettingsKlappe({
  id,
  label,
  zaehler,
  storageKey,
  defaultOpen = false,
  enthaelt,
  children,
}: {
  id: string;
  label: string;
  /** Rechts in der Kopfzeile — „8 von 28 aktiv", „3 Dienste", „10". */
  zaehler?: React.ReactNode;
  storageKey: string;
  defaultOpen?: boolean;
  /** Weitere Anker-Ids im Rumpf, die einen Sprung hierher ausloesen. */
  enthaelt?: readonly string[];
  children: React.ReactNode;
}): React.ReactElement {
  const [offen, umschalten, setzeOffen] = useCollapsedSection(storageKey, { defaultOpen });
  const ziel = useContext(SprungZielContext);
  const trifft = ziel != null && (ziel.id === id || (enthaelt?.includes(ziel.id) ?? false));

  // Sprung-Ziel aufklappen. Ausgeloest je SPRUNG (`ziel.nr`), nicht je Zustand:
  // `offen` gehoert bewusst NICHT in die Abhaengigkeiten, sonst risse ein
  // manuelles Zuklappen die Klappe sofort wieder auf.
  //
  // Gesetzt wird IDEMPOTENT, nicht getoggelt: bei einem Sprung auf eine ANDERE
  // Seite montiert die Klappe frisch, und React ruft Mount-Effekte im
  // StrictMode zweimal auf — zwei Toggles heben sich auf, und der Treffer bliebe
  // ausgerechnet dann zu, wenn der Sprung ihn erst sichtbar machen soll.
  useEffect(() => {
    if (trifft) setzeOffen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trifft, ziel?.nr]);

  return (
    <section
      id={id}
      // Nur der DIREKTE Treffer wird markiert: bei `enthaelt` steckt das Ziel
      // im Rumpf und traegt seinen eigenen Ring.
      data-tf-treffer={ziel?.id === id ? '' : undefined}
      className="scroll-mt-20 border-t"
      style={{ borderTopColor: 'var(--tf-border)', borderTopWidth: '0.5px' }}
    >
      <button
        type="button"
        onClick={umschalten}
        aria-expanded={offen}
        className="group flex items-center gap-2 w-full text-left py-2 cursor-pointer"
      >
        <ChevronRight
          size={12}
          className="shrink-0 text-[var(--tf-text-tertiary)] group-hover:text-[var(--tf-text-secondary)]"
          style={{
            transform: offen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform var(--tf-duration-med) var(--tf-ease)',
          }}
        />
        <span className="text-[12.5px] text-[var(--tf-text-secondary)] group-hover:text-[var(--tf-text)]">
          {label}
        </span>
        {zaehler != null && (
          <span className="ml-auto text-[11.5px] text-[var(--tf-text-tertiary)] tabular-nums shrink-0">
            {zaehler}
          </span>
        )}
      </button>
      {offen && <div className="pb-2.5">{children}</div>}
    </section>
  );
}

// ───────────────────────── Kleinteile ─────────────────────────

/**
 * Zahlen-Stepper (Handoff `.stepper`). Bis v4.28 lokal in `ProfilTab`;
 * hochgezogen, weil ihn die Zweispalten-Karten an mehreren Stellen brauchen.
 */
export function SettingsStepper({
  value,
  min,
  max,
  step = 1,
  onChange,
  ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (next: number) => void;
  ariaLabel?: string;
}): React.ReactElement {
  const clamp = (v: number): number => Math.max(min, Math.min(max, v));
  return (
    <div
      className="inline-flex items-stretch h-[30px] rounded-[var(--tf-radius)] overflow-hidden"
      style={{ border: '0.5px solid var(--tf-border-hover)' }}
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        aria-label="Weniger"
        className="w-7 inline-flex items-center justify-center text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        <Minus size={12} strokeWidth={1.75} />
      </button>
      <div
        className="min-w-9 px-2 inline-flex items-center justify-center text-[12.5px] font-medium text-[var(--tf-text)] tabular-nums"
        style={{
          borderLeft: '0.5px solid var(--tf-border)',
          borderRight: '0.5px solid var(--tf-border)',
        }}
        aria-live="polite"
      >
        {value}
      </div>
      <button
        type="button"
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
        aria-label="Mehr"
        className="w-7 inline-flex items-center justify-center text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        <Plus size={12} strokeWidth={1.75} />
      </button>
    </div>
  );
}

/**
 * Status-Pille mit Punkt (Handoff „● noch 7 h 35 m", „● ZAH") — dieselbe
 * Aussage wie ein grosser Statuspunkt, nur in Zeilenhoehe.
 *
 * Seit v4.34 vierstufig statt an/aus: die Kuration-Uebersicht sagt nicht nur
 * „laeuft / laeuft nicht", sondern auch „schau mal" (warnung) und „das haelt
 * gerade nicht" (fehler). Ein zweites Badge daneben zu bauen waere eine
 * Parallel-Implementierung derselben Sache.
 */
export type SettingsBadgeTon = 'ok' | 'warnung' | 'fehler' | 'neutral';

const BADGE_TON: Record<SettingsBadgeTon, { flaeche: string; punkt: string }> = {
  ok: { flaeche: 'bg-[var(--tf-success-bg)] text-[var(--tf-success-text)]', punkt: 'var(--tf-success-text)' },
  warnung: { flaeche: 'bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]', punkt: 'var(--tf-warning-text)' },
  fehler: { flaeche: 'bg-[var(--tf-danger-bg)] text-[var(--tf-danger-text)]', punkt: 'var(--tf-danger-text)' },
  neutral: { flaeche: 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]', punkt: 'var(--tf-text-tertiary)' },
};

export function SettingsStatusBadge({
  ton,
  children,
  title,
}: {
  ton: SettingsBadgeTon;
  children: React.ReactNode;
  title?: string;
}): React.ReactElement {
  const t = BADGE_TON[ton];
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-[5px] text-[11px] px-2 py-[2px] rounded-full ${t.flaeche}`}
    >
      <span
        aria-hidden
        className="w-[6px] h-[6px] rounded-full shrink-0"
        style={{ background: t.punkt }}
      />
      {children}
    </span>
  );
}

/**
 * Zusicherungs-Zeile (Handoff `.trust`) — eine getoente Zeile mit Icon, fuer
 * die eine Aussage, die eine Gruppe traegt („Alles bleibt auf diesem Geraet").
 */
export function SettingsTrustZeile({
  icon,
  children,
  hint,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  hint?: string;
}): React.ReactElement {
  const neben = useContext(NebenspalteContext);
  return (
    <div
      className={`flex items-center gap-2.5 rounded-[var(--tf-radius)] px-3 py-2 mt-2 text-[12px] leading-[1.5] text-[var(--tf-text-secondary)] ${
        neben ? 'bg-[var(--tf-bg)]' : 'bg-[var(--tf-bg-secondary)]'
      }`}
    >
      <span className="text-[var(--tf-success-text)] shrink-0 flex">{icon}</span>
      <span className="flex-1">{children}</span>
      {hint && <InfoHint text={hint} />}
    </div>
  );
}

/** Kennzahl-Kachel (Handoff `.stat`) — Label oben, Wert darunter. */
export function SettingsKennzahl({
  label,
  wert,
}: {
  label: string;
  wert: React.ReactNode;
}): React.ReactElement {
  const neben = useContext(NebenspalteContext);
  return (
    <div
      className={`rounded-[var(--tf-radius)] px-2.5 py-2 ${
        neben ? 'bg-[var(--tf-bg)]' : 'bg-[var(--tf-bg-secondary)]'
      }`}
    >
      <span className="block text-[10.5px] uppercase tracking-[0.06em] text-[var(--tf-text-tertiary)] mb-1">
        {label}
      </span>
      <b className="text-[15px] font-medium text-[var(--tf-text)]">{wert}</b>
    </div>
  );
}

/**
 * Leerzustand innerhalb einer Gruppe/Klappe — eine Zeile, tertiaer.
 * Ersetzt die verstreuten Ein-Zeilen-Absaetze der alten Tabs.
 */
export function SettingsLeer({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <p className="text-[12.5px] leading-[1.5] text-[var(--tf-text-tertiary)] py-2">{children}</p>
  );
}

/** Tastenkuerzel-Darstellung (Handoff `.kbd`). */
export function SettingsKbd({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <kbd
      className="font-mono text-[10.5px] rounded-[5px] px-1.5 py-[3px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)] whitespace-nowrap"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      {children}
    </kbd>
  );
}
