# Backlog: Assistent-Ideen aus den frühen Dock-Mockups

Stand: Juli 2026 · Bezug: Assistent Phase 0–2 (v2.224.0) · Ablage der Screens: `_reference/assistent-dock-mockups/`

## Herkunft & Einordnung

Die Mockups stammen aus der frühen Konzeptphase (Bau-Genehmigungs-Domäne, „BauFlowAI"/„EnviroCheck"), tragen aber bereits den TeamFlow-Namen und beschreiben im enthaltenen Konzepttext wörtlich ein „Persistent AI dock: collapsible right-hand panel, chat with an agent, ask for help directly from any page, context aware suggestions". Phase 1/2 haben den Kern davon unabhängig umgesetzt (angedocktes Panel, Kontext-Chips, deterministische Kontext-Injektion, Gedächtnis). Dieses Dokument hält fest, welche der übrigen Mockup-Ideen übernommen, übersetzt oder bewusst verworfen werden — als direktes Futter für den Phase-3-Prompt.

**Bereits abgedeckt durch Phase 1/2 (keine Aktion):** angedocktes, überall verfügbares Panel · Kontextbewusstsein (Route/Entität) · Status-Transparenz („Gedächtnis: N Einträge", Lauf-Status) · Chat mit internem Modell.

---

## Topf 1 — Direkt übernehmbar: Quick-Action-Leiste (Panel v1.1)

**Quelle:** `dock-quick-actions-konzepttext.png`, `dock-chat-warteschlange.png` (Leiste: Summarize · Next Step · Analyze · Checkpoint · Plan)

**Übersetzung:** Die Beispiel-Chips aus Phase 1 werden zu **routen-sensitiven Quick Actions** — vorgefertigte Prompts über dem ohnehin assemblierten Kontext. Kein neuer Mechanismus, keine neue Transportlogik.

| Quick Action | Deterministische Quelle | LLM-Anteil |
|---|---|---|
| Nächster Schritt | `naechsterSchritt()` (bereits im Faktenblock) | nur Ausformulierung |
| Wo stehe ich? | Workflow-Stepper aus amtlichem Status | nur Ausformulierung |
| Plan bis Bewilligung | verbleibende Spine-Schritte + Fristen (Ampel) | nur Ausformulierung |
| Fristen | Frist-Berechnung Arbeitsvorrat | nur Ausformulierung |
| Zusammenfassen | Orama-Auszüge der selektierten Entität | echter LLM-Fall (mit Fundstellen) |

**Routen-Sensitivität:** VerbundDetail zeigt andere Aktionen als die Antragsliste (dort z. B. „Was ist heute dran?" über den Arbeitsvorrat). Aktionen ohne erfüllte Voraussetzung (keine Entität selektiert, kein Index) werden ausgeblendet, nicht ausgegraut mit Fehlermeldung.

**Träger:** der ohnehin geplante Korrektur-Lauf nach der Testrunde. Klein genug zum Mitfahren; die PLs bekommen das Panel gleich in der besseren Fassung.

**Invarianten:** unverändert — ein Aufruf pro Turn, resetChat, nur interne Transports, deterministische Fakten injiziert.

**Umgesetzt in v2.258.0.** Endstand: 5 Aktionen live — „Nächster Schritt", „Wo stehe ich?", „Fristen" (immer sichtbar), „Was ist heute dran?" (Liste/Startseite ohne Entität) und „Zusammenfassen" (nur mit Orama-Index). Reiner, node-testbarer Katalog ([quickActions.ts](../src/plugins/chat/assistent/quickActions.ts)); Sichtbarkeit rein deterministisch (Entität/Route/Index), ausblenden statt ausgrauen. „**Plan bis Bewilligung**" bewusst **weggelassen** — es existiert keine Spine-Restschritt-Ableitung als reiner Helfer (nur der grobe `station < 4`-Gate), und statt einer neuen Statusmaschine bleibt sie außen vor (STOPP-Bedingung des Umsetzungs-Prompts). Der Kein-Entität-Fall bekommt zusätzlich einen deterministischen Arbeitsvorrat-Übersichtsblock in den Faktenblock ([arbeitsvorratUebersicht.ts](../src/plugins/chat/assistent/arbeitsvorratUebersicht.ts)), damit „Fristen"/„Was ist heute dran?" nicht faktenlos raten. Leisten-Position: wie bisher im Erststart-Zustand über dem Chat (kein persistenter Streifen über dem Eingabefeld). Detail: [assistent-panel.md](architecture/assistent-panel.md).

---

## Topf 2 — Phase-3/4-Kandidaten (nach Pilot-Empirie schneiden)

### 2a. Proaktive Vorschläge („Suggestions"-Tab)

**Quelle:** `dock-uebersicht-suggestions.png` · **Ziel-Phase:** 3

Der Assistent meldet sich unaufgefordert — aber die **Trigger sind ausschließlich deterministisch**, das LLM formuliert höchstens aus (oder es gibt gar keinen LLM-Anteil, Stufe 1 rein regelbasiert):

- Frist-Ampel einer Arbeitsvorrat-Entität springt auf rot
- `naechsterSchritt()` einer geöffneten Entität hat sich geändert
- QS-Regel-Verletzung mit vorhandener `regelKorrekturAnweisung()`
- Konsolidierung fand `offene_faeden`-Eintrag ohne Aktivität > N Tage

Anti-Prinzip: Ein LLM, das selbst entscheidet, *wann* es spricht, ist für den Behördenkontext die falsche erste Stufe. Vorschläge sind dismissbar, gedrosselt (max. N sichtbar), und ihre Klick-/Dismiss-Quote fließt nur lokal in „Meine Nutzung".

**Gate:** Zuschnitt erst nach dem PL-Pilot — welche Quick Actions geklickt und welche Fragen getippt werden, entscheidet, welche Trigger sich lohnen.

### 2b. Delegation („Assign" / Drag-&-Drop auf den Dock)

**Quelle:** `dock-drag-delegation.png` · **Ziel-Phase:** 4 (schreibend)

Übersetzung in die App-Welt: Delegation heißt **nicht** „Agent erledigt Aufgabe", sondern „Assistent startet Skill-/Workflow-Lauf auf dieser Entität" — immer mit Bestätigungs-Klick, nie autonom. Die Drag-Geste (Entität/Karte auf das Panel ziehen → Aktionsauswahl) ist die übernehmenswerte UX-Idee.

### 2c. Auftrags-Warteschlange des Assistenten

**Quelle:** `dock-chat-warteschlange.png` („2 Todo") · **Ziel-Phase:** nach 2b

Sequenzielle Warteschlange hinter dem BridgeMutex (Infrastruktur existiert seit Phase 2): ein Lauf nach dem anderen, Vordergrund (Skill-Lauf, Panel-Turn) hat immer Vorrang, Abbruch atomar. Klar hinter 2a/2b priorisiert.

---

## Topf 3 — Bewusst verworfen (mit Begründung, damit es nicht wiederkommt)

1. **Multi-Persona-Modell** (BauFlowAI, EnviroCheck, Code Review Assistant, Research Assistant als getrennte Agenten; gesamter Template-/Workspace-Wizard): Vervielfacht Prompts, Gedächtnis und Erwartungsmanagement. Die Spezialisierung liegt in der App bereits an der richtigen Stelle: **ein** Assistent, Skills als seine Fähigkeiten. Auch das Agenten-Verwaltungs-Dashboard (Erstellen/Pausieren/Konfigurieren von Agenten) entfällt damit.
2. **KI als Entscheiderin** — `ANTI-BEISPIEL-ki-genehmigt-selbst.png` zeigt „BauFlowAI" als Erlediger von „Genehmige Nutzungsänderung". Verletzt die härteste Invariante der App (**Entwurf ≠ Entscheidung**, verpflichtende menschliche Freigabe bei ABL/RNE) und wäre personalrats- wie verwaltungsrechtlich der Punkt, der das Projekt kippen kann. Der Assistent bereitet vor und entwirft; er zeichnet nie. Wenn die alten Screens intern kursieren, diesen Unterschied aktiv dazusagen.
3. **Zentrale Erfolgs-Metriken** (Total Interactions, Avg Success Rate über Nutzer hinweg): Aggregation über Personen ist mit dem Lokal-Versprechen unvereinbar. Zulässige Abwandlung: rein lokale **„Meine Nutzung"**-Statistik (eigene Klick-/Feedback-Zahlen aus dem improveFeedback-Zwei-Knopf-System), nie geteilt, nie auf dem Share.

---

## Screen-Referenzen (`_reference/assistent-dock-mockups/`)

| Datei | Zeigt | Verwendung |
|---|---|---|
| `dock-uebersicht-suggestions.png` | Dock-Listenansicht, Suggestions/Actions-Tabs, Status je Assistent | Topf 2a, Layout-Referenz |
| `dock-quick-actions-konzepttext.png` | Quick-Action-Leiste + originaler Dock-Konzepttext im Chat | Topf 1 (Hauptreferenz) |
| `dock-chat-warteschlange.png` | Geöffneter Chat im Kontext, Aufgaben-Warteschlange „2 Todo" | Topf 1 + 2c |
| `dock-drag-delegation.png` | Drag einer Karte Richtung Dock | Topf 2b |
| `ANTI-BEISPIEL-ki-genehmigt-selbst.png` | KI hat Genehmigung selbst „erledigt" | Topf 3.2 — Negativ-Referenz, bewusst so benannt |

Nicht abgelegt: Agenten-Verwaltungs-Dashboard und der dreistufige Template-/Workspace-Wizard (Topf 3.1, keine Übernahme — Ablage würde nur falsche Fährten legen).

## Reihenfolge

Live-Eval → Testplan → **Korrektur-Lauf** (Topf 1 ✓ umgesetzt v2.258.0; NFC-Härtung offen) → pl-Rollout + PL-Briefing → Pilot-Empirie → Phase-3-Prompt (Topf 2a, geschnitten nach Empirie) → Phase 4 (2b, dann 2c) → Prod-Gate: DSB/Personalrats-Notiz.
