import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsageOverview } from "@/components/admin/UsageOverview";
import { ArrowLeft, Copy, Plus, Users, Ticket, Mail, RefreshCw, BarChart3 } from "lucide-react";

interface Course {
  id: string;
  name: string;
  max_participants: number;
  enrollment_open: boolean;
  default_key_budget: number;
}

interface Participant {
  id: string;
  type: "email" | "guest";
  identifier: string;
  status: "invited" | "registered" | "active" | "expired";
  course_id: string;
  created_at: string;
}

const AdminParticipants = () => {
  const { profile, isLoading: authLoading } = useAuthContext();
  const navigate = useNavigate();

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [guestName, setGuestName] = useState("");
  const [newGuestCode, setNewGuestCode] = useState("");

  // Redirect non-admins
  useEffect(() => {
    if (!authLoading && !profile?.is_admin) {
      navigate("/");
    }
  }, [authLoading, profile, navigate]);

  // Load courses
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("courses").select("*");
      if (data && data.length > 0) {
        setCourses(data as Course[]);
        setSelectedCourse(data[0].id);
      }
    };
    load();
  }, []);

  // Load participants when course changes
  const loadParticipants = useCallback(async () => {
    if (!selectedCourse) return;
    setLoading(true);

    const parts: Participant[] = [];

    // Email whitelist
    const { data: emails } = await supabase
      .from("enrollment_whitelist")
      .select("*")
      .eq("course_id", selectedCourse);

    if (emails) {
      for (const e of emails) {
        parts.push({
          id: e.id,
          type: "email",
          identifier: e.email,
          status: e.registered_at ? "registered" : "invited",
          course_id: e.course_id,
          created_at: e.invited_at,
        });
      }
    }

    // Guest tokens
    const { data: guests } = await supabase
      .from("guest_tokens")
      .select("*")
      .eq("course_id", selectedCourse);

    if (guests) {
      for (const g of guests) {
        const expired = new Date(g.expires_at) < new Date();
        parts.push({
          id: g.id,
          type: "guest",
          identifier: `${g.display_name} (${g.token})`,
          status: expired ? "expired" : g.user_id ? "active" : "invited",
          course_id: g.course_id,
          created_at: g.created_at,
        });
      }
    }

    setParticipants(parts);
    setLoading(false);
  }, [selectedCourse]);

  useEffect(() => {
    loadParticipants();
  }, [loadParticipants]);

  // Invite email
  const handleInviteEmail = async () => {
    if (!inviteEmail.trim() || !selectedCourse) return;
    const { error } = await supabase.from("enrollment_whitelist").insert({
      email: inviteEmail.trim().toLowerCase(),
      course_id: selectedCourse,
    });
    if (error) {
      toast.error("Fehler beim Einladen: " + error.message);
    } else {
      toast.success(`${inviteEmail} eingeladen!`);
      setInviteEmail("");
      loadParticipants();
    }
  };

  // Create guest code
  const handleCreateGuest = async () => {
    if (!guestName.trim() || !selectedCourse) return;
    const token = Math.random().toString(36).substring(2, 10).toUpperCase();
    const { error } = await supabase.from("guest_tokens").insert({
      display_name: guestName.trim(),
      token,
      course_id: selectedCourse,
    });
    if (error) {
      toast.error("Fehler: " + error.message);
    } else {
      setNewGuestCode(token);
      setGuestName("");
      toast.success("Gast-Code erstellt!");
      loadParticipants();
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Code kopiert!");
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      registered: "default",
      invited: "secondary",
      expired: "destructive",
    };
    const labels: Record<string, string> = {
      active: "Aktiv",
      registered: "Registriert",
      invited: "Eingeladen",
      expired: "Abgelaufen",
    };
    return <Badge variant={variants[status] ?? "outline"}>{labels[status] ?? status}</Badge>;
  };

  const currentCourse = courses.find((c) => c.id === selectedCourse);

  if (authLoading) return null;
  if (!profile?.is_admin) return null;

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <p className="text-sm text-muted-foreground">Kurse, Einladungen und Gast-Codes verwalten</p>
        </div>

        {/* Course selector */}
        <div className="flex items-center gap-4">
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Kurs wählen" />
            </SelectTrigger>
            <SelectContent>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.id})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={loadParticipants}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs: Teilnehmer | Verbrauch */}
        <Tabs defaultValue="participants">
          <TabsList>
            <TabsTrigger value="participants" className="gap-1.5">
              <Users className="h-4 w-4" /> Teilnehmer
            </TabsTrigger>
            <TabsTrigger value="usage" className="gap-1.5">
              <BarChart3 className="h-4 w-4" /> Verbrauch
            </TabsTrigger>
          </TabsList>

          <TabsContent value="participants" className="space-y-4 mt-4">
            {/* Stats */}
            {currentCourse && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Teilnehmer</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {participants.filter((p) => p.status === "active" || p.status === "registered").length}
                      <span className="text-sm font-normal text-muted-foreground"> / {currentCourse.max_participants}</span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Einladungen</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{participants.filter((p) => p.status === "invited").length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Budget pro User</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${currentCourse.default_key_budget.toFixed(2)}</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Invite actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Mail className="h-4 w-4" /> Per E-Mail einladen
                  </CardTitle>
                  <CardDescription>E-Mail-Adresse zur Whitelist hinzufügen</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Input
                    placeholder="student@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleInviteEmail()}
                  />
                  <Button onClick={handleInviteEmail} disabled={!inviteEmail.trim()}>
                    <Plus className="h-4 w-4 mr-1" /> Einladen
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Ticket className="h-4 w-4" /> Gast-Code erstellen
                  </CardTitle>
                  <CardDescription>Temporärer Zugang ohne E-Mail</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Anzeigename"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateGuest()}
                    />
                    <Button onClick={handleCreateGuest} disabled={!guestName.trim()}>
                      <Plus className="h-4 w-4 mr-1" /> Erstellen
                    </Button>
                  </div>
                  {newGuestCode && (
                    <div className="flex items-center gap-2 p-2 bg-accent rounded-md">
                      <code className="font-mono text-sm font-bold text-primary flex-1">{newGuestCode}</code>
                      <Button variant="ghost" size="icon" onClick={() => copyCode(newGuestCode)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Participants table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" /> Teilnehmer
                  <Badge variant="outline" className="ml-2">{participants.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Laden…</p>
                ) : participants.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Noch keine Teilnehmer. Lade jemanden ein!
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Typ</TableHead>
                        <TableHead>Kennung</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Eingeladen am</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {participants.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            {p.type === "email" ? (
                              <Mail className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Ticket className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{p.identifier}</TableCell>
                          <TableCell>{statusBadge(p.status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(p.created_at).toLocaleDateString("de-DE")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage" className="mt-4">
            {selectedCourse && <UsageOverview courseId={selectedCourse} />}
          </TabsContent>
        </Tabs>
    </div>
  );
};

export default AdminParticipants;
