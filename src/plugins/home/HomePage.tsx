import { useState } from 'react';
import { Save, Trash2, Plus } from 'lucide-react';
import {
  Button, Card, Input, Dialog, Badge, Tabs, Select, FileDropZone, MarkdownRenderer,
} from '@/ui';

const sampleMarkdown = `## Markdown Preview

Dies ist ein **fetter** und *kursiver* Text.

- Listenpunkt 1
- Listenpunkt 2

\`\`\`typescript
const x = 42;
\`\`\`

> Ein Blockquote zur Demonstration.

| Spalte A | Spalte B |
|----------|----------|
| Wert 1   | Wert 2   |
`;

export function HomePage(): React.ReactElement {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('tab1');

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-[var(--tf-text)]">Component Showcase</h1>

      {/* Buttons */}
      <Card title="Buttons">
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" icon={Save}>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger" icon={Trash2}>Danger</Button>
          <Button variant="primary" loading>Loading</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </div>
        <div className="flex flex-wrap gap-3 mt-4">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
      </Card>

      {/* Badges */}
      <Card title="Badges">
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="error">Error</Badge>
          <Badge variant="info">Info</Badge>
        </div>
      </Card>

      {/* Inputs */}
      <Card title="Inputs">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Name" placeholder="Max Mustermann" />
          <Input label="E-Mail" placeholder="max@example.de" error="Ungültige E-Mail" />
          <Input label="Beschreibung" description="Optional" placeholder="..." />
          <Select
            label="Kategorie"
            options={[
              { value: 'bau', label: 'Bauanträge' },
              { value: 'forschung', label: 'Forschung' },
            ]}
          />
        </div>
      </Card>

      {/* Tabs */}
      <Card title="Tabs">
        <Tabs
          tabs={[
            { id: 'tab1', label: 'Übersicht' },
            { id: 'tab2', label: 'Details' },
            { id: 'tab3', label: 'Verlauf' },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />
        <p className="mt-4 text-sm text-[var(--tf-text-secondary)]">
          Aktiver Tab: {activeTab}
        </p>
      </Card>

      {/* Dialog */}
      <Card title="Dialog">
        <Button icon={Plus} onClick={() => setDialogOpen(true)}>Dialog öffnen</Button>
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Beispiel-Dialog"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
              <Button onClick={() => setDialogOpen(false)}>Speichern</Button>
            </>
          }
        >
          <p className="text-sm text-[var(--tf-text-secondary)]">
            Dies ist ein Dialog mit Footer-Buttons.
          </p>
        </Dialog>
      </Card>

      {/* FileDropZone */}
      <Card title="File Drop Zone">
        <FileDropZone
          onFiles={files => alert(`${files.length} Datei(en) ausgewählt`)}
          accept=".pdf,.docx"
          multiple
        />
      </Card>

      {/* Markdown */}
      <Card title="Markdown Renderer">
        <MarkdownRenderer content={sampleMarkdown} />
      </Card>
    </div>
  );
}
