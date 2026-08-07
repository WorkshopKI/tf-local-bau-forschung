/**
 * Das **VerlaufsBand**: Verbundspur oben, darunter je Teilvorhaben eine, alle
 * auf derselben Zeitachse.
 *
 * **React/CSS, kein SVG.** Die Segmente tragen Text, der kürzen und hovern
 * können muss; in einem `viewBox` skaliert Schrift mit der Grafik und wird
 * unlesbar (dieselbe Entscheidung wie in `StatusTimeline`).
 *
 * **Konfidenz sitzt an den KANTEN, nie am Statusfeld.** Der Status ist eine
 * beobachtete Tatsache — er steht so im Export. Unsicher ist die Zuschreibung:
 * ob ein Kürzel den Wechsel wirklich ausgelöst hat. Ein Segment einzufärben,
 * weil sein Übergang unsicher ist, verwechselte beides.
 *
 * **Keine Codes in der Bahn.** Sie stehen im Popover und im kopierten Text —
 * dort, wo jemand mit dem Fachsystem spricht. In der Bahn wäre `AK4` eine
 * Vokabel, die nur die Hälfte des Teams kennt.
 *
 * Gerechnet wird in `bandGeometrie.ts` (rein, node-testbar); diese Datei zeichnet.
 */
import { useMemo, useRef, useState } from 'react';
import { Hand } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { kopiereText } from '@/core/utils/kopieren';
import { getStatusCategory } from '@/core/utils/status-canonical';
import { KANBAN_LANE_ACCENT } from '@/plugins/home/widgets/kanbanLanes';
import { formatDatumsWert } from '@/core/services/csv/dateParse';
import type { Konfidenz, VerlaufsSpur } from '@/core/status/verlauf';
import { KONFIDENZ_TEXT, SpurListe, leise, spurTitel } from '../ausklapp/SpurListe';
import {
  baueBandGeometrie, dauerText, type BandSegment, type BandSpur,
} from './bandGeometrie';
import { baueVerlaufsText } from './bandText';

/** Höhe einer Bahn inklusive Beschriftungszeile. */
const SPUR_H = 30;
/** Breite der Spur-Beschriftung links. */
const LABEL_W = 128;
/** Ab dieser Segmentbreite passt eine Kurzform hinein. */
const LABEL_AB = 46;
/** Ab so vielen Segmenten wird die Legende nummeriert. */
const NUMMERN_AB = 6;

/**
 * Wie eine Kante gezeichnet wird. Vier Stufen, vier Aussagen — kein stiller
 * Fallback: „unsicher" und „von Hand" sind verschiedene Dinge.
 */
const KANTE: Record<Konfidenz, { stil: string; symbol: boolean }> = {
  trigger_bestaetigt: { stil: 'solid', symbol: false },
  trigger_bedingt: { stil: 'dashed', symbol: false },
  zeitliche_naehe: { stil: 'dotted', symbol: false },
  kein_kuerzel: { stil: 'solid', symbol: true },
};

function farbe(roh: string | undefined): string {
  return KANBAN_LANE_ACCENT[getStatusCategory(roh ?? '')];
}

function segmentTooltip(b: BandSegment): string {
  const s = b.segment;
  const zeitraum = `${s.vonDatum ? formatDatumsWert(s.vonDatum) : 'Anfang unbekannt'}`
    + ` – ${s.bisDatum ? formatDatumsWert(s.bisDatum) : 'offen'}`;
  const herkunft = s.statusRef?.labelHerkunft === 'ohne'
    ? ' · Kurzform nicht gepflegt'
    : (s.statusRef?.labelHerkunft === 'fassung' ? ' · Kurzform aus eurer Fassung' : '');
  return `${s.statusRef?.lang ?? 'ohne Status'}\n${zeitraum} · ${dauerText(s.dauerTage)}`
    + `${s.dauerUnsicher ? ' (unsicher)' : ''}${herkunft}`;
}

