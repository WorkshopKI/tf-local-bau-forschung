/**
 * Programm-Switcher in der Sidebar.
 *
 * Zeigt das aktive Förderprogramm + Pulldown zum Umschalten zwischen
 * den 1–5 Programmen. Versteckt sich, wenn nur ein Programm existiert
 * (typischer Single-Programm-Fall — kein UI-Lärm).
 *
 * Logik delegiert an `useActiveProgramm`-Store; Persistenz über
 * `UserProfile.activeProgrammId`.
 */

import * as Icons from 'lucide-react';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function ProgrammSwitcher(): React.ReactElement | null {
  const storage = useStorage();
  const { profile, updateProfile } = useProfile();
  const programme = useActiveProgramm(s => s.programme);
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const setActive = useActiveProgramm(s => s.setActive);

  if (programme.length <= 1) return null;
  if (!activeProgrammId) return null;

  const onChange = async (id: string): Promise<void> => {
    await setActive(storage.idb, id, profile ? updateProfile : undefined);
  };

  return (
    <div
      className="px-3 py-2 shrink-0"
      style={{ borderTop: '0.5px solid var(--tf-border)', borderBottom: '0.5px solid var(--tf-border)' }}
    >
      <div className="mb-1 flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]">
        <Icons.FolderTree size={11} className="opacity-60" />
        <span>Programm</span>
      </div>
      <Select value={activeProgrammId} onValueChange={(v) => { void onChange(v); }}>
        <SelectTrigger size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {programme.map(p => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
