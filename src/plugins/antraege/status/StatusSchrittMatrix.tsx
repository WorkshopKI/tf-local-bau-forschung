/**
 * Die Chronik **nach Schritt**: eine Zeile je Kürzel, eine Spalte je Träger.
 *
 * Sie ersetzt einen Arbeitsgang, nicht ein Bild. Im Fachsystem wird für die
 * Frage „haben alle Teilvorhaben das schon?" der Verbund und danach jedes TV
 * einzeln geöffnet, und der Vergleich entsteht im Kopf des Lesers. Hier ist er
 * die Ansicht: nebeneinander steht, wer geliefert hat, wer später, und wo das
 * Kürzel fehlt.
 *
 * **Feste Spaltenbreiten** (`<colgroup>` in px, nicht `auto`): die Datumsspalten
 * sind der Vergleich. Ließe man sie sich nach Inhalt bemessen, wanderten sie mit
 * jedem Filterklick, und untereinander stünde nichts mehr.
 *
 * **Das Jahr steht nur da, wenn es eines braucht.** Läuft die Matrix über einen
 * Jahreswechsel, tragen alle Zellen zwei Stellen mehr — sonst keine. Ein
 * Vorgang, der von November bis Februar läuft, hätte sonst vier Spalten, deren
 * Reihenfolge man nicht lesen kann.
 *
 * Gerechnet wird nebenan in `chronik-matrix.ts` (rein, node-getestet); diese
 * Datei zeichnet.
 */
import {
  phasenRinne, rollenSicht, rollenVonFeld, zahPhaseLabel,
  type MappingVersion, type MatrixSpalte, type MatrixZelle, type Rolle,
  type SchrittZeile,
} from '@/core/status';
import { formatDatumsWert } from '@/core/services/csv/dateParse';
import { RollenBadges } from './VerlaufBadges';

const LEISE = 'text-[var(--tf-text-tertiary)]';

/** Spaltenbreiten in px — siehe Modulkopf, bewusst fest. */
const B_PHASE = 104;
const B_CODE = 54;
const B_ROLLE = 76;
const B_TRAEGER = 86;
const B_SPANNE = 108;
/** Was der Ereignis-Spalte mindestens bleiben muss, bevor waagerecht gescrollt wird. */
const B_EREIGNIS_MIN = 220;

const ZELLE = 'px-2 py-[5px] align-middle';

/** Kürzt `10.03.2026` auf `10.03.` bzw. `10.03.26`. */
function tagKurz(tag: string, mitJahr: boolean): string {
  const voll = formatDatumsWert(tag);
  return mitJahr ? `${voll.slice(0, 6)}${voll.slice(-2)}` : voll.slice(0, 6);
}

/** Was in einer Zelle steht — Datum, Schuld oder nichts. */
function Zelle({ zelle, mitJahr }: {
  zelle: MatrixZelle | undefined; mitJahr: boolean;
}): React.ReactElement {
  if (zelle === undefined) {
    return <span className={`font-mono text-[11.5px] ${LEISE}`} aria-hidden="true">–</span>;
  }
  if (zelle.art === 'datum') {
    return (
      <span className="font-mono text-[11.5px] text-[var(--tf-text)]">
        {tagKurz(zelle.tag, mitJahr)}
      </span>
    );
  }
  return (
    <span
      className="flex flex-col items-center leading-tight"
      style={{ color: 'var(--tf-danger-text)' }}
      title={`Kürzel nicht gesetzt — offen seit ${formatDatumsWert(zelle.seit)}`}
    >
      <span className="font-mono text-[11.5px]">− {zelle.tage} T</span>
      <span className="text-[10px]">nicht gesetzt</span>
    </span>
  );
}

/**
 * Die Streuung zwischen den Teilvorhaben: Zahl plus Balken.
 *
 * Der Balken ist relativ zur größten Streuung **dieser** Tabelle — er vergleicht
 * die Zeilen miteinander, nicht gegen eine absolute Skala. Eine absolute wäre
 * hier bedeutungslos: ob 18 Tage viel sind, entscheidet der Vorgang.
 */
function Spanne({ zeile, maximum }: { zeile: SchrittZeile; maximum: number }): React.ReactElement {
  const t = zeile.streuungTage;
  if (t === null) {
    return <span className={`text-[11px] ${LEISE}`} aria-hidden="true">–</span>;
  }
  if (t === 0) {
    return <span className={`text-[11px] ${LEISE}`}>gleichzeitig</span>;
  }
  const text = t >= 60 ? `${Math.round(t / 30)} Mon` : `${t} T`;
  const anteil = maximum > 0 ? Math.max(0.06, t / maximum) : 0;
  return (
    <span
      className="flex items-center gap-1.5"
      title={`${formatDatumsWert(zeile.fruehestesTv ?? '')} – ${formatDatumsWert(zeile.spaetestesTv ?? '')}`}
    >
      <span className="w-[42px] shrink-0 text-[11px] text-[var(--tf-text-secondary)]">{text}</span>
      <span
        aria-hidden="true"
        className="h-[3px] min-w-0 flex-1 rounded-full"
        style={{ background: 'var(--tf-bg-secondary)' }}
      >
        <span
          className="block h-full rounded-full"
          style={{ width: `${anteil * 100}%`, background: 'var(--tf-text-tertiary)' }}
        />
      </span>
    </span>
  );
}

