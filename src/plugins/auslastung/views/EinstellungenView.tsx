/**
 * EinstellungenView — Tab „Einstellungen" des Auslastungs-Moduls (v2.21).
 *
 * Bündelt die Admin-/Konfigurations-Sektionen, die bis v2.20 im „Erweitert"-
 * Aufklapper des Tabs „Auslastung MA" versteckt waren: Kategorien, CSV-Import/
 * Export, Konfiguration und der Themen-Vektoren-(Embedding-)Korpus. Eigener Tab
 * am Ende der Tab-Leiste, damit die Einstellungen direkt auffindbar sind statt
 * im Statistik-Tab vergraben.
 *
 * Rendert nur, wenn AuslastungView `loaded` meldet (Tab-Gate + activeProgrammId-
 * Guard liegen dort) — eigene Guards sind daher nicht nötig. Die Sektionen
 * degradieren während des Antraege-Cache-Loads sauber (z.B. Corpus-Build mit
 * `total === 0` disabled), bis `useAntraegeCache` befüllt ist.
 *
 * v3.0: Der `korpusOnly`-Modus ist entfallen — er bediente ausschliesslich den
 * schlanken kurator-Korpus-View, und die kurator-Variante gibt es nicht mehr.
 *
 * v4.114: Die vier Sektionen sind einzeln kennzeichenbar (Beta/Experte). Sie
 * stehen deshalb als LISTE da und nicht mehr als JSX-Folge mit Trennstrichen
 * dazwischen: ein fest gesetzter Strich zwischen zwei Karten wird zum
 * doppelten oder führenden Strich, sobald eine der beiden verborgen ist.
 */
import { useSichtbar } from '@/core/hooks/useSichtbar';
import { abschnittId } from '@/core/sichtbarkeit';
import { useStorage } from '@/core/hooks/useStorage';
import { useAntraegeCache } from '../hooks/useAntraegeCache';
import { KategorienSection } from './admin/KategorienSection';
import { ImportExportSection } from './admin/ImportExportSection';
import { KonfigurationSection } from './admin/KonfigurationSection';
import { EmbeddingCorpusSection } from './admin/EmbeddingCorpusSection';

export function EinstellungenView(): React.ReactElement {
  const storage = useStorage();
  const cache = useAntraegeCache();
  const sichtbar = useSichtbar();

  const sektionen: { id: string; inhalt: React.ReactElement }[] = [
    {
      id: abschnittId('auslastung', 'karte-kategorien'),
      inhalt: <KategorienSection storage={storage} allDeskriptoren={cache.allDeskriptoren} />,
    },
    {
      id: abschnittId('auslastung', 'karte-import-export'),
      inhalt: <ImportExportSection antraege={cache.antraege} />,
    },
    {
      id: abschnittId('auslastung', 'karte-konfiguration'),
      inhalt: <KonfigurationSection storage={storage} />,
    },
    {
      id: abschnittId('auslastung', 'karte-themen-vektoren'),
      // Seit v4.127 nur noch Statusanzeige — der Bau liegt in der Kuration und
      // holt sich seinen Bestand selbst (kein Auslastungs-Cache mehr nötig).
      inhalt: <EmbeddingCorpusSection storage={storage} />,
    },
  ];

  return (
    <div className="flex flex-col">
      {sektionen.filter(s => sichtbar(s.id)).map((s, i) => (
        <div key={s.id}>
          {i > 0 && <div className="my-4" style={{ borderTop: '0.5px solid var(--tf-border)' }} />}
          {s.inhalt}
        </div>
      ))}
    </div>
  );
}
