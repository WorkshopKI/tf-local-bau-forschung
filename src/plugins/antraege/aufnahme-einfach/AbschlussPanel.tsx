/**
 * Abschluss der Aufnahme: Zusammenfassung + Merkliste der FKZ mit neuer VB +
 * Einstieg in Teil B (Batch-Generierung). Der Batch-Start wird als Prop
 * hereingereicht (in der UI von Teil B verdrahtet); fehlt er, ist der Button
 * ausgeblendet (Teil A allein lauffähig).
 */
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AbschlussInfo } from './types';

interface Props {
  info: AbschlussInfo;
  onNeu: () => void;
  onClose: () => void;
  onBatchStart?: (fkz: string[]) => void;
}

export function AbschlussPanel({ info, onNeu, onClose, onBatchStart }: Props): React.ReactElement {
  return (
    <div>
      {/* Ein Abbruch ist kein Abschluss — Titel, Symbol und Zahlen sagen das
          (v4.124). Vorher stand "Aufnahme abgeschlossen · 3 konvertiert" da,
          und die sieben nicht mehr verarbeiteten Dateien tauchten in keiner
          der drei Zahlen auf. */}
      <div className="flex items-center gap-2 mb-3">
        {info.abgebrochen
          ? <AlertTriangle size={18} className="text-[var(--tf-warning-text)]" />
          : <CheckCircle2 size={18} className="text-[var(--tf-success-text)]" />}
        <h2 className="text-[18px] font-medium text-[var(--tf-text)]">
          {info.abgebrochen ? 'Aufnahme abgebrochen' : 'Aufnahme abgeschlossen'}
        </h2>
      </div>

      <p className="text-[13.5px] text-[var(--tf-text-secondary)]">
        {info.konvertiert} konvertiert
        {info.fehlgeschlagen > 0 ? ` · ${info.fehlgeschlagen} fehlgeschlagen` : ''}
        {info.uebersprungen > 0 ? ` · ${info.uebersprungen} übersprungen` : ''}
        {info.abgebrochen && (info.nichtVerarbeitet ?? 0) > 0
          ? ` · ${info.nichtVerarbeitet} nicht mehr verarbeitet`
          : ''}
      </p>
      {info.abgebrochen ? (
        <p className="mt-1 text-[12.5px] text-[var(--tf-warning-text)]">
          Die nicht verarbeiteten Dateien bleiben im Paket offen — „Weitere aufnehmen" verwirft sie aus dieser Sitzung.
        </p>
      ) : null}

      {info.fkzMitVb.length > 0 && (
        <div className="mt-4">
          <div className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] mb-1.5">
            Anträge mit neuer Vorhabensbeschreibung
          </div>
          <div className="flex flex-wrap gap-1.5">
            {info.fkzMitVb.map(fkz => (
              <span key={fkz} className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-[var(--tf-bg-secondary)] text-[var(--tf-text)]">{fkz}</span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        {onBatchStart && info.fkzMitVb.length > 0 && (
          <Button
            type="button"
            variant="primary"
            onClick={() => onBatchStart(info.fkzMitVb)}
          >
            Gutachten-Entwürfe erzeugen…
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          onClick={onNeu}
        >
          Weitere aufnehmen
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
        >
          Schließen
        </Button>
      </div>
    </div>
  );
}
