/**
 * Die **Vorschau des Phasenvorschlags** — für beide Quellen dieselbe Oberfläche,
 * getrennt aufgerufen.
 *
 * Ohne Phase am Kürzel erklärt der Katalog kein „seit wann". Die Zuordnung lässt
 * sich aus der Trigger-Tabelle und aus der Auslieferung ableiten, aber abgeleitet
 * heißt nicht ungeprüft: vor der Übernahme steht, was gesetzt würde, woraus es
 * folgt, und was bewusst NICHT gesetzt wird.
 *
 * Anders als bei den Zieltagen ist die Auswahl **zeilenweise**. Voreingestellt
 * ist „alles", abgewählt wird einzeln — deshalb führt der State die ABWAHL: ein
 * neu hinzugekommener Vorschlag ist damit von selbst dabei, statt still zu
 * fehlen, weil eine Auswahlliste ihn nicht kannte.
 *
 * Die Sätze kommen fertig aus `feld-phase-vorschlag.ts`; hier wird keiner
 * gebaut. Sonst wäre die Darstellung nicht prüfbar (node-only Testumgebung).
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog } from '@/components/ui/dialog';
import {
  zahPhaseLabel,
  type OhneGrund, type PhasenKonflikt, type PhasenVorschlag, type QuellenAbweichung,
  type ZahPhase,
} from '@/core/status';

/** Warum ein Kürzel keinen Vorschlag bekommt — als Überschrift der Gruppe. */
const GRUND_LABEL: Record<OhneGrund, string> = {
  keinTrigger: 'Die Trigger-Tabelle kennt das Kürzel nicht',
  keinStatusTrigger: 'Trigger vorhanden, aber nur Mail- oder Eintrags-Prozeduren',
  nurMarker: 'Setzt nur Marker-Codes — „ohne Phase" ist dort richtig',
  unbekannterZielcode: 'Setzt einen Status, den der Phasen-Schnitt nicht führt',
};

const GRUND_REIHENFOLGE: readonly OhneGrund[] = [
  'unbekannterZielcode', 'nurMarker', 'keinStatusTrigger', 'keinTrigger',
];

