# Messlauf: Gutachten-Abschnitte A–G gegen die interne KI, geeicht an Claude

**22.08.2026** · Momentaufnahme. Erster gemessener Lauf der Abschnitts-Erzeugung gegen das Modell,
mit dem das Team arbeitet — möglich geworden durch den [KI-Tunnel](../architecture/ki-tunnel-dev.md).
Testplan und Aufbau: `local-fiktiv`-Variante, drei fiktive ZIM-Anträge.

## Was gemessen wurde

| | |
|---|---|
| Prüfling | interne KI über die Bridge — Rolle `standard` (gpt-oss-120b) und `stark` (Qwen3.6-35B) |
| Referenzhöhe | Claude Haiku 4.5 · Sonnet 5 · Opus 5 über `npm run eval:skills` (OpenRouter, ~2,50 $) |
| Prompts | **identisch** — beide Spuren lesen dieselbe kuratierte `registry.json`; Stammdaten aus einer Quelle |
| Vorhabensbeschreibung | „Energieeffiziente Gebäudetechnik durch KI" (fiktiv), DOCX 100.264 Z. + PDF-Zwilling 106.091 Z. |
| Umgebung | Variante `local-fiktiv`, eigene IDB `teamflow-zah-local-fiktiv`, 3 fiktive Anträge, 0 Konsolenfehler |

**Die Zwillinge auf OpenRouter (`openai/gpt-oss-120b`, `qwen/qwen3.6-35b-a3b`) wurden bewusst NICHT
als Messwert geführt.** Gleicher Modellname ist keine gleiche Installation: die Reasoning-Stufe von
gpt-oss, Quantisierung und Sampling sind unbekannt, und das Fenster weicht messbar ab (intern 62k
Tokens, OpenRouter 131k). Gemessen wurde deshalb dort, wo die Nutzer arbeiten.

## Der Durchstich trägt

