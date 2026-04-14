import { useState, useEffect, useRef } from "react";

// ====================================================================
// PROTOTYPE SELECTOR
// ====================================================================
export default function App() {
  const [proto, setProto] = useState("context");

  return (
    <div style={{
      minHeight: "100vh",
      background: "#fafaf8",
      fontFamily: "'Manrope', 'DM Sans', system-ui, sans-serif",
      color: "#1a1a1a",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet"/>

      {/* Proto switcher */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "#1a1a1a",
        padding: "10px 24px",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <span style={{ fontSize: 11, color: "#888", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginRight: 8 }}>
          Prototypen
        </span>
        {[
          { id: "context", label: "KI-Kontext & Qualitätsregeln" },
          { id: "rejection", label: "Rejection-Workflow" },
        ].map(p => (
          <button
            key={p.id}
            onClick={() => setProto(p.id)}
            style={{
              padding: "5px 14px",
              borderRadius: 5,
              border: "none",
              background: proto === p.id ? "#fff" : "transparent",
              color: proto === p.id ? "#1a1a1a" : "#999",
              fontSize: 12.5,
              fontWeight: proto === p.id ? 600 : 400,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >{p.label}</button>
        ))}
      </div>

      {proto === "context" ? <ContextAndLibrary /> : <RejectionWorkflow />}
    </div>
  );
}

// ====================================================================
// ICONS
// ====================================================================
const IconShield = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const IconPlus = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconSparkle = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/>
  </svg>
);
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconChevron = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}>
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const IconPen = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
  </svg>
);
const IconBook = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
  </svg>
);
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);
const IconLightbulb = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6"/><path d="M10 22h4"/>
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>
  </svg>
);
const IconArrowRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);
const IconX = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconSave = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
  </svg>
);


// ====================================================================
// MOCK DATA
// ====================================================================
const initialRules = [
  { id: "r1", text: "In Bescheiden immer die vollständige Rechtsgrundlage mit Paragraf, Absatz und Satz angeben.", domain: "Recht", active: true, source: "manual" },
  { id: "r2", text: "Keine Anglizismen in externer Bürger-Kommunikation. Statt 'Deadline' → 'Frist', statt 'Feedback' → 'Rückmeldung'.", domain: "Kommunikation", active: true, source: "manual" },
  { id: "r3", text: "Zahlen über 12 immer als Ziffer schreiben, nicht als Wort. Ausnahme: Satzanfang.", domain: "Allgemein", active: false, source: "manual" },
];

const initialConstraints = [
  { id: "c1", title: "Fristen immer mit Tagestyp angeben", domain: "Recht", rule: "Bei jeder Fristangabe explizit 'Kalendertage' oder 'Werktage' benennen. Niemals nur 'Tage' oder 'zeitnah'.", example: { before: "Die Stellungnahme ist innerhalb von 14 Tagen einzureichen.", after: "Die Stellungnahme ist innerhalb von 14 Kalendertagen nach Zugang dieses Schreibens einzureichen." }, source: "rejection", active: true, created: "2026-03-10" },
  { id: "c2", title: "DSCR ≠ Nettovermögen", domain: "Finanzen", rule: "Debt Service Coverage Ratio (DSCR) und Nettovermögen sind unterschiedliche Kennzahlen mit verschiedenen Monitoring-Triggern. Niemals gleichsetzen oder verwechseln.", example: null, source: "rejection", active: true, created: "2026-03-08" },
  { id: "c3", title: "AGG-konforme Stellenausschreibungen", domain: "Personal", rule: "Alle Stellenausschreibungen müssen geschlechtsneutral formuliert sein (m/w/d). Keine Altersbegrenzungen implizieren ('junges Team', 'Digital Native').", example: { before: "Wir suchen einen engagierten Mitarbeiter für unser junges, dynamisches Team.", after: "Wir suchen eine engagierte Fachkraft (m/w/d) für unser interdisziplinäres Team." }, source: "manual", active: true, created: "2026-03-05" },
  { id: "c4", title: "Konkrete Zahlen statt Vagheit", domain: "Kommunikation", rule: "In Berichten und Pressemitteilungen immer konkrete Zahlen oder Größenordnungen statt vager Quantifizierer ('viele', 'zahlreiche', 'einige') verwenden.", example: { before: "Zahlreiche Bürgerinnen und Bürger nahmen an der Veranstaltung teil.", after: "Rund 340 Bürgerinnen und Bürger nahmen an der Veranstaltung teil." }, source: "rejection", active: false, created: "2026-02-28" },
];

