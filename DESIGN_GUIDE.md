# TeamFlow Design Guide

Dieses Dokument ist die verbindliche Design-Referenz für alle UI/UX-Arbeit an TeamFlow.
**Jeder Coding Agent MUSS dieses Dokument lesen bevor er UI-Komponenten erstellt oder ändert.**

---

## 1. Design-Philosophie

### Leitbild
TeamFlow ist eine **interne Verwaltungs-App für Behörden**. Sie muss professionell, ruhig und vertrauenswürdig wirken — nicht wie ein Startup-Produkt und nicht wie "von AI generiert".

### Drei Regeln

**Regel 1: Farbe ist ein knappes Gut.**
Farbe wird NUR eingesetzt wenn sie Information transportiert (Status, Warnung, Fehler). Niemals zur Dekoration. Die App ist im Kern schwarz/weiß/grau. In einer typischen Ansicht gibt es maximal 2-3 farbige Elemente.

**Regel 2: Typografie macht die Hierarchie.**
Unterschiede in Größe, Gewicht und Farbe (primary/secondary/tertiary) erzeugen die visuelle Ordnung. Nicht Borders, nicht Farben, nicht Schatten.

**Regel 3: Weniger ist professioneller.**
Im Zweifel weglassen. Kein Element verdient es auf dem Screen zu sein, wenn es nicht aktiv einem Zweck dient. Jeder zusätzliche Border, jeder Schatten, jeder Farbakzent muss seine Existenz rechtfertigen.

### Anti-Patterns (NIEMALS)
- ❌ Gesättigte bunte Buttons (knallblau, knallrot, knallgrün)
- ❌ Farbige Hintergründe für Cards oder Sections
- ❌ Gradient-Buttons oder Gradient-Hintergründe
- ❌ Dicke Borders (>0.5px) außer bei Focus-States
- ❌ Box-Shadows für Dekoration (nur für Focus-Rings und Dialoge)
- ❌ Abgerundete Ecken >12px (keine Pill-Shapes außer bei Badges)
- ❌ Mehrere Farben die miteinander konkurrieren
- ❌ Icon-Spam — Icons nur wenn sie schneller als Text sind
- ❌ ALL CAPS außer in Section-Headern
- ❌ Bold/600/700 in Fließtext — nur 400 (regular) und 500 (medium)
- ❌ Badge-Farben mit gleichem Farbton für Text und Hintergrund (rot auf rot, gelb auf gelb) — IMMER dunkler Text auf hellem Hintergrund
- ❌ Dropdown-Selects wenn 2-6 Filter-Optionen verfügbar sind — Pills sind direkter
- ❌ max-w auf Listenseiten/Boards — diese sollen die volle Breite nutzen
- ❌ `opacity-40` (o.ä.) zur Unterscheidung aktiv/inaktiv bei Toggle-Buttons — wirkt wie „disabled", User unsicher ob klickbar. Stattdessen outline-only-Variante (siehe Kapitel 5 „Toggleable Pill")
- ❌ Pills/Chips mit inhalts-abhängiger Breite (z.B. Häkchen nur bei `active` rendern) — verursacht horizontalen Layout-Shift in Listen. Optional-Slots immer rendern mit `invisible`
- ❌ `try/finally` ohne `catch` in async UI-Aktionen + `onClick={() => void promise()}` — Errors werden silent geschluckt; UI sieht aus als wäre nichts passiert. Immer `try/catch` + sichtbares Error-Banner

### Vorbilder
- Linear (App) — Minimale Sidebar, viel Whitespace, subtile Borders
- Notion — Clean Cards, typografische Hierarchie
- Die KI-Werkstatt Screenshots (im Repo) — Section-Header mit Linie, monochrome Listen

---

## 2. Farbsystem

### Prinzip: Monochromes Fundament + sparsame Semantik-Farben

Die App nutzt **CSS Custom Properties** für alle Farben. Es gibt KEINE hartcodierten Hex-Werte in Komponenten.

### Primärfarbe
Die Primärfarbe ist **user-wählbar** (HSL-basiert, nur Hue ändert sich). Sie wird SPARSAM eingesetzt:
- Aktiver Sidebar-Eintrag (als light-Variante im Hintergrund)
- Fokussierte Inputs (Border)
- Links
- Einzelne Akzente wo nötig

```
--tf-primary-h: 221;        /* Hue — vom User wählbar */
--tf-primary-s: 83%;        /* Saturation */
--tf-primary-l: 53%;        /* Lightness */
--tf-primary: hsl(var(--tf-primary-h), var(--tf-primary-s), var(--tf-primary-l));
--tf-primary-light: hsl(var(--tf-primary-h), var(--tf-primary-s), 95%);
```

### Neutrale Farben (Fundament der App)
| Variable | Light | Dark (Warm-grau) | Verwendung |
|---|---|---|---|
| `--tf-bg` | #ffffff | #2a2a28 | Haupthintergrund |
| `--tf-bg-secondary` | #f8f8f8 | #333330 | Flächen, Metric-Cards |
| `--tf-bg-sidebar` | #fafafa | #222220 | Sidebar |
| `--tf-text` | #0d0d0d | #cccac4 | Primärer Text |
| `--tf-text-secondary` | #6b6b6b | #8a8884 | Sekundärer Text, Labels |
| `--tf-text-tertiary` | #a0a0a0 | #605e5a | Hints, Timestamps, Section-Header |
| `--tf-border` | rgba(0,0,0,0.08) | rgba(200,195,180,0.08) | Standard-Border (0.5px) |
| `--tf-border-hover` | rgba(0,0,0,0.15) | rgba(200,195,180,0.14) | Hover-Border |
| `--tf-hover` | rgba(0,0,0,0.04) | rgba(200,195,180,0.05) | Hover-Hintergrund |

