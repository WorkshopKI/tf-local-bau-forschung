import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  MessageSquare,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Pencil,
  Check,
  X,
  History,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SavedConversation } from "@/types";

export type { SavedConversation } from "@/types";

export interface ConversationHistoryProps {
  conversations: SavedConversation[];
  activeId: string | null;
  onSelect: (conversation: SavedConversation) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  bare?: boolean;
}

export const ConversationHistory = ({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  bare,
}: ConversationHistoryProps) => {
  const [open, setOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const startRename = (conv: SavedConversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const confirmRename = () => {
    if (editingId && editTitle.trim()) {
      onRename(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  const content = (
    <div className={bare ? "space-y-2 px-3 pb-3" : "px-3 pb-3 space-y-2"}>
            <Button onClick={onNew} variant="outline" size="sm" className="w-full text-xs">
              <Plus className="w-3 h-3 mr-1" />
              Neuer Versuch
            </Button>

            <ScrollArea className="max-h-[250px]">
              <div className="space-y-1">
                {sorted.map((conv) => (
                  <div
                    key={conv.id}
                    className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer text-xs transition-colors min-w-0 ${
                      activeId === conv.id
                        ? "bg-primary/10 text-foreground"
                        : "hover:bg-accent text-muted-foreground"
                    }`}
                    onClick={() => editingId !== conv.id && onSelect(conv)}
                  >
                    <MessageSquare className="w-3 h-3 shrink-0" />

                    {editingId === conv.id ? (
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && confirmRename()}
                          className="h-5 text-xs px-1"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0"
                          onClick={(e) => { e.stopPropagation(); confirmRename(); }}
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0"
                          onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="truncate flex-1 min-w-0">
                              {conv.title}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            {conv.messages.find(m => m.role === "user")?.content || conv.title}
                          </TooltipContent>
                        </Tooltip>
                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={(e) => { e.stopPropagation(); startRename(conv); }}
                          >
                            <Pencil className="w-2.5 h-2.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-destructive hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}

                {conversations.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    Noch keine Versuche gespeichert.
                  </p>
                )}
              </div>
            </ScrollArea>
    </div>
  );

  if (bare) return content;

  return (
    <Collapsible open={open} onOpenChange={setOpen} data-feedback-ref="prompt-labor.verlauf" data-feedback-label="Gesprächsverlauf">
      <div className="bg-gradient-card rounded-xl border border-border shadow-lg">
        <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 hover:bg-accent/50 rounded-t-xl transition-colors">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Meine Versuche</span>
            <span className="text-xs text-muted-foreground">({conversations.length})</span>
          </div>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </CollapsibleTrigger>
        <CollapsibleContent>
          {content}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
