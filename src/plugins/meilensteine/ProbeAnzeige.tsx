/**
 * Die Zahlen der Probe am Bestand — an drei Stellen des Regelbereichs (v6.60):
 * im Kopf jeder Karte ({@link GruppenProbe}), an jeder Bedingung
 * ({@link BlattTreffer}) und in der Wirkungsleiste unter den Karten
 * ({@link Wirkungsleiste}). Gerechnet wird in
 * [probe.ts](../../core/meilensteine/probe.ts), geladen in
 * [useMeilensteinProbe.ts](./useMeilensteinProbe.ts).
 *
 * Es gelten die Regeln aus „Was die Anzeige nicht behaupten darf"
 * (meilensteine.md): keine Zahl ohne Nenner, die Grundmenge steht im Titel, ein
 * Vergleich nennt seine Fassung. **Zahlen tragen ihre Beschriftung** —
 * „872 offen · 213 abgeschl." statt zweier nackter Zahlen; die PL fragte am
 * Prototyp „warum sind immer zwei zahlen hinter den feldnamen?". **Befunde sind
 * Fakten, keine Schwellen**: trifft keinen / jeden Verbund, erreicht ohne
 * Ist-Termin. Welcher Anteil sonst plausibel ist, hängt am Meilenstein — das
 * Urteil fällt die PL.
 */
import { useState } from 'react';
import { ChevronRight, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  probeBefund, type KnotenProbe, type ProbeBefund, type ProbeTeil, type ProbeZahlen,
} from '@/core/meilensteine';
import { ladeWirkungOffen, speichereWirkungOffen } from './ansichtPersistenz';
import { formatDatum } from './labels';
import type { MeilensteinProbeApi } from './useMeilensteinProbe';

const zahl = (n: number): string => n.toLocaleString('de-DE');
const anteilProzent = (t: ProbeTeil): number => (t.von === 0 ? 0 : Math.round((1000 * t.treffer) / t.von) / 10);

/** „872 offen · 213 abgeschl." — die zwei Zahlen tragen ihre Beschriftung. */
export function zahlenText(z: ProbeZahlen): string {
  return `${zahl(z.offen.treffer)} offen · ${zahl(z.abgeschlossen.treffer)} abgeschl.`;
}

/** Kurzform für die Spalte der Feld-Suche — deren Kopf trägt die Beschriftung. */
export function zahlenKurz(z: ProbeZahlen | null): string | undefined {
  return z ? `${zahl(z.offen.treffer)} · ${zahl(z.abgeschlossen.treffer)}` : undefined;
}

function zahlenTitel(z: ProbeZahlen, was: string, grundmenge: string): string {
  return `Probe · ${grundmenge}: ${was} ${zahl(z.offen.treffer)} von ${zahl(z.offen.von)} offenen und `
    + `${zahl(z.abgeschlossen.treffer)} von ${zahl(z.abgeschlossen.von)} abgeschlossenen Verbünden. `
    + 'Abgeschlossen ist die Kontrollgruppe: dort sollte fast jede Bedingung zutreffen — trifft sie dort '
    + 'wenig, liest sie vermutlich die falsche Spalte.';
}

const BEFUND_BLATT: Record<ProbeBefund, string> = { keiner: 'trifft keinen Verbund', alle: 'trifft jeden Verbund' };
/** Derselbe Befund an der GANZEN Regel — Probe-Spalte und zugeklappter Kopf sagen dasselbe Wort. */
const BEFUND_REGEL: Record<ProbeBefund, string> = { keiner: 'erfüllt bei keinem', alle: 'erfüllt bei allen' };
const BEFUND_REGEL_TITEL = 'Die Regel unterscheidet nichts — meist steckt eine Bedingung dahinter, '
  + 'die keinen oder jeden Verbund trifft.';
const BEFUND_TITEL: Record<ProbeBefund, string> = {
  keiner: 'Diese Bedingung trifft keinen Verbund der Grundmenge — liest sie den richtigen Wert?',
  alle: 'Diese Bedingung unterscheidet nichts: sie trifft jeden Verbund der Grundmenge.',
};

/** Die gelbe Marke eines Befunds — dieselbe an Karte, Bedingung und Leiste. */
export function BefundMarke({ children, title }: { children: React.ReactNode; title?: string }): React.ReactElement {
  return (
    <span
      title={title}
      className="inline-flex self-start whitespace-nowrap rounded-full px-1.5 py-[1px] text-[10.5px] font-medium
        bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]"
    >
      {children}
    </span>
  );
}

