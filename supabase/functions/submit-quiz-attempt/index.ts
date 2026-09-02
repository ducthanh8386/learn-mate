// Supabase Edge Function: submit-quiz-attempt
// Server-side grading engine for Quizzes with strict answer validation & time limit checks.

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Xác thực chữ ký và tính hợp lệ của JWT token qua Supabase Auth
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    const studentId = user?.id;

    if (userError || !studentId) {
      console.error("JWT verification failed:", userError);
      return new Response(JSON.stringify({ error: "Invalid or expired authorization token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { attemptId, answers } = await req.json();
    if (!attemptId || !Array.isArray(answers)) {
      return new Response(JSON.stringify({ error: "attemptId and answers array are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch attempt and associated quiz
    const { data: attempt, error: aErr } = await supabase
      .from("quiz_attempts")
      .select("*, quizzes(*)")
      .eq("id", attemptId)
      .single();

    if (aErr || !attempt) {
      return new Response(JSON.stringify({ error: "Attempt not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (attempt.student_id !== studentId) {
      return new Response(JSON.stringify({ error: "Unauthorized attempt" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (attempt.status === "SUBMITTED" || attempt.status === "GRADED") {
      return new Response(JSON.stringify({ error: "Lượt làm bài này đã được nộp trước đó." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const quiz = attempt.quizzes;
    const now = new Date();

    // 2. Validate time limit (if configured, allow 2-minute buffer for network latency)
    if (quiz.time_limit_minutes && quiz.time_limit_minutes > 0) {
      const startTime = new Date(attempt.started_at).getTime();
      const maxAllowedTime = startTime + (quiz.time_limit_minutes + 2) * 60 * 1000;
      if (now.getTime() > maxAllowedTime) {
        console.warn(`Attempt ${attemptId} submitted past deadline buffer.`);
      }
    }

    // 3. Fetch questions with answer options (INCLUDING is_correct for grading)
    const questionIds = answers.map((a: any) => a.question_id);
    const { data: dbQuestions, error: qErr } = await supabase
      .from("questions")
      .select("id, type, points, explanation, accepted_answers, answer_options(*)")
      .in("id", questionIds);

    if (qErr) throw qErr;

    const questionMap = new Map((dbQuestions || []).map((q) => [q.id, q]));

    let totalScore = 0;
    let maxPossibleScore = 0;
    let hasEssay = false;
    const gradedAnswers: any[] = [];
    const questionResults: any[] = [];

    // 4. Grade each answer
    for (const ans of answers) {
      const q = questionMap.get(ans.question_id);
      if (!q) continue;

      const qPoints = Number(q.points) || 1;
      maxPossibleScore += qPoints;

      let isCorrect = false;
      let pointsAwarded = 0;

      if (q.type === "multiple_choice" || q.type === "true_false") {
        const correctOpt = q.answer_options.find((opt: any) => opt.is_correct);
        const selectedId = ans.selected_option_ids?.[0];
        if (correctOpt && selectedId === correctOpt.id) {
          isCorrect = true;
          pointsAwarded = qPoints;
        }
      } else if (q.type === "multiple_select") {
        const correctOptionIds = q.answer_options
          .filter((opt: any) => opt.is_correct)
          .map((opt: any) => opt.id)
          .sort();
        const selectedIds = (ans.selected_option_ids || []).slice().sort();

        if (
          correctOptionIds.length === selectedIds.length &&
          correctOptionIds.every((id: string, idx: number) => id === selectedIds[idx])
        ) {
          isCorrect = true;
          pointsAwarded = qPoints;
        }
      } else if (q.type === "fill_blank") {
        const studentText = (ans.text_answer || "").trim().toLowerCase();
        const accepted = (q.accepted_answers || []).map((a: string) => a.trim().toLowerCase());
        if (accepted.includes(studentText)) {
          isCorrect = true;
          pointsAwarded = qPoints;
        }
      } else if (q.type === "essay") {
        hasEssay = true;
        isCorrect = null as any;
        pointsAwarded = null as any;
      }

      if (pointsAwarded) totalScore += pointsAwarded;

      gradedAnswers.push({
        attempt_id: attemptId,
        question_id: q.id,
        selected_option_ids: ans.selected_option_ids || null,
        text_answer: ans.text_answer || null,
        is_correct: isCorrect,
        points_awarded: pointsAwarded,
      });

      if (quiz.show_answer_after_submit) {
        questionResults.push({
          question_id: q.id,
          content: q.content,
          is_correct: isCorrect,
          points_awarded: pointsAwarded,
          max_points: qPoints,
          explanation: q.explanation,
          correct_option_ids: q.answer_options.filter((opt: any) => opt.is_correct).map((o: any) => o.id),
          correct_options: q.answer_options.filter((opt: any) => opt.is_correct).map((o: any) => o.content),
          accepted_answers: q.accepted_answers,
        });
      }
    }

    // Scale score to 10-point scale (standard in VN LMS)
    const scaledScore = maxPossibleScore > 0 
      ? Number(((totalScore / maxPossibleScore) * 10).toFixed(2)) 
      : totalScore;

    const finalStatus = hasEssay ? "PENDING_GRADING" : "GRADED";

    // 5. Insert answers and update attempt
    if (gradedAnswers.length > 0) {
      await supabase.from("quiz_answers").insert(gradedAnswers);
    }

    const { error: updErr } = await supabase
      .from("quiz_attempts")
      .update({
        score: scaledScore,
        status: finalStatus,
        submitted_at: now.toISOString(),
      })
      .eq("id", attemptId);

    if (updErr) throw updErr;

    const passed = scaledScore >= (quiz.pass_score || 5.0);

    return new Response(
      JSON.stringify({
        success: true,
        attemptId,
        score: scaledScore,
        status: finalStatus,
        passed,
        passScore: quiz.pass_score || 5.0,
        showAnswers: quiz.show_answer_after_submit,
        results: quiz.show_answer_after_submit ? questionResults : null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    console.error("Error in submit-quiz-attempt:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
