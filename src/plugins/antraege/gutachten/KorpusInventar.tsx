/**
 * Dokument-Inventar des Gutachtens: zeigt ALLE Dokumente des Verbundes, welches davon
 * die maßgebliche Vorhabensbeschreibung ist und welche im KI-Kontext liegen.
 *
 * Warum es das gibt: die Aufnahmefläche nimmt beliebig viele Dateien entgegen, der
 * Gutachten-Pfad las aber genau eine — und die Seite zeigte auch nur diese eine an.
 * Wer fünf Dokumente ablegte, sah danach eins und hatte keinen Weg herauszufinden,
 * was mit den anderen passiert war. Der Kopf beantwortet das jetzt in einer Zeile
 * („5 Dokumente · 1 im Gutachten-Kontext"), noch bevor man aufklappt.
 */
import React, { useState } from 'react';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { typLabelFuerDokument } from '@/core/components/dokumentAufnahmeFkz';
import { misseKorpus } from '../dokumentKorpus';
import { zaehleAufgenommen, type KorpusKandidat } from './korpusAuswahl';
import type { GutachtenKorpus } from './korpusQuelle';
import type { GutachtenQuellen } from './useGutachtenQuellen';

interface Props {
  quellen: GutachtenKorpus;
  ctrl: GutachtenQuellen;
  /** Zeichen-Obergrenze des Kontextfensters (`useVbCharCap`). */
  vbCap: number;
  /** Läuft gerade eine Generierung? Dann keine Quellen-Änderung zulassen. */
  busy: boolean;
  /** „Konvertierung prüfen" für ein Dokument öffnen. */
  onKonvertierungPruefen: (docId: string) => void;
  /** „VB ersetzen" — öffnet die Aufnahmefläche. */
  onVbErsetzen: () => void;
}

const zahl = (n: number): string => n.toLocaleString('de-DE');

