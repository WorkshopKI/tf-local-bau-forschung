/**
 * Gruppe „Tags" (Design-Handoff
 * `_design/handoff/einstellungen-zweispaltig`, Screenshot 10, rechte Spalte).
 *
 * Tags entstehen beim Arbeiten an Anträgen; hier lassen sie sich umbenennen,
 * löschen (nur ungenutzte) und neu zählen. Die Liste steht in der Klappe —
 * sichtbar bleibt, wie viele es sind.
 *
 * Der Zählerstand kommt seit v4.116 aus den DATENSÄTZEN, nicht aus dem
 * Registry-Feld: `addTag` legt jeden Eintrag hart mit `count: 0` an und erhöht
 * ihn nie, der gespeicherte Stand stimmte also erst nach einem Klick auf „Neu
 * zählen". Weil der Löschen-Knopf an „0 Verwendungen" hängt, stand er
 * ausgerechnet an den frisch vergebenen, benutzten Tags.
 */
import { useCallback, useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ListItem } from '@/components/ui/ListItem';
import { useStorage } from '@/core/hooks/useStorage';
import { useTags } from '@/core/hooks/useTags';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { leseTagBestand } from '@/core/services/tags';
import {
  SettingsGruppe,
  SettingsGruppenAktion,
  SettingsKlappe,
  SettingsLeer,
} from '@/components/settings';

export function TagsGruppe(): React.ReactElement {
  const { allTags, removeTag, renameTag, recountTags } = useTags();
  const storage = useStorage();
  const [editTag, setEditTag] = useState<string | null>(null);
  const [editWert, setEditWert] = useState('');
  const [verwendungen, setVerwendungen] = useState<Map<string, number> | null>(null);
  const [technische, setTechnische] = useState<ReadonlySet<string>>(new Set());

  /**
   * Zählt die Verwendungen frisch aus den Datensätzen — für die ANZEIGE, ohne
   * die Registry zu schreiben. Das Öffnen einer Einstellungsseite soll nichts
   * speichern; „Neu zählen" tut das ausdrücklich.
   */
  const ladeBestand = useCallback(async () => {
    const { namen, technische: tech } = await leseTagBestand(storage);
    const zaehler = new Map<string, number>();
    for (const n of namen) {
      const k = n.trim().toLowerCase();
      zaehler.set(k, (zaehler.get(k) ?? 0) + 1);
    }
    setVerwendungen(zaehler);
    setTechnische(tech);
  }, [storage]);

  useEffect(() => { void ladeBestand(); }, [ladeBestand]);

  const neuZaehlen = useAsyncAction(async () => {
    const { namen, technische: tech } = await leseTagBestand(storage);
    recountTags(namen, tech);
    await ladeBestand();
  });

  const umbenennen = useAsyncAction(async (alt: string, neu: string) => {
    await renameTag(alt, neu);
    await ladeBestand();
  });

  const loeschen = useAsyncAction(async (name: string) => {
    removeTag(name);
    await ladeBestand();
  });

  const bestaetigen = (alt: string): void => {
    setEditTag(null);
    void umbenennen.run(alt, editWert);
  };

  // Maschinell gesetzte Tags gehören nicht in die Liste: die Verbund-Kennung
  // trägt die Zuordnung zwischen Antrag und Dokument, der Dokumenttyp die
  // Einordnung der Aufnahme. Beide sind hier weder umbenennbar noch löschbar,
  // weil beides die Zuordnung zerrisse.
  const sichtbareTags = allTags.filter(t => !technische.has(t.name));
  const zaehlerVon = (name: string): number => verwendungen?.get(name) ?? 0;
  const fehler = neuZaehlen.error ?? umbenennen.error ?? loeschen.error;

  return (
    <SettingsGruppe
      id="sec-tags"
      titel="Tags"
      aktion={
        <SettingsGruppenAktion onClick={() => neuZaehlen.run()} disabled={neuZaehlen.busy}>
          {neuZaehlen.busy ? 'Zähle…' : 'Neu zählen'}
        </SettingsGruppenAktion>
      }
    >
      {sichtbareTags.length === 0 ? (
        <SettingsLeer>Noch keine Tags — sie entstehen beim Arbeiten an Anträgen.</SettingsLeer>
      ) : (
        <SettingsKlappe
          id="sec-tags-liste"
          label="Alle Tags"
          storageKey="teamflow_settings_tags_collapsed"
          zaehler={sichtbareTags.length}
        >
          <div className="rounded-[var(--tf-radius)] overflow-hidden bg-[var(--tf-bg)]" style={{ border: '0.5px solid var(--tf-border)' }}>
            {sichtbareTags.map((tag, i) => {
              const anzahl = zaehlerVon(tag.name);
              return (
                <ListItem
                  key={tag.name}
                  title={editTag === tag.name ? '' : tag.name}
                  subtitle={editTag === tag.name ? undefined : `${anzahl} ${anzahl === 1 ? 'Verwendung' : 'Verwendungen'}`}
                  meta={editTag === tag.name ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={editWert}
                        onChange={e => setEditWert(e.target.value)}
                        autoFocus
                        aria-label="Neuer Tag-Name"
                        className="px-2 py-1 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none w-32"
                        style={{ border: '0.5px solid var(--tf-border)' }}
                        onKeyDown={e => { if (e.key === 'Enter') bestaetigen(tag.name); }}
                      />
                      <Button variant="ghost" size="sm" onClick={() => bestaetigen(tag.name)}>OK</Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Badge variant="default">{anzahl}</Badge>
                      <button
                        onClick={() => { setEditTag(tag.name); setEditWert(tag.name); }}
                        className="p-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
                        title="Umbenennen"
                      >
                        <Pencil size={12} />
                      </button>
                      {/* Nur ungenutzte Tags sind löschbar — die Zahl kommt aus
                          den Datensätzen, nicht aus dem Registry-Feld. */}
                      {verwendungen != null && anzahl === 0 && (
                        <button
                          onClick={() => loeschen.run(tag.name)}
                          className="p-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] cursor-pointer"
                          title="Löschen"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  )}
                  last={i === sichtbareTags.length - 1}
                />
              );
            })}
          </div>
        </SettingsKlappe>
      )}
      {fehler && (
        <p className="text-[12px] text-[var(--tf-danger-text)] pt-1.5">{fehler}</p>
      )}
    </SettingsGruppe>
  );
}
