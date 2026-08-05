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
| **Ändert wer** | die PL im Baum-Editor des Status-Katalogs | niemand zur Laufzeit |
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
| `entscheidung` | Entscheidungsreif | Entsch.-reif |
| `bewilligt` | Bewilligt | Bewilligt |
| `begleitung` | Begleitung | Begleitung |
| `abgelehnt` | Abgelehnt | Abgelehnt |
| `abgeschlossen` | Erledigt | Erledigt |
| `sonstige` | Ohne Zuordnung | Ohne Zuord. |

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

## Wo was steht

| Was | Wo |
|---|---|
| Die neun Bezeichnungen + Farben | [status-category-labels.ts](../../src/core/utils/status-category-labels.ts) |
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