export function FeldPhasenUebernahmeDialog({
  titel, einleitung, vorschlaege, uneinheitlich = [], abweichungen = [], ohneVorschlag = [],
  offen, darfSchreiben, phasen, onSchliessen, onUebernehmen,
}: {
  titel: string;
  einleitung: React.ReactNode;
  /** Die Phasen des ENTWURFS — eine dort umbenannte Phase soll hier so heißen. */
  phasen?: readonly ZahPhase[];
  vorschlaege: readonly PhasenVorschlag[];
  uneinheitlich?: readonly PhasenKonflikt[];
  abweichungen?: readonly QuellenAbweichung[];
  ohneVorschlag?: readonly { code: string; bezeichnung: string; grund: OhneGrund }[];
  offen: boolean;
  darfSchreiben: boolean;
  onSchliessen: () => void;
  onUebernehmen: (feldIds: string[]) => void;
}): React.ReactElement {
  const [abgewaehlt, setAbgewaehlt] = useState<ReadonlySet<string>>(new Set());
  const [ohneOffen, setOhneOffen] = useState(false);

  const gewaehlt = vorschlaege.filter(v => !abgewaehlt.has(v.feldId));
  const alleAn = gewaehlt.length === vorschlaege.length;

  const umschalten = (feldId: string): void => setAbgewaehlt(s => {
    const neu = new Set(s);
    if (neu.has(feldId)) neu.delete(feldId);
    else neu.add(feldId);
    return neu;
  });

  const alleUmschalten = (): void => setAbgewaehlt(
    alleAn ? new Set(vorschlaege.map(v => v.feldId)) : new Set(),
  );

  const schliessen = (): void => { setAbgewaehlt(new Set()); onSchliessen(); };

  return (
    <Dialog
      open={offen}
      onClose={schliessen}
      title={titel}
      size="xl"
      footer={
        <div className="flex items-center gap-2">
          <Button
            variant="primary" size="sm"
            disabled={!darfSchreiben || gewaehlt.length === 0}
            title={darfSchreiben ? undefined : 'Nur mit Schreibrecht auf den Daten-Share'}
            onClick={() => { onUebernehmen(gewaehlt.map(v => v.feldId)); schliessen(); }}
          >
            {gewaehlt.length} Kürzel übernehmen
          </Button>
          <Button variant="ghost" size="sm" onClick={schliessen}>Abbrechen</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-[12.5px] text-[var(--tf-text-secondary)]">{einleitung}</p>

        {vorschlaege.length === 0 ? (
          <p className="text-[12.5px] text-[var(--tf-text)]">
            Nichts zu übernehmen — alle ableitbaren Phasen stehen bereits im Katalog.
          </p>
        ) : (
          <div className="max-h-[320px] overflow-y-auto rounded" style={{ background: 'var(--tf-bg)' }}>
            <table className="w-full border-collapse">
              <thead className="sticky top-0" style={{ background: 'var(--tf-bg)' }}>
                <tr className="text-[11px] text-[var(--tf-text-tertiary)] text-left">
                  <th className="px-2 py-1 font-normal w-[24px]">
                    {/* Tri-State: „32 von 33" darf nicht aussehen wie „keines". */}
                    <Checkbox
                      checked={alleAn ? true : gewaehlt.length === 0 ? false : 'indeterminate'}
                      onCheckedChange={alleUmschalten}
                      aria-label={alleAn ? 'Alle abwählen' : 'Alle übernehmen'}
                    />
                  </th>
                  <th className="px-2 py-1 font-normal">Kürzel</th>
                  <th className="px-2 py-1 font-normal">Bezeichnung</th>
                  <th className="px-2 py-1 font-normal">bisher</th>
                  <th className="px-2 py-1 font-normal">ZAH-Phase</th>
                  <th className="px-2 py-1 font-normal">Beleg</th>
                </tr>
              </thead>
              <tbody>
                {vorschlaege.map(v => (
                  <tr key={v.feldId} className="text-[12px] text-[var(--tf-text-secondary)] align-top">
                    <td className="px-2 py-1">
                      <Checkbox
                        checked={!abgewaehlt.has(v.feldId)}
                        onCheckedChange={() => umschalten(v.feldId)}
                        aria-label={`${v.code} übernehmen`}
                      />
                    </td>
                    <td className="px-2 py-1 font-mono text-[var(--tf-text-tertiary)]">{v.code}</td>
                    <td className="px-2 py-1 text-[var(--tf-text)]">{v.bezeichnung}</td>
                    {/* `—` heißt „nie entschieden", „ohne Phase" heißt „bewusst
                        keine" — der Unterschied entscheidet, ob die Übernahme
                        eine Lücke füllt oder eine Entscheidung umstößt. */}
                    <td className="px-2 py-1 text-[var(--tf-text-tertiary)]">
                      {v.alt === undefined ? '—'
                        : v.alt === null ? 'ohne Phase' : zahPhaseLabel(v.alt, phasen)}
                    </td>
                    <td className="px-2 py-1 text-[var(--tf-text)]">{zahPhaseLabel(v.phase, phasen)}</td>
                    <td className="px-2 py-1 text-[11.5px] text-[var(--tf-text-tertiary)]">
                      {v.belege.map((b, i) => (
                        <div key={`${b.status ?? 'seed'}-${b.quelle}-${i}`}>{b.satz}</div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Erscheint nur, wenn er etwas zu sagen hat: am heutigen Trigger-Stand
            gibt es keinen einzigen Fall. Eine dauerhaft leere Überschrift schickt
            den Leser auf die Suche nach einem Problem, das es nicht gibt. */}
        {uneinheitlich.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-[12px] text-[var(--tf-warning-text)]">
              <strong>Uneinheitlich über die Richtlinien</strong> — hier gibt es bewusst keinen
              Vorschlag. Eine Mehrheitsentscheidung wäre geraten; diese Fälle gehören in den
              Fachtermin:
            </p>
            <ul className="flex flex-col gap-0.5 max-h-[160px] overflow-y-auto">
              {uneinheitlich.map(k => (
                <li key={k.feldId} className="text-[11.5px] text-[var(--tf-text-secondary)]">
                  {k.satz}
                </li>
              ))}
            </ul>
          </div>
        )}

        {abweichungen.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-[12px] text-[var(--tf-warning-text)]">
              <strong>Auslieferung und Trigger-Tabelle widersprechen sich</strong> — an diesen
              Feldern wird aus keiner der beiden Quellen etwas gesetzt:
            </p>
            <ul className="flex flex-col gap-0.5 max-h-[160px] overflow-y-auto">
              {abweichungen.map(a => (
                <li key={a.feldId} className="text-[11.5px] text-[var(--tf-text-secondary)]">
                  {a.satz}
                </li>
              ))}
            </ul>
          </div>
        )}

        {ohneVorschlag.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-[12px] text-[var(--tf-text-secondary)]">
              <strong>{ohneVorschlag.length} Kürzel ohne Vorschlag.</strong> Das ist hier die
              richtige Antwort, kein Mangel: Kürzel, die keinen Status setzen, erklären auch kein
              „seit wann" und brauchen keine Phase.
            </p>
            <button
              type="button" onClick={() => setOhneOffen(v => !v)} aria-expanded={ohneOffen}
              className="self-start text-[12px] text-[var(--tf-text-tertiary)] cursor-pointer underline"
            >
              {ohneOffen ? 'Liste ausblenden' : 'Liste anzeigen'}
            </button>
            {ohneOffen && (
              <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto">
                {GRUND_REIHENFOLGE.map(grund => {
                  const treffer = ohneVorschlag.filter(o => o.grund === grund);
                  if (treffer.length === 0) return null;
                  return (
                    <div key={grund}>
                      <p className="text-[11px] text-[var(--tf-text-secondary)]">
                        {GRUND_LABEL[grund]} ({treffer.length})
                      </p>
                      <p className="text-[11.5px] font-mono text-[var(--tf-text-tertiary)]">
                        {treffer.map(o => o.code).join(' · ')}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
