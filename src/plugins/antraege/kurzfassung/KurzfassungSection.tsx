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
import { Loader2, SlidersHorizontal, X } from 'lucide-react';
import { DokumentAufnahme } from '@/core/components/DokumentAufnahme';
import { KonvertierungReviewDialog } from '@/core/components/KonvertierungReviewDialog';
import { maxConversionLevel } from '@/core/services/converter';
import { shouldShowVersionHint } from '@/core/services/skill-tweaks';
import type { Antrag } from '@/core/services/csv/types';
import { useKurzfassung } from './useKurzfassung';
import { ReviewCard } from './ReviewCard';
import { TweakEditor } from './TweakEditor';
import { VorlageDialog } from './VorlageDialog';
import type { KurzfassungContext } from './types';

const BTN_PRIMARY = 'px-4 py-2 rounded-[8px] text-[13px] bg-[var(--tf-text)] text-[var(--tf-bg)] hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed';

export function KurzfassungSection({ ctx }: { ctx: KurzfassungContext }): React.ReactElement {
  const ctrl = useKurzfassung(ctx);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [ersetzen, setErsetzen] = useState(false);
  const [tweakOpen, setTweakOpen] = useState(false);
  const { record, tweak, skill } = ctrl;
  const freigegeben = record?.status === 'freigegeben';
  const vbDok = ctrl.vbDokument;
  const vbLvl = maxConversionLevel(vbDok?.conversion);
  const vbWarnung = vbDok?.conversion?.warnings.find(w => w.level === 'warnung')?.message ?? '';

  // User-Tweaks v2: Chip nur wenn Tweak aktiv UND nicht leer; Versions-Hinweis bei Skill-Update.
  const tweakEffektiv = !!(tweak?.aktiv && (tweak.stilHinweise.trim() || tweak.beispielFormulierungen.trim()));
  const zeigeVersionHinweis = !!skill && shouldShowVersionHint(tweak, skill.version);

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
        {tweakEffektiv && (
          <span className="inline-flex items-center gap-1.5 text-[10.5px] px-2 py-1 rounded-full border-[0.5px] border-[var(--tf-border)] text-[var(--tf-text-secondary)] whitespace-nowrap">
            <SlidersHorizontal size={11} className="text-[var(--tf-text-tertiary)]" />
            persönlicher Stil
          </span>
        )}
        <span className="flex-1" />
        {record && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--tf-text-tertiary)] whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'hsl(145,60%,42%)' }} />
            {record.modell} · lokal
          </span>
        )}
      </div>

      {/* Versions-Hinweis (neutral, NICHT warnfarben) bei Kurator-Update des Skills */}
      {zeigeVersionHinweis && skill && tweak && (
        <div className="mt-2 mb-1 flex items-center gap-2.5 rounded-[8px] px-3 py-2 bg-[var(--tf-bg-secondary)] border-[0.5px] border-[var(--tf-border)]">
          <span className="text-[12px] leading-[1.5] text-[var(--tf-text-secondary)]">
            Der Skill wurde vom Kurator aktualisiert (<span className="font-mono text-[var(--tf-text)]">v{tweak.angelegtFuerSkillVersion} → v{skill.version}</span>). Ihr persönlicher Stil bleibt aktiv — kurz prüfen?
          </span>
          <button type="button" onClick={() => setTweakOpen(true)} className="text-[12px] text-[var(--tf-primary)] hover:underline whitespace-nowrap">Ansehen</button>
          <button
            type="button"
            onClick={ctrl.dismissVersionHint}
            aria-label="Hinweis schließen"
            className="flex-shrink-0 w-[22px] h-[22px] inline-flex items-center justify-center rounded-[5px] text-[var(--tf-text-tertiary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text-secondary)]"
          >
            <X size={13} />
          </button>
        </div>
      )}

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
            onUebernehmen={ctrl.uebernehmen}
            onOpenTweak={() => setTweakOpen(true)}
          />
          <VorlageDialog
            open={dialogOpen}
            antrag={mappingAntrag}
            finalerText={record.finalerText}
            onClose={() => setDialogOpen(false)}
          />
        </>
      ) : ctrl.vbVorhanden ? (
        ersetzen ? (
          <div className="py-2">
            <p className="text-[13px] text-[var(--tf-text-secondary)] mb-3">
              Neue Vorhabensbeschreibung hochladen — die neueste ersetzt die bisherige für die Kurzfassung.
            </p>
            <DokumentAufnahme
              relationTag={ctx.key}
              knownIds={ctx.knownIds}
              onIngested={() => { ctrl.refreshVb(); setErsetzen(false); }}
            />
            <button type="button" onClick={() => setErsetzen(false)} className="mt-2 text-[12px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)]">
              Abbrechen
            </button>
          </div>
        ) : (
          <div className="py-2">
            <p className="text-[13px] text-[var(--tf-text-secondary)] mb-2">
              Vorhabensbeschreibung erkannt. Die Kurzfassung wird KI-gestützt daraus erstellt.
            </p>
            {vbDok && (
              <div className="mb-3 flex items-center gap-2 flex-wrap text-[11.5px] text-[var(--tf-text-tertiary)]">
                <span className="font-mono truncate max-w-[260px]" title={vbDok.filename}>{vbDok.filename}</span>
                <span>·</span>
                <button type="button" onClick={() => setReviewOpen(true)} className="text-[var(--tf-primary)] hover:underline">Konvertierung prüfen</button>
                <span>·</span>
                <button type="button" onClick={() => setErsetzen(true)} className="hover:text-[var(--tf-text-secondary)]">VB ersetzen</button>
              </div>
            )}
            {vbLvl === 'warnung' && (
              <div className="mb-3 rounded-[8px] px-3 py-2 text-[12px] text-[var(--tf-warning-text)] bg-[var(--tf-warning-bg)]">
                ⚠ Bei der Konvertierung gab es ein Problem — bitte „Konvertierung prüfen"{vbWarnung ? `: ${vbWarnung}` : '.'}
              </div>
            )}
            {vbLvl === 'hinweis' && (
              <div className="mb-3 text-[11.5px] text-[var(--tf-warning-text)]">
                Hinweise zur Konvertierung vorhanden — siehe „Konvertierung prüfen".
              </div>
            )}
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
        )
      ) : (
        <div className="py-2">
          <p className="text-[13px] text-[var(--tf-text-secondary)] mb-3">
            Für die Kurzfassung wird die Vorhabensbeschreibung (VB) des Verbundes benötigt. Legen Sie sie hier ab —
            das Förderkennzeichen wird aus dem Dateinamen erkannt.
          </p>
          <DokumentAufnahme relationTag={ctx.key} knownIds={ctx.knownIds} onIngested={ctrl.refreshVb} />
        </div>
      )}

      {vbDok && (
        <KonvertierungReviewDialog
          open={reviewOpen}
          filename={vbDok.filename}
          format={vbDok.format}
          pages={vbDok.pages}
          markdown={vbDok.markdown}
          report={vbDok.conversion}
          onClose={() => setReviewOpen(false)}
        />
      )}

      {tweakOpen && skill && (
        <TweakEditor
          skillVersion={skill.version}
          regeln={ctrl.regeln}
          tweak={tweak}
          onClose={() => setTweakOpen(false)}
          onSave={ctrl.saveTweak}
          onRemove={ctrl.removeTweak}
        />
      )}
    </div>
  );
}