const domains = ["Alle", "Recht", "Kommunikation", "Personal", "Finanzen", "Allgemein"];


// ====================================================================
// PROTOTYPE 1: KI-KONTEXT & CONSTRAINT LIBRARY
// ====================================================================
function ContextAndLibrary() {
  const [view, setView] = useState("context");

  return (
    <div>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "32px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 32, borderBottom: "1px solid #e5e5e0" }}>
          <TabButton active={view === "context"} onClick={() => setView("context")} label="Mein KI-Kontext" />
          <TabButton active={view === "library"} onClick={() => setView("library")} label="Qualitätsregeln" />
        </div>
      </div>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "0 24px 64px" }}>
        {view === "context" ? <KIContextView /> : <ConstraintLibraryView />}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label }) {
  return (
    <button onClick={onClick} style={{
      background: "none", border: "none",
      borderBottom: active ? "2px solid #1a1a1a" : "2px solid transparent",
      padding: "12px 0", cursor: "pointer",
    }}>
      <span style={{
        fontFamily: "'Libre Baskerville', Georgia, serif",
        fontSize: 17,
        fontWeight: active ? 700 : 400,
        color: active ? "#1a1a1a" : "#888",
        transition: "color 0.2s ease",
      }}>{label}</span>
    </button>
  );
}


// === KI-KONTEXT ===
function KIContextView() {
  const [rules, setRules] = useState(initialRules);
  const [showAdd, setShowAdd] = useState(false);
  const activeCount = rules.filter(r => r.active).length;

  return (
    <div style={{ paddingTop: 28 }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 14, color: "#666", lineHeight: 1.65, maxWidth: 620, marginBottom: 20 }}>
          Dein persönlicher KI-Kontext wird bei jeder Anfrage im Prompt-Labor automatisch mitgesendet.
          Er steuert, wie die KI für dich arbeitet — deine Rolle, deine Regeln, dein Qualitätsanspruch.
        </p>
        <ActiveBadge count={activeCount} label="Arbeitsregel" />
      </div>

      <SectionHeader icon={<IconShield />} title="Rolle & Domäne" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
        <FieldCard label="Abteilung" value="Rechtsabteilung" />
        <FieldCard label="Fachgebiet" value="Öffentliches Recht, Vergaberecht" />
        <FieldCard label="Typische Aufgaben" value="Bescheide, Stellungnahmen, Vergabedokumentation" />
        <FieldCard label="Stil" value="Formal, präzise, rechtskonform" />
      </div>

      <SectionHeader icon={<IconBook />} title="Arbeitsregeln" action={
        <button onClick={() => setShowAdd(!showAdd)} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "#1a1a1a", color: "#fff", border: "none", borderRadius: 6,
          padding: "6px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
        }}><IconPlus /> Regel hinzufügen</button>
      }/>

      {showAdd && (
        <div style={{ background: "#fff", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)", padding: 20, marginBottom: 12, border: "1px solid #e8e8e4" }}>
          <textarea placeholder='z.B. "Bei Vergabedokumenten immer die EU-Schwellenwerte mit aktuellem Stand angeben."' style={{
            width: "100%", minHeight: 72, border: "1px solid #ddd", borderRadius: 6, padding: 12,
            fontSize: 13.5, fontFamily: "'Manrope', system-ui", lineHeight: 1.55, resize: "vertical",
            color: "#1a1a1a", outline: "none", boxSizing: "border-box",
          }}/>
          <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
            <select style={{ border: "1px solid #ddd", borderRadius: 6, padding: "6px 12px", fontSize: 12.5, fontFamily: "'Manrope', system-ui", color: "#666", background: "#fff" }}>
              <option>Domäne wählen…</option>
              <option>Recht</option><option>Kommunikation</option><option>Personal</option><option>Allgemein</option>
            </select>
            <button onClick={() => setShowAdd(false)} style={{ padding: "6px 16px", borderRadius: 6, border: "1px solid #ddd", background: "#fff", fontSize: 12.5, cursor: "pointer", color: "#666" }}>Abbrechen</button>
            <button style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: "#1a1a1a", color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Speichern</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rules.map(rule => (
          <RuleCard key={rule.id} rule={rule} onToggle={() => setRules(rules.map(r => r.id === rule.id ? { ...r, active: !r.active } : r))} />
        ))}
      </div>

      <div style={{ marginTop: 32 }}>
        <SectionHeader icon={<IconSparkle />} title="Vorschau: Was die KI sieht" />
        <div style={{
          background: "#f8f7f4", borderRadius: 10, padding: 20, fontFamily: "monospace",
          fontSize: 12, lineHeight: 1.7, color: "#555", border: "1px solid #eae8e4", whiteSpace: "pre-wrap",
        }}>
{`# Kontext des Nutzers
Abteilung: Rechtsabteilung
Fachgebiet: Öffentliches Recht, Vergaberecht
Aufgaben: Bescheide, Stellungnahmen, Vergabedokumentation

# Aktive Arbeitsregeln
${rules.filter(r => r.active).map(r => `- ${r.text}`).join("\n")}`}
        </div>
        <p style={{ fontSize: 11.5, color: "#999", marginTop: 8, fontStyle: "italic" }}>
          Dieser Kontext wird als System-Prompt bei jeder KI-Anfrage mitgesendet.
        </p>
      </div>
    </div>
  );
}


