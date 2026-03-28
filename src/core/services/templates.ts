import type { Vorgang } from '@/core/types/vorgang';

const TEMPLATES: Record<string, string> = {
  nachforderung: `Betreff: Nachforderung zum {{type}} {{id}}

Sehr geehrte Damen und Herren,

im Rahmen der Prüfung Ihres Antrags {{id}} ({{title}})
wurden folgende fehlende Unterlagen festgestellt:

1. {{HIER FEHLENDE UNTERLAGEN EINTRAGEN}}
2.
3.

Bitte reichen Sie die genannten Unterlagen bis zum {{FRIST EINTRAGEN}} ein.

Mit freundlichen Grüßen
{{IHREN NAMEN EINTRAGEN}}`,

  email: `Betreff: Ihr Antrag {{id}} — {{title}}

Sehr geehrte Damen und Herren,

bezüglich Ihres Antrags {{id}} ({{title}}) möchten wir Sie über Folgendes informieren:

{{INHALT HIER EINFÜGEN}}

Mit freundlichen Grüßen
{{IHREN NAMEN EINTRAGEN}}`,

  gutachten: `# Gutachten zum Antrag {{id}}

## 1. Zusammenfassung
Antrag: {{title}}
Status: {{status}}

## 2. Prüfpunkte
{{PRÜFPUNKTE HIER EINFÜGEN}}

## 3. Feststellungen
{{FESTSTELLUNGEN HIER EINFÜGEN}}

## 4. Empfehlung
{{EMPFEHLUNG HIER EINFÜGEN}}`,

  pruefbericht: `# Prüfbericht — {{id}}

**Antrag:** {{title}}
**Priorität:** {{priority}}

## Prüfungsergebnis
{{ERGEBNIS HIER EINFÜGEN}}

## Auflagen
{{AUFLAGEN HIER EINFÜGEN}}

## Empfehlung
{{EMPFEHLUNG HIER EINFÜGEN}}`,

  bewilligung: `# Bewilligungsbescheid

**Antrag:** {{id}} — {{title}}

Ihr oben genannter Antrag wird hiermit **bewilligt**.

## Auflagen und Bedingungen
{{AUFLAGEN HIER EINFÜGEN}}

Mit freundlichen Grüßen
{{IHREN NAMEN EINTRAGEN}}`,
};

export function fillTemplate(type: string, vorgang: Vorgang): string {
  const template = TEMPLATES[type] ?? TEMPLATES['email'] ?? '';
  return template
    .replace(/\{\{id\}\}/g, vorgang.id)
    .replace(/\{\{title\}\}/g, vorgang.title)
    .replace(/\{\{type\}\}/g, vorgang.type === 'bauantrag' ? 'Bauantrag' : 'Forschungsantrag')
    .replace(/\{\{status\}\}/g, vorgang.status)
    .replace(/\{\{priority\}\}/g, vorgang.priority);
}

export function getTemplateTypes(): Array<{ value: string; label: string }> {
  return [
    { value: 'nachforderung', label: 'Nachforderung' },
    { value: 'email', label: 'E-Mail' },
    { value: 'gutachten', label: 'Gutachten' },
    { value: 'pruefbericht', label: 'Prüfbericht' },
    { value: 'bewilligung', label: 'Bewilligung' },
  ];
}
