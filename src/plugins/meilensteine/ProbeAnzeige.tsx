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
import { FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { probeBefund, type OhneDatum, type ProbeBefund, type ProbeTeil, type ProbeZahlen } from '@/core/meilensteine';
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

/** Was eine Gruppe trifft — im Kopf ihrer Karte, mit Balken (Anteil der offenen). */
export function GruppenProbe({ zahlen, grundmenge }: {
  zahlen: ProbeZahlen | null;
  grundmenge: string;
}): React.ReactElement | null {
  if (!zahlen) return null;
  const befund = probeBefund(zahlen);
  return (
    <div className="flex flex-col gap-1" title={zahlenTitel(zahlen, 'die Gruppe trifft', grundmenge)}>
      <Balken prozent={anteilProzent(zahlen.offen)} />
      <span className="flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums text-[var(--tf-text-secondary)]">
        trifft {zahlenText(zahlen)}
        {befund && <BefundMarke title={BEFUND_TITEL[befund]}>{BEFUND_BLATT[befund]}</BefundMarke>}
      </span>
    </div>
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
 * Die Wirkung eines Meilensteins am Bestand — unter den Karten, in drei Spalten:
 * Probe (mit Balken), gegenüber der freigegebenen Fassung, Ist-Termin. Aus
 * Entwurf D des Regelbereichs: die Regel selbst bleibt oben unter sich, was sie
 * bewirkt und wann sie als erreicht gilt, steht an EINER Stelle darunter.
 */
export function Wirkungsleiste({ probe, knotenId, ohneBedingung, ist, ohneBefund = false }: {
  probe?: MeilensteinProbeApi;
  knotenId: string;
  /** Der Knoten trägt keine auswertbare Bedingung — dann gibt es nichts zu zählen. */
  ohneBedingung: boolean;
  ist: IstTerminAnzeige;
  /** Der Meilenstein misst nur einen Zeitpunkt — „erfüllt bei allen" ist dort gewollt. */
  ohneBefund?: boolean;
}): React.ReactElement {
  const z = probe?.bereit ? probe.entwurf?.get(knotenId) ?? null : null;
  return (
    <div
      className="mt-1 grid grid-cols-1 divide-y divide-[var(--tf-border)] rounded-[8px] bg-[var(--tf-bg-secondary)]
        md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1.5fr)] md:divide-x md:divide-y-0"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <ProbeSpalte probe={probe} knotenId={knotenId} ohneBedingung={ohneBedingung} ohneBefund={ohneBefund} />
      <VergleichSpalte probe={probe} knotenId={knotenId} />
      <IstSpalte ist={ist} ohneDatum={z && !ohneBedingung ? z.ohneDatum : null} />
    </div>
  );
}

function ProbeSpalte({ probe, knotenId, ohneBedingung, ohneBefund }: {
  probe?: MeilensteinProbeApi;
  knotenId: string;
  ohneBedingung: boolean;
  ohneBefund: boolean;
}): React.ReactElement {
  const kopf = (
    <div className={KOPF}>
      <FlaskConical size={12} className="shrink-0" />
      Probe · {probe?.grundmenge ?? 'aktuelle Richtlinie'}
    </div>
  );
  if (!probe) return <div className={SPALTE}>{kopf}<span className="text-[11.5px] text-[var(--tf-text-secondary)]">nicht verfügbar</span></div>;
  if (probe.aktion.error) {
    return (
      <div className={SPALTE}>
        {kopf}
        <span className="text-[11.5px] text-[var(--tf-danger-text)]">nicht möglich — {probe.aktion.error}</span>
        <Button variant="ghost" size="xs" disabled={probe.aktion.busy} onClick={() => probe.aktion.run()}>
          {probe.aktion.busy ? 'Lädt …' : 'Erneut versuchen'}
        </Button>
      </div>
    );
  }
  if (!probe.bereit || !probe.entwurf) {
    return <div className={SPALTE}>{kopf}<span className="text-[11.5px] text-[var(--tf-text-secondary)]">lädt die Verbünde …</span></div>;
  }
  if (ohneBedingung) {
    return <div className={SPALTE}>{kopf}<span className="text-[11.5px] text-[var(--tf-text-secondary)]">ohne Bedingung — nichts zu zählen</span></div>;
  }
  const z = probe.entwurf.get(knotenId);
  if (!z) return <div className={SPALTE}>{kopf}</div>;
  if (z.offen.von + z.abgeschlossen.von === 0) {
    return <div className={SPALTE}>{kopf}<span className="text-[11.5px] text-[var(--tf-text-secondary)]">gilt für keinen Verbund dieser Richtlinie</span></div>;
  }
  const u = probe.umfang;
  const dauer = probe.dauerMs === null
    ? ''
    : `, geladen in ${(probe.dauerMs / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} s`;
  const erklaerung = `Gezählt über ${u ? zahl(u.offen) : '?'} offene und ${u ? zahl(u.abgeschlossen) : '?'} `
    + `abgeschlossene Verbünde der ${probe.grundmenge}, Stand ${formatDatum(probe.stand)}${dauer}. `
    + 'Abgeschlossen heißt amtlich fertig: dort sollte fast jeder Meilenstein erfüllt sein — '
    + 'trifft er dort wenig, liest die Bedingung vermutlich die falsche Spalte.';
  const befund = ohneBefund ? null : probeBefund(z);
  return (
    <div className={SPALTE} title={erklaerung}>
      {kopf}
      <div>
        <div className={GROSS}>erfüllt bei <span className="font-medium">{zahl(z.offen.treffer)}</span> von {zahl(z.offen.von)} offenen</div>
        <div className="mt-1"><Balken prozent={anteilProzent(z.offen)} /></div>
      </div>
      <div>
        <div className={GROSS}><span className="font-medium">{zahl(z.abgeschlossen.treffer)}</span> von {zahl(z.abgeschlossen.von)} abgeschlossenen</div>
        <div className="mt-1"><Balken prozent={anteilProzent(z.abgeschlossen)} /></div>
      </div>
      {befund && (
        <BefundMarke title="Die Regel unterscheidet nichts — meist steckt eine Bedingung dahinter, die keinen oder jeden Verbund trifft.">
          {befund === 'alle' ? 'erfüllt bei allen' : 'erfüllt bei keinem'}
        </BefundMarke>
      )}
      {z.inaktiv && <span className="text-[11.5px] text-[var(--tf-text-secondary)]">inaktiv — gezählt, als wäre er aktiv</span>}
    </div>
  );
}

const vorzeichen = (d: number): string => (d > 0 ? `+${zahl(d)}` : (d < 0 ? `−${zahl(-d)}` : '±0'));

function VergleichSpalte({ probe, knotenId }: { probe?: MeilensteinProbeApi; knotenId: string }): React.ReactElement {
  const v = probe?.fassungVersion ?? null;
  const kopf = <div className={KOPF}>{v === null ? 'freigegebene Fassung' : `gegenüber Fassung ${v}`}</div>;
  const z = probe?.bereit ? probe.entwurf?.get(knotenId) : undefined;
  if (!z) return <div className={SPALTE}>{kopf}<span className={GROSS}>—</span></div>;
  if (v === null) return <div className={SPALTE}>{kopf}<span className="text-[11.5px] text-[var(--tf-text-secondary)]">noch keine freigegeben</span></div>;
  const f = probe?.fassung?.get(knotenId);
  if (!f) {
    return <div className={SPALTE}>{kopf}<span className={GROSS}>neu</span><span className="text-[11.5px] text-[var(--tf-text-secondary)]">in Fassung {v} nicht vorhanden</span></div>;
  }
  const dO = z.offen.treffer - f.offen.treffer;
  const dA = z.abgeschlossen.treffer - f.abgeschlossen.treffer;
  return (
    <div className={SPALTE}>
      {kopf}
      <span className={GROSS}>{dO === 0 && dA === 0 ? 'unverändert' : 'geändert'}</span>
      <span className="text-[11.5px] tabular-nums text-[var(--tf-text-secondary)]">
        offen {vorzeichen(dO)} · abgeschlossen {vorzeichen(dA)}
      </span>
    </div>
  );
}

function IstSpalte({ ist, ohneDatum }: { ist: IstTerminAnzeige; ohneDatum: OhneDatum | null }): React.ReactElement {
  const ohne = !ist.keinDatum && ohneDatum && ohneDatum.offen + ohneDatum.abgeschlossen > 0 ? ohneDatum : null;
  return (
    <div className={SPALTE}>
      <div className={KOPF}>Ist-Termin</div>
      {ist.auswahl}
      {ist.keinDatum && <BefundMarke>kein Datum</BefundMarke>}
      {ohne && <BefundMarke>{zahl(ohne.offen)} ohne Termin</BefundMarke>}
      <span className="text-[11.5px] leading-[16px] text-[var(--tf-text-secondary)]">
        {ist.text}
        {ohne && ` ${zahl(ohne.offen)} offene und ${zahl(ohne.abgeschlossen)} abgeschlossene Verbünde gelten als erreicht, `
          + 'ohne dass ein Datum vorliegt — für sie gibt es keinen Ist-Termin und keine Abweichung.'}
      </span>
    </div>
  );
}