// === CONSTRAINT LIBRARY ===
function ConstraintLibraryView() {
  const [constraints, setConstraints] = useState(initialConstraints);
  const [filter, setFilter] = useState("Alle");
  const [expandedId, setExpandedId] = useState(null);
  const filtered = filter === "Alle" ? constraints : constraints.filter(c => c.domain === filter);
  const stats = { total: constraints.length, active: constraints.filter(c => c.active).length, fromRejection: constraints.filter(c => c.source === "rejection").length };

  return (
    <div style={{ paddingTop: 28 }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 14, color: "#666", lineHeight: 1.65, maxWidth: 620, marginBottom: 20 }}>
          Dein akkumuliertes Wissen über gute vs. schlechte KI-Outputs.
          Jede Regel kodiert eine Erfahrung — was du beim nächsten Mal automatisch besser haben willst.
        </p>
        <div style={{ display: "flex", gap: 20 }}>
          <StatBadge value={stats.total} label="Regeln" />
          <StatBadge value={stats.active} label="aktiv" accent />
          <StatBadge value={stats.fromRejection} label="aus Ablehnungen" />
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {domains.map(d => (
          <ChipButton key={d} label={d} active={filter === d} onClick={() => setFilter(d)} />
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(c => (
          <ConstraintCard key={c.id} constraint={c}
            expanded={expandedId === c.id}
            onToggleExpand={() => setExpandedId(expandedId === c.id ? null : c.id)}
            onToggleActive={() => setConstraints(constraints.map(x => x.id === c.id ? { ...x, active: !x.active } : x))}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 24px", color: "#999", fontSize: 14 }}>
          Keine Regeln in dieser Kategorie.
        </div>
      )}
    </div>
  );
}


// ====================================================================
// PROTOTYPE 2: REJECTION WORKFLOW (Idee 8)
// ====================================================================
function RejectionWorkflow() {
  const [step, setStep] = useState(0);
  // 0 = initial chat, 1 = first iteration, 2 = nudge appears,
  // 3 = user types reason, 4 = constraint suggestion, 5 = saved

  const chatRef = useRef(null);
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [step]);

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 24px 100px" }}>
      {/* Scene description */}
      <div style={{
        background: "#f5f4f0", borderRadius: 10, padding: "16px 20px",
        marginBottom: 20, border: "1px solid #e8e8e4",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#999", marginBottom: 6 }}>
          Szenario: Prompt-Labor
        </div>
        <div style={{ fontSize: 13.5, color: "#555", lineHeight: 1.55 }}>
          Eine Sachbearbeiterin aus der Rechtsabteilung lässt sich einen Anhörungsbescheid entwerfen.
          Der erste Output hat eine subtile Schwäche — die Frist ist vage formuliert.
          Sie iteriert. Nach der zweiten Iteration erscheint der <strong>Rejection-Nudge</strong>.
        </div>
      </div>

      {/* Simulated chat */}
      <div ref={chatRef} style={{
        background: "#fff",
        borderRadius: 14,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.04)",
        border: "1px solid #eee",
        overflow: "hidden",
      }}>
        {/* Chat header */}
        <div style={{
          padding: "14px 20px",
          borderBottom: "1px solid #f0eeea",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4a9a4a" }}/>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>Prompt-Labor</span>
          <span style={{ fontSize: 11, color: "#bbb", marginLeft: "auto" }}>GPT-4o · Rechtsabteilung</span>
        </div>

        {/* Messages */}
        <div style={{ padding: "20px 20px 0" }}>
          {/* User message 1 */}
          <ChatBubble role="user">
            Erstelle einen Anhörungsbescheid für ein Ordnungswidrigkeitsverfahren.
            Betroffener: Max Müller, Verstoß: Ruhestörung am 12.02.2026.
          </ChatBubble>

          {/* AI response 1 */}
          <ChatBubble role="ai">
            <strong>Anhörung im Ordnungswidrigkeitsverfahren</strong>
            <br/><br/>
            Sehr geehrter Herr Müller,<br/><br/>
            hiermit geben wir Ihnen Gelegenheit zur Stellungnahme zu folgendem Sachverhalt:
            Am 12.02.2026 wurde in Ihrer Wohnung eine Ruhestörung festgestellt (…)
            <br/><br/>
            Sie haben die Möglichkeit, sich <HighlightBad>innerhalb von 14 Tagen</HighlightBad> zu dem Vorwurf zu äußern.
          </ChatBubble>

          {step >= 1 && (
            <>
              {/* User iteration */}
              <ChatBubble role="user">
                Die Frist muss konkreter sein. Es muss klar sein ob Kalender- oder Werktage
                und ab wann die Frist läuft. Bitte überarbeiten.
              </ChatBubble>

              {/* AI response 2 */}
              <ChatBubble role="ai">
                (…) Sie haben die Möglichkeit, sich <HighlightGood>innerhalb von 14 Kalendertagen nach Zugang dieses Schreibens</HighlightGood> zu dem Vorwurf zu äußern. (…)
              </ChatBubble>
            </>
          )}

          {/* === THE NUDGE (Step 2) === */}
          {step >= 2 && (
            <NudgeCard
              step={step}
              onDismiss={() => setStep(Math.max(step, 2))}
              onAccept={() => setStep(3)}
            />
          )}

          {/* === USER REASON (Step 3) === */}
          {step >= 3 && (
            <div style={{ margin: "0 0 16px" }}>
              <div style={{
                background: "#f8f7f4",
                borderRadius: 10,
                padding: "14px 18px",
                border: "1px solid #e8e8e4",
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#999", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Deine Begründung
                </div>
                <div style={{ fontSize: 13.5, color: "#1a1a1a", lineHeight: 1.55 }}>
                  Fristangaben müssen immer den Tagestyp (Kalendertage/Werktage) und den Fristbeginn enthalten.
                  "14 Tage" allein ist rechtlich ungenau und kann angefochten werden.
                </div>
              </div>
            </div>
          )}

          {/* === CONSTRAINT SUGGESTION (Step 4) === */}
          {step >= 4 && (
            <ConstraintSuggestion
              onSave={() => setStep(5)}
              saved={step >= 5}
            />
          )}

          {/* === SAVED CONFIRMATION (Step 5) === */}
          {step >= 5 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "#f0f7f0", borderRadius: 8, padding: "10px 16px",
              marginBottom: 16, border: "1px solid #c8e0c8",
            }}>
              <IconCheck />
              <span style={{ fontSize: 13, color: "#2d6a2d", fontWeight: 500 }}>
                Qualitätsregel gespeichert und in deinem KI-Kontext aktiviert.
              </span>
            </div>
          )}
        </div>

        {/* Step controls */}
        <div style={{
          padding: "16px 20px",
          borderTop: "1px solid #f0eeea",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <div style={{ flex: 1, fontSize: 12, color: "#999" }}>
            Schritt {Math.min(step + 1, 5)} von 5 — {
              step === 0 ? "Erster Output" :
              step === 1 ? "User iteriert" :
              step === 2 ? "Nudge erscheint" :
              step === 3 ? "Begründung eingegeben" :
              step === 4 ? "Regel vorgeschlagen" :
              "Gespeichert ✓"
            }
          </div>
          {step < 5 && (
            <button
              onClick={() => setStep(step + 1)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "#1a1a1a", color: "#fff", border: "none",
                borderRadius: 6, padding: "7px 16px", fontSize: 12.5,
                fontWeight: 600, cursor: "pointer",
              }}
            >
              Weiter <IconArrowRight />
            </button>
          )}
          {step > 0 && (
            <button
              onClick={() => setStep(0)}
              style={{
                padding: "7px 14px", borderRadius: 6, border: "1px solid #ddd",
                background: "#fff", fontSize: 12.5, cursor: "pointer", color: "#666",
              }}
            >Zurücksetzen</button>
          )}
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ role, children }) {
  const isUser = role === "user";
  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 16,
    }}>
      <div style={{
        maxWidth: "85%",
        background: isUser ? "#1a1a1a" : "#f8f7f4",
        color: isUser ? "#fff" : "#1a1a1a",
        borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
        padding: "12px 16px",
        fontSize: 13.5,
        lineHeight: 1.6,
      }}>
        {children}
      </div>
    </div>
  );
}

