import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Copy, Check, Search, Sparkles, ChevronDown, ChevronUp, Shield, Clock, Wrench, Building2, AlertTriangle, Star, LayoutGrid, List, ArrowUpDown, SlidersHorizontal, X, ShieldCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { promptLibrary } from "@/data/prompts";
import type { PromptItem } from "@/data/prompts";
import { PromptDetail } from "@/components/PromptDetail";
import { ConfidentialityBadge } from "@/components/ConfidentialityBadge";
import { useOrgContext } from "@/contexts/OrgContext";
import { loadFromStorage, saveToStorage } from "@/lib/storage";
import { LS_KEYS } from "@/lib/constants";
import { extractVariables, matchesCategory } from "@/lib/promptUtils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { orgUseCases } from "@/data/orgUseCases";
import type { OrgUseCase } from "@/data/orgUseCases";
import { RISK_COLORS } from "@/lib/constants";

function findMatchingUseCase(prompt: PromptItem): OrgUseCase | null {
  const normalizedTitle = prompt.title.toLowerCase().replace(/[-–]/g, " ");
  return orgUseCases.find(uc => {
    const ucTitle = uc.title.toLowerCase().replace(/[-–]/g, " ");
    const ucWords = ucTitle.split(" ").slice(0, 2).join(" ");
    const promptWords = normalizedTitle.split(" ").slice(0, 2).join(" ");
    return normalizedTitle.includes(ucWords) || ucTitle.includes(promptWords);
  }) || null;
}

const BASE_CATEGORIES = ["Büroalltag", "Recherche", "Deep Research", "Mini Apps", "Privat"];

function departmentScopeToKey(label: string): string | undefined {
  const map: Record<string, string> = {
    "HR": "hr",
    "Legal": "legal",
    "IT": "it",
    "Öffentlichkeitsarbeit": "oeffentlichkeitsarbeit",
    "Bauverfahren": "bauverfahren",
  };
  return map[label];
}

function getStoredRating(title: string): number {
  const ratings = loadFromStorage<Record<string, number>>(LS_KEYS.PROMPT_RATINGS, {});
  return ratings[title] || 0;
}

function storeRating(title: string, rating: number) {
  const ratings = loadFromStorage<Record<string, number>>(LS_KEYS.PROMPT_RATINGS, {});
  ratings[title] = rating;
  saveToStorage(LS_KEYS.PROMPT_RATINGS, ratings);
}

