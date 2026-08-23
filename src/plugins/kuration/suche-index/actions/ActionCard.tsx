/**
 * Geteilter Rahmen der vier Aktions-Karten in „Dokumenten-Index pflegen".
 *
 * Die Karten stehen zu zweit nebeneinander in der 1.32fr-Hauptspalte und haben
 * dort nur ~232 px Innenbreite. Der Kopf traegt deshalb `flex-wrap` und die
 * Textspalte eine Grundbreite von 140 px: passt die Steuerung daneben (breites
 * Fenster, eingeklappte Sidebar), stehen sie nebeneinander — sonst rutscht sie
 * auf eine eigene Zeile und der Text bekommt die volle Kartenbreite.
 *
 * Bis v6.16 bauten `ActionCardIndex` und `ActionCardDocuments` diesen Kopf von
 * Hand nach, dort ohne `flex-1`/`min-w-0` an der Textspalte und mit `shrink-0`
 * an der Steuerung. Der Text bekam dadurch ~110 px, und „Worttrennung geaendert
 * — der naechste Lauf baut den Index komplett neu" brach auf sechs Zeilen um.
 */

interface ActionCardProps {
  title: string;
  /** Sekundaere Zustandszeile unter dem Titel („6 Dokumente gesamt"). */
  status?: string;
  /** Tertiaere Zusatzzeile darunter („Index aktuell", „3 neue Dokumente"). */
  hinweis?: string;
  /** Steuerung rechts im Kopf (Ordner-Chip, „Ordner verbinden"). */
  kopfAktion?: React.ReactNode;
  /** Block zwischen Kopf und Knopfzeile (Fehlertext, Ordnerliste). */
  notiz?: React.ReactNode;
  /** Die Knopfzeile am Fuss der Karte. */
  children: React.ReactNode;
}

export function ActionCard({
  title, status, hinweis, kopfAktion, notiz, children,
}: ActionCardProps): React.ReactElement {
  return (
    <div className="p-[14px] rounded-[var(--tf-radius)] space-y-2"
      style={{ border: '0.5px solid var(--tf-border)' }}>

      <div className="flex items-start justify-between gap-x-3 gap-y-1 flex-wrap">
        <div className="min-w-0 flex-1 basis-[140px]">
          <p className="text-[13px] font-medium text-[var(--tf-text)]">{title}</p>
          {status && <p className="text-[12px] text-[var(--tf-text-secondary)]">{status}</p>}
          {hinweis && <p className="text-[11px] text-[var(--tf-text-tertiary)]">{hinweis}</p>}
        </div>
        {kopfAktion != null && <div className="shrink-0">{kopfAktion}</div>}
      </div>

      {notiz}

      <div className="flex items-center gap-2 flex-wrap">{children}</div>
    </div>
  );
}