Aufnahme → A–G → Regelprüfung → Feinschliff → Freigabe → DOCX-Export lief vollständig durch:
**sieben Abschnitte in 4 Minuten, 0 Konsolenfehler.** Der Export legte
`Gutachten_EP_ZEP730010.docx` (948,9 KB) im persönlichen Ordner ab, enthält **nur den
freigegebenen** Abschnitt A und stempelt `vorlageRef` mit SHA-256 (Pitfall #33 belegt).
Kein `vbGekuerzt`-Banner — 100.264 von ~238.617 Zeichen Kontextfenster.

## Interne KI, Rolle `standard` (gpt-oss-120b), ein Durchgang

| Abschnitt | Zeichen | Wörter | Befund der Regelprüfung | Denkprozess |
|---|---:|---:|---|---:|
| A Kurzfassung | 1.243 | 149 | **FEHLER** Zeichen 1.243 / max 1.000 | 7.023 |
| B Hintergrund | 6.450 | 725 | Hinweis Wortanzahl 725 (400–500) | 8.968 |
| C Technische Risiken | 889 | 106 | Hinweis Wortanzahl 106 (300–350) | 2.691 |
| D Markt | 1.755 | 203 | — | 6.075 |
| E Unternehmensgegenstand | 451 | 48 | — | 3.251 |
| F Ergebnisverwertung | 711 | 85 | — | 5.470 |
| G Technologiekompetenz | 629 | 69 | **FEHLER** Pflicht-Anfang fehlt | 3.101 |

## Referenzhöhe — dieselben Prompts an Claude

| Abschnitt | Haiku 4.5 | Sonnet 5 | Opus 5 |
|---|---|---|---|
| A | 954 Z. ok *(Hinweis 8 Sätze)* | 956 Z. ok | 1.048 Z. **FEHLER** |
| B | 3.125 Z. *(364 W, Hinweis)* | 3.272 Z. *(367 W, Hinweis)* | 3.881 Z. ok |
| C | 1.605 Z. *(188 W, Hinweis)* | 2.203 Z. *(248 W, Hinweis)* | 2.444 Z. *(288 W, Hinweis)* |
| D–G | ohne Befund | ohne Befund | ohne Befund |

Judge (Sonnet 5, 1–5, Mittel über A–G) — fachliche Korrektheit / Vollständigkeit / Sprachqualität / Regeltreue:

- Haiku 4.5 — 4,00 / 3,43 / 4,71 / 4,14
- Sonnet 5 — 4,29 / 3,57 / 4,43 / 4,57
- Opus 5 — 4,00 / 3,86 / 4,29 / 4,71

**Vollständigkeit ist bei allen dreien die schwächste Achse.** Das ist keine Modellgrenze, sondern
ein Hinweis auf die Prompts: der Richter vermisst durchweg Kapitel der VB, die der Prompt nicht
anfordert.

## Befunde

### 1 · Der automatische Feinschliff zerstört den Pflicht-Anfang (Abschnitt G)

Der schwerste Fund, und er hat nichts mit dem Modell zu tun.

| | Text-Anfang | Prüfung |
|---|---|---|
| Rohentwurf | „Das Vorhaben wird **sehr positive Auswirkungen auf** das FuE-Potenzial und Know-how der Antragsteller **haben**. Im Unternehmen **wird** die Technologiekompetenz im Bereich …" | `ok: Pflicht-Anfang erfüllt` |
| nach Feinschliff | „Das Vorhaben wird das FuE-Potenzial und das Know-how der Antragsteller **erheblich stärken**. Im Unternehmen **erhöht sich** die Technologiekompetenz …" | **`fehler: Pflicht-Anfang fehlt`** |

Der Lektor („Sprachlicher Feinschliff") kennt den `pflichtAnfang` des Abschnitts nicht und
verbessert stilistisch genau den Wortlaut, der wörtlich stehen bleiben muss. Alle drei
Claude-Modelle liefern den Pflicht-Anfang korrekt — das Modell hat geliefert, die Kette hat es
kaputt gemacht. Die Prüfung meldet den Fehler, aber der beschädigte Stand bleibt der angezeigte.

**Vorschlag:** `pflichtAnfang` im Lektor-Prompt als unantastbaren Block führen — oder
`istVerdaechtigGekuerzt` um ein zweites Tor ergänzen, das den Feinschliff verwirft, wenn er eine
zuvor erfüllte `fehler`-Regel bricht. Das zweite Tor ist die kleinere Änderung und deckt auch
künftige Regeln dieser Art ab.

### 2 · Das Zeichenlimit in Abschnitt A ist eine Rollenfrage, keine Modellgrenze

| Lauf | Zeichen | Ergebnis |
|---|---:|---|
| interne KI, Rolle `standard` (gpt-oss-120b) | 1.244 → 1.243 | **FEHLER** (24 % über dem Limit) |
| interne KI, Rolle `stark` (Qwen3.6-35B) | 861 → 867 | ok |
| Claude Haiku 4.5 | 954 | ok |
| Claude Sonnet 5 | 956 | ok |
| Claude Opus 5 | 1.048 | **FEHLER** |
| nach „Mit KI kürzen" (`standard`) | 1.243 → **996** | ok, in 23 s |

Drei Dinge stehen damit fest: das Limit ist erfüllbar, `standard` erfüllt es aus dem Grund-Prompt
nicht, und die vorhandene regelgebundene Korrektur repariert es zuverlässig. Der Feinschliff
dagegen kürzte 1.244 → 1.243 — **um ein einziges Zeichen**, wo 243 fehlten. Er ist kein
Längenwerkzeug und darf nicht als eines gelesen werden.

**Vorschlag:** bei einer verletzten `fehler`-Regel den vorhandenen „Mit KI kürzen"-Lauf einmal
automatisch anhängen, statt den Nutzer den Fehler wegklicken zu lassen.

### 3 · Abschnitt C fordert etwas, das er selbst verbietet

Der Prompt: *„Enthält der Entwurf mehr als drei Risiken, beschränke den finalen Text auf höchstens
drei."* Die Regel: 300–350 Wörter. Drei Risiken à zwei bis drei Sätze ergeben rund 200 Wörter.

| Modell | Wörter | Ziel 300–350 |
|---|---:|---|
| interne KI `standard` | 106 | −65 % |
| Claude Haiku 4.5 | 188 | −37 % |
| Claude Sonnet 5 | 248 | −17 % |
| Claude Opus 5 | 288 | −4 % |

**Alle vier Modelle unterschreiten.** Ein Befund, der über die Modellklassen hinweg gleich
ausfällt, ist kein Modelldefekt. Sonnet 5 hat es im Richter-Text selbst benannt: *„bleibt mit rund
240 Wörtern deutlich unter der vorgegebenen Wortzahl"*.

**Vorschlag:** entweder die Wortzahl auf das senken, was drei Risiken hergeben (~200–260), oder die
Drei-Risiken-Grenze anheben. Beides ist eine Kurator-Entscheidung, keine Code-Änderung.

### 4 · Der Prompt von Abschnitt A widerspricht seinem eigenen Vorgaben-Block

Der kuratierte Text sagt „ca. 10 Sätze (Toleranz **8–12** Sätze)", der automatisch angehängte Block
sagt „Schreibe **9 bis 11** Sätze". Beide stehen im selben Prompt. Haiku lieferte 8 Sätze — nach dem
Prompt-Text korrekt, nach der Regel ein Hinweis.

Genau diese Doppelquelle sollte die Umfang-Deduplizierung beseitigen; der Skill steht auf Fassung 5
und trägt sie noch. `findeUmfangDopplungen` im Skill-Editor meldet den Fall bereits — er wurde nur
nie abgeräumt.

### 5 · Drei Abschnitte werden faktisch nicht geprüft

| Abschnitt | Regeln in der Prüfung |
|---|---:|
| A | 6 |
| B | 5 |
| C, D | 4 bzw. 3 |
| **E, F** | **je 1** |
| G | 3 |

Für E (Unternehmensgegenstand) und F (Ergebnisverwertung) prüft nur die Interpunktions-Regel. Ob
der Text zu kurz, zu lang oder inhaltlich dünn ist, misst nichts — und die internen Läufe waren dort
mit 451 bzw. 711 Zeichen die kürzesten überhaupt. Der Richter gab F bei Haiku eine 2 für
Vollständigkeit, ohne dass die Prüfung etwas gemeldet hätte.

### 6 · PDF statt DOCX: die Struktur geht vollständig verloren

Derselbe Antrag, beide Fassungen durch den `DocConverter` der App:

| | DOCX | PDF |
|---|---:|---:|
| Zeichen | 100.264 | 106.091 *(+5,8 %)* |
| **Überschriften (`#`)** | **44** | **0** |
| **Fettauszeichnung** | 80 | **0** |
| Zeilen mit `\|` | 87 | 187 |
| Zeilen gesamt | 616 | 2.782 |
| Konvertierungs-Hinweise | 7 | 0 |

Das Plus an Zeichen ist kein Gewinn: das Inhaltsverzeichnis wird zu Pseudo-Tabellen
(`| 1 | Ausgangssituation … 4 |`), Kopf- und Fußzeilen laufen mit. Entscheidend ist die Null:
**ohne Überschriften kann die Relevanz-Map keine Abschnitts-Spans bilden** — der VB-Auszug für
`kontextBedarf: 'relevant'` hat auf einer PDF-Quelle nichts, woran er schneiden könnte.

Im erzeugten Text schlägt das gedämpft durch. Abschnitt A, gleiche Rolle (`stark`), nur andere
Quelle: DOCX 867 Zeichen / 8 Sätze, PDF 701 Zeichen / 6 Sätze. Inhaltlich blieb die PDF-Fassung
korrekt und belegt (25 %, DSGVO, neuronale Netze), aber sie entfernt sich weiter vom
Satzzahl-Ziel.

**Fazit:** PDF ist brauchbar, DOCX ist deutlich besser. Wo beides vorliegt, sollte die App die
DOCX-Fassung bevorzugen — heute gewinnt schlicht die zuletzt abgelegte Datei.

## Kleinere Beobachtungen

- **Die Verbindungs-Pille zeigt ein Testergebnis, keinen Zustand.** Sie stand während des ganzen
  Laufs auf „Nicht verbunden", während Abschnitte erfolgreich über die Bridge liefen.
  Ursache nachgelesen ([VerbindungGruppe.tsx:103](../../src/plugins/einstellungen/ki/VerbindungGruppe.tsx)):
  `verbunden = testErgebnis === 'success'`, und `testErgebnis` setzt sich nach
  `setTimeout(…, 5000)` selbst auf `null` zurück. Die Pille sagt also fünf Sekunden lang
  „Verbunden" und danach dauerhaft „Nicht verbunden" — unabhängig davon, ob die Bridge läuft.
  *(Meine erste Notiz „«Verbindung testen» änderte daran nichts" war ungenau: ich habe erst
  6–8 s nach dem Klick gemessen, also nach Ablauf des Fensters.)*
  Der Zustand liegt bereit: [bridge-status.ts](../../src/core/services/ai/bridge-status.ts) ist
  laut eigenem Kopfkommentar die „zentrale Status-Quelle für die Anzeige verbunden/getrennt",
  führt `status: 'connected' | 'disconnected' | 'unknown'` samt `lastSeen` und wird von
  `markActivity` bei **jedem** eingehenden Bridge-Signal gesetzt.

  **Zehn Stellen lesen `s.status`. Genau eine liest ihn nicht — die Pille.** Abgezählt:
  `FeedbackPanel:90`, `BridgeDisconnectHint:23`, `BridgeStatusIndicator:25`,
  `KiConnectPromptDialog:50`, `AufbereitungEvalPanel:181`, `UebersichtTab:81`,
  `useGutachtenWorkflow:233`, `LLMKlassifizierungButtons:64`, `GedaechtnisEvalPanel:240`,
  `AiAssistantCard:22`. `VerbindungGruppe:100` abonniert denselben Store — und liest daraus
  nur `s.rev`.

  Dass es ein **übersehener Nachzug** ist und keine bewusste Abkürzung, steht im Baum:
  [AiAssistantCard.tsx:13](../../src/plugins/home/AiAssistantCard.tsx) trägt den Kommentar
  „Zeigt den LIVE-Verbindungsstatus der internen KI (aus `useBridgeStatus`) — **kein
  hartkodiertes „Nicht verbunden" mehr**". Derselbe Defekt wurde also schon einmal behoben,
  an einem anderen Ort, und diese Stelle blieb übrig. Bekannte Klasse: der gemeldete Ort war
  nicht der einzige.

  **Der Fix ist nicht ganz ein Einzeiler**, weil `status` drei Werte hat und die Pille heute drei
  Zustände kann. Tragfähig:

  ```ts
  const verbunden = s.status === 'connected' || testErgebnis === 'success';
  // „Nicht erreichbar" nur, solange die Bridge NICHT lebt — sonst widerspricht
  // ein alter Fehlversuch einer inzwischen laufenden Verbindung:
  const nichtErreichbar = testErgebnis === 'error' && s.status !== 'connected';
  ```

  Der 5-Sekunden-`setTimeout` darf bleiben — er räumt dann nur noch die Test-**Meldung** weg,
  nicht den Verbindungszustand.

  **Und `'unknown'` muss niemand neu entscheiden** — `BridgeStatusIndicator:36–47` behandelt
  alle drei Werte bereits ausdrücklich, mit Begründung im Kommentar:
  `connected` → grün, `disconnected` → **amber** („handlungsbarer Zustand, kein harter Fehler"),
  `unknown` → **grau** („vor dem ersten KI-Tab kein falsches «getrennt»"). Das ist die Vorlage,
  der die Pille zu folgen hat. Nur der Vollständigkeit halber: die übrigen acht Leser reduzieren
  `status` auf ein `=== 'connected'` und unterscheiden `unknown` gar nicht — die
  Drei-Wege-Behandlung gibt es genau einmal, und sie ist die richtige Referenz.

  Ursache, Zuschnitt und Abzählung aus einer Parallel-Sitzung, hier je selbst nachgeprüft;
  bewusst nicht angefasst.
- **`vorlageRef.pfad` war `Gutachten_VB.DOCX`**, obwohl der Fall ein Einzelvorhaben ist und die
  erzeugte Datei `Gutachten_EP_ZEP730010.docx` heißt. Zu prüfen, ob die Vorlagenwahl der
  Antragsart folgt.
- **Ein Tippfehler überlebte den Feinschliff** („intelligenter Energesteuerung" in G) — der Lektor
  fasst Formulierungen an, nicht Rechtschreibung.
- **Der Denkprozess kommt an**: 2.691–14.904 Zeichen je Abschnitt, über `onReasoning` durchgereicht.

## Empfohlene Reihenfolge

1. **Feinschliff darf keine erfüllte `fehler`-Regel brechen** (Befund 1) — Code, klein, hoher Schaden.
2. **Wortzahl in C an die Drei-Risiken-Grenze angleichen** (Befund 3) — Kuration, kein Code.
3. **Doppelte Satzzahl-Angabe in A abräumen** (Befund 4) — Kuration, kein Code.
4. **Automatische Korrektur bei verletzter `fehler`-Regel** (Befund 2) — Code, mittel.
5. **Regeln für E und F ergänzen** (Befund 5) — Kuration.
6. **DOCX vor PDF bevorzugen, wenn beide vorliegen** (Befund 6) — Code, klein.

## Grenzen dieses Laufs

- **Ein Durchgang je Abschnitt.** Ein LLM-Lauf ist eine Stichprobe ohne Fehlergrenze. Belastbar
  sind nur die Befunde, die über mehrere Modelle hinweg gleich ausfallen (3, 4, 5) oder
  deterministisch sind (1, 6). Die Einzelzahlen der Tabellen sind Beispiele, keine Mittelwerte.
- **Eine Vorhabensbeschreibung.** Zwei weitere fiktive Anträge liegen als Fixture bereit und sind
  per Resume nachschiebbar (`eval-out/referenz/results.jsonl`).
- **Der Feinschliff läuft nur in der App**, nicht im Referenz-Harness. Verglichen wurden deshalb
  Rohentwurf gegen Claude-Ausgabe; die App-Zahlen tragen zusätzlich den Feinschliff.
- **Nicht geprüft:** `file://`-Betrieb, Team-Schreibpfade auf dem echten Share.

## Isolation — nachgewiesen

Der echte Datenbestand wurde nicht angefasst. `teamflow-zah-local-fiktiv` ist eine eigene IDB, die
Datenwurzel `fzd-SMB-Root-FIKTIV` eine eigene Ablage. Der einzige Schreibzugriff auf den echten
Share am Messtag stammt nachweislich von einer **fremden, schon laufenden Instanz**:

```text
fzd-SMB-Root-mit-csv\...\online-status.json   →  "Local Dev",  App 6.12.1  (Port 5175, fremd)
fzd-SMB-Root-FIKTIV\...\online-status.json    →  "Fiktiv Dev", App 6.13.0  (Port 5176, dieser Lauf)
```

Der echte CSV-Export blieb an diesem Tag unverändert.
