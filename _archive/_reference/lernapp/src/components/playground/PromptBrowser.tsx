import { useState, useMemo } from "react";
import { Search, ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { promptLibrary } from "@/data/prompts";
import { useOrgContext, ORG_SCOPE_LABELS } from "@/contexts/OrgContext";
import { useMySkills } from "@/hooks/useMySkills";
import { ConfidentialityBadge } from "@/components/ConfidentialityBadge";
import { matchesCategory } from "@/lib/promptUtils";
import { ConversationHistory } from "./ConversationHistory";
import type { SavedConversation, OrgScope } from "@/types";

export interface PromptBrowserProps {
  onSelectPrompt: (title: string) => void;
  activePromptTitle: string | null;
  conversations: SavedConversation[];
  activeConversationId: string | null;
  onSelectConversation: (conv: SavedConversation) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
}

export const PromptBrowser = ({
  onSelectPrompt,
  activePromptTitle,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
}: PromptBrowserProps) => {
  const { scope, setScope, isDepartment } = useOrgContext();
  const { skills } = useMySkills();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("alle");

  // Labels für Abteilungs-Dropdown im PromptBrowser (ohne "Privatgebrauch", mit neutralem "Alle Abteilungen")
  const browserScopeLabels: Partial<Record<OrgScope, string>> = {
    organisation: "Alle Abteilungen",
    legal: ORG_SCOPE_LABELS.legal,
    oeffentlichkeitsarbeit: ORG_SCOPE_LABELS.oeffentlichkeitsarbeit,
    hr: ORG_SCOPE_LABELS.hr,
    it: ORG_SCOPE_LABELS.it,
    bauverfahren: ORG_SCOPE_LABELS.bauverfahren,
  };
  const [showSkills, setShowSkills] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const deptPrompts = useMemo(
    () => promptLibrary.filter((p) => p.targetDepartment === scope),
    [scope]
  );

  const filteredPrompts = useMemo(() => {
    const q = search.toLowerCase().trim();
    let source = isDepartment ? deptPrompts : promptLibrary;

    if (category !== "alle") {
      source = source.filter((p) => matchesCategory(p, category));
    }

    if (!q) return source;
    return source.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [search, deptPrompts, isDepartment, category]);

  const filteredSkills = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return skills;
    return skills.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.category && s.category.toLowerCase().includes(q))
    );
  }, [search, skills]);

  return (
    <div data-tour="prompt-browser" className="h-full flex flex-col bg-muted/30 dark:bg-muted/20">
      {/* Header + Search */}
      <div className="px-3 pt-3 pb-2 space-y-2 border-b border-border">
        {/* Zeile 1: Abteilung + Suche */}
        <div className="flex items-center gap-1.5">
          <Select value={scope} onValueChange={(v) => {
            setScope(v as OrgScope);
            setCategory("alle");
          }}>
            <SelectTrigger className="h-7 text-[10px] border border-border shadow-none px-1.5 font-semibold shrink-0 w-[9.5rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(browserScopeLabels) as [OrgScope, string][]).map(([key, label]) => (
                <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-0">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suche..."
              className="w-full h-7 text-[11px] pl-6 pr-2 rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
        </div>
        {/* Zeile 2: Kategorie-Dropdown + Vorlagen/Skills Toggle */}
        <div className="flex items-center gap-1.5">
          {!showSkills && (
            <Select value={category} onValueChange={(v) => {
              setCategory(v);
              if (v !== "alle") {
                setScope("organisation");
              }
            }}>
              <SelectTrigger className="h-7 text-[10px] border border-border shadow-none px-1.5 shrink-0 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle" className="text-xs">Alle Kategorien</SelectItem>
                <SelectItem value="bueroalltag" className="text-xs">Büroalltag</SelectItem>
                <SelectItem value="recherche" className="text-xs">Recherche</SelectItem>
                <SelectItem value="deep-research" className="text-xs">Deep Research</SelectItem>
                <SelectItem value="mini-apps" className="text-xs">Mini Apps</SelectItem>
                <SelectItem value="privat" className="text-xs">Privat</SelectItem>
              </SelectContent>
            </Select>
          )}
          <div className="flex rounded-md border border-border overflow-hidden ml-auto">
            <button
              onClick={() => setShowSkills(false)}
              className={cn(
                "px-2.5 py-1 text-[10px] font-medium transition-colors",
                !showSkills ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"
              )}
            >
              Vorlagen
            </button>
            <button
              onClick={() => setShowSkills(true)}
              className={cn(
                "px-2.5 py-1 text-[10px] font-medium transition-colors",
                showSkills ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"
              )}
            >
              Skills
            </button>
          </div>
        </div>
      </div>

      {/* Prompt List */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-1.5 py-1">
          {showSkills ? (
            filteredSkills.length === 0 ? (
              <p className="text-[10px] text-muted-foreground text-center py-4">
                Noch keine Skills gespeichert.
              </p>
            ) : (
              filteredSkills.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSelectPrompt(s.title)}
                  className={cn(
                    "w-full text-left px-2 py-1 rounded-md transition-colors flex items-center gap-1.5 min-w-0",
                    activePromptTitle === s.title
                      ? "bg-primary/15 border-l-2 border-l-primary"
                      : "hover:bg-muted/50"
                  )}
                >
                  <span className="text-[11px] font-medium truncate flex-1">
                    {s.title}
                  </span>
                  {s.confidentiality && (
                    <ConfidentialityBadge
                      level={s.confidentiality as "open" | "internal" | "confidential"}
                      compact
                    />
                  )}
                </button>
              ))
            )
          ) : filteredPrompts.length === 0 ? (
            <p className="text-[10px] text-muted-foreground text-center py-4">
              Keine Vorlagen gefunden.
            </p>
          ) : (
            filteredPrompts.map((p, i) => (
              <button
                key={`${p.title}-${i}`}
                onClick={() => onSelectPrompt(p.title)}
                className={cn(
                  "w-full text-left px-2 py-1 rounded-md transition-colors flex items-center gap-1.5 min-w-0",
                  activePromptTitle === p.title
                    ? "bg-primary/15 border-l-2 border-l-primary"
                    : "hover:bg-muted/50"
                )}
              >
                <span className="text-[11px] font-medium truncate flex-1">
                  {p.title}
                </span>
                <span className="text-[9px] text-muted-foreground shrink-0">
                  {p.category}
                </span>
              </button>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer: Conversations */}
      <div className="border-t border-border">
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <CollapsibleTrigger className="w-full px-3 py-1.5 text-[11px] font-semibold text-muted-foreground flex items-center justify-between border-t border-border hover:bg-muted/50 transition-colors">
            <span>Meine Versuche ({conversations.length})</span>
            <ChevronDown
              className={cn(
                "w-3 h-3 transition-transform",
                historyOpen && "rotate-180"
              )}
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ConversationHistory
              conversations={conversations}
              activeId={activeConversationId}
              onSelect={onSelectConversation}
              onNew={onNewConversation}
              onDelete={onDeleteConversation}
              onRename={onRenameConversation}
              bare
            />
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
};