export function KorpusInventar({
  quellen, ctrl, vbCap, busy, onKonvertierungPruefen, onVbErsetzen,
}: Props): React.ReactElement | null {
  const { inventar, auswahl, vbDocId, vbMehrdeutig, sammelHinweis } = quellen;
  // Aufgeklappt, wenn eine Entscheidung ansteht — sonst wäre die Frage versteckt.
  const [offen, setOffen] = useState(sammelHinweis || vbMehrdeutig);

  const waehleVb = useAsyncAction(async (docId: string) => { await ctrl.vbWaehlen(docId); });
  const toggle = useAsyncAction(async (docId: string, an: boolean) => { await ctrl.toggleAufnahme(docId, an); });
  const alle = useAsyncAction(async () => { await ctrl.alleAufnehmen(); });
  const ablehnen = useAsyncAction(async () => { await ctrl.hinweisAblehnen(); });

  const gesperrt = busy || waehleVb.busy || toggle.busy || alle.busy || ablehnen.busy;
  const { imKorpus, gesamt } = zaehleAufgenommen(inventar, auswahl.aufgenommen, vbDocId);
  const mass = misseKorpus(quellen.markdown, vbCap);
  const fehler = waehleVb.error ?? toggle.error ?? alle.error ?? ablehnen.error;

  if (inventar.length === 0) return null; // Ordner-Fallback ohne IDB-Dokumente

  const aufgenommen = new Set(auswahl.aufgenommen);
  const zusatzZahl = inventar.filter(k => k.docId !== vbDocId).length;

  return (
    <div className="mb-4 rounded-[8px] border-[0.5px] border-[var(--tf-border)]">
      <button
        type="button"
        onClick={() => setOffen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <span className="text-[11px] text-[var(--tf-text-tertiary)]">{offen ? '▾' : '▸'}</span>
        <span className="text-[12.5px] text-[var(--tf-text)]">Dokumente des Verbundes</span>
        <span className="ml-auto text-[11.5px] text-[var(--tf-text-tertiary)]">
          {gesamt} {gesamt === 1 ? 'Dokument' : 'Dokumente'} · {imKorpus} im Gutachten-Kontext
        </span>
      </button>

      {/* Der Hinweis steht AUSSERHALB von `offen` — eine eingeklappte Sektion darf
          die offene Frage nicht verstecken. */}
      {sammelHinweis && (
        <div
          className="mx-3 mb-2.5 rounded px-3 py-2 text-[12.5px]"
          style={{ background: 'color-mix(in srgb, var(--tf-primary) 8%, var(--tf-bg))' }}
        >
          <p className="text-[var(--tf-text)]">
            {zusatzZahl} {zusatzZahl === 1 ? 'weiteres Dokument ist' : 'weitere Dokumente sind'} abgelegt,
            aber nicht im Gutachten-Kontext.
          </p>
          <div className="mt-1.5 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => alle.run()}
              disabled={gesperrt}
              className="text-[12px] text-[var(--tf-primary)] hover:underline disabled:opacity-50"
            >
              Alle in den Gutachten-Kontext aufnehmen
            </button>
            <button
              type="button"
              onClick={() => ablehnen.run()}
              disabled={gesperrt}
              className="text-[12px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)] disabled:opacity-50"
            >
              Nur die Vorhabensbeschreibung verwenden
            </button>
          </div>
        </div>
      )}

      {/* Cap-Warnung ebenfalls immer sichtbar: ein still abgeschnittener Kontext ist
          schlimmer als eine fehlende Analyse, weil das Ergebnis vollständig aussieht. */}
      {mass.ueberCap && (
        <div
          className="mx-3 mb-2.5 rounded px-3 py-2 text-[12.5px]"
          style={{ background: 'color-mix(in srgb, var(--tf-warning, #f59e0b) 10%, var(--tf-bg))' }}
        >
          <p className="text-[var(--tf-text)]">
            Der Gutachten-Kontext ergibt {zahl(mass.zeichen)} Zeichen und passt damit nicht
            ins Kontextfenster des Modells ({zahl(mass.cap)}) — er wird für die Analyse gekürzt.
          </p>
          <p className="text-[var(--tf-text-secondary)] mt-0.5">
            Weniger Dokumente aufnehmen, extern kürzen oder in Einstellungen → KI-Assistent
            das Kontextfenster erhöhen.
          </p>
        </div>
      )}

      {fehler && (
        <div className="mx-3 mb-2.5 rounded px-3 py-2 text-[12px] text-[var(--tf-danger-text)] bg-[var(--tf-danger-bg)]">
          {fehler}
        </div>
      )}

      {offen && (
        <div className="px-3 pb-3 flex flex-col gap-1.5">
          {inventar.map(k => (
            <InventarZeile
              key={k.docId}
              kandidat={k}
              istAktiveVb={k.docId === vbDocId}
              vbWaehlbar={vbMehrdeutig}
              imKorpus={aufgenommen.has(k.docId)}
              gesperrt={gesperrt}
              onVbWaehlen={() => waehleVb.run(k.docId)}
              onToggle={an => toggle.run(k.docId, an)}
              onKonvertierungPruefen={() => onKonvertierungPruefen(k.docId)}
              onVbErsetzen={onVbErsetzen}
            />
          ))}
          <p className="mt-1.5 text-[11.5px] text-[var(--tf-text-tertiary)]">
            Gutachten-Kontext: {zahl(mass.zeichen)} von ~{zahl(mass.cap)} Zeichen
          </p>
        </div>
      )}
    </div>
  );
}

interface ZeileProps {
  kandidat: KorpusKandidat;
  istAktiveVb: boolean;
  vbWaehlbar: boolean;
  imKorpus: boolean;
  gesperrt: boolean;
  onVbWaehlen: () => void;
  onToggle: (an: boolean) => void;
  onKonvertierungPruefen: () => void;
  onVbErsetzen: () => void;
}

function InventarZeile({
  kandidat, istAktiveVb, vbWaehlbar, imKorpus, gesperrt,
  onVbWaehlen, onToggle, onKonvertierungPruefen, onVbErsetzen,
}: ZeileProps): React.ReactElement {
  return (
    <div className="flex items-center gap-2 flex-wrap text-[11.5px]">
      {/* Radio-Spalte nur bei mehreren VB-Kandidaten — sonst wäre sie Rauschen.
          Feste Breite, damit die Dateinamen bündig stehen (Pitfall #14). */}
      {vbWaehlbar && (
        <span className="w-[52px] shrink-0">
          {kandidat.vbKandidat ? (
            <button
              type="button"
              onClick={onVbWaehlen}
              disabled={gesperrt || istAktiveVb}
              title={istAktiveVb ? 'Maßgebliche Vorhabensbeschreibung' : 'Als maßgebliche Vorhabensbeschreibung wählen'}
              className="flex items-center gap-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] disabled:hover:text-[var(--tf-text-tertiary)]"
            >
              <span className={istAktiveVb ? 'text-[var(--tf-primary)]' : ''}>{istAktiveVb ? '◉' : '◯'}</span>
              <span className={istAktiveVb ? 'text-[var(--tf-primary)]' : ''}>VB</span>
            </button>
          ) : null}
        </span>
      )}

      <span
        className="font-mono truncate max-w-[300px] text-[var(--tf-text-secondary)]"
        title={kandidat.filename}
      >
        {kandidat.filename}
      </span>
      <span className="text-[var(--tf-text-tertiary)]">{typLabelFuerDokument(kandidat.typ)}</span>
      <span className="text-[var(--tf-text-tertiary)]">{kandidat.zeichen.toLocaleString('de-DE')} Z.</span>

      {istAktiveVb ? (
        <span className="ml-auto flex items-center gap-2">
          <span className="text-[var(--tf-primary)]">im Kontext (Vorhabensbeschreibung)</span>
          <span className="text-[var(--tf-text-tertiary)]">·</span>
          <button type="button" onClick={onKonvertierungPruefen} className="text-[var(--tf-primary)] hover:underline">
            Konvertierung prüfen
          </button>
          <span className="text-[var(--tf-text-tertiary)]">·</span>
          <button
            type="button"
            onClick={onVbErsetzen}
            className="text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)]"
          >
            VB ersetzen
          </button>
        </span>
      ) : (
        <label className="ml-auto flex items-center gap-1.5 cursor-pointer text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)]">
          <input
            type="checkbox"
            checked={imKorpus}
            disabled={gesperrt}
            onChange={e => onToggle(e.target.checked)}
            className="accent-[var(--tf-primary)]"
          />
          ins Gutachten aufnehmen
        </label>
      )}
    </div>
  );
}