function Balken({ prozent }: { prozent: number }): React.ReactElement {
  return (
    <div className="h-1 overflow-hidden rounded-full bg-[var(--tf-border)]">
      <div className="h-full bg-[var(--tf-primary)]" style={{ width: `${prozent}%` }} />
    </div>
  );
}

/**
 * Was eine Gruppe trifft — rechts IM Kopf ihrer Karte, als bloße Zeile.
 *
 * **Ohne Balken** (v6.64, Entwurf „leiser/lauter"): er stand unter derselben
 * Zahl, die daneben schon in Worten steht, und nahm jeder Karte zwei Zeilen
 * Höhe für eine Auskunft, die keine neue war. Den Anteil zeigt weiterhin die
 * Probe-Spalte des aufgeklappten Streifens — dort für den ganzen Meilenstein.
 */
export function GruppenProbe({ zahlen, grundmenge }: {
  zahlen: ProbeZahlen | null;
  grundmenge: string;
}): React.ReactElement | null {
  if (!zahlen) return null;
  const befund = probeBefund(zahlen);
  return (
    <span
      className="flex items-center gap-1.5 whitespace-nowrap text-[11px] tabular-nums text-[var(--tf-text-secondary)]"
      title={zahlenTitel(zahlen, 'die Gruppe trifft', grundmenge)}
    >
      trifft {zahlenText(zahlen)}
      {befund && <BefundMarke title={BEFUND_TITEL[befund]}>{BEFUND_BLATT[befund]}</BefundMarke>}
    </span>
  );
}

/**
 * Was eine einzelne Bedingung trifft — rechts in ihrer zweiten Zeile. Trifft sie
 * jeden Verbund, steht darunter, was die Regel ohne sie träfe: der Anlass war
 * „VB Kurzname ist gefüllt" in MST 4.3.
 */
export function BlattTreffer({ zahlen, ohne, grundmenge, ohneBefund = false }: {
  zahlen: ProbeZahlen | null;
  /** Die Regel ohne diese Bedingung — nur beim Befund „trifft jeden". */
  ohne?: ProbeZahlen | null;
  grundmenge: string;
  /** Der Meilenstein misst nur einen Zeitpunkt (`misstNurZeitpunkt`) — „trifft jeden" ist dort gewollt. */
  ohneBefund?: boolean;
}): React.ReactElement | null {
  if (!zahlen) return null;
  const befund = ohneBefund ? null : probeBefund(zahlen);
  return (
    <span className="flex flex-col items-end gap-0.5">
      <span
        className="whitespace-nowrap text-[11px] tabular-nums text-[var(--tf-text-secondary)]"
        title={zahlenTitel(zahlen, 'trifft', grundmenge)}
      >
        {zahlenText(zahlen)}
      </span>
      {befund && <BefundMarke title={BEFUND_TITEL[befund]}>{BEFUND_BLATT[befund]}</BefundMarke>}
      {befund === 'alle' && ohne && (
        <span className="whitespace-nowrap text-[11px] tabular-nums text-[var(--tf-text-secondary)]">
          ohne sie trifft die Regel {zahlenText(ohne)}
        </span>
      )}
    </span>
  );
}

/** Die dritte Spalte der Leiste — vom Aufrufer gefüllt (Auswahl + Satz). */
export interface IstTerminAnzeige {
  /** Die Auswahl des Ist-Termin-Feldes; fehlt beim Sammel-Meilenstein. */
  auswahl?: React.ReactNode;
  text: string;
  keinDatum: boolean;
}

const SPALTE = 'flex min-w-0 flex-col gap-1.5 px-3.5 py-2.5';
const KOPF = 'flex items-center gap-1.5 text-[11.5px] text-[var(--tf-text-secondary)]';
const GROSS = 'text-[12.5px] tabular-nums text-[var(--tf-text)]';

/**
 * Der Stand der Probe an einem Knoten — EINE Kaskade für beide Leser: die
 * Probe-Spalte (offen) und die Kurzfassung im Kopf (zugeklappt). Zwei Fassungen
 * derselben Kaskade liefen beim ersten neuen Fall auseinander.
 */
type ProbeZustand =
  | { art: 'hinweis'; text: string; fehler?: boolean }
  | { art: 'zahlen'; z: KnotenProbe }
  /** Der Knoten steht (noch) nicht im Lauf — dann steht dort nichts. */
  | { art: 'leer' };

