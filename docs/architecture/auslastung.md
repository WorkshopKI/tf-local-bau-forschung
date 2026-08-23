# Auslastungs-Modul (Plugin "auslastung", v2.15)

Plugin (`id: 'auslastung'`, `category: 'workflow'`, `kuratorOnly: false`, sichtbar wenn `features.auslastung === true`) für automatische Antrags-Klassifizierung in Überkategorien + MA-Zuweisung mit dreistufigem Matching. Quartalsbasierte Kapazitäts-Planung.

## Datenschutz-Kernprinzip

**MAs sind im gesamten Modul nur als anonyme IDs (MA01-MAxx) sichtbar**; echte TIB-Kürzel kommen in Profil-Daten ausschließlich im RAM während eines passwortgeschützten XLSX-Exports vor und werden nicht in `auslastung.json` gespeichert.

**Ausnahme**: die Sidecar-Datei `_intern/auslastung-kuerzel-map.json` enthält das Mapping `kuerzel ↔ anonId` als Klartext. Diese Datei ist nötig, weil Selbsteintragungen pro User ihre eigene anonId stabil auflösen müssen und eine echte Verschlüsselung dies brechen würde. Sicherheits-Effekt vs. dem alten ephemeral-Sort-Modell: effektiv unverändert, da die antraege selbst `tib_kuerz` als Klartext-Spalte enthalten und das Mapping daraus trivial ableitbar war. Die persistente Datei macht das Mapping explizit und stabilisiert die anonIds gegen alphabetische Re-Sort-Drift bei neuen Kürzeln. Profil-Daten (Kapazität, Zuweisungen, Kategorien) in `auslastung.json` referenzieren MAs weiterhin nur über anonId.

## 5 vordefinierte Überkategorien

Aus FZD-Kontext, im Admin editierbar: `IT` Industrielle Technologien, `DT` Digitale Technologien, `EU` Energie- und Umwelttechnologien, `LG` Lebens- und Gesundheitswissenschaften, `NM` Naturwissenschaftliche Methoden.

## Performance (v2.13)

Re-Mount-Latenz von 7 s → <1 s. Drei Hebel kombiniert:

- **Hebel C — Aggregate im Store**: `anonymMap`, `verbuendeById`, `historischeDeskriptorenByAnon`, `historischeAstByAnon`, `allDeskriptoren` wandern aus den Component-`useMemo`-Kaskaden in den `useCacheStore`. Single-Pass-Aggregationen über 5000+ Antraege laufen genau einmal pro Daten-Load (nicht pro Tab-Mount). `ensureAggregates()` rechnet nach, wenn die kuerzel-map später ankommt.
- **Hebel A — Banner immer sichtbar**: Der `if (!loaded)` Early-Return in `AuslastungView` ist weg. Header + Lade-Anzeige rendern ab dem ersten Mount, Tabs kommen unter `loaded && (...)`.
- **Hebel B1 — Plugin `onInit`-Pre-Cache**: Auslastung-Plugin lädt `useAuslastungData` + `useKuerzelMap` parallel beim App-Start (non-blocking, fehlertolerant). `warmupAntraegeCache` wird via `useActiveProgramm`-Subscribe getriggert sobald die programmId steht.

Generisches Pattern für andere Plugins mit derselben Symptomatik: [docs/agents/optimize-remount-latency.md](../agents/optimize-remount-latency.md).

## Ladezustand & Vorwärmen (v2.352)

**Ein** Ladezustand, drei Phasen. `useAuslastungReady()` ist die einzige Quelle dafür, was gerade hängt; die Präzedenz steckt in der reinen `bestimmeLadePhase` (`auslastungsdaten` → `antraege` → `themenvektoren`). Angezeigt wird sie an genau zwei Stellen, die **keinen** zusätzlichen Platz kosten: als Zusatz in der Kopf-Zeile (`79 MAs · 5 Kategorien · Q3 · Anträge laden …`) und als 2 px hohe, unbestimmt laufende Leiste darunter ([ModulLadeStreifen](../../src/plugins/auslastung/components/ModulLadeStreifen.tsx), CSS-Klasse `.tf-ladeleiste` in `theme.css`). Der Tab-Inhalt ist bis `ready` abgedimmt und nicht bedienbar (`LadeDimmer` in `AuslastungView`, ein Wrapper für alle Tabs); vor `loaded` steht dort ein Seiten-Skeleton statt einer leeren Fläche.

Zwei harte Regeln:

- **Der Themen-Vektor-Korpus geht NICHT in `ready` ein.** Sein Download vom Datenspeicher kann Minuten dauern; die Seite ist derweil voll bedienbar (leere Themen-Vorschläge statt gesperrter Oberfläche). Er meldet sich nur als Phase — über den Spiegel-Store [useKorpusLadeStatus](../../src/plugins/auslastung/hooks/useKorpusLadeStatus.ts), nicht über den Versions-Zähler `corpus-signal.ts`.
- **Diagnose-Banner erst nach `ready`.** `baueVollstaendigkeitsHinweise` gibt bei `datenBereit: false` immer `[]` zurück. Die Gate-Flags (`xtecAzSet`/`advAzSet`) entstehen erst in Phase 2 des Cache-Loads; wer sie vorher liest, meldet „kein Antrag trägt dort ein gültiges Datum" und schickt den User grundlos ins CSV-Mapping. Das galt bis v2.351 bei **jedem** ersten Modul-Aufruf. Gleiches gilt für jede künftige Diagnose, die auf Stream-Artefakten fußt.

**Vorwärmen in zwei Anläufen.** Der `onInit`-Anlauf (Hebel B1) läuft in `App.tsx` **vor** dem Daten-Share-Grant; `useAuslastungData.load` setzt `loaded` aber bewusst nur bei lesbarem Share (v2.19.2), am Cold-Start bleibt er also meist wirkungslos — der SMB-Roundtrip auf `_intern/auslastung.json` (~0,5–2 s) fiel dem User beim ersten Klick zur Last. Deshalb stößt `nachStartDatenupdateVorwaermen` ([index.tsx](../../src/plugins/auslastung/index.tsx)) dieselben Loads einmalig erneut an, sobald `useStartupDataStatus.phase === 'done'` meldet (Pass fertig oder kein Share vorhanden) — im Idle-Fenster, alle Loads idempotent. Der Antraege-Cache läuft dabei über `refreshAntraegeCacheIfStale`, das den Snapshot-Versions-Vergleich mit dem Mount-Hook `useAntraegeCacheSnapshotRefresh` teilt (eine Implementierung, zwei Aufrufer) und einen noch laufenden Warmup abwartet, statt einen vor-Update-Stand stehen zu lassen. Reine Vorarbeit: kommt der User schneller, laden die Mount-Effekte der View wie bisher.

## Tabs (`AuslastungView`)

**Workflow-Revision 1.17 (v2.1)**: 3 Tabs statt 5 — Klassifizierung · Zuweisung (50/50-Split-Cockpit) · Übersicht (fusioniert ehemalige Kapazität + Admin). Selbsteintragung wandert auf die Homepage als Sektion `NeueAntraegeFuerDich` (Plugin "home"). Sichtbarkeit "PL-only" über Build-Variante (`features.auslastung` nur in `pl.config.json`/`dev.config.json`) — kein in-app-Rollencheck mehr. „Meine Technologien" als Tab im Einstellungs-Plugin.

