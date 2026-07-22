/**
 * ZuweisungStreifen — grüner „Zugewiesen an"-Streifen am Kopf der Detailspalte
 * (Redesign v2.26). Macht den freigegebenen Zustand sofort sichtbar: statt der
 * früheren „Aktuelle Zuweisungen"-Liste ganz unten steht die wichtigste
 * Zustandsinfo jetzt direkt unter dem Titel.
 *
 * Freigegeben ≠ vollzogen: das eigentliche Zuweisen passiert im Fachsystem, die
 * Bestätigung kommt frühestens am Folgetag über den CSV-Import zurück
 * (`tib_kuerz` am Antrag). Der Streifen benennt dieses Warten und färbt es
 * amber, sobald es die Fälligkeit reißt (v2.291).
 *
 * Rein präsentational — die Rücknahme läuft über `onUnassign` im Container.
 * Datenschutz: das Kürzel wird als bereits aufgelöster `realName` durchgereicht
 * (null in Varianten ohne `deAnonymisierung` → dann zeigt der Streifen die anonId).
 */
import { Undo2 } from 'lucide-react';

interface Props {
  anonId: string;
  /** Aufgelöstes Klartext-Kürzel (De-Anon-Resolver) oder null → anonId zeigen. */
  realName: string | null | undefined;
  stunden: number;
  quartal: string;
  /** Tage seit der Freigabe, solange die CSV-Bestätigung aussteht (`null` =
   *  kein Datum). Das eigentliche Zuweisen passiert im Fachsystem; bis dessen
   *  Export zurückkommt, ist die App-Freigabe eine Absichtserklärung. */
  offenSeitTagen?: number | null;
  /** true, wenn das Warten die Fälligkeit reißt → amber statt neutral. */
  ueberfaellig?: boolean;
  onUnassign: () => void;
}

export function ZuweisungStreifen({
  anonId, realName, stunden, quartal, offenSeitTagen, ueberfaellig, onUnassign,
}: Props): React.ReactElement {
  return (
    <div
      className="flex items-center gap-3 rounded-[10px] px-3.5 py-3"
      style={{ background: 'hsl(145,45%,97%)', border: '0.5px solid hsl(145,38%,85%)' }}
    >
      <span className="text-[9.5px] font-medium uppercase tracking-[0.09em] text-[var(--tf-text-tertiary)]">
        Zugewiesen an
      </span>
      <span
        className="text-[13px] font-medium text-[var(--tf-text)]"
        title={realName ? anonId : undefined}
      >
        {realName ?? anonId}
      </span>
      <span
        className="inline-flex items-center gap-1.5 h-[21px] px-2.5 rounded-full text-[11px] font-medium"
        style={{ background: 'var(--tf-success-bg)', color: 'var(--tf-success-text)' }}
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'hsl(145,55%,42%)' }} aria-hidden />
        zugewiesen
      </span>
      <span
        className="inline-flex items-center h-[21px] px-2.5 rounded-full text-[11px] font-medium"
        style={ueberfaellig
          ? { background: '#fef3c7', color: '#92400e' }
          : { background: 'var(--tf-bg-secondary)', color: 'var(--tf-text-secondary)' }}
        title="Die Zuweisung gilt erst als vollzogen, wenn der CSV-Export das TIB-Kürzel am Antrag zurückmeldet (frühestens am Folgetag)."
      >
        CSV-Bestätigung offen
        {typeof offenSeitTagen === 'number' && offenSeitTagen > 0 && ` · ${offenSeitTagen} T`}
      </span>
      <span className="font-mono text-[12px] text-[var(--tf-text-tertiary)]">
        {stunden} h · Q {quartal}
      </span>
      <span className="flex-1" />
      <button
        type="button"
        onClick={onUnassign}
        title="Zuweisung zurücknehmen"
        className="inline-flex items-center gap-1.5 h-[27px] px-2.5 rounded-md text-[11.5px] font-medium cursor-pointer text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]"
      >
        <Undo2 size={13} aria-hidden />
        Zurücknehmen
      </button>
    </div>
  );
}
