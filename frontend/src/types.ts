export type StaffStatus = 'Active' | 'On Leave' | 'Inactive';

export interface Staff {
  id: number;
  name: string;
  role: string;
  department: string;
  status: StaffStatus;
  email: string;
}

export type StaffInput = Omit<Staff, 'id'> & { password?: string };

export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string;
  permissions: string[];
}

export interface Kpi {
  label: string;
  value: string;
  delta: string;
  tone: 'up' | 'down';
}

export interface TrendPoint {
  month: string;
  value: number;
}

export interface RegistrationsTrend {
  group: 'day' | 'month' | 'year';
  year: number;
  month: number;
  points: StageCount[];
  total: number;
  years: number[];
}

export interface DepartmentSlice {
  label: string;
  value: number;
}

export interface CountryPlacement {
  country: string;
  value: number;
}

export interface StageCount {
  label: string;
  value: number;
}

export interface DashboardData {
  totalStaff: number;
  kpis: Kpi[];
  stageCounts: StageCount[];
  monthlyTrend: TrendPoint[];
  departmentBreakdown: DepartmentSlice[];
  placementsByCountry: CountryPlacement[];
}

export interface CandidateSection {
  id: number;
  candidate_id: number;
  section_no: number;
  assigned_staff_id: number | null;
  assigned_staff_ids: number[];
  status: 'pending' | 'submitted';
  submitted_at: string | null;
}

export interface Candidate {
  id: number;
  registration_no: string;
  candidate_reg_no: string | null;
  full_name: string;
  address: string | null;
  nic: string | null;
  birth_date: string | null;
  gender: string | null;
  passport_retention: string | null;
  passport_collected_date: string | null;
  passport_number: string | null;
  passport_image: string | null;
  passport_image_url: string | null;
  passport_returned: string | null;
  passport_return_date: string | null;
  email: string | null;
  phone_number: string | null;
  whatsapp_number: string | null;
  province: string | null;
  district: string | null;
  ds_division: string | null;
  gn_division: string | null;
  staff_coordinator: string | null;
  agent: string | null;
  other_coordinator: boolean;
  other_coordinator_name: string | null;
  other_coordinator_mobile: string | null;
  country: 'Romania' | 'Israel' | null;
  candidate_skill: 'skill' | 'unskill' | 'training' | null;
  job_category_id: number | null;
  registration_date: string | null;
  current_section: number;
  is_completed: boolean;
  sections?: CandidateSection[];
}

export type TrainingMode = 'pre_test' | 'final_test' | 'both';
export type TestResult = 'pass' | 'fail' | null;

export interface AttendanceRecord {
  date: string;           // "2026-07-07"
  time: string | null;    // "17:46:16"
  source?: 'qr' | 'manual'; // how it was added
}

export interface PreTestCycle {
  cycle_no: number;
  attendance_records: AttendanceRecord[];
  test_date: string | null;
  test_result: TestResult;
  test_agent: string | null;
  /** Unique test number issued for this cycle (e.g. TI001). */
  test_number: string | null;
}

export interface CandidateTraining {
  id?: number;
  candidate_id?: number;
  training_mode: TrainingMode | null;
  training_bond_url?: string | null;
  pre_test_job_category_id: number | null;
  /** @deprecated Legacy single number — pre-test numbers are now per-cycle. */
  pre_test_number: string | null;
  pre_test_cycles: PreTestCycle[];
  final_test_attendance_records: AttendanceRecord[];
  final_test_date: string | null;
  final_test_result: TestResult;
  /** Unique test number issued for the final test (e.g. TI004). */
  final_test_number: string | null;
  final_test_agent: string | null;
}

/** A stored multi-file attachment entry. */
export interface CandidateDocumentFile {
  path: string;
  url: string;
}

/** A stored attachment entry that also records when it was uploaded. */
export interface CandidateDatedDocumentFile {
  path: string;
  url: string;
  uploaded_at: string | null;
}

