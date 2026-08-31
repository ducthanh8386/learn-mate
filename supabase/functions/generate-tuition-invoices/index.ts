// Supabase Edge Function: generate-tuition-invoices
// Scheduled monthly cron job to auto-generate invoices for classes with active tuition_plans.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    const currentPeriod = `Tháng ${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()}`;
    const dueDate = new Date(now.getFullYear(), now.getMonth(), 15).toISOString().split("T")[0]; // Due by 15th

    // 1. Fetch all monthly tuition plans
    const { data: plans, error: pErr } = await supabase
      .from("tuition_plans")
      .select(`
        id,
        class_id,
        amount,
        billing_cycle,
        classes (
          id,
          class_members (student_id)
        )
      `)
      .eq("billing_cycle", "monthly");

    if (pErr) throw pErr;

    let generatedCount = 0;

    for (const plan of plans || []) {
      const classMembers = (plan.classes as any)?.class_members || [];

      for (const member of classMembers) {
        // Check if invoice for this period already exists
        const { data: existing } = await supabase
          .from("tuition_invoices")
          .select("id")
          .eq("class_id", plan.class_id)
          .eq("student_id", member.student_id)
          .eq("period", currentPeriod)
          .maybeSingle();

        if (!existing) {
          await supabase.from("tuition_invoices").insert({
            class_id: plan.class_id,
            student_id: member.student_id,
            period: currentPeriod,
            amount_due: plan.amount,
            amount_paid: 0,
            status: "unpaid",
            due_date: dueDate,
          });
          generatedCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        period: currentPeriod,
        generatedCount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    console.error("Error in generate-tuition-invoices:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