function Segment({ b, nummer }: { b: BandSegment; nummer?: number }): React.ReactElement {
  const s = b.segment;
  // Passt die Kurzform nicht, tritt die Legendennummer an ihre Stelle. Ohne sie
  // wäre die nummerierte Legende unbrauchbar: die schmalen Segmente sind genau
  // die, die man nachschlagen will, und ein leeres Kästchen verweist auf nichts.
  const zeigeLabel = b.breite >= LABEL_AB;
  const label = zeigeLabel
    ? (s.statusRef?.kurz ?? '—')
    : (nummer !== undefined && b.breite >= 16 ? String(nummer) : '');
  return (
    <Tooltip text={segmentTooltip(b)} wrapperClassName="absolute" wrapperStyle={{
      left: b.links, width: b.breite, top: 4, height: 16,
    }}>
      <span
        className="block h-full rounded-[2px] overflow-hidden text-[10px] leading-4 px-1 text-white whitespace-nowrap"
        style={{
          background: farbe(s.statusRef?.roh),
          // Angeschnittene Kante statt Ersatzbreite: wo eine Grenze fehlt, endet
          // das Segment im Nichts — eine gerade Kante behauptete ein Datum.
          ...(b.offenLinks
            ? { maskImage: 'linear-gradient(to right, transparent 0, black 10px)', WebkitMaskImage: 'linear-gradient(to right, transparent 0, black 10px)' }
            : {}),
          ...(b.offenRechts
            ? { maskImage: 'linear-gradient(to left, transparent 0, black 10px)', WebkitMaskImage: 'linear-gradient(to left, transparent 0, black 10px)' }
            : {}),
        }}
      >
        {label}
      </span>
      {/* Bruchzeichen: hier ist der Zeitmaßstab gerissen, die Länge sagt nichts. */}
      {b.gestaucht && b.breite >= 18 && (
        <span
          className="absolute top-0 text-[9px] leading-[24px] text-[var(--tf-text-tertiary)] pointer-events-none"
          style={{ left: b.breite / 2 - 5 }}
        >
          ⁄⁄
        </span>
      )}
    </Tooltip>
  );
}

/** Die Kante zwischen zwei Segmenten — Träger der Konfidenz. */
function Kante({ x, konfidenz, titel }: {
  x: number; konfidenz: Konfidenz; titel: string;
}): React.ReactElement {
  const k = KANTE[konfidenz];
  return (
    <Tooltip text={titel} wrapperClassName="absolute" wrapperStyle={{ left: x - 4, top: 0, width: 8, height: 24 }}>
      <span className="block relative w-2 h-6">
        {k.symbol
          ? <Hand size={9} className="absolute left-0 top-[7px] text-[var(--tf-text-tertiary)]" />
          : (
            <span
              className="absolute top-[2px] bottom-[2px] left-1/2"
              style={{ borderLeft: `1.5px ${k.stil} var(--tf-text-secondary)` }}
            />
          )}
      </span>
    </Tooltip>
  );
}

/**
 * Warum diese Bahn keinen Verlauf zeigt — **je Lage ein eigener Satz**.
 *
 * `null` nur bei einer echten Bahn. Alles andere bekommt Worte: „für diese
 * Richtlinie keine Regeln" (Richtlinie 2015, 552 NW-Verbünde) und „kein
 * Bearbeitungsstand" (Irrläufer) sind verschiedene Auskünfte, und keine davon
 * ist eine leere graue Zeile.
 */
function lageText(spur: VerlaufsSpur): string | null {
  if (spur.regelLage !== undefined) {
    return spur.regelLage === 'programm-unbekannt'
      ? 'Richtlinie unbekannt — keine Regelquelle'
      : 'für diese Richtlinie keine Regeln';
  }
  if (spur.zustand === 'kein_bearbeitungsstand') return 'kein Bearbeitungsstand';
  if (spur.zustand === 'kein_wert_im_csv') return 'kein Statuswert im Export';
  if (spur.zustand === 'nicht_beobachtet') return 'kein Übergang erklärt diesen Status';
  return null;
}

