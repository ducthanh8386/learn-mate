import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { LandingPage } from '../pages/LandingPage';
import { TeacherDashboard } from '../pages/teacher/TeacherDashboard';
import { TeacherClasses } from '../pages/teacher/TeacherClasses';
import { TeacherStudents } from '../pages/teacher/TeacherStudents';
import { TeacherCourses } from '../pages/teacher/TeacherCourses';
import { CourseDetail } from '../pages/teacher/CourseDetail';
import { TeacherQuizzes } from '../pages/teacher/TeacherQuizzes';
import { TeacherAssignments } from '../pages/teacher/TeacherAssignments';
import { TeacherSchedules } from '../pages/teacher/TeacherSchedules';
import { TeacherTuition } from '../pages/teacher/TeacherTuition';
import { StudentDashboard } from '../pages/student/StudentDashboard';
import { StudentClasses } from '../pages/student/StudentClasses';
import { StudentCourseView } from '../pages/student/StudentCourseView';
import { StudentAssignments } from '../pages/student/StudentAssignments';
import { StudentQuizTake } from '../pages/student/StudentQuizTake';
import { StudentSchedules } from '../pages/student/StudentSchedules';
import { StudentTuition } from '../pages/student/StudentTuition';
import { AdminDashboard } from '../pages/admin/AdminDashboard';
import { AdminApplications } from '../pages/admin/AdminApplications';
import { AdminUsers } from '../pages/admin/AdminUsers';

export const AppRouter = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

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
  );
};
