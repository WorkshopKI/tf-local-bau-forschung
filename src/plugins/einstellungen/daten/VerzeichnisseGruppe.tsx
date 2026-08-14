/**
 * Gruppe „Verbundene Verzeichnisse" (Design-Handoff
 * `_design/handoff/einstellungen-zweispaltig`, Screenshot 10).
 *
 * Die Liste der zusätzlich verbundenen Verzeichnisse, die beiden
 * Hinzufügen-Knöpfe (Zugriffsart als Badge am Knopf) und — nur wo verfügbar —
 * die OPFS-Sandbox. Aus `SpeicherTab` herausgelöst (v4.30).
 *
 * Der Abschnitt bleibt auch leer stehen: sein Anker `sec-verzeichnisse` ist
 * seit v4.28 im Suchindex, und ein Sprungziel, das je nach Datenlage fehlt,
 * ist ein toter Treffer.
 */
import { useState } from 'react';
import { Check, Database, FileText, FlaskConical, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListItem } from '@/components/ui/ListItem';
import { useStorage } from '@/core/hooks/useStorage';
import type { DirectoryEntry } from '@/core/types/config';
import { shouldShowOpfsOption } from '@/core/utils/environment';
import { isKuratorFreigeschaltet } from '@/core/modul-freischaltung';
import { SettingsNoteCard } from '../_shared/settings-primitives';
import { SettingsGruppe, SettingsLeer } from '@/components/settings';

const HINT_OPFS =
  'Browser-interner Speicher. Funktioniert in iframes (Preview), erlaubt aber kein Teilen zwischen Nutzern oder Geräten.';

export function VerzeichnisseGruppe(): React.ReactElement {
  const storage = useStorage();
  const [verzeichnisse, setVerzeichnisse] = useState<DirectoryEntry[]>(storage.getDirectories());
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [fehler, setFehler] = useState('');

  const kurator = isKuratorFreigeschaltet();
  const zeigeOpfs = shouldShowOpfsOption();
  const neu = (): void => setVerzeichnisse(storage.getDirectories());

  const hinzufuegen = async (typ: 'documents' | 'data'): Promise<void> => {
    setFehler('');
    const ok = await storage.addDirectory(typ);
    if (ok) neu();
    else setFehler('Verzeichnis konnte nicht verbunden werden. Bitte erneut versuchen.');
  };

  const opfsHinzufuegen = async (typ: 'documents' | 'data' | 'models'): Promise<void> => {
    setFehler('');
    const ok = await storage.addOPFSDirectory(typ);
    if (ok) neu();
    else setFehler('OPFS-Verzeichnis konnte nicht erstellt werden.');
  };

  const entfernen = async (id: string): Promise<void> => {
    await storage.removeDirectory(id);
    neu();
  };

  const speichereLabel = async (): Promise<void> => {
    if (!editId || !editLabel.trim()) return;
    await storage.updateDirectoryLabel(editId, editLabel.trim());
    setEditId(null);
    setEditLabel('');
    neu();
  };

  return (
    <SettingsGruppe
      id="sec-verzeichnisse"
      titel="Verbundene Verzeichnisse"
      rechts={verzeichnisse.length > 0 ? `${verzeichnisse.length} verbunden` : undefined}
    >
      {verzeichnisse.length === 0 ? (
        <SettingsLeer>
          Keine weiteren Verzeichnisse verbunden — die App arbeitet mit den Ordnern oben.
        </SettingsLeer>
      ) : (
        <div className="pt-1">
          {verzeichnisse.map((dir, i) => (
            <ListItem
              key={dir.id}
              icon={dir.type === 'documents'
                ? <FileText size={14} className="text-[var(--tf-text-tertiary)]" />
                : <Database size={14} className="text-[var(--tf-text-tertiary)]" />}
              title={editId === dir.id ? (
                <div className="flex items-center gap-1.5">
                  <input
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    className="px-2 py-0.5 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none"
                    style={{ border: '0.5px solid var(--tf-border)', minWidth: '120px' }}
                    onKeyDown={e => { if (e.key === 'Enter') speichereLabel(); if (e.key === 'Escape') setEditId(null); }}
                    onBlur={speichereLabel}
                    aria-label="Bezeichnung"
                    autoFocus
                  />
                  <button onClick={speichereLabel} className="p-0.5 text-[var(--tf-text-secondary)] cursor-pointer hover:text-[var(--tf-text)]" title="Speichern">
                    <Check size={12} />
                  </button>
                </div>
              ) : dir.label}
              subtitle={dir.folderName ?? ''}
              meta={
                <div className="flex items-center gap-2">
                  <Badge variant={dir.type === 'documents' ? 'info' : 'success'}>
                    {dir.type === 'documents' ? 'Lesen' : 'Lesen + Schreiben'}
                  </Badge>
                  {dir.kind === 'opfs' && (
                    <Badge variant="warning" title="OPFS — lokaler Browser-Storage, kein Teilen zwischen Browsern oder Geräten">
                      Sandbox
                    </Badge>
                  )}
                  {editId !== dir.id && (
                    <button
                      onClick={() => { setEditId(dir.id); setEditLabel(dir.label); }}
                      className="p-1 text-[var(--tf-text-tertiary)] cursor-pointer hover:text-[var(--tf-text)]"
                      title="Umbenennen"
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                  <button
                    onClick={() => entfernen(dir.id)}
                    className="p-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] cursor-pointer"
                    title="Trennen"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              }
              last={i === verzeichnisse.length - 1}
            />
          ))}
        </div>
      )}

      {/* Hinzufügen nur in Setup-fähigen Varianten: sonst ist der Daten-Share fix
          und persönliche Ordner werden beim Start automatisch gesetzt. */}
      {kurator && (
        <div className="flex gap-2 flex-wrap pt-2.5">
          <Button variant="secondary" size="sm" icon={FileText} onClick={() => hinzufuegen('documents')}>
            Dokumentverzeichnis <Badge variant="default">Lesen</Badge>
          </Button>
          <Button variant="secondary" size="sm" icon={Database} onClick={() => hinzufuegen('data')}>
            Datenverzeichnis <Badge variant="default">Lesen + Schreiben</Badge>
          </Button>
        </div>
      )}

      {kurator && zeigeOpfs && (
        <div className="pt-2.5">
          <SettingsNoteCard badge={<Badge variant="warning">Sandbox</Badge>} hint={HINT_OPFS}>
            <span className="inline-flex items-center gap-2 flex-wrap">
              OPFS (Dev/Preview)
              <Button variant="ghost" size="sm" icon={FileText} onClick={() => opfsHinzufuegen('documents')}>Dokumente</Button>
              <Button variant="ghost" size="sm" icon={Database} onClick={() => opfsHinzufuegen('data')}>Daten</Button>
              <Button variant="ghost" size="sm" icon={FlaskConical} onClick={() => opfsHinzufuegen('models')}>Modelle</Button>
            </span>
          </SettingsNoteCard>
        </div>
      )}

      {fehler && <p className="text-[12px] text-[var(--tf-danger-text)] pt-2">{fehler}</p>}
    </SettingsGruppe>
  );
}
