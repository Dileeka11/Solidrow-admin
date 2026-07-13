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

export interface DepartmentSlice {
  label: string;
  value: number;
}

export interface CountryPlacement {
  country: string;
  value: number;
}

export interface DashboardData {
  totalStaff: number;
  kpis: Kpi[];
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
}

export interface CandidateTraining {
  id?: number;
  candidate_id?: number;
  training_mode: TrainingMode | null;
  training_bond_url?: string | null;
  pre_test_cycles: PreTestCycle[];
  final_test_attendance_records: AttendanceRecord[];
  final_test_date: string | null;
  final_test_result: TestResult;
}

/** Section 3 — Personal Details (Attachment). File fields expose a *_url from the API. */
export interface CandidateDocuments {
  id?: number;
  candidate_id?: number;
  passport_size_photo_url: string | null;
  nic_color_copy_url: string | null;
  passport_color_copy_url: string | null;
  professional_certificate_url: string | null;
  working_experience_url: string | null;
  cv_copy_url: string | null;
  local_pcc_url: string | null;
  second_pcc_color_copy_url: string | null;
  local_pcc_attach_date: string | null;
  second_pcc_submit_date: string | null;
  document_submission_date: string | null;
}

/** Attachment file field keys (used for uploads). */
export type CandidateDocumentFileField =
  | 'passport_size_photo'
  | 'nic_color_copy'
  | 'passport_color_copy'
  | 'professional_certificate'
  | 'working_experience'
  | 'cv_copy'
  | 'local_pcc'
  | 'second_pcc_color_copy';

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
}

/** Section 5 — Employee Details. */
export interface CandidateEmployeeDetails {
  id?: number;
  candidate_id?: number;
  /** Defaults to the candidate reg no on the server but editable locally. */
  registration_number: string | null;
  job_category_id: number | null;
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
