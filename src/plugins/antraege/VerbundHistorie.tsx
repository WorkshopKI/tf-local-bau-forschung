/**
 * Die **belegten Änderungen** eines Verbundes aus dem Import-Diff-Journal.
 *
 * Bis v4.11 las diese Sektion den IDB-Store `verbund_historie`. Der wird nur
 * befüllt, wenn im CSV-Mapping eine auf `verbund_titel`/`verbund_status`
 * gemappte Spalte `trackHistory: true` trägt — kein ausgeliefertes Mapping tut
 * das (Wizard und Auto-Adopt setzen `false`). Die Sektion konnte also nie etwas
 * zeigen und meldete auf jedem Antrag „Noch keine Verbund-Änderungen erfasst",
 * während der Nachtlauf seit Wochen Änderungen mitschrieb — nur eben woanders.
 *
 * Quelle ist deshalb jetzt dasselbe Journal, das der Verlauf am Teilvorhaben
 * zeigt (`status/JournalVerlauf`), hier über alle TVs des Verbundes.
 *
 * **Der Nullpunkt steht dauerhaft dabei.** Ohne ihn wird eine unvollständige
 * Chronik als vollständige gelesen. Ebenso benannt bleibt der Unterschied
 * zwischen „für diesen Antrag wird kein Journal geführt" (außerhalb des
 * Betrachtungsbereichs) und „es hat sich nichts geändert".
 *
 * **Geladen wird über `useJournalChroniken`**, nicht mehr selbst: seit v4.57
 * fragt auch die Chronik im Verlauf nach denselben Daten (zurückgenommene
 * Termine), und `stand.json` wiegt über 5 MB und ist bewusst nicht gecacht.
 * Zwei eigene Effekte auf derselben Seite hießen zwei Vollzugriffe über SMB.
 */
import { useState } from 'react';
import type { Antrag } from '@/core/services/csv/types';
import { eintragText, nullpunktText, tagDe } from './status/journalTexte';
import { useJournalChroniken } from './status/useJournalChroniken';

export function VerbundHistorie({ tvs }: { tvs: Antrag[] }): React.ReactElement {
  // Einmal je Anzeige gestempelt und hineingereicht — nie eine Uhr im Lesepfad.
  const [stichtag] = useState(() => new Date().toISOString().slice(0, 10));
  const { laden, chroniken } = useJournalChroniken(
    tvs.map(t => t.aktenzeichen), stichtag,
  );

  if (laden) {
    return <div className="text-[12.5px] text-[var(--tf-text-tertiary)]">Lädt …</div>;
  }

  // Kein Journal auf dem Share: das ist keine Aussage über diesen Verbund.
  if (chroniken === null) {
    return (
      <div className="text-[12.5px] text-[var(--tf-text-tertiary)] italic">
        Für diesen Daten-Share wird (noch) kein Änderungs-Journal geführt — es entsteht
        mit dem nächsten Import eines Export-Standes.
      </div>
    );
  }

  const journalAb = chroniken[0]?.journalAb ?? null;
  const gefuehrt = chroniken.some(c => c.gefuehrt);
  const mitAenderung = chroniken.filter(c => c.felder.length > 0);

  return (
    <div className="text-[12.5px]">
      {/* Nullpunkt und „wird hier nicht geführt" im selben Wortlaut wie unter der
          Chronik — der Satz lebt in `journalTexte`, nicht zweimal (§12.9). */}
      <p className="mb-2 text-[11px] text-[var(--tf-text-tertiary)]">
        {nullpunktText(journalAb, gefuehrt)}
      </p>

      {mitAenderung.length === 0 ? (
        <p className="text-[var(--tf-text-secondary)]">
          {gefuehrt
            ? `Seit ${journalAb ? tagDe(journalAb) : 'dem Nullpunkt'} hat sich an den erfassten Feldern nichts geändert.`
            : 'Es gibt deshalb keine belegten Änderungen zu diesem Verbund.'}
        </p>
      ) : (
        <div style={{ border: '0.5px solid var(--tf-border)', borderRadius: 8 }}>
          {mitAenderung.map((c, i) => (
            <div
              key={c.antragId}
              className="px-3 py-2"
              style={{ borderTop: i === 0 ? undefined : '0.5px solid var(--tf-border)' }}
            >
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-mono text-[11.5px] text-[var(--tf-text)]">{c.antragId}</span>
                <span className="text-[11px] text-[var(--tf-text-tertiary)]">
                  {tvs.find(t => t.aktenzeichen === c.antragId)?.antragsteller ?? ''}
                </span>
              </div>
              <ul className="mt-1 flex flex-col gap-1">
                {c.felder.map(f => (
                  <li key={f.feld}>
                    <span className="font-mono text-[11.5px] text-[var(--tf-text-secondary)]">{f.feld}</span>
                    <ul className="pl-3 flex flex-col gap-0.5">
                      {f.eintraege.map((e, j) => (
                        <li key={`${e.stempel}-${j}`} className="text-[11.5px] text-[var(--tf-text-tertiary)]">
                          {eintragText(e)}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