> **Dark Mode Ästhetik**: Warm-grau mit leichtem Gelbstich, NICHT kalt/neutral.
> Wie Papier bei warmem Lampenlicht. Reduzierter Kontrast (~9.5:1 statt 12:1)
> für augenschonendes Arbeiten über lange Zeiträume. Kein reines Schwarz (#000),
> kein reines Weiß (#fff) — alles weich und warm.

### Semantische Farben (nur für Status/Feedback)
| Bedeutung | Hintergrund | Text | Verwendung |
|---|---|---|---|
| Info | hsl(210, 80%, 95%) | hsl(210, 70%, 35%) | In Prüfung, Hinweise |
| Success | hsl(145, 60%, 94%) | hsl(145, 60%, 30%) | Genehmigt, Erfolg |
| Warning | hsl(38, 90%, 93%) | hsl(38, 70%, 30%) | Nachforderung, Achtung |
| Danger | hsl(0, 70%, 95%) | hsl(0, 60%, 38%) | Abgelehnt, Fehler, Löschen |

**WICHTIG**: Semantische Farben erscheinen NUR als:
- Badge-Hintergrund (Pill-Shape, klein)
- Border-Farbe (bei Danger-Buttons, Error-Inputs)
- Inline-Dot (●) für Status
- NIEMALS als großflächiger Hintergrund

---

## 3. Typografie

### Schrift
System-Font-Stack. Kein Google Fonts Import (file:// Kompatibilität).
```
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
```

### Skala
| Rolle | Größe | Gewicht | Farbe | Verwendung |
|---|---|---|---|---|
| Page Title | 22px | 500 | --tf-text | Seitentitel ("Förderanträge") |
| Section Header | 10.5px | 500, uppercase, 0.08em tracking | --tf-text-tertiary | "AKTUELLE VORGÄNGE", "LETZTE ARTEFAKTE" |
| Card Title | 14px | 500 | --tf-text | Titel in Cards und Listen |
| Body | 13.5px | 400 | --tf-text-secondary | Beschreibungen, Content |
| Small/Meta | 12px | 400 | --tf-text-tertiary | Timestamps, IDs, Hints |
| Badge | 11px | 400 | (semantisch) | Status-Badges |
| Input Label | 13px | 500 | --tf-text | Über Input-Feldern |

### Section-Header Pattern
Das zentrale typografische Element der App. Kleine Uppercase-Labels mit horizontaler Linie:
```css
.section-header {
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--tf-text-tertiary);
  display: flex;
  align-items: center;
  gap: 12px;
}
.section-header::after {
  content: '';
  flex: 1;
  height: 0.5px;
  background: var(--tf-border);
}
```

---

## 4. Spacing & Layout

### Spacing-Skala
| Token | Wert | Verwendung |
|---|---|---|
| xs | 4px | Zwischen Badge-Text und Rand |
| sm | 8px | Zwischen eng zusammengehörigen Elementen |
| md | 12px | Standard-Gap in Rows |
| lg | 16px | Padding in Cards, Gap in Listen |
| xl | 24px | Zwischen Sections |
| 2xl | 32px | Zwischen Hauptbereichen |
| 3xl | 40px | Page-Padding |

### Grundregel
Lieber zu viel Whitespace als zu wenig. Die App soll "atmen".

### Sidebar
- Breite: 220px (nicht 260px — schlanker)
- Collapsible auf 0px (nicht 60px — komplett weg)
- Padding: 24px vertikal, 8px horizontal für Nav-Items
- Nav-Item: 8px 12px Padding, 8px Border-Radius
- Kein Divider zwischen Items — Spacing reicht

### Content Area
Zwei Layout-Modi je nach Seitentyp:

**Lese-Layout** (Dashboard, Einstellungen mit wenig Content):
- Max-Width: 860px, linksbündig (kein `mx-auto` für Zentrierung bei großen Screens)
- Padding: 32px 40px
- Für textlastige Seiten, Formulare, Konfigurations-Panels

**Daten-Layout** (Boards, Listen, Admin-Übersichten):
- Volle Breite nutzen (kein max-w)
- Padding: 24px 32px (oder 24px 40px für mehr Luft)
- Für Seiten mit vielen Einträgen, Tabellen, Split-Views (Liste + Detail)
- Ermöglicht längere Titel ohne Truncation und mehr Informationsdichte

**Entscheidungsregel:** Wenn die Seite von mehr horizontalem Platz profitiert (längere Zeilen, Tabellen-Spalten, breitere Titel) → Daten-Layout. Wenn sie hauptsächlich Formulare oder Fließtext enthält → Lese-Layout.

### Grid-Pattern (Dashboard, Details)
```
Hauptinhalt (flex: 1) | Sidebar-Cards (260px)
```
Rechte Sidebar-Cards nur auf Übersichtsseiten. Detail-Seiten nutzen volle Breite.

---

## 5. Komponenten-Spezifikation

### UI-Library: shadcn/ui + lucide-react
TeamFlow nutzt **shadcn/ui** (Radix-basiert, Nova-Preset) für Standard-Komponenten. Alle UI-Primitives wie `Button`, `Select`, `Tabs`, `Slider`, `Badge`, `Switch`, `Card`, `Textarea` liegen in `src/components/ui/`. Icons kommen aus **lucide-react**.

**Eine UI-Bibliothek (P1b):** `src/components/ui/` ist die einzige Heimat — genau **eine Implementierung pro Primitive**. `@/ui` ist seit P1b nur ein **Kompatibilitäts-Shim** (Re-Export); in neuem Code direkt `@/components/ui/*` importieren. Der `Button` versteht zusätzlich die TF-Aliase `variant="primary|secondary|danger"`, `size="md"` sowie `loading`/`icon`. Maschinell erzwungen durch den Convention-Test `no-new-tf-ui-files` (keine neuen Dateien in `src/ui/`).

**Grundregeln:**
- Fehlende shadcn-Komponenten per `npx shadcn@latest add <n>` nachinstallieren
- shadcn-Komponenten sind bereits auf das Theme-System abgestimmt (CSS Custom Properties)
- Eigene Komponenten nur wenn shadcn nichts passendes hat (z.B. Filter-Pills sind custom)
- Die Spezifikationen unten gelten zusätzlich zu den shadcn-Defaults — z.B. "kein Bold" überschreibt den shadcn-Button der default auf font-medium steht

### Button
| Variante | Hintergrund | Border | Text | Wann |
|---|---|---|---|---|
| **Primary** | --tf-text (schwarz/dunkel) | none | weiß | Hauptaktion: Speichern, Erstellen |
| **Secondary** | transparent | 0.5px --tf-border-hover | --tf-text | Zweitaktion: Abbrechen, Filter |
| **Ghost** | transparent | none | --tf-text-secondary | Tertiär: "Mehr →", "Alle anzeigen" |
| **Danger** | transparent | 0.5px border-danger | text-danger | Destruktiv: Löschen |

```css
.btn {
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 13.5px;
  font-weight: 400;       /* NICHT 600 oder 700! */
  transition: all 0.15s;
  cursor: pointer;
}
.btn:hover { opacity: 0.85; }   /* Primary */
.btn:active { transform: scale(0.98); }
```

**Niemals**: Blaue Buttons, rote gefüllte Buttons, Gradient-Buttons, Buttons mit fetten Font-Weights.

### Badge / Status-Pill
```css
.badge {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 99px;
  /* Farbe je nach Semantik — IMMER gedämpft/pastellig */
}
```
Badges sind die EINZIGEN Elemente die semantische Hintergrundfarben nutzen dürfen.

**Badge-Farbregel:** IMMER dunkler Text auf hellem Hintergrund. Niemals gleicher Farbton für Text und Hintergrund (rot auf rot wirkt wie ein Alarm, ist schlecht lesbar).

| Semantik | Hintergrund | Text |
|---|---|---|
| Bug / Problem / Danger | `bg-red-50` | `text-red-800` |
| Idee / Feature / Info | `bg-blue-50` | `text-blue-800` |
| Lob / Success / Umgesetzt | `bg-emerald-50` | `text-emerald-800` |
| Frage / Warning / Geplant | `bg-amber-50` | `text-amber-800` |
| Neu / Unklassifiziert / Default | `bg-gray-100` | `text-gray-600` |
| Abgelehnt | `bg-red-50` | `text-red-700` |
| Archiviert | `bg-gray-50` | `text-gray-500` |

Im Dark Mode: Dunkle gedämpfte Hintergründe + hellere gedämpfte Text-Farben (siehe Kapitel 9).

### Monospace-ID-Badge
Für anonyme IDs (MA01), Aktenzeichen (FKZ-…), Tracking-Codes — alles wo der Wert eine maschinen-lesbare Kennung ist und auf einen Blick als solche erkennbar sein soll.

```tsx
<span className="font-mono px-2 py-0.5 rounded-md bg-[var(--tf-bg-secondary)] text-[var(--tf-text)]">
  MA07
</span>
```

Sizes: `sm` (11px), `md` (13px), `lg` (18px). Tracking dezent (`tracking-wide`).
Referenz: [src/plugins/auslastung/components/AnonymIdBadge.tsx](src/plugins/auslastung/components/AnonymIdBadge.tsx)

### Confidence-Dot
Kleiner farbiger Punkt für ML-Confidence oder Status-Indikator inline in Tabellen-Zeilen oder neben Titeln.

```tsx
<span className="inline-block w-2 h-2 rounded-full bg-emerald-500"
      title="Hohe Sicherheit" aria-label="Hohe Sicherheit" />
```

Farben: `bg-emerald-500` (high), `bg-amber-500` (medium), `bg-rose-500` (low). Tooltip mit Klartext für Hover + Screenreader.
Referenz: [src/plugins/auslastung/components/ConfidenceDot.tsx](src/plugins/auslastung/components/ConfidenceDot.tsx)

### Filter-Pills
Für Filterung nach 2-6 sichtbaren Optionen. BEVORZUGT gegenüber Dropdown-Selects — User sehen sofort welche Optionen verfügbar sind.

```css
.filter-pill {
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 11.5px;
  border: 0.5px solid var(--tf-border);
  color: var(--tf-text-secondary);
  background: transparent;
  cursor: pointer;
}
.filter-pill.active {
  background: var(--tf-text);          /* schwarz/dunkel */
  color: var(--tf-bg);                 /* weiß/hell */
  border-color: transparent;
}
```

**Bei mehreren Filter-Dimensionen (Status + Kategorie):** Jede Dimension in einer eigenen Zeile, mit einem kleinen Label links:

```tsx
<div className="flex items-center gap-1.5">
  <span className="w-[60px] text-[10px] uppercase tracking-wider 
                   text-tertiary font-medium flex-shrink-0">Status</span>
  <div className="flex gap-1.5 flex-wrap">{/* pills */}</div>
</div>
```

Das macht visuell klar welche Pills zu welcher Dimension gehören. Labels sind konsistent mit Section-Header-Pattern (10px, uppercase, tracking-wider, tertiary).

**Wann Dropdown statt Pills:** Wenn >6 Optionen oder Optionen dynamisch aus den Daten kommen (z.B. User-Filter bei 30+ Nutzern).

### Toggleable Pill (farbcodiert) — CLAUDE.md Pitfall #14
Variante einer Pill mit aktiv/inaktiv-Zustand, oft in Multi-Select-Listen (z.B. Kategorie-Zuordnung). Unterschied zu Filter-Pills: nicht schwarz/weiß, sondern semantische Farbe (eine Pill pro Kategorie). Dies ist die Detail-Heimat von CLAUDE.md Pitfall #14 (konstante Pill-Breite + kein `opacity-40`).

```tsx
// active=true: voller Farbcode + Häkchen
// active=false: outline-only, tertiary text
<KategoriePill kategorie={k} active={selected.has(k.id)} />
```

Drei Pflicht-Eigenschaften:
- **Klarer Kontrast**: aktiv = `bg-{farbe}-100 text-{farbe}-900 ring-{farbe}-300`; inaktiv = `bg-transparent text-tertiary ring-border` (kein `opacity-40`)
- **Layout-Stable**: Häkchen-Slot immer rendern, im Inaktiv-Modus mit `invisible` (CSS `visibility: hidden`) — Pill-Breite bleibt konstant
- **A11y**: `aria-pressed={active}` auf dem umschließenden Button

Referenz: [src/plugins/auslastung/components/KategoriePill.tsx](src/plugins/auslastung/components/KategoriePill.tsx)

### Card
```css
.card {
  border: 0.5px solid var(--tf-border);    /* NICHT 1px */
  border-radius: 12px;
  padding: 18px;
  background: var(--tf-bg);                /* NICHT secondary */
}
```
Kein Box-Shadow. Kein Hover-Effekt auf Cards (außer sie sind klickbar → dann hover:bg secondary).

### Input
```css
.input {
  padding: 8px 12px;
  border: 0.5px solid var(--tf-border);    /* Ultra-subtil */
  border-radius: 8px;
  font-size: 14px;
  background: transparent;
  transition: border-color 0.15s;
}
.input:hover { border-color: var(--tf-border-hover); }
.input:focus { border-color: var(--tf-primary); outline: none; }
.input.error { border-color: var(--tf-danger-border); }
```

### Slider + Inline-Value
Range-Slider zeigen den aktuellen Wert direkt im Label oben rechts, nicht erst nach Drag-Ende. Bei abhängigen Werten (z.B. Balance = 1 - Kompetenz) erscheint der Folgewert dezent unter dem Slider als Hint.

```tsx
<label>Gewichtung Kompetenz: {Math.round(value * 100)}%</label>
<input type="range" min={0} max={100} value={value * 100} onChange={...} />
<span className="text-[10.5px] text-[var(--tf-text-tertiary)]">
  Balance: {Math.round((1 - value) * 100)}%
</span>
```

Referenzen: [src/plugins/auslastung/views/admin/KonfigurationSection.tsx](src/plugins/auslastung/views/admin/KonfigurationSection.tsx), [src/plugins/auslastung/components/KalibrierungsReport.tsx](src/plugins/auslastung/components/KalibrierungsReport.tsx) (Scope-Slider)

### Tabs
Underline-Style, NICHT gefüllte Tabs:
```css
.tab {
  padding: 8px 16px;
  font-size: 13.5px;
  color: var(--tf-text-secondary);
  border-bottom: 2px solid transparent;
}
.tab.active {
  color: var(--tf-text);
  border-bottom-color: var(--tf-text);     /* Schwarz, NICHT primary */
  font-weight: 500;
}
```

**Count-Badges in Tab-Labels:** Wenn Tabs unterschiedliche Datenmengen repräsentieren, zeige die Anzahl als kleines Badge direkt nach dem Label:

```tsx
<span>Tickets</span>
<span className="ml-1.5 bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)] 
                 text-[10px] px-1.5 py-0.5 rounded-full">8</span>
```

Das gibt dem User sofortige Orientierung ohne Tab-Wechsel. Sparsam einsetzen — nur wo die Zahl wirklich hilft.

### Dialog / Modal
```css
.dialog-overlay {
  background: rgba(0, 0, 0, 0.4);         /* NICHT 0.5 — subtiler */
}
.dialog {
  background: var(--tf-bg);
  border-radius: 16px;
  padding: 24px;
  max-width: 480px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);  /* Einziger erlaubter Shadow */
}
```

Kanonischer Modal-Pfad: `Dialog` aus [`@/components/ui/dialog`](src/components/ui/dialog.tsx) — bringt Höhen-Cap + internen Scroll mit. Props: `size` (`sm`=400 / `md`=480 Default / `lg`=2xl / `xl`=4xl) und `align` (`center` Default / `top` = `items-start pt-[8vh]` für inhaltsreiche Dialoge). Eigene `fixed inset-0`-Hüllen sind per Convention-Test `no-raw-modal` verboten (s. recurring-bug-classes Klasse 7).

### Listen-Item
Für Vorgänge, Dokumente, Artefakte — die häufigste Komponente. **Kanonische Komponente: [`ListItem`](src/components/ui/ListItem.tsx). Listenzeilen nie per Hand bauen — `ListItem` deckt stacked und inline ab.** Zwei Layouts:

- **`layout="stacked"`** (Default): Titel über Subtitle, `meta` rechts — die klassische zweizeilige Zeile (Einstellungen, „Meine Anträge", Verzeichnis-Listen). Default-Rendering, keine Pflicht-Props außer `title`.
- **`layout="inline"`**: Titel und Subtitle **nebeneinander** in einer Zeile (Titel `whitespace-nowrap`, Subtitle `truncate flex-1`) — für einzeilige Daten-Zeilen mit Aktions-Buttons in einem gerundeten Listen-Container (Skill-/Regel-Liste). Bringt das passende Zeilen-Chrome mit (`px-4 py-2.5`, Hover-Background).

```tsx
<div className="rounded-[12px] border-[0.5px] border-[var(--tf-border)] overflow-hidden">
  {items.map((it, i) => (
    <ListItem
      key={it.id}
      layout="inline"
      last={i === items.length - 1}
      onClick={() => onEdit(it)}
      title={it.name}
      subtitle={it.beschreibung}
      meta={<span className="text-[11.5px] text-[var(--tf-text-tertiary)] whitespace-nowrap">v3 · 2 Regeln</span>}
      actions={<RowAction title="Löschen" danger onClick={…}><Trash2 size={14} /></RowAction>}
    />
  ))}
</div>
```

- **`actions`-Slot**: rechtsbündig **nach** `meta`; Klicks darin lösen die Zeilen-`onClick` **nicht** aus (Stop-Propagation eingebaut). Die einzelnen Icon-Buttons sind [`RowAction`](src/components/ui/RowAction.tsx) (`title`, optional `danger`) — ebenfalls nicht per Hand bauen.
- **`last`** steuert den Trenner (untere `0.5px`-Border außer letzter Zeile) — für beide Layouts; intern weiterhin `flex items-center` + `border-bottom`.

Listen-Items sind einfache Zeilen. KEINE Cards-in-Listen (zu schwer).

### Callout / Highlight-Bar
Für wichtige Hinweise (nächster Schritt, Frist-Warnung):
```css
.callout {
  border-left: 3px solid var(--tf-border-hover);  /* NICHT primary — zu laut */
  padding: 14px 18px;
}
```
Einziges Element mit sichtbarer linker Borderlinie. Sparsam einsetzen (max 1 pro Seite).

### Inline-Error-Banner
Für Speicher-Fehler, Operations-Fehler, Validierungs-Fehler am Form-Ende — alles wo der User wissen muss „die letzte Aktion ist fehlgeschlagen". Unterschied zu „Validierung inline am Feld" (bleibt direkt unter Input): Error-Banner ist eine separate Box, meist unten in der Section.

```tsx
{error && (
  <div className="rounded p-2.5 text-[12px]"
       style={{ background: '#fee2e2', color: '#991b1b', border: '0.5px solid #fca5a5' }}>
    ⚠ Setup konnte nicht gespeichert werden: <span className="font-mono">{error}</span>
  </div>
)}
```

Persistent bis Error behoben oder Aktion erneut versucht. Bei Async-Operations (Save, Upload): **immer** mit `try/catch` setzen, nicht nur in Console loggen.

Referenz: [src/plugins/auslastung/views/admin/SetupWizard.tsx](src/plugins/auslastung/views/admin/SetupWizard.tsx) (Setup-Fehler-Banner)

### Metric-Card (Dashboard-Widgets)
```css
.metric-card {
  background: var(--tf-bg-secondary);
  border-radius: 8px;
  padding: 16px;
  /* KEIN Border — die Fläche reicht */
}
.metric-label { font-size: 12px; color: var(--tf-text-tertiary); }
.metric-value { font-size: 22px; font-weight: 500; margin-top: 4px; }
```

### View-Toggle (Cards ↔ Liste)
Für Seiten mit wechselbaren Darstellungen. Zwei Icon-Buttons oben rechts, User-Präferenz in localStorage persistiert:

```tsx
const [viewMode, setViewMode] = useState<'cards' | 'list'>(() => {
  return (localStorage.getItem('teamflow_[page]_view') as 'cards' | 'list') || 'cards';
});

<div className="flex gap-0.5">
  <button onClick={() => setViewMode('cards')} 
          className={viewMode === 'cards' ? 'active' : ''}>
    <LayoutGrid size={14} />
  </button>
  <button onClick={() => setViewMode('list')} 
          className={viewMode === 'list' ? 'active' : ''}>
    <List size={14} />
  </button>
</div>
```

- Icons von lucide-react: `LayoutGrid` und `List`
- Aktiv: `bg-secondary + border-secondary` (dezent, nicht primary)
- Persistenz pro Seite (eigener localStorage-Key)

### Intro-Banner (erklärend, dismissable)
Für Features die Erklärung brauchen. Erscheint beim ersten Besuch, verschwindet per "Verstanden":

```tsx
const [shown, setShown] = useState(() => 
  localStorage.getItem('teamflow_[feature]_intro_seen') !== '1'
);
if (!shown) return null;

<div className="bg-[var(--tf-warning-bg)] border border-[var(--tf-warning-border)] 
                rounded-lg px-4 py-3 flex items-center gap-3 mb-4">
  <Icon className="shrink-0" />
  <p className="flex-1 text-[12.5px]">
    <b>Heading:</b> Kurze Erklärung in 1-2 Sätzen.
  </p>
  <button onClick={() => {
    localStorage.setItem('teamflow_[feature]_intro_seen', '1');
    setShown(false);
  }}>Verstanden ×</button>
</div>
```

Dezente Warning-Farbe (nicht Primary — das wäre zu laut), max. 2 Sätze, ein Dismiss-Button. Einmal dismissed → nie wieder zeigen.

### Split-View (Liste + Detail)
Zwei-Spalten-Layout für Admin-Bereiche wo der User Items auswählt und bearbeitet:

```tsx
<div className="grid grid-cols-2 gap-4">
  <div>{/* Liste links */}</div>
  <div>{/* Detail rechts, oder Empty-State */}</div>
</div>
```

- Standard: 50/50 Grid (`grid-cols-2`)
- Bei langen Titeln in der Liste: 50/50 statt 40/60, damit Titel nicht truncaten
- Empty-State rechts wenn nichts ausgewählt: zentrierter Text "← Item auswählen" in tertiary color

### Drag&Drop-Upload-Zone
Für XLSX/CSV/JSON-Imports. Dashed Border als Drop-Target, hover-/dragging-State mit Primary-Border, IMMER mit File-Picker-Button als Fallback (manche User wissen nicht dass Drop möglich ist).

```tsx
<div onDragOver={onDragOver} onDrop={onDrop}
     style={{ border: dragging ? '1.5px dashed var(--tf-primary)' : '1.5px dashed var(--tf-border)',
              background: dragging ? 'var(--tf-bg-secondary)' : 'transparent' }}>
  <p>Datei hier ablegen</p>
  <label className="btn">Datei wählen<input type="file" hidden ... /></label>
</div>
```

Multi-File-Support optional (für z.B. Multi-MA-Onboarding-Import).
Referenzen: [src/plugins/auslastung/components/ImportDialog.tsx](src/plugins/auslastung/components/ImportDialog.tsx), [src/plugins/auslastung/components/OnboardingImportDialog.tsx](src/plugins/auslastung/components/OnboardingImportDialog.tsx)

### Multi-Step Wizard
Mehrstufiger Setup/Configuration-Flow in einer Card. Step-Dots oben rechts zeigen Fortschritt; Zurück (Ghost) / Weiter oder Fertig (Primary) unten.

Step-Dot-Zustände: `active` = schwarz, `done` = `bg-emerald-500` + Häkchen, `pending` = `bg-secondary` + Nummer.

**Kritischer Hinweis zum finalen Step:**
Wenn `finish()` mehrere Stores/Felder ändert + persistiert, das in **EINEM** `setState` + **EINEM** `persist`-Call zusammenfassen. Mehrere parallele `persist`-Aufrufe (z.B. wenn jede `upsertX`-Action ihren eigenen persist triggert) fallen oft durch `if (saving) return;`-Locks raus → silent inkonsistenter Speicher-Zustand. Plus: finale Aktion immer mit `try/catch` + Error-Banner (siehe oben), nicht `try/finally` + `void promise()`.

```tsx
async function finish() {
  setBusy(true); setError(null);
  try {
    useStore.setState(state => ({ data: { ...state.data, /* alle Änderungen */ } }));
    await persist(storage);
  } catch (err) {
    console.error('[Wizard] finish failed:', err);
    setError(err instanceof Error ? err.message : String(err));
  } finally {
    setBusy(false);
  }
}
```

Referenz: [src/plugins/auslastung/views/admin/SetupWizard.tsx](src/plugins/auslastung/views/admin/SetupWizard.tsx)

### Toast (Auto-Dismiss)
Fix bottom-right Notification für reversible Aktionen (Bestätigungen wie „Zugewiesen ✓", Statuswechsel). 3 Sekunden auto-dismiss, klickbar zum sofortigen Schließen.

```tsx
<div role="status" aria-live="polite"
     className="fixed bottom-6 right-6 z-40 px-4 py-3 rounded-[10px] cursor-pointer shadow-lg"
     style={{ background: 'var(--tf-bg)', border: '0.5px solid var(--tf-success-border)' }}>
  {message}
</div>
```

Tones (Border-Farbe): `success` emerald, `info` sky, `error` rose. Für nicht-reversible/destruktive Aktionen lieber Inline-Error-Banner.

Referenz: [src/plugins/dokument-review/components/ReviewToast.tsx](src/plugins/dokument-review/components/ReviewToast.tsx)

---

### Dichte Daten-Matrix (Skill-/Heatmap-Tabelle)

Für die Kompetenz-Matrix (Auslastung) gelten Sonderregeln gegenüber dem sonst monochromen Fundament — bewusst, weil hier Farbe Information transportiert (Kompetenz-Niveau + Kapazitäts-Menge auf einen Blick). Referenz: [src/plugins/auslastung/components/kompetenz/](src/plugins/auslastung/components/kompetenz/).

- **Zwei getrennte Heatmap-Sprachen, nie vermischt:** **Grün** = Kompetenz-Level (Qualität), **Graustufen** = Kapazitäts-Menge (Quantität). Eine zweite Farb-Heatmap für Kapazität ist verboten — sonst verschwimmt „viel Kontingent" mit „hohe Kompetenz".
- **Neue Tokens** (`src/theme.css`, Light + `[data-theme="dark"]`):
  - `--tf-level-{1,2,3}-bg` / `--tf-level-{1,2,3}-text` — grüne Level-Heatmap (Level-Zelle setzt nur `data-v`, Farbe kommt aus dem CSS-Selektor → Dark automatisch).
  - `--tf-cap-base-l` / `--tf-cap-range` — Graustufen-Rampe `L = (base − ratio × range) %`. Dark hat negativen `range` (dichter = heller). `--tf-cap-band-bg/-border/-text` für das KAP-Header-Band.
  - `--kat-band-l` / `--kat-code-bg-l` / `--kat-text-l` — theme-skopierte Lightness der Kategorie-Bänder/Code-Header/Chips. Hue/Sat kommen pro Kategorie als `--kat-h`/`--kat-s` (aus `KATEGORIE_HS`, gesetzt via `katVars()`); ein Theme-Switch tintet so alle Kategorien automatisch. Bandfarbe folgt `config.ueberKategorien[].farbe` (konsistent mit den übrigen Tabs), nicht festen Hues.
- **Hover-Highlight ohne Per-Frame-Re-Render:** Spalten-/Gruppen-Hover (Ring auf Treffer-Zellen, Dimmen der Nicht-Treffer-Zeilen, Perimeter-Rahmen) laufen rein über CSS-Attribut-Selektoren mit `:has()` / `:not(:has())`, getrieben von `data-hcol`/`data-hgrp` auf der `.twrap` (einziger React-State für die Reveal-Bar). Per-Zelle nur statische `data-ci`/`data-gi`/`data-v`. Chrome/Edge-only (`:has()`) ist hier akzeptiert (`file://`-Zielbrowser).
- **Inline-Style-Ausnahme:** Nur für dynamische, datengetriebene Werte erlaubt — die Graustufen-bg (`capCellBg`), die `--kat-h`/`--kat-s`-Custom-Props und die Sticky-`left`/`right`-Offsets (aus einer einzigen Geometrie-Quelle, `kompetenz-geometry.ts`). Alles andere via Token/Tailwind.

---

## 6. Layout-Patterns

### Dashboard / Home
```
┌─ Header ─────────────────────────────────────────────┐
│ Guten Tag, {Name}  Abteilung                        │
│ X offene Vorgänge · Y Fristen diese Woche            │
└──────────────────────────────────────────────────────┘

┌─ Callout (max 1) ────────────────────────────────────┐
│ ▌ Nächster Schritt · Frist in 3 Tagen         [Öffnen]│
│ ▌ BA-2026-007 — Nachforderung Statik                  │
└──────────────────────────────────────────────────────┘

┌─ Hauptbereich ──────────────────┐ ┌─ Sidebar-Cards ──┐
│ AKTUELLE VORGÄNGE ────────────  │ │ Offene Fristen   │
│ List-Item                       │ │ ...              │
│ List-Item                       │ │                  │
│ List-Item                       │ │ AI-Status        │
│                                 │ │ ...              │
│ LETZTE ARTEFAKTE ─────────────  │ │                  │
│ List-Item                       │ │ Suchindex        │
│ List-Item                       │ │ ...              │
└─────────────────────────────────┘ └──────────────────┘
```

### Listen-Seite (Förderanträge, Dokumente)
```
┌─ Header ─────────────────────────────────────────────┐
│ Förderanträge                            [⚙ Spalten]  │
└──────────────────────────────────────────────────────┘

┌─ Filter ─────────────────────────────────────────────┐
│ [Status ▾]  [🔍 Suche...]                            │
└──────────────────────────────────────────────────────┘

  List-Item  ────────────────────────────  Badge  Meta
  List-Item  ────────────────────────────  Badge  Meta
  List-Item  ────────────────────────────  Badge  Meta
```

### Detail-Seite (Antrag / Verbund)
```
  ← Alle Förderanträge

┌─ Header ─────────────────────────────────────────────┐
│ Sensorik 4.0 — Verbundvorhaben       [Status ▾] [···]│
│ 16KN123456 · Eingang 15.01.2026                      │
└──────────────────────────────────────────────────────┘

  Übersicht | Teilvorhaben | Dokumente | Notizen
  ─────────────────────────────────────────────

  (Tab-Inhalt, volle Breite)
```

### Sectioned Admin-Page
Wenn eine Admin-Seite mehrere Konfigurations-Bereiche hat, die alle gleichzeitig sichtbar/bearbeitbar sein sollen (statt versteckt hinter Tabs): **stacked Cards untereinander** statt sub-Tabs.

```
┌─ Setup-Wizard (nur wenn !setupAbgeschlossen) ──┐
│ ...                                            │
└────────────────────────────────────────────────┘
┌─ Konfiguration ────────────────────────────────┐
│ Stunden / Quartal / Gewichtung                 │
└────────────────────────────────────────────────┘
┌─ Überkategorien ───────────────────────────────┐
│ Tabelle + Drawer für Mapping                   │
└────────────────────────────────────────────────┘
┌─ Embedding-Corpus ─────────────────────────────┐
│ Progress + Build-Buttons                       │
└────────────────────────────────────────────────┘
┌─ Mitarbeiter ──────────────────────────────────┐
│ MA-Tabelle + CRUD                              │
└────────────────────────────────────────────────┘
```

Jede Card mit eigener `<h3>` (14px, 500, primary) + eigenem Save-Pfad. Reihenfolge: Setup-Wizard (falls offen) → Konfiguration → Inhalts-Sections → User-Verwaltung.

Wann Tabs statt Sections: wenn die Bereiche zu lang/komplex sind und gleichzeitiges Anzeigen die Seite unscrollbar lang machen würde.

Referenz: [src/plugins/auslastung/views/AuslastungAdmin.tsx](src/plugins/auslastung/views/AuslastungAdmin.tsx)

### Listen-/Tabellen-Seite — Förderanträge als Referenz-Muster

**Pflicht-Check bei jedem neuen UI-Element und jeder neuen Seite:** Bevor eine Liste, Tabelle, Übersicht oder ein neues Seiten-Layout gebaut wird, IMMER zuerst prüfen, ob die **Förderanträge-Ansicht** ([src/plugins/antraege/](src/plugins/antraege/)) als Vorlage passt. Ziel ist eine konsistente Darstellung über die ganze App — der User soll dieselbe Bedien-Logik wiedererkennen, egal in welchem Bereich er eine Liste sieht. Eine eigene Sonderlösung nur dann, wenn das Förderanträge-Muster nachweislich nicht passt.

Das Muster besteht aus wiederverwendbaren Bausteinen:
- **Vollbreiter Header mit Unterkanten-Border**: Titel (22px/500), darunter **Unterstrich-Tabs** mit Count (siehe „Tabs" in Kapitel 5).
- **Toolbar**: Suchleiste (Substring) + **Ansichts-Umschalter Liste/Tabelle/Karten** + Aktions-Button(s) rechts (`ml-auto`).
- **Dichte Tabelle** über die generischen Bausteine aus [src/components/data-table/](src/components/data-table/): `SortableTable` + `ColumnPicker` + `useTableSort`/`useColumnVisibility`/`useColumnWidths` (eigener localStorage-Key pro Seite). Status-/Mengen-Werte als `Badge`-Pille.
- View-Modus per Seite in localStorage persistiert (eigener Key).

**„Weglassen, was keinen Sinn macht":** Nicht blind kopieren — nur die Teile übernehmen, die der konkrete Datentyp braucht. Beispiel: die Skill-Verwaltung ([src/plugins/skill-verwaltung-kuration/](src/plugins/skill-verwaltung-kuration/)) hat das Muster für beide Tabs übernommen, aber semantische Suche, Quickfilter-Pillen, XLSX-Export und Status-Gruppierung weggelassen (für ~7 Einträge sinnlos).

**Wann NICHT dieses Muster:** reine Lese-/Formular-Seiten (Einstellungen, Detail-Ansichten, Dashboards) → Lese-Layout (Kapitel 4). Das Förderanträge-Muster ist für **Daten-Layouts** (Listen, Tabellen, viele Einträge).

Referenz-Adopter: [src/plugins/antraege/](src/plugins/antraege/) (Original), [src/plugins/skill-verwaltung-kuration/](src/plugins/skill-verwaltung-kuration/) (Skills + Qualitätsregeln).

---

## 7. Micro-Interactions & Transitions

### Erlaubt
- **Hover**: opacity 0.85, background-change (subtle), border-color change
- **Active**: scale(0.98) auf Buttons
- **Focus**: border-color zu primary
- **Transitions**: 0.15s für Hover/Focus, 0.2s für Layout-Änderungen
- **Dialog**: Fade-in Overlay + Scale-in Dialog (0.2s ease-out)

### Verboten
- Keine Slide-Animations für Seitenübergänge
- Keine Bounce/Spring-Effekte
- Keine Skeleton-Loading-Screens (einfacher Spinner oder "Laden..." Text)
- Keine Animierten Fortschrittsbalken (nur bei Admin-Indexierung erlaubt)
- Keine Tooltip-Delays unter 500ms

---

## 8. Icons

### Library: Lucide React
- Standardgröße: 18px (in Sidebar), 16px (inline)
- Stroke-Width: 1.5 (default)
- Farbe: `currentColor` (erbt vom Text)
- Opacity: 0.5 in Sidebar (0.8 wenn aktiv)

### Wann Icons
- ✅ Sidebar-Navigation (ein Icon pro Eintrag)
- ✅ Buttons mit ambiger Bedeutung (Löschen → Trash2)
- ✅ Inline-Status (● Punkt für Connected/Disconnected)
- ❌ NICHT in Listen-Items (Text reicht)
- ❌ NICHT als Dekoration
- ❌ NICHT mehr als 1 Icon pro Button

---

## 9. Dark Mode (Warm-grau)

Dark Mode wird über `[data-theme="dark"]` auf `<html>` aktiviert.

### Ästhetik
Warm-grau mit leichtem Gelbstich — wie Papier bei Lampenlicht. Nicht kalt, nicht neutral, nicht schwarz. Augenschonend für lange Bildschirmarbeit in Behörden-Umgebungen.

### Prinzipien
- NICHT einfach Farben invertieren — Dark Mode hat eigenständige Warm-grau-Palette
- Hintergrund ist warm-dunkel (#2a2a28), NICHT schwarz (#000) und NICHT kalt-grau (#1a1a1a)
- Text ist warm-hell (#cccac4), NICHT weiß (#fff) und NICHT kalt-hell (#e0e0e0)
- Kontrast bewusst reduziert (~9.5:1 statt 12:1) — weniger Blendung bei langem Arbeiten
- Borders nutzen warm-getönte rgba-Werte (rgba(200,195,180,...))
- Semantische Badge-Farben: Gedämpfte, warme Varianten (niedrigere Sättigung, dunklere Hintergründe)
- Sidebar ist etwas dunkler als der Hauptbereich (#222220 vs #2a2a28)
- Kein einziges Element hat mehr visuelles Gewicht als im Light Mode

### Dark Mode Semantische Farben
| Bedeutung | Hintergrund | Text |
|---|---|---|
| Info | hsl(210, 18%, 22%) | hsl(210, 30%, 66%) |
| Success | hsl(145, 15%, 20%) | hsl(145, 28%, 62%) |
| Warning | hsl(40, 20%, 21%) | hsl(40, 35%, 68%) |
| Danger | hsl(0, 16%, 23%) | hsl(0, 28%, 68%) |

---

## 10. User Journey & UX-Prinzipien

### Onboarding
- Maximal 3 Schritte, jeder in 10 Sekunden machbar
- Keine Erklär-Texte die man lesen muss — UI ist selbsterklärend
- Fortschritt als Dots (● ○ ○), nicht als Nummern

### Navigation
- Sidebar ist die einzige Navigation — keine verschachtelten Menüs
- "Zurück"-Links als Text ("← Alle Förderanträge"), nicht als Icon-Button
- Aktive Seite in Sidebar immer sichtbar hervorgehoben
- Breadcrumbs nur wenn 2+ Ebenen tief

### Formulare
- Labels immer ÜBER dem Input, nie links daneben
- Ein Primary-Button pro Form ("Speichern"), ein Secondary ("Abbrechen")
- Validierung inline unter dem Feld, nicht als Alert-Box
- Auto-Save wo sinnvoll (Notizen), mit "Gespeichert ✓" Feedback

### Feedback
- Erfolg: Kurzer Text "Gespeichert ✓" der nach 3s verschwindet
- Fehler: Inline am Element, rot, persistent bis gefixt
- Loading: Dezenter Spinner oder "Laden..." Text, kein Skeleton
- Leer: Freundlicher Text + eine Aktion ("Noch keine Förderanträge erfasst → CSV importieren")
- **Async-Operations** (Save, Upload, Setup-Finish): IMMER sichtbarer Loading-State (Button-Text „Speichere…") UND Error-Banner bei Fehler. Errors aus `try/catch` ins UI rendern (siehe Inline-Error-Banner in Kapitel 5) — nicht nur in die Console: unter `file://` ist die Console oft nicht offen, der User sieht sonst nichts

### Anonymisierung
Wenn Daten anonymisiert angezeigt werden (Datenschutz-Kontext, z.B. MA-IDs MA01-MA30 statt echter Kürzel):
- Anon-Kennungen IMMER als **Monospace-ID-Badges** (siehe Kapitel 5), nicht als inline-Text — sonst wirken sie wie normale Wörter
- An prominenter Stelle (Plugin-Header, About-Section) ein Klartext-Hinweis: „Hinter MA-Nummern stecken echte Bearbeiter — De-Anonymisierung nur via geschütztem Export"
- Echte Kürzel landen NIE im UI, NIE in IDB, NIE auf SMB-Share — ausschließlich im RAM während eines Export-Vorgangs (passwortgeschütztes AES-256-ZIP)

### Kognitive Last reduzieren
- Max 5-7 Elemente pro visueller Gruppe
- Filter sind optional — Default zeigt alles Relevante
- Keine verschachtelten Dialoge (Dialog-in-Dialog)
- Keine Bestätigung für reversible Aktionen (nur für Löschen)

---

## 11. Checkliste für neue Komponenten

Bevor eine neue UI-Komponente committed wird, prüfe:

- [ ] Neue Seite/Liste/Tabelle: geprüft, ob das **Förderanträge-Muster** (Unterstrich-Tabs + Suche + Ansichts-Umschalter + `data-table`-Tabelle) als konsistente Darstellung passt (Kapitel 6)
- [ ] Nutzt shadcn/ui wo möglich (Button, Select, Tabs, etc.)
- [ ] Nutzt ausschließlich CSS Custom Properties für Farben
- [ ] Keine hartcodierten Hex-Werte
- [ ] Border ist 0.5px, nicht 1px
- [ ] Border-Radius ist 8px (Elemente) oder 12px (Cards)
- [ ] Font-Weight ist 400 oder 500, niemals 600/700
- [ ] Kein Box-Shadow (außer Dialog und Focus-Ring)
- [ ] Badge-Farben: dunkler Text auf hellem Hintergrund (nicht rot auf rot)
- [ ] Filter mit 2-6 Optionen als Pills, nicht als Dropdown
- [ ] Bei mehreren Filter-Dimensionen: Label-Spalte links (STATUS / KATEGORIE)
- [ ] Volle Breite für Daten-Layouts, max-w nur für Lese-Layouts
- [ ] Farbe transportiert Information, nicht Dekoration
- [ ] Dark Mode funktioniert (data-theme="dark" testen)
- [ ] Text-Hierarchie stimmt (primary/secondary/tertiary)
- [ ] Genug Whitespace (im Zweifel mehr)
- [ ] Eine kohärente Verantwortung pro Datei; ab ~400–500 Zeilen auf Mehrfach-Verantwortung prüfen (siehe CLAUDE.md → File Size Limit)
- [ ] Kein redundantes Wrapping (div um div um div)
- [ ] Tab-Count-Badges wo sinnvoll (Anzahl direkt im Tab-Label)
- [ ] Toggle-Buttons (Pill, Chip) haben deutlich sichtbaren aktiv/inaktiv-Kontrast (nicht `opacity-40`-Trick)
- [ ] Pills mit inhalts-abhängiger Breite reservieren ihren Platz konstant (z.B. `invisible`-Spans für optionale Icons/Häkchen)
- [ ] Async UI-Aktionen haben `try/catch` + sichtbares Error-Banner (nicht nur Console-Error)
- [ ] `aria-pressed` auf Toggle-Buttons, `aria-current` auf aktiven Nav-Items
- [ ] Multi-Step-Setup: EIN finaler `setState` + EIN `persist` (keine Lock-Races durch mehrere parallele async-Aufrufe)
- [ ] Anonymisierte IDs als Monospace-ID-Badges, nicht als inline-Text
