/**
 * Vorschlag-Banner fuer Initial-Erkennung "aktive vs. inaktive MAs".
 *
 * Erscheint nur wenn `shouldShowAktivVorschlag(mitarbeiter) === true`,
 * d.h. alle MAs sind noch auf `aktiv: true` (frisches Setup oder Migration).
 * Session-only dismissable — bei naechstem Page-Load wieder sichtbar bis
 * "Uebernehmen" gedrueckt wurde (was naturgemaess >=1 MA auf inaktiv setzt
 * und die Bedingung damit dauerhaft erfuellt).
 */
import type { AktivDetectionResult } from '../../services/aktiv-detection';

interface Props {
  detection: AktivDetectionResult;
  referenzJahr: number;
  busy?: boolean;
  onUebernehmen: () => void | Promise<void>;
  onManuell: () => void;
  onSpaeter: () => void;
}

export function AktivVorschlagBanner({
  detection, referenzJahr, busy, onUebernehmen, onManuell, onSpaeter,
}: Props): React.ReactElement {
  const { aktivCount, inaktivCount, ohneKuerzelCount } = detection;
  return (
    <div
      className="rounded-[12px] p-4 mb-3 flex flex-col gap-2"
      style={{ border: '0.5px solid var(--tf-primary)', background: 'var(--tf-primary-soft, var(--tf-bg-secondary))' }}
    >
      <div className="text-[13px] font-medium text-[var(--tf-text)]">
        Aktiv-Status aus {referenzJahr}-Anträgen ableiten?
      </div>
      <div className="text-[12px] text-[var(--tf-text-secondary)] flex flex-col gap-0.5">
        <span>· <strong>{aktivCount}</strong> {aktivCount === 1 ? 'MA hat' : 'MAs haben'} mindestens einen Antrag in {referenzJahr} → als aktiv vorgeschlagen</span>
        <span>· <strong>{inaktivCount}</strong> {inaktivCount === 1 ? 'MA hat' : 'MAs haben'} keinen Antrag in {referenzJahr} → als inaktiv vorgeschlagen (Profile bleiben erhalten, nur aus UI + Matching ausgeblendet)</span>
        {ohneKuerzelCount > 0 && (
          <span className="text-[var(--tf-text-tertiary)]">· {ohneKuerzelCount} MAs ohne aufgelöstes Kürzel — Status unverändert</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2 mt-1">
        <button
          type="button"
          onClick={() => void onUebernehmen()}
          disabled={busy}
          className="px-3 py-1.5 rounded-md text-[12px] font-medium cursor-pointer disabled:opacity-50"
          style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
        >
          {busy ? 'Übernehme…' : 'Übernehmen'}
        </button>
        <button
          type="button"
          onClick={onManuell}
          disabled={busy}
          className="px-3 py-1.5 rounded-md text-[12px] cursor-pointer disabled:opacity-50"
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          Manuell setzen
        </button>
        <button
          type="button"
          onClick={onSpaeter}
          disabled={busy}
          className="px-3 py-1.5 rounded-md text-[12px] cursor-pointer text-[var(--tf-text-secondary)] disabled:opacity-50"
        >
          Später
        </button>
      </div>
    </div>
  );
}
