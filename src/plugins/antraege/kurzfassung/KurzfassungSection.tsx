/**
 * Kurzfassung-Sektion auf der **Verbund**-Detailseite (hinter Feature-Flag
 * `gutachtenKurzfassung`). Ein Gutachten/eine Kurzfassung pro Verbund. Drei
 * Zustände:
 *  - „VB fehlt"     → Hinweis + eingebettete Dokumenten-Aufnahmefläche
 *  - „VB vorhanden" → Button „Kurzfassung erstellen"
 *  - Review         → ReviewCard (Entwurf/Freigegeben)
 *
 * Funktioniert ohne LLM: Aufnahme + ein bereits freigegebener Stand + der
 * Vorlagen-Dialog bleiben nutzbar; nur die Generierung degradiert.
 */
import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { DokumentAufnahme } from '@/core/components/DokumentAufnahme';
import type { Antrag } from '@/core/services/csv/types';
import { useKurzfassung } from './useKurzfassung';
import { ReviewCard } from './ReviewCard';
import { VorlageDialog } from './VorlageDialog';
import type { KurzfassungContext } from './types';

const BTN_PRIMARY = 'px-4 py-2 rounded-[8px] text-[13px] bg-[var(--tf-text)] text-[var(--tf-bg)] hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed';

export function KurzfassungSection({ ctx }: { ctx: KurzfassungContext }): React.ReactElement {
  const ctrl = useKurzfassung(ctx);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { record } = ctrl;
  const freigegeben = record?.status === 'freigegeben';

  // Synthetischer „Antrag" als Feld-Quelle für den DOCX-Füller: das Gutachten
  // läuft auf Verbund-Ebene → Verbund-FKZ/Titel/Konsortialführer.
  const mappingAntrag = useMemo<Antrag>(() => ({
    aktenzeichen: ctx.foerderkennzeichen,
    programm_id: '',
    ...(ctx.titel ? { titel: ctx.titel } : {}),
    ...(ctx.antragsteller ? { antragsteller: ctx.antragsteller } : {}),
    _field_sources: {},
    _updated_at: '',
  }), [ctx.foerderkennzeichen, ctx.titel, ctx.antragsteller]);

  return (
    <div>
      {/* Kopf: Titel + Status-Badge + Transport-Anzeige */}
      <div className="flex items-center gap-3 mb-1">
        <span className="text-[14px] font-medium text-[var(--tf-text)]">Kurzfassung (Gutachten)</span>
        {record && (
          freigegeben ? (
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--tf-success-bg)] text-[var(--tf-success-text)]">✓ Freigegeben</span>
          ) : (
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">Entwurf — nicht freigegeben</span>
          )
        )}
        <span className="flex-1" />
        {record && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--tf-text-tertiary)] whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'hsl(145,60%,42%)' }} />
            {record.modell} · lokal
          </span>
        )}
      </div>

      {ctrl.error && (
        <div className="my-2 rounded-[8px] px-3 py-2 text-[12px] text-[var(--tf-danger-text)] bg-[var(--tf-danger-bg)]">
          {ctrl.error}
        </div>
      )}

      {ctrl.loading ? (
        <div className="py-3 text-[13px] text-[var(--tf-text-tertiary)]">Laden…</div>
      ) : record ? (
        <>
          <ReviewCard
            record={record}
            busy={ctrl.busy}
            llmAvailable={ctrl.llmAvailable}
            onModify={ctrl.modify}
            onPruefen={ctrl.pruefen}
            onFreigeben={ctrl.freigeben}
            onVerwerfen={ctrl.verwerfen}
            onStop={ctrl.stop}
            onCreateVorlage={() => setDialogOpen(true)}
          />
          <VorlageDialog
            open={dialogOpen}
            antrag={mappingAntrag}
            finalerText={record.finalerText}
            onClose={() => setDialogOpen(false)}
          />
        </>
      ) : ctrl.vbVorhanden ? (
        <div className="py-2">
          <p className="text-[13px] text-[var(--tf-text-secondary)] mb-3">
            Vorhabensbeschreibung erkannt. Die Kurzfassung wird KI-gestützt daraus erstellt.
          </p>
          {ctrl.busy ? (
            <div className="flex items-center gap-3 text-[13px] text-[var(--tf-text-secondary)]">
              <Loader2 size={14} className="animate-spin" />
              Erstelle Kurzfassung…
              <button type="button" className="text-[12px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)]" onClick={ctrl.stop}>Stopp</button>
            </div>
          ) : (
            <>
              <button
                type="button"
                className={BTN_PRIMARY}
                disabled={ctrl.llmAvailable === false}
                onClick={ctrl.generate}
              >
                Kurzfassung erstellen
              </button>
              {ctrl.llmAvailable === false && (
                <div className="mt-2 text-[11.5px] text-[var(--tf-warning-text)]">
                  KI nicht erreichbar — Generierung derzeit nicht möglich.
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="py-2">
          <p className="text-[13px] text-[var(--tf-text-secondary)] mb-3">
            Für die Kurzfassung wird die Vorhabensbeschreibung (VB) des Verbundes benötigt. Legen Sie sie hier ab —
            das Förderkennzeichen wird aus dem Dateinamen erkannt.
          </p>
          <DokumentAufnahme relationTag={ctx.key} knownFkz={ctx.fkzList} onIngested={ctrl.refreshVb} />
        </div>
      )}
    </div>
  );
}
