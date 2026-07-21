/**
 * dev-Panel: Substanz-Smoke gegen die Kontrast-Fixtures.
 *
 * Ein Node-Script kann diese Messung nicht leisten — die interne KI hängt an der
 * Streamlit-Bridge (`window.open`/`postMessage`) und ist damit browser-gebunden.
 * Deshalb läuft der Smoke hier, gegen genau das Modell, das später auch die
 * echten Anträge liest.
 *
 * Die interessante Zeile ist die SAUBERE Fassung: findet das Modell dort einen
 * Widerspruch, ist der Check unbrauchbar, egal wie gut er die drei manipulierten
 * Fassungen trifft. Deshalb steht die Falsch-Positiv-Kontrolle eigens im Kopf.
 *
 * Rein darstellend; die Messung selbst liegt in `substanz/smoke-runner.ts`.
 */
import { Button } from '@/components/ui/button';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { MAP_INFOGRAFIK_SKILL } from '@/core/services/skills';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useState } from 'react';
import type { MapChecklistenItem } from '../checkliste/typen';
import { laufeSubstanzSmoke, type SmokeReport } from '../substanz/smoke-runner';

export function SubstanzSmokePanel({
  skalaItems,
}: {
  /**
   * Bewertungsgrundlage der Zweitmeinung — als Prop von `PruefBlatt`, NICHT aus
   * dem Store gelesen: der Smoke-Pfad darf nichts laden (Konventions-Test
   * `faehrt den Substanz-Smoke nur gegen fiktive Fixtures`).
   */
  skalaItems: readonly MapChecklistenItem[];
}): React.ReactElement {
  const bridge = useAIBridge();
  const [report, setReport] = useState<SmokeReport | null>(null);

  // Pitfall #15: `useAsyncAction` statt `void starte()` — der Transport-Getter
  // wirft bei falscher Transport-Klasse (Pitfall #30), und diese Rejection darf
  // unter `file://` nicht still in einer geschlossenen Console landen.
  const smoke = useAsyncAction(async () => {
    setReport(null);
    // Dokument-tragender Lauf → nur interner Transport.
    const transport = bridge.getTransportForSkillRun(MAP_INFOGRAFIK_SKILL);
    setReport(await laufeSubstanzSmoke(transport, skalaItems));
  });

  const laeuft = smoke.busy;
  const fehler = smoke.error;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
        Fährt vier fiktive Vorhabensbeschreibungen gegen dieselbe fiktive Einreichung:
        drei mit je einer eingebauten Abweichung, eine saubere. Nur wenn die saubere
        Fassung <strong>nichts</strong> meldet, ist der Check brauchbar.
      </p>

      <div className="flex items-center gap-3">
        <Button variant="primary" size="sm" disabled={laeuft} onClick={() => smoke.run()}>
          {laeuft ? 'Läuft …' : 'Smoke starten'}
        </Button>
        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          {laeuft
            ? 'Vier Läufe nacheinander — die Bridge verarbeitet einen nach dem anderen.'
            : 'Vier interne Läufe · nichts wird gespeichert'}
        </span>
      </div>

      {fehler != null && (
        <div
          className="rounded px-3 py-2 text-[12.5px]"
          style={{ background: 'color-mix(in srgb, var(--tf-danger-text) 10%, var(--tf-bg))' }}
        >
          <p className="text-[var(--tf-text)] font-medium">Smoke nicht gestartet</p>
          <p className="text-[var(--tf-text-secondary)] mt-0.5">{fehler}</p>
        </div>
      )}

      {report != null && (
        <>
          <div
            className="rounded px-3 py-2 text-[12.5px] flex items-start gap-2"
            style={{
              background: report.falschPositivKontrolle
                ? 'color-mix(in srgb, var(--tf-success-text) 10%, var(--tf-bg))'
                : 'color-mix(in srgb, var(--tf-danger-text) 10%, var(--tf-bg))',
            }}
          >
            {report.falschPositivKontrolle
              ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--tf-success-text)' }} />
              : <XCircle size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--tf-danger-text)' }} />}
            <span className="text-[var(--tf-text)]">
              Falsch-Positiv-Kontrolle {report.falschPositivKontrolle ? 'bestanden' : 'NICHT bestanden'}
              {' · '}
              {report.ergebnisse.filter(e => e.bestanden).length} von {report.ergebnisse.length} Fixtures
              wie erwartet
              {' · Zweitmeinung '}
              {report.zweitmeinungKontrolle ? 'überall vollständig' : 'nicht überall vollständig'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px] border-collapse">
              <thead>
                <tr className="text-left text-[11px] text-[var(--tf-text-tertiary)] uppercase tracking-wide">
                  <th className="py-1.5 pr-3 font-medium">Fixture</th>
                  <th className="py-1.5 pr-3 font-medium">Erwartet</th>
                  <th className="py-1.5 pr-3 font-medium">Gefunden</th>
                  <th className="py-1.5 pr-3 font-medium">Zweitmeinung</th>
                  <th className="py-1.5 font-medium">Ergebnis</th>
                </tr>
              </thead>
              <tbody>
                {report.ergebnisse.map(e => (
                  <tr key={e.id} style={{ borderTop: '0.5px solid var(--tf-border)' }}>
                    <td className="py-2 pr-3 align-top">
                      <span className="text-[var(--tf-text)]">{e.label}</span>
                      <span className="block text-[10.5px] text-[var(--tf-text-tertiary)] mt-0.5">
                        {e.manipulation}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-[var(--tf-text-secondary)] align-top">{e.erwartet}</td>
                    <td className="py-2 pr-3 align-top">
                      {e.fehler != null
                        ? <span style={{ color: 'var(--tf-danger-text)' }}>{e.fehler}</span>
                        : e.gefunden.length === 0
                          ? <span className="text-[var(--tf-text-secondary)]">kein Widerspruch</span>
                          : (
                            <ul className="flex flex-col gap-1">
                              {e.gefunden.map((w, i) => (
                                <li key={i} className="text-[var(--tf-text-secondary)]">
                                  <span className="font-mono text-[10.5px]">{w.art}</span>
                                  {' — '}„{w.fakt}" ↔ „{w.aussageImText}"
                                </li>
                              ))}
                            </ul>
                          )}
                      <span className="block text-[10.5px] text-[var(--tf-text-tertiary)] mt-0.5">
                        {e.unschaerfeAnzahl} Unschärfe-Begriffe
                      </span>
                    </td>
                    <td className="py-2 pr-3 align-top">
                      <span className="text-[var(--tf-text-secondary)]">
                        {e.zweitmeinung.length} von {skalaItems.length} Kategorien
                        {e.zweitmeinungVollstaendig ? ' · vollständig' : ' · unvollständig'}
                      </span>
                      {/* Gold-Abgleich ist eine Kurator-Meinung, kein Sollwert —
                          er faerbt deshalb nichts und geht in kein Ergebnis ein. */}
                      {e.goldAbgleich.length > 0 && (
                        <ul className="flex flex-col gap-0.5 mt-1">
                          {e.goldAbgleich.map(g => (
                            <li key={g.itemId} className="text-[10.5px] text-[var(--tf-text-tertiary)]">
                              {g.itemId}: Gold {g.gold} · KI {g.ki ?? '—'}
                              {g.abstand === null
                                ? ''
                                : g.abstand === 0
                                  ? ' · Treffer'
                                  : g.abstand === 1 ? ' · ±1' : ` · ${g.abstand} Stufen`}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="py-2 align-top">
                      <span style={{
                        color: e.bestanden
                          ? 'var(--tf-success-text)'
                          : 'var(--tf-danger-text)',
                      }}>
                        {e.bestanden ? 'bestanden' : 'abweichend'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