/** Section 3 — Personal Details (Attachment). File fields expose a *_url from the API. */
export interface CandidateDocuments {
  id?: number;
  candidate_id?: number;
  passport_size_photo_url: string | null;
  nic_color_copy_url: string | null;
  passport_color_copy_url: string | null;
  professional_certificate_url: string | null;
  /** Service Letter — supports multiple files. */
  working_experience_files: CandidateDocumentFile[];
  cv_copy_url: string | null;
  /** Police Certificate — history of uploads with dates. */
  police_certificate_files: CandidateDatedDocumentFile[];
  /** Certified (Foreign Ministry) Police Report — history of uploads with dates. */
  certified_police_report_files: CandidateDatedDocumentFile[];
  /** Manually-entered Police Report expiry date. */
  police_report_expire_date: string | null;
  document_submission_date: string | null;
  document_resubmission_date: string | null;
}

/** Attachment file field keys (used for single-file uploads). */
export type CandidateDocumentFileField =
  | 'passport_size_photo'
  | 'nic_color_copy'
  | 'passport_color_copy'
  | 'professional_certificate'
  | 'cv_copy';

/** Dated multi-file attachment field keys (police reports). */
export type CandidateDatedFileField = 'police_certificate' | 'certified_police_report';

export type VisaStatus = 'visa_received' | 'visa_cancel';
export type PibaSubmissionStatus = 'submitted' | 'not_yet_submitted';

/** Section 4 — Job & Visa Processing. Fields are country-scoped in the UI. */
export interface CandidateVisaDetails {
  id?: number;
  candidate_id?: number;
  // Romania workflow dates
  offer_letter_date: string | null;
  confirmation_letter_date: string | null;
  document_submission_date: string | null;
  work_permit_received_date: string | null;
  embassy_submission_date: string | null;
  police_report_issued_date: string | null;
  process_interview_date: string | null;
  visa_received_date: string | null;
  // Israel workflow dates
  agreement_sign_date: string | null;
  police_report_date: string | null;
  // Common (both countries)
  visa_status: VisaStatus | null;
  visa_status_date: string | null;
  piba_submission_status: PibaSubmissionStatus | null;
}

/** A job category (master data managed on its own page, used in Section 5). */
export interface JobCategory {
  id: number;
  name: string;
  /** Short trade code used as the Pre-Test number prefix (e.g. TI, SC, BB). */
  code: string | null;
}

/** A demand / job order (master data managed on its own page). */
export interface Demand {
  id: number;
  name: string;
}

/** An agent (master data managed on its own page, selected on the candidate form). */
export interface Agent {
  id: number;
  name: string;
  phone: string | null;
}

/** Section 3 — Employee Details. */
export interface CandidateEmployeeDetails {
  id?: number;
  candidate_id?: number;
  /** Defaults to the candidate reg no on the server but editable locally. */
  registration_number: string | null;
  job_category_id: number | null;
  demand_id: number | null;
}

/** Demand-wise status breakdown for the dashboard bar chart. */
export interface DemandStatus {
  departed: number;
  pending: number;
  canceled: number;
  total: number;
}

/** Section 6 — Departure Details. */
export interface CandidateDepartureDetails {
  id?: number;
  candidate_id?: number;
  final_approval_date: string | null;
  receipt_number: string | null;
  flight_number: string | null;
  airticket_number: string | null;
  departure_date: string | null;
}

export interface Role {
  id: number;
  name: string;
}

export interface PermissionUser {
  id: number;
  name: string;
  role: string;
}

export interface PermissionRow {
  id: number;
  module: string;
  action: string;
  /** Staff ids that hold this permission. */
  allowed: number[];
}

export interface PermissionMatrix {
  users: PermissionUser[];
  modules: string[];
  actions: string[];
  permissions: PermissionRow[];
}

// ── Accounting — Chart of Accounts / General Ledger backbone ──────────────

export type NormalBalance = 'debit' | 'credit';
export type StatementType = 'BS' | 'PNL';

export interface AccountCategory {
  id: number;
  code: string;
  name: string;
  normal_balance: NormalBalance;
  statement_type: StatementType;
  groups_count?: number;
}

export interface AccountGroup {
  id: number;
  category_id: number;
  code: string;
  name: string;
  accounts_count?: number;
  category?: AccountCategory;
}

