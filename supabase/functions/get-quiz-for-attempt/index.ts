// Supabase Edge Function: get-quiz-for-attempt
// Retrieves quiz questions for a student attempt with is_correct HIDDEN for security.

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

    const { quizId } = await req.json();
    if (!quizId) {
      return new Response(JSON.stringify({ error: "quizId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch Quiz configuration
    const { data: quiz, error: qErr } = await supabase
      .from("quizzes")
      .select("*, classes(id, name)")
      .eq("id", quizId)
      .single();

    if (qErr || !quiz) {
      return new Response(JSON.stringify({ error: "Quiz not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check Start / End window
    const now = new Date();
    if (quiz.start_at && new Date(quiz.start_at) > now) {
      return new Response(JSON.stringify({ error: "Bài kiểm tra chưa mở." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (quiz.end_at && new Date(quiz.end_at) < now) {
      return new Response(JSON.stringify({ error: "Bài kiểm tra đã hết hạn." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Check existing attempts & max_attempts
    const { data: existingAttempts } = await supabase
      .from("quiz_attempts")
      .select("id, attempt_number, status")
      .eq("quiz_id", quizId)
      .eq("student_id", studentId)
      .order("attempt_number", { ascending: false });

    const attemptCount = existingAttempts?.length || 0;
    const maxAttempts = quiz.max_attempts || 1;

    // Check if there is an in-progress attempt to resume
    let currentAttempt = existingAttempts?.find((a) => a.status === "IN_PROGRESS" || a.status === "NOT_STARTED");

    if (!currentAttempt) {
      if (attemptCount >= maxAttempts) {
        return new Response(
          JSON.stringify({ error: `Bạn đã làm tối đa ${maxAttempts} lượt cho bài kiểm tra này.` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create new attempt
      const nextAttemptNumber = attemptCount + 1;
      const { data: newAttempt, error: insErr } = await supabase
        .from("quiz_attempts")
        .insert({
          quiz_id: quizId,
          student_id: studentId,
          attempt_number: nextAttemptNumber,
          status: "IN_PROGRESS",
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insErr) throw insErr;
      currentAttempt = newAttempt;
    }

    // 3. Fetch quiz questions & answer options (EXCLUDING is_correct)
    const { data: quizQuestions, error: qqErr } = await supabase
      .from("quiz_questions")
      .select(`
        order_index,
        points_override,
        questions (
          id,
          type,
          content,
          points,
          answer_options (
            id,
            content,
            order_index
          )
        )
      `)
      .eq("quiz_id", quizId)
      .order("order_index", { ascending: true });

    if (qqErr) throw qqErr;

    // Map and sanitize (Ensure is_correct is NEVER leaked)
    let questions = (quizQuestions || []).map((qq) => {
      const q = qq.questions;
      let options = (q.answer_options || []).map((opt) => ({
        id: opt.id,
        content: opt.content,
        order_index: opt.order_index,
      }));

      // Shuffle answers if configured
      if (quiz.shuffle_answers) {
        options = options.sort(() => Math.random() - 0.5);
      } else {
        options = options.sort((a, b) => a.order_index - b.order_index);
      }

      return {
        id: q.id,
        type: q.type,
        content: q.content,
        points: qq.points_override || q.points || 1,
        options,
      };
    });

    // Shuffle questions if configured
    if (quiz.shuffle_questions) {
      questions = questions.sort(() => Math.random() - 0.5);
    }

    // Question count limit if configured
    if (quiz.question_count && quiz.question_count > 0 && quiz.question_count < questions.length) {
      questions = questions.slice(0, quiz.question_count);
    }

    return new Response(
      JSON.stringify({
        quiz: {
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          time_limit_minutes: quiz.time_limit_minutes,
          pass_score: quiz.pass_score,
          max_attempts: quiz.max_attempts,
        },
        attempt: currentAttempt,
        questions,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    console.error("Error in get-quiz-for-attempt:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