function HighlightBad({ children }) {
  return (
    <span style={{
      background: "#fef0f0",
      color: "#c44",
      padding: "1px 5px",
      borderRadius: 3,
      borderBottom: "2px solid #e88",
      fontWeight: 600,
    }}>{children}</span>
  );
}

function HighlightGood({ children }) {
  return (
    <span style={{
      background: "#f0f7f0",
      color: "#2a6a2a",
      padding: "1px 5px",
      borderRadius: 3,
      borderBottom: "2px solid #8c8",
      fontWeight: 600,
    }}>{children}</span>
  );
}

function NudgeCard({ step, onDismiss, onAccept }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #fffcf5 0%, #fff9ee 100%)",
      borderRadius: 12,
      border: "1px solid #eede c8",
      padding: "16px 18px",
      marginBottom: 16,
      boxShadow: "0 2px 12px rgba(180,124,44,0.08)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "#fdf5e8",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#b47c2c", flexShrink: 0,
        }}>
          <IconLightbulb />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: "'Libre Baskerville', Georgia, serif",
            fontSize: 14,
            fontWeight: 700,
            color: "#8a6420",
            marginBottom: 4,
          }}>
            Du hast nachgebessert
          </div>
          <div style={{ fontSize: 13, color: "#8a7040", lineHeight: 1.55 }}>
            Was war am ersten Output nicht gut genug?
            Wenn du es kurz beschreibst, kann ich daraus eine Qualitätsregel für dich ableiten —
            damit dieser Fehler nicht nochmal passiert.
          </div>
          {step === 2 && (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={onAccept} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "#8a6420", color: "#fff", border: "none",
                borderRadius: 6, padding: "7px 14px", fontSize: 12.5,
                fontWeight: 600, cursor: "pointer",
              }}>
                Ja, Regel ableiten
              </button>
              <button onClick={onDismiss} style={{
                padding: "7px 14px", borderRadius: 6,
                border: "1px solid #e0d5b8", background: "transparent",
                fontSize: 12.5, cursor: "pointer", color: "#8a7040",
              }}>
                Nicht jetzt
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConstraintSuggestion({ onSave, saved }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: 12,
      border: "1px solid #e8e8e4",
      padding: "18px 20px",
      marginBottom: 16,
      boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <IconSparkle />
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#999" }}>
          Vorgeschlagene Qualitätsregel
        </span>
      </div>

      <div style={{
        fontFamily: "'Libre Baskerville', Georgia, serif",
        fontSize: 15,
        fontWeight: 700,
        color: "#1a1a1a",
        marginBottom: 8,
      }}>
        Fristen immer mit Tagestyp angeben
      </div>

      <div style={{
        fontSize: 13.5, color: "#555", lineHeight: 1.6, marginBottom: 14,
        paddingBottom: 14, borderBottom: "1px solid #f0eeea",
      }}>
        Bei jeder Fristangabe explizit „Kalendertage" oder „Werktage" benennen und den Fristbeginn angeben.
        Niemals nur „Tage" oder „zeitnah" verwenden.
      </div>

      {/* Example preview */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#999", marginBottom: 8 }}>
          Beispiel
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <MiniExample label="Vorher" text="…innerhalb von 14 Tagen…" bad />
          <MiniExample label="Nachher" text="…innerhalb von 14 Kalendertagen nach Zugang…" />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          fontSize: 10.5, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: "0.05em", color: "#999", background: "#f5f5f0",
          padding: "2px 8px", borderRadius: 4,
        }}>Recht</span>
        <span style={{
          fontSize: 10.5, fontWeight: 500, color: "#b47c2c",
          background: "#fdf5e8", padding: "2px 8px", borderRadius: 4,
          display: "inline-flex", alignItems: "center", gap: 4,
        }}>
          <IconSparkle /> aus Ablehnung gelernt
        </span>
      </div>

      {!saved && (
        <div style={{ display: "flex", gap: 8, marginTop: 14, paddingTop: 14, borderTop: "1px solid #f0eeea" }}>
          <button onClick={onSave} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "#1a1a1a", color: "#fff", border: "none",
            borderRadius: 6, padding: "7px 16px", fontSize: 12.5,
            fontWeight: 600, cursor: "pointer",
          }}>
            <IconSave /> Regel speichern
          </button>
          <button style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "7px 14px", borderRadius: 6, border: "1px solid #ddd",
            background: "#fff", fontSize: 12.5, cursor: "pointer", color: "#666",
          }}>
            <IconPen /> Bearbeiten
          </button>
          <button style={{
            padding: "7px 14px", borderRadius: 6, border: "1px solid #ddd",
            background: "#fff", fontSize: 12.5, cursor: "pointer", color: "#999",
          }}>
            Verwerfen
          </button>
        </div>
      )}
    </div>
  );
}

