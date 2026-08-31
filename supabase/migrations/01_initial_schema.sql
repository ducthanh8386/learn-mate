-- ==============================================================================
-- LEARN-MATE LMS GIA SƯ - DATABASE SCHEMA & RLS (INITIAL MIGRATION)
-- ==============================================================================

-- 0. CLEANUP (Hỗ trợ chạy lại an toàn nếu có lỗi dở dang)
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS tuition_invoices CASCADE;
DROP TABLE IF EXISTS tuition_plans CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS quiz_answers CASCADE;
DROP TABLE IF EXISTS quiz_attempts CASCADE;
DROP TABLE IF EXISTS quiz_questions CASCADE;
DROP TABLE IF EXISTS quizzes CASCADE;
DROP TABLE IF EXISTS answer_options CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS assignment_submissions CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS video_progress CASCADE;
DROP TABLE IF EXISTS lesson_contents CASCADE;
DROP TABLE IF EXISTS lessons CASCADE;
DROP TABLE IF EXISTS modules CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS class_members CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS tutor_applications CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 1. ENUMS
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'tutor', 'student');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_status') THEN
    CREATE TYPE content_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_type') THEN
    CREATE TYPE content_type AS ENUM ('video', 'document', 'quiz', 'assignment');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'question_type') THEN
    CREATE TYPE question_type AS ENUM ('multiple_choice', 'multiple_select', 'true_false', 'fill_blank', 'essay');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attempt_status') THEN
    CREATE TYPE attempt_status AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'PENDING_GRADING', 'GRADED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'submission_status') THEN
    CREATE TYPE submission_status AS ENUM ('SUBMITTED', 'GRADED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'schedule_status') THEN
    CREATE TYPE schedule_status AS ENUM ('scheduled', 'completed', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
    CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tuition_status') THEN
    CREATE TYPE tuition_status AS ENUM ('unpaid', 'partial', 'paid', 'overdue');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tuition_cycle') THEN
    CREATE TYPE tuition_cycle AS ENUM ('per_session', 'monthly', 'per_course');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'application_status') THEN
    CREATE TYPE application_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'class_status') THEN
    CREATE TYPE class_status AS ENUM ('active', 'archived');
  END IF;
END $$;

-- 2. CORE USER & CLASS TABLES
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,              -- Clerk user_id (e.g. 'user_2abcXYZ')
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  avatar_url TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tutor_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  subjects TEXT[],
  bio TEXT,
  status application_status DEFAULT 'pending',
  reviewed_by TEXT REFERENCES profiles(id),
  submitted_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  class_code TEXT UNIQUE NOT NULL,
  max_students INT DEFAULT 30,
  schedule_text TEXT,
  status class_status DEFAULT 'active',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE class_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (class_id, student_id)
);

-- 3. COURSES, MODULES, LESSONS, CONTENTS, PROGRESS
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  tutor_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  status content_status DEFAULT 'DRAFT',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  order_index INT DEFAULT 0,
  status content_status DEFAULT 'PUBLISHED',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lesson_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  type content_type NOT NULL,
  title TEXT NOT NULL,
  content_data JSONB NOT NULL,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Lưu ý: Đổi tên cột current_time sang watched_seconds vì current_time là từ khóa chuẩn của Postgres
CREATE TABLE video_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  content_id UUID REFERENCES lesson_contents(id) ON DELETE CASCADE,
  watched_seconds NUMERIC DEFAULT 0,
  duration NUMERIC DEFAULT 0,
  percentage NUMERIC DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_id, content_id)
);

-- 4. ASSIGNMENTS, QUESTION BANK & QUIZZES
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  deadline TIMESTAMPTZ,
  max_score NUMERIC DEFAULT 10,
  allow_late_submission BOOLEAN DEFAULT false,
  attachment_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  file_urls TEXT[],
  text_content TEXT,
  status submission_status DEFAULT 'SUBMITTED',
  score NUMERIC,
  feedback TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  graded_at TIMESTAMPTZ
);

CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  type question_type NOT NULL,
  content TEXT NOT NULL,
  points NUMERIC DEFAULT 1,
  explanation TEXT,
  accepted_answers TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE answer_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT false,
  order_index INT DEFAULT 0
);

CREATE TABLE quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  time_limit_minutes INT,
  max_attempts INT DEFAULT 1,
  shuffle_questions BOOLEAN DEFAULT false,
  shuffle_answers BOOLEAN DEFAULT false,
  question_count INT,
  pass_score NUMERIC DEFAULT 5.0,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  show_answer_after_submit BOOLEAN DEFAULT true,
  status content_status DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  order_index INT DEFAULT 0,
  points_override NUMERIC,
  UNIQUE (quiz_id, question_id)
);

CREATE TABLE quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  attempt_number INT DEFAULT 1,
  score NUMERIC,
  status attempt_status DEFAULT 'NOT_STARTED',
  started_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ
);

CREATE TABLE quiz_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  selected_option_ids UUID[],
  text_answer TEXT,
  is_correct BOOLEAN,
  points_awarded NUMERIC
);

