import type { Artifact, Vorgang } from '@/core/types/vorgang';
import type { StorageService } from '@/core/services/storage';
import type { AIBridge } from '@/core/services/ai/bridge';
import { buildArtifactPrompt } from '@/core/services/ai/prompts';
import { fillTemplate } from '@/core/services/templates';

export class ArtifactService {
  async generateWithAI(
    type: string,
    vorgang: Vorgang,
    userContext: string,
    aiBridge: AIBridge,
  ): Promise<string> {
    const context = `Vorgang: ${vorgang.id} — ${vorgang.title}\nTyp: ${vorgang.type}\nStatus: ${vorgang.status}\nPriorität: ${vorgang.priority}\n${vorgang.assignee ? `Zuständig: ${vorgang.assignee}` : ''}\n${userContext ? `\nZusätzlicher Kontext:\n${userContext}` : ''}`;

    try {
      const prompt = buildArtifactPrompt(type, context);
      return await aiBridge.getActiveTransport().submitMessage(prompt);
    } catch {
      return fillTemplate(type, vorgang);
    }
  }

  async saveArtifact(
    vorgang: Vorgang,
    artifact: Omit<Artifact, 'id' | 'created'>,
    storage: StorageService,
  ): Promise<Artifact> {
    const full: Artifact = {
      ...artifact,
      id: `ART-${Date.now()}`,
      created: new Date().toISOString(),
    };

    await storage.idb.set(`artifact:${full.id}`, full);

    if (storage.fs) {
      const dir = vorgang.type === 'bauantrag' ? 'vorgaenge/bauantraege' : 'vorgaenge/forschung';
      const frontmatter = `---\ntype: ${full.type}\nauthor: ${full.author}\ncreated: ${full.created}\nvorgangId: ${full.vorgangId}\n---\n\n`;
      try {
        await storage.fs.writeFile(`${dir}/${vorgang.id}/${full.filename}`, frontmatter + full.content);
      } catch { /* FS write optional */ }
    }

    return full;
  }

  async loadArtifacts(vorgangId: string, storage: StorageService): Promise<Artifact[]> {
    const keys = await storage.idb.keys('artifact:');
    const results: Artifact[] = [];
    for (const key of keys) {
      const a = await storage.idb.get<Artifact>(key);
      if (a && a.vorgangId === vorgangId) results.push(a);
    }
    return results.sort((a, b) => b.created.localeCompare(a.created));
  }

  async deleteArtifact(id: string, storage: StorageService): Promise<void> {
    await storage.idb.delete(`artifact:${id}`);
  }
}