const BlueprintDetails = ({ prompt }: { prompt: PromptItem }) => {
  const [expanded, setExpanded] = useState(false);

  if (prompt.type !== "blueprint" || !prompt.constraints) return null;

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {prompt.estimatedAgentTime && (
          <span className="inline-flex items-center gap-1 bg-accent/10 text-accent-foreground px-2 py-1 rounded">
            <Clock className="w-3 h-3" />
            {prompt.estimatedAgentTime}
          </span>
        )}
        {prompt.requiredTools?.map((tool, i) => (
          <span key={i} className="inline-flex items-center gap-1 bg-muted text-muted-foreground px-2 py-1 rounded">
            <Wrench className="w-3 h-3" />
            {tool}
          </span>
        ))}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {expanded ? "Details ausblenden" : "Constraints & Abnahmekriterien"}
      </button>

      {expanded && (
        <div className="space-y-3 pt-2 border-t border-border">
          {prompt.constraints.musts.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-primary mb-1 flex items-center gap-1">
                <Shield className="w-3 h-3" /> Must
              </div>
              <ul className="space-y-1">
                {prompt.constraints.musts.map((m, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">+</span>{m}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {prompt.constraints.mustNots.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-destructive mb-1">Must NOT</div>
              <ul className="space-y-1">
                {prompt.constraints.mustNots.map((m, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-destructive mt-0.5">-</span>{m}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {prompt.constraints.escalationTriggers.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-accent-foreground mb-1">Eskalations-Trigger</div>
              <ul className="space-y-1">
                {prompt.constraints.escalationTriggers.map((m, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-accent-foreground mt-0.5">!</span>{m}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {prompt.acceptanceCriteria && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <div className="text-xs font-semibold text-primary mb-1">Abnahmekriterien</div>
              <p className="text-xs text-foreground leading-relaxed">{prompt.acceptanceCriteria}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const PromptLibrary = () => {
  const navigate = useNavigate();
  const { scope, isDepartment, scopeLabel } = useOrgContext();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [departmentScope, setDepartmentScope] = useState(isDepartment ? "Meine Abteilung" : "Alle");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState("Alle");
  const [riskFilter, setRiskFilter] = useState("Alle");
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [viewMode, setViewMode] = useState<string>("grid");
  const [sortByRating, setSortByRating] = useState(false);
  const [expandedCardIndex, setExpandedCardIndex] = useState<number | null>(null);

  const [confFilter, setConfFilter] = useState<string>("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [tableSortBy, setTableSortBy] = useState<string>("title");
  const [tableSortDir, setTableSortDir] = useState<"asc" | "desc">("asc");
  const toggleTableSort = (col: string) => {
    if (tableSortBy === col) {
      setTableSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setTableSortBy(col);
      setTableSortDir("asc");
    }
  };

  useEffect(() => {
    setSelectedCategory(null);
    setDepartmentScope(isDepartment ? "Meine Abteilung" : "Alle");
  }, [scope, isDepartment]);

  useEffect(() => {
    setExpandedCardIndex(null);
  }, [selectedCategory, departmentScope, searchQuery]);


  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success("Prompt kopiert!");
    setTimeout(() => setCopiedIndex(null), 2000);
  };


  const filteredPrompts = useMemo(() => {
    let filtered = promptLibrary.filter((prompt) => {
      const matchesSearch =
        prompt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prompt.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prompt.category.toLowerCase().includes(searchQuery.toLowerCase());

      const categoryKey = selectedCategory === null ? "alle"
        : selectedCategory === "Büroalltag" ? "bueroalltag"
        : selectedCategory === "Recherche" ? "recherche"
        : selectedCategory === "Deep Research" ? "deep-research"
        : selectedCategory === "Mini Apps" ? "mini-apps"
        : selectedCategory === "Privat" ? "privat"
        : "alle";
      const matchesCat = matchesCategory(prompt, categoryKey);

      const matchesDepartment = departmentFilter === "Alle" || prompt.department === departmentFilter;
      const matchesRisk = riskFilter === "Alle" || prompt.riskLevel === riskFilter;
      const matchesVerified = !onlyVerified || prompt.official;
      const matchesConf = confFilter === "all" || (prompt.confidentiality || "open") === confFilter;

      const matchesDepartmentScope =
        departmentScope === "Alle"
          ? true
          : departmentScope === "Meine Abteilung"
            ? prompt.targetDepartment === scope
            : prompt.targetDepartment === departmentScopeToKey(departmentScope);

      return matchesSearch && matchesCat && matchesDepartment && matchesRisk && matchesVerified && matchesConf && matchesDepartmentScope;
    });

    if (sortByRating) {
      filtered = [...filtered].sort((a, b) => getStoredRating(b.title) - getStoredRating(a.title));
    }

    if (isDepartment) {
      filtered.sort((a, b) => {
        const aMatch = a.targetDepartment === scope ? 0 : 1;
        const bMatch = b.targetDepartment === scope ? 0 : 1;
        return aMatch - bMatch;
      });
    }

    return filtered;
  }, [searchQuery, selectedCategory, departmentScope, departmentFilter, riskFilter, onlyVerified, sortByRating, confFilter, scope, isDepartment]);

  const tableSortedPrompts = useMemo(() => {
    if (viewMode !== "list") return filteredPrompts;
    return [...filteredPrompts].sort((a, b) => {
      let aVal = "";
      let bVal = "";
      switch (tableSortBy) {
        case "title": aVal = a.title; bVal = b.title; break;
        case "category": aVal = a.category; bVal = b.category; break;
        case "department": aVal = a.targetDepartment || ""; bVal = b.targetDepartment || ""; break;
        case "level": aVal = a.level || ""; bVal = b.level || ""; break;
        case "confidentiality": aVal = a.confidentiality || "open"; bVal = b.confidentiality || "open"; break;
        case "rating":
          return tableSortDir === "asc"
            ? getStoredRating(a.title) - getStoredRating(b.title)
            : getStoredRating(b.title) - getStoredRating(a.title);
        default: aVal = a.title; bVal = b.title;
      }
      const cmp = aVal.localeCompare(bVal, "de");
      return tableSortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredPrompts, tableSortBy, tableSortDir, viewMode]);

  const departments = ["Alle", "Support", "Vertrieb", "Legal"];
  const riskLevels = ["Alle", "niedrig", "mittel", "hoch"];

  const handlePromptClick = (prompt: PromptItem) => {
    setSelectedPrompt(prompt);
    setDetailOpen(true);
  };

  const InlineRating = ({ title }: { title: string }) => {
    const stored = getStoredRating(title);
    const [hover, setHover] = useState(0);

    return (
      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={(e) => { e.stopPropagation(); storeRating(title, star); toast.success(`${star} Sterne`); }}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="p-0"
          >
            <Star className={`w-3.5 h-3.5 ${star <= (hover || stored) ? "fill-primary text-primary" : "text-muted-foreground/20"}`} />
          </button>
        ))}
      </div>
    );
  };

  return (
    <section data-feedback-ref="prompt-sammlung.bibliothek" data-feedback-label="Prompt-Bibliothek">
      <div className="mb-5">
        {/* Einzeilig: Suche + Abteilung + Kategorien + Filter */}
        <div className="flex items-center gap-1.5 flex-wrap" data-feedback-ref="prompt-sammlung.filter" data-feedback-label="Filter & Suche">
          {/* Suche — kompakt, expandierbar */}
          {searchOpen ? (
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
              <Input
                type="text"
                placeholder="Suche…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-7 text-xs"
                autoFocus
                onBlur={() => { if (!searchQuery) setSearchOpen(false); }}
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchOpen(true)}
              className="h-7 text-xs gap-1 text-muted-foreground"
            >
              <Search className="w-3.5 h-3.5" />
              Suche
            </Button>
          )}
          {/* Trennstrich */}
          <div className="w-px h-5 bg-border" />
          {/* Abteilungs-Dropdown */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={departmentScope !== "Alle" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs gap-1"
              >
                {departmentScope === "Meine Abteilung"
                  ? `⬡ ${scopeLabel.replace("Abteilung ", "").replace("Fachabteilung ", "")}`
                  : departmentScope === "Alle"
                    ? "⬡ Alle Abteilungen"
                    : `⬡ ${departmentScope}`}
                <ChevronDown className="w-3 h-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-1.5">
              <button
                onClick={() => { setDepartmentScope("Alle"); }}
                className={cn(
                  "block w-full text-left px-3 py-1.5 text-xs rounded-md transition-colors",
                  departmentScope === "Alle" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                Alle Abteilungen
              </button>
              {isDepartment && (
                <button
                  onClick={() => { setDepartmentScope("Meine Abteilung"); setSelectedCategory(null); }}
                  className={cn(
                    "block w-full text-left px-3 py-1.5 text-xs rounded-md transition-colors",
                    departmentScope === "Meine Abteilung" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  )}
                >
                  ⬡ {scopeLabel.replace("Abteilung ", "").replace("Fachabteilung ", "")} (meine)
                </button>
              )}
              {["HR", "Legal", "IT", "Öffentlichkeitsarbeit", "Bauverfahren"]
                .filter(d => !(isDepartment && d === scopeLabel.replace("Abteilung ", "").replace("Fachabteilung ", "")))
                .map(dept => (
                  <button
                    key={dept}
                    onClick={() => { setDepartmentScope(dept); setSelectedCategory(null); }}
                    className={cn(
                      "block w-full text-left px-3 py-1.5 text-xs rounded-md transition-colors",
                      departmentScope === dept ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    )}
                  >
                    {dept}
                  </button>
              ))}
            </PopoverContent>
          </Popover>
          {/* Kategorie-Chips */}
          {BASE_CATEGORIES.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              onClick={() => {
                if (selectedCategory === category) {
                  setSelectedCategory(null);
                } else {
                  setSelectedCategory(category);
                  setDepartmentScope("Alle");
                }
              }}
              size="sm"
              className="h-7 text-xs"
            >
              {category}
            </Button>
          ))}
          {/* Spacer */}
          <div className="flex-1" />
          {/* Count */}
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {filteredPrompts.length} gefunden
          </span>
          {/* Filter-Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="relative h-7 w-7 p-0">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                {(onlyVerified || sortByRating || confFilter !== "all") && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 space-y-4">
              <h4 className="text-sm font-semibold">Filter & Sortierung</h4>
              <label className="flex items-center justify-between">
                <span className="text-xs">Nur verifizierte</span>
                <Switch checked={onlyVerified} onCheckedChange={setOnlyVerified} />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-xs">Nach Bewertung sortieren</span>
                <Switch checked={sortByRating} onCheckedChange={setSortByRating} />
              </label>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">KI-Stufe</label>
                <select
                  value={confFilter}
                  onChange={(e) => setConfFilter(e.target.value)}
                  className="w-full text-xs border rounded-md px-2 py-1.5 bg-background"
                >
                  <option value="all">Alle</option>
                  <option value="open">🟢 Offen</option>
                  <option value="internal">🟡 Intern</option>
                  <option value="confidential">🔴 Vertraulich</option>
                </select>
              </div>
              {departmentScope !== "Alle" && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Abteilung</label>
                    <div className="flex flex-wrap gap-1">
                      {departments.map((dept) => (
                        <Button
                          key={dept}
                          variant={departmentFilter === dept ? "default" : "outline"}
                          size="sm"
                          className="text-[10px] h-6 px-2"
                          onClick={() => setDepartmentFilter(dept)}
                        >
                          {dept}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Risiko</label>
                    <div className="flex flex-wrap gap-1">
                      {riskLevels.map((risk) => (
                        <Button
                          key={risk}
                          variant={riskFilter === risk ? "default" : "outline"}
                          size="sm"
                          className="text-[10px] h-6 px-2"
                          onClick={() => setRiskFilter(risk)}
                        >
                          {risk}
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Ansicht</label>
                <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v)} className="justify-start">
                  <ToggleGroupItem value="grid" aria-label="Grid" className="h-7 w-7"><LayoutGrid className="h-3.5 w-3.5" /></ToggleGroupItem>
                  <ToggleGroupItem value="list" aria-label="List" className="h-7 w-7"><List className="h-3.5 w-3.5" /></ToggleGroupItem>
                </ToggleGroup>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {viewMode === "list" ? (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {[
                  { key: "title", label: "Titel", className: "" },
                  { key: "category", label: "Kategorie", className: "hidden md:table-cell" },
                  { key: "department", label: "Abteilung", className: "hidden md:table-cell" },
                  { key: "level", label: "Level", className: "hidden sm:table-cell" },
                  { key: "rating", label: "Bewertung", className: "" },
                  { key: "confidentiality", label: "KI", className: "hidden lg:table-cell" },
                ].map((col) => (
                  <th
                    key={col.key}
                    className={`text-left p-3 font-medium cursor-pointer hover:text-foreground select-none ${col.className}`}
                    onClick={() => toggleTableSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      <ArrowUpDown className={`h-3 w-3 ${tableSortBy === col.key ? "text-primary" : "text-muted-foreground/40"}`} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(showAll ? tableSortedPrompts : tableSortedPrompts.slice(0, 20)).map((prompt, index) => (
                <tr
                  key={index}
                  className="border-t border-border hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => handlePromptClick(prompt)}
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{prompt.title}</span>
                      {prompt.official && (
                        <Badge className="bg-primary/10 text-primary text-[10px] px-1 py-0">Verifiziert</Badge>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">{prompt.category}</td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">{prompt.department || "\u2014"}</td>
                  <td className="p-3 hidden sm:table-cell">
                    <Badge variant="outline" className="text-[10px]">{prompt.level || "\u2014"}</Badge>
                  </td>
                  <td className="p-3"><InlineRating title={prompt.title} /></td>
                  <td className="p-3 hidden lg:table-cell">
                    <ConfidentialityBadge level={prompt.confidentiality || "open"} compact />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {(showAll ? filteredPrompts : filteredPrompts.slice(0, 6)).map((prompt, index) => (
            <Card
              key={index}
              className="p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
              onClick={() => handlePromptClick(prompt)}
            >
              {/* Titel — volle Breite, kein Truncation */}
              <h4 className="font-semibold text-sm mb-1">{prompt.title}</h4>
              {/* Meta: Kategorie + Badges + Actions */}
              <div className="flex items-center gap-1.5 mb-2.5">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                  {prompt.category}
                </span>
                {prompt.official && (
                  <Badge className="bg-primary/10 text-primary text-[10px] shrink-0">Verifiziert</Badge>
                )}
                <ConfidentialityBadge level={prompt.confidentiality || "open"} reason={prompt.confidentialityReason} compact />
                <div className="flex-1" />
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); copyToClipboard(prompt.prompt, index); }}
                    className="p-1 rounded-md hover:bg-muted transition-colors"
                    title="Prompt kopieren"
                  >
                    {copiedIndex === index ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/playground?libraryTitle=${encodeURIComponent(prompt.title)}`); }}
                    className="p-1 rounded-md hover:bg-primary/10 transition-colors group"
                    title="In der Werkstatt öffnen"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </button>
                </div>
              </div>
              {/* Zeile 3: Prompt-Text — 4 Zeilen oder voll aufgeklappt */}
              <div
                className={cn(
                  "text-xs text-foreground/80 font-mono leading-relaxed bg-muted/40 rounded-md px-3 py-2",
                  expandedCardIndex === index ? "" : "line-clamp-7"
                )}
              >
                {prompt.prompt}
              </div>
              {/* "mehr/weniger" Toggle — nur wenn Text abgeschnitten wird */}
              {prompt.prompt.length > 550 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedCardIndex(expandedCardIndex === index ? null : index);
                  }}
                  className="text-[11px] text-primary font-medium mt-1 hover:underline"
                >
                  {expandedCardIndex === index ? "▾ weniger" : "▸ mehr anzeigen"}
                </button>
              )}
              {/* Governance-Detail — wenn Use Case vorhanden */}
              {(() => {
                const uc = findMatchingUseCase(prompt);
                if (!uc) return null;
                return (
                  <Collapsible>
                    <CollapsibleTrigger
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 w-full mt-2 pt-2 border-t border-border text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ShieldCheck className="w-3 h-3" />
                      <span className="font-medium">Qualitätskriterien & Governance</span>
                      <ChevronDown className="w-3 h-3 ml-auto" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">Risiko:</span>
                        <Badge variant="outline" className={cn("text-[10px]", RISK_COLORS[uc.risk] || "")}>
                          {uc.risk}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground ml-auto">Rolle: {uc.role}</span>
                      </div>
                      <div className="space-y-1">
                        {uc.qualityCriteria.map((criterion, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                            <span className="text-primary mt-0.5">✓</span>
                            <span>{criterion}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground italic">{uc.goal}</p>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })()}
            </Card>
          ))}
        </div>
      )}

      {filteredPrompts.length > (viewMode === "list" ? 20 : 6) && (
        <div className="text-center mt-6">
          <Button variant="outline" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Weniger anzeigen" : `Alle ${filteredPrompts.length} Prompts anzeigen`}
          </Button>
        </div>
      )}

      {filteredPrompts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Keine Prompts gefunden. Versuche eine andere Suche oder Kategorie.
          </p>
        </div>
      )}

      <PromptDetail
        prompt={selectedPrompt}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </section>
  );
};
