import { useState } from "react";
import { Bookmark, Copy, Download, Trash2, Pencil, X, Check, ExternalLink, FileText, Cpu, Beaker } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfidentialityBadge } from "@/components/ConfidentialityBadge";
import { useMySkills } from "@/hooks/useMySkills";
import { skillToMarkdown, downloadMarkdown, downloadAgentSkillZip, toSkillName } from "@/lib/exportSkill";
import { STANDARD_MODELS, OPEN_SOURCE_MODELS } from "@/data/models";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { SavedSkill } from "@/types";
import { extractVariables } from "@/lib/promptUtils";

export const MySkills = () => {
  const navigate = useNavigate();
  const { skills, saveSkill, deleteSkill } = useMySkills();
  const [editingSkill, setEditingSkill] = useState<SavedSkill | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editVariables, setEditVariables] = useState<Record<string, string>>({});
  const [editTargetModel, setEditTargetModel] = useState("");

  const openEdit = (skill: SavedSkill) => {
    setEditingSkill(skill);
    setEditTitle(skill.title);
    setEditPrompt(skill.prompt);
    setEditNotes(skill.notes);
    setEditVariables({ ...skill.variables });
    setEditTargetModel(skill.targetModel || "");
  };

  const handleSaveEdit = () => {
    if (!editingSkill) return;
    saveSkill({
      ...editingSkill,
      title: editTitle,
      prompt: editPrompt,
      notes: editNotes,
      variables: editVariables,
      targetModel: editTargetModel || undefined,
      updatedAt: Date.now(),
    });
    setEditingSkill(null);
    toast.success("Skill aktualisiert");
  };

  const handleExport = (skill: SavedSkill) => {
    const md = skillToMarkdown(skill);
    const safeName = skill.title.replace(/[^a-zA-Z0-9äöüÄÖÜß\-_ ]/g, "").replace(/\s+/g, "-").toLowerCase();
    downloadMarkdown(md, `skill-${safeName}.md`);
    toast.success("Markdown exportiert");
  };

  const handleCopyPrompt = (skill: SavedSkill) => {
    let filled = skill.prompt;
    for (const [key, value] of Object.entries(skill.variables)) {
      if (value.trim()) {
        filled = filled.split(`{{${key}}}`).join(value);
      }
    }
    navigator.clipboard.writeText(filled);
    toast.success("Prompt kopiert");
  };

  const handleExportAgentSkill = async (skill: SavedSkill) => {
    await downloadAgentSkillZip(skill);
    toast.success("Agent Skill exportiert", {
      description: `ZIP enthält ${toSkillName(skill.title)}/SKILL.md + references/TEMPLATE.md`,
    });
  };

  const handleDelete = (skill: SavedSkill) => {
    deleteSkill(skill.id);
    toast.success("Skill gelöscht");
  };

  if (skills.length === 0) {
    return (
      <div className="text-center py-16">
        <Bookmark className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
        <h3 className="font-semibold text-base mb-2">Noch keine Skills gespeichert</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
          Öffne einen Prompt aus der Library und klicke "Als Skill speichern"
          um deine persönliche Sammlung aufzubauen.
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate("/library")}>
          Zur Prompt Sammlung
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {skills.length} {skills.length === 1 ? "Skill" : "Skills"} gespeichert
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {skills.map((skill) => (
          <Card key={skill.id} className="p-4 space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm truncate">{skill.title}</h4>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {skill.category}
                  </span>
                  {skill.confidentiality && (
                    <ConfidentialityBadge level={skill.confidentiality} compact />
                  )}
                  {skill.targetModel && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      🎯 {skill.targetModel.split("/").pop()}
                    </Badge>
                  )}
                </div>
              </div>
              {skill.sourceTitle !== skill.title && (
                <Badge variant="outline" className="text-[10px] shrink-0">
                  Angepasst
                </Badge>
              )}
            </div>

            {/* Prompt Preview */}
            <div className="bg-muted/40 rounded-lg p-3 font-mono text-xs leading-relaxed max-h-24 overflow-hidden relative">
              {skill.prompt.slice(0, 200)}
              {skill.prompt.length > 200 && "…"}
              <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-muted/40 to-transparent" />
            </div>

            {/* Ausgefüllte Variablen */}
            {Object.entries(skill.variables).filter(([, v]) => v.trim()).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {Object.entries(skill.variables).filter(([, v]) => v.trim()).map(([key]) => (
                  <Badge key={key} variant="outline" className="text-[10px]">
                    {key} ✓
                  </Badge>
                ))}
              </div>
            )}

            {/* Notizen */}
            {skill.notes && (
              <p className="text-xs text-muted-foreground italic line-clamp-2">
                {skill.notes}
              </p>
            )}

            {/* Meta */}
            <div className="text-[10px] text-muted-foreground">
              Erstellt: {new Date(skill.createdAt).toLocaleDateString("de-DE")}
              {skill.updatedAt > skill.createdAt && (
                <> · Bearbeitet: {new Date(skill.updatedAt).toLocaleDateString("de-DE")}</>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-1.5 pt-2 border-t border-border">
              <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={() => handleCopyPrompt(skill)}>
                <Copy className="w-3 h-3" /> Kopieren
              </Button>
              <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={() => openEdit(skill)}>
                <Pencil className="w-3 h-3" /> Bearbeiten
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
                    <Download className="w-3 h-3" /> Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => handleExport(skill)} className="gap-2 text-xs">
                    <FileText className="w-3.5 h-3.5" />
                    <div>
                      <div className="font-medium">Markdown</div>
                      <div className="text-muted-foreground text-[10px]">Für Wiki, Confluence, SharePoint</div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportAgentSkill(skill)} className="gap-2 text-xs">
                    <Cpu className="w-3.5 h-3.5" />
                    <div>
                      <div className="font-medium">Agent Skill</div>
                      <div className="text-muted-foreground text-[10px]">Für Claude Code, KI-Agenten (agentskills.io)</div>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs h-7"
                onClick={() => {
                  let filled = skill.prompt;
                  for (const [key, value] of Object.entries(skill.variables)) {
                    if (value.trim()) filled = filled.split(`{{${key}}}`).join(value);
                  }
                  const params = new URLSearchParams({
                    prompt: filled,
                    skillId: skill.id,
                    skillTitle: skill.title,
                  });
                  if (skill.targetModel) params.set("model", skill.targetModel);
                  navigate(`/playground?${params.toString()}`);
                }}
              >
                <Beaker className="w-3 h-3" /> Testen
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs h-7 ml-auto text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(skill)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingSkill} onOpenChange={(open) => !open && setEditingSkill(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Skill bearbeiten</DialogTitle>
          </DialogHeader>
          {editingSkill && (
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-sm font-medium block mb-1">Titel</label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Prompt</label>
                <Textarea
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  className="font-mono text-sm min-h-[200px]"
                />
              </div>
              {/* Variablen dynamisch aus dem Prompt-Text */}
              {extractVariables(editPrompt).length > 0 && (
                <div>
                  <label className="text-sm font-medium block mb-2">Variablen ausfüllen</label>
                  <div className="space-y-2">
                    {extractVariables(editPrompt).map((v) => (
                      <div key={v} className="flex items-center gap-2">
                        <Badge variant="outline" className="shrink-0 text-xs">{`{{${v}}}`}</Badge>
                        <Input
                          placeholder={v}
                          value={editVariables[v] || ""}
                          onChange={(e) => setEditVariables((prev) => ({ ...prev, [v]: e.target.value }))}
                          className="h-8 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="text-sm font-medium block mb-1">Persönliche Notizen</label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="z.B. Anpassungen für internes Modell, Tipps für die Nutzung..."
                  className="text-sm min-h-[80px]"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Ziel-Modell (optional)</label>
                <p className="text-xs text-muted-foreground mb-2">
                  Für welches Modell ist dieser Skill optimiert?
                </p>
                <Select value={editTargetModel || "none"} onValueChange={(v) => setEditTargetModel(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Kein bestimmtes Modell" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kein bestimmtes Modell</SelectItem>
                    {STANDARD_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                    {OPEN_SOURCE_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-2 border-t border-border">
                <Button onClick={handleSaveEdit} className="gap-2">
                  <Check className="w-4 h-4" /> Speichern
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <Download className="w-4 h-4" /> Exportieren
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => {
                      const current = { ...editingSkill!, title: editTitle, prompt: editPrompt, notes: editNotes, variables: editVariables };
                      handleExport(current);
                    }} className="gap-2 text-sm">
                      <FileText className="w-4 h-4" /> Markdown
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      const current = { ...editingSkill!, title: editTitle, prompt: editPrompt, notes: editNotes, variables: editVariables };
                      handleExportAgentSkill(current);
                    }} className="gap-2 text-sm">
                      <Cpu className="w-4 h-4" /> Agent Skill
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    let filled = editPrompt;
                    for (const [key, value] of Object.entries(editVariables)) {
                      if (value.trim()) filled = filled.split(`{{${key}}}`).join(value);
                    }
                    const params = new URLSearchParams({
                      prompt: filled,
                      skillId: editingSkill!.id,
                      skillTitle: editTitle,
                    });
                    if (editTargetModel) params.set("model", editTargetModel);
                    navigate(`/playground?${params.toString()}`);
                    setEditingSkill(null);
                  }}
                >
                  <ExternalLink className="w-4 h-4" /> Im Labor testen
                </Button>
                <Button variant="ghost" onClick={() => setEditingSkill(null)}>
                  Abbrechen
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
