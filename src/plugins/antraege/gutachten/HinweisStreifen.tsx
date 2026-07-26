/**
 * EIN Streifen für alle Meldungen eines Abschnitts (Warnung, Chat-Reset,
 * gekürzte VB, Ziel-Fallback, übersprungener Feinschliff, Auto-Retry-Vermerk,
 * Lektorat-Wächter). Vorher standen die als bis zu fünf einzelne Banner
 * übereinander und schoben den eigentlichen Text nach unten.
 *
 * Rendert `null`, wenn nichts anliegt — die Karte bleibt dann bei ihren vier
 * Ebenen. Die Auswahl trifft die reine `abschnittHinweise`.
 */
import { AlertTriangle } from 'lucide-react';
import type { Hinweis } from './abschnittAnzeige';

export function HinweisStreifen({ hinweise }: { hinweise: Hinweis[] }): React.ReactElement | null {
  if (hinweise.length === 0) return null;
  // Amber nur, wenn wirklich etwas zu prüfen ist; reine Provenienz-Information
  // bleibt gedämpft, damit der Streifen nicht dauerhaft nach Problem aussieht.
  const warnend = hinweise.some(h => h.ton === 'hinweis');
  return (
    <div className={`g-hinweise${warnend ? ' warn' : ''}`}>
      {warnend && <AlertTriangle size={13} className="g-hinweise-icon" aria-hidden="true" />}
      <div className="g-hinweise-liste">
        {hinweise.map(h => (
          <div key={h.key} {...(h.titel ? { title: h.titel } : {})}>{h.text}</div>
        ))}
      </div>
    </div>
  );
}
