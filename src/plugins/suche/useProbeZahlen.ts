/**
 * Trefferzahlen an einer Liste von Anfragen — verzögert und in Schüben.
 *
 * Zwei Stellen zeigen dieselbe Zusage: die Vorschlagsliste im Suchfeld
 * ([SearchInput](src/plugins/suche/SearchInput.tsx)) und der Reiter „Stöbern"
 * im Startzustand ([StartStoebern](src/plugins/suche/start/StartStoebern.tsx)).
 * Beide nennen an einem Wert die Zahl, die nach dem Klick auch dasteht — und
 * beide dürfen dafür den Bildschirm nicht anhalten. Die Mechanik steht deshalb
 * EINMAL hier, nicht zweimal nebeneinander.
 *
 * Ein Probelauf kostet gemessen 11 ms über 14 225 Anträge; 25 am Stück wären
 * 274 ms, also ein sichtbarer Hänger. In Schüben von vier bleibt jeder Block
 * unter ~45 ms, und die Zahlen füllen sich von oben nach unten — dort, wo
 * hingesehen wird.
 *
 * **Seit v4.88 gibt es eine zweite Betriebsart** (`sichtbar`). Das Dropdown
 * kappt seine Werteliste nicht mehr: unter `nw:` stehen alle 1 270 Netzwerke,
 * unter `ast:` 5 461 Einrichtungen. Für jede Zeile einen Probelauf zu rechnen
 * wären ~20 s bzw. ~80 s Hintergrundarbeit für Zahlen, die neben Zeilen stehen,
 * die niemand ansieht. Wer `sichtbar` übergibt, bekommt Zahlen nur für die
 * gemeldeten Schlüssel — und sie bleiben stehen, sobald sie einmal errechnet
 * sind (der Melder nimmt nie etwas zurück, siehe
 * [SearchSuggestions.tsx](src/plugins/suche/SearchSuggestions.tsx)).
 */
import { useEffect, useRef, useState } from 'react';

/** Wie viele Trefferzahlen je Schub gerechnet werden (≈ 45 ms, siehe oben). */
const PROBEN_JE_SCHUB = 4;

/** Was ein Eintrag mitbringen muss: ein stabiler Schlüssel und die Anfrage. */
export interface ProbeAnfrage {
  key: string;
  anfrage: string;
}

/**
 * Der nächste Schub — über einen Message-Task, NICHT über `setTimeout(0)`.
 *
 * Verschachtelte Timer klemmt der Browser ab der fünften Ebene auf 4 ms und in
 * einem verborgenen Fenster auf rund eine Sekunde. Gemessen in `dev:local`
 * (verborgener Tab): von 42 Deskriptoren hatten nach 30 Sekunden erst 28 eine
 * Zahl — die Liste tröpfelte, statt sich zu füllen. Ein Message-Task ist kein
 * Timer und bleibt schnell; dieselbe Mechanik nutzt der React-Scheduler.
 */
export function naechsterSchub(fn: () => void): void {
  const kanal = new MessageChannel();
  kanal.port1.onmessage = () => { kanal.port1.close(); fn(); };
  kanal.port2.postMessage(0);
}

/**
 * @param anfragen  Referenzstabil halten (`useMemo`) — sonst startet der Lauf
 *                  bei jedem Render neu.
 * @param zaehle    Der Probelauf. `undefined` = keine Zahlen (z. B. im
 *                  Frage-Modus), `null` als Rückgabe = für diese eine Anfrage
 *                  nicht ermittelbar.
 * @param verzoegerungMs Wartezeit vor dem ersten Schub. Im Suchfeld verhindert
 *                  sie, dass jeder Tastendruck rechnet; wo nichts getippt wird,
 *                  darf sie 0 sein.
 * @param sichtbar  Schlüssel, die im Sichtfenster stehen. Fehlt der Wert, wird
 *                  wie bisher die ganze Liste gerechnet (kurze Listen). Ist er
 *                  gesetzt, wird NUR gerechnet, was gemeldet wurde — einmal
 *                  errechnete Zahlen bleiben über spätere Meldungen hinweg
 *                  stehen, sonst flackerte beim Scrollen die halbe Liste.
 */
export function useProbeZahlen(
  anfragen: readonly ProbeAnfrage[],
  zaehle: ((anfrage: string) => number | null) | undefined,
  verzoegerungMs = 150,
  sichtbar?: ReadonlySet<string>,
): ReadonlyMap<string, number> {
  const [zahlen, setZahlen] = useState<ReadonlyMap<string, number>>(new Map());
  // Der Speicher überlebt einen Wechsel von `sichtbar`, aber NICHT einen von
  // `anfragen`: eine neue Anfrage ist eine neue Liste, und eine gemerkte Zahl
  // aus der alten stünde dort ohne Deckung.
  const stand = useRef(new Map<string, number>());
  useEffect(() => { stand.current = new Map(); }, [anfragen, zaehle]);

  useEffect(() => {
    if (!zaehle || anfragen.length === 0) {
      // Identität bewahren, wenn schon leer — sonst rendert der Konsument bei
      // jedem Durchlauf neu.
      setZahlen(vorher => (vorher.size === 0 ? vorher : new Map()));
      return;
    }
    const offen = anfragen.filter(a =>
      !stand.current.has(a.key) && (sichtbar === undefined || sichtbar.has(a.key)));
    if (offen.length === 0) return;

    let abgebrochen = false;
    let i = 0;
    const schritt = (): void => {
      if (abgebrochen) return;
      const bis = Math.min(i + PROBEN_JE_SCHUB, offen.length);
      for (; i < bis; i++) {
        const a = offen[i];
        if (!a) continue;
        const n = zaehle(a.anfrage);
        if (n !== null) stand.current.set(a.key, n);
      }
      setZahlen(new Map(stand.current));
      if (i < offen.length) naechsterSchub(schritt);
    };
    const timer = window.setTimeout(schritt, verzoegerungMs);
    return () => { abgebrochen = true; window.clearTimeout(timer); };
  }, [anfragen, zaehle, verzoegerungMs, sichtbar]);
  return zahlen;
}
