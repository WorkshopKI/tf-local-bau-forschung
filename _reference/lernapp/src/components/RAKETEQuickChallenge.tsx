import { useState, useMemo } from "react";
import { Shield, Lightbulb, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useOrgContext } from "@/contexts/OrgContext";

interface RaketeChallenge {
  prompt: {
    act: string;
    task: string;
    context: string;
    ausgabe: string;
  };
  solution: {
    teste: string;
    einschraenkungen: string;
  };
}

const challenges: Record<string, RaketeChallenge> = {
  default: {
    prompt: {
      act: "Du bist ein erfahrener Social-Media-Manager.",
      task: "Erstelle einen LinkedIn-Post über ein neues Projektmanagement-Feature.",
      context: "B2B-SaaS-Startup, Zielgruppe: Teamleiter in KMU. Feature: automatische Zeiterfassung.",
      ausgabe: "Max. 150 Wörter, 3-5 Bulletpoints, Call-to-Action.",
    },
    solution: {
      teste: "Prüfe ob die Benefits konkret und messbar sind. Prüfe ob der CTA eine klare Handlung beschreibt. Prüfe ob der Ton professionell aber nicht steif ist.",
      einschraenkungen: "Keine generischen Marketing-Floskeln ('revolutionär', 'game-changer'). Keine technischen Details zur Implementierung. Nicht mehr als 150 Wörter.",
    },
  },
  legal: {
    prompt: {
      act: "Du bist ein erfahrener Verwaltungsjurist.",
      task: "Prüfe den IT-Rahmenvertrag auf Risiken bei Haftung, Datenschutz und Kündigung.",
      context: "Vertrag mit externem IT-Dienstleister, Volumen 500.000 €, VgV-Vergabe.",
      ausgabe: "Tabelle: Klausel → Risiko → Empfehlung, max. 2 Seiten.",
    },
    solution: {
      teste: "Prüfe ob alle drei Prüfbereiche abgedeckt sind. Prüfe ob jede Empfehlung eine konkrete Handlungsoption enthält. Prüfe die DSGVO-Referenzen (Art. 28).",
      einschraenkungen: "Keine eigenständige Rechtsberatung — nur Risikohinweise. Keine Spekulation über Vertragspartner-Absichten. Kein Fließtext.",
    },
  },
  oeffentlichkeitsarbeit: {
    prompt: {
      act: "Du bist Pressesprecher:in einer Kommunalverwaltung.",
      task: "Erstelle eine Pressemitteilung über die Einführung eines Bürgerservice-Portals.",
      context: "Stadtratsbeschluss gestern, 50 Online-Leistungen ab April, Budget 2 Mio. €.",
      ausgabe: "Max. 300 Wörter. Lead → Details → Zitat → Kontakt.",
    },
    solution: {
      teste: "Prüfe ob alle W-Fragen im Lead beantwortet sind. Prüfe ob das Zitat authentisch klingt und nicht nach Textbaustein.",
      einschraenkungen: "Keine Verwaltungsfachsprache. Kein Konjunktiv. Keine Superlative. Nicht über 300 Wörter.",
    },
  },
  hr: {
    prompt: {
      act: "Du bist HR-Manager:in im öffentlichen Dienst.",
      task: "Erstelle eine Stellenausschreibung für Sachbearbeiter:in Haushalt (EG 9b TVöD).",
      context: "Kämmerei, ab sofort, Verwaltungsfachwirt:in oder vergleichbar erforderlich.",
      ausgabe: "Aufgaben, Muss-/Kann-Anforderungen, Benefits, Kontakt. Max. 1 Seite.",
    },
    solution: {
      teste: "Prüfe AGG-Konformität (geschlechtsneutral, keine Altersdiskriminierung). Prüfe ob Muss- und Kann-Anforderungen klar getrennt sind.",
      einschraenkungen: "Keine informelle Sprache. Keine unrealistischen Anforderungen. Schwerbehinderten-Hinweis nicht vergessen.",
    },
  },
  it: {
    prompt: {
      act: "Du bist IT-Sicherheitsbeauftragte:r nach BSI-Grundschutz.",
      task: "Erstelle eine Prüfliste für das Fachverfahren Baugenehmigungen.",
      context: "Windows Server 2022, SQL-Datenbank, Schutzbedarf hoch, letztes Audit vor 8 Monaten.",
      ausgabe: "Tabelle: Anforderung → Status → Maßnahme → Verantwortlich → Frist.",
    },
    solution: {
      teste: "Prüfe ob jede Anforderung einem BSI-Baustein zugeordnet ist (APP.1 oder SYS.1). Prüfe ob jeder offene Punkt eine Frist hat.",
      einschraenkungen: "Keine veralteten Kompendium-Versionen. Keine Maßnahmen ohne Verantwortlichen. Nicht über den Prüfauftrag hinausgehen.",
    },
  },
  bauverfahren: {
    prompt: {
      act: "Du bist Sachbearbeiter:in im Bauordnungsamt.",
      task: "Erstelle ein Nachforderungsschreiben für fehlende Bauantragsunterlagen.",
      context: "Nutzungsänderung Büro→Wohnung (12 WE), § 34 BauGB, Brandschutznachweis fehlt.",
      ausgabe: "Förmliches Schreiben. Checkliste: Unterlage → Status → Frist (4 Wochen).",
    },
    solution: {
      teste: "Prüfe ob jede Nachforderung eine Rechtsgrundlage hat. Prüfe ob die Rechtsfolgenbelehrung bei Fristversäumnis enthalten ist.",
      einschraenkungen: "Keine materielle Prüfung — nur Vollständigkeit. Keine Rechtsberatung. Förmlicher Verwaltungston.",
    },
  },
};

