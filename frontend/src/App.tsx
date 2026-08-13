import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './auth/AuthContext';
import { can, firstAllowedRoute } from './lib/permissions';
import AppLayout from './pages/AppLayout';
import CandidatesPage from './pages/CandidatesPage';
import CandidateFormPage from './pages/CandidateFormPage';
import CandidateViewPage from './pages/CandidateViewPage';
import BaddegamaPublicFormPage from './pages/BaddegamaPublicFormPage';
import BaddegamaRegistrationsPage from './pages/BaddegamaRegistrationsPage';
import BaddegamaLocationsPage from './pages/BaddegamaLocationsPage';
import BaddegamaViewPage from './pages/BaddegamaViewPage';
import DashboardPage from './pages/DashboardPage';
import AgentsPage from './pages/AgentsPage';
import JobCategoriesPage from './pages/JobCategoriesPage';
import DemandsPage from './pages/DemandsPage';
import LocationsPage from './pages/LocationsPage';
import LoginPage from './pages/LoginPage';
import PermissionsPage from './pages/PermissionsPage';
import ProgressCheckPage from './pages/ProgressCheckPage';
import ReportsPage from './pages/ReportsPage';
import RolesPage from './pages/RolesPage';
import SectionAssignmentPage from './pages/SectionAssignmentPage';
import StaffPage from './pages/StaffPage';

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <LoginPage />;
}

/** Gate a page behind a specific permission; redirect elsewhere if not allowed. */
function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const { user } = useAuth();
  if (can(user, permission)) return <>{children}</>;
  const fallback = firstAllowedRoute(user);
  return <Navigate to={fallback ?? '/no-access'} replace />;
}

function NoAccess() {
  const { logout } = useAuth();
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        color: 'var(--muted)',
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 600 }}>No access</div>
      <div>Your role has no permissions assigned. Contact an administrator.</div>
      <button
        className="sr-btn-primary"
        onClick={() => logout()}
        style={{ padding: '10px 18px', borderRadius: 8 }}
      >
        Log Out
      </button>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/no-access" element={<NoAccess />} />
      <Route path="/progress" element={<ProgressCheckPage />} />
      <Route path="/baddegama-registration" element={<BaddegamaPublicFormPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route
          path="/dashboard"
          element={
            <RequirePermission permission="dashboard.view">
              <DashboardPage />
            </RequirePermission>
          }
        />
        <Route
          path="/candidates"
          element={
            <RequirePermission permission="candidates.view">
              <CandidatesPage />
            </RequirePermission>
          }
        />
        <Route
          path="/candidates/new"
          element={
            <RequirePermission permission="candidates.add">
              <CandidateFormPage />
            </RequirePermission>
          }
        />
        <Route
          path="/candidates/:id/view"
          element={
            <RequirePermission permission="candidates.view">
              <CandidateViewPage />
            </RequirePermission>
          }
        />
        <Route
          path="/candidates/:id"
          element={
            <RequirePermission permission="candidates.view">
              <CandidateFormPage />
            </RequirePermission>
          }
        />
        <Route
          path="/baddegama"
          element={
            <RequirePermission permission="baddegama.view">
              <BaddegamaRegistrationsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/baddegama/locations"
          element={
            <RequirePermission permission="baddegama.view">
              <BaddegamaLocationsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/baddegama/:id/view"
          element={
            <RequirePermission permission="baddegama.view">
              <BaddegamaViewPage />
            </RequirePermission>
          }
        />
        <Route
          path="/baddegama/:id"
          element={
            <RequirePermission permission="baddegama.edit">
              <BaddegamaViewPage />
            </RequirePermission>
          }
        />
        <Route
          path="/reports"
          element={
            <RequirePermission permission="candidates.view">
              <ReportsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/staff"
          element={
            <RequirePermission permission="staff.view">
              <StaffPage />
            </RequirePermission>
          }
        />
        <Route
          path="/section-assignments"
          element={
            <RequirePermission permission="sections.view">
              <SectionAssignmentPage />
            </RequirePermission>
          }
        />
        <Route
          path="/job-categories"
          element={
            <RequirePermission permission="staff.view">
              <JobCategoriesPage />
            </RequirePermission>
          }
        />
        <Route
          path="/demands"
          element={
            <RequirePermission permission="staff.view">
              <DemandsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/agents"
          element={
            <RequirePermission permission="staff.view">
              <AgentsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/locations"
          element={
            <RequirePermission permission="staff.view">
              <LocationsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/roles"
          element={
            <RequirePermission permission="roles.view">
              <RolesPage />
            </RequirePermission>
          }
        />
        <Route
          path="/permissions"
          element={
            <RequirePermission permission="permissions.view">
              <PermissionsPage />
            </RequirePermission>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