-- 5. SCHEDULES, ATTENDANCE, TUITION, ANNOUNCEMENTS, NOTIFICATIONS
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  meeting_url TEXT,
  status schedule_status DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  status attendance_status NOT NULL,
  note TEXT,
  marked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (schedule_id, student_id)
);

CREATE TABLE tuition_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  billing_cycle tuition_cycle DEFAULT 'monthly',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tuition_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  amount_due NUMERIC NOT NULL,
  amount_paid NUMERIC DEFAULT 0,
  status tuition_status DEFAULT 'unpaid',
  due_date DATE,
  paid_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  tutor_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. INDEXES
CREATE INDEX idx_class_members_student ON class_members(student_id);
CREATE INDEX idx_class_members_class ON class_members(class_id);
CREATE INDEX idx_courses_class ON courses(class_id);
CREATE INDEX idx_lessons_class ON lessons(class_id);
CREATE INDEX idx_lesson_contents_class ON lesson_contents(class_id);
CREATE INDEX idx_quizzes_class ON quizzes(class_id);
CREATE INDEX idx_quiz_attempts_student_quiz ON quiz_attempts(student_id, quiz_id);
CREATE INDEX idx_assignment_submissions_student ON assignment_submissions(student_id);
CREATE INDEX idx_attendance_class_student ON attendance(class_id, student_id);
CREATE INDEX idx_tuition_invoices_student ON tuition_invoices(student_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE is_read = false;

-- 7. HELPER FUNCTIONS (FOR CLERK JWT & ACCESS CONTROL)
CREATE OR REPLACE FUNCTION requesting_user_id() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::text;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_my_role() RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = requesting_user_id();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean AS $$
  SELECT get_my_role() = 'admin';
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION owns_class(p_class_id UUID) RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM classes WHERE id = p_class_id AND tutor_id = requesting_user_id());
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_member_of_class(p_class_id UUID) RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM class_members WHERE class_id = p_class_id AND student_id = requesting_user_id());
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION join_class_by_code(p_code TEXT)
RETURNS UUID AS $$
DECLARE
  v_class_id UUID;
  v_user_id TEXT;
  v_max_students INT;
  v_current_students INT;
BEGIN
  v_user_id := requesting_user_id();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, max_students INTO v_class_id, v_max_students
  FROM classes
  WHERE class_code = p_code AND status = 'active';

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

-- 8. ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answer_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE tuition_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE tuition_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 9. RLS POLICIES

-- profiles
CREATE POLICY "Xem hồ sơ của chính mình hoặc admin xem tất cả" ON profiles FOR SELECT USING (id = requesting_user_id() OR is_admin());
CREATE POLICY "User hoặc Admin tạo hồ sơ" ON profiles FOR INSERT WITH CHECK (id = requesting_user_id() OR is_admin());
CREATE POLICY "Sửa hồ sơ của chính mình hoặc admin sửa" ON profiles FOR UPDATE USING (id = requesting_user_id() OR is_admin());
CREATE POLICY "Admin xóa hồ sơ" ON profiles FOR DELETE USING (is_admin());

-- tutor_applications
CREATE POLICY "User xem đơn của mình" ON tutor_applications FOR SELECT USING (user_id = requesting_user_id() OR is_admin());
CREATE POLICY "User tạo đơn" ON tutor_applications FOR INSERT WITH CHECK (user_id = requesting_user_id());
CREATE POLICY "Admin duyệt đơn" ON tutor_applications FOR UPDATE USING (is_admin());

-- classes
CREATE POLICY "Gia sư quản lý lớp của mình" ON classes FOR ALL USING (tutor_id = requesting_user_id() OR is_admin());
CREATE POLICY "Học sinh xem lớp đã tham gia" ON classes FOR SELECT USING (is_member_of_class(id));

-- class_members
CREATE POLICY "Gia sư quản lý thành viên lớp" ON class_members FOR ALL USING (owns_class(class_id) OR is_admin());
CREATE POLICY "Học sinh xem thành viên lớp mình" ON class_members FOR SELECT USING (is_member_of_class(class_id));

-- courses / modules / lessons / lesson_contents
CREATE POLICY "Gia sư quản lý nội dung lớp mình" ON courses FOR ALL USING (owns_class(class_id) OR is_admin());
CREATE POLICY "Học sinh xem nội dung đã publish" ON courses FOR SELECT USING (is_member_of_class(class_id) AND status = 'PUBLISHED');

CREATE POLICY "Gia sư quản lý modules" ON modules FOR ALL USING (owns_class(class_id) OR is_admin());
CREATE POLICY "Học sinh xem modules" ON modules FOR SELECT USING (is_member_of_class(class_id));

CREATE POLICY "Gia sư quản lý lessons" ON lessons FOR ALL USING (owns_class(class_id) OR is_admin());
CREATE POLICY "Học sinh xem lessons đã publish" ON lessons FOR SELECT USING (is_member_of_class(class_id) AND status = 'PUBLISHED');

