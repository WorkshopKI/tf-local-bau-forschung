# Die beiden Status-Achsen

Über einem Antrag stehen zwei Angaben, die leicht für dasselbe gehalten werden:
sein **Verfahrensschritt** und seine **Arbeitsliste**. Sie beantworten
verschiedene Fragen, gehören verschiedenen Leuten, und genau eine von ihnen ist
beweglich.

| | Verfahrensschritt (ZAH-Phase) | Arbeitsliste (`StatusCategory`) |
|---|---|---|
| **Frage** | Wo im Verfahren steht der Vorgang? | Wer ist am Zug — oder ist es erledigt? |
| **Wirkt auf** | Verfahrensleiste, Filter-Gruppierung, Zieltage, Stillstands-Wächter | Reiter, Abschnitte, Farben und Kanban-Lanes in *Förderanträge* |
| **Wohnt in** | der Katalog-Fassung (`MappingVersion.zahPhasen`) | dem Code (`core/utils/status-canonical.ts`) |
| **Ändert wer** | die PL im Baum-Editor der Vorgangs-Regeln | niemand zur Laufzeit |
| **Anzahl** | 3 bis 9, ausgeliefert 6 | fest 9 |

Beide hängen zusammen, aber nur in eine Richtung: jede Phase trägt eine
`kategorieVorgabe` — die PL entscheidet, in **welche** Arbeitsliste ein Schritt
einzahlt, nicht **welche** Arbeitslisten es gibt.

```
Rohtext → amtlicher Code → Verfahrensschritt → Arbeitsliste
          (status-codes)    (zahPhasen,         (kategorieVorgabe,
                             kuratierbar)        + 4 Code-Ausnahmen)
```

## Warum die eine beweglich ist

Der Phasenzuschnitt ist **strittig**. Die Abstimmung mit AB und FB hat ergeben,
dass er mehrfach geändert werden wird — ein Code-Release je Iteration ist dafür
zu langsam. Seit v2.409 ist er deshalb Fassungs-Daten: Anzahl zwischen 3 und 9,
Beschriftung frei, Zuordnung per Zug im Baum.

## Warum die andere fest ist

Die Arbeitsliste ist das, worauf die ABs **täglich** schauen. Wären beide Achsen
frei, könnte eine Iteration am Verfahrensschnitt nebenbei ganze Reiter leeren —
und niemand sähe den Zusammenhang. Zwei frei einstellbare Achsen mit
überlappenden Wörtern wären außerdem genau das Durcheinander, gegen das die
Umbenennung unten geschrieben ist.

Festgehalten von `status-category-not-curated`: kein Feld der Fassung führt eine
Liste von `StatusCategory`.

## Die Umbenennung von v2.409

Vier der neun Arbeitslisten hießen wortgleich wie ein Verfahrensschritt
(„Prüfung", „Entscheidung", „Begleitung", „Abgeschlossen"). Zwei Spalten
nebeneinander, halb dieselben Wörter, und keine sagte wozu — das liest jeder als
Widerspruch. Die Wortwahl folgt jetzt der Frage, die die Arbeitsliste
beantwortet:

| Schlüssel | Bezeichnung | Kurzform |
|---|---|---|
| `offen` | Zu bearbeiten | Zu bearb. |
| `in_pruefung` | In Arbeit | In Arbeit |
| `nachforderung` | Wartet auf Antragsteller | Bei Antragst. |
| `entscheidung` | Zu entscheiden | Zu entsch. |
| `bewilligt` | Bewilligt | Bewilligt |
| `begleitung` | Begleitung | Begleitung |
| `abgelehnt` | Abgelehnt | Abgelehnt |
| `abgeschlossen` | Erledigt | Erledigt |
| `sonstige` | Ohne Zuordnung | Ohne Zuord. |