function Bahn({ b, breite, eigenes, offen, onToggle, nummern }: {
  b: BandSpur; breite: number; eigenes: string; offen: boolean; onToggle: () => void;
  /** Kurzform → Legendennummer; leer, solange die Legende nicht nummeriert ist. */
  nummern: ReadonlyMap<string, number>;
}): React.ReactElement {
  const spur = b.spur;
  const lage = lageText(spur);
  const gruppe = b.gleiche.length > 0 ? ` +${b.gleiche.length}` : '';
  return (
    <div className="flex items-start" style={{ height: SPUR_H }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={offen}
        className={`shrink-0 text-left text-[11.5px] truncate pr-2 cursor-pointer ${
          offen ? 'text-[var(--tf-text)] font-medium' : 'text-[var(--tf-text-secondary)]'}`}
        style={{ width: LABEL_W }}
        title={spurTitel(spur, eigenes) + (gruppe ? ` (und ${b.gleiche.length} weitere mit gleichem Verlauf)` : '')}
      >
        {spurTitel(spur, eigenes)}{gruppe}
      </button>
      <div className="relative" style={{ width: breite, height: 24 }}>
        {/* Die Lage steht DANEBEN, nicht statt der Bahn: ein Vorgang ohne
            erklärten Wechsel trägt trotzdem seinen Status, und der gehört
            gezeichnet. Nur wenn es gar kein Segment gibt, tritt der Satz an
            seine Stelle. */}
        {lage !== null && (
          <span
            className={`absolute top-[5px] ${leise} italic whitespace-nowrap pointer-events-none z-[1]`}
            style={b.segmente.length === 0 ? { left: 0 } : { left: 6 }}
          >
            {lage}
          </span>
        )}
        {b.segmente.length === 0 ? null : (
          <>
            {b.segmente.map((s, i) => (
              <Segment
                key={`${s.segment.vonDatum}-${i}`} b={s}
                {...(nummern.get(s.segment.statusRef?.kurz ?? '') !== undefined
                  ? { nummer: nummern.get(s.segment.statusRef?.kurz ?? '') }
                  : {})}
              />
            ))}
            {/* Je Übergang eine Kante an seinem Tag. Die Konfidenz gehört hierher,
                nicht auf die Fläche daneben. */}
            {spur.uebergaenge.map((u, i) => {
              const treffer = b.segmente.find(s => s.segment.vonDatum === u.datum);
              if (treffer === undefined) return null;
              return (
                <Kante
                  key={`${u.kuerzel}-${u.datum}-${i}`}
                  x={treffer.links}
                  konfidenz={u.konfidenz}
                  titel={`${u.kuerzel} · ${formatDatumsWert(u.datum)}\n${KONFIDENZ_TEXT[u.konfidenz]}`}
                />
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

export function VerlaufsBand({
  spuren, eigenes, bezugsZeitpunkt, breite = 620, fassung = null, journalAb = null,
}: {
  spuren: readonly VerlaufsSpur[];
  eigenes: string;
  bezugsZeitpunkt: string;
  /** Vorgabebreite; die Bahn darf darüber hinauswachsen und scrollt dann. */
  breite?: number;
  /** Beschriftung der geladenen Katalogfassung — gehört in den kopierten Text. */
  fassung?: string | null;
  journalAb?: string | null;
}): React.ReactElement {
  const [offen, setOffen] = useState<string | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const kopieren = useAsyncAction(async () => {
    await kopiereText(baueVerlaufsText(spuren, {
      bezug: eigenes || spuren.find(s => s.art === 'verbund')?.id || '—',
      fassung, journalAb, bezugsZeitpunkt,
    }));
  });
  const geo = useMemo(
    () => baueBandGeometrie(spuren, bezugsZeitpunkt, breite),
    [spuren, bezugsZeitpunkt, breite],
  );

  // Die Legende: volle Bezeichner in Verlaufsreihenfolge, entdoppelt. Die Bahn
  // selbst zeigt nur Kurzformen — hier steht, was sie bedeuten.
  const legende = useMemo(() => {
    const gesehen = new Set<string>();
    const out: { kurz: string; lang: string; roh: string }[] = [];
    for (const b of geo.spuren) {
      for (const s of b.segmente) {
        const r = s.segment.statusRef;
        if (!r || gesehen.has(r.kurz)) continue;
        gesehen.add(r.kurz);
        out.push({ kurz: r.kurz, lang: r.lang, roh: r.roh });
      }
    }
    return out;
  }, [geo]);

  const nummeriert = legende.length >= NUMMERN_AB;
  const nummern = useMemo(
    () => new Map(nummeriert ? legende.map((l, i) => [l.kurz, i + 1] as const) : []),
    [legende, nummeriert],
  );
  const offeneSpur = geo.spuren.find(b => `${b.spur.art}-${b.spur.id}` === offen);

  return (
    <div className="flex flex-col gap-2">
      {/* Die Bahn scrollt in ihrem EIGENEN Container — der Seiten-Body nie. */}
      <div ref={scroll} className="overflow-x-auto">
        <div style={{ width: LABEL_W + geo.breite }}>
          {/* Achsenmarken oben, damit die Stauchung ablesbar bleibt. */}
          <div className="relative" style={{ height: 12, marginLeft: LABEL_W }}>
            {geo.marken.map(m => (
              <span key={m.label} className={`absolute top-0 ${leise}`} style={{ left: m.x }}>
                {m.label}
              </span>
            ))}
          </div>
          {geo.spuren.map(b => {
            const key = `${b.spur.art}-${b.spur.id}`;
            return (
              <Bahn
                key={key} b={b} breite={geo.breite} eigenes={eigenes} nummern={nummern}
                offen={offen === key}
                onToggle={() => setOffen(offen === key ? null : key)}
              />
            );
          })}
        </div>
      </div>

      {/* Fußzeile: worauf die Bahn beruht — und der Weg, sie mitzunehmen. Der
          kopierte Text trägt die CODES mit; in der Bahn stehen sie nicht, aber
          eine Rückfrage ans Fachsystem lässt sich ohne sie nicht stellen. */}
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={leise}>
          Rekonstruiert aus den Datumsspalten · Achse bis {formatDatumsWert(bezugsZeitpunkt)}
          {fassung !== null && ` · Katalogfassung ${fassung}`}
        </span>
        <button
          type="button"
          onClick={kopieren.run}
          disabled={kopieren.busy}
          className={`${leise} underline underline-offset-2 cursor-pointer`}
        >
          {kopieren.busy ? 'kopiert …' : 'Verlauf kopieren'}
        </button>
        {kopieren.error != null && (
          <span className="text-[11px] text-[var(--tf-danger-text)]">{String(kopieren.error)}</span>
        )}
      </div>

      {legende.length > 0 && (
        <p className="text-[11px] text-[var(--tf-text-secondary)] leading-5">
          {legende.map((l, i) => (
            <span key={l.kurz} className="mr-3 whitespace-nowrap">
              {nummeriert && <span className={leise}>{i + 1} </span>}
              {l.lang}
            </span>
          ))}
        </p>
      )}

      {/* Höchstens eine Spur offen — die schlichte Liste aus Phase 2 als
          Aufklappstufe, nicht als Ersatz. */}
      {offeneSpur !== undefined && (
        <div className="rounded px-2.5 py-2" style={{ background: 'var(--tf-bg-secondary)' }}>
          <SpurListe spur={offeneSpur.spur} eigenes={eigenes} />
          {offeneSpur.gleiche.length > 0 && (
            <p className={`${leise} mt-1`}>
              Gleicher Verlauf: {offeneSpur.gleiche.map(s => s.id).join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
