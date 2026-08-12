/**
 * PfadKopierZeile — ein Pfad zum Ansehen und Kopieren.
 *
 * Die File System Access API erlaubt keine programmatische Vorauswahl eines
 * Ordners. „Pfad vorbelegen" heisst deshalb ueberall in dieser App: den Pfad
 * ANZEIGEN und kopierbar machen, damit der Anwender ihn in die Adresszeile des
 * Ordner-Dialogs einfuegen kann. Genau dieser Block lag bis v4.0 zweimal von
 * Hand nachgebaut in `WelcomeScreen` und `StartupScreen` — jeweils mit eigenem
 * `copied`-State und eigenem 1500-ms-`setTimeout`.
 *
 * Kopieren und Picken bleiben ZWEI getrennte Knoepfe: unter `file://` verbrennt
 * jedes `await` vor `showDirectoryPicker` die User-Activation, ein Ablauf „erst
 * kopieren, dann Dialog oeffnen" wuerde den Picker still gar nicht oeffnen
 * (recurring-bug §2). Diese Komponente oeffnet deshalb nie einen Picker.
 *
 * `nurKnopf` fuer enge Wirte (Widgets, Statuszeilen): dann entfaellt der
 * Pfad-Text und nur der Kopier-Knopf bleibt.
 */

import { Check, ClipboardCopy } from 'lucide-react';
import { useKopierAktion } from '@/core/hooks/useKopierAktion';

interface PfadKopierZeileProps {
  /** Der anzuzeigende und zu kopierende Pfad. */
  pfad: string;
  /** Nur den Kopier-Knopf rendern (enge Wirte ohne Platz fuer den Pfad-Text). */
  nurKnopf?: boolean;
  /** Beschriftung im Normalzustand. Default: „Kopieren". */
  knopfText?: string;
  /** Zusaetzliche Klassen auf der Huelle. */
  className?: string;
}

export function PfadKopierZeile({
  pfad,
  nurKnopf = false,
  knopfText = 'Kopieren',
  className = '',
}: PfadKopierZeileProps): React.ReactElement {
  const kopieren = useKopierAktion(pfad, 'Pfad in Zwischenablage kopieren');

  const knopf = (
    <button
      type="button"
      onClick={() => kopieren.run()}
      disabled={kopieren.busy}
      className="px-3 py-2 rounded-[var(--tf-radius)] text-[12px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer inline-flex items-center gap-1.5 shrink-0"
      style={{ border: '0.5px solid var(--tf-border)' }}
      title={kopieren.titel}
    >
      {kopieren.kopiert ? <Check size={13} /> : <ClipboardCopy size={13} />}
      {kopieren.kopiert ? 'Kopiert' : knopfText}
    </button>
  );

  if (nurKnopf) {
    return <span className={className}>{knopf}</span>;
  }

  return (
    <div className={className}>
      <div className="flex items-stretch gap-2">
        <code className="flex-1 min-w-0 px-3 py-2 rounded-[var(--tf-radius)] text-[12.5px] font-mono bg-[var(--tf-bg-secondary)] text-[var(--tf-text)] overflow-x-auto">
          {pfad}
        </code>
        {knopf}
      </div>
      {kopieren.fehler && (
        <p className="mt-1.5 text-[12px] text-[var(--tf-danger-text)]">
          Kopieren fehlgeschlagen: {kopieren.fehler}
        </p>
      )}
    </div>
  );
}