**Nachtrag v2.413.1:** `entscheidung` hieß zunächst „Entscheidungsreif". Das war ein
unschrumpfbares Einzelwort von 117 px und passte in die 170-px-Lanes des Kanban
nur mit Ellipse — abgekürzt las es sich wieder wie der Verfahrensschritt
„Entscheidung", also genau die Verwechslung, die v2.409 beseitigt hat. Die
Verbform „Zu entscheiden" bricht an der Wortgrenze (83 px, zweizeilig) und reiht
sich neben `offen` in dieselbe Frageform ein. Gemessen bei 1280 und 1024 px über
sieben Lanes: keine Bezeichnung kürzt mehr ab.

`begleitung` bleibt bewusst stehen, obwohl es mit einem Phasennamen kollidiert:
es ist das eingeführte Wort der Fachseite. Diese eine Dopplung wird
gegebenenfalls über die **Phasen**beschriftung aufgelöst — die ist beweglich.

Die Schlüssel im Datenmodell sind unverändert; nur die Anzeige heißt anders.

## Die abgeleiteten Achsen

*Förderanträge* zeigt die Arbeitslisten nicht einzeln, sondern in gröberen
Töpfen: eine 5er-Pille und sieben Abschnitte. Dafür gilt **eine** Regel:

- Was **1:1** einer Kategorie entspricht, erbt deren Namen
  (`getStatusCategoryLabel`). Kein zweites Vokabular.
- **Zusammenfassungen** bekommen einen eigenen Namen, der mit keiner
  Kategoriebezeichnung übereinstimmt. Ein Reiter „Zu bearbeiten", der drei
  Kategorien meint, von denen eine ebenfalls so heißt, wäre die Verwechslung nur
  eine Ebene höher.

| Abschnitt | Kategorien | Name | Art |
|---|---|---|---|
| `vor-entscheidung` | offen + in_pruefung + entscheidung | **Vor Entscheidung** | Aggregat |
| `nachforderung` | nachforderung | Wartet auf Antragsteller | 1:1 |
| `bewilligt` | bewilligt | Bewilligt | 1:1 |
| `begleitung` | begleitung | Begleitung | 1:1 |
| `beendet` | abgeschlossen + abgelehnt | **Beendet** | Aggregat |
| `abgelehnt-zurueckgezogen` | Rohwert `abgelehnt/zurückgezogen` | Abgelehnt/Zurückgezogen | Rohwert-Schnitt |
| `ohne-zuordnung` | sonstige | Ohne Zuordnung | 1:1 |

Der Arbeitsvorrat/Archiv-Split des „Alle"-Reiters erbt: **Arbeitsvorrat**
(nicht-terminal) und **Beendet** — dieselbe Menge wie der gleichnamige Bucket,
also derselbe Name.

Festgehalten von `status-labels-single-source` (keine Kategoriebezeichnung als
Literal außerhalb der Einzelquelle) und `status-label-namensraeume-disjunkt`
(Aggregatnamen decken sich mit keiner Kategoriebezeichnung).

## Die dritte Beschriftung: der ROHSTATUS (v3.16)

