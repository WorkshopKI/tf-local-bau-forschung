import { useState, useEffect } from 'react';
import { Dialog, Button, TagInput } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { useTags } from '@/core/hooks/useTags';
import { useForschungStore } from './store';
import type { ForschungsVorgang } from './types';

interface ForschungFormProps {
  open: boolean;
  onClose: () => void;
  initialValues?: ForschungsVorgang;
}

const inputStyle = { border: '0.5px solid var(--tf-border)' } as const;
const inputClass = 'w-full px-3 py-2 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)] placeholder:text-[var(--tf-text-tertiary)]';

export function ForschungForm({ open, onClose, initialValues }: ForschungFormProps): React.ReactElement {
  const storage = useStorage();
  const { suggest, addTag } = useTags();
  const { add, update } = useForschungStore();
  const [title, setTitle] = useState('');
  const [foerderprogramm, setFoerderprogramm] = useState('');
  const [foerdersumme, setFoerdersumme] = useState('');
  const [laufzeit, setLaufzeit] = useState('');
  const [projektleiter, setProjektleiter] = useState('');
  const [institution, setInstitution] = useState('');
  const [forschungsgebiet, setForschungsgebiet] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (open && initialValues) {
      setTitle(initialValues.title); setFoerderprogramm(initialValues.foerderprogramm);
      setFoerdersumme(String(initialValues.foerdersumme)); setLaufzeit(initialValues.laufzeit);
      setProjektleiter(initialValues.projektleiter); setInstitution(initialValues.institution);
      setForschungsgebiet(initialValues.forschungsgebiet); setTags(initialValues.tags);
    } else if (open) {
      setTitle(''); setFoerderprogramm(''); setFoerdersumme(''); setLaufzeit('');
      setProjektleiter(''); setInstitution(''); setForschungsgebiet(''); setTags([]);
    }
  }, [open, initialValues]);

  const handleSave = async (): Promise<void> => {
    if (!title.trim()) return;
    tags.forEach(t => addTag(t));
    const data = { title, foerderprogramm, foerdersumme: Number(foerdersumme) || 0, laufzeit, projektleiter, institution, forschungsgebiet, tags };
    if (initialValues) {
      await update({ ...initialValues, ...data }, storage);
    } else {
      await add(data, storage);
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={initialValues ? 'Antrag bearbeiten' : 'Neuer Forschungsantrag'}
      footer={<><Button variant="secondary" onClick={onClose}>Abbrechen</Button><Button disabled={!title.trim()} onClick={handleSave}>Speichern</Button></>}>
      <div className="space-y-3">
        <div className="flex flex-col gap-1"><label className="text-[13px] font-medium text-[var(--tf-text)]">Titel *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Projekttitel" className={inputClass} style={inputStyle} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1"><label className="text-[13px] font-medium text-[var(--tf-text)]">Förderprogramm</label>
            <input value={foerderprogramm} onChange={e => setFoerderprogramm(e.target.value)} className={inputClass} style={inputStyle} /></div>
          <div className="flex flex-col gap-1"><label className="text-[13px] font-medium text-[var(--tf-text)]">Fördersumme (€)</label>
            <input type="number" value={foerdersumme} onChange={e => setFoerdersumme(e.target.value)} className={inputClass} style={inputStyle} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1"><label className="text-[13px] font-medium text-[var(--tf-text)]">Laufzeit</label>
            <input value={laufzeit} onChange={e => setLaufzeit(e.target.value)} placeholder="z.B. 24 Monate" className={inputClass} style={inputStyle} /></div>
          <div className="flex flex-col gap-1"><label className="text-[13px] font-medium text-[var(--tf-text)]">Forschungsgebiet</label>
            <input value={forschungsgebiet} onChange={e => setForschungsgebiet(e.target.value)} className={inputClass} style={inputStyle} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1"><label className="text-[13px] font-medium text-[var(--tf-text)]">Projektleiter</label>
            <input value={projektleiter} onChange={e => setProjektleiter(e.target.value)} className={inputClass} style={inputStyle} /></div>
          <div className="flex flex-col gap-1"><label className="text-[13px] font-medium text-[var(--tf-text)]">Institution</label>
            <input value={institution} onChange={e => setInstitution(e.target.value)} className={inputClass} style={inputStyle} /></div>
        </div>
        <div className="flex flex-col gap-1"><label className="text-[13px] font-medium text-[var(--tf-text)]">Tags</label>
          <TagInput value={tags} onChange={setTags} suggestions={suggest} /></div>
      </div>
    </Dialog>
  );
}
