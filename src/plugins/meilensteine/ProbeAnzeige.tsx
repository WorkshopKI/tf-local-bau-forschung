/**
 * Die Zahlen der Probe am Bestand — am Meilenstein (unter „Erfüllt, wenn") und
 * im Kopf jeder Bedingungs-Gruppe. Gerechnet wird in
 * [probe.ts](../../core/meilensteine/probe.ts), geladen in
 * [useMeilensteinProbe.ts](./useMeilensteinProbe.ts).
 *
 * Es gelten die Regeln aus „Was die Anzeige nicht behaupten darf"
 * (meilensteine.md): keine Zahl ohne Nenner, die Grundmenge steht an jeder
 * Zahl, und ein Vergleich nennt die Fassung, gegen die er rechnet. Eine
 * Warnschwelle („zu wenig erfüllt") gibt es bewusst nicht — welcher Anteil bei
 * abgeschlossenen Verbünden plausibel ist, hängt am Meilenstein und ist nicht
 * gemessen. Die Zahl steht da; das Urteil fällt die PL.
 */
import { FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ProbeTeil, ProbeZahlen } from '@/core/meilensteine';
import { formatDatum } from './labels';
import type { MeilensteinProbeApi } from './useMeilensteinProbe';

const zahl = (n: number): string => n.toLocaleString('de-DE');
const anteil = (t: ProbeTeil): string => `${zahl(t.treffer)} von ${zahl(t.von)}`;

/** „+38" / „−12"; `null`, wenn es nichts zu vergleichen gibt oder nichts sich ändert. */
function differenz(neu: number, alt: number | undefined): string | null {
  if (alt === undefined || neu === alt) return null;
  return neu > alt ? `+${zahl(neu - alt)}` : `−${zahl(alt - neu)}`;
}

const ZEILE = 'flex flex-wrap items-baseline gap-x-1.5 pt-1 text-[11.5px] text-[var(--tf-text-secondary)]';

/** Die Probe eines ganzen Meilensteins — mit Unter-Meilensteinen, wie in der Auswertung. */
export function MeilensteinProbe({ probe, knotenId, ohneBedingung }: {
  probe: MeilensteinProbeApi;
  knotenId: string;
  /** Der Knoten trägt keine auswertbare Bedingung — dann gibt es nichts zu zählen. */
  ohneBedingung: boolean;
}): React.ReactElement | null {
  const kopf = (
    <>
      <FlaskConical size={11} className="shrink-0 self-center text-[var(--tf-text-tertiary)]" />
      <span>Probe · {probe.grundmenge}:</span>
    </>
  );

  if (probe.aktion.error) {
    return (
      <p className={ZEILE}>
        {kopf}
        <span className="text-[var(--tf-danger-text)]">nicht möglich — {probe.aktion.error}</span>
        <Button
          variant="ghost" size="xs" disabled={probe.aktion.busy}
          onClick={() => probe.aktion.run()}
        >
          {probe.aktion.busy ? 'Lädt …' : 'Erneut versuchen'}
        </Button>
      </p>
    );
  }
  if (!probe.bereit || !probe.entwurf) {
    return <p className={ZEILE}>{kopf}<span>lädt die Verbünde …</span></p>;
  }
  if (ohneBedingung) {
    return <p className={ZEILE}>{kopf}<span>ohne Bedingung — nichts zu zählen</span></p>;
  }
  const z = probe.entwurf.get(knotenId);
  if (!z) return null;
  if (z.offen.von + z.abgeschlossen.von === 0) {
    return <p className={ZEILE}>{kopf}<span>gilt für keinen Verbund dieser Richtlinie</span></p>;
  }

  const f = probe.fassung?.get(knotenId);
  const dOffen = differenz(z.offen.treffer, f?.offen.treffer);
  const dAbg = differenz(z.abgeschlossen.treffer, f?.abgeschlossen.treffer);
  const v = probe.fassungVersion;
  const u = probe.umfang;
  const dauer = probe.dauerMs === null
    ? ''
    : `, geladen in ${(probe.dauerMs / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} s`;
  const erklaerung = `Gezählt über ${u ? zahl(u.offen) : '?'} offene und ${u ? zahl(u.abgeschlossen) : '?'} `
    + `abgeschlossene Verbünde der ${probe.grundmenge}, Stand ${formatDatum(probe.stand)}${dauer}. `
    + 'Abgeschlossen heißt amtlich fertig: dort sollte fast jeder Meilenstein erfüllt sein — '
    + 'trifft er dort wenig, liest die Bedingung vermutlich die falsche Spalte.';

  let vergleich: string | null = null;
  if (v !== null) {
    if (!f) vergleich = `neu gegenüber Fassung ${v}`;
    else if (!dOffen && !dAbg) vergleich = `unverändert gegenüber Fassung ${v}`;
    else vergleich = `Differenz zur freigegebenen Fassung ${v}`;
  }

  return (
    <p className={ZEILE} title={erklaerung}>
      {kopf}
      <span className="tabular-nums text-[var(--tf-text)]">erfüllt bei {anteil(z.offen)} offenen</span>
      {dOffen && <span className="tabular-nums">({dOffen})</span>}
      <span aria-hidden>·</span>
      <span className="tabular-nums text-[var(--tf-text)]">{anteil(z.abgeschlossen)} abgeschlossenen</span>
      {dAbg && <span className="tabular-nums">({dAbg})</span>}
      {vergleich && <span>· {vergleich}</span>}
      {z.inaktiv && <span>· inaktiv — gezählt, als wäre er aktiv</span>}
    </p>
  );
}

/** Was eine einzelne Gruppe trifft — im Gruppenkopf, knapp. */
export function GruppenProbe({ zahlen, grundmenge }: {
  zahlen: ProbeZahlen | null;
  grundmenge: string;
}): React.ReactElement | null {
  if (!zahlen) return null;
  const { offen, abgeschlossen } = zahlen;
  return (
    <span
      className="whitespace-nowrap text-[11px] tabular-nums text-[var(--tf-text-secondary)]"
      title={`Probe · ${grundmenge}: diese Gruppe trifft ${anteil(offen)} offene und `
        + `${anteil(abgeschlossen)} abgeschlossene Verbünde, für die der Meilenstein gilt.`}
    >
      trifft {zahl(offen.treffer)}/{zahl(offen.von)} offen · {zahl(abgeschlossen.treffer)}/{zahl(abgeschlossen.von)} abgeschl.
    </span>
  );
}
