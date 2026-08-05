/**
 * Wie frisch das **Import-Diff-Journal** ist — in der Referenzdaten-Sektion.
 *
 * Das Journal ist die dritte Datenquelle des Vorgangssystems (neben
 * Parametertabelle und Trigger-Tabelle) und die einzige, die von selbst
 * fortgeschrieben wird. Genau deshalb braucht sie eine Anzeige: ein
 * ausgefallener Journal-Schritt sagt nichts, er hört einfach auf. Der erste
 * Eintrag danach trägt dann eine Spanne über den ganzen unbemerkten Zeitraum —
 * `unscharf` statt Datum —, und der Nullpunkt ist verwässert, bevor es jemandem
 * auffällt.
 *
 * **Die Warnung nennt die Folge, nicht den Zustand.** „Letzter Stempel vor 9
 * Tagen" ist eine Zahl; „die Änderungen dieser 9 Tage werden beim nächsten Lauf
 * als Zeitraum erfasst" ist der Grund, etwas zu tun.
 *
 * **Keine Personen-Achse** (Pitfall #48): diese Ansicht liest kein
 * Bearbeiter-Kürzel und gruppiert nach nichts dergleichen. Das Journal führt
 * keine — und eine Diagnose-Zeile darf keine erfinden. Der Konventionstest
 * `journal-ohne-personen-achse` führt diese Datei in seiner Ansichten-Liste.
 */
import { useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import {
  journalFrische, JOURNAL_FRISCHE_WARNUNG_TAGE, type JournalFrische as Frische,
} from '@/core/status';
import { zaehlwort } from '@/core/utils/zaehlwort';

export interface FrischeLage {
  /** `null` = kein Stand auf dem Share (noch kein Baseline-Lauf). */
  frische: Frische | null;
  geladen: boolean;
}

/** Liest den Stand einmal je Seitenaufruf. */
export function useJournalFrische(stichtag: string): FrischeLage {
  const idb = useStorage().idb;
  const [lage, setLage] = useState<FrischeLage>({ frische: null, geladen: false });

  useEffect(() => {
    let abgebrochen = false;
    void (async () => {
      try {
        const f = await journalFrische(idb, stichtag.slice(0, 10));
        if (!abgebrochen) setLage({ frische: f, geladen: true });
      } catch {
        // Ein unlesbarer Stand ist kein Grund, die Seite scheitern zu lassen —
        // die Anzeige sagt dann „noch nicht angelegt", und das stimmt aus Sicht
        // dieses Geräts auch.
        if (!abgebrochen) setLage({ frische: null, geladen: true });
      }
    })();
    return () => { abgebrochen = true; };
  }, [idb, stichtag]);

  return lage;
}

function tagDe(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/** „heute" · „1 Tag" · „14 Tage" — eine Diagnose-Zeile mit Grammatikfehler wird nicht ernst genommen. */
function alter(tage: number): string {
  if (tage === 0) return 'heute';
  return zaehlwort(tage, 'Tag', 'Tage');
}

/** Die Kurzform für die Kopfzeile der eingeklappten Sektion. */
export function JournalFrischeChip({ lage }: { lage: FrischeLage }): React.ReactElement | null {
  if (!lage.geladen) return null;
  if (lage.frische === null) {
    return <span className="text-[11px] text-[var(--tf-text-tertiary)]">· Journal noch nicht angelegt</span>;
  }
  const { tageAlt, veraltet } = lage.frische;
  return (
    <span
      className={`text-[11px] ${veraltet ? 'text-[var(--tf-warning-text)]' : 'text-[var(--tf-text-tertiary)]'}`}
    >
      · Journal {tageAlt === 0 ? 'von heute' : `${alter(tageAlt)} alt`}
    </span>
  );
}

/**
 * Der ausführliche Block im aufgeklappten Bereich.
 *
 * @param darfSchreiben Ohne Schreibrecht bleibt die Anzeige, nur der Hinweis
 *   „wird beim nächsten Import angelegt" fällt weg — dieses Gerät kann ihn nicht
 *   einlösen, und ein Versprechen, das man nicht halten kann, ist schlechter als
 *   keins.
 */
export function JournalFrischeBlock({ lage, darfSchreiben }: {
  lage: FrischeLage;
  darfSchreiben: boolean;
}): React.ReactElement {
  if (!lage.geladen) {
    return <p className="text-[12px] text-[var(--tf-text-tertiary)]">Journal wird gelesen …</p>;
  }

  if (lage.frische === null) {
    return (
      <p className="text-[12px] text-[var(--tf-text-secondary)]">
        <strong>Journal noch nicht angelegt.</strong> Solange keines geführt wird, ist der Verlauf
        eines Antrags eine Näherung aus den Datumsspalten — mehrfach gesetzte Kürzel tragen dort nur
        das letzte Datum.
        {darfSchreiben
          ? ' Der nächste CSV-Import legt den Nullpunkt an (Baseline-Lauf, ohne Einträge).'
          : ' Angelegt wird es auf einem Gerät mit Schreibrecht auf den Daten-Share.'}
      </p>
    );
  }

  const { stempel, tageAlt, veraltet, journalAb, monat, eintraegeImMonat } = lage.frische;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[12px] text-[var(--tf-text)]">
        <strong>Journal:</strong> letzter Stempel vom {tagDe(stempel.datum)}
        {tageAlt === 0 ? ' (heute)' : ` (${alter(tageAlt)} alt)`}
        {' · '}{zaehlwort(eintraegeImMonat, 'Eintrag', 'Einträge')} im Monat {monat}
        {' · '}Historie ab {tagDe(journalAb)}
      </p>
      {veraltet && (
        <p className="text-[11.5px] text-[var(--tf-warning-text)]">
          {/* Immer Plural: `veraltet` gilt erst jenseits der Schwelle, also ab 4 Tagen. */}
          ⚠ Seit {tageAlt} Tagen ist kein Export journalisiert worden (Schwelle{' '}
          {JOURNAL_FRISCHE_WARNUNG_TAGE} Tage). Was sich in dieser Zeit geändert hat, kann der
          nächste Lauf nur als <em>Zeitraum</em> erfassen, nicht als Datum — jede Setzung dazwischen
          bleibt unbelegt.
          {darfSchreiben && ' Ein CSV-Import auf diesem Gerät holt den Rückstand auf.'}
        </p>
      )}
    </div>
  );
}