Unter beiden Achsen liegt der rohe Statuswert aus dem Export — und der hatte
dieselbe Krankheit eine Ebene tiefer. Bis v3.16 führten **drei** Module ihre
eigene Kurzform desselben Werts: `STATUS_LABELS` (26 Paare),
`STATUS_LABEL_OVERRIDES` in der Suche (4 Paare, abweichende Schreibweise, ein
Tippfehler „Wiederspr.") und ein Literal im Arbeitsvorrat. Derselbe Status sah
je nach Ansicht anders aus, und die `STATUS_LABELS`-Fassung für Code 72 war auf
eine Schreibweise geschlüsselt, die im Produktivbestand gar nicht vorkommt — sie
hat dort **nie** gegriffen (29 Fälle).

Dieselbe Auflösung wie bei den Kategorien, nur mit einer Kurationsstufe mehr:

| Stufe | Wo | Wer pflegt |
|---|---|---|
| `fassung` | `StatusWertEintrag.kurzLabel` | die PL, je **Code** (`setzeKurzLabel`) |
| `katalog` | `StatusCodeEintrag.kurz` | wir, mit der Auslieferung |
| `ohne` | gekürzter Bezeichner + „…" | niemand — sichtbar unfertig |

Gelesen wird über **`statusKurzLabel()`** (enge Flächen) und **`statusLabel()`**
(Tooltip, Export, Prompt) aus [status-wert-labels.ts](../../src/core/utils/status-wert-labels.ts).
Zwei Eigenschaften unterscheiden das von der Kategorie-Fassade:

- **Je Schlüssel durchfallen**, nicht die ganze Map tauschen. Sonst nähme eine
  Fassung, die eine Schreibweise nicht führt, ihr die Kurzform weg — der Fehler,
  den `mitAmtlichenSchreibweisen` für die Kategorie beheben musste.
- **Kuratiert wird am CODE**, nicht an der Wert-Id: derselbe Code steht unter
  `status` UND `verbund_status`, und `snapshot.ts` kollabiert beide auf einen
  Schlüssel („letzter gewinnt"). Dieselbe Begründung wie bei `setzeCodePhasen`.

Die Kurzform ist **unsere** Beschriftung und deshalb groß geschrieben, wo `text`
amtlich klein ist (`bewilligt` → `Bewilligt`). Der Tooltip zeigt den amtlichen
Text — das ist kein Fehler, sondern die Trennung von Fremddaten und Kuration
(Pitfall #43). Wer die Schreibweise im Tooltip ändern will, pflegt das
kuratierte `label` am Statuswert.

Festgehalten von `status-kurzlabel-single-source` (Herkunft + Literal-Sperre) und
`label-identitaet.test.ts` (Snapshot-Pfad = eingebauter Pfad).

## Wo was steht

| Was | Wo |
|---|---|
| Die neun Bezeichnungen + Farben | [status-category-labels.ts](../../src/core/utils/status-category-labels.ts) |
| Die Rohstatus-Beschriftung (kurz + voll) | [status-wert-labels.ts](../../src/core/utils/status-wert-labels.ts) |
| Die ausgelieferten Kurzformen | [status-codes.ts](../../src/core/status/status-codes.ts) |
| Die Kategorie-Achse selbst | [status-canonical.ts](../../src/core/utils/status-canonical.ts) |
| Die Phasen-Tabelle + das Register | [zah-phasen.ts](../../src/core/status/zah-phasen.ts) |
| Grenzen, Umhängen, Verwaiste | [zah-phasen-edit.ts](../../src/core/status/zah-phasen-edit.ts) |
| Phase + Code → Kategorie | [kategorie-ableitung.ts](../../src/core/status/kategorie-ableitung.ts) |
| Die sieben Abschnitte | [antragGroups.ts](../../src/plugins/antraege/antragGroups.ts) |
| Der Baum-Editor | [PhasenBaum.tsx](../../src/plugins/status-cockpit/PhasenBaum.tsx) |

## Ids statt Namen als Schlüssel

Die Abschnitte werden über eine stabile `id` gekeyt, nicht über ihren
Anzeigenamen. Vorher standen die Namen selbst im `localStorage` (Zuklapp-Zustand
je Abschnitt), samt einer Migration, die beim Hinzukommen eines Abschnitts
nachrüstete — Namen als Schlüssel zu führen war die eigentliche Ursache dieser
Migration.

Der Umstieg lief **ohne** Migration: alte Einträge tragen Namen, die keiner Id
entsprechen, und werden beim Lesen verworfen. Der gespeicherte Zuklapp-Zustand
ging damit einmalig verloren.

## In `prod`

`statusCockpit` ist in `dev`, `pl`, `kurator`, `as` und `local` an — nur `prod`
läuft ohne Fassung. Dort gilt der ausgelieferte Phasenschnitt aus
`SEED_ZAH_PHASEN`, und die Kategorie-Ableitung läuft über die eingebaute
`CATEGORY_MAP`. Ein kuratierter Schnitt kommt dort über den nächsten Release an;
bis dahin verhält sich `prod` exakt wie vor v2.409 (`byte-identitaet`).