Selbsteintragung-UX auf der Home:
- Pro Antrag: Aktenzeichen | Primär-Pill (gefüllt) | Aspekt-Pills (outline) | Titel | Frist „Noch X Tage" | „Übernehme ich"-Button.
- Kapazitätszeile zeigt **Anträge** ("4 von 16 Anträgen frei in Q2-2026"), keine Stunden.
- Banner-Hint „X neue Anträge in deinen Kategorien" via `useBenachrichtigung`-Hook + localStorage pro `anonId`.

## Status-Filter im Zuweisungs-Cockpit (v2.288)

Die Status-Pills der Verbund-Liste (`offen` · `Übernahme-Wunsch` · `zugewiesen` · `alle`) leiten sich aus der einen Quelle `verbundStatusFlags` ab ([cockpit-helpers.ts](../../src/plugins/auslastung/views/cockpit-helpers.ts)) — Filterung und Pill-Counts lesen dieselbe Funktion.

- **`offen` heißt „niemandem zugewiesen"**, nicht „ohne jeden Eintrag". Ein Übernahme-Wunsch (`Zuweisung.status: 'selbst'`) ist eine **Bewerbung**, keine Zuweisung: der Verbund bleibt offen, bis die PL freigibt. `offen` und `Übernahme-Wunsch` überlappen dadurch bewusst (Summe der Counts > `alle`) — vorher fielen eingesammelte Wünsche aus `offen` heraus, noch nicht eingesammelte (Pending) dagegen nicht, was denselben Antrag je nach Einsammel-Zeitpunkt unterschiedlich einsortierte.
- Das Flag darf **nicht** an `selbstEingetragen` hängen: es überlebt die Freigabe (selbst eingetragen + freigegeben = zugewiesen, nicht offen).
- Die Liste zeigt die Interessenten als Kürzel-Badges („will MA03 MA07", ab 4 gekürzt auf `+N`; in pl/dev echte TIB-Kürzel über `deAnonymisierung`) — wer übernehmen möchte, ist ohne Klick sichtbar. Reihenfolge = früheste Vormerkung zuerst, geteilte Logik `interessentenNachWunschzeit` (Liste + Detail-Panel). Davon getrennt bleibt das amber `⚑ N vorgemerkt` für Wünsche, die noch in den persönlichen Ordnern liegen.
- **`Übernahme-Wunsch` zählt beide Stände**: Store-`selbst` **und** noch nicht eingesammelte Vormerkungen (`pendingByAntrag`) — genau das, was die Zeile mit `⚑ N vorgemerkt` anzeigt. Sonst markiert die Liste einen Wunsch, den der Filter nicht findet. Bucket-Funktion `statusBucketsOfRow`, siehe unten.

## Filter-Zähler = Zeilenzahl (Facetten-Semantik)

Die Pillen beider Tabs („Anträge klassifizieren" + „Anträge zuweisen") zählen **je Facette über die Zeilen, die die anderen aktiven Filter bereits passiert haben** — der eigene Filter wird ausgenommen ([facetCounts.ts](../../src/plugins/auslastung/views/facetCounts.ts)). Dieselbe Regel wie `computeFacetCounts` in der Förderanträge-Sidebar.

- **Invariante**: *was die Pille anzeigt, ist die Zeilenzahl nach dem Klick auf sie* — abgesichert durch einen Test über alle Filter-Kombinationen ([facetCounts.test.ts](../../src/plugins/auslastung/__tests__/facetCounts.test.ts)). Vorher zählten die Pillen über den gesamten Pool: Kategorie `DT 30` + Antragstyp `FuE 16` → Liste zeigte 9.
- `Alle` ist die „Alle"-Zahl **dieses** Segments (Filter zurückgesetzt), nicht die Pool-Größe.
- Die Zähl-Einheit ist der **Verbund**, nicht das TV — im Auslastungs-Modul wird ein Verbund als Ganzes zugewiesen.
- Bucket-Funktionen sind die **einzige** Quelle für Filterung *und* Zählung (`kategorienOfRow`/`antragstypBucketsOfRow`/`statusBucketsOfRow` in [cockpit-helpers.ts](../../src/plugins/auslastung/views/cockpit-helpers.ts), `viewFilterBucketsOf` in KlassifizierungsReview). Zwei getrennte Implementierungen brechen die Invariante sofort.
- Eine Zeile darf in mehreren Werten **derselben** Facette liegen (Primär + Aspekt-Kategorien; `offen` + `Übernahme-Wunsch`). Die Bucket-Summe übersteigt dann `Alle` — kein Fehler.
- **Bewusst pool-weit** bleiben Kennzahlen, die nicht die Ansicht beschreiben: die Zahl an „Hohe Confidences freigeben" (die Aktion wirkt auf alle Verbünde — Knopf, Bestätigungsdialog und Aktion teilen `bulkFreigabeKandidaten`) und der Centroid-Hinweis.

## Lebenszyklus eines Übernahme-Wunsches (v2.290)

Ein Wunsch lebt in der persönlichen Datei `ZAH/auslastung-uebernahme.json` (Quelle der Wahrheit) und als Kopie im Store (`Zuweisung{status:'selbst'}`, entsteht erst beim PL-Einsammeln). Er endet auf genau zwei Wegen:

- **Rücknahme durch den MA** — „Rückgängig" schreibt die persönliche Datei ohne den Wunsch. Das Cockpit liest die persönlichen Ordner beim Öffnen ohnehin read-only, also verschwindet der Wunsch **sofort** aus Liste, Filter und Zählern: `findeZurueckgezogeneWuensche` vergleicht die Store-`selbst`-Einträge gegen den frisch gelesenen `WunschStand` ([uebernahme-einsammeln.ts](../../src/plugins/auslastung/services/onboarding/uebernahme-einsammeln.ts)). Der Einsammel-Klick persistiert nur denselben Befund. Beurteilt werden ausschließlich anonIds mit **gelesener Datei** (sonst wäre „fehlt in der Datei" nicht von „Datei nicht gelesen" unterscheidbar) — identische Regel wie die Retraktion im Merge. Die PL sieht in der Toolbar „N zurückgezogen" mit Tooltip (wer → Akronym · Aktenzeichen).
- **Erledigung** — sobald der Verbund vergeben ist (Freigabe im Store oder `tib_kuerz` in der CSV), räumt `useMyUebernahmeWuensche` den Wunsch beim nächsten Laden aus der persönlichen Datei (Prädikat `istErledigt`, nur positive Evidenz löscht). Ohne das wüchse die Datei monoton und die Einsammel-Bilanz meldete dauerhaft längst zugewiesene Wünsche als „gelesen".

Regel dazu: Der Merge fasst **nur `status:'selbst'`** an. `selbstEingetragen` überlebt die Freigabe — würde die Retraktion daran hängen, löschte das Selbst-Aufräumen des MA die Freigabe gleich mit. Die Einsammel-Bilanz weist `bereitsVergeben` separat aus, damit die Differenz „gelesen" vs. „neu + zurückgezogen" erklärt ist.

### Der Merge legt nur an, was die Liste auch zeigen kann

Die MA-seitige Erledigungs-Bereinigung greift erst, wenn *dieser* MA seine Startseite öffnet. Bis dahin liest die PL Wünsche auf Anträge, die längst extern gekürzelt oder aus dem rollierenden Fenster gefallen sind. `mergeWuenscheIntoZuweisungen` prüft solche Wünsche deshalb gegen denselben Pool wie die Liste (`buildZuweisbarkeitsPruefung` → `istZuVerteilen`) und legt **keinen** Record an; die Bilanz nennt sie als `nichtZuweisbar` mit Grund im Tooltip (`unbekannt` / `gekuerzelt` / `ausserhalb-pool`).

Ohne diese Prüfung entstand ein Kreislauf: der Record war unsichtbar (die Liste führt den Antrag nicht), buchte aber Pending-Stunden auf den wünschenden MA — und `reconcileZuweisungen` warf ihn beim nächsten Sessionstart weg, sodass das Einsammeln ihn ewig neu als „neu" meldete („14 gelesen · 14 neu" bei Pille `Übernahme-Wunsch 0`).

