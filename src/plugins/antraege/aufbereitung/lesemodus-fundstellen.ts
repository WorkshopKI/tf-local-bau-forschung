/**
 * Fundstellen-Overlay des Lesemodus (Paket 5, Phase 5). Deterministische Aggregation:
 * je Sektions-ID, welche Baustein-Ergebnisse sie referenzieren (Abdeckung, Steckbrief,
 * Zahlen, Verwertung, Glossar). Speist die Marginalien-Marker im Lesepane. Rein/testbar.
 *
 * Nur VORHANDENE Baustein-Daten werden aggregiert (fehlt/degradiert ohne Daten → keine
 * Marker, kein Hinweis-Spam). Sektions-IDs außerhalb der Gliederung werden ignoriert.
 */
import type { VbSektion } from './gliederung';
import { sektionZuAspekte, type AspektMapping } from './aspekte';
import type { SteckbriefDaten } from './steckbrief';
import type { ZahlenDaten } from './zahlen';
import type { VerwertungDaten } from './verwertung';
import type { GlossarDaten } from './glossar';

export type FundstelleBaustein = 'aspekte' | 'steckbrief' | 'zahlen' | 'verwertung' | 'glossar';

export interface FundstelleReferenz {
  baustein: FundstelleBaustein;
  /** Anzeige-Name des Bausteins (Popover-Zeile). */
  label: string;
  /** Kurztext des referenzierenden Eintrags (gekürzt). */
  kurztext: string;
}

const LABEL: Record<FundstelleBaustein, string> = {
  aspekte: 'Abdeckung',
  steckbrief: 'Steckbrief',
  zahlen: 'Zahl',
  verwertung: 'Verwertung',
  glossar: 'Glossar',
};

const KURZ_MAX = 70;
function kurz(s: string): string {
  const t = s.trim().replace(/\s+/g, ' ');
  return t.length > KURZ_MAX ? `${t.slice(0, KURZ_MAX - 1)}…` : t;
}

export interface FundstellenEingang {
  gliederung: VbSektion[];
  aspekte?: AspektMapping | null;
  steckbrief?: SteckbriefDaten | null;
  zahlen?: ZahlenDaten | null;
  verwertung?: VerwertungDaten | null;
  glossar?: GlossarDaten | null;
}

/** Alle Belegt-artigen Steckbrief-Einträge als {text, sektionIds}. */
function steckbriefEintraege(d: SteckbriefDaten): Array<{ text: string; sektionIds: string[] }> {
  const raus: Array<{ text: string; sektionIds: string[] }> = [];
  const push = (text: string | undefined, ids: string[] | undefined): void => {
    if (text && ids && ids.length) raus.push({ text, sektionIds: ids });
  };
  if (d.einSatz) push(d.einSatz.text, d.einSatz.sektionIds);
  if (d.laufzeit) push(d.laufzeit.text, d.laufzeit.sektionIds);
  if (d.kernZielwert) push(d.kernZielwert.text, d.kernZielwert.sektionIds);
  for (const b of d.innovation) push(b.text, b.sektionIds);
  for (const b of d.fueGegenstand) push(b.text, b.sektionIds);
  for (const b of d.auftraegeDritte) push(b.text, b.sektionIds);
  for (const z of d.zielmaerkte) push(z.markt, z.sektionIds);
  for (const p of d.personal) push(`${p.name} (${p.rolle})`, p.sektionIds);
  return raus;
}

/**
 * Baut die Map `sektionId → FundstelleReferenz[]`. Reihenfolge der Bausteine ist stabil
 * (Abdeckung → Steckbrief → Zahlen → Verwertung → Glossar).
 */
export function aggregiereFundstellen(eingang: FundstellenEingang): Map<string, FundstelleReferenz[]> {
  const bekannt = new Set(eingang.gliederung.map(s => s.id));
  const map = new Map<string, FundstelleReferenz[]>();
  const add = (sektionId: string, ref: FundstelleReferenz): void => {
    if (!bekannt.has(sektionId)) return;
    const arr = map.get(sektionId);
    if (arr) arr.push(ref); else map.set(sektionId, [ref]);
  };

  // Abdeckung (Aspekt-Mapping): je Sektion die zugeordneten Aspekt-Buchstaben.
  if (eingang.aspekte) {
    const s2a = sektionZuAspekte(eingang.aspekte);
    for (const [sektionId, aspekte] of Object.entries(s2a)) {
      if (aspekte.length) add(sektionId, { baustein: 'aspekte', label: LABEL.aspekte, kurztext: `Aspekt ${aspekte.join('/')}` });
    }
  }

  // Steckbrief: je belegter Aussage.
  if (eingang.steckbrief) {
    for (const e of steckbriefEintraege(eingang.steckbrief)) {
      for (const id of e.sektionIds) add(id, { baustein: 'steckbrief', label: LABEL.steckbrief, kurztext: kurz(e.text) });
    }
  }

  // Zahlen: je Claim (Wert).
  if (eingang.zahlen) {
    for (const c of eingang.zahlen.claims) {
      for (const id of c.sektionIds) add(id, { baustein: 'zahlen', label: LABEL.zahlen, kurztext: kurz(c.einheit ? `${c.wert} ${c.einheit}` : c.wert) });
    }
  }

  // Verwertung: je Aussage.
  if (eingang.verwertung) {
    for (const a of eingang.verwertung.aussagen) {
      for (const id of a.sektionIds) add(id, { baustein: 'verwertung', label: LABEL.verwertung, kurztext: kurz(a.text) });
    }
  }

  // Glossar: je Begriff.
  if (eingang.glossar) {
    for (const g of eingang.glossar.begriffe) {
      for (const id of g.sektionIds) add(id, { baustein: 'glossar', label: LABEL.glossar, kurztext: kurz(g.begriff) });
    }
  }

  return map;
}
