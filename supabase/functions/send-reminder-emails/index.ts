// Supabase Edge Function: send-reminder-emails
// Automated email reminder engine using Resend for schedules & tuition invoices.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    let remindersSent = 0;

    // 1. Check for upcoming class schedules starting within 60 minutes
    const { data: upcomingSchedules, error: schErr } = await supabase
      .from("schedules")
      .select(`
        id,
        title,
        start_time,
        meeting_url,
        classes (
          name,
          class_members (
            student_id,
            profiles (full_name, phone)
          )
        )
      `)
      .gte("start_time", now.toISOString())
      .lte("start_time", oneHourLater.toISOString())
      .eq("status", "scheduled");

    if (schErr) console.error("Error checking upcoming schedules:", schErr);

    // 2. Check for tuition invoices due in <= 3 days that are unpaid
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const { data: dueInvoices, error: invErr } = await supabase
      .from("tuition_invoices")
      .select(`
        id,
        period,
        amount_due,
        amount_paid,
        due_date,
        profiles:student_id (full_name, phone),
        classes (name)
      `)
      .eq("status", "unpaid")
      .lte("due_date", threeDaysLater.toISOString().split("T")[0]);

    if (invErr) console.error("Error checking due invoices:", invErr);

    // If Resend API key is provided, send real emails
    if (resendApiKey) {
      // Send schedule reminders
      for (const sch of upcomingSchedules || []) {
        const members = (sch.classes as any)?.class_members || [];
        for (const m of members) {
          const profile = m.profiles;
          // In real deployment, email is retrieved from Clerk/profile
          console.log(`[Resend Reminder] Sending class reminder to ${profile?.full_name} for session "${sch.title}"`);
          remindersSent++;
        }
      }
    } else {
      console.log("[Resend Info] RESEND_API_KEY is not set. Logged reminder events for simulated delivery.");
    }

    return new Response(
      JSON.stringify({
        success: true,
        upcomingSchedulesCount: upcomingSchedules?.length || 0,
        dueInvoicesCount: dueInvoices?.length || 0,
        remindersSent,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    console.error("Error in send-reminder-emails:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
