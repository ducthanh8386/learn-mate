-- Migration 04: Postgres function để import hàng loạt câu hỏi trắc nghiệm
-- Chạy trong 1 transaction duy nhất — nếu bất kỳ bước nào fail, rollback toàn bộ.
-- Gọi từ frontend: supabaseClient.rpc('insert_quiz_questions_batch', { p_course_id, p_class_id, p_questions })

CREATE OR REPLACE FUNCTION insert_quiz_questions_batch(
  p_course_id UUID,
  p_class_id  UUID,
  p_questions JSONB  -- Array of { content, explanation, options: [{content, is_correct}] }
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id TEXT;
  v_course_owner TEXT;
  q          JSONB;
  q_id       UUID;
  opt        JSONB;
  opt_idx    INT;
  ins_cnt    INT := 0;
BEGIN
  -- 1. Lấy ID người gọi từ JWT
  v_caller_id := requesting_user_id();

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: missing JWT claim';
  END IF;

  -- 2. Kiểm tra người gọi có phải chủ sở hữu course không
  SELECT tutor_id INTO v_course_owner
  FROM courses
  WHERE id = p_course_id;

  IF v_course_owner IS NULL THEN
    RAISE EXCEPTION 'Course not found: %', p_course_id;
  END IF;

  IF v_course_owner <> v_caller_id AND NOT is_admin() THEN
    RAISE EXCEPTION 'Forbidden: caller % is not the owner of course %', v_caller_id, p_course_id;
  END IF;

  -- 3. Insert từng câu hỏi + đáp án trong cùng 1 transaction
  FOR q IN SELECT * FROM jsonb_array_elements(p_questions)
  LOOP
    -- Insert câu hỏi
    INSERT INTO questions(
      course_id,
      class_id,
      type,
      content,
      points,
      explanation
    )
    VALUES (
      p_course_id,
      p_class_id,
      'multiple_choice',
      (q->>'content'),
      1,
      NULLIF(TRIM(q->>'explanation'), '')
    )
    RETURNING id INTO q_id;

    -- Insert từng đáp án, gán order_index theo vị trí trong mảng
    opt_idx := 0;
    FOR opt IN SELECT * FROM jsonb_array_elements(q->'options')
    LOOP
      INSERT INTO answer_options(
        question_id,
        content,
        is_correct,
        order_index
      )
      VALUES (
        q_id,
        (opt->>'content'),
        COALESCE((opt->>'is_correct')::BOOLEAN, false),
        opt_idx
      );
      opt_idx := opt_idx + 1;
    END LOOP;

    -- Đảm bảo mỗi câu có ít nhất 1 đáp án
    IF opt_idx = 0 THEN
      RAISE EXCEPTION 'Question has no options: %', (q->>'content');
    END IF;

    ins_cnt := ins_cnt + 1;
  END LOOP;

  -- 4. Trả về số câu đã insert thành công
  RETURN jsonb_build_object('inserted_count', ins_cnt);
END;
$$;

-- Grant quyền gọi (chính sách kiểm tra bên trong function sẽ validate caller ID & ownership)
GRANT EXECUTE ON FUNCTION insert_quiz_questions_batch(UUID, UUID, JSONB) TO authenticated, service_role, anon;