Verwandt: `reconcileZuweisungen` kollabiert eine (Verbund, Quartal)-Gruppe nur noch, wenn sie eine **Freigabe** enthält. Reine Interessenten-Gruppen bleiben vollständig — mehrere Bewerbungen vor der Freigabe sind erlaubt (Pitfall #26); vorher blieb nach einem App-Neustart nur ein Interessent übrig.

## Zuweisung ≠ Vollzug: das CSV bestätigt (v2.291)

Das eigentliche Zuweisen passiert im **Fachsystem**. Die App-Freigabe (`Zuweisung{status:'freigegeben'}`) ist die Absichtserklärung; vollzogen ist sie erst, wenn der CSV-Export das `tib_kuerz` am Antrag zurückmeldet — frühestens am Folgetag, über ein Wochenende später. Das Warten ist damit der **Normalzustand**, nicht die Ausnahme, und wird benannt statt versteckt:

- **MA-Sicht** (Home „Neue Anträge für dich"): drei Zeilen-Zustände statt zwei — offen · vorgemerkt · **zugewiesen** („Dir zugewiesen · Bestätigung folgt"). Die zugewiesene Zeile hat **keine Aktion**: die Entscheidung ist im Fachsystem gefallen, der MA kann sie in der App nicht zurückgeben. `zugewiesen` schlägt `claimed` und überlebt das Rücknahme-Overlay ([neueAntraegeVerbund.ts](../../src/plugins/home/neueAntraegeVerbund.ts)).
- **Fremd vergeben**: Verbünde mit Freigabe an einen *anderen* MA fallen aus dem Angebot — verbund-weit über `verbundKeyOf`, weil `assignVerbund` die Freigabe nur auf den Lead-TV schreibt. Vorher blieben sie bis zum CSV-Nachzug vormerkbar.
- **PL-Sicht** (Cockpit): die Zuweisungs-Liste enthält per Definition nur Anträge **ohne** `tib_kuerz` — jede Freigabe darin ist also unbestätigt. Der Detail-Streifen benennt das (`CSV-Bestätigung offen · N T`), und ab `BESTAETIGUNG_FAELLIG_TAGE` (3, deckt ein Wochenende) markiert die Liste die Zeile amber (`⧗ N T`, [cockpit-helpers.ts](../../src/plugins/auslastung/views/cockpit-helpers.ts)). Das fängt den teuren Fall: im Fachsystem wurde anders entschieden, die App-Freigabe blockiert sonst unbefristet Kapazität, weil nichts sie ausaltert.

Kommt die Bestätigung an, räumt `reconcileZuweisungen` die App-seitigen Records des Antrags weg (CSV = Wahrheit) und der Verbund fällt über `istZuVerteilen` aus dem Verteil-Pool.

## Der Korpus wird in der KURATION gebaut, nicht hier (v4.127)

Die Themen-Vektoren sind zugleich der **Vektorindex der Ähnlichkeitssuche** — das Modul ist ihr
zweiter Konsument, nicht ihr Eigentümer. Bau, Abgleich und Spiegelung liegen deshalb in
**Kuration → „Suche & Index" → „Vektoren der Ähnlichkeitssuche"**
([EmbeddingKorpusSection](../../src/plugins/kuration/suche-index/sections/EmbeddingKorpusSection.tsx)
+ [useKorpusBau](../../src/plugins/kuration/suche-index/hooks/useKorpusBau.ts)). Hier steht nur noch
die read-only Statuskarte ([EmbeddingCorpusSection.tsx](../../src/plugins/auslastung/views/admin/EmbeddingCorpusSection.tsx)):
habe ich Vektoren, sind sie aktuell, wo werden sie gebaut.

Warum der Umzug: der Aufbau-Knopf hing an `isDevContext()` und existierte damit in `zah-pl`
**gar nicht**, während drei Texte in der App dazu aufforderten, ihn zu klicken. Das Kurator-Schloss
der Kurationsseite ist zudem die schärfere Grenze als der Experten-Schalter, hinter dem der Reiter
„Verwaltung" hier ohnehin liegt.

Was der Bau unverändert tut: drei Phasen (Vorhaben → Verbünde → Centroids), Build-Lock über den
ganzen Lauf **inklusive** Upload, RAM-Warnung vorweg. Die Centroids gehen weiterhin nach
`auslastung.json` — dafür greift die Kuration in dieses Modul (dieselbe Kopplungsrichtung, die
`home`, `antraege` und `einstellungen` schon haben; umgekehrt importiert das Modul nichts aus der
Kuration).

Der **Verbund**-Korpus bleibt Modul-Sache: ihn liest außerhalb der Klassifizierung niemand, sein
Start-Download hängt weiter an `isAuslastungFreigeschaltet()`. Der **Vorhaben**-Korpus nicht mehr —
siehe [runtime-layers.md](runtime-layers.md#der-vektorindex-der-suche).

## MA-Selbst-Profil über persönlichen Ordner (v2.6)

Der „Meine Technologien"-Tab kann `auslastung.json` nicht direkt schreiben — Nicht-Kuratoren haben seit v2.0 nur `read` auf dem Daten-Share. Stattdessen:

- **User schreibt** sein Selbst-Profil (`manuelleTechnologien`, `ausgeblendeteAutoTags`, `hauptKategorie`, `nebenKategorien`, `antragstypBevorzugt`) nach `ZAH/auslastung-profil.json` im eigenen Ordner — `writeAuslastungProfil` in [services/persoenliches-profil.ts](../../src/plugins/auslastung/services/identitaet/persoenliches-profil.ts) (+ IDB-Cache für Cross-Browser/Offline).
- **Tab hydratisiert** beim Mount via `loadAuslastungProfil` (persönlicher Ordner → IDB-Cache, LWW über `updatedAt`) und priorisiert das gegenüber dem `auslastung.json`-Record.
- **PL sammelt ein**: Button „Team-Profile einsammeln" in der Übersicht ([MaListSection.tsx](../../src/plugins/auslastung/views/uebersicht/MaListSection.tsx)) → `collectUserProfiles` (User-Folders-Root, Iterations-Muster wie FeedbackInboxTab) → `mergeProfilesIntoMitarbeiter` ([services/profil-einsammeln.ts](../../src/plugins/auslastung/services/onboarding/profil-einsammeln.ts)) → Store-Action `applyAggregatedProfiles` (EIN setState + EIN persist). Merge mappt `kuerzel → anonId` (NFC), überschreibt nur die MA-pflegbaren Felder und lässt PL-only-Felder (`jahresKapazitaet`, `abschlagProzent`, `aktiv`, `abgemeldet`, `antragstypUeberschreibung`) unangetastet; unbekannte Kürzel legen neue MAs an.

Siehe CLAUDE.md Pitfall #24 + [v2-handle-architektur.md](v2-handle-architektur.md).

## Antragstyp-Präferenzen pro MA (v2.2)

Zusätzlich zur fachlichen `hauptKategorie` (IT/DT/EU/LG/NM) pflegt jeder MA eine **Antragstyp-Präferenz** — welche der vier Buckets FuE/DS/DL/NW er bearbeitet (Mapping auf `vb_phase`: 3=FuE, 5=DS, 4=DL, 1+2=NW, 9=Irrläufer). Zwei Felder am `AnonymerMitarbeiter`:

- `antragstypBevorzugt?: AntragstypBucket[]` — vom MA selbst gepflegt in **Einstellungen → Meine Technologien**.
- `antragstypUeberschreibung?: AntragstypBucket[]` — vom PL gepflegt in der Mitarbeiter-Tabelle (UebersichtView, Spalte „Antragstypen"). Hat Vorrang. Leeres Array → MA-Präferenz greift wieder.

Filter-Logik in `services/antragstyp-praeferenz.ts`:
- `getEffectiveAntragstypen(ma): AntragstypBucket[] | null` — 4-stufig (v2.60): Override > Bevorzugt > **aus Kontingent abgeleitet** > null (= alle erlaubt). Die Ableitung (`deriveAntragstypenFromKontingent`) nutzt `hatTypKapazitaet` und liefert alle Buckets mit `jahresKapazitaetProTyp > 0` — Annahme: wer Stunden für einen Typ gepflegt hat, bearbeitet ihn auch. **Read-time, nicht persistiert** → aktualisiert sich bei jedem Kompetenz-XLSX-Re-Upload. `null` (alle erlaubt) gilt nur noch für MAs ganz **ohne** Kontingent (Backwards-Kompat).
- `getAntragstypHerkunft(ma)` — `'override' | 'bevorzugt' | 'abgeleitet' | 'keine'` für die UI-Label-Differenzierung („… (aus Kontingent)").
- `matchesAntragstyp(antrag, ma): boolean` — nutzt `getKategorieLabel(vb_phase)` aus `kategorieQuickfilter.ts` (Single Source of Truth), kein zweites Mapping. Irrläufer (und Anträge ohne bestimmbaren Bucket) immer false, sobald ein effektiver Filter greift (explizit ODER abgeleitet).

**Stunden-Gate (v2.61):** Der Matcher (`runMatchingWithContext`) schliesst MAs ganz **ohne** Stunden-Kontingent (`effektiveJahresStunden(ma) <= 0`) hart aus — Grund `'keine-stunden'` in der „Nicht vorgeschlagen"-Liste. Wer keine Stunden gepflegt hat, ist keine buchbare Ressource und bekommt keinen Antrag. Abgrenzung zum weichen Kapazitätsmodell (v1.17): dort geht es um MAs **mit** Jahresstunden, die im Quartal ausgelastet sind (Malus, bleiben sichtbar) — das Stunden-Gate greift nur bei `0` gepflegten Jahresstunden. (Der Stufe-4-`null`-Zweig von `getEffectiveAntragstypen` ist im Matcher dadurch praktisch tot — er bleibt für Nicht-Matcher-Konsumenten/UI-Labels erhalten.)

Wirkt in: `NeueAntraegeFuerDich` (Home-Selbsteintragung) + `matching-engine.ts` (Eligible-Pool VOR den teuren BM25/Embedding-Scores).

UI-Konventionen:
- MA-Profil zeigt ein Amber-Banner („Aktuell vom PL eingeschränkt") wenn `antragstypUeberschreibung` nicht leer ist. MA kann seine Präferenz weiter editieren, sie greift sobald PL den Override entfernt.
- PL-Tabelle: kleines „PL"-Badge an der effektiven Pill-Liste signalisiert aktives Override; „Override entfernen"-Button setzt es auf `undefined` zurück. Bei abgeleiteten Werten zeigt das Effektiv-Label ein „(aus Kontingent)"-Suffix.
- MA-Edit (v2.60): sind keine expliziten Pills gesetzt und ist eine Ableitung vorhanden, erscheint unter den Pills eine Info-Zeile mit den abgeleiteten Buckets + Button „Übernehmen" (seedet die Pills, damit der PL sie explizit editieren/speichern kann).

## Klassifizierungs-Modell (1.17)

Pro Antrag genau eine **Primärkategorie** + 0..n **Aspekte** (Querschnittstechnologien). Beispiel: „KI-gestützte Schadenserkennung in Brückenstrukturen" → primaer=IT (Strukturüberwachung ist Ingenieurtechnik), aspekte=[DT] (KI ist das Werkzeug).

Datenmodell:
- `Klassifizierung.vorgeschlagenePrimaer: PrimaerVorschlag | null` (Methode: `'regel' | 'embedding' | 'llm' | 'manuell'`).
- `Klassifizierung.vorgeschlageneAspekte: AspektVorschlag[]`.
- `Klassifizierung.freigegebenePrimaer: string` + `freigegebeneAspekte: string[]` (nach PL-Review).
- Deprecated 1.16-Felder `vorgeschlageneKategorien` + `freigegebeneKategorien` wurden mit v2.3 entfernt. Pre-v2.1-Roh-JSON wird beim Load weiterhin migriert (`normalizeKlassifizierungArray` in `services/auslastung-store.ts`).

MA-Modell (1.17):
- `AnonymerMitarbeiter.hauptKategorie: string` — bestimmt den Pool für Selbsteintragung + Matching.
- `AnonymerMitarbeiter.nebenKategorien: string[]` — triggert Aspekt-Bonus im Matching.
- `AnonymerMitarbeiter.abschlagProzent: number` — reduziert die effektive Quartals-Kapazität (z.B. 25% für QS-Bearbeiter).
- Deprecated `ueberKategorien` bleibt 1 Release im Save.

## LLM-Batch-Klassifizierung (1.17)

`services/llm-klassifizierung.ts` ruft seit v4.12 den **gegateten** Transport
`bridge.getTransportForDatenLauf(...)` mit JSON-Schema-Mode auf — also **nur intern**
(Streamlit oder lokales llama.cpp), nicht mehr den rohen aktiven Transport. Grund: der
Prompt trägt `verbundTitel`, `tvTitels` und `antragsteller`, und genau diese Klasse führt
die DSGVO-Transport-Policy als `stammdaten` in `INHALTS_SLOTS`
([transport-policy.md](transport-policy.md)). Ein extern gewählter Provider lässt den Lauf
mit einer klaren Meldung scheitern, statt den Bestand hinauszugeben.

Die **Zwischenablage-Fallbacks bleiben unverändert extern nutzbar** („Prompt kopieren" /
„LLM-Ergebnis einfügen"): eine bewusste Nutzerhandlung ist kein automatischer Lauf, und
der Weg über ein externes Chat-Fenster bleibt damit offen.

UI-Buttons (Komponente `LLMKlassifizierungButtons`) im Klassifizierungs-Tab:
- "LLM-Klassifizierung starten" — Progress-Anzeige, Bulk-Save am Ende (EIN persist, siehe CLAUDE.md Lesson 16).
- "Prompt kopieren" — `navigator.clipboard.writeText()` für Streamlit-/ChatGPT-Fallback.
- "LLM-Ergebnis einfügen" — Modal mit Textarea, robustes JSON-Parsing (Markdown-Wrapper, Umlaut-Schlüssel `primär`/`begründung`).

Hierarchie LLM > Embedding > Manuell: Methode `'llm'` mit `begruendung` in `PrimaerVorschlag` gespeichert.

## Vollständigkeit gatet auch die Klassifizierung (nicht nur Freigabe/Zuweisung)

Ein Verbund gilt als **vollständig**, wenn alle TVs für ihren Antragstyp erfasst sind — FuE/DS brauchen ein gültiges `D_XTEC`, DL/NW ein gültiges `D_ADV` (`istVollstaendigFuerTypAz`, Verbund-Rollup via `every` in [verbund-aggregation.ts](../../src/plugins/auslastung/services/verbund/verbund-aggregation.ts)). Dieses Flag (`VerbundKlassifizierungsView.vollstaendig`) gatet nicht nur die **Freigabe** (Button gesperrt) und die **Zuweisung** (`ZuweisungsCockpit`), sondern seit v2.32x auch die **Klassifizierung selbst**: eine Einordnung ohne Sammel-Datum läuft ins Leere, weil der Antrag danach ohnehin nicht freigegeben/zugewiesen werden kann.

Unvollständige Verbünde werden **zurückgehalten** — die Entscheidung fällt zentral in `buildVerbundClassificationViews`: bei `!vollstaendig` wird **nicht** live klassifiziert und ein evtl. persistierter Vorschlag **nicht angezeigt** (neutraler „zurückgehalten"-Platzhalter, `vorgeschlagenePrimaer: null`). Konsequenzen an den Rändern:
- **LLM-Batch / „Prompt kopieren" / „offen"-Zähler** schließen sie aus (`offeneVerbuende`-Filter in [LLMKlassifizierungButtons.tsx](../../src/plugins/auslastung/components/LLMKlassifizierungButtons.tsx) mit `!v.vollstaendig`); die Leiste zeigt zusätzlich „· N warten auf Vollständigkeit".
- **Filter-Chips**: unvollständige erscheinen ausschließlich unter „Unvollständig" (`viewFilterBucketsOf`-Früh-Return), nicht in „Review nötig"/„LLM-Vorschlag"/„Freigegeben".
- **Manuelle Pill-Vergabe** ist gesperrt (`applyVerbundOverride` Früh-Guard); die „Vorgeschlagen"-Spalte zeigt statt Pills „⏳ wartet auf Vollständigkeit" ([verbund-columns.tsx](../../src/plugins/auslastung/views/verbund-columns.tsx)).

Persistierte Klassifizierungen bleiben auf der Platte unangetastet und tauchen wieder auf, sobald das Datum per CSV eintrifft. Der Transitions-Schutz (`gate.dxtec`/`gate.dadv` aus, wenn die Spalte nirgends befüllt ist) greift automatisch mit → kein Massen-Zurückhalten während CSV-Umstellungen.

## Aktiv/Inaktiv-Flag (`AnonymerMitarbeiter.aktiv: boolean`, Mai 2026)

Filter-Schicht für ehemalige Bearbeiter. Inaktive MAs werden aus UI (Admin-Tabelle, KapazitaetsDashboard, Zuweisungs-Cockpit) und Matching (Eligible-Sammlung in `matching-engine.ts`, Score-Aggregation in `embedding-matcher.ts`) ausgeblendet — ihre historischen Antraege bleiben aber im Embedding-Corpus als Kompetenz-Referenz für neue MAs mit ähnlichem Hintergrund. Default beim Anlegen: `true`. Migration alter Daten (`normalizeMitarbeiterRecord` in `services/auslastung-store.ts`): ebenfalls `true`. PL bekommt im Admin-Tab einen einmaligen Vorschlag-Banner (`AktivVorschlagBanner.tsx` + `services/aktiv-detection.ts`): "MAs mit Antrag im aktuellen Jahr → aktiv vorgeschlagen, sonst inaktiv". Banner erscheint nur wenn `shouldShowAktivVorschlag(mitarbeiter) === true` (alle MAs noch `aktiv: true`); ist auch nur ein MA inaktiv, gilt die Liste als gepflegt und der Banner kommt nicht wieder. Aktivieren/Deaktivieren einzeln über Aktiv-Toggle pro Tabellenzeile (Bestätigungsdialog beim Deaktivieren). "Inaktive anzeigen"-Checkbox im Header zeigt ausgegraute inaktive MAs in der Tabelle.

**Reichweite des geteilten Schalters** (`useShowInaktiveMasStore`, Einstellungen → Profil + Suchzeile der Antragsliste): er wirkt auf die **Antragsmengen** in Förderanträge-Liste und Startseite (`applyInaktiveExclusion`), seit v4.47 aber **nicht mehr** auf die Kürzel-Auswahl im Profil. Die führt ehemalige Kolleg:innen immer mit („THÜ · ehem."), weil fast jede Projektleitung früher selbst bearbeitet hat und ihr eigenes Kürzel sonst schlicht nicht wählbar war — der Schalter versteckte genau die Person, die dort nach sich selbst sucht. Mit dem Filter entfiel auch der Stale-Guard, der eine solche Wahl still auf „Alle" zurücksetzte. **Lücken in der MA-Nummerierung** sind durch das Aktiv-Flag normal: anonIds bleiben stabil (siehe Pitfall #18), nur die Anzeige filtert. KapazitaetsDashboard zeigt dezenten Hilfetext "30 von 79 MAs aktiv …" wenn Lücken vorhanden sind.

## Kompetenz-Matrix (PL-Upload + editierbares Grid, v2.15)

Damit alle MAs sofort matchbar sind — auch ohne MA-Selbsteingabe — lädt die PL eine **Kompetenz-XLSX** hoch und pflegt die Werte danach in einem editierbaren Grid (Tab „Kompetenzen"). Pro TIB-Kürzel: Antragstyp-Kontingent DL/DS/NW/FuE (Anträge/Jahr), Abschlag %, sowie Kompetenz-Level 1/2/3 je Unterkategorie über die fünf Überkategorien (IT/DT/EU/LG/NM).

Additive optionale Felder am `AnonymerMitarbeiter` (bestehende `auslastung.json` ohne sie laden mit Defaults, Faktor 1.0 = altes Verhalten):
- `kompetenzMatrix?` — `ÜberkatID → Unterkat.-Label → Level (1|2|3)`.
- `jahresKapazitaetProTyp?` — Anträge/Jahr je Antragstyp-Bucket (DL/DS/NW/FuE).
- `kompetenzQuelle?: 'pl-upload'` — markiert per XLSX vorbelegte MAs.

Sowie am `config`: `kompetenzSchema` (Spalten-Schema aus dem XLSX-Header) + `kompetenzLevelGewicht` / `kontingentGewicht`.

- **Parser** [kompetenz-import.ts](../../src/plugins/auslastung/services/onboarding/kompetenz-import.ts): liest das Merge-Header-Layout (Zeile 1 = Überkat-Merges, Zeile 2 = Unterkat-Labels), löst `TIB_KUERZ → anonId` via Kürzel-Map (NFC-normalisiert, Pitfall #22); unbekannte Kürzel → warnen + überspringen (keine Phantom-MAs).
- **Ableitung** [kompetenz-derivation.ts](../../src/plugins/auslastung/services/klassifizierung/kompetenz-derivation.ts) (reine Funktionen): `deriveHauptNeben`, `kompetenzTokens`, `normLevelForUeber`.
- **Merge = Überschreiben** über die Batch-Store-Action `applyKompetenzMatrixBatch` (EIN setState + EIN persist, Pitfall #16/#20): leitet Haupt-/Nebenkategorie aus der Matrix ab und setzt `onboardingAbgeschlossen` (Matcher-Gate).
- **Matcher-Integration**: das BM25-Profil-Doc bekommt level-gewichtete Unterkat.-Tokens (Level 3 = Token 3×); die Engine skaliert den Kompetenz-Score mit dem Überkat.-Level der Primärkategorie und deckelt weich per Antragstyp-Kontingent ([kontingent.ts](../../src/plugins/auslastung/services/matching/kontingent.ts)).

UI: [KompetenzMatrixView](../../src/plugins/auslastung/views/KompetenzMatrixView.tsx) + [KompetenzImportDialog](../../src/plugins/auslastung/components/KompetenzImportDialog.tsx) + die in `src/plugins/auslastung/components/kompetenz/` zerlegte Grid-Komponente ([KompetenzMatrix.tsx](../../src/plugins/auslastung/components/kompetenz/KompetenzMatrix.tsx) + `MatrixRow`/`MatrixHeader`/`MatrixToolbar`/`MatrixControls`/`LevelCell`/`CapCell`). Datenschutz: das Grid zeigt anonIds; echte Kürzel nur in Varianten mit Flag `deAnonymisierung` (pl/dev — seit v2.17 ohne separates De-Anon-Passwort).

## Engine-Layer (`src/plugins/auslastung/services/`)

**Submodul-Struktur (Phase A, v2.85):** Die Service-Dateien sind in kohäsive Submodule mit je einem `index.ts`-Barrel gegliedert (reiner Re-Export, keine Verhaltensänderung). Deep-Importe von außen laufen über den Submodul-Index `@/plugins/auslastung/services/<submodul>` (oder das Top-Barrel `@/plugins/auslastung/services`):

- `matching/` — matching-engine, bm25-matcher, embedding-matcher, embedding-corpus, verbund-embedding, corpus-signal, corpus-share-sync, manual-match, zuweisung-sort, kontingent
- `klassifizierung/` — klassifizierung-engine, llm-klassifizierung, kompetenz-codes/-derivation/-geometry/-matrix-colors, vollstaendigkeit-felder
- `kapazitaet/` — kapazitaet, kapazitaet-pro-typ, quartals-auslastung, statistik, aktiv-detection, altlast, antragstyp-praeferenz
- `identitaet/` — anonym-map, kuerzel-map, persoenliches-profil, profil-aggregator
- `onboarding/` — onboarding-html-generator/-import/-kalibrierung, kompetenz-import, profil-einsammeln, uebernahme-einsammeln, uebernahme-wuensche
- `verbund/` — verbund-aggregation, externe-zuweisungen
- **Root** (Querschnitt/Store, bleiben oben): auslastung-store, cross-tab, export-service, default-labels (generiert), tib-mail

Service-interne Cross-Submodul-Importe nutzen **direkte** Pfade (`../<submodul>/<datei>`), nicht das Barrel (Graph ist azyklisch). Tests, die ein konkretes Modul mocken/spyen (`vi.mock`), müssen den **konkreten** Submodul-Pfad treffen, nicht den Barrel.

- `klassifizierung-engine.ts` — dreistufig: **Stage 0** (Boolean-Match auf ZT-Spalten der CSV `"Künstliche"`, `"Gesundes L"`, `"Energie/Re"`, ... → direkt der Default-Überkategorie zugeordnet, höchste Confidence), **Stage 1** (Regel-Mapping aus PL-konfigurierten Deskriptoren-Listen, Multi-Label wenn 2 Kategorien matchen), **Stage 2** (Embedding-Centroid-Match, optional via `config.stage2Aktiv`).
- `bm25-matcher.ts` — Mini-BM25 für MA-Profile mit deutschen Stoppwörtern.
- `embedding-corpus.ts` — IDB-Cache `auslastung-emb:<aktz>` für Antrags-Embeddings (~40 MB bei 13k × 768d), Corpus-Build mit Progress-Callback, AbortSignal-Support. **Der Embedding-TEXT löst seine Quell-Spalten seit v4.113 über das CSV-Schema auf** (`ladeEmbeddingFeldIndex` → `baueKorpusFeldKarte`), nicht über geratene Schlüssel — vorher fehlte die Projektbeschreibung in **allen** 14 225 Sätzen, der Vektor kannte nur den Titel ([suche-relevanz.md §8.6](suche-relevanz.md), recurring-bug-classes Klasse 5). **Und der Korpus führt eine Signatur** (Modell + Dimension + Dokument-Präfix + Text-Build-Version, [signatur.ts](../../src/core/services/embedding-corpus/signatur.ts)): weicht sie vom lokalen Stand ab oder fehlt sie, baut `buildEmbeddingCorpus` **voll** statt einen fremden Vektorraum zu verlängern (`vollErzwungen` im Ergebnis, Klasse 24). Wird seit Mai 2026 als Sidecar-Dateipaar (`_intern/auslastung-embedding-corpus.{manifest.json,bin}`) auf den SMB-Daten-Share gespiegelt — Cold-Start eines neuen Rechners lädt vom Share statt 46 min neu zu bauen. Mirroring-Logik in `embedding-corpus-mirror.ts` + Hook `useEmbeddingCorpusMirror`. Modell-Mismatch (Share-Korpus mit anderem Modell als lokal aktiv) blockiert Download und Upload mit explizitem UI-Hinweis; Antraege-Drift (`aktenzeichenSetHash` weicht ab) gibt sanften Hinweis zum inkrementellen Re-Build. Upload nutzt den bestehenden `build-lock`-Mechanismus mit `stufe: 'auslastung-corpus'`.

  **Ein Lauf, der scheitert, sagt es (v6.17).** `BuildErgebnis` trennt `ohneText` von `fehlgeschlagen` (vorher eine Zahl „übersprungen (kein Text oder Fehler)" — ein Lauf, dem nach ~800 Vektoren der WebGPU-Kontext wegbrach, war von einem Bestand ohne Texte nicht zu unterscheiden). Nach `FEHLERSERIE_ABBRUCH` = 20 Fehlschlägen **hintereinander** endet der Lauf mit `abbruchGrund: 'fehlerserie'`, statt in Minuten durch 14 k Datensätze zu rauschen; der erste Fehler wird einmal per `console.error` mit vollem Objekt geloggt und im Ergebnis mitgeführt. Über einem **fremden** Vektorraum stempelt ein Lauf mit Fehlern die Signatur **nicht** (`signaturGestempelt`) — sonst behauptet der Korpus die neue Textfassung über Vektoren, die zu 94 % aus der alten stammen. Und ein unsauberer Lauf wird **nicht gespiegelt**: weder der manuelle Bau ([useKorpusBau](../../src/plugins/kuration/suche-index/hooks/useKorpusBau.ts)) noch der automatische Nachlauf laden einen halben Korpus als Team-Stand hoch.

  **Schreiben über langsame Strecken.** `schreibeKorpusDatei` ([mirror.ts](../../src/core/services/embedding-corpus/mirror.ts)) holt den Verzeichnis-Handle **je Versuch frisch** aus der IndexedDB (ein deserialisierter Handle erholt sich nach einem VPN-Aussetzer nicht — `InvalidStateError`, „state cached in an interface object"), prüft einmal `queryPermission`, wiederholt zweimal mit Pause und schreibt die 42-MB-Bin über `atomicWriteStream` in ~4-MB-Scheiben (Fortschritt in der Karte, saubere `.tmp`-Verwerfung). Scheitert die Spiegelung trotzdem, bleibt der Bau lokal gültig und der Knopf „Erneut spiegeln" wiederholt allein den Upload.

  **Dauer wird gemessen, nicht geraten** ([korpus-messung.ts](../../src/plugins/auslastung/services/matching/korpus-messung.ts)): nach jedem vollständigen, fehlerfreien Vollbau liegt `sekProItem` maschine-lokal im kv; davor nennt der Knopf nur die Anzahl statt einer Minutenzahl.
- `embedding-matcher.ts` — Top-K Antrags-Similarity → TIB-Score-Aggregation mit virtueller-Projekt-Confidence.
- `matching-engine.ts` — dynamische α-Fusion (BM25 vs Embedding je nach Konfidenz) + **weicher Kapazitäts-Score** (kein harter Filter mehr, ueberbuchte MAs bleiben im Ranking mit Malus) + Aspekt-Bonus (Antrag-Aspekt ∩ MA-Nebenkategorien) + Balance-Score → Top-3 pro Antrag. Pool-Filter ist seit 1.17 `ma.hauptKategorie === antrag.freigegebenePrimaer`.
  - **v2.48 — Transparenz + Nebenkompetenz**: Einstieg ist `runMatchingWithContext` → `{ vorschlaege, nebenkompetenz, ausgeschlossen }`. `runMatching` bleibt dünner Backwards-Kompat-Wrapper (`.vorschlaege`). **Nebenkompetenz-Pool**: MAs, deren Primärkategorie nur in `nebenKategorien` liegt (bisher still vom Hauptkategorie-Pool gefiltert), werden in einem **eigenen, getrennt normalisierten** Scoring-Pass gescort und im Cockpit als „Auch geeignet · Nebenkompetenz" gezeigt — das Haupt-Ranking bleibt bit-identisch. **Ausschluss-Liste**: kategorie-relevante MAs, die der Matcher filtert (`inaktiv`/`antragstyp`/`abgemeldet`/`kein-onboarding`/`rang`=Top-N-Schnitt), werden mit Grund zurückgegeben (UI: einklappbare „Nicht vorgeschlagen"-Liste) — macht die bisher stillen Filter nachvollziehbar. **Score-Breakdown** (`MatchResult.breakdown`): `histScore` (Historie) vs. `matrixScore` (PL-Kompetenztabelle, `null` ohne Eintrag) + `alpha` + `matchKind` → aufklappbares `ScoreBreakdownPanel` pro Vorschlag.
- `kapazitaet.ts` — `computeKapazitaet` (Antrags-Sicht mit Abschlag), `kapazitaetsScore` (5 Banden + Quartals-Ende-Bonus), `tageImQuartal`-Helper.
- `llm-klassifizierung.ts` — LLM-Batch-Klassifizierung via aktivem AIBridge-Transport, JSON-Schema-Mode, Copy/Paste-Fallback.
- `anonym-map.ts` — Helper für die in-RAM-Map (Normalisierung, User→AnonId-Lookup, nextFreeAnonId). Die eigentliche Map wird aus der persistenten kuerzel-map abgeleitet (siehe Pitfall #18).
- `onboarding-kalibrierung.ts` — Spearman-Korrelation + Grid-Search über Confidence-Faktoren, für die Validierung des Standalone-Onboarding gegen historisches Matching.

## Build-Pipeline (`scripts/build-default-labels.mjs`, prebuild-Hook)

Liest `_labels/Labels PrjBsp_GPT.xlsx` → erzeugt `src/plugins/auslastung/services/default-labels.ts` (AUTO-GENERIERT, nicht manuell editieren) mit:

- `LABEL_BY_CSV_COLUMN` — 148 Klarnamen pro CSV-Spaltencode
- `ZUKUNFTSTECHNOLOGIE_FELDER` — 44 ZT-Felder (22 Themen × TV/VB-Ebene) mit Default-Mapping auf die 5 Kategorien
- `KATEGORIE_KEYWORD_HEURISTIK` — Substring-Heuristik für TECHN_/BRANCHE_-Werte als Fallback

**Pflegepunkt bei neuen ZT-Themen**: `ZT_TO_KATEGORIE`-Map in `build-default-labels.mjs` editieren → `npm run build:default-labels` → die VB-Spalten-Mappings in `docs/fixtures/schema-c.ts` ergänzen (PapaParse renamed Duplikate zu `<header>_1`). Stage-0-Match liest `customField`-Namen (`zt_*_tv` / `zt_*_vb`), nicht den CSV-Header.

## Datenmodell

`auslastung.json` auf SMB unter `_intern/auslastung.json`; Legacy-Pfad `_intern/auslastung/data.json` wird beim Laden als Fallback berücksichtigt — siehe `loadAuslastungData()`.

```typescript
interface AuslastungData {
  version: 1;
  updatedAt: string;
  config: AuslastungConfig;              // ueberKategorien, gewichtungen, stage2Aktiv, setupAbgeschlossen
  mitarbeiter: Record<string, AnonymerMitarbeiter>;  // Key = anonId (MA01)
  klassifizierungen: Klassifizierung[];  // pro Antrag: vorgeschlagene + freigegebene Kategorien
  zuweisungen: Zuweisung[];              // antragId, anonId, quartal, stunden, status
  kalibrierung?: KalibrierungsState;     // Spearman-Ergebnisse + optimale Confidence-Faktoren
}
```

## Standalone Kompetenz-Onboarding (`tools/kompetenz-onboarding/`)

Single-HTML-Datei (Vanilla-JS + Inline-SheetJS, file://-kompatibel) für neue MAs ohne SMB-Zugang. PL generiert die HTML im Admin (`generateOnboardingHtml`) — Generator liest `template.html` via Vite-`?raw`-Import + injiziert JSON-Blob mit 30-60 Beispiel-Anträgen. MA füllt aus, schickt XLSX zurück, PL importiert via `OnboardingImportDialog` → neuer MA mit `virtuelleProjekte` + Confidence-Faktoren.

## Schema-Erweiterung (`docs/fixtures/schema-c.ts`)

Mapped alle 22 ZT-TV-Spalten (`'Digitale W'`, `'Künstliche'`, ...) UND 22 ZT-VB-Spalten (`'Digitale W_1'`, `'Künstliche_1'`, ...) als Custom-Boolean-Felder. Beim Stage-0-Match werden TV und VB gleichwertig ausgewertet — Verbund-Deskriptoren vererben implizit auf alle TVs.

## Sichtbarkeits-Gates

- Plugin selbst: `features.auslastung` (default false; in `configs/dev.config.json` true). Andere Variants müssen das Flag aktiv setzen wenn das Modul gewünscht ist.
- Routing: TeamFlowPlugin.route + TeamFlowPlugin.featureFlag pflegen den Eintrag, PLUGIN_ROUTES + FLAT_ROUTE_PLUGIN_IDS werden in `src/plugins.config.ts` daraus abgeleitet.

## Nicht anfassen

- Bestehende Bearbeiter-Filter-Logik im `antraege`-Plugin (das nutzt `bearbeiter_kuerzel` aus dem Profil mit Mehrfach-Kürzel + Begleitungs-Spalten — andere Domain).
- Embedding-Modell-Init: Plugin nutzt den Singleton `embeddingService` aus dem Such-Stack, lädt kein eigenes Modell.

---

## CLAUDE.md-Pitfalls (Detail)

Detail-Heimat der Auslastungs-Store/Matching/Anonymisierungs-Pitfalls. Die Mechanismen sind in den Abschnitten oben beschrieben; hier die normativen Kurzregeln.

### Pitfall #16 / #20 — Multi-Step-Store-Mutationen: EIN `setState` + EIN `persist`

Der `useAuslastungData`-Store hat einen `if (saving) return;`-Lock im `persist`. Mehrere parallele `persist`-Aufrufe (z.B. wenn jede `upsertX`-Action ihren eigenen persist triggert) fallen raus → inkonsistenter Save. Jede zusammengehörende Mutationsserie (Import + Klassifizierung + Zuweisung, Setup-Wizard-Abschluss) muss alle Mutationen in EINEM finalen `setState({...})`-Call sammeln, gefolgt von EINEM `await persist(storage)`. #20 ist die Verallgemeinerung von #16; gilt auch für andere Stores mit Save-Lock-Pattern (z.B. `feedbackService`-Sync). In der Git-History sichtbar als wiederkehrende „doppelte Zeilen"-Fixes. Vorbilder oben: `applyAggregatedProfiles`, `applyKompetenzMatrixBatch`.

### Pitfall #17 — AnonymMap nutzt ausschließlich `tib_kuerz`

`bootstrapKuerzelMap()` filtert hart auf das `tib_kuerz`-Feld (nicht BIB/ZTP/PFM). Ehemalige Bearbeiter (TIBs, die im aktuellen Programm nicht mehr aktiv sind) werden bewusst mitgezählt — ihre historischen Anträge liefern beim Embedding-Match wertvolle Kompetenz-Referenzen für neue MAs mit ähnlichem Hintergrund. Wer das filtern möchte („nur aktive MAs"), muss eine separate Schicht oberhalb der AnonymMap einziehen (Aktiv-Flag, siehe Abschnitt oben).

Dasselbe gilt für die **Gegenrichtung**: die Kürzel-Auswahl im Profil sammelt seit v4.47 auch `bib_kuerz`, damit AB-Bearbeitende ihr Kürzel überhaupt vorfinden (im Bestand: 79 FB-Kürzel, 35 AB-Kürzel, davon **33 nur administrativ** — die fehlten dort vollständig). Sie tut das in einer eigenen reinen Schicht ([kuerzelOptionen.ts](../../src/plugins/auslastung/hooks/kuerzelOptionen.ts)), **ohne** die AnonymMap anzufassen. Folge, die so gewollt ist: ein rein administratives Kürzel hat keine `anonId` und gilt darum als aktiv — „inaktiv" ist eine Aussage, die nur die gepflegte MA-Liste treffen kann. `applyInaktiveExclusion` prüft weiterhin nur `tib_kuerz`.

**Angezeigt wird die Schreibweise der Quelle, verglichen die Normalform** (v4.48): die Option trägt seither ein zweites Feld `anzeige` — „THü", nicht „THÜ". Gemessen an den Import-CSVs sind **81 der 112 Kürzel gemischt geschrieben**; wer sein eigenes sucht, sucht es in seiner Schreibweise. Ins Profil geht weiter `kuerzel` (NFC+upper, Pitfall #22) — die Identität darf nicht an einem Detail hängen, das je nach Quelle anders aussieht, und der Filter uppercased beide Seiten ohnehin. Kollisionsregel: die erste gefundene Schreibweise gewinnt, eine reine Großschreibung (so führt die `kuerzel-map` ihre Einträge) weicht einer gemischten aus den Anträgen. Im Bestand widerspricht sich kein Kürzel selbst — 0 von 368 Rohwerten stehen in zwei Schreibweisen da.

### Pitfall #18 — AnonymMap kommt aus der append-only kuerzel-map

Die Sidecar-Datei `_intern/auslastung-kuerzel-map.json` ist append-only: einmal vergebene anonIds bleiben stabil, neue Kürzel hängen hinten an (kein Identitäts-Drift bei alphabetischer Mitten-Insertion). Code-Konsumenten lesen `cache.anonymMap` aus [useAntraegeCache.ts](../../src/plugins/auslastung/hooks/useAntraegeCache.ts) bzw. nutzen [`useKuerzelMap`](../../src/plugins/auslastung/hooks/useKuerzelMap.ts) + [`buildAnonymMapFromKuerzelMap`](../../src/plugins/auslastung/services/identitaet/kuerzel-map.ts). Unit-Tests: `buildAnonymMapForTests(antraege)` (derselbe Code-Pfad wie Prod). Schreib-Profil: append-only (Pitfall #23).

### Pitfall #22 — Unicode-Kürzel (THÜ/BIB/ZTP) immer NFC-normalisieren

Umlaut-Kürzel kommen in IDB/JSON je nach Browser/OS in NFC oder NFD an. Wer Kürzel in der `kuerzel-map` speichert oder daraus liest, muss `s.normalize('NFC')` durchlaufen (`bootstrapKuerzelMap()` in [kuerzel-map.ts](../../src/plugins/auslastung/services/identitaet/kuerzel-map.ts)), sonst silent-mismatch in `findAnonId(kuerzel)` und doppelter `anonId`-Eintrag für „THÜ" (NFC) vs „THÜ" (NFD). Tritt v.a. bei manuellen Imports aus Excel oder beim Onboarding-XLSX-Upload auf.
