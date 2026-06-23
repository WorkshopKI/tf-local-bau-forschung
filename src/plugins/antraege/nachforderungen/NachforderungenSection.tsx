/**
 * Nachforderungen-Sektion auf der Verbund-Detailseite (Feature-Flag
 * `nfNachforderungen`, nur dev). Erzeugt PRO Teilvorhaben einen NF-Entwurf
 * (Verbund-Bausteine einmal + TV-Bausteine je TV), zeigt sie als Karten mit
 * Checks, E-Mail-Entwurf (mailto) und optionalem DOCX-Export. Funktioniert ohne
 * LLM für Anzeige/Export bereits erzeugter Stände; nur die Generierung degradiert.
 *
 * Entwurf ≠ Entscheidung: es wird NICHTS versendet — der Mensch öffnet/prüft/sendet.
 */
import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useCollapsedSection } from '@/core/hooks/useCollapsedSection';
import { DokumentAufnahme } from '@/core/components/DokumentAufnahme';
import type { Antrag } from '@/core/services/csv/types';
import { VorlageDialog } from '../kurzfassung/VorlageDialog';
import type { KurzfassungContext } from '../kurzfassung/types';
import { useNachforderungen, type NfEntwurf } from './useNachforderungen';

const BTN_PRIMARY = 'px-4 py-2 rounded-[8px] text-[13px] bg-[var(--tf-text)] text-[var(--tf-bg)] hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2';
const BTN_SECONDARY = 'px-4 py-2 rounded-[8px] text-[13px] border-[0.5px] border-[var(--tf-border)] text-[var(--tf-text)] bg-[var(--tf-bg)] hover:bg-[var(--tf-bg-secondary)] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2';

export function NachforderungenSection({ ctx }: { ctx: KurzfassungContext }): React.ReactElement {
  const ctrl = useNachforderungen(ctx);
  // Einklappbar (persistiert, Default offen); Body via CSS verstecken statt
  // unmounten, damit der NF-Stand/offene Dialoge erhalten bleiben.
  const [open, toggleOpen] = useCollapsedSection('verbund_nf_collapsed');
  const [dialogTv, setDialogTv] = useState<NfEntwurf | null>(null);

  const dialogAntrag = useMemo<Antrag | null>(() => {
    if (!dialogTv) return null;
    return {
      aktenzeichen: dialogTv.aktenzeichen,
      programm_id: '',
      ...(dialogTv.titel ? { titel: dialogTv.titel } : {}),
      ...(dialogTv.antragsteller ? { antragsteller: dialogTv.antragsteller } : {}),
      _field_sources: {},
      _updated_at: '',
    };
  }, [dialogTv]);

  return (
    <div>
      <div className="flex items-center gap-3.5 mb-4">
        <button type="button" onClick={toggleOpen} aria-expanded={open} className="flex items-center gap-1.5 cursor-pointer">
          <ChevronRight
            size={15}
            className="text-[var(--tf-text-tertiary)] transition-transform duration-200 shrink-0"
            style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
          />
          <span className="text-[16px] font-medium text-[var(--tf-text)]">Nachforderungen</span>
        </button>
        {ctrl.entwuerfe.length > 0 && (
          <span className="text-[12px] text-[var(--tf-text-tertiary)]">{ctrl.entwuerfe.length} Entwürfe</span>
        )}
        <span className="flex-1" />
        {ctrl.vbVorhanden && (
          ctrl.busy ? (
            <button type="button" className={BTN_SECONDARY} onClick={ctrl.stop}>Stopp</button>
          ) : (
            <button
              type="button"
              className={BTN_PRIMARY}
              disabled={ctrl.loading}
              onClick={ctrl.generiereAlle}
              title="Erzeugt für jedes Teilvorhaben einen NF-Entwurf (Gesamtvorhaben-Bausteine einmal + TV-Bausteine je TV)."
            >
              NF-Entwürfe erzeugen
            </button>
          )
        )}
      </div>

      <div className={open ? undefined : 'hidden'}>
      {ctrl.busy && (
        <div className="mb-3 flex items-center gap-2 text-[12px] text-[var(--tf-text-secondary)]">
          <span className="w-3 h-3 rounded-full border-[1.5px] border-[var(--tf-text-tertiary)] border-t-transparent animate-spin" />
          Erzeuge NF-Entwürfe…
        </div>
      )}

      {ctrl.error && (
        <div className="my-2 rounded-[8px] px-3 py-2 text-[12px] text-[var(--tf-danger-text)] bg-[var(--tf-danger-bg)]">{ctrl.error}</div>
      )}

      {ctrl.loading ? (
        <div className="py-3 text-[13px] text-[var(--tf-text-tertiary)]">Laden…</div>
      ) : !ctrl.vbVorhanden ? (
        <div className="py-2">
          <p className="text-[13px] text-[var(--tf-text-secondary)] mb-3">
            Für die Nachforderungen wird die Vorhabensbeschreibung (VB) des Verbundes benötigt. Legen Sie sie hier ab —
            das Förderkennzeichen wird aus dem Dateinamen erkannt.
          </p>
          <DokumentAufnahme relationTag={ctx.key} knownIds={ctx.knownIds} onIngested={ctrl.refreshVb} />
        </div>
      ) : ctrl.entwuerfe.length === 0 ? (
        <p className="text-[13px] text-[var(--tf-text-secondary)]">
          Pro Teilvorhaben wird ein NF-Entwurf aus dem kuratierten Baustein-Katalog erzeugt — die Gesamtvorhaben-Fragen
          erscheinen wortgleich in jedem Entwurf. Es wird nichts versendet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {ctrl.entwuerfe.map(e => (
            <NfEntwurfCard key={e.aktenzeichen} entwurf={e} onExport={() => setDialogTv(e)} />
          ))}
        </div>
      )}

      </div>

      {dialogTv && dialogAntrag && (
        <VorlageDialog
          open
          antrag={dialogAntrag}
          sections={[{ id: 'NF', anker: 'Nachforderungen', finalerText: dialogTv.text }]}
          dateiPrefix="ZIM-Nachforderung"
          onClose={() => setDialogTv(null)}
        />
      )}
    </div>
  );
}