function MiniExample({ label, text, bad }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <span style={{
        fontSize: 10, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.05em", minWidth: 48,
        color: bad ? "#c44" : "#2d6a2d",
      }}>{label}</span>
      <span style={{
        fontSize: 13, color: "#555",
        background: bad ? "#fef5f5" : "#f0f7f0",
        border: `1px solid ${bad ? "#f5d5d5" : "#c8e0c8"}`,
        padding: "4px 10px", borderRadius: 6,
      }}>{text}</span>
    </div>
  );
}


// ====================================================================
// SHARED COMPONENTS
// ====================================================================
function ActiveBadge({ count, label }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      background: count > 0 ? "#f0f7f0" : "#f5f5f0",
      border: `1px solid ${count > 0 ? "#c8e0c8" : "#e5e5e0"}`,
      borderRadius: 20, padding: "6px 14px",
      fontSize: 12.5, fontWeight: 500,
      color: count > 0 ? "#2d6a2d" : "#888",
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: count > 0 ? "#4a9a4a" : "#ccc" }}/>
      {count} {label}{count !== 1 ? "n" : ""} aktiv
    </div>
  );
}

function SectionHeader({ icon, title, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "#888" }}>{icon}</span>
        <h3 style={{
          fontSize: 13, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.06em", color: "#888", margin: 0,
        }}>{title}</h3>
      </div>
      {action}
    </div>
  );
}

