import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthenticateWithRedirectCallback } from '@clerk/clerk-react';
import { AppLayout } from '../components/layout/AppLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { PageLoadingFallback } from '../components/common';

// Lazy-loaded Pages (Route-based Code Splitting)
const LandingPage = lazy(() => import('../pages/LandingPage').then((m) => ({ default: m.LandingPage })));
const AuthPage = lazy(() => import('../pages/auth/AuthPage').then((m) => ({ default: m.AuthPage })));

// Teacher Pages
const TeacherDashboard = lazy(() => import('../pages/teacher/TeacherDashboard').then((m) => ({ default: m.TeacherDashboard })));
const TeacherClasses = lazy(() => import('../pages/teacher/TeacherClasses').then((m) => ({ default: m.TeacherClasses })));
const TeacherStudents = lazy(() => import('../pages/teacher/TeacherStudents').then((m) => ({ default: m.TeacherStudents })));
const TeacherCourses = lazy(() => import('../pages/teacher/TeacherCourses').then((m) => ({ default: m.TeacherCourses })));
const CourseDetail = lazy(() => import('../pages/teacher/CourseDetail').then((m) => ({ default: m.CourseDetail })));
const TeacherQuizzes = lazy(() => import('../pages/teacher/TeacherQuizzes').then((m) => ({ default: m.TeacherQuizzes })));
const TeacherAssignments = lazy(() => import('../pages/teacher/TeacherAssignments').then((m) => ({ default: m.TeacherAssignments })));
const TeacherSchedules = lazy(() => import('../pages/teacher/TeacherSchedules').then((m) => ({ default: m.TeacherSchedules })));
const TeacherTuition = lazy(() => import('../pages/teacher/TeacherTuition').then((m) => ({ default: m.TeacherTuition })));

// Student Pages
const StudentDashboard = lazy(() => import('../pages/student/StudentDashboard').then((m) => ({ default: m.StudentDashboard })));
const StudentClasses = lazy(() => import('../pages/student/StudentClasses').then((m) => ({ default: m.StudentClasses })));
const StudentCourseView = lazy(() => import('../pages/student/StudentCourseView').then((m) => ({ default: m.StudentCourseView })));
const StudentAssignments = lazy(() => import('../pages/student/StudentAssignments').then((m) => ({ default: m.StudentAssignments })));
const StudentQuizTake = lazy(() => import('../pages/student/StudentQuizTake').then((m) => ({ default: m.StudentQuizTake })));
const StudentSchedules = lazy(() => import('../pages/student/StudentSchedules').then((m) => ({ default: m.StudentSchedules })));
const StudentTuition = lazy(() => import('../pages/student/StudentTuition').then((m) => ({ default: m.StudentTuition })));

// Admin Pages
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const AdminApplications = lazy(() => import('../pages/admin/AdminApplications').then((m) => ({ default: m.AdminApplications })));
const AdminUsers = lazy(() => import('../pages/admin/AdminUsers').then((m) => ({ default: m.AdminUsers })));

export const AppRouter = () => {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/sso-callback" element={<AuthenticateWithRedirectCallback />} />

        {/* Admin routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="applications" element={<AdminApplications />} />
          <Route path="users" element={<AdminUsers />} />
        </Route>

        {/* Teacher / Tutor routes */}
        <Route
          path="/teacher"
          element={
            <ProtectedRoute allowedRoles={['tutor', 'admin']}>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/teacher/dashboard" replace />} />
          <Route path="dashboard" element={<TeacherDashboard />} />
          <Route path="classes" element={<TeacherClasses />} />
          <Route path="students" element={<TeacherStudents />} />
          <Route path="courses" element={<TeacherCourses />} />
          <Route path="courses/:courseId" element={<CourseDetail />} />
          <Route path="quizzes" element={<TeacherQuizzes />} />
          <Route path="assignments" element={<TeacherAssignments />} />
          <Route path="schedules" element={<TeacherSchedules />} />
          <Route path="tuition" element={<TeacherTuition />} />
        </Route>

        {/* Student routes */}
        <Route
          path="/student"
          element={
            <ProtectedRoute allowedRoles={['student', 'tutor', 'admin']}>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/student/dashboard" replace />} />
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="classes" element={<StudentClasses />} />
          <Route path="courses/:courseId" element={<StudentCourseView />} />
          <Route path="assignments" element={<StudentAssignments />} />
          <Route path="quizzes/:quizId" element={<StudentQuizTake />} />
          <Route path="schedules" element={<StudentSchedules />} />
          <Route path="tuition" element={<StudentTuition />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

