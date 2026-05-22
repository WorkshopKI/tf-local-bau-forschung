import { useEffect, useMemo, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { getAntrag, getHistoryByAz, loadSchema, listSchemas } from '@/core/services/csv';
import type { Antrag, CsvSchema } from '@/core/services/csv/types';
import { buildDisplayRows, groupDisplayRows, type DisplayGroup } from './buildDisplayRows';
import { FieldHistoryModal } from './FieldHistoryModal';
import { AntragDokumenteSection } from './AntragDokumenteSection';
import { NetzwerkMitgliederSection } from './NetzwerkMitgliederSection';
import { EckdatenCard } from './EckdatenCard';
import { KlassifikationPills } from './KlassifikationPills';
import { AlleFelderSection } from './AlleFelderSection';
import { findFieldValue } from './fieldLookup';

interface Props {
  aktenzeichen: string;
  onOpenAntrag: (aktenzeichen: string) => void;
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

/**
 * Inline TV-Detail-Block fuer die zusammengefuehrte Verbund/TV-Ansicht.
 * Rendert die TV-spezifischen Sections (Vorhaben-Inhalt + Eckdaten + Klassifikation
 * + AlleFelder + Netzwerk + Dokumente) ohne eigenes Panel-Frame — der Container
 * (`VerbundDetail`) stellt das Frame.
 *
 * Bewusst NICHT enthalten:
 *  - Workflow-Stepper (sitzt in der gemeinsamen Status-&-Workflow-Section
 *    der `VerbundDetail`, switcht je nach expandiertem TV)
 *  - Titel-h1 + Verbund-Banner (gehoert zum Verbund-Header oben)
 */
export function TvDetailBlock({ aktenzeichen, onOpenAntrag }: Props): React.ReactElement {
  const storage = useStorage();
  const [antrag, setAntrag] = useState<Antrag | null>(null);
  const [historyCounts, setHistoryCounts] = useState<Record<string, number>>({});
  const [sourceNames, setSourceNames] = useState<Record<string, string>>({});
  const [schemas, setSchemas] = useState<CsvSchema[]>([]);
  const [historyField, setHistoryField] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const a = await getAntrag(storage.idb, aktenzeichen);
      if (cancelled) return;
      setAntrag(a);
      if (!a) return;
      const hist = await getHistoryByAz(storage.idb, aktenzeichen);
      const counts: Record<string, number> = {};
      for (const h of hist) counts[h.feld] = (counts[h.feld] ?? 0) + 1;
      if (cancelled) return;
      setHistoryCounts(counts);

      const ids = [...new Set(Object.values(a._field_sources ?? {}))];
      const names: Record<string, string> = {};
      const loadedSchemas: CsvSchema[] = [];
      for (const id of ids) {
        const s = await loadSchema(storage.idb, id);
        if (s) {
          names[id] = s.csv_source_name;
          loadedSchemas.push(s);
        }
      }
      const allSchemas = await listSchemas(storage.idb, a.programm_id);
      if (cancelled) return;
      setSourceNames(names);
      const byId = new Map<string, CsvSchema>();
      for (const s of allSchemas) byId.set(s.id, s);
      for (const s of loadedSchemas) byId.set(s.id, s);
      setSchemas([...byId.values()]);
    })();
    return () => { cancelled = true; };
  }, [aktenzeichen, storage.idb]);

  const groups: DisplayGroup[] = useMemo(() => {
    if (!antrag) return [];
    const rows = buildDisplayRows(antrag);
    return groupDisplayRows(rows, schemas);
  }, [antrag, schemas]);

  if (!antrag) {
    return (
      <div className="py-6 text-[13px] text-[var(--tf-text-tertiary)]">
        Antrag {aktenzeichen} nicht gefunden.
      </div>
    );
  }

  const vorhabenInhalt = strOrNull(findFieldValue(antrag, [
    'vb_inhalt', 'vb inhalt', 'vorhaben_inhalt', 'vorhabeninhalt', 'beschreibung', 'kurzbeschreibung',
  ]));

  return (
    <>
      {/* Top 2-col area: Vorhaben-Inhalt links, Eckdaten rechts. */}
      <div className="@container">
        <div className="grid grid-cols-1 @3xl:grid-cols-[minmax(0,1fr)_320px] gap-6">
          <div className="min-w-0">
            {vorhabenInhalt ? (
              <>
                <h3 className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-2">
                  Vorhaben-Inhalt
                </h3>
                <div
                  className="rounded-[var(--tf-radius)] p-4 text-[13px] leading-relaxed text-[var(--tf-text)] whitespace-pre-wrap"
                  style={{ background: 'var(--tf-bg-secondary)' }}
                >
                  {vorhabenInhalt}
                </div>
              </>
            ) : null}
          </div>
          <div className="min-w-0">
            <EckdatenCard antrag={antrag} />
          </div>
        </div>
      </div>

      <SectionDivider>
        <KlassifikationPills antrag={antrag} />
      </SectionDivider>

      <SectionDivider>
        <AlleFelderSection
          groups={groups}
          schemas={schemas}
          sourceNames={sourceNames}
          historyCounts={historyCounts}
          onOpenHistory={setHistoryField}
        />
      </SectionDivider>

      <SectionDivider>
        <NetzwerkMitgliederSection aktenzeichen={aktenzeichen} onOpenAntrag={onOpenAntrag} />
      </SectionDivider>

      <SectionDivider>
        <AntragDokumenteSection aktenzeichen={aktenzeichen} variant="wichtig" preview />
      </SectionDivider>

      <SectionDivider>
        <AntragDokumenteSection aktenzeichen={aktenzeichen} variant="sonstige" />
      </SectionDivider>

      <FieldHistoryModal aktenzeichen={aktenzeichen} feld={historyField} onClose={() => setHistoryField(null)} />
    </>
  );
}

function SectionDivider({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div
      className="mt-6 pt-6 empty:hidden empty:mt-0 empty:pt-0"
      style={{ borderTop: '0.5px solid var(--tf-border)' }}
    >
      {children}
    </div>
  );
}