function NfEntwurfCard({ entwurf, onExport }: { entwurf: NfEntwurf; onExport: () => void }): React.ReactElement {
  const fehler = entwurf.checks.filter(c => c.level === 'fehler');
  const hinweise = entwurf.checks.filter(c => c.level === 'hinweis');
  return (
    <div className="rounded-[12px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] px-5 py-4">
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <span className="text-[13px] font-medium text-[var(--tf-text)]">
          {entwurf.titel ?? entwurf.aktenzeichen}
        </span>
        <span className="font-mono text-[11px] text-[var(--tf-text-tertiary)]">{entwurf.aktenzeichen}</span>
        {entwurf.freigabereif ? (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--tf-success-bg)] text-[var(--tf-success-text)]">bereit zur Freigabe</span>
        ) : (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]">Überarbeitung nötig</span>
        )}
        <span className="flex-1" />
        <a
          href={entwurf.mailto}
          className="text-[12px] text-[var(--tf-primary)] hover:underline"
          title="Öffnet einen E-Mail-Entwurf — Empfänger/Anrede ergänzen, prüfen, dann senden."
        >
          ✉ E-Mail-Entwurf
        </a>
        <button type="button" onClick={onExport} className="text-[12px] text-[var(--tf-primary)] hover:underline">
          In Vorlage exportieren
        </button>
      </div>

      {(fehler.length > 0 || hinweise.length > 0) && (
        <div className="mb-2 text-[11.5px] text-[var(--tf-text-tertiary)] flex items-center gap-3">
          {fehler.length > 0 && <span className="text-[var(--tf-danger-text)]">{fehler.length} Fehler: {fehler[0]!.detail ?? fehler[0]!.label}</span>}
          {hinweise.length > 0 && <span>{hinweise.length} Hinweis(e)</span>}
        </div>
      )}

      <div className="text-[12.5px] text-[var(--tf-text-secondary)] whitespace-pre-wrap leading-[1.55] max-h-[280px] overflow-auto rounded-[8px] bg-[var(--tf-bg-secondary)] px-3 py-2">
        {entwurf.text || '— kein Text —'}
      </div>
    </div>
  );
}
