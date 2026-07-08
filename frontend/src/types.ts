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
