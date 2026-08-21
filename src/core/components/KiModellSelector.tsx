import { useMemo } from 'react';
import { useKiZiel } from '@/core/services/ai/ki-ziel';
import { getLlmContextTokens } from '@/core/services/ai/llm-context';
import { useBridgeModelle, aufloesungFuer } from '@/core/services/ai/bridge-modelle';
import {
  KI_ROLLEN, MODELL_KATALOG, ordneZu, unbekannteModelle,
  type KiRolle,
} from '@/core/services/ai/modell-katalog';

/**
 * Auswahl des Modells der internen KI (global, `useKiZiel`).
 *
 * **Gewählt wird eine ROLLE, angezeigt ein Modellname.** `standard` ist das
 * bodenständige Modell — normales Fenster, für die grundlegenden Aufgaben gut
 * genug; `stark` steht für weites Kontextfenster und agentische Fähigkeiten. Die
 * Trennung ist der Grund, warum ein Modellwechsel der internen KI hier nichts
 * kaputt macht: welches Modell die Rolle gerade trägt, entscheidet
 * [modell-katalog.ts] gegen die von der Bridge gemeldete Auswahlliste. Ein fest
 * eingetragener Name stünde hier sonst noch, wenn es das Modell längst nicht mehr
 * gibt.
 *
 * **Die Wahl ist eine Untergrenze, keine Festlegung.** Passt der Umfang eines
 * Laufs nicht in das gewählte Fenster, hebt ihn `waehleModellFuerLauf`
 * ([modell-wahl.ts]) selbst an und sagt es am Lauf. Nach unten korrigiert nie
 * jemand — seit `stark` mehr meint als nur ein weites Fenster, wäre „passt ja
 * auch klein" ohnehin die falsche Frage.
 *
 * **Was nicht angebunden ist, steht trotzdem da** — nicht aus Bequemlichkeit,
 * sondern weil es eine Aussage trägt: es gibt das, wir nutzen es nicht, und
 * hier steht warum. Das gilt für den agentischen Chat (bringt eigenen Kontext
 * mit, den stellt diese App selbst zusammen) wie für das multimodale Modell
 * (kann Bildverstehen, wir übertragen bislang nur Text).
 *
 * Kein Wechsel-Hinweis mehr (bis v4 stand hier einer): der Verlauf liegt in der
 * serverseitigen Sitzung der KI-Seite und überlebt einen Modellwechsel — die
 * Warnung wäre ab jetzt schlicht falsch.
 *
 * Drei Stufen: voll (Label + Chips + Erklärung), `compact` (ohne Erklärung) und
 * `nurSteuerung` (nur die Chips). Letzteres für Wirte, die Label und Erklärung
 * selbst mitbringen — die `SettingsOption` der Einstellungen tut das.
 */

const AGENTISCH_GRUND =
  'Nicht angebunden: der agentische Chat bringt eigenen, fest eingebauten Kontext mit — den stellt diese App selbst zusammen.';

const CHIP = 'px-3 py-1 rounded-[16px] text-[12px]';

/**
 * Fenstergrösse als Kurzangabe („62k"), damit die Wahl eine Grundlage hat.
 *
 * **Immer `bridge: true`**, auch wenn gerade ein lokales LLM eingestellt ist: die
 * Zahl beschreibt das MODELL, und dessen Fenster hängt nicht daran, welcher
 * Provider im Moment aktiv ist. Mit `bridge: bridgeAktiv` fiel die Rechnung sonst
 * auf den lokalen Kontextwert zurück — und beide Chips zeigten dieselbe Zahl
 * (82k), was die Auswahl zur Behauptung ohne Unterschied machte.
 */
function fensterKurz(ziel: KiRolle): string {
  const tokens = getLlmContextTokens({ bridge: true, ziel });
  return `${Math.round(tokens / 1000)}k`;
}

