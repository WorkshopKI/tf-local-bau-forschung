/**
 * Die Leiste am unteren Rand, sobald etwas ausgewählt ist.
 *
 * **Nur Aktionen, die diese App wirklich ausführen kann.** Der Redesign-Handoff
 * nennt „Status setzen · Zuweisen · Frist setzen · Nächsten Schritt ausführen" —
 * alle vier schreiben ins Fachsystem C16, und die App leitet keinen Status ab
 * und schreibt keinen (Pitfall #44). Vier ausgegraute Knöpfe wären eine
 * Ankündigung, kein Werkzeug. Geblieben sind die zwei Wege, auf denen eine
 * Auswahl heute etwas wert ist: sie verlässt die App als Tabelle, oder als Liste
 * von Kennzeichen für die Zwischenablage.
 *
 * Der Export nimmt DIESELBEN Spalten wie die Ansicht (`resolveAntragTableColumns`
 * im Service) — der Unterschied zum Kopfzeilen-Export ist allein die Zeilenmenge.
 */
import { useMemo, useState } from 'react';
import { Download, Copy, X, Check, Loader2 } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { kopiereText } from '@/core/utils/kopieren';
import { Button } from '@/components/ui/button';
import { isAuslastungFreigeschaltet } from '@/core/modul-freischaltung';
import { useAntraegeStore } from '../store';
import { useTabellenSicht, beschraenkeAufSichtbare } from '../tabellenSicht';
import { useFilteredAntraege } from '../useFilteredAntraege';
import { useAntraegeColumnsStore } from '../useAntraegeColumnsStore';
import { useKategorieSpalten } from '../useKategorieSpalten';
import { exportFilteredAntraegeXlsx } from '../services/export-xlsx';
import { useAntraegeAuswahl, gewaehlteAus } from './useAntraegeAuswahl';

export function MassenLeiste(): React.ReactElement | null {
  const gewaehlt = useAntraegeAuswahl(s => s.gewaehlt);
  const leeren = useAntraegeAuswahl(s => s.leeren);
  const { filtered, bearbeiterFilter } = useFilteredAntraege();
  const sichtbareTvs = useTabellenSicht(s => s.sichtbareTvs);
  const sichtbareReihenfolge = useTabellenSicht(s => s.sichtbareReihenfolge);
  const visibleColumns = useAntraegeColumnsStore(s => s.visibleColumns);
  const kategorieSpalten = useKategorieSpalten();
  const verbundById = useAntraegeStore(s => s.verbundById);
  const storage = useStorage();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const [kopiert, setKopiert] = useState(false);

  // Gegen die aktuelle Liste geschnitten: wer auswählt und danach den Filter
  // dreht, soll nichts exportieren, was gerade nicht dasteht.
  //
  // ZWEI Schnitte, nicht einer: `filtered` endet vor den drei Einschränkungen,
  // die erst in der Ansicht greifen (Spaltenkopf-Trichter, Beendet-Achse,
  // Zeilen-Körnung). Bis v4.121 stand hier deshalb „12.359 Anträge gewählt",
  // während die Tabelle darüber 1.763 zeigte — und der Export schrieb die
  // 12.359. Was die Ansicht zeigt, meldet sie selbst (`tabellenSicht.ts`).
  const auswahl = useMemo(
    // Auch in der Reihenfolge der Ansicht — der Export schreibt die Zeilenfolge
    // des Bildschirms, nicht die der Pipeline (v4.124).
    () => beschraenkeAufSichtbare(gewaehlteAus(filtered, gewaehlt), sichtbareTvs, sichtbareReihenfolge),
    [filtered, gewaehlt, sichtbareTvs, sichtbareReihenfolge],
  );

  const exportieren = useAsyncAction(async () => {
    if (!activeProgrammId) throw new Error('Kein aktives Programm.');
    await exportFilteredAntraegeXlsx(
      auswahl, storage.idb, activeProgrammId, verbundById, visibleColumns,
      isAuslastungFreigeschaltet() && !bearbeiterFilter.active, kategorieSpalten,
      // Erst beim Klick gelesen: die selbst angelegten Spalten ändern sich
      // selten, und eine Abo-Zeile dafür rechnete die Leiste bei jedem Umbau
      // der Tabelle neu.
      useTabellenSicht.getState().eigeneSpalten,
    );
  });

  const kopieren = useAsyncAction(async () => {
    // Über `kopiereText`, nicht direkt: der Helfer hat den `execCommand`-Rückfall
    // und wirft, wenn beide Wege scheitern (Guard `no-raw-clipboard`) — „Kopiert"
    // darf nicht dastehen, wenn nichts kopiert wurde.
    await kopiereText(auswahl.map(a => a.aktenzeichen).join('\n'));
    setKopiert(true);
    window.setTimeout(() => setKopiert(false), 1600);
  });

  if (auswahl.length === 0) return null;

  return (
    <div className="pointer-events-none sticky bottom-0 z-30 flex justify-center pb-3">
      {/* Heller Grund statt der dunklen Leiste des Prototyps: eine schwebende
          Werkzeugleiste ist in dieser App eine Fläche wie ein Popover, und ein
          handgebauter Voll-Fill aus `--tf-text` ist der CTA-Farbe vorbehalten
          (Guard `no-raw-cta-fill`). Die Betonung trägt der Schatten. */}
      <div
        className="pointer-events-auto flex items-center gap-1.5 rounded-full py-1.5 pl-3 pr-1.5 shadow-lg"
        style={{ background: 'var(--tf-bg)', border: '0.5px solid var(--tf-border)' }}
      >
        <span className="text-[12px] tabular-nums text-[var(--tf-text)]">
          {auswahl.length.toLocaleString('de-DE')}
          {auswahl.length === 1 ? ' Antrag' : ' Anträge'} gewählt
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => exportieren.run()}
          disabled={exportieren.busy || !activeProgrammId}
          title={`Die ${auswahl.length} gewählten Anträge als XLSX exportieren — mit den Spalten der Ansicht`}
          className="h-7 gap-1.5 px-2"
        >
          {exportieren.busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
          <span className="text-[12px]">Als XLSX exportieren</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => kopieren.run()}
          disabled={kopieren.busy}
          title="Die Förderkennzeichen der Auswahl als Liste in die Zwischenablage"
          className="h-7 gap-1.5 px-2"
        >
          {kopiert ? <Check size={13} /> : <Copy size={13} />}
          <span className="text-[12px]">{kopiert ? 'Kopiert' : 'FKZ-Liste kopieren'}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={leeren}
          aria-label="Auswahl aufheben"
          title="Auswahl aufheben"
          className="h-7 w-7 p-0"
        >
          <X size={13} />
        </Button>
      </div>
      {(exportieren.error ?? kopieren.error) ? (
        <div
          role="alert"
          className="pointer-events-auto ml-2 self-center rounded-full px-3 py-1.5 text-[11.5px]"
          style={{ background: 'var(--tf-danger-bg)', color: 'var(--tf-danger-text)' }}
        >
          {exportieren.error ?? kopieren.error}
        </div>
      ) : null}
    </div>
  );
}