/** A group nested with only the fields a dropdown needs. */
export interface ChartCategory extends AccountCategory {
  groups: AccountGroup[];
}

/** A row of the flat Chart of Accounts list (joined up to group + category). */
export interface AccountRow {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
  is_default: boolean;
  created_by: string;
  group_id: number;
  group_name: string;
  group_code: string;
  category_id: number;
  category_name: string;
  type: StatementType;
}

export interface JournalLine {
  id?: number;
  entry_id?: number;
  account_id: number;
  debit: string | number;
  credit: string | number;
  memo: string | null;
  account_code?: string;
  account_name?: string;
}

export interface JournalEntry {
  id: number;
  entry_date: string;
  posting_date: string | null;
  reference: string | null;
  currency: string;
  branch: string | null;
  memo: string | null;
  created_at: string;
  lines: JournalLine[];
}

/** One editable row in the Manual Journal Entry grid. */
export interface JournalDraftLine {
  account_id: number | '';
  dr_cr: 'debit' | 'credit' | '';
  amount: string;
  memo: string;
}

export interface LedgerLine {
  entry_id: number;
  doc_no: string;
  date: string;
  reference: string | null;
  memo: string | null;
  debit: number;
  credit: number;
  balance: number;
}

export interface GeneralLedger {
  account: { id: number; code: string; name: string; normal_balance: NormalBalance };
  opening_balance: number;
  lines: LedgerLine[];
  total_debit: number;
  total_credit: number;
  closing_balance: number;
}

export interface TrialBalanceRow {
  code: string;
  name: string;
  debit: number;
  credit: number;
}

export interface TrialBalance {
  from: string | null;
  to: string | null;
  rows: TrialBalanceRow[];
  total_debit: number;
  total_credit: number;
  balanced: boolean;
}

// ── Procurement master files (Stage 01, under Accounting) ─────────────────

export interface Department {
  id: number;
  name: string;
  status: 'Active' | 'Inactive';
}

export interface Supplier {
  id: number;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: 'Active' | 'Inactive';
}

export interface ItemCategory {
  id: number;
  name: string;
  description: string | null;
}

export interface BankBranch {
  id: number;
  bank_id: number;
  name: string;
  branch_code: string | null;
}

export interface Bank {
  id: number;
  name: string;
  branches: BankBranch[];
}

// ── Purchase Requisition (PR) ─────────────────────────────────────────────

export type PrStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected' | 'Converted to PO';
export type PrPriority = 'Normal' | 'Urgent' | 'Critical';

export interface PrItem {
  id?: number;
  pr_id?: number;
  description: string;
  category_id: number | null;
  quantity: string | number;
  uom: string | null;
  est_unit_price: string | number;
  est_total?: string | number;
  preferred_supplier_id: number | null;
  remarks: string | null;
}

/** A row of the PR list. */
export interface PurchaseRequisitionRow {
  id: number;
  pr_number: string;
  pr_date: string;
  requested_by: string | null;
  department_id: number | null;
  department_name: string | null;
  priority: PrPriority;
  required_date: string | null;
  status: PrStatus;
  item_count: number;
  total_estimated: number;
}

/** Full PR with its lines. */
export interface PurchaseRequisition {
  id: number;
  pr_number: string;
  pr_date: string;
  requested_by: string | null;
  department_id: number | null;
  priority: PrPriority;
  required_date: string | null;
  purpose: string | null;
  budget_account_id: number | null;
  status: PrStatus;
  items: PrItem[];
}

/** One editable line in the PR form. */
export interface PrDraftLine {
  description: string;
  category_id: number | '';
  quantity: string;
  uom: string;
  est_unit_price: string;
  preferred_supplier_id: number | '';
  remarks: string;
}

// ── Purchase Order (PO) ───────────────────────────────────────────────────

export type PoStatus =
  | 'Draft' | 'Pending Approval' | 'Approved' | 'Sent to Supplier'
  | 'Partially Received' | 'Fully Received' | 'Closed' | 'Cancelled';