function probeZustand(
  probe: MeilensteinProbeApi | undefined,
  knotenId: string,
  ohneBedingung: boolean,
): ProbeZustand {
  if (!probe) return { art: 'hinweis', text: 'nicht verfügbar' };
  if (probe.aktion.error) return { art: 'hinweis', text: `nicht möglich — ${probe.aktion.error}`, fehler: true };
  if (!probe.bereit || !probe.entwurf) return { art: 'hinweis', text: 'lädt die Verbünde …' };
  if (ohneBedingung) return { art: 'hinweis', text: 'ohne Bedingung — nichts zu zählen' };
  const z = probe.entwurf.get(knotenId);
  if (!z) return { art: 'leer' };
  if (z.offen.von + z.abgeschlossen.von === 0) {
    return { art: 'hinweis', text: 'gilt für keinen Verbund dieser Richtlinie' };
  }
  return { art: 'zahlen', z };
}

/**
 * Die Probe eines Meilensteins am Bestand — unter den Karten, aufgeklappt in
 * zwei Spalten: Probe (mit Balken) und gegenüber der freigegebenen Fassung.
 *
 * **Zugeklappt als Standard** (v6.63, PL): wer eine Regel schreibt, sieht zuerst
 * die Regel. Der Kopf bleibt aber sprechend — die Kurzfassung trägt beide Zahlen
 * MIT Nenner, das Vergleichswort und den Befund der Regel.
 *
 * **Leise Zeile statt Kasten** (v6.64, Entwurf „leiser/lauter"): Rahmen,
 * Hintergrund und Kolben-Symbol machten die Nebensache zum lautesten Element des
 * Regelbereichs. Der Kasten erscheint erst beim Aufklappen, wo er die Spalten
 * trennt. Die Beschriftung heißt **Probe** am Bestand, nicht „Wirkung": das Wort
 * gehört laut [CONTEXT.md](../../../CONTEXT.md) der Regel-Wirkung der To-do-Regeln
 * (auf Knopfdruck, über den ganzen Bereich) — zwei Dinge, ein Name wäre der
 * Anfang einer Verwechslung. Der Bauteil-Name bleibt `Wirkungsleiste`.
 *
 * Der **Ist-Termin** steht seit v6.64 nicht mehr hier, sondern als eigene Zeile
 * im Regelbereich ({@link IstTerminZeile}): er gehört zur Regel („wann gilt sie
 * als erreicht"), nicht zur Messung — und lag zugeklappt sonst unerreichbar.
 */
export function Wirkungsleiste({ probe, knotenId, ohneBedingung, ohneBefund = false }: {
  probe?: MeilensteinProbeApi;
  knotenId: string;
  /** Der Knoten trägt keine auswertbare Bedingung — dann gibt es nichts zu zählen. */
  ohneBedingung: boolean;
  /** Der Meilenstein misst nur einen Zeitpunkt — „erfüllt bei allen" ist dort gewollt. */
  ohneBefund?: boolean;
}): React.ReactElement {
  const [offen, setOffen] = useState(ladeWirkungOffen);
  const zustand = probeZustand(probe, knotenId, ohneBedingung);
  const schalte = (): void => {
    setOffen(vorher => {
      speichereWirkungOffen(!vorher);
      return !vorher;
    });
  };
  return (
    <div className="mt-0.5">
      <button
        type="button"
        onClick={schalte}
        aria-expanded={offen}
        title={probeErklaerung(probe)}
        className="flex w-full cursor-pointer items-center gap-1.5 rounded-[6px] px-1 py-1 text-left hover:bg-[var(--tf-hover)]"
      >
        <ChevronRight
          size={12}
          className="shrink-0 text-[var(--tf-text-tertiary)] transition-transform duration-200"
          style={{ transform: offen ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
        <span className="shrink-0 text-[11.5px] text-[var(--tf-text-secondary)]">Probe am Bestand</span>
        {!offen && (
          <Kurzfassung
            zustand={zustand}
            vergleich={vergleichStand(probe, knotenId)}
            version={probe?.fassungVersion ?? null}
            ohneBefund={ohneBefund}
          />
        )}
      </button>
      {offen && (
        <div
          className="mt-0.5 grid grid-cols-1 divide-y divide-[var(--tf-border)] rounded-[8px] bg-[var(--tf-bg-secondary)]
            md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:divide-x md:divide-y-0"
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          <ProbeSpalte probe={probe} zustand={zustand} ohneBefund={ohneBefund} />
          <VergleichSpalte stand={vergleichStand(probe, knotenId)} version={probe?.fassungVersion ?? null} />
        </div>
      )}
    </div>
  );
}

/**
 * Was der zugeklappte Kopf sagt: beide Zahlen mit ihrem Nenner, das
 * Vergleichswort samt Fassung — auch „unverändert", das ist eine Auskunft — und
 * der Befund der Regel. Die Grundmenge steht im Titel der Zeile, nicht ein
 * zweites Mal davor; die Marken des Ist-Termins stehen in seiner eigenen Zeile,
 * die ohnehin immer sichtbar ist.
 */
function Kurzfassung({ zustand, vergleich, version, ohneBefund }: {
  zustand: ProbeZustand;
  vergleich: VergleichStand;
  version: number | null;
  ohneBefund: boolean;
}): React.ReactElement {
  const z = zustand.art === 'zahlen' ? zustand.z : null;
  const befund = z && !ohneBefund ? probeBefund(z) : null;
  const text = z
    ? `erfüllt bei ${zahl(z.offen.treffer)} von ${zahl(z.offen.von)} offenen`
      + ` · ${zahl(z.abgeschlossen.treffer)} von ${zahl(z.abgeschlossen.von)} abgeschlossenen`
    : (zustand.art === 'hinweis' ? zustand.text : '');
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11.5px] text-[var(--tf-text-secondary)]">
      <span className={`truncate tabular-nums ${zustand.art === 'hinweis' && zustand.fehler === true ? 'text-[var(--tf-danger-text)]' : ''}`}>
        {text}
      </span>
      {z && version !== null && <span className="shrink-0">· {vergleichsWort(vergleich)} gegenüber Fassung {version}</span>}
      {befund && <BefundMarke title={BEFUND_REGEL_TITEL}>{BEFUND_REGEL[befund]}</BefundMarke>}
    </span>
  );
}

