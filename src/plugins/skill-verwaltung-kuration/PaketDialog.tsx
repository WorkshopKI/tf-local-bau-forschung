/**
 * Kuratur-Paket — ein Stand am Stück von einem Daten-Share auf einen anderen.
 *
 * Ein Einstieg, zwei Hälften: **erstellen** (hier packen, herunterladen) und
 * **einspielen** (Datei mitgebracht, Vorschau, schreiben). Getrennte Knöpfe in
 * der Kopfzeile wären für eine so seltene Aktion zu viel Fläche; getrennte
 * Dialoge würden zweimal denselben Katalog laden.
 *
 * Der Textbaustein-Katalog wird hier geladen, weil er in einer EIGENEN Sidecar
 * liegt (`textbausteine.json`) und der Reiter, der ihn sonst hält, beim
 * Tabwechsel abgebaut wird. Geschrieben wird weiterhin über die zwei
 * bestehenden, self-gated Wege — das Paket bündelt nur den Transport.
 */
import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import { downloadAsFile } from '@/core/services/search/eval/eval-export';
import { runtimeConfig } from '@/config/runtime-config';
import { schnuerePaket, ALLES, type PaketAuswahl, type SkillRegistryFile } from '@/core/services/skills';
import { useTextbausteinKatalog } from './useTextbausteinKatalog';
import { PaketImportPanel } from './PaketImportPanel';

type Modus = 'erstellen' | 'einspielen';

interface Props {
  file: SkillRegistryFile;
  canEdit: boolean;
  persistRegistry: (next: SkillRegistryFile) => Promise<void>;
  onClose: () => void;
  /** Meldet der Seite, dass der Katalog neu geladen werden muss. */
  onEingespielt: () => void;
}

export function PaketDialog({ file, canEdit, persistRegistry, onClose, onEingespielt }: Props): React.ReactElement {
  // Startet beim harmlosen Fall: Erstellen schreibt nichts.
  const [modus, setModus] = useState<Modus>('erstellen');
  const katalogCtl = useTextbausteinKatalog();

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title="Kuratur-Paket"
      description="Überträgt Skills, Regeln, Workflows und Textbausteine als eine Datei auf einen anderen Daten-Share. Antragsdaten sind nie enthalten."
      footer={<Button variant="ghost" onClick={onClose}>Schließen</Button>}
    >
      <div className="flex flex-col gap-4 min-h-0 max-h-[60vh]">
        <SegmentedToggle<Modus>
          value={modus}
          onChange={setModus}
          ariaLabel="Paket erstellen oder einspielen"
          options={[
            { id: 'erstellen', label: 'Erstellen' },
            { id: 'einspielen', label: 'Einspielen' },
          ]}
        />
        {modus === 'erstellen' ? (
          <ErstellenPanel file={file} katalogGeladen={!katalogCtl.loading} bausteinAnzahl={katalogCtl.katalog?.bausteine.length ?? 0}
            onDownload={auswahl => {
              const paket = schnuerePaket(file, katalogCtl.katalog, auswahl, {
                erstellt_am: new Date().toISOString(),
                quelle: runtimeConfig.build.label,
              });
              const tag = new Date().toISOString().slice(0, 10);
              downloadAsFile(JSON.stringify(paket, null, 2), `kuratur-paket-${tag}.json`, 'application/json');
            }}
          />
        ) : (
          <PaketImportPanel
            file={file}
            katalog={katalogCtl.katalog}
            canEdit={canEdit && katalogCtl.canEdit}
            persistRegistry={persistRegistry}
            persistKatalog={katalogCtl.persist}
            onEingespielt={onEingespielt}
          />
        )}
      </div>
    </Dialog>
  );
}

interface ErstellenProps {
  file: SkillRegistryFile;
  katalogGeladen: boolean;
  bausteinAnzahl: number;
  onDownload: (auswahl: PaketAuswahl) => void;
}

function ErstellenPanel({ file, katalogGeladen, bausteinAnzahl, onDownload }: ErstellenProps): React.ReactElement {
  const [auswahl, setAuswahl] = useState<PaketAuswahl>(ALLES);
  const gruppen: Array<{ key: keyof PaketAuswahl; label: string; anzahl: number; hinweis?: string }> = [
    { key: 'skills', label: 'Skills', anzahl: file.skills.length },
    { key: 'regeln', label: 'Regeln', anzahl: file.regeln.length },
    { key: 'workflows', label: 'Workflows', anzahl: (file.workflows ?? []).length },
    {
      key: 'bausteine',
      label: 'Textbausteine',
      anzahl: bausteinAnzahl,
      hinweis: katalogGeladen ? undefined : 'wird geladen…',
    },
  ];
  const gesamt = gruppen.reduce((n, g) => n + (auswahl[g.key] ? g.anzahl : 0), 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[8px] border-[0.5px] border-[var(--tf-border)] divide-y divide-[var(--tf-border)]">
        {gruppen.map(g => (
          <label key={g.key} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-[var(--tf-hover)]">
            <input
              type="checkbox"
              checked={auswahl[g.key]}
              onChange={e => setAuswahl(prev => ({ ...prev, [g.key]: e.target.checked }))}
              className="accent-[var(--tf-primary)]"
            />
            <span className="text-[13px] text-[var(--tf-text)]">{g.label}</span>
            <span className="ml-auto text-[11.5px] text-[var(--tf-text-tertiary)] tabular-nums">
              {g.hinweis ?? g.anzahl}
            </span>
          </label>
        ))}
      </div>
      <p className="text-[11.5px] text-[var(--tf-text-secondary)] leading-relaxed">
        Die Datei enthält den kuratierten Stand ohne Fassungs-Historie — das Zielsystem
        führt seine eigene fort. Auf dem Ziel entscheidet die Vorschau je Eintrag, ob er
        neu angelegt, aktualisiert oder übersprungen wird.
      </p>
      <div className="flex items-center gap-3">
        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">{gesamt} Einträge</span>
        <Button
          variant="primary"
          size="sm"
          className="ml-auto"
          disabled={gesamt === 0}
          onClick={() => onDownload(auswahl)}
        >
          <Download size={13} /> Paket herunterladen
        </Button>
      </div>
    </div>
  );
}
