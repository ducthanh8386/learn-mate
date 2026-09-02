// Supabase Edge Function: clerk-webhook
// Syncs Clerk user events (user.created, user.updated, user.deleted) to Supabase profiles table.
// Verified with Svix signature to prevent forgery and unauthorized profile deletion.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Webhook } from "https://esm.sh/svix@1.15.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const webhookSecret = Deno.env.get("CLERK_WEBHOOK_SECRET");

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    if (!webhookSecret) {
      console.error("Missing CLERK_WEBHOOK_SECRET environment variable");
      return new Response(
        JSON.stringify({ error: "Server misconfiguration: Webhook secret not set" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response(
        JSON.stringify({ error: "Missing required Svix verification headers" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const rawBody = await req.text();
    const wh = new Webhook(webhookSecret);
    let payload: any;

    try {
      payload = wh.verify(rawBody, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      });
    } catch (verifyErr) {
      console.error("Invalid webhook signature:", verifyErr);
      return new Response(
        JSON.stringify({ error: "Invalid webhook signature" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const { type, data } = payload;

    if (type === "user.created" || type === "user.updated") {
      const id = data.id;
      const fullName = [data.first_name, data.last_name].filter(Boolean).join(" ") ||
        data.username ||
        data.email_addresses?.[0]?.email_address ||
        "Người dùng";
      const avatarUrl = data.image_url || data.profile_image_url || null;
      const phone = data.phone_numbers?.[0]?.phone_number || null;

      const { error } = await supabase
        .from("profiles")
        .upsert(
          {
            id,
            full_name: fullName,
            avatar_url: avatarUrl,
            phone,
            is_active: true,
          },
          { onConflict: "id", ignoreDuplicates: false }
        );

      if (error) {
        console.error("Error upserting profile:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }

      return new Response(JSON.stringify({ success: true, message: `Synced user ${id}` }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (type === "user.deleted") {
      const id = data.id;
      const { error } = await supabase.from("profiles").delete().eq("id", id);
      if (error) {
        console.error("Error deleting profile:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }
      return new Response(JSON.stringify({ success: true, message: `Deleted user ${id}` }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 400 });
  }
});
