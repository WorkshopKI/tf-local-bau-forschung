/**
 * Anonymisierungs-Sektion im Anfrage-Detail: lädt den (registry-)Skill, prüft
 * dessen Freischaltung (`aktiv`) und fährt den internen Anonymisierungs-Lauf.
 * Zeigt danach die anonyme Version + die Mapping-Tabelle — letztere klar als
 * „verlässt das System nicht" gelabelt (lebt nur lokal in IndexedDB).
 *
 * Der editierbare Review + der guard-gated Export folgen in Phase 6
 * (ReviewEditor); hier ist die Vorschau read-only.
 */
import { useEffect, useState } from 'react';
import { ShieldCheck, Lock } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { loadSkillRegistry, getSkillById, type SkillRecord } from '@/core/services/skills';
import {
  ANFRAGE_ANONYMISIEREN_SKILL,
  ANFRAGE_ANONYMISIEREN_SKILL_ID,
} from '@/core/services/skills/registry/anfrage-anonymisieren.seed';
import { runAnonymisierung, istAnonymisiererAktiv } from './services/anonymisierung';
import { useAnfragenStore } from './store';
import { statusErreicht } from './status';
import type { Anfrage } from './types';

interface Props {
  anfrage: Anfrage;
}

export function AnfrageAnonymisierung({ anfrage }: Props): React.ReactElement {
  const storage = useStorage();
  const bridge = useAIBridge();
  const upsert = useAnfragenStore(s => s.upsert);
  const [skill, setSkill] = useState<SkillRecord | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded = await loadSkillRegistry(storage);
      if (cancelled) return;
      setSkill(getSkillById(loaded.file, ANFRAGE_ANONYMISIEREN_SKILL_ID) ?? ANFRAGE_ANONYMISIEREN_SKILL);
    })();
    return () => { cancelled = true; };
  }, [storage]);

  const aktiv = istAnonymisiererAktiv(skill);
  const schonAnonymisiert = statusErreicht(anfrage.status, 'anonymisiert');

  const anonymisieren = useAsyncAction(async () => {
    if (!skill) return;
    const { anonymisiertMd, mapping } = await runAnonymisierung(bridge, skill, anfrage.originalMd);
    await upsert({ ...anfrage, anonymisiertMd, mapping, status: 'anonymisiert' }, storage);
  });

  const kannLaufen = aktiv && !!anfrage.originalMd.trim();

  return (
    <section className="mt-5">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 className="text-[12px] font-medium text-[var(--tf-text-secondary)] flex items-center gap-1.5">
          <ShieldCheck size={13} /> Anonymisierung
        </h3>
        <button
          type="button"
          onClick={() => anonymisieren.run()}
          disabled={!kannLaufen || anonymisieren.busy}
          className="text-[12px] px-3 py-1.5 rounded-[var(--tf-radius)] bg-[var(--tf-text)] text-[var(--tf-bg)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-opacity"
        >
          {anonymisieren.busy ? 'Anonymisiere…' : schonAnonymisiert ? 'Erneut anonymisieren' : 'Anonymisieren'}
        </button>
      </div>

      {skill && !aktiv && (
        <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mb-2 flex items-center gap-1.5">
          <Lock size={12} /> Der Anonymisierungs-Skill ist noch nicht freigeschaltet (Recall-Gate ausstehend).
        </p>
      )}
      {anonymisieren.error && (
        <div className="text-[12px] text-[var(--tf-danger-text)] mb-2">Fehler: {anonymisieren.error}</div>
      )}

      {schonAnonymisiert && (
        <>
          <div className="text-[12.5px] text-[var(--tf-text)] whitespace-pre-wrap rounded-[var(--tf-radius)] bg-[var(--tf-bg-secondary)] p-3 max-h-[35vh] overflow-y-auto">
            {anfrage.anonymisiertMd || <span className="text-[var(--tf-text-tertiary)]">— leer —</span>}
          </div>

          <div className="mt-3">
            <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mb-1.5 flex items-center gap-1.5">
              <Lock size={12} /> Mapping ({anfrage.mapping.length}) — verlässt das System nicht (nur lokal gespeichert).
            </p>
            {anfrage.mapping.length > 0 && (
              <div className="rounded-[var(--tf-radius)] border border-[var(--tf-border)] overflow-hidden">
                <table className="w-full text-[11.5px]">
                  <thead>
                    <tr className="text-[var(--tf-text-tertiary)] bg-[var(--tf-bg-secondary)]">
                      <th className="text-left font-normal px-2 py-1">Platzhalter</th>
                      <th className="text-left font-normal px-2 py-1">Original</th>
                      <th className="text-left font-normal px-2 py-1">Typ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {anfrage.mapping.map((m, i) => (
                      <tr key={`${m.platzhalter}-${i}`} className="border-t border-[var(--tf-border)]">
                        <td className="px-2 py-1 font-mono text-[var(--tf-text)]">{m.platzhalter}</td>
                        <td className="px-2 py-1 text-[var(--tf-text)]">{m.original}</td>
                        <td className="px-2 py-1 text-[var(--tf-text-tertiary)]">{m.typ}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
