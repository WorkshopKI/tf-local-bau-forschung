import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { courseCode, email } = await req.json();
    if (!courseCode || !email) {
      return new Response(
        JSON.stringify({ allowed: false, reason: "Kurs-Code und E-Mail sind erforderlich." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Find course
    const { data: course, error: courseErr } = await supabase
      .from("courses")
      .select("id, name, enrollment_open, max_participants")
      .eq("id", courseCode)
      .single();

    if (courseErr || !course) {
      return new Response(
        JSON.stringify({ allowed: false, reason: "Dieser Kurs-Code ist ungültig oder die Registrierung ist geschlossen." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!course.enrollment_open) {
      return new Response(
        JSON.stringify({ allowed: false, reason: "Die Registrierung für diesen Kurs ist geschlossen." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Check that email is pre-invited on the whitelist (admin must add first)
    const { data: existing } = await supabase
      .from("enrollment_whitelist")
      .select("id, is_active")
      .eq("email", email.toLowerCase())
      .eq("course_id", courseCode)
      .maybeSingle();

    if (!existing) {
      return new Response(
        JSON.stringify({ allowed: false, reason: "Diese E-Mail-Adresse ist nicht für diesen Kurs eingeladen. Bitte wende dich an die Kursleitung." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!existing.is_active) {
      return new Response(
        JSON.stringify({ allowed: false, reason: "Dein Zugang zu diesem Kurs wurde deaktiviert." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Check capacity (count only registered users, not just invited)
    const { count } = await supabase
      .from("enrollment_whitelist")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseCode)
      .eq("is_active", true)
      .not("registered_at", "is", null);

    if (count !== null && count >= course.max_participants) {
      return new Response(
        JSON.stringify({ allowed: false, reason: "Der Kurs ist leider bereits voll." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ allowed: true, courseName: course.name }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("check-enrollment error:", e);
    return new Response(
      JSON.stringify({ allowed: false, reason: "Interner Fehler. Bitte versuche es erneut." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