const hints: Record<string, { teste: string; einschraenkungen: string }> = {
  default: {
    teste: "Denke an: Sind die genannten Vorteile überprüfbar? Gibt es einen klaren nächsten Schritt für den Leser?",
    einschraenkungen: "Denke an: Welche Buzzwords sollte die KI vermeiden? Gibt es eine Wortgrenze?",
  },
  legal: {
    teste: "Denke an: Sind alle Prüfbereiche abgedeckt? Stimmen die Rechtsverweise?",
    einschraenkungen: "Denke an: Was darf die KI nicht eigenständig entscheiden? Welches Format ist verboten?",
  },
  oeffentlichkeitsarbeit: {
    teste: "Denke an: Sind die W-Fragen beantwortet? Klingt das Zitat echt?",
    einschraenkungen: "Denke an: Welche Sprache ist unpassend? Gibt es eine Längenbegrenzung?",
  },
  hr: {
    teste: "Denke an: Ist die Ausschreibung diskriminierungsfrei? Sind die Anforderungen klar strukturiert?",
    einschraenkungen: "Denke an: Welchen Ton vermeiden? Was darf nicht fehlen?",
  },
  it: {
    teste: "Denke an: Ist jede Anforderung zuordenbar? Hat jeder offene Punkt eine Frist?",
    einschraenkungen: "Denke an: Was liegt außerhalb des Prüfauftrags? Was darf nicht fehlen?",
  },
  bauverfahren: {
    teste: "Denke an: Hat jede Nachforderung eine rechtliche Grundlage? Ist die Rechtsfolge genannt?",
    einschraenkungen: "Denke an: Was gehört nicht in eine Vollständigkeitsprüfung? Welcher Ton ist gefordert?",
  },
};

