/**
 * Kompakter Metadaten-Streifen im Anfrage-Detail: zeigt die intern getaggten
 * Felder (Antragsart · Themengruppe · Firma · Name) plus Tagging-Status und einen
 * „(Erneut) taggen"-Button. Der KI-Lauf läuft ausschließlich über die interne
 * Bridge (`runMetadatenExtraktion` → `getTransportForSkillRun`, DSGVO-Hardlock);
 * `name`/`firma` sind Klartext-PII und bleiben nur lokal.
 */
import { Tags, RefreshCw, AlertTriangle } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { Button } from '@/components/ui/button';
import { loadSkillRegistry, getSkillById } from '@/core/services/skills';
import {
  ANFRAGE_METADATEN_SKILL,
  ANFRAGE_METADATEN_SKILL_ID,
} from '@/core/services/skills/registry/anfrage-metadaten.seed';
import { useAnfragenStore } from './store';
import { runMetadatenExtraktion } from './services/metadaten';
import type { Anfrage } from './types';

interface Props {
  anfrage: Anfrage;
}

function Feld({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <span className="inline-flex items-baseline gap-1 px-2 py-0.5 rounded-[6px] bg-[var(--tf-bg-secondary)]">
      <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">{label}</span>
      <span className="text-[11.5px] font-medium text-[var(--tf-text)]">{value || '—'}</span>
    </span>
  );
}

export function AnfrageMetadatenStrip({ anfrage }: Props): React.ReactElement {
  const storage = useStorage();
  const bridge = useAIBridge();
  const upsert = useAnfragenStore(s => s.upsert);
  const meta = anfrage.metadaten;

  const taggen = useAsyncAction(async () => {
    const loaded = await loadSkillRegistry(storage);
    const skill = getSkillById(loaded.file, ANFRAGE_METADATEN_SKILL_ID) ?? ANFRAGE_METADATEN_SKILL;
    const m = await runMetadatenExtraktion(bridge, skill, anfrage.originalMd);
    await upsert(
      { ...anfrage, metadaten: { ...m, status: 'getaggt', getaggtAm: new Date().toISOString() } },
      storage,
    );
  });

  const getaggt = meta?.status === 'getaggt';

  return (
    <div className="px-4 py-2 border-t border-[var(--tf-border)] flex items-center flex-wrap gap-2">
      <Tags size={13} className="text-[var(--tf-text-tertiary)] shrink-0" />
      {getaggt && meta ? (
        <>
          <Feld label="Art" value={meta.antragsart} />
          <Feld label="Thema" value={meta.themengruppe} />
          <Feld label="Firma" value={meta.firma} />
          <Feld label="Name" value={meta.name} />
        </>
      ) : meta?.status === 'fehlgeschlagen' ? (
        <span
          className="inline-flex items-center gap-1 text-[11.5px] text-[var(--tf-warning-text)]"
          title={meta.fehler}
        >
          <AlertTriangle size={12} /> Tagging fehlgeschlagen
        </span>
      ) : (
        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          {taggen.busy ? 'Wird getaggt…' : 'Noch nicht getaggt'}
        </span>
      )}

      <span className="flex-1" />

      {taggen.error && (
        <span className="text-[11px] text-[var(--tf-danger-text)]" title={taggen.error}>Fehler</span>
      )}
      <Button
        variant="ghost"
        size="sm"
        icon={RefreshCw}
        loading={taggen.busy}
        disabled={!anfrage.originalMd.trim()}
        onClick={() => taggen.run()}
      >
        {getaggt ? 'Erneut taggen' : 'Taggen'}
      </Button>
    </div>
  );
}
