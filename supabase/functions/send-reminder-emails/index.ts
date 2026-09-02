// Supabase Edge Function: send-reminder-emails
// Automated email reminder engine using Resend for schedules & tuition invoices.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Gửi email qua Resend REST API
 */
async function sendEmailViaResend(to: string, subject: string, htmlContent: string) {
  if (!resendApiKey) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `LearnMate <${resendFromEmail}>`,
        to: [to],
        subject,
        html: htmlContent,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[Resend API Error] Status ${res.status}:`, errorText);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[Resend Network Error]:", err);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    let remindersSent = 0;

    // 1. Kiểm tra các buổi học sắp diễn ra trong vòng 60 phút tới
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
            profiles (id, full_name, phone)
          )
        )
      `)
      .gte("start_time", now.toISOString())
      .lte("start_time", oneHourLater.toISOString())
      .eq("status", "scheduled");

    if (schErr) console.error("Error checking upcoming schedules:", schErr);

    // 2. Kiểm tra các hóa đơn học phí sắp tới hạn (trong vòng 3 ngày) chưa thanh toán
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const { data: dueInvoices, error: invErr } = await supabase
      .from("tuition_invoices")
      .select(`
        id,
        period,
        amount_due,
        amount_paid,
        due_date,
        profiles:student_id (id, full_name, phone),
        classes (name)
      `)
      .eq("status", "unpaid")
      .lte("due_date", threeDaysLater.toISOString().split("T")[0]);

    if (invErr) console.error("Error checking due invoices:", invErr);

    // 3. Xử lý gửi email nhắc nhở
    if (resendApiKey) {
      console.log(`[Resend Engine] Đang xử lý gửi email thật qua Resend API...`);

      // Gửi email nhắc lịch học sắp tới
      for (const sch of upcomingSchedules || []) {
        const members = (sch.classes as any)?.class_members || [];
        for (const m of members) {
          const profile = m.profiles;
          const studentName = profile?.full_name || "Học sinh";
          // Giả định email người dùng hoặc email dự phòng
          const targetEmail = `student_${profile?.id}@learnmate.edu.vn`;

          const emailHtml = `
            <div style="font-family: sans-serif; line-height: 1.5; color: #1e293b;">
              <h2 style="color: #4f46e5;">Nhắc Lịch Học: ${sch.title}</h2>
              <p>Chào <strong>${studentName}</strong>,</p>
              <p>Bạn có buổi học thuộc lớp <strong>${(sch.classes as any)?.name}</strong> sắp diễn ra trong ít phút tới.</p>
              <p><strong>Thời gian:</strong> ${new Date(sch.start_time).toLocaleString("vi-VN")}</p>
              ${sch.meeting_url ? `<p><a href="${sch.meeting_url}" style="display:inline-block;padding:10px 18px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;">Tham Gia Buổi Học</a></p>` : ''}
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;"/>
              <p style="font-size: 12px; color: #64748b;">LearnMate LMS - Hệ thống Quản lý Lớp học Gia sư</p>
            </div>
          `;

          const sent = await sendEmailViaResend(
            targetEmail,
            `[LearnMate] Nhắc nhở buổi học sắp diễn ra: ${sch.title}`,
            emailHtml
          );
          if (sent) remindersSent++;
        }
      }

      // Gửi email nhắc học phí
      for (const inv of dueInvoices || []) {
        const profile = inv.profiles as any;
        const studentName = profile?.full_name || "Học sinh";
        const targetEmail = `student_${profile?.id}@learnmate.edu.vn`;
        const balance = Number(inv.amount_due) - Number(inv.amount_paid);

        const emailHtml = `
          <div style="font-family: sans-serif; line-height: 1.5; color: #1e293b;">
            <h2 style="color: #d97706;">Nhắc Hạn Đóng Học Phí</h2>
            <p>Chào <strong>${studentName}</strong>,</p>
            <p>Hệ thống xin nhắc hóa đơn học phí cho kỳ <strong>${inv.period}</strong> (Lớp ${(inv.classes as any)?.name}) sắp đến hạn thanh toán.</p>
            <p><strong>Số tiền cần thanh toán:</strong> ${balance.toLocaleString("vi-VN")} đ</p>
            <p><strong>Hạn nộp:</strong> ${inv.due_date}</p>
            <p>Vui lòng hoàn thành học phí sớm cho gia sư.</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;"/>
            <p style="font-size: 12px; color: #64748b;">LearnMate LMS - Hệ thống Quản lý Lớp học Gia sư</p>
          </div>
        `;

        const sent = await sendEmailViaResend(
          targetEmail,
          `[LearnMate] Nhắc hạn đóng học phí: ${inv.period}`,
          emailHtml
        );
        if (sent) remindersSent++;
      }
    } else {
      console.warn(
        `[Resend Notice] Biến môi trường RESEND_API_KEY chưa được thiết lập. Đã phát hiện ${upcomingSchedules?.length || 0} lịch học và ${dueInvoices?.length || 0} hóa đơn cần nhắc, ghi nhận mô phỏng thành công.`
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        isConfigured: !!resendApiKey,
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
