import { Navigate, Route, Routes } from 'react-router-dom';
import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './auth/AuthContext';
import { can, firstAllowedRoute } from './lib/permissions';
import AppLayout from './pages/AppLayout';

/**
 * Load a page's code only when it is first opened (keeps the initial download
 * small). After a new deploy the old chunk files are gone, so if a chunk fails
 * to load we reload the page once to pick up the fresh build.
 */
function lazyPage<T extends ComponentType<object>>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load().then(
      (mod) => {
        try {
          sessionStorage.removeItem('sr_chunk_reload');
        } catch {
          /* storage unavailable */
        }
        return mod;
      },
      (err) => {
        let reloaded = false;
        try {
          reloaded = sessionStorage.getItem('sr_chunk_reload') === '1';
          if (!reloaded) sessionStorage.setItem('sr_chunk_reload', '1');
        } catch {
          reloaded = true;
        }
        if (!reloaded) {
          window.location.reload();
          return new Promise<never>(() => {});
        }
        throw err;
      },
    ),
  );
}
const ChartOfAccountsPage = lazyPage(() => import('./pages/ChartOfAccountsPage'));
const AccountGroupsPage = lazyPage(() => import('./pages/AccountGroupsPage'));
const FinancialYearPage = lazyPage(() => import('./pages/FinancialYearPage'));
const JournalEntriesPage = lazyPage(() => import('./pages/JournalEntriesPage'));
const ManualJournalEntryPage = lazyPage(() => import('./pages/ManualJournalEntryPage'));
const GeneralLedgerPage = lazyPage(() => import('./pages/GeneralLedgerPage'));
const TrialBalancePage = lazyPage(() => import('./pages/TrialBalancePage'));
const SalesInvoicesPage = lazyPage(() => import('./pages/SalesInvoicesPage'));
const SalesInvoiceFormPage = lazyPage(() => import('./pages/SalesInvoiceFormPage'));
const DepartmentsPage = lazyPage(() => import('./pages/DepartmentsPage'));
const SuppliersPage = lazyPage(() => import('./pages/SuppliersPage'));
const ItemCategoriesPage = lazyPage(() => import('./pages/ItemCategoriesPage'));
const ItemsPage = lazyPage(() => import('./pages/ItemsPage'));
const BanksPage = lazyPage(() => import('./pages/BanksPage'));
const PurchaseRequisitionsPage = lazyPage(() => import('./pages/PurchaseRequisitionsPage'));
const PurchaseRequisitionFormPage = lazyPage(() => import('./pages/PurchaseRequisitionFormPage'));
const PurchaseOrdersPage = lazyPage(() => import('./pages/PurchaseOrdersPage'));
const PurchaseOrderFormPage = lazyPage(() => import('./pages/PurchaseOrderFormPage'));
const GoodsReceivedNotesPage = lazyPage(() => import('./pages/GoodsReceivedNotesPage'));
const GoodsReceivedNoteFormPage = lazyPage(() => import('./pages/GoodsReceivedNoteFormPage'));
const SupplierInvoicesPage = lazyPage(() => import('./pages/SupplierInvoicesPage'));
const SupplierInvoiceFormPage = lazyPage(() => import('./pages/SupplierInvoiceFormPage'));
const CandidatesPage = lazyPage(() => import('./pages/CandidatesPage'));
const CandidateFormPage = lazyPage(() => import('./pages/CandidateFormPage'));
const CandidateViewPage = lazyPage(() => import('./pages/CandidateViewPage'));
const BaddegamaPublicFormPage = lazyPage(() => import('./pages/BaddegamaPublicFormPage'));
const BaddegamaRegistrationsPage = lazyPage(() => import('./pages/BaddegamaRegistrationsPage'));
const BaddegamaLocationsPage = lazyPage(() => import('./pages/BaddegamaLocationsPage'));
const BaddegamaViewPage = lazyPage(() => import('./pages/BaddegamaViewPage'));
const DashboardPage = lazyPage(() => import('./pages/DashboardPage'));
const AgentsPage = lazyPage(() => import('./pages/AgentsPage'));
const JobCategoriesPage = lazyPage(() => import('./pages/JobCategoriesPage'));
const DemandsPage = lazyPage(() => import('./pages/DemandsPage'));
const LocationsPage = lazyPage(() => import('./pages/LocationsPage'));
import LoginPage from './pages/LoginPage';
const PermissionsPage = lazyPage(() => import('./pages/PermissionsPage'));
const ProgressCheckPage = lazyPage(() => import('./pages/ProgressCheckPage'));
const ReportsPage = lazyPage(() => import('./pages/ReportsPage'));
const RolesPage = lazyPage(() => import('./pages/RolesPage'));
const SectionAssignmentPage = lazyPage(() => import('./pages/SectionAssignmentPage'));
const StaffPage = lazyPage(() => import('./pages/StaffPage'));

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
    <Suspense fallback={null}>
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
          path="/accounting/financial-year"
          element={
            <RequirePermission permission="accounting.view">
              <FinancialYearPage />
            </RequirePermission>
          }
        />
        <Route
          path="/accounting/accounts"
          element={
            <RequirePermission permission="accounting.view">
              <ChartOfAccountsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/accounting/groups"
          element={
            <RequirePermission permission="accounting.view">
              <AccountGroupsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/accounting/journal"
          element={
            <RequirePermission permission="accounting.view">
              <JournalEntriesPage />
            </RequirePermission>
          }
        />
        <Route
          path="/accounting/journal/new"
          element={
            <RequirePermission permission="accounting.add">
              <ManualJournalEntryPage />
            </RequirePermission>
          }
        />
        <Route
          path="/accounting/ledger"
          element={
            <RequirePermission permission="accounting.view">
              <GeneralLedgerPage />
            </RequirePermission>
          }
        />
        <Route
          path="/accounting/trial-balance"
          element={
            <RequirePermission permission="accounting.view">
              <TrialBalancePage />
            </RequirePermission>
          }
        />
        <Route
          path="/accounting/sales-invoices"
          element={
            <RequirePermission permission="accounting.view">
              <SalesInvoicesPage />
            </RequirePermission>
          }
        />
        <Route
          path="/accounting/sales-invoices/new"
          element={
            <RequirePermission permission="accounting.view">
              <SalesInvoiceFormPage />
            </RequirePermission>
          }
        />
        <Route
          path="/accounting/sales-invoices/:id"
          element={
            <RequirePermission permission="accounting.view">
              <SalesInvoiceFormPage />
            </RequirePermission>
          }
        />

        <Route
          path="/accounting/departments"
          element={
            <RequirePermission permission="accounting.view">
              <DepartmentsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/accounting/suppliers"
          element={
            <RequirePermission permission="accounting.view">
              <SuppliersPage />
            </RequirePermission>
          }
        />
        <Route
          path="/accounting/item-categories"
          element={
            <RequirePermission permission="accounting.view">
              <ItemCategoriesPage />
            </RequirePermission>
          }
        />
        <Route
          path="/accounting/items"
          element={
            <RequirePermission permission="accounting.view">
              <ItemsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/accounting/banks"
          element={
            <RequirePermission permission="accounting.view">
              <BanksPage />
            </RequirePermission>
          }
        />
        <Route
          path="/accounting/pr"
          element={
            <RequirePermission permission="accounting.view">
              <PurchaseRequisitionsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/accounting/pr/new"
          element={
            <RequirePermission permission="accounting.add">
              <PurchaseRequisitionFormPage />
            </RequirePermission>
          }
        />
        <Route
          path="/accounting/pr/:id"
          element={
            <RequirePermission permission="accounting.view">
              <PurchaseRequisitionFormPage />
            </RequirePermission>
          }
        />
        <Route
          path="/accounting/po"
          element={
            <RequirePermission permission="accounting.view">
              <PurchaseOrdersPage />
            </RequirePermission>
          }
        />
        <Route
          path="/accounting/po/new"
          element={
            <RequirePermission permission="accounting.add">
              <PurchaseOrderFormPage />
            </RequirePermission>
          }
        />
        <Route
          path="/accounting/po/:id"
          element={
            <RequirePermission permission="accounting.view">
              <PurchaseOrderFormPage />
            </RequirePermission>
          }
        />
        <Route
          path="/accounting/grn"
          element={
            <RequirePermission permission="accounting.view">
              <GoodsReceivedNotesPage />
            </RequirePermission>
          }
        />
        <Route
          path="/accounting/grn/new"
          element={
            <RequirePermission permission="accounting.add">
              <GoodsReceivedNoteFormPage />
            </RequirePermission>
          }
        />
        <Route
          path="/accounting/grn/:id"
          element={
            <RequirePermission permission="accounting.view">
              <GoodsReceivedNoteFormPage />
            </RequirePermission>
          }
        />
        <Route
          path="/accounting/payment"
          element={
            <RequirePermission permission="accounting.view">
              <SupplierInvoicesPage />
            </RequirePermission>
          }
        />
        <Route
          path="/accounting/payment/new"
          element={
            <RequirePermission permission="accounting.add">
              <SupplierInvoiceFormPage />
            </RequirePermission>
          }
        />
        <Route
          path="/accounting/payment/:id"
          element={
            <RequirePermission permission="accounting.view">
              <SupplierInvoiceFormPage />
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
    </Suspense>
  );
}
