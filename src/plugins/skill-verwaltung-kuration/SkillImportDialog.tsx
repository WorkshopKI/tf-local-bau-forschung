/**
 * Import-Dialog für ein Skill-Bündel (.json). Wählt eine Datei, validiert sie via
 * `parseSkillBundle`, zeigt eine Vorschau inkl. Konflikt-Hinweis und übernimmt das
 * Bündel via `importSkillBundle` + persist. Kanonischer `Dialog` (kein Raw-Modal).
 */
import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import {
  parseSkillBundle,
  importSkillBundle,
  type SkillBundleJson,
  type SkillRegistryFile,
} from '@/core/services/skills';

interface SkillImportDialogProps {
  file: SkillRegistryFile;
  persist: (next: SkillRegistryFile) => Promise<void>;
  onClose: () => void;
  onImported?: (skillId: string) => void;
}

export function SkillImportDialog({ file, persist, onClose, onImported }: SkillImportDialogProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [bundle, setBundle] = useState<SkillBundleJson | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dateiName, setDateiName] = useState<string | null>(null);

  const konflikt = bundle ? file.skills.some(s => s.id === bundle.skill.id) : false;

  const onPick = async (f: File | undefined): Promise<void> => {
    if (!f) return;
    setDateiName(f.name);
    setParseError(null);
    setBundle(null);
    try {
      const parsed = parseSkillBundle(JSON.parse(await f.text()));
      if (!parsed) { setParseError('Keine gültige Skill-Bündel-Datei.'); return; }
      setBundle(parsed);
    } catch {
      setParseError('Datei ist kein gültiges JSON.');
    }
  };

  const doImport = useAsyncAction(async () => {
    if (!bundle) return;
    const res = importSkillBundle(file, bundle, { newId: () => crypto.randomUUID() });
    await persist(res.file);
    onImported?.(res.importedSkillId);
  }, { onSuccess: onClose });

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      title="Skill-Bündel importieren"
      description="Lädt einen Skill samt zugeordneten Regeln aus einer .json-Datei. Antragsdaten sind nie enthalten."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button
            variant="primary"
            disabled={!bundle}
            loading={doImport.busy}
            onClick={() => { void doImport.run(); }}
          >
            Importieren
          </Button>
        </>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={e => { void onPick(e.target.files?.[0]); }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 text-[13px] px-4 py-3 rounded-[8px] border-[0.5px] border-dashed border-[var(--tf-border-hover)] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]"
      >
        <Upload size={14} /> {dateiName ?? 'Datei wählen (.json)'}
      </button>
      {parseError && (
        <div className="rounded p-2.5 text-[12px] mt-3" style={{ background: 'var(--tf-danger-bg)', color: 'var(--tf-danger-text)' }}>⚠ {parseError}</div>
      )}
      {bundle && (
        <div className="mt-4 rounded-[8px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg-secondary)] px-3.5 py-3">
          <div className="text-[13.5px] font-medium text-[var(--tf-text)]">{bundle.skill.name}</div>
          {bundle.skill.beschreibung && <div className="text-[12px] text-[var(--tf-text-secondary)] mt-0.5">{bundle.skill.beschreibung}</div>}
          <div className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-1.5">
            {bundle.regeln.length} {bundle.regeln.length === 1 ? 'Regel' : 'Regeln'} im Bündel
          </div>
          {konflikt && (
            <div className="mt-2 text-[11.5px] text-[var(--tf-warning-text)]">
              Ein Skill mit dieser ID existiert bereits — der Import wird als Kopie („(importiert)") angelegt.
            </div>
          )}
        </div>
      )}
      {doImport.error && (
        <div className="rounded p-2.5 text-[12px] mt-3" style={{ background: 'var(--tf-danger-bg)', color: 'var(--tf-danger-text)' }}>⚠ {doImport.error}</div>
      )}
    </Dialog>
  );
}