export function KiModellSelector({
  compact = false,
  nurSteuerung = false,
}: { compact?: boolean; nurSteuerung?: boolean } = {}): React.ReactElement {
  const ziel = useKiZiel(s => s.ziel);
  const setZiel = useKiZiel(s => s.setZiel);
  // Abonniert, damit die Namen umspringen, sobald sich die Bridge meldet.
  const angeboten = useBridgeModelle(s => s.angeboten);

  const rollen = useMemo(
    () => KI_ROLLEN.map(r => ({ rolle: r, ...aufloesungFuer(r) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Auflösung liest den Store; `angeboten` ist genau ihr Auslöser.
    [angeboten],
  );

  // Angebotenes, das wir bewusst nicht nutzen. Ohne gemeldete Liste die
  // Katalogeinträge — sonst verschwände der Hinweis genau dann, wenn noch niemand
  // verbunden ist, also wenn er am ehesten gelesen wird.
  const gesperrt = useMemo(() => {
    if (!angeboten.length) {
      return MODELL_KATALOG.filter(e => e.nichtWaehlbar)
        .map(e => ({ text: e.label, grund: e.nichtWaehlbar as string }));
    }
    return angeboten
      .map(m => ({ text: m.text, eintrag: ordneZu(m.text, m.value) }))
      .filter(x => x.eintrag?.nichtWaehlbar)
      .map(x => ({ text: x.text, grund: x.eintrag?.nichtWaehlbar as string }));
  }, [angeboten]);

  const unbekannt = useMemo(() => unbekannteModelle(angeboten), [angeboten]);

  return (
    <div className={nurSteuerung ? 'max-w-[280px]' : undefined}>
      {!nurSteuerung && (
        <div className="text-[11px] text-[var(--tf-text-tertiary)] mb-1">Modell der internen KI</div>
      )}
      <div className="inline-flex gap-1.5 flex-wrap">
        {rollen.map(r => (
          <button
            key={r.rolle}
            type="button"
            aria-pressed={ziel === r.rolle}
            onClick={() => setZiel(r.rolle)}
            title={`Kontextfenster ${fensterKurz(r.rolle)} Tokens`}
            className={
              ziel === r.rolle
                ? `${CHIP} bg-[var(--tf-primary-light)] text-[var(--tf-primary)]`
                : `${CHIP} border-[0.5px] border-[var(--tf-border)] text-[var(--tf-text-secondary)] hover:border-[var(--tf-border-hover)]`
            }
          >
            <span>{r.label}</span>
            <span className="ml-1.5 text-[10.5px] opacity-70">{fensterKurz(r.rolle)}</span>
          </button>
        ))}
        {[...gesperrt, { text: 'Agentischer Chat', grund: AGENTISCH_GRUND }].map(g => (
          <button
            key={g.text}
            type="button"
            disabled
            aria-disabled
            title={g.grund}
            // „Inaktiv" trägt hier die RAHMENFORM (gestrichelt) + der Cursor, nicht
            // die Blässe: mit `text-tertiary` und `opacity-60` mass der Chip 1,71:1
            // und war damit praktisch unlesbar — ausgerechnet der Eintrag, dessen
            // ganzer Zweck es ist, gelesen zu werden.
            className={`${CHIP} border-[0.5px] border-dashed border-[var(--tf-border)] text-[var(--tf-text-secondary)] cursor-not-allowed`}
          >
            {g.text}
          </button>
        ))}
      </div>
      {!compact && !nurSteuerung && (
        <p className="text-[11px] text-[var(--tf-text-tertiary)] mt-1.5 leading-snug">
          Passt ein Dokument nicht in das gewählte Fenster, wechselt die App für diesen Lauf selbst
          auf das stärkere Modell und vermerkt es.
          {gesperrt.map(g => <span key={g.text}> {g.text}: {g.grund}</span>)}
          {' '}{AGENTISCH_GRUND}
        </p>
      )}
      {unbekannt.length > 0 && (
        // Sichtbar machen, was wir nicht einordnen können: bis v5 fiel ein
        // Modellwechsel der internen KI erst auf, wenn ein Lauf scheiterte.
        //
        // Auch in `nurSteuerung` — anders als die Erklär-Prosa. Der Wirt bringt
        // Label und Hilfetext mit, aber nicht DIESE Auskunft: sie hängt am Angebot
        // der KI-Seite, nicht am Bauteil. In den Einstellungen ausgerechnet zu
        // schweigen hiesse, den Hinweis dort wegzulassen, wo er hingehört.
        <p className="text-[11px] text-[var(--tf-text-tertiary)] mt-1.5 leading-snug">
          Neu in der internen KI, dieser App noch nicht bekannt: {unbekannt.join(', ')}. Die App
          arbeitet weiter; das Kontextfenster liest sie beim ersten Lauf ab.
        </p>
      )}
    </div>
  );
}