/**
 * Der Ist-Termin als eigene Zeile im Regelbereich — Beschriftung, Auswahl, der
 * Satz für genau diese Regel und die Marken, die ihn betreffen („kein Datum",
 * „N ohne Termin"). Er steht damit bei der Regel, deren Teil er ist, statt in
 * einem Streifen, der zugeklappt startet.
 */
export function IstTerminZeile({ ist, probe, knotenId, ohneBedingung }: {
  ist: IstTerminAnzeige;
  probe?: MeilensteinProbeApi;
  knotenId: string;
  ohneBedingung: boolean;
}): React.ReactElement {
  const zustand = probeZustand(probe, knotenId, ohneBedingung);
  const z = zustand.art === 'zahlen' ? zustand.z : null;
  const ohne = !ist.keinDatum && z && z.ohneDatum.offen + z.ohneDatum.abgeschlossen > 0 ? z.ohneDatum : null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="shrink-0 text-[10.5px] font-medium uppercase tracking-[0.06em] text-[var(--tf-text-tertiary)]">
        Ist-Termin
      </span>
      {ist.auswahl && <span className="min-w-0 max-w-[260px] flex-1">{ist.auswahl}</span>}
      {ist.keinDatum && <BefundMarke>kein Datum</BefundMarke>}
      {ohne && (
        <BefundMarke title={`${zahl(ohne.offen)} offene und ${zahl(ohne.abgeschlossen)} abgeschlossene Verbünde gelten als erreicht, `
          + 'ohne dass ein Datum vorliegt — für sie gibt es keinen Ist-Termin und keine Abweichung.'}
        >
          {zahl(ohne.offen)} ohne Termin
        </BefundMarke>
      )}
      <span className="min-w-0 flex-1 text-[11.5px] leading-[16px] text-[var(--tf-text-secondary)]">{ist.text}</span>
    </div>
  );
}

/**
 * Umfang, Stand und Ladezeit der Probe — am Titel der leisen Zeile UND an der
 * Probe-Spalte. Hier steht die Grundmenge, die die Kurzfassung nicht mehr vor
 * jede Zahl schreibt.
 */
function probeErklaerung(probe: MeilensteinProbeApi | undefined): string {
  const u = probe?.umfang ?? null;
  const ms = probe?.dauerMs ?? null;
  const dauer = ms === null
    ? ''
    : `, geladen in ${(ms / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} s`;
  return `Gezählt über ${u ? zahl(u.offen) : '?'} offene und ${u ? zahl(u.abgeschlossen) : '?'} `
    + `abgeschlossene Verbünde der ${probe?.grundmenge ?? 'aktuellen Richtlinie'}, `
    + `Stand ${formatDatum(probe?.stand ?? null)}${dauer}. `
    + 'Abgeschlossen heißt amtlich fertig: dort sollte fast jeder Meilenstein erfüllt sein — '
    + 'trifft er dort wenig, liest die Bedingung vermutlich die falsche Spalte.';
}

