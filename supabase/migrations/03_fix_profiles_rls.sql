-- ==============================================================================
-- MIGRATION: 03_fix_profiles_rls.sql
-- Description: Khắc phục lỗi Tutor không xem được tên học sinh ở Hồ sơ học sinh
-- và Bảng Điểm Danh (Schedule & Class Members).
-- 
-- Nguyên nhân:
-- Policy cũ chỉ cho phép "id = requesting_user_id() OR is_admin()", khiến Gia sư
-- (role 'tutor') không có quyền SELECT profile của học sinh trong lớp mình quản lý,
-- dẫn đến PostgREST trả về `profiles: null`, hiển thị rỗng hoặc fallback thành 'Học sinh'.
-- ==============================================================================

-- 1. Xóa các policy SELECT cũ trên bảng profiles
DROP POLICY IF EXISTS "Xem hồ sơ của chính mình hoặc admin xem tất cả" ON profiles;
DROP POLICY IF EXISTS "Xem hồ sơ của chính mình" ON profiles;
DROP POLICY IF EXISTS "Cho phép người dùng đã xác thực xem hồ sơ" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON profiles;

-- 2. Cho phép mọi người dùng đã đăng nhập (requesting_user_id() IS NOT NULL) có thể xem thông tin hồ sơ
-- (Họ tên, SĐT, avatar, vai trò) để phục vụ hiển thị trong lớp học, điểm danh, sổ học phí và bài tập.
CREATE POLICY "Cho phép người dùng đã xác thực xem hồ sơ" ON profiles
  FOR SELECT
  USING (requesting_user_id() IS NOT NULL);
