-- ==============================================================================
-- MIGRATION: 02_security_hardening.sql
-- Description: Khắc phục các lỗ hổng bảo mật & lỗi logic nghiệp vụ theo báo cáo review
-- 1. Chống leo quyền & tự mở khóa tài khoản (profiles trigger)
-- 2. Siết RLS quiz_attempts, quiz_answers, assignment_submissions
-- 3. Kiểm soát deadline & allow_late_submission ở tầng RLS
-- 4. Chống race condition (TOCTOU) trong join_class_by_code()
-- 5. Chống self-approval trong đơn xin làm gia sư (tutor_applications)
-- 6. Định nghĩa Storage Policies cho materials, submissions, class-thumbnails
-- ==============================================================================

-- 1. CHỐNG LEO QUYỀN TRÊN BẢNG PROFILES (Critical #1)
CREATE OR REPLACE FUNCTION protect_profile_privileged_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Khi UPDATE: Nếu không phải Admin, giữ nguyên role và is_active cũ
  IF TG_OP = 'UPDATE' THEN
    IF NOT is_admin() THEN
      NEW.role := OLD.role;
      NEW.is_active := OLD.is_active;
    END IF;
  END IF;

  -- Khi INSERT: Nếu không phải Admin, bắt buộc role = 'student' và is_active = true
  IF TG_OP = 'INSERT' THEN
    IF NOT is_admin() THEN
      NEW.role := 'student';
      NEW.is_active := true;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_update ON profiles;
CREATE TRIGGER trg_protect_profile_update
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION protect_profile_privileged_columns();

DROP TRIGGER IF EXISTS trg_protect_profile_insert ON profiles;
CREATE TRIGGER trg_protect_profile_insert
BEFORE INSERT ON profiles
FOR EACH ROW EXECUTE FUNCTION protect_profile_privileged_columns();


-- 2. SIẾT RLS CHO QUIZ ATTEMPTS & QUIZ ANSWERS (Critical #2)
-- Xóa policy cũ nếu có
DROP POLICY IF EXISTS "Học sinh quản lý lượt làm của mình" ON quiz_attempts;
DROP POLICY IF EXISTS "Học sinh xem lượt làm của mình" ON quiz_attempts;
DROP POLICY IF EXISTS "Học sinh tạo lượt làm của mình" ON quiz_attempts;

-- Học sinh chỉ được SELECT lượt làm của mình
CREATE POLICY "Học sinh xem lượt làm của mình" ON quiz_attempts
  FOR SELECT USING (student_id = requesting_user_id());

-- Học sinh chỉ được INSERT lượt làm với status ban đầu là NOT_STARTED hoặc IN_PROGRESS
CREATE POLICY "Học sinh tạo lượt làm của mình" ON quiz_attempts
  FOR INSERT WITH CHECK (
    student_id = requesting_user_id() 
    AND status IN ('NOT_STARTED', 'IN_PROGRESS')
  );

-- TUYỆT ĐỐI KHÔNG CẤP POLICY UPDATE CHO HỌC SINH TRÊN quiz_attempts.
-- Việc cập nhật điểm (score), trạng thái (status = 'SUBMITTED'/'GRADED'), 
-- thời gian nộp (submitted_at) chỉ được thực hiện bởi Edge Function (Service Role Key).

-- Siết quiz_answers: Xóa policy cũ
DROP POLICY IF EXISTS "Học sinh ghi câu trả lời của mình" ON quiz_answers;
DROP POLICY IF EXISTS "Học sinh xem câu trả lời của mình" ON quiz_answers;
DROP POLICY IF EXISTS "Học sinh tạo câu trả lời của mình" ON quiz_answers;

CREATE POLICY "Học sinh xem câu trả lời của mình" ON quiz_answers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM quiz_attempts qa WHERE qa.id = attempt_id AND qa.student_id = requesting_user_id())
  );

CREATE POLICY "Học sinh tạo câu trả lời của mình" ON quiz_answers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM quiz_attempts qa 
      WHERE qa.id = attempt_id 
        AND qa.student_id = requesting_user_id()
        AND qa.status = 'IN_PROGRESS'
    )
  );
-- Không cấp policy UPDATE cho học sinh trên quiz_answers.


