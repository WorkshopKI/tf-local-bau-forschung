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
    const { token } = await req.json();
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token ist erforderlich." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Look up token
    const { data: guestToken, error: tokenErr } = await supabase
      .from("guest_tokens")
      .select("*")
      .eq("token", token.toUpperCase())
      .single();

    if (tokenErr || !guestToken) {
      return new Response(
        JSON.stringify({ error: "Dieser Gast-Code ist ungültig oder abgelaufen." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!guestToken.is_active) {
      return new Response(
        JSON.stringify({ error: "Dieser Gast-Code wurde deaktiviert." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(guestToken.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Dieser Gast-Code ist abgelaufen." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const guestEmail = `guest-${token.toLowerCase()}@datapilot.internal`;
    let userId = guestToken.user_id;

    // 2. First login — create auth user
    if (!userId) {
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: guestEmail,
        email_confirm: true,
        user_metadata: {
          display_name: guestToken.display_name,
          auth_method: "guest",
        },
      });

      if (createErr) {
        console.error("Create user error:", createErr);
        return new Response(
          JSON.stringify({ error: "Benutzer konnte nicht erstellt werden." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = newUser.user.id;

      // Update guest_tokens with user_id
      await supabase
        .from("guest_tokens")
        .update({ user_id: userId })
        .eq("id", guestToken.id);

      // Set course_id on profile
      await supabase
        .from("user_profiles")
        .update({ course_id: guestToken.course_id })
        .eq("id", userId);
    }

    // 3. Generate session via magic link
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: guestEmail,
    });

    if (linkErr || !linkData) {
      console.error("Generate link error:", linkErr);
      return new Response(
        JSON.stringify({ error: "Session konnte nicht erstellt werden." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract token hash from the link and verify it to get a session
    const url = new URL(linkData.properties.action_link);
    const tokenHash = url.searchParams.get("token") || url.hash?.replace("#", "");

    // Use verifyOtp to get a real session
    const { data: verifyData, error: verifyErr } = await supabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "magiclink",
    });

    if (verifyErr || !verifyData?.session) {
      console.error("Verify OTP error:", verifyErr);
      return new Response(
        JSON.stringify({ error: "Session konnte nicht erstellt werden." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        session: {
          access_token: verifyData.session.access_token,
          refresh_token: verifyData.session.refresh_token,
        },
        user: {
          id: userId,
          display_name: guestToken.display_name,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("guest-login error:", e);
    return new Response(
      JSON.stringify({ error: "Interner Fehler." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