CREATE POLICY "Gia sư quản lý lesson_contents" ON lesson_contents FOR ALL USING (owns_class(class_id) OR is_admin());
CREATE POLICY "Học sinh xem lesson_contents" ON lesson_contents FOR SELECT USING (is_member_of_class(class_id));

-- video_progress
CREATE POLICY "Học sinh tự ghi tiến độ" ON video_progress FOR ALL USING (student_id = requesting_user_id());
CREATE POLICY "Gia sư xem tiến độ học sinh lớp mình" ON video_progress FOR SELECT USING (
  EXISTS (SELECT 1 FROM lesson_contents lc WHERE lc.id = content_id AND owns_class(lc.class_id))
);

-- assignments / assignment_submissions
CREATE POLICY "Gia sư quản lý assignment" ON assignments FOR ALL USING (owns_class(class_id) OR is_admin());
CREATE POLICY "Học sinh xem assignment" ON assignments FOR SELECT USING (is_member_of_class(class_id));

CREATE POLICY "Học sinh nộp & xem bài của mình" ON assignment_submissions FOR ALL USING (student_id = requesting_user_id());
CREATE POLICY "Gia sư xem bài nộp lớp mình" ON assignment_submissions FOR SELECT USING (
  EXISTS (SELECT 1 FROM assignments a WHERE a.id = assignment_id AND owns_class(a.class_id))
);
CREATE POLICY "Gia sư cập nhật điểm" ON assignment_submissions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM assignments a WHERE a.id = assignment_id AND owns_class(a.class_id))
);

-- questions & answer_options (Lưu ý: Học sinh KHÔNG được SELECT trực tiếp)
CREATE POLICY "Gia sư quản lý ngân hàng câu hỏi" ON questions FOR ALL USING (owns_class(class_id) OR is_admin());
CREATE POLICY "Gia sư quản lý đáp án" ON answer_options FOR ALL USING (
  EXISTS (SELECT 1 FROM questions q WHERE q.id = question_id AND (owns_class(q.class_id) OR is_admin()))
);

-- quizzes / quiz_questions
CREATE POLICY "Gia sư quản lý quiz" ON quizzes FOR ALL USING (owns_class(class_id) OR is_admin());
CREATE POLICY "Học sinh xem quiz đã publish" ON quizzes FOR SELECT USING (is_member_of_class(class_id) AND status = 'PUBLISHED');
CREATE POLICY "Gia sư quản lý quiz_questions" ON quiz_questions FOR ALL USING (
  EXISTS (SELECT 1 FROM quizzes qz WHERE qz.id = quiz_id AND owns_class(qz.class_id))
);

-- quiz_attempts / quiz_answers
CREATE POLICY "Học sinh quản lý lượt làm của mình" ON quiz_attempts FOR ALL USING (student_id = requesting_user_id());
CREATE POLICY "Gia sư xem lượt làm lớp mình" ON quiz_attempts FOR SELECT USING (
  EXISTS (SELECT 1 FROM quizzes qz WHERE qz.id = quiz_id AND owns_class(qz.class_id))
);
CREATE POLICY "Học sinh ghi câu trả lời của mình" ON quiz_answers FOR ALL USING (
  EXISTS (SELECT 1 FROM quiz_attempts qa WHERE qa.id = attempt_id AND qa.student_id = requesting_user_id())
);
CREATE POLICY "Gia sư xem câu trả lời lớp mình" ON quiz_answers FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM quiz_attempts qa JOIN quizzes qz ON qz.id = qa.quiz_id
    WHERE qa.id = attempt_id AND owns_class(qz.class_id)
  )
);

-- schedules / attendance
CREATE POLICY "Gia sư quản lý lịch dạy" ON schedules FOR ALL USING (owns_class(class_id) OR is_admin());
CREATE POLICY "Học sinh xem lịch lớp mình" ON schedules FOR SELECT USING (is_member_of_class(class_id));

CREATE POLICY "Gia sư quản lý điểm danh" ON attendance FOR ALL USING (owns_class(class_id) OR is_admin());
CREATE POLICY "Học sinh xem điểm danh của mình" ON attendance FOR SELECT USING (student_id = requesting_user_id());

-- tuition_plans / tuition_invoices
CREATE POLICY "Gia sư quản lý học phí lớp mình" ON tuition_plans FOR ALL USING (owns_class(class_id) OR is_admin());
CREATE POLICY "Gia sư quản lý hóa đơn lớp mình" ON tuition_invoices FOR ALL USING (owns_class(class_id) OR is_admin());
CREATE POLICY "Học sinh xem hóa đơn của mình" ON tuition_invoices FOR SELECT USING (student_id = requesting_user_id());

-- announcements / notifications
CREATE POLICY "Gia sư đăng thông báo lớp mình" ON announcements FOR ALL USING (owns_class(class_id) OR is_admin());
CREATE POLICY "Học sinh xem thông báo lớp mình" ON announcements FOR SELECT USING (is_member_of_class(class_id));

CREATE POLICY "User xem thông báo của mình" ON notifications FOR SELECT USING (user_id = requesting_user_id());
CREATE POLICY "User đánh dấu đã đọc" ON notifications FOR UPDATE USING (user_id = requesting_user_id());