-- 3. SIẾT RLS CHO ASSIGNMENT SUBMISSIONS & KIỂM TRA ALLOW_LATE_SUBMISSION (Critical #2 & Logic)
DROP POLICY IF EXISTS "Học sinh nộp & xem bài của mình" ON assignment_submissions;
DROP POLICY IF EXISTS "Học sinh xem bài nộp của mình" ON assignment_submissions;
DROP POLICY IF EXISTS "Học sinh nộp bài đúng hạn hoặc được phép trễ" ON assignment_submissions;
DROP POLICY IF EXISTS "Học sinh chỉnh sửa nội dung bài nộp" ON assignment_submissions;

-- Học sinh xem bài nộp của mình
CREATE POLICY "Học sinh xem bài nộp của mình" ON assignment_submissions
  FOR SELECT USING (student_id = requesting_user_id());

-- Học sinh nộp bài mới (chỉ nộp khi đúng hạn HOẶC gia sư cho phép nộp muộn)
CREATE POLICY "Học sinh nộp bài đúng hạn hoặc được phép trễ" ON assignment_submissions
  FOR INSERT WITH CHECK (
    student_id = requesting_user_id()
    AND status = 'SUBMITTED'
    AND score IS NULL
    AND feedback IS NULL
    AND EXISTS (
      SELECT 1 FROM assignments a 
      WHERE a.id = assignment_id
        AND (a.deadline IS NULL OR now() <= a.deadline OR a.allow_late_submission = true)
    )
  );

-- Học sinh cập nhật bài nộp (chỉ khi bài chưa được chấm điểm và đúng hạn / cho phép nộp muộn)
CREATE POLICY "Học sinh chỉnh sửa nội dung bài nộp" ON assignment_submissions
  FOR UPDATE USING (
    student_id = requesting_user_id() 
    AND status = 'SUBMITTED'
    AND score IS NULL
  )
  WITH CHECK (
    student_id = requesting_user_id()
    AND status = 'SUBMITTED'
    AND score IS NULL
    AND feedback IS NULL
    AND EXISTS (
      SELECT 1 FROM assignments a 
      WHERE a.id = assignment_id
        AND (a.deadline IS NULL OR now() <= a.deadline OR a.allow_late_submission = true)
    )
  );


-- 4. CHỐNG SELF-APPROVAL TRÊN TUTOR_APPLICATIONS (Medium #1)
DROP POLICY IF EXISTS "User tạo đơn" ON tutor_applications;
DROP POLICY IF EXISTS "User tạo đơn chờ duyệt" ON tutor_applications;
CREATE POLICY "User tạo đơn chờ duyệt" ON tutor_applications
  FOR INSERT WITH CHECK (
    user_id = requesting_user_id()
    AND status = 'pending'
  );


-- 5. CHỐNG RACE CONDITION (TOCTOU) TRONG JOIN_CLASS_BY_CODE() (Logic #2)
CREATE OR REPLACE FUNCTION join_class_by_code(p_code TEXT)
RETURNS UUID AS $$
DECLARE
  v_class_id UUID;
  v_max_students INT;
  v_current_students INT;
  v_user_id TEXT;
BEGIN
  v_user_id := requesting_user_id();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Chưa xác thực người dùng';
  END IF;

  -- Khóa hàng bằng FOR UPDATE để chống Race Condition khi nhiều người cùng vào lớp
  SELECT id, max_students INTO v_class_id, v_max_students
  FROM classes
  WHERE class_code = p_code AND status = 'active'
  FOR UPDATE;

  IF v_class_id IS NULL THEN
    RAISE EXCEPTION 'Mã lớp không hợp lệ hoặc lớp đã đóng';
  END IF;

  SELECT count(*) INTO v_current_students
  FROM class_members
  WHERE class_id = v_class_id;

  IF v_current_students >= v_max_students THEN
    RAISE EXCEPTION 'Lớp học đã đủ sĩ số tối đa';
  END IF;

  INSERT INTO class_members (class_id, student_id)
  VALUES (v_class_id, v_user_id)
  ON CONFLICT (class_id, student_id) DO NOTHING;

  RETURN v_class_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Helper function: is_tutor()
CREATE OR REPLACE FUNCTION is_tutor() RETURNS boolean AS $$
  SELECT get_my_role() = 'tutor';
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- 6. STORAGE BUCKET POLICIES (Medium #2)
-- Tạo bucket nếu chưa tồn tại
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('materials', 'materials', false),
  ('submissions', 'submissions', false),
  ('class-thumbnails', 'class-thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- Policies cho bucket class-thumbnails (public read)
DROP POLICY IF EXISTS "Public đọc thumbnails" ON storage.objects;
CREATE POLICY "Public đọc thumbnails" ON storage.objects
  FOR SELECT USING (bucket_id = 'class-thumbnails');

DROP POLICY IF EXISTS "Gia sư upload thumbnails" ON storage.objects;
CREATE POLICY "Gia sư upload thumbnails" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'class-thumbnails' 
    AND (public.requesting_user_id() IS NOT NULL)
  );

-- Policies cho bucket materials (Gia sư toàn quyền, học sinh chỉ đọc)
DROP POLICY IF EXISTS "Gia sư quản lý materials" ON storage.objects;
CREATE POLICY "Gia sư quản lý materials" ON storage.objects
  FOR ALL USING (
    bucket_id = 'materials' 
    AND (public.is_tutor() OR public.is_admin())
  );

DROP POLICY IF EXISTS "Học sinh đọc materials qua signed url" ON storage.objects;
CREATE POLICY "Học sinh đọc materials qua signed url" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'materials' 
    AND public.requesting_user_id() IS NOT NULL
  );

-- Policies cho bucket submissions (Học sinh upload bài, gia sư xem bài)
DROP POLICY IF EXISTS "Học sinh upload submissions" ON storage.objects;
CREATE POLICY "Học sinh upload submissions" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'submissions' 
    AND public.requesting_user_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "Học sinh và gia sư xem submissions" ON storage.objects;
CREATE POLICY "Học sinh và gia sư xem submissions" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'submissions' 
    AND public.requesting_user_id() IS NOT NULL
  );
