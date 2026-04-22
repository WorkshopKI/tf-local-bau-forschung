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
| Page Title | 22px | 500 | --tf-text | Seitentitel ("Bauanträge") |
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

### Listen-Item
Für Vorgänge, Dokumente, Artefakte — die häufigste Komponente:
```css
.list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 0.5px solid var(--tf-border);
}
.list-item:last-child { border-bottom: none; }
```
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

### Listen-Seite (Bauanträge, Dokumente)
```
┌─ Header ─────────────────────────────────────────────┐
│ Bauanträge                             [+ Neuer Antrag]│
└──────────────────────────────────────────────────────┘

┌─ Filter ─────────────────────────────────────────────┐
│ [Status ▾]  [🔍 Suche...]                            │
└──────────────────────────────────────────────────────┘

  List-Item  ────────────────────────────  Badge  Meta
  List-Item  ────────────────────────────  Badge  Meta
  List-Item  ────────────────────────────  Badge  Meta
```

### Detail-Seite (Vorgang)
```
  ← Alle Bauanträge

┌─ Header ─────────────────────────────────────────────┐
│ Neubau EFH, Musterstraße 12          [Status ▾] [···]│
│ BA-2026-003 · Erstellt 15.01.2026                    │
└──────────────────────────────────────────────────────┘

  Übersicht | Dokumente | Artefakte | Notizen
  ─────────────────────────────────────────────

  (Tab-Inhalt, volle Breite)
```

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
- "Zurück"-Links als Text ("← Alle Bauanträge"), nicht als Icon-Button
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
- Leer: Freundlicher Text + eine Aktion ("Noch keine Bauanträge. Erstelle den ersten →")

### Kognitive Last reduzieren
- Max 5-7 Elemente pro visueller Gruppe
- Filter sind optional — Default zeigt alles Relevante
- Keine verschachtelten Dialoge (Dialog-in-Dialog)
- Keine Bestätigung für reversible Aktionen (nur für Löschen)

---

## 11. Checkliste für neue Komponenten

Bevor eine neue UI-Komponente committed wird, prüfe:

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
- [ ] Unter 300 Zeilen pro Datei (Obergrenze für LLM-Kontext)
- [ ] Kein redundantes Wrapping (div um div um div)
- [ ] Tab-Count-Badges wo sinnvoll (Anzahl direkt im Tab-Label)