export function StatusSchrittMatrix({
  zeilen, spalten, version, fokus, onFokus, rollenWahl,
}: {
  zeilen: readonly SchrittZeile[];
  spalten: readonly MatrixSpalte[];
  version: MappingVersion;
  /** Fokussierte Feld-Id; bleibt über den Ansichtswechsel hinweg stehen. */
  fokus: string | null;
  onFokus: (feldId: string | null) => void;
  /** Rollenwahl — entscheidet, welche Zeile abgeblendet steht. */
  rollenWahl: ReadonlySet<Rolle>;
}): React.ReactElement {
  const rinne = phasenRinne(zeilen);
  const maximum = zeilen.reduce((m, z) => Math.max(m, z.streuungTage ?? 0), 0);
  const jahre = new Set<string>();
  for (const z of zeilen) {
    for (const zelle of z.zellen.values()) {
      if (zelle.art === 'datum') jahre.add(zelle.tag.slice(0, 4));
    }
  }
  const mitJahr = jahre.size > 1;
  const minBreite = B_PHASE + B_CODE + B_EREIGNIS_MIN + B_ROLLE
    + spalten.length * B_TRAEGER + B_SPANNE;

  if (zeilen.length === 0) {
    return (
      <div className={`py-6 text-[12px] ${LEISE}`}>
        Keine Schritte zur aktuellen Auswahl. Wert- und Textfelder stehen unten in der
        Ordner-Ansicht.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table
        className="w-full border-collapse text-left"
        style={{ tableLayout: 'fixed', minWidth: minBreite }}
      >
        <colgroup>
          <col style={{ width: B_PHASE }} />
          <col style={{ width: B_CODE }} />
          <col />
          <col style={{ width: B_ROLLE }} />
          {spalten.map(s => <col key={s.id} style={{ width: B_TRAEGER }} />)}
          <col style={{ width: B_SPANNE }} />
        </colgroup>
        <thead>
          <tr className="border-b border-[var(--tf-border)]">
            <th className={`${ZELLE} text-[10.5px] font-normal uppercase tracking-wider ${LEISE}`}>
              Phase
            </th>
            <th className={`${ZELLE} text-[10.5px] font-normal ${LEISE}`}>Kürzel</th>
            <th className={`${ZELLE} text-[10.5px] font-normal ${LEISE}`}>Ereignis</th>
            <th className={`${ZELLE} text-[10.5px] font-normal ${LEISE}`}>Wer</th>
            {spalten.map(s => (
              <th key={s.id} className={`${ZELLE} text-center font-normal`}>
                <span className="block text-[11.5px] text-[var(--tf-text)]">{s.kurz}</span>
                <span className={`block truncate font-mono text-[10px] ${LEISE}`} title={s.lang}>
                  {s.lang}
                </span>
              </th>
            ))}
            <th className={`${ZELLE} text-[10.5px] font-normal ${LEISE}`}>
              <span className="block">Spanne</span>
              <span className="block text-[10px]">TV-Streuung</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {zeilen.map((z, i) => {
            const rollen = rollenVonFeld(z.feld);
            const gedimmt = rollenSicht(rollen, rollenWahl) !== 'voll';
            const meilenstein = z.feld.prominenzDefault === 'meilenstein';
            const imFokus = fokus === z.feld.feldId;
            const phase = rinne[i];
            return (
              <tr
                key={z.feld.feldId}
                onClick={() => onFokus(imFokus ? null : z.feld.feldId)}
                className="cursor-pointer border-b border-[var(--tf-border)] hover:bg-[var(--tf-hover)]"
                style={imFokus ? { background: 'var(--tf-bg-secondary)' } : undefined}
              >
                <td className={`${ZELLE} text-[10.5px] uppercase tracking-wider ${LEISE}`}>
                  {phase === null ? '' : zahPhaseLabel(phase, version.zahPhasen)}
                </td>
                <td className={`${ZELLE} truncate font-mono text-[11.5px]`}>
                  <span
                    style={{
                      color: gedimmt
                        ? 'var(--tf-text-tertiary)'
                        : meilenstein ? 'var(--tf-primary)' : 'var(--tf-text-secondary)',
                    }}
                  >
                    {z.feld.code ?? ''}
                  </span>
                </td>
                <td className={`${ZELLE} truncate`} title={z.feld.label}>
                  <span
                    className="text-[12.5px]"
                    style={{
                      color: gedimmt ? 'var(--tf-text-tertiary)' : 'var(--tf-text)',
                      ...(meilenstein ? { fontWeight: 500 } : {}),
                    }}
                  >
                    {z.feld.label}
                  </span>
                </td>
                <td className={ZELLE}>
                  <RollenBadges rollen={rollen} gedimmt={gedimmt} />
                </td>
                {spalten.map(s => (
                  <td key={s.id} className={`${ZELLE} text-center`}>
                    <Zelle zelle={z.zellen.get(s.id)} mitJahr={mitJahr} />
                  </td>
                ))}
                <td className={ZELLE}>
                  <Spanne zeile={z} maximum={maximum} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
