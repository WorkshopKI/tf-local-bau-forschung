import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeedbackTicketList } from "@/components/admin/FeedbackTicketList";
import { FeedbackTicketDetail } from "@/components/admin/FeedbackTicketDetail";
import { FeedbackConfigPanel } from "@/components/admin/FeedbackConfigPanel";
import { getFeedbackList } from "@/services/feedbackService";
import type { FeedbackItem, FeedbackCategory, FeedbackStatus } from "@/types";

const AdminFeedback = () => {
  const { profile, isLoading: authLoading } = useAuthContext();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState<FeedbackItem[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<FeedbackItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState<FeedbackCategory | "">("");
  const [filterStatus, setFilterStatus] = useState<FeedbackStatus | "">("");

  useEffect(() => {
    if (!authLoading && !profile?.is_admin) {
      navigate("/");
    }
  }, [authLoading, profile, navigate]);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFeedbackList({
        category: filterCategory || undefined,
        status: filterStatus || undefined,
      });
      setTickets(data);
    } catch {
      // Fehler werden im Service behandelt
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterStatus]);

  useEffect(() => {
    if (profile?.is_admin) loadTickets();
  }, [profile, loadTickets]);

  const handleTicketUpdated = useCallback(() => {
    loadTickets();
    setSelectedTicket(null);
  }, [loadTickets]);

  if (authLoading) return null;
  if (!profile?.is_admin) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-light tracking-[-0.3px]">Feedback</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          Tickets prüfen → Priorität setzen → Claude Code Prompt generieren → CLAUDE.md-Integration
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tickets">
        <TabsList className="h-9 bg-transparent p-0 gap-1">
          <TabsTrigger
            value="tickets"
            className="h-8 rounded-md px-3 text-sm data-[state=active]:bg-muted data-[state=active]:shadow-none"
          >
            Tickets
            <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[11px] font-medium min-w-[20px]">
              {tickets.length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="config"
            className="h-8 rounded-md px-3 text-sm data-[state=active]:bg-muted data-[state=active]:shadow-none"
          >
            Einstellungen
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="mt-4">
          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Ticket list */}
            <div className="min-w-0">
              <FeedbackTicketList
                tickets={tickets}
                loading={loading}
                selectedId={selectedTicket?.id}
                filterCategory={filterCategory}
                filterStatus={filterStatus}
                onFilterCategory={setFilterCategory}
                onFilterStatus={setFilterStatus}
                onSelect={setSelectedTicket}
              />
            </div>

            {/* Right: Ticket detail */}
            <div className="min-w-0">
              <FeedbackTicketDetail
                ticket={selectedTicket}
                onClose={() => setSelectedTicket(null)}
                onUpdated={handleTicketUpdated}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="config" className="mt-4">
          <FeedbackConfigPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminFeedback;