function FieldCard({ label, value }) {
  const [h, setH] = useState(false);
  return (
    <div style={{
      background: "#fff", borderRadius: 8, padding: "12px 16px",
      boxShadow: h ? "0 2px 8px rgba(0,0,0,0.08)" : "0 1px 3px rgba(0,0,0,0.05)",
      border: "1px solid #eee", cursor: "pointer", transition: "box-shadow 0.15s ease",
    }} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#999", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: "#1a1a1a", lineHeight: 1.45 }}>{value}</div>
    </div>
  );
}

function RuleCard({ rule, onToggle }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12,
      background: "#fff", borderRadius: 10, padding: "14px 16px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.05)", border: "1px solid #eee",
      opacity: rule.active ? 1 : 0.55, transition: "all 0.2s ease",
    }}>
      <button onClick={onToggle} style={{
        width: 20, height: 20, minWidth: 20, borderRadius: 5,
        border: rule.active ? "none" : "1.5px solid #ccc",
        background: rule.active ? "#1a1a1a" : "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", marginTop: 1, color: "#fff",
      }}>{rule.active && <IconCheck />}</button>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "#1a1a1a" }}>{rule.text}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <span style={{
            fontSize: 10.5, fontWeight: 600, textTransform: "uppercase",
            letterSpacing: "0.05em", color: "#999", background: "#f5f5f0",
            padding: "2px 8px", borderRadius: 4,
          }}>{rule.domain}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 1 }}>
        <SmallAction icon={<IconPen />} />
        <SmallAction icon={<IconTrash />} />
      </div>
    </div>
  );
}