export const RAKETEQuickChallenge = () => {
  const [teste, setTeste] = useState("");
  const [einschraenkungen, setEinschraenkungen] = useState("");
  const [showHints, setShowHints] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const { scope, isDepartment } = useOrgContext();

  const challenge = useMemo(() => {
    if (isDepartment && challenges[scope]) {
      return challenges[scope];
    }
    return challenges.default;
  }, [scope, isDepartment]);

  const hint = useMemo(() => {
    if (isDepartment && hints[scope]) {
      return hints[scope];
    }
    return hints.default;
  }, [scope, isDepartment]);

  const bothFieldsFilled = teste.trim().length >= 20 && einschraenkungen.trim().length >= 20;

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-lg">RAKETE-Challenge: Ergänze die fehlenden Felder</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Dieser Prompt hat bereits 4 ACTA-Felder. Ergänze die zwei RAKETE-Felder{" "}
        <strong>Teste</strong> und <strong>Einschränkungen</strong>.
      </p>

      {/* Read-only ACTA prompt */}
      <div className="bg-muted/20 border border-border rounded-lg p-4 mb-5 space-y-2">
        <div>
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Rolle</span>
          <p className="text-xs font-mono text-foreground/80">{challenge.prompt.act}</p>
        </div>
        <div>
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Aufgabe</span>
          <p className="text-xs font-mono text-foreground/80">{challenge.prompt.task}</p>
        </div>
        <div>
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Kontext</span>
          <p className="text-xs font-mono text-foreground/80">{challenge.prompt.context}</p>
        </div>
        <div>
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Ergebnis</span>
          <p className="text-xs font-mono text-foreground/80">{challenge.prompt.ausgabe}</p>
        </div>
      </div>

      {/* Two textareas side by side */}
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-sm font-medium mb-1.5 block">🧪 Teste</label>
          <Textarea
            value={teste}
            onChange={(e) => setTeste(e.target.value)}
            placeholder="Worauf soll die KI ihre Antwort überprüfen?"
            rows={3}
            className="text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">🚫 Einschränkungen</label>
          <Textarea
            value={einschraenkungen}
            onChange={(e) => setEinschraenkungen(e.target.value)}
            placeholder="Was soll die KI NICHT tun?"
            rows={3}
            className="text-sm"
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowHints(!showHints)}
          className="gap-1.5"
        >
          <Lightbulb className="w-3.5 h-3.5" />
          {showHints ? "Hinweise verbergen" : "Hinweise anzeigen"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowSolution(!showSolution)}
          className="gap-1.5"
        >
          <Eye className="w-3.5 h-3.5" />
          {showSolution ? "Lösung verbergen" : "Beispiel-Lösung"}
        </Button>
        {bothFieldsFilled && (
          <Button
            size="sm"
            onClick={() => {
              window.location.href = "/playground?mode=experte";
            }}
          >
            In Prompt Werkstatt testen
          </Button>
        )}
      </div>

      {/* Hints */}
      {showHints && (
        <div className="mt-4 grid md:grid-cols-2 gap-3">
          <div className="bg-card rounded-lg p-3 border border-border">
            <p className="text-xs font-medium text-foreground mb-1">Hinweis für Teste:</p>
            <p className="text-xs text-muted-foreground italic">{hint.teste}</p>
          </div>
          <div className="bg-card rounded-lg p-3 border border-border">
            <p className="text-xs font-medium text-foreground mb-1">Hinweis für Einschränkungen:</p>
            <p className="text-xs text-muted-foreground italic">{hint.einschraenkungen}</p>
          </div>
        </div>
      )}

      {/* Solution */}
      {showSolution && (
        <div className="mt-4 grid md:grid-cols-2 gap-3">
          <div className="bg-card rounded-lg p-3 border border-border">
            <p className="text-xs font-medium text-foreground mb-1">Teste (Beispiel-Lösung):</p>
            <p className="text-xs text-muted-foreground italic">{challenge.solution.teste}</p>
          </div>
          <div className="bg-card rounded-lg p-3 border border-border">
            <p className="text-xs font-medium text-foreground mb-1">Einschränkungen (Beispiel-Lösung):</p>
            <p className="text-xs text-muted-foreground italic">{challenge.solution.einschraenkungen}</p>
          </div>
        </div>
      )}
    </div>
  );
};