export interface PoItem {
  id?: number;
  po_id?: number;
  description: string;
  category_id: number | null;
  quantity_ordered: string | number;
  uom: string | null;
  unit_price: string | number;
  discount_pct: string | number;
  tax_pct: string | number;
  line_total: string | number;
  quantity_received: string | number;
  quantity_pending: number;
}

export interface PurchaseOrderRow {
  id: number;
  po_number: string;
  po_date: string;
  supplier_id: number | null;
  supplier_name: string | null;
  currency: string;
  status: PoStatus;
  item_count: number;
  total: number;
}

export interface PurchaseOrder {
  id: number;
  po_number: string;
  po_date: string;
  supplier_id: number | null;
  delivery_address: string | null;
  payment_terms: string | null;
  currency: string;
  expected_delivery_date: string | null;
  source_pr_ids: number[] | null;
  status: PoStatus;
  items: PoItem[];
}

export interface PoDraftLine {
  description: string;
  category_id: number | '';
  quantity_ordered: string;
  uom: string;
  unit_price: string;
  discount_pct: string;
  tax_pct: string;
}

// ── Goods Received Note (GRN) ─────────────────────────────────────────────

export type GrnStatus = 'Draft' | 'Confirmed' | 'Partially Matched' | 'Fully Matched';

export interface GrnItem {
  id?: number;
  grn_id?: number;
  po_item_id: number | null;
  description: string;
  quantity_ordered: string | number;
  quantity_received: string | number;
  quantity_accepted: string | number;
  quantity_rejected: string | number;
  rejection_reason: string | null;
  batch_serial_no: string | null;
  condition: string | null;
  remarks: string | null;
}

export interface GrnRow {
  id: number;
  grn_number: string;
  grn_date: string;
  po_id: number;
  po_number: string | null;
  supplier_name: string | null;
  status: GrnStatus;
  item_count: number;
}

export interface GoodsReceivedNote {
  id: number;
  grn_number: string;
  grn_date: string;
  po_id: number;
  supplier_id: number | null;
  delivery_note_no: string | null;
  received_by: string | null;
  warehouse: string | null;
  status: GrnStatus;
  items: GrnItem[];
}

export interface GrnDraftLine {
  po_item_id: number | null;
  description: string;
  quantity_ordered: number;
  quantity_pending: number;
  quantity_received: string;
  quantity_accepted: string;
  quantity_rejected: string;
  rejection_reason: string;
  batch_serial_no: string;
  condition: string;
  remarks: string;
}

// ── Supplier Payment / Invoice (+ 3-way matching) ─────────────────────────

export type InvoiceStatus = 'Draft' | 'Pending Matching' | 'Matched' | 'Disputed' | 'Approved for Payment' | 'Paid';

export interface SupplierInvoiceItem {
  id?: number;
  invoice_id?: number;
  po_item_id: number | null;
  description: string;
  quantity_invoiced: string | number;
  unit_price: string | number;
  tax_pct: string | number;
  line_total: string | number;
}

export interface SupplierInvoiceRow {
  id: number;
  internal_ref_no: string;
  supplier_invoice_no: string | null;
  invoice_date: string;
  due_date: string | null;
  po_id: number | null;
  po_number: string | null;
  supplier_name: string | null;
  currency: string;
  status: InvoiceStatus;
  total: number;
}

export interface SupplierInvoice {
  id: number;
  internal_ref_no: string;
  supplier_invoice_no: string | null;
  invoice_date: string;
  po_id: number | null;
  grn_ids: number[] | null;
  supplier_id: number | null;
  due_date: string | null;
  currency: string;
  attached_document: string | null;
  status: InvoiceStatus;
  items: SupplierInvoiceItem[];
}

export interface InvoiceDraftLine {
  po_item_id: number | null;
  description: string;
  quantity_invoiced: string;
  unit_price: string;
  tax_pct: string;
}

export interface MatchingRow {
  description: string;
  ordered_qty: number | null;
  received_qty: number | null;
  invoiced_qty: number;
  qty_status: string;
  agreed_price: number | null;
  billed_price: number | null;
  price_status: string;
  po_total: number | null;
  invoice_total: number;
  total_status: string;
}

export interface MatchingResult {
  rows: MatchingRow[];
  matched: boolean;
}