function SmallAction({ icon }) {
  const [h, setH] = useState(false);
  return (
    <button onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      width: 28, height: 28, borderRadius: 6, border: "none",
      background: h ? "#f0f0ec" : "transparent",
      display: "flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer", color: "#999", transition: "all 0.15s ease",
    }}>{icon}</button>
  );
}

function StatBadge({ value, label, accent }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
      <span style={{ fontFamily: "'Libre Baskerville', Georgia, serif", fontSize: 22, fontWeight: 700, color: accent ? "#1a1a1a" : "#888" }}>{value}</span>
      <span style={{ fontSize: 11.5, color: "#999" }}>{label}</span>
    </div>
  );
}

function ChipButton({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 14px", borderRadius: 20,
      border: active ? "1.5px solid #1a1a1a" : "1px solid #ddd",
      background: active ? "#1a1a1a" : "#fff",
      color: active ? "#fff" : "#666",
      fontSize: 12, fontWeight: 500, cursor: "pointer",
      fontFamily: "'Manrope', system-ui", transition: "all 0.15s ease",
    }}>{label}</button>
  );
}

function ConstraintCard({ constraint: c, expanded, onToggleExpand, onToggleActive }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 12,
      boxShadow: "0 1px 4px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.03)",
      border: "1px solid #eee", overflow: "hidden",
    }}>
      <div onClick={onToggleExpand} style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        padding: "16px 18px", cursor: "pointer",
      }}>
        <span style={{ marginTop: 3, color: "#999" }}><IconChevron open={expanded} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Libre Baskerville', Georgia, serif", fontSize: 14.5, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.4 }}>{c.title}</div>
          <div style={{ fontSize: 13, color: "#666", lineHeight: 1.55, marginTop: 4 }}>{c.rule}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
            <span style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#999", background: "#f5f5f0", padding: "2px 8px", borderRadius: 4 }}>{c.domain}</span>
            {c.source === "rejection" && (
              <span style={{ fontSize: 10.5, fontWeight: 500, color: "#b47c2c", background: "#fdf5e8", padding: "2px 8px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <IconSparkle /> aus Ablehnung gelernt
              </span>
            )}
            <span style={{ fontSize: 11, color: "#bbb", marginLeft: "auto" }}>{c.created}</span>
          </div>
        </div>
        <div onClick={e => { e.stopPropagation(); onToggleActive(); }} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", paddingTop: 2 }}>
          <span style={{ fontSize: 11, color: c.active ? "#4a9a4a" : "#bbb", fontWeight: 500 }}>{c.active ? "aktiv" : "inaktiv"}</span>
          <div style={{ width: 36, height: 20, borderRadius: 10, background: c.active ? "#4a9a4a" : "#ddd", position: "relative", transition: "background 0.2s ease" }}>
            <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: c.active ? 18 : 2, transition: "left 0.2s ease", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }}/>
          </div>
        </div>
      </div>
      {expanded && c.example && (
        <div style={{ borderTop: "1px solid #f0eeea", padding: "16px 18px 18px 44px", background: "#fcfbf9" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#999", marginBottom: 10 }}>Beispiel</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <ExampleBox label="Vorher" text={c.example.before} color="#d44" bg="#fef5f5" borderColor="#f5d5d5" />
            <ExampleBox label="Nachher" text={c.example.after} color="#2d6a2d" bg="#f3f9f3" borderColor="#c8e0c8" />
          </div>
        </div>
      )}
    </div>
  );
}

function ExampleBox({ label, text, color, bg, borderColor }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color, minWidth: 52, paddingTop: 6 }}>{label}</span>
      <div style={{ flex: 1, background: bg, border: `1px solid ${borderColor}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, lineHeight: 1.55, color: "#333" }}>{text}</div>
    </div>
  );
}