function ProbeSpalte({ probe, zustand, ohneBefund }: {
  probe?: MeilensteinProbeApi;
  zustand: ProbeZustand;
  ohneBefund: boolean;
}): React.ReactElement {
  const kopf = (
    <div className={KOPF}>
      <FlaskConical size={12} className="shrink-0" />
      Probe · {probe?.grundmenge ?? 'aktuelle Richtlinie'}
    </div>
  );
  if (zustand.art === 'leer') return <div className={SPALTE}>{kopf}</div>;
  if (zustand.art === 'hinweis') {
    const farbe = zustand.fehler === true ? 'text-[var(--tf-danger-text)]' : 'text-[var(--tf-text-secondary)]';
    return (
      <div className={SPALTE}>
        {kopf}
        <span className={`text-[11.5px] ${farbe}`}>{zustand.text}</span>
        {zustand.fehler === true && probe && (
          <Button variant="ghost" size="xs" disabled={probe.aktion.busy} onClick={() => probe.aktion.run()}>
            {probe.aktion.busy ? 'Lädt …' : 'Erneut versuchen'}
          </Button>
        )}
      </div>
    );
  }
  const z = zustand.z;
  const befund = ohneBefund ? null : probeBefund(z);
  return (
    <div className={SPALTE} title={probeErklaerung(probe)}>
      {kopf}
      <div>
        <div className={GROSS}>erfüllt bei <span className="font-medium">{zahl(z.offen.treffer)}</span> von {zahl(z.offen.von)} offenen</div>
        <div className="mt-1"><Balken prozent={anteilProzent(z.offen)} /></div>
      </div>
      <div>
        <div className={GROSS}><span className="font-medium">{zahl(z.abgeschlossen.treffer)}</span> von {zahl(z.abgeschlossen.von)} abgeschlossenen</div>
        <div className="mt-1"><Balken prozent={anteilProzent(z.abgeschlossen)} /></div>
      </div>
      {befund && <BefundMarke title={BEFUND_REGEL_TITEL}>{BEFUND_REGEL[befund]}</BefundMarke>}
      {z.inaktiv && <span className="text-[11.5px] text-[var(--tf-text-secondary)]">inaktiv — gezählt, als wäre er aktiv</span>}
    </div>
  );
}

const vorzeichen = (d: number): string => (d > 0 ? `+${zahl(d)}` : (d < 0 ? `−${zahl(-d)}` : '±0'));

/** Wie der Entwurf zur freigegebenen Fassung steht — EINE Kaskade für Spalte und Kopf. */
type VergleichStand =
  | { art: 'ohne' }
  | { art: 'keineFassung' }
  | { art: 'neu' }
  | { art: 'delta'; dO: number; dA: number };

function vergleichStand(probe: MeilensteinProbeApi | undefined, knotenId: string): VergleichStand {
  const z = probe?.bereit ? probe.entwurf?.get(knotenId) : undefined;
  if (!z) return { art: 'ohne' };
  if ((probe?.fassungVersion ?? null) === null) return { art: 'keineFassung' };
  const f = probe?.fassung?.get(knotenId);
  if (!f) return { art: 'neu' };
  return {
    art: 'delta',
    dO: z.offen.treffer - f.offen.treffer,
    dA: z.abgeschlossen.treffer - f.abgeschlossen.treffer,
  };
}

/** Das eine Wort, das Spalte und Kurzfassung sagen — „unverändert" ist eine Auskunft, kein Nichts. */
function vergleichsWort(stand: VergleichStand): string {
  if (stand.art === 'neu') return 'neu';
  if (stand.art === 'delta') return stand.dO === 0 && stand.dA === 0 ? 'unverändert' : 'geändert';
  return '—';
}

function VergleichSpalte({ stand, version }: { stand: VergleichStand; version: number | null }): React.ReactElement {
  const kopf = <div className={KOPF}>{version === null ? 'freigegebene Fassung' : `gegenüber Fassung ${version}`}</div>;
  if (stand.art === 'ohne') return <div className={SPALTE}>{kopf}<span className={GROSS}>—</span></div>;
  if (stand.art === 'keineFassung') {
    return <div className={SPALTE}>{kopf}<span className="text-[11.5px] text-[var(--tf-text-secondary)]">noch keine freigegeben</span></div>;
  }
  if (stand.art === 'neu') {
    return (
      <div className={SPALTE}>
        {kopf}
        <span className={GROSS}>neu</span>
        <span className="text-[11.5px] text-[var(--tf-text-secondary)]">in Fassung {version} nicht vorhanden</span>
      </div>
    );
  }
  return (
    <div className={SPALTE}>
      {kopf}
      <span className={GROSS}>{vergleichsWort(stand)}</span>
      <span className="text-[11.5px] tabular-nums text-[var(--tf-text-secondary)]">
        offen {vorzeichen(stand.dO)} · abgeschlossen {vorzeichen(stand.dA)}
      </span>
    </div>
  );
}
