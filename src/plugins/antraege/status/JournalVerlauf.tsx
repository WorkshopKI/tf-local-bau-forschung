/**
 * Der **belegte Verlauf** eines Teilvorhabens aus dem Import-Diff-Journal.
 *
 * Die Chronik daneben liest die Datumsfelder des Exports — sie zeigt, was
 * *aktuell* gesetzt ist. Dieser Block zeigt, was sich *geändert hat*, und kennt
 * damit auch das, was der Export überschrieben hat: mehrfach gesetzte Kürzel
 * (V9) und zurückgenommene Setzungen.
 *
 * **Der Nullpunkt steht dauerhaft dabei.** Ohne ihn wird eine unvollständige
 * Chronik als vollständige gelesen — und ausgerechnet bei einem Verlauf ist das
 * der teuerste Irrtum. Ebenso benannt wird der Fall „für diesen Antrag wird kein
 * Journal geführt": leer und außerhalb des Bereichs sind verschiedene Aussagen.
 */
import { useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { chronikFuerAntrag, type AntragsChronik, type JournalEintrag } from '@/core/status';

const ART_TEXT: Record<JournalEintrag['art'], string> = {
  gesetzt: 'gesetzt',
  geaendert: 'geändert',
  geleert: 'zurückgenommen',
  'antrag-neu': 'erstmals im Export',
  'antrag-fehlt': 'nicht mehr im Export',
};

/** `20260803` → `03.08.2026`; Text bleibt Text. */
function wertText(w: JournalEintrag['von']): string {
  if (w === undefined) return '—';
  if (typeof w === 'number') {
    const s = String(w);
    return s.length === 8 ? `${s.slice(6, 8)}.${s.slice(4, 6)}.${s.slice(0, 4)}` : s;
  }
  return w;
}

function tagDe(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/** Wann — als Tag oder, bei unscharfer Spanne, als Zeitraum. */
function wannText(e: JournalEintrag): string {
  return e.unscharf && e.vonDatum && e.bisDatum
    ? `zwischen ${tagDe(e.vonDatum)} und ${tagDe(e.bisDatum)}`
    : `am ${tagDe(e.datum)}`;
}

export function JournalVerlauf({ aktenzeichen, stichtag }: {
  aktenzeichen: string;
  /** ISO — injiziert, nie eine Uhr in der Anzeige. */
  stichtag: string;
}): React.ReactElement | null {
  const idb = useStorage().idb;
  const [chronik, setChronik] = useState<AntragsChronik | null>(null);
  const [geladen, setGeladen] = useState(false);

  useEffect(() => {
    let abgebrochen = false;
    void (async () => {
      try {
        const c = await chronikFuerAntrag(idb, aktenzeichen, stichtag.slice(0, 10));
        if (!abgebrochen) { setChronik(c); setGeladen(true); }
      } catch {
        if (!abgebrochen) setGeladen(true);
      }
    })();
    return () => { abgebrochen = true; };
  }, [idb, aktenzeichen, stichtag]);

  // Kein Journal auf dem Share ⇒ gar nichts anzeigen. Ein leerer Block mit
  // Erklärung wäre Rauschen auf jeder Seite, solange das Journal nicht läuft.
  if (!geladen || chronik === null) return null;

  return (
    <section className="mt-4">
      <h4 className="text-[12.5px] font-medium text-[var(--tf-text)] mb-1">
        Belegte Änderungen
      </h4>
      {/* Dauerhaft, nicht nur beim ersten Blick. */}
      <p className="text-[11px] text-[var(--tf-text-tertiary)] mb-2">
        Historie ab {tagDe(chronik.journalAb)} — frühere Setzungen sind im Export überschrieben und
        nicht rekonstruierbar.
      </p>

      {!chronik.gefuehrt ? (
        <p className="text-[12px] text-[var(--tf-text-secondary)]">
          Für diesen Antrag wird kein Journal geführt — er stand beim letzten Nachtlauf nicht im
          Betrachtungsbereich, für den mitgeschrieben wird.
        </p>
      ) : chronik.felder.length === 0 ? (
        <p className="text-[12px] text-[var(--tf-text-secondary)]">
          Seit {tagDe(chronik.journalAb)} hat sich an den erfassten Kürzeln nichts geändert.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {chronik.felder.map(f => (
            <li key={f.feld}>
              <span className="font-mono text-[11.5px] text-[var(--tf-text-secondary)]">{f.feld}</span>
              <ul className="pl-3 flex flex-col gap-0.5">
                {f.eintraege.map((e, i) => (
                  <li key={`${e.stempel}-${i}`} className="text-[11.5px] text-[var(--tf-text-tertiary)]">
                    {ART_TEXT[e.art]} {wannText(e)}
                    {e.art === 'geaendert' && <> · {wertText(e.von)} → {wertText(e.nach)}</>}
                    {e.art === 'gesetzt' && <> · {wertText(e.nach)}</>}
                    {e.art === 'geleert' && <> · vorher {wertText(e.von)}</>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
