import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import solidrowLogo from '../assets/solidrow-foreign-employment.png';
import passportCardFront from '../assets/passport-card-front.png';
import passportCardBack from '../assets/passport-card-back.png';
import passportSticker from '../assets/passport-sticker.png';
import { api } from '../api/client';
import { DatePicker } from '../components/DatePicker';
import { confirmAction, toastError, toastSuccess } from '../lib/alerts';
import { useAuth } from '../auth/AuthContext';
import { useIsMobile } from '../lib/useMediaQuery';
import type { Candidate, CandidateDatedFileField, CandidateDepartureDetails, CandidateDocumentFileField, CandidateDocuments, CandidateEmployeeDetails, CandidateSection, CandidateTraining, CandidateVisaDetails, JobCategory, PibaSubmissionStatus, PreTestCycle, Staff, VisaStatus } from '../types';

const SECTION_TITLES = [
  'Personal Details',
  'Training Details',
  'Document Attachment',
  'Job & Visa Processing',
  'Departure Details',
  'Employee Details',
];

const COUNTRY_LETTER: Record<string, string> = { Romania: 'R', Israel: 'I' };

/**
 * For "training" candidates the Pre Test unlocks only after 80% attendance of the
 * first 7 days (0.8 × 7 = 5.6 → at least 6 days). "skill"/"unskill" candidates are
 * already qualified, so both Pre Test and Final Test stay open with no gate.
 */
const PRE_TEST_WINDOW_DAYS = 7;
const PRE_TEST_MIN_ATTENDANCE = Math.ceil(PRE_TEST_WINDOW_DAYS * 0.8); // 6

/** Default profile placeholder shown when no passport photo is uploaded yet. */
const DEFAULT_PROFILE_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="112" height="144" viewBox="0 0 112 144">' +
      '<rect width="112" height="144" fill="#e5e7eb"/>' +
      '<circle cx="56" cy="54" r="26" fill="#9ca3af"/>' +
      '<path d="M16 132c0-24 18-40 40-40s40 16 40 40z" fill="#9ca3af"/>' +
      '</svg>',
  );

/**
 * Derive birth date + gender from a Sri Lankan NIC.
 * Old format: 9 digits + letter (V/X) → 2-digit year + 3-digit day-of-year.
 * New format: 12 digits → 4-digit year + 3-digit day-of-year.
 * Day-of-year > 500 means female (subtract 500). Returns null if not derivable yet.
 */
function nicToBirth(nicRaw: string): { birthDate: string; gender: 'Male' | 'Female' } | null {
  const nic = nicRaw.trim().toUpperCase();
  let year: number;
  let days: number;

  if (/^\d{9}V$/.test(nic)) {
    year = 1900 + parseInt(nic.slice(0, 2), 10);
    days = parseInt(nic.slice(2, 5), 10);
  } else if (/^\d{12}$/.test(nic)) {
    year = parseInt(nic.slice(0, 4), 10);
    days = parseInt(nic.slice(4, 7), 10);
  } else {
    return null; // incomplete / not a recognised NIC yet
  }

  const gender: 'Male' | 'Female' = days > 500 ? 'Female' : 'Male';
  if (days > 500) days -= 500;
  if (days < 1 || days > 366) return null;

  // Day-of-year table (NIC encoding always reserves Feb 29).
  const monthDays = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let month = 0;
  let day = days;
  for (let i = 0; i < 12; i++) {
    if (day <= monthDays[i]) {
      month = i + 1;
      break;
    }
    day -= monthDays[i];
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  return { birthDate: `${year}/${pad(month)}/${pad(day)}`, gender };
}

/**
 * Validate a Sri Lankan NIC. Returns an error message (Sinhala) when invalid,
 * or null when the field is empty or a valid NIC. Allowed formats:
 *   - Old: 9 digits + V  (e.g. 123456789V)
 *   - New: 12 digits     (e.g. 200012345678)
 */
function nicError(nicRaw: string): string | null {
  const nic = nicRaw.trim().toUpperCase();
  if (!nic) return null; // empty is allowed (optional field)

  // Only digits and a trailing V are ever valid characters.
  if (/[^0-9V]/.test(nic) || /V/.test(nic.slice(0, -1))) {
    return 'NIC එකේ අංක සහ (පැරණි ආකෘතියේ) අවසාන V අකුර පමණක් තිබිය යුතුයි.';
  }

  const digits = nic.replace(/V/g, '');
  const hasLetter = /V$/.test(nic);

  if (hasLetter) {
    if (digits.length !== 9) {
      return `පැරණි ආකෘතියේ NIC එකේ ඉලක්කම් 9ක් තිබිය යුතුයි (දැන් ${digits.length}ක් ඇත).`;
    }
  } else if (digits.length !== 12) {
    return `NIC එකේ ඉලක්කම් 12ක් හෝ ඉලක්කම් 9ක් + V තිබිය යුතුයි (දැන් ${digits.length}ක් ඇත).`;
  }

  // Structurally the right length but the encoded date is out of range.
  if (!nicToBirth(nic)) {
    return 'NIC අංකය වලංගු නොවේ. නැවත පරීක්ෂා කරන්න.';
  }
  return null;
}

/**
 * Validate a Sri Lankan mobile number. Returns a Sinhala error message when
 * invalid, or null when acceptable. When `required` is false an empty value is
 * allowed; otherwise a blank value is reported as required.
 */
function phoneError(raw: string, required = false): string | null {
  const value = raw.trim();

  if (!value) {
    return required ? 'දුරකථන අංකය ඇතුළත් කිරීම අනිවාර්ය වේ.' : null;
  }
  // Anything other than the digits 0-9 (letters, spaces, symbols, +, -).
  if (/[^0-9]/.test(value)) {
    return 'දුරකථන අංකය සඳහා භාවිතා කළ හැක්කේ ඉලක්කම් (0-9) පමණි.';
  }
  if (value.length !== 10) {
    return 'කරුණාකර වලංගු දුරකථන අංකයක් ඇතුළත් කරන්න (අංක 10ක් තිබිය යුතුය).';
  }
  if (!value.startsWith('07')) {
    return 'ඇතුළත් කළ දුරකථන අංකයේ ආකෘතිය (Format) වැරදියි. කරුණාකර නිවැරදි අංකයක් ඇතුළත් කරන්න.';
  }
  return null;
}

/**
 * Validate a passport number. Must start with a single English letter (e.g. N)
 * followed by 6-8 digits. Returns a Sinhala error message when invalid, or null
 * when empty or valid. The value is expected to already be upper-cased.
 */
function passportError(raw: string): string | null {
  const value = raw.trim().toUpperCase();
  if (!value) return null; // empty allowed

  if (!/^[A-Z]/.test(value)) {
    return 'Passport අංකය ආරම්භ විය යුත්තේ ඉංග්‍රීසි අකුරකින් (උදා: N) ය.';
  }
  if (!/^[A-Z][0-9]{6,8}$/.test(value)) {
    return 'Passport අංකයේ ආකෘතිය වැරදියි. ඉංග්‍රීසි අකුර 1ක් + ඉලක්කම් 7ක් තිබිය යුතුය (උදා: N1234567).';
  }
  return null;
}

interface Loc {
  id: number | string;
  name: string;
}
interface LocSel {
  province: string;
  district: string;
  ds: string;
  gn: string;
}

interface FormState {
  full_name: string;
  address: string;
  nic: string;
  birth_date: string;
  gender: string;
  passport_retention: string;
  passport_collected_date: string;
  passport_number: string;
  email: string;
  phone_number: string;
  whatsapp_number: string;
  province: string;
  district: string;
  ds_division: string;
  gn_division: string;
  staff_coordinator: string;
  agent: string;
  other_coordinator: boolean;
  other_coordinator_name: string;
  other_coordinator_mobile: string;
  country: string;
  candidate_skill: string;
  registration_date: string;
}

const EMPTY: FormState = {
  full_name: '',
  address: '',
  nic: '',
  birth_date: '',
  gender: '',
  passport_retention: '',
  passport_collected_date: '',
  passport_number: '',
  email: '',
  phone_number: '',
  whatsapp_number: '',
  province: '',
  district: '',
  ds_division: '',
  gn_division: '',
  staff_coordinator: '',
  agent: '',
  other_coordinator: false,
  other_coordinator_name: '',
  other_coordinator_mobile: '',
  country: '',
  candidate_skill: '',
  registration_date: new Date().toISOString().slice(0, 10),
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 5,
  color: 'var(--label-2)',
};
const inputStyle: React.CSSProperties = { padding: '10px 12px', borderRadius: 7, fontSize: 14, width: '100%' };
const cardStyle: React.CSSProperties = {
  background: 'var(--card)',
  borderRadius: 12,
  boxShadow: 'var(--card-shadow)',
  padding: 24,
  marginBottom: 20,
};

export default function CandidateFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const isEdit = !!id;
  const isAdmin = user?.role === 'Admin';

  const [form, setForm] = useState<FormState>(EMPTY);
  const [regManual, setRegManual] = useState('');
  const [registrationNo, setRegistrationNo] = useState('');
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [passportPreview, setPassportPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  // Section 2 — Training Details
  const EMPTY_TRAINING: CandidateTraining = {
    training_mode: null,
    pre_test_job_category_id: null,
    pre_test_number: null,
    pre_test_cycles: [],
    final_test_attendance_records: [],
    final_test_date: null,
    final_test_result: null,
    final_test_number: null,
    final_test_agent: null,
  };
  const [training, setTraining] = useState<CandidateTraining>(EMPTY_TRAINING);
  const [trainingSaving, setTrainingSaving] = useState(false);
  // Which test-number slot is currently generating (key: `cycle-<no>` or `final`).
  const [testNumSaving, setTestNumSaving] = useState<string | null>(null);
  // "Add date" pickers for attendance (per pre-test cycle + the final test).
  const [preAttDate, setPreAttDate] = useState<Record<number, string>>({});
  const [finalAttDate, setFinalAttDate] = useState('');

  // Section 3 — Personal Details (Attachment)
  const EMPTY_DOCUMENTS: CandidateDocuments = {
    passport_size_photo_url: null,
    nic_color_copy_url: null,
    passport_color_copy_url: null,
    professional_certificate_url: null,
    working_experience_files: [],
    cv_copy_url: null,
    police_certificate_files: [],
    certified_police_report_files: [],
    police_report_expire_date: null,
    document_submission_date: null,
    document_resubmission_date: null,
  };
  const [documents, setDocuments] = useState<CandidateDocuments>(EMPTY_DOCUMENTS);
  const [documentFiles, setDocumentFiles] = useState<Partial<Record<CandidateDocumentFileField, File>>>({});
  // Service Letter (working_experience) supports multiple files: newly picked ones awaiting upload.
  const [serviceLetterFiles, setServiceLetterFiles] = useState<File[]>([]);
  // Police report attachments (dated history): newly picked files awaiting upload, per field.
  const [datedFiles, setDatedFiles] = useState<Record<CandidateDatedFileField, File[]>>({
    police_certificate: [],
    certified_police_report: [],
  });
  const [documentsSaving, setDocumentsSaving] = useState(false);

  // Section 4 — Job & Visa Processing (country-scoped workflow)
  const EMPTY_VISA: CandidateVisaDetails = {
    offer_letter_date: null,
    confirmation_letter_date: null,
    document_submission_date: null,
    work_permit_received_date: null,
    embassy_submission_date: null,
    police_report_issued_date: null,
    process_interview_date: null,
    visa_received_date: null,
    agreement_sign_date: null,
    police_report_date: null,
    visa_status: null,
    visa_status_date: null,
    piba_submission_status: null,
  };
  const [visa, setVisa] = useState<CandidateVisaDetails>(EMPTY_VISA);
  const [visaSaving, setVisaSaving] = useState(false);

  // Section 5 — Employee Details
  const EMPTY_EMPLOYEE: CandidateEmployeeDetails = {
    registration_number: null,
    job_category_id: null,
  };
  const [employee, setEmployee] = useState<CandidateEmployeeDetails>(EMPTY_EMPLOYEE);
  const [employeeSaving, setEmployeeSaving] = useState(false);
  const [jobCategories, setJobCategories] = useState<JobCategory[]>([]);

  // Section 6 — Departure Details
  const EMPTY_DEPARTURE: CandidateDepartureDetails = {
    final_approval_date: null,
    receipt_number: null,
    flight_number: null,
    airticket_number: null,
    departure_date: null,
  };
  const [departure, setDeparture] = useState<CandidateDepartureDetails>(EMPTY_DEPARTURE);
  const [departureSaving, setDepartureSaving] = useState(false);

  // Cascading location dropdowns (Province -> District -> DS Division -> GN Division).
  const [provinces, setProvinces] = useState<Loc[]>([]);
  const [districts, setDistricts] = useState<Loc[]>([]);
  const [dsDivisions, setDsDivisions] = useState<Loc[]>([]);
  const [gnDivisions, setGnDivisions] = useState<Loc[]>([]);
  const [locSel, setLocSel] = useState<LocSel>({ province: '', district: '', ds: '', gn: '' });

  const loadDistricts = (provinceId: string | number) =>
    api.get<Loc[]>(`/locations/districts?province_id=${provinceId}`).then((r) => (setDistricts(r.data), r.data));
  const loadDsDivisions = (districtId: string | number) =>
    api.get<Loc[]>(`/locations/ds-divisions?district_id=${districtId}`).then((r) => (setDsDivisions(r.data), r.data));
  const loadGnDivisions = (districtId: string | number, dsId: string | number) =>
    api
      .get<Loc[]>(`/locations/gn-divisions?district_id=${districtId}&ds_division_id=${dsId}`)
      .then((r) => (setGnDivisions(r.data), r.data));

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const regPrefix = useMemo(() => {
    const letter = COUNTRY_LETTER[form.country] ?? '';
    const t = form.candidate_skill === 'training' ? 'T' : '';
    return `SDW${letter}${t}/`;
  }, [form.country, form.candidate_skill]);

  const candidateRegNo = regPrefix + regManual;

  // Load staff list (for coordinator + section assignment dropdowns).
  useEffect(() => {
    api.get<Staff[]>('/staff').then((r) => setStaff(r.data)).catch(() => setStaff([]));
  }, []);

  // Load the top-level provinces list once.
  useEffect(() => {
    api.get<Loc[]>('/locations/provinces').then((r) => setProvinces(r.data)).catch(() => setProvinces([]));
  }, []);

  function onProvinceChange(pid: string) {
    const name = provinces.find((p) => String(p.id) === pid)?.name ?? '';
    setLocSel({ province: pid, district: '', ds: '', gn: '' });
    setDistricts([]);
    setDsDivisions([]);
    setGnDivisions([]);
    setForm((f) => ({ ...f, province: name, district: '', ds_division: '', gn_division: '' }));
    if (pid) loadDistricts(pid);
  }
  function onDistrictChange(did: string) {
    const name = districts.find((d) => String(d.id) === did)?.name ?? '';
    setLocSel((s) => ({ ...s, district: did, ds: '', gn: '' }));
    setDsDivisions([]);
    setGnDivisions([]);
    setForm((f) => ({ ...f, district: name, ds_division: '', gn_division: '' }));
    if (did) loadDsDivisions(did);
  }
  function onDsChange(dsid: string) {
    const name = dsDivisions.find((d) => String(d.id) === dsid)?.name ?? '';
    setLocSel((s) => ({ ...s, ds: dsid, gn: '' }));
    setGnDivisions([]);
    setForm((f) => ({ ...f, ds_division: name, gn_division: '' }));
    if (dsid && locSel.district) loadGnDivisions(locSel.district, dsid);
  }
  function onGnChange(gnid: string) {
    const name = gnDivisions.find((d) => String(d.id) === gnid)?.name ?? '';
    setLocSel((s) => ({ ...s, gn: gnid }));
    setForm((f) => ({ ...f, gn_division: name }));
  }

  // On edit, resolve the stored location names back into the cascading dropdowns.
  async function hydrateLocations(c: Candidate) {
    try {
      const provList = (await api.get<Loc[]>('/locations/provinces')).data;
      setProvinces(provList);
      const prov = provList.find((p) => p.name === c.province);
      if (!prov) return;
      const dList = await loadDistricts(prov.id);
      const dist = dList.find((d) => d.name === c.district);
      if (!dist) {
        setLocSel({ province: String(prov.id), district: '', ds: '', gn: '' });
        return;
      }
      const dsList = await loadDsDivisions(dist.id);
      const ds = dsList.find((x) => x.name === c.ds_division);
      if (!ds) {
        setLocSel({ province: String(prov.id), district: String(dist.id), ds: '', gn: '' });
        return;
      }
      const gnList = await loadGnDivisions(dist.id, ds.id);
      const gn = gnList.find((x) => x.name === c.gn_division);
      setLocSel({
        province: String(prov.id),
        district: String(dist.id),
        ds: String(ds.id),
        gn: gn ? String(gn.id) : '',
      });
    } catch {
      /* leave dropdowns empty on failure */
    }
  }

  // Load candidate when editing, or preview the next registration number when new.
  useEffect(() => {
    if (isEdit) {
      api.get<Candidate>(`/candidates/${id}`).then((r) => hydrate(r.data)).catch(() => {
        toastError('Could not load candidate.');
        navigate('/candidates');
      });
    } else {
      api
        .get<{ registration_no: string }>('/candidates/next-registration-no')
        .then((r) => setRegistrationNo(r.data.registration_no))
        .catch(() => setRegistrationNo(''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Load training data once the candidate exists.
  useEffect(() => {
    if (isEdit && id) {
      api.get<CandidateTraining>(`/candidates/${id}/training`)
        .then((r) => setTraining(withDefaultCycle(r.data)))
        .catch(() => setTraining(withDefaultCycle(EMPTY_TRAINING)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Load attachment documents once the candidate exists.
  useEffect(() => {
    if (isEdit && id) {
      api.get<CandidateDocuments>(`/candidates/${id}/documents`)
        .then((r) => setDocuments(r.data))
        .catch(() => setDocuments(EMPTY_DOCUMENTS));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Load visa/job details once the candidate exists.
  useEffect(() => {
    if (isEdit && id) {
      api.get<CandidateVisaDetails>(`/candidates/${id}/visa-details`)
        .then((r) => setVisa(r.data))
        .catch(() => setVisa(EMPTY_VISA));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Load employee details once the candidate exists.
  useEffect(() => {
    if (isEdit && id) {
      api.get<CandidateEmployeeDetails>(`/candidates/${id}/employee-details`)
        .then((r) => setEmployee(r.data))
        .catch(() => setEmployee(EMPTY_EMPLOYEE));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Load departure details once the candidate exists.
  useEffect(() => {
    if (isEdit && id) {
      api.get<CandidateDepartureDetails>(`/candidates/${id}/departure-details`)
        .then((r) => setDeparture(r.data))
        .catch(() => setDeparture(EMPTY_DEPARTURE));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Load the managed job-category list (for the Section 5 dropdown).
  useEffect(() => {
    api.get<JobCategory[]>('/job-categories').then((r) => setJobCategories(r.data)).catch(() => setJobCategories([]));
  }, []);

  function hydrate(c: Candidate) {
    setCandidate(c);
    setRegistrationNo(c.registration_no);
    hydrateLocations(c);
    setForm({
      full_name: c.full_name ?? '',
      address: c.address ?? '',
      nic: c.nic ?? '',
      birth_date: c.birth_date ?? '',
      gender: c.gender ?? '',
      passport_retention: c.passport_retention ?? '',
      passport_collected_date: c.passport_collected_date ?? '',
      passport_number: c.passport_number ?? '',
      email: c.email ?? '',
      phone_number: c.phone_number ?? '',
      whatsapp_number: c.whatsapp_number ?? '',
      province: c.province ?? '',
      district: c.district ?? '',
      ds_division: c.ds_division ?? '',
      gn_division: c.gn_division ?? '',
      staff_coordinator: c.staff_coordinator ?? '',
      agent: c.agent ?? '',
      other_coordinator: !!c.other_coordinator,
      other_coordinator_name: c.other_coordinator_name ?? '',
      other_coordinator_mobile: c.other_coordinator_mobile ?? '',
      country: c.country ?? '',
      candidate_skill: c.candidate_skill ?? '',
      registration_date: c.registration_date ? c.registration_date.slice(0, 10) : '',
    });
    // Manual part = whatever follows the last "/" of the stored reg no.
    if (c.candidate_reg_no) {
      const parts = c.candidate_reg_no.split('/');
      setRegManual(parts[parts.length - 1] ?? '');
    }
    setPassportPreview(c.passport_image_url ?? null);
  }

  function onPassportChange(file: File | null) {
    setPassportFile(file);
    setPassportPreview(file ? URL.createObjectURL(file) : candidate?.passport_image_url ?? null);
  }

  function buildFormData(): FormData {
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      fd.append(k, typeof v === 'boolean' ? (v ? '1' : '0') : (v ?? ''));
    });
    fd.append('candidate_reg_no', candidateRegNo);
    if (passportFile) fd.append('passport_image', passportFile);
    return fd;
  }

  async function handleSave() {
    if (!form.full_name.trim()) {
      toastError('Name (as in passport) is required.');
      return;
    }
    const nicErr = nicError(form.nic);
    if (nicErr) {
      toastError(nicErr);
      return;
    }
    const phoneErr = phoneError(form.phone_number, true);
    if (phoneErr) {
      toastError(phoneErr);
      return;
    }
    const whatsappErr = phoneError(form.whatsapp_number);
    if (whatsappErr) {
      toastError(whatsappErr);
      return;
    }
    if (form.passport_retention === 'yes') {
      const passportErr = passportError(form.passport_number);
      if (passportErr) {
        toastError(passportErr);
        return;
      }
    }
    const ok = await confirmAction(
      isEdit ? 'Save the changes to this candidate?' : 'Save this candidate?',
      'Save candidate',
      'Yes, save',
    );
    if (!ok) return;
    setSaving(true);
    try {
      if (isEdit) {
        const fd = buildFormData();
        fd.append('_method', 'PUT');
        const r = await api.post<Candidate>(`/candidates/${id}`, fd);
        hydrate(r.data);
        await markSectionComplete(1); // saving Section 1 unlocks Section 2
        toastSuccess('Candidate updated');
      } else {
        const r = await api.post<Candidate>('/candidates', buildFormData());
        toastSuccess('Section 1 saved');
        navigate(`/candidates/${r.data.id}`);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not save. Please check the fields.';
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  /** Mark a section complete (best-effort) so the next section unlocks. No toast. */
  async function markSectionComplete(sectionNo: number) {
    if (!id) return;
    try {
      const r = await api.post<Candidate>(`/candidates/${id}/submit-section`, { section_no: sectionNo });
      hydrate(r.data);
    } catch {
      /* leave the section locked; the manual Submit in the assignment list still works */
    }
  }

  async function submitSection(sectionNo: number) {
    const ok = await confirmAction(
      `Submit Section ${sectionNo}? This finalises the section.`,
      'Submit section',
      'Yes, submit',
    );
    if (!ok) return;
    try {
      const r = await api.post<Candidate>(`/candidates/${id}/submit-section`, {
        section_no: sectionNo,
      });
      hydrate(r.data);
      toastSuccess(`Section ${sectionNo} submitted`);
    } catch {
      toastError('Could not submit section.');
    }
  }

  /**
   * Generate the passport-retention print set from the official artwork:
   * Collection Card front (filled) + back (terms) + Passport Sticker (filled).
   *
   * The three PNGs are the exact designer artwork (one card each, cropped from the
   * A4 print sheets). Candidate data is stamped onto them via canvas at the measured
   * dotted-line coordinates, so the output matches the artwork pixel-for-pixel.
   * Physical print size is driven by CARD_WIDTH_MM below — tune once the printer is chosen.
   */
  async function printPassportDocs() {
    const CARD_WIDTH_MM = 90; // wallet size; adjust with the chosen printer

    const collectedDate = form.passport_collected_date
      ? new Date(form.passport_collected_date).toLocaleDateString('en-GB')
      : '';
    // Dotted-line baselines measured on the 1218×844 artwork crop.
    const fields = [
      { y: 435, text: candidateRegNo },
      { y: 518, text: form.full_name || '' },
      { y: 601, text: form.passport_number || '' },
      { y: 685, text: collectedDate },
    ];

    const loadImg = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

    // The reg-no QR already rendered on screen (attendance card) — reused here.
    const qrCanvas = qrRef.current?.querySelector('canvas') as HTMLCanvasElement | null;
    const qrImg = qrCanvas ? await loadImg(qrCanvas.toDataURL('image/png')) : null;

    // Draw the artwork and (optionally) stamp the candidate fields + QR onto it.
    const compose = (img: HTMLImageElement, withFields: boolean): string => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      if (withFields) {
        const fullRight = 0.965 * c.width;
        // QR sits low on the right so it only overlaps the short Passport/Date rows;
        // Reg No and Name stay full-width and never shrink.
        const qrSize = Math.round(0.19 * c.width); // ~17mm on a 90mm card
        const qrX = c.width - qrSize - Math.round(0.018 * c.width);
        const qrY = 548; // below the Name row (baseline 518)
        const pad = Math.round(0.01 * c.width);
        if (qrImg) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(qrX - pad, qrY - pad, qrSize + pad * 2, qrSize + pad * 2);
          ctx.imageSmoothingEnabled = false; // keep QR modules crisp when scaled
          ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
          ctx.imageSmoothingEnabled = true;
        }
        ctx.fillStyle = '#14142a';
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
        const x = Math.round(0.362 * c.width); // just after the ":" on every row
        for (const f of fields) {
          // Only rows whose line runs under the QR are width-limited by it.
          const rowRight = qrImg && f.y > qrY - 6 ? qrX - pad * 2 : fullRight;
          let size = 40;
          ctx.font = `700 ${size}px Arial, sans-serif`;
          while (size > 24 && x + ctx.measureText(f.text).width > rowRight) {
            size -= 2;
            ctx.font = `700 ${size}px Arial, sans-serif`;
          }
          // Clip to the row's lane so nothing can ever bleed into the QR.
          ctx.save();
          ctx.beginPath();
          ctx.rect(x - 4, f.y - 46, rowRight - x + 4, 56);
          ctx.clip();
          ctx.fillText(f.text, x, f.y - 6);
          ctx.restore();
        }
      }
      return c.toDataURL('image/png');
    };

    try {
      const [fImg, bImg, sImg] = await Promise.all([
        loadImg(passportCardFront),
        loadImg(passportCardBack),
        loadImg(passportSticker),
      ]);
      const frontUrl = compose(fImg, true);
      const backUrl = compose(bImg, false);
      const stickerUrl = compose(sImg, true);

      const w = window.open('', '_blank', 'width=900,height=700');
      if (!w) return;
      const page = (label: string, url: string) => `
        <div class="page">
          <div class="cap">${label}</div>
          <img src="${url}" />
        </div>`;
      w.document.write(`
        <html><head><title>Passport Documents — ${candidateRegNo.replace(/[<>&]/g, '')}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          * { box-sizing: border-box; }
          body { margin: 0; font-family: system-ui, sans-serif; }
          .page { text-align: center; page-break-after: always; }
          .page:last-child { page-break-after: auto; }
          .cap { font-size: 10px; letter-spacing: 1px; color: #888; text-transform: uppercase; margin: 4mm 0 2mm; }
          img { width: ${CARD_WIDTH_MM}mm; height: auto; display: inline-block; }
        </style></head>
        <body>
          ${page('Passport Collection Card — Front', frontUrl)}
          ${page('Passport Collection Card — Back', backUrl)}
          ${page('Passport Sticker', stickerUrl)}
          <script>
            window.onload = function () { window.print(); setTimeout(function(){ window.close(); }, 400); };
          </script>
        </body></html>`);
      w.document.close();
    } catch {
      toastError('Could not generate passport documents.');
    }
  }

  const staffName = (sid: string) => staff.find((s) => String(s.id) === sid)?.name ?? '—';
  const sectionByNo = (n: number): CandidateSection | undefined =>
    candidate?.sections?.find((s) => s.section_no === n);

  // Sequential unlock: a section's edit card opens only once the previous one is submitted.
  const isSectionSubmitted = (n: number) => sectionByNo(n)?.status === 'submitted';
  const section1Done = isSectionSubmitted(1);
  const section2Done = isSectionSubmitted(2);
  const section3Done = isSectionSubmitted(3);
  const section4Done = isSectionSubmitted(4);
  const section5Done = isSectionSubmitted(5);

  // Placeholder card shown while a section is still locked.
  const LockedSectionCard = ({ no, title, needNo }: { no: string; title: string; needNo: number }) => (
    <div style={cardStyle}>
      <div style={{ color: 'var(--accent, #6366f1)', fontWeight: 700, marginBottom: 4 }}>
        {no}. {title}
      </div>
      <hr style={{ border: 'none', borderTop: '1px solid var(--border-soft)', margin: '10px 0 18px' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0', color: 'var(--muted)' }}>
        <span style={{ fontSize: 20 }}>🔒</span>
        <span style={{ fontSize: 13 }}>
          Locked — complete &amp; submit Section {needNo} first (in Sections &amp; Staff Assignment below).
        </span>
      </div>
    </div>
  );

  // ── Training helpers ──────────────────────────────────────────────────────

  const [trainingBondFile, setTrainingBondFile] = useState<File | null>(null);

  /**
   * Ensure the training record always has at least one pre-test cycle so both the
   * Pre Test and Final Test sections render without a mode selection.
   */
  function withDefaultCycle(t: CandidateTraining): CandidateTraining {
    if (t.pre_test_cycles && t.pre_test_cycles.length > 0) return t;
    return {
      ...t,
      pre_test_cycles: [{ cycle_no: 1, attendance_records: [], test_date: null, test_result: null, test_agent: null, test_number: null }],
    };
  }

  function updateCycle(cycleNo: number, patch: Partial<PreTestCycle>) {
    setTraining((prev) => ({
      ...prev,
      pre_test_cycles: prev.pre_test_cycles.map((c) =>
        c.cycle_no === cycleNo ? { ...c, ...patch } : c
      ),
    }));
  }

  function addNextCycle() {
    setTraining((prev) => {
      const nextNo = prev.pre_test_cycles.length + 1;
      return {
        ...prev,
        pre_test_cycles: [
          ...prev.pre_test_cycles,
          { cycle_no: nextNo, attendance_records: [], test_date: null, test_result: null, test_agent: null, test_number: null },
        ],
      };
    });
  }

  async function addAttendanceRecord(slot: number | 'final', dateStr: string) {
    if (!dateStr || !id) return;
    try {
      const body = slot === 'final'
        ? { slot: 'final_test', date: dateStr }
        : { slot: 'pre_test', cycle_no: slot, date: dateStr };
      const r = await api.post<CandidateTraining>(`/candidates/${id}/training/attendance/add`, body);
      setTraining(withDefaultCycle(r.data));
    } catch {
      toastError('Could not add attendance.');
    }
  }

  async function removeAttendanceRecord(slot: number | 'final', dateStr: string) {
    if (!id) return;
    try {
      const body = slot === 'final'
        ? { slot: 'final_test', date: dateStr }
        : { slot: 'pre_test', cycle_no: slot, date: dateStr };
      const r = await api.post<CandidateTraining>(`/candidates/${id}/training/attendance/remove`, body);
      setTraining(withDefaultCycle(r.data));
    } catch {
      toastError('Could not remove attendance.');
    }
  }

  async function saveTraining() {
    const ok = await confirmAction('Save the training details?', 'Save training', 'Yes, save');
    if (!ok) return;
    setTrainingSaving(true);
    try {
      const fd = new FormData();
      fd.append('training_mode', 'both');
      fd.append('pre_test_job_category_id', training.pre_test_job_category_id ? String(training.pre_test_job_category_id) : '');
      fd.append('pre_test_cycles', JSON.stringify(training.pre_test_cycles));
      fd.append('final_test_attendance_records', JSON.stringify(training.final_test_attendance_records));
      fd.append('final_test_date', training.final_test_date ?? '');
      fd.append('final_test_result', training.final_test_result ?? '');
      fd.append('final_test_number', training.final_test_number ?? '');
      fd.append('final_test_agent', training.final_test_agent ?? '');
      if (trainingBondFile) fd.append('training_bond', trainingBondFile);
      const r = await api.post<CandidateTraining>(`/candidates/${id}/training`, fd);
      setTraining(withDefaultCycle(r.data));
      setTrainingBondFile(null);
      await markSectionComplete(2); // completing Section 2 unlocks Section 3
      toastSuccess('Training details saved');
    } catch {
      toastError('Could not save training details.');
    } finally {
      setTrainingSaving(false);
    }
  }

  /**
   * Generate (or fetch) a unique test number for one slot — a specific pre-test
   * cycle, or the final test. Each cycle/final gets its own new number; an
   * already-issued number is kept as-is.
   */
  async function generateTestNumber(slot: 'pre_test' | 'final_test', cycleNo?: number) {
    if (!id || !training.pre_test_job_category_id) {
      toastError('Select a trade (job category) first.');
      return;
    }
    const key = slot === 'final_test' ? 'final' : `cycle-${cycleNo}`;
    setTestNumSaving(key);
    try {
      const r = await api.post<CandidateTraining>(`/candidates/${id}/training/test-number`, {
        pre_test_job_category_id: training.pre_test_job_category_id,
        slot,
        cycle_no: cycleNo ?? null,
      });
      setTraining(withDefaultCycle(r.data));
      toastSuccess('Test number generated');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Could not generate the test number.';
      toastError(msg);
    } finally {
      setTestNumSaving(null);
    }
  }

  const preTestTrade = jobCategories.find((c) => c.id === training.pre_test_job_category_id) ?? null;

  /** Print a Test ID card twice on one A4 (cut in half → front & back). */
  function printTestId(testNo: string) {
    if (!testNo) return;
    const w = window.open('', '_blank', 'width=800,height=1000');
    if (!w) return;
    const card = `
      <div class="card">
        <div class="hd"><span>TEST ID</span><span class="org">CSTI Bureau</span></div>
        <div class="bd">
          <div class="nm">${(form.full_name || '').toUpperCase()}</div>
          <div class="no">${testNo}</div>
          <div class="tr">${preTestTrade?.name ?? ''}</div>
        </div>
      </div>`;
    w.document.write(`
      <html><head><title>Test ID — ${testNo}</title>
      <style>
        @page { size: A4 portrait; margin: 0; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: system-ui, Arial, sans-serif; }
        .card { height: 148.5mm; padding: 18mm 16mm; page-break-inside: avoid; }
        .card + .card { border-top: 2px dashed #999; }
        .hd { display: flex; justify-content: space-between; align-items: center;
              background: #5b8aa0; color: #fff; padding: 12px 18px; border-radius: 6px; }
        .hd span { font-size: 30px; font-weight: 800; letter-spacing: 1px; }
        .hd .org { font-size: 16px; font-weight: 700; }
        .bd { text-align: center; padding-top: 30px; }
        .nm { font-size: 34px; font-weight: 800; color: #222; }
        .no { font-size: 40px; font-weight: 800; color: #16a34a; margin-top: 14px; letter-spacing: 2px; }
        .tr { font-size: 24px; font-weight: 600; color: #5b8aa0; margin-top: 12px; }
      </style></head>
      <body onload="window.print(); setTimeout(()=>window.close(), 300);">
        ${card}${card}
      </body></html>`);
    w.document.close();
  }

  /** Print the Skills Testing Evaluation (Result) Sheet with the recorded Pass/Fail. */
  function printResultSheet(opts: { testLabel: string; result: 'pass' | 'fail' | null; testDate: string | null; testNo?: string | null }) {
    const w = window.open('', '_blank', 'width=900,height=1200');
    if (!w) return;
    const criteria: [string, number][] = [
      ['Safety Awareness & PPE Usage', 10],
      ['Tool Identification & Usage', 10],
      ['Measurement & Marking Accuracy', 10],
      ['Quality of Workmanship', 20],
      ['Material Handling', 10],
      ['Time Management', 10],
      ['Problem Solving Ability', 10],
      ['Compliance with Instructions', 10],
      ['Housekeeping & Work Area Management', 10],
      ['Overall Performance', 10],
    ];
    const photo = candidate?.passport_image_url ?? passportPreview ?? '';
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const tick = (on: boolean) => (on ? '☑' : '☐');
    const fmtDate = (s: string) => {
      if (!s) return '';
      const d = new Date(s);
      if (isNaN(d.getTime())) return s;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    const rows = criteria
      .map(([label, max]) => `<tr><td class="crit">${label}</td><td class="mx">${max}</td><td class="ob"></td></tr>`)
      .join('');
    const field = (label: string, value: string) =>
      `<div class="frow"><div class="fl">${label}</div><div class="fv">${esc(value) || '&nbsp;'}</div></div>`;
    const logoSrc = `${window.location.origin}${solidrowLogo}`;
    w.document.write(`
      <html><head><title>Result Sheet — ${form.full_name || ''}</title>
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: system-ui, Arial, sans-serif; color: #1f2937; font-size: 11px; }
        .hdr { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #2b6fa8; padding-bottom: 8px; }
        .hdr .logo { height: 74px; width: auto; flex: none; }
        .hd-mid { flex: 1; text-align: center; }
        .inst { font-size: 15px; font-weight: 800; color: #14486f; letter-spacing: .3px; }
        .inst-sub { font-size: 10px; color: #555; margin-top: 1px; }
        .tag { margin-top: 5px; font-style: italic; font-weight: 600; color: #b45309; font-size: 10.5px; }
        h1 { font-size: 15px; text-align: center; margin: 10px 0 0; color: #14486f; letter-spacing: .5px; }
        .h1sub { text-align: center; font-size: 12px; font-weight: 700; color: #374151; margin-bottom: 8px; }
        .trade { display: flex; justify-content: space-between; border: 1px solid #cbd5e1; background: #f1f5f9; padding: 5px 10px; font-weight: 600; }
        .body { display: flex; gap: 0; border: 1px solid #cbd5e1; border-top: none; }
        .side { width: 195px; flex: none; background: #dbeafe; border-right: 1px solid #cbd5e1; padding: 10px; }
        .ph-wrap { text-align: center; margin-bottom: 10px; }
        .photo { width: 110px; height: 132px; object-fit: cover; border: 2px solid #2b6fa8; background: #eef2f5; }
        .stu { margin: 6px auto 0; background: #d9534f; color: #fff; font-weight: 700; font-size: 11px; padding: 3px 0; width: 110px; }
        .frow { margin-bottom: 8px; }
        .fl { font-size: 9.5px; color: #475569; font-weight: 600; }
        .fv { border-bottom: 1px solid #94a3b8; min-height: 15px; padding: 1px 2px; font-weight: 600; font-size: 11px; word-break: break-word; }
        .main { flex: 1; padding: 10px; }
        .tr-hd { background: #2b6fa8; color: #fff; text-align: center; font-weight: 700; padding: 5px; font-size: 11px; }
        table.assess { border-collapse: collapse; width: 100%; }
        .assess th { background: #eef4f9; border: 1px solid #cbd5e1; padding: 5px 7px; font-size: 10px; text-align: left; color: #14486f; }
        .assess td { border: 1px solid #cbd5e1; padding: 5px 7px; }
        .mx, .ob { width: 70px; text-align: center; }
        .tot td { font-weight: 700; background: #f1f5f9; }
        .result { margin-top: 10px; font-size: 10.5px; }
        .result .line { display: flex; gap: 26px; margin-bottom: 6px; }
        .result b { font-weight: 700; }
        .rem { margin-top: 6px; }
        .rem .rl { border-bottom: 1px dotted #94a3b8; height: 14px; margin-top: 4px; }
        .exd { margin-top: 12px; border-top: 1px solid #cbd5e1; padding-top: 8px; }
        .exd .et { font-weight: 700; text-align: center; color: #14486f; margin-bottom: 6px; }
        .exd .line { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .ftr { margin-top: 8px; background: #e07b23; color: #fff; text-align: center; font-size: 9px; padding: 5px; border-radius: 2px; }
      </style></head>
      <body onload="window.print(); setTimeout(()=>window.close(), 400);">
        <div class="hdr">
          <img class="logo" src="${logoSrc}" alt="Solidrow" />
          <div class="hd-mid">
            <div class="inst">SOLIDROW FESTI (PVT) LTD</div>
            <div class="inst-sub">Foreign Employment Agency · License No 3583</div>
            <div class="tag">"An Internationally Awarded Institute Dedicated to Your Success"</div>
          </div>
        </div>
        <h1>SKILLS TESTING EVALUATION SHEET</h1>
        <div class="h1sub">CONSTRUCTION</div>
        <div class="trade">
          <span>Trade Category : <b>${preTestTrade?.name ?? ''}</b></span>
          <span>Experience (Years) : ______</span>
        </div>
        <div class="body">
          <aside class="side">
            <div class="ph-wrap">
              ${photo ? `<img class="photo" src="${photo}" />` : '<div class="photo"></div>'}
              <div class="stu">STUDENT ${opts.testNo ?? ''}</div>
            </div>
            ${field('Name', (form.full_name || '').toUpperCase())}
            ${field('NIC', form.nic || '')}
            ${field('Passport No', form.passport_number || '')}
            ${field('Address', form.address || '')}
            ${field('Date of Birth', fmtDate(form.birth_date))}
            ${field('Gender', form.gender || '')}
            ${field('Phone', form.phone_number || '')}
            ${field('Married', '')}
          </aside>
          <section class="main">
            <div class="tr-hd">TEST REPORT · PRACTICAL ASSESSMENT</div>
            <table class="assess"><thead>
              <tr><th>Assessment Criteria</th><th class="mx">Maximum Marks</th><th class="ob">Marks Obtained</th></tr>
            </thead><tbody>
              ${rows}
              <tr class="tot"><td>Total Marks</td><td class="mx">100</td><td class="ob"></td></tr>
            </tbody></table>
            <div class="result">
              <div class="line"><span>Maximum Marks : <b>100</b></span><span>Marks Obtained : __________</span></div>
              <div class="line"><span>Percentage : __________ %</span></div>
              <div class="line"><span>Result : ${tick(opts.result === 'pass')} PASS &nbsp;&nbsp; ${tick(opts.result === 'fail')} FAIL</span></div>
              <div class="line"><b>Recommendation :</b></div>
              <div class="line"><span>☐ Recommended for Employment</span><span>☐ Requires Further Training</span></div>
              <div class="rem">
                <span>Examiner's Remarks :</span>
                <div class="rl"></div>
                <div class="rl"></div>
              </div>
            </div>
            <div class="exd">
              <div class="et">Examiner Details</div>
              <div class="line"><span>Examiner Name : ______________</span><span>Designation : ______________</span></div>
              <div class="line"><span>Signature : ______________</span><span>Date : ______________</span></div>
            </div>
          </section>
        </div>
        <div class="ftr">SOLIDROW FESTI (PVT) LTD · Foreign Employment Agency · License No 3583 · ${opts.testLabel}${opts.testDate ? ' · ' + opts.testDate : ''}</div>
      </body></html>`);
    w.document.close();
  }

  // ── Section 3: Documents helpers ──────────────────────────────────────────

  const setDocDate = (
    key: 'document_submission_date' | 'document_resubmission_date' | 'police_report_expire_date',
    value: string,
  ) => setDocuments((d) => ({ ...d, [key]: value || null }));

  const setDocFile = (field: CandidateDocumentFileField, file: File | null) =>
    setDocumentFiles((prev) => {
      const next = { ...prev };
      if (file) next[field] = file;
      else delete next[field];
      return next;
    });

  // Add newly picked Service Letter files to the pending list (multiple allowed).
  const addServiceLetterFiles = (files: File[]) => {
    if (files.length === 0) return;
    setServiceLetterFiles((prev) => [...prev, ...files]);
  };

  const removeServiceLetterFile = (index: number) =>
    setServiceLetterFiles((prev) => prev.filter((_, i) => i !== index));

  // Drop an already-stored Service Letter file so it won't be kept on save.
  const removeStoredServiceLetterFile = (path: string) =>
    setDocuments((prev) => ({
      ...prev,
      working_experience_files: prev.working_experience_files.filter((f) => f.path !== path),
    }));

  // ── Police report attachments (dated multi-file history) ──────────────────
  const addDatedFiles = (field: CandidateDatedFileField, files: File[]) => {
    if (files.length === 0) return;
    setDatedFiles((prev) => ({ ...prev, [field]: [...prev[field], ...files] }));
  };

  const removeDatedFile = (field: CandidateDatedFileField, index: number) =>
    setDatedFiles((prev) => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));

  // Drop an already-stored dated file so it won't be kept on save.
  const removeStoredDatedFile = (field: CandidateDatedFileField, path: string) =>
    setDocuments((prev) => ({
      ...prev,
      [`${field}_files`]: prev[`${field}_files`].filter((f) => f.path !== path),
    }));

  async function saveDocuments() {
    if (!id) return;
    const ok = await confirmAction('Save the attached documents?', 'Save documents', 'Yes, save');
    if (!ok) return;
    setDocumentsSaving(true);
    try {
      const fd = new FormData();
      (Object.entries(documentFiles) as [CandidateDocumentFileField, File][]).forEach(([field, file]) => {
        fd.append(field, file);
      });
      // Service Letter (multi-file): keep the still-listed stored files + append new picks.
      documents.working_experience_files.forEach((f) => fd.append('working_experience_keep[]', f.path));
      serviceLetterFiles.forEach((file) => fd.append('working_experience[]', file));
      // Police report attachments (dated history): keep still-listed stored files + append new picks.
      (['police_certificate', 'certified_police_report'] as CandidateDatedFileField[]).forEach((field) => {
        documents[`${field}_files`].forEach((f) => fd.append(`${field}_keep[]`, f.path));
        datedFiles[field].forEach((file) => fd.append(`${field}[]`, file));
      });
      fd.append('police_report_expire_date', documents.police_report_expire_date ?? '');
      fd.append('document_submission_date', documents.document_submission_date ?? '');
      fd.append('document_resubmission_date', documents.document_resubmission_date ?? '');
      const r = await api.post<CandidateDocuments>(`/candidates/${id}/documents`, fd);
      setDocuments(r.data);
      setDocumentFiles({});
      setServiceLetterFiles([]);
      setDatedFiles({ police_certificate: [], certified_police_report: [] });
      await markSectionComplete(3); // completing Section 3 advances the workflow
      toastSuccess('Documents saved');
    } catch {
      toastError('Could not save documents.');
    } finally {
      setDocumentsSaving(false);
    }
  }

  // ── Section 4: Job & Visa Processing helpers ──────────────────────────────

  const setVisaField = <K extends keyof CandidateVisaDetails>(key: K, value: CandidateVisaDetails[K]) =>
    setVisa((v) => ({ ...v, [key]: value }));

  const setVisaDate = (key: keyof CandidateVisaDetails, value: string) =>
    setVisaField(key, (value || null) as CandidateVisaDetails[typeof key]);

  async function saveVisa() {
    if (!id) return;
    const ok = await confirmAction('Save the job & visa details?', 'Save visa details', 'Yes, save');
    if (!ok) return;
    setVisaSaving(true);
    try {
      const r = await api.post<CandidateVisaDetails>(`/candidates/${id}/visa-details`, visa);
      setVisa(r.data);
      await markSectionComplete(4); // completing Section 4 advances the workflow
      const statusMsg =
        r.data.visa_status === 'visa_received' ? ' — visa received SMS queued'
        : r.data.visa_status === 'visa_cancel' ? ' — visa cancelled SMS queued'
        : '';
      toastSuccess(`Section 4 saved${statusMsg}`);
    } catch {
      toastError('Could not save visa details.');
    } finally {
      setVisaSaving(false);
    }
  }

  // ── Section 5: Employee Details helpers ───────────────────────────────────

  async function saveEmployee() {
    if (!id) return;
    const ok = await confirmAction('Save the employee details?', 'Save employee details', 'Yes, save');
    if (!ok) return;
    setEmployeeSaving(true);
    try {
      const r = await api.post<CandidateEmployeeDetails>(`/candidates/${id}/employee-details`, {
        registration_number: employee.registration_number ?? '',
        job_category_id: employee.job_category_id ?? '',
      });
      setEmployee(r.data);
      await markSectionComplete(6); // Employee Details is Section 6 — completing it finalises the workflow
      toastSuccess('Employee details saved');
    } catch {
      toastError('Could not save employee details.');
    } finally {
      setEmployeeSaving(false);
    }
  }

  // ── Section 6: Departure Details helpers ──────────────────────────────────

  async function saveDeparture() {
    if (!id) return;
    const ok = await confirmAction('Save the departure details?', 'Save departure details', 'Yes, save');
    if (!ok) return;
    setDepartureSaving(true);
    try {
      const r = await api.post<CandidateDepartureDetails>(`/candidates/${id}/departure-details`, {
        final_approval_date: departure.final_approval_date ?? '',
        receipt_number: departure.receipt_number ?? '',
        flight_number: departure.flight_number ?? '',
        airticket_number: departure.airticket_number ?? '',
        departure_date: departure.departure_date ?? '',
      });
      setDeparture(r.data);
      await markSectionComplete(5); // Departure Details is now Section 5, unlocking Section 6
      toastSuccess('Departure details saved');
    } catch {
      toastError('Could not save departure details.');
    } finally {
      setDepartureSaving(false);
    }
  }

  // A labelled date input bound to a visa field (compact helper for the grid).
  const VisaDate = ({ label, field }: { label: string; field: keyof CandidateVisaDetails }) => (
    <div>
      <label style={labelStyle}>{label}</label>
      <DatePicker
        style={inputStyle}
        value={(visa[field] as string | null) ?? ''}
        onChange={(iso) => setVisaDate(field, iso)}
      />
    </div>
  );

  return (
    <div className="fade-in-s" style={{ maxWidth: 1080 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <button
            onClick={() => navigate('/candidates')}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 6, fontFamily: 'inherit' }}
          >
            ← Back to candidates
          </button>
          <div style={{ fontSize: 24, fontWeight: 700 }}>
            {isEdit ? 'Candidate' : 'New Registration'}
          </div>
        </div>
      </div>

      {/* Section 1: Personal Details */}
      <div style={cardStyle}>
        <div style={{ color: 'var(--accent, #6366f1)', fontWeight: 700, marginBottom: 4 }}>
          01. Personal Details
        </div>
        <hr style={{ border: 'none', borderTop: '1px solid var(--border-soft)', margin: '10px 0 18px' }} />

        <div className="sr-grid-3">
          <div>
            <label style={labelStyle}>Registration No *</label>
            <input className="sr-input" style={{ ...inputStyle, background: 'var(--row-border, #f3f4f6)' }} value={registrationNo} readOnly />
          </div>

          <div>
            <label style={labelStyle}>Country *</label>
            <select className="sr-input" style={inputStyle} value={form.country} onChange={(e) => set('country', e.target.value)}>
              <option value="">-- Select Country --</option>
              <option value="Romania">Romania</option>
              <option value="Israel">Israel</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Candidate Skill</label>
            <select className="sr-input" style={inputStyle} value={form.candidate_skill} onChange={(e) => set('candidate_skill', e.target.value)}>
              <option value="">-- Select Skill --</option>
              <option value="skill">Skill</option>
              <option value="unskill">Unskill</option>
              <option value="training">Training</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Candidate Reg. No</label>
            <div style={{ display: 'flex' }}>
              <span
                style={{
                  ...inputStyle,
                  width: 'auto',
                  whiteSpace: 'nowrap',
                  background: 'var(--row-border, #f3f4f6)',
                  border: '1px solid var(--border)',
                  borderRight: 'none',
                  borderRadius: '7px 0 0 7px',
                  color: 'var(--label-2)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {regPrefix}
              </span>
              <input
                className="sr-input"
                style={{ ...inputStyle, borderRadius: '0 7px 7px 0' }}
                placeholder="e.g. 627"
                value={regManual}
                onChange={(e) => setRegManual(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Registration Date *</label>
            <DatePicker style={inputStyle} value={form.registration_date} onChange={(iso) => set('registration_date', iso)} />
          </div>

          <div>
            <label style={labelStyle}>Passport Size Photo (Profile)</label>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <img
                src={passportPreview || DEFAULT_PROFILE_IMAGE}
                alt="passport"
                style={{ width: 56, height: 72, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', flexShrink: 0, background: 'var(--row-border, #f3f4f6)' }}
              />
              <input className="sr-input" type="file" accept="image/*" style={inputStyle} onChange={(e) => onPassportChange(e.target.files?.[0] ?? null)} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Name as Mentioned in the Passport *</label>
            <input className="sr-input" style={inputStyle} value={form.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder="Enter Name as in Passport" />
          </div>

          <div>
            <label style={labelStyle}>Address</label>
            <input className="sr-input" style={inputStyle} value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Enter Address" />
          </div>

          <div>
            <label style={labelStyle}>NIC Number</label>
            <input
              className="sr-input"
              style={inputStyle}
              value={form.nic}
              onChange={(e) => {
                const nic = e.target.value;
                const derived = nicToBirth(nic);
                setForm((f) => ({
                  ...f,
                  nic,
                  ...(derived ? { birth_date: derived.birthDate, gender: derived.gender } : {}),
                }));
              }}
              placeholder="Enter NIC Number"
            />
            {nicError(form.nic) && (
              <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: '#dc2626' }}>
                {nicError(form.nic)}
              </span>
            )}
          </div>

          <div>
            <label style={labelStyle}>Passport Retention</label>
            <select className="sr-input" style={inputStyle} value={form.passport_retention} onChange={(e) => set('passport_retention', e.target.value)}>
              <option value="">-- Select --</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>

          {form.passport_retention === 'yes' && (
            <>
              <div>
                <label style={labelStyle}>Passport Collected Date</label>
                <DatePicker style={inputStyle} value={form.passport_collected_date} onChange={(iso) => set('passport_collected_date', iso)} />
              </div>
              <div>
                <label style={labelStyle}>Passport Number</label>
                <input
                  className="sr-input"
                  style={inputStyle}
                  value={form.passport_number}
                  onChange={(e) => set('passport_number', e.target.value.toUpperCase())}
                  placeholder="e.g. N1234567"
                />
                {passportError(form.passport_number) && (
                  <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: '#dc2626' }}>
                    {passportError(form.passport_number)}
                  </span>
                )}
              </div>
            </>
          )}

          <div>
            <label style={labelStyle}>Birth Date</label>
            <input
              className="sr-input"
              style={{ ...inputStyle, background: 'var(--row-border, #f3f4f6)' }}
              value={form.birth_date}
              readOnly
              placeholder="Auto-filled from NIC"
              title="Auto-filled from NIC number"
            />
          </div>
          <div>
            <label style={labelStyle}>Gender</label>
            <input
              className="sr-input"
              style={{ ...inputStyle, background: 'var(--row-border, #f3f4f6)' }}
              value={form.gender}
              readOnly
              placeholder="Auto-filled from NIC"
              title="Auto-filled from NIC number"
            />
          </div>

          <div>
            <label style={labelStyle}>Email Address</label>
            <input className="sr-input" style={inputStyle} value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Phone Number <span style={{ color: '#dc2626' }}>*</span></label>
            <input className="sr-input" style={inputStyle} value={form.phone_number} onChange={(e) => set('phone_number', e.target.value)} maxLength={10} />
            {phoneError(form.phone_number) && (
              <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: '#dc2626' }}>
                {phoneError(form.phone_number)}
              </span>
            )}
          </div>
          <div>
            <label style={labelStyle}>WhatsApp Number</label>
            <input className="sr-input" style={inputStyle} value={form.whatsapp_number} onChange={(e) => set('whatsapp_number', e.target.value)} maxLength={10} />
            {phoneError(form.whatsapp_number) && (
              <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: '#dc2626' }}>
                {phoneError(form.whatsapp_number)}
              </span>
            )}
          </div>

          <div>
            <label style={labelStyle}>Province of Residence</label>
            <select className="sr-input" style={inputStyle} value={locSel.province} onChange={(e) => onProvinceChange(e.target.value)}>
              <option value="">-- Select Province --</option>
              {provinces.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>District</label>
            <select className="sr-input" style={inputStyle} value={locSel.district} onChange={(e) => onDistrictChange(e.target.value)} disabled={!locSel.province}>
              <option value="">-- Select District --</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Divisional Secretariat</label>
            <select className="sr-input" style={inputStyle} value={locSel.ds} onChange={(e) => onDsChange(e.target.value)} disabled={!locSel.district}>
              <option value="">-- Select DS Division --</option>
              {dsDivisions.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Grama Niladhari Division</label>
            <select className="sr-input" style={inputStyle} value={locSel.gn} onChange={(e) => onGnChange(e.target.value)} disabled={!locSel.ds}>
              <option value="">-- Select GN Division --</option>
              {gnDivisions.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Staff Coordinator</label>
            <select className="sr-input" style={inputStyle} value={form.staff_coordinator} onChange={(e) => set('staff_coordinator', e.target.value)}>
              <option value="">-- Select Staff Coordinator --</option>
              {staff.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Agent</label>
            <input className="sr-input" style={inputStyle} value={form.agent} onChange={(e) => set('agent', e.target.value)} />
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.other_coordinator} onChange={(e) => set('other_coordinator', e.target.checked)} />
              Other Coordinator
            </label>
            {form.other_coordinator && (
              <>
                <input className="sr-input" style={{ ...inputStyle, width: isMobile ? '100%' : 240 }} placeholder="Other Coordinator Name" value={form.other_coordinator_name} onChange={(e) => set('other_coordinator_name', e.target.value)} />
                <input className="sr-input" style={{ ...inputStyle, width: isMobile ? '100%' : 220 }} placeholder="Coordinator Mobile" maxLength={10} value={form.other_coordinator_mobile} onChange={(e) => set('other_coordinator_mobile', e.target.value)} />
              </>
            )}
          </div>

          <div>
            <label style={labelStyle}>Photo Preview</label>
            <img src={passportPreview || DEFAULT_PROFILE_IMAGE} alt="passport" style={{ width: 96, height: 120, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--row-border, #f3f4f6)' }} />
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <button className="sr-btn-primary" onClick={handleSave} disabled={saving} style={{ padding: '11px 22px', borderRadius: 8, fontSize: 14 }}>
            {saving ? 'Saving…' : isEdit ? 'Update Section 1' : 'Save Section 1'}
          </button>
        </div>
      </div>

      {/* Attendance QR — available once a candidate exists */}
      {isEdit && candidate && (
        <div style={cardStyle}>
          <div style={{ color: 'var(--accent, #6366f1)', fontWeight: 700, marginBottom: 4 }}>Attendance QR</div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border-soft)', margin: '10px 0 18px' }} />
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <div ref={qrRef} style={{ padding: 12, background: 'white', borderRadius: 10, border: '1px solid var(--border)' }}>
              <QRCodeCanvas value={candidateRegNo} size={160} includeMargin />
            </div>
            <div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>Encodes Candidate Reg. No</div>
              <div style={{ fontWeight: 600, marginBottom: 14 }}>{candidateRegNo}</div>
              {form.passport_retention === 'yes' && (
                <button className="sr-btn-primary" onClick={printPassportDocs} style={{ padding: '10px 18px', borderRadius: 8, fontSize: 14 }}>
                  Print Passport Card + Sticker
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Section 2: Training Details ─────────────────────────────────── */}
      {isEdit && candidate && !section1Done && (
        <LockedSectionCard no="02" title="Training Details" needNo={1} />
      )}
      {isEdit && candidate && section1Done && (
        <div style={cardStyle}>
          <div style={{ color: 'var(--accent, #6366f1)', fontWeight: 700, marginBottom: 4 }}>
            02. Training Details
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border-soft)', margin: '10px 0 18px' }} />

          {/* 2.1 Training Bond */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ maxWidth: 480 }}>
              <label style={labelStyle}>Training Bond (Attach)</label>
              <input
                className="sr-input"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                style={inputStyle}
                onChange={(e) => setTrainingBondFile(e.target.files?.[0] ?? null)}
              />
              {training.training_bond_url && !trainingBondFile && (
                <a
                  href={training.training_bond_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 12, color: 'var(--accent, #6366f1)', marginTop: 4, display: 'block' }}
                >
                  View current bond document
                </a>
              )}
            </div>
          </div>

          {/* 2.1b Pre-Test Trade — the code drives every test number below. */}
          <div style={{ marginBottom: 24, border: '1px solid var(--border-soft)', borderRadius: 10, padding: '16px 20px', background: 'var(--row-bg,#fafafa)' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent,#6366f1)', marginBottom: 12 }}>Trade</div>
            <div style={{ maxWidth: 480 }}>
              <label style={labelStyle}>Trade (Job Category)</label>
              <select
                className="sr-input"
                style={inputStyle}
                value={training.pre_test_job_category_id ?? ''}
                onChange={(e) => setTraining((t) => ({ ...t, pre_test_job_category_id: e.target.value ? Number(e.target.value) : null }))}
              >
                <option value="">-- Select Trade --</option>
                {jobCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
              Each pre-test cycle and the final test get their own unique test number, generated below.
            </div>
            {preTestTrade && !preTestTrade.code && (
              <div style={{ fontSize: 12, color: 'oklch(0.55 0.16 25)', marginTop: 8 }}>
                This trade has no code — add one on the Job Categories page to generate test numbers.
              </div>
            )}
          </div>

          {/* 2.2 Pre-Test Cycles — always shown */}
          {(
            <div style={{ marginBottom: 28 }}>
              {training.pre_test_cycles.map((cycle, idx) => {
                const attendCount = cycle.attendance_records.length;
                // Only "training" candidates are gated; skill/unskill are already qualified.
                const gatePreTest = form.candidate_skill === 'training';
                const canTest = !gatePreTest || attendCount >= PRE_TEST_MIN_ATTENDANCE;
                const isFail = cycle.test_result === 'fail';
                const isPass = cycle.test_result === 'pass';
                const isLast = idx === training.pre_test_cycles.length - 1;

                return (
                  <div
                    key={cycle.cycle_no}
                    style={{
                      border: `1.5px solid ${isPass ? 'oklch(0.75 0.15 150)' : isFail ? 'oklch(0.75 0.18 25)' : 'var(--border-soft)'}`,
                      borderRadius: 10,
                      padding: '16px 20px',
                      marginBottom: 16,
                      background: isPass ? 'oklch(0.98 0.01 150)' : isFail ? 'oklch(0.99 0.01 25)' : 'var(--row-bg,#fafafa)',
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent,#6366f1)' }}>
                        Pre Test — Cycle {cycle.cycle_no}
                      </span>
                      {isPass && <span style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.42 0.14 150)', background: 'oklch(0.92 0.05 150)', padding: '2px 8px', borderRadius: 20 }}>✓ PASS</span>}
                      {isFail && <span style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.42 0.16 25)', background: 'oklch(0.93 0.05 25)', padding: '2px 8px', borderRadius: 20 }}>✗ FAIL</span>}
                    </div>

                    {/* Test Number — one unique number per cycle, generated before the test */}
                    <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                      <label style={{ ...labelStyle, marginBottom: 0 }}>Test Number</label>
                      {cycle.test_number ? (
                        <>
                          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1, color: '#16a34a' }}>{cycle.test_number}</span>
                          <button
                            type="button"
                            className="sr-btn-primary"
                            onClick={() => printTestId(cycle.test_number!)}
                            style={{ padding: '7px 13px', borderRadius: 7, fontSize: 12 }}
                          >
                            Print Test ID (A4 ×2)
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="sr-btn-primary"
                          onClick={() => generateTestNumber('pre_test', cycle.cycle_no)}
                          disabled={testNumSaving === `cycle-${cycle.cycle_no}` || !training.pre_test_job_category_id}
                          style={{ padding: '8px 14px', borderRadius: 7, fontSize: 12 }}
                        >
                          {testNumSaving === `cycle-${cycle.cycle_no}` ? 'Generating…' : 'Generate Number'}
                        </button>
                      )}
                    </div>

                    {/* Attendance Sheet */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <label style={labelStyle}>Attendance Sheet</label>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
                          background: canTest ? 'oklch(0.92 0.05 150)' : 'oklch(0.93 0.03 260)',
                          color: canTest ? 'oklch(0.40 0.14 150)' : 'oklch(0.45 0.06 260)',
                        }}>
                          {gatePreTest
                            ? `${attendCount} / ${PRE_TEST_WINDOW_DAYS} days`
                            : `${attendCount} ${attendCount === 1 ? 'day' : 'days'}`}
                        </span>
                        {gatePreTest && !canTest && (
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                            Need 80% of the first {PRE_TEST_WINDOW_DAYS} days to unlock Pre Test
                          </span>
                        )}
                      </div>

                      {/* Table */}
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 10 }}>
                        <thead>
                          <tr style={{ background: 'var(--row-border,#f3f4f6)' }}>
                            <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--label-2)', borderBottom: '1px solid var(--border-soft)', width: 36 }}>#</th>
                            <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--label-2)', borderBottom: '1px solid var(--border-soft)' }}>Date &amp; Time</th>
                            <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--label-2)', borderBottom: '1px solid var(--border-soft)', width: 110 }}>Status</th>
                            <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--label-2)', borderBottom: '1px solid var(--border-soft)', width: 80 }}>Source</th>
                            <th style={{ padding: '7px 12px', borderBottom: '1px solid var(--border-soft)', width: 40 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...cycle.attendance_records]
                            .sort((a, b) => a.date.localeCompare(b.date))
                            .map((rec, ri) => (
                              <tr key={rec.date} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                                <td style={{ padding: '7px 12px', color: 'var(--muted)', fontSize: 12 }}>{ri + 1}</td>
                                <td style={{ padding: '7px 12px' }}>
                                  <span style={{ fontWeight: 500 }}>{rec.date}</span>
                                  {rec.time && <span style={{ marginLeft: 10, color: 'var(--muted)', fontSize: 12 }}>{rec.time}</span>}
                                </td>
                                <td style={{ padding: '7px 12px' }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', fontSize: 11, fontWeight: 700, color: 'oklch(0.40 0.14 150)', background: 'oklch(0.92 0.05 150)', padding: '3px 10px', borderRadius: 20 }}>
                                    <span aria-hidden>✓</span> Present
                                  </span>
                                </td>
                                <td style={{ padding: '7px 12px' }}>
                                  {rec.source === 'qr'
                                    ? <span style={{ fontSize: 10, fontWeight: 600, color: 'oklch(0.45 0.12 260)', background: 'oklch(0.94 0.03 260)', padding: '2px 7px', borderRadius: 20 }}>QR Scan</span>
                                    : <span style={{ fontSize: 10, color: 'var(--muted)', background: 'oklch(0.95 0 0)', padding: '2px 7px', borderRadius: 20 }}>Manual</span>
                                  }
                                </td>
                                <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                                  <button
                                    onClick={() => removeAttendanceRecord(cycle.cycle_no, rec.date)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.55 0.16 25)', fontSize: 16, lineHeight: 1, padding: '0 4px' }}
                                    title="Remove"
                                  >×</button>
                                </td>
                              </tr>
                            ))}
                          {cycle.attendance_records.length === 0 && (
                            <tr>
                              <td colSpan={5} style={{ padding: '10px 12px', color: 'var(--muted)', fontSize: 12, textAlign: 'center' }}>
                                No attendance yet — add manually or scan QR from mobile app
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>

                      {/* Add date row */}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <DatePicker
                          style={{ ...inputStyle, width: 180 }}
                          value={preAttDate[cycle.cycle_no] ?? ''}
                          onChange={(iso) => setPreAttDate((m) => ({ ...m, [cycle.cycle_no]: iso }))}
                        />
                        <button
                          className="sr-btn-primary"
                          style={{ padding: '8px 14px', borderRadius: 7, fontSize: 12 }}
                          onClick={async () => {
                            const v = preAttDate[cycle.cycle_no];
                            if (v) { await addAttendanceRecord(cycle.cycle_no, v); setPreAttDate((m) => ({ ...m, [cycle.cycle_no]: '' })); }
                          }}
                        >
                          + Add Date
                        </button>
                      </div>
                    </div>

                    {/* Pre-Test date + result */}
                    <div className="sr-grid-2" style={{ gap: 14 }}>
                      <div>
                        <label style={labelStyle}>Pre Test Date</label>
                        <DatePicker
                          style={{ ...inputStyle, opacity: canTest ? 1 : 0.45 }}
                          disabled={!canTest}
                          value={cycle.test_date ?? ''}
                          onChange={(iso) => updateCycle(cycle.cycle_no, { test_date: iso || null })}
                          title={!canTest ? 'Pre Test unlocks at 80% attendance of the first 7 days' : ''}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Result</label>
                        <select
                          className="sr-input"
                          style={{ ...inputStyle, opacity: canTest ? 1 : 0.45 }}
                          disabled={!canTest}
                          value={cycle.test_result ?? ''}
                          onChange={(e) => updateCycle(cycle.cycle_no, { test_result: (e.target.value || null) as 'pass' | 'fail' | null })}
                        >
                          <option value="">-- Select Result --</option>
                          <option value="pass">Pass</option>
                          <option value="fail">Fail</option>
                        </select>
                      </div>
                    </div>

                    {/* Agent — manually entered, per cycle */}
                    <div style={{ marginTop: 14 }}>
                      <label style={labelStyle}>Agent</label>
                      <input
                        className="sr-input"
                        style={inputStyle}
                        value={cycle.test_agent ?? ''}
                        onChange={(e) => updateCycle(cycle.cycle_no, { test_agent: e.target.value || null })}
                        placeholder="Who conducted the pre test"
                      />
                    </div>

                    {/* Print result sheet for this cycle */}
                    <div style={{ marginTop: 12 }}>
                      <button
                        type="button"
                        onClick={() => printResultSheet({ testLabel: `Pre Test — Cycle ${cycle.cycle_no}`, result: cycle.test_result, testDate: cycle.test_date, testNo: cycle.test_number })}
                        style={{ padding: '8px 14px', borderRadius: 7, fontSize: 12, background: 'var(--row-border,#f3f4f6)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        🖨 Print Result Sheet
                      </button>
                    </div>

                    {/* Add next cycle */}
                    {isFail && isLast && (
                      <div style={{ marginTop: 14 }}>
                        <button
                          className="sr-btn-primary"
                          style={{ padding: '8px 16px', borderRadius: 7, fontSize: 13 }}
                          onClick={addNextCycle}
                        >
                          + Add Cycle {cycle.cycle_no + 1}
                        </button>
                        <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--muted)' }}>
                          Add another pre test cycle for the candidate.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 2.3 Final Test — always shown */}
          {(
            <div
              style={{
                border: '1.5px solid oklch(0.78 0.14 260)',
                borderRadius: 10,
                padding: '16px 20px',
                background: 'oklch(0.985 0.008 260)',
                marginBottom: 20,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent,#6366f1)' }}>Final Test</span>
                {training.final_test_result === 'pass' && <span style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.42 0.14 150)', background: 'oklch(0.92 0.05 150)', padding: '2px 8px', borderRadius: 20 }}>✓ PASS</span>}
                {training.final_test_result === 'fail' && <span style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.42 0.16 25)', background: 'oklch(0.93 0.05 25)', padding: '2px 8px', borderRadius: 20 }}>✗ FAIL</span>}
              </div>

              {/* Test Number — unique number for the final test */}
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Test Number</label>
                {training.final_test_number ? (
                  <>
                    <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1, color: '#16a34a' }}>{training.final_test_number}</span>
                    <button
                      type="button"
                      className="sr-btn-primary"
                      onClick={() => printTestId(training.final_test_number!)}
                      style={{ padding: '7px 13px', borderRadius: 7, fontSize: 12 }}
                    >
                      Print Test ID (A4 ×2)
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="sr-btn-primary"
                    onClick={() => generateTestNumber('final_test')}
                    disabled={testNumSaving === 'final' || !training.pre_test_job_category_id}
                    style={{ padding: '8px 14px', borderRadius: 7, fontSize: 12 }}
                  >
                    {testNumSaving === 'final' ? 'Generating…' : 'Generate Number'}
                  </button>
                )}
              </div>

              {/* Attendance table */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <label style={labelStyle}>Attendance Sheet</label>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'oklch(0.96 0.02 260)', color: 'var(--muted)' }}>
                    {training.final_test_attendance_records.length} days (optional)
                  </span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 10 }}>
                  <thead>
                    <tr style={{ background: 'var(--row-border,#f3f4f6)' }}>
                      <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--label-2)', borderBottom: '1px solid var(--border-soft)', width: 40 }}>#</th>
                      <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--label-2)', borderBottom: '1px solid var(--border-soft)' }}>Date &amp; Time</th>
                      <th style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 600, fontSize: 11, color: 'var(--label-2)', borderBottom: '1px solid var(--border-soft)', width: 60 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...training.final_test_attendance_records]
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((rec, ri) => (
                        <tr key={rec.date} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                          <td style={{ padding: '7px 12px', color: 'var(--muted)', fontSize: 12 }}>{ri + 1}</td>
                          <td style={{ padding: '7px 12px' }}>
                            <span style={{ fontWeight: 500 }}>{rec.date}</span>
                            {rec.time && <span style={{ marginLeft: 10, color: 'var(--muted)', fontSize: 12 }}>{rec.time}</span>}
                          </td>
                          <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                            <button
                              onClick={() => removeAttendanceRecord('final', rec.date)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.55 0.16 25)', fontSize: 16, lineHeight: 1, padding: '0 4px' }}
                              title="Remove"
                            >×</button>
                          </td>
                        </tr>
                      ))}
                    {training.final_test_attendance_records.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ padding: '10px 12px', color: 'var(--muted)', fontSize: 12, textAlign: 'center' }}>
                          No attendance yet — optional for final test
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <DatePicker
                    style={{ ...inputStyle, width: 180 }}
                    value={finalAttDate}
                    onChange={setFinalAttDate}
                  />
                  <button
                    className="sr-btn-primary"
                    style={{ padding: '8px 14px', borderRadius: 7, fontSize: 12 }}
                    onClick={async () => {
                      if (finalAttDate) { await addAttendanceRecord('final', finalAttDate); setFinalAttDate(''); }
                    }}
                  >
                    + Add Date
                  </button>
                </div>
              </div>

              {/* Final test date + result */}
              <div className="sr-grid-2" style={{ gap: 14 }}>
                <div>
                  <label style={labelStyle}>Final Test Date</label>
                  <DatePicker
                    style={inputStyle}
                    value={training.final_test_date ?? ''}
                    onChange={(iso) => setTraining((t) => ({ ...t, final_test_date: iso || null }))}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Result</label>
                  <select
                    className="sr-input"
                    style={inputStyle}
                    value={training.final_test_result ?? ''}
                    onChange={(e) => setTraining((t) => ({ ...t, final_test_result: (e.target.value || null) as 'pass' | 'fail' | null }))}
                  >
                    <option value="">-- Select Result --</option>
                    <option value="pass">Pass</option>
                    <option value="fail">Fail</option>
                  </select>
                </div>
              </div>

              {/* Agent — manually entered */}
              <div style={{ marginTop: 14 }}>
                <label style={labelStyle}>Agent</label>
                <input
                  className="sr-input"
                  style={inputStyle}
                  value={training.final_test_agent ?? ''}
                  onChange={(e) => setTraining((t) => ({ ...t, final_test_agent: e.target.value || null }))}
                  placeholder="Who conducted the final test"
                />
              </div>

              {/* Print result sheet for the final test */}
              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => printResultSheet({ testLabel: 'Final Test', result: training.final_test_result, testDate: training.final_test_date, testNo: training.final_test_number })}
                  style={{ padding: '8px 14px', borderRadius: 7, fontSize: 12, background: 'var(--row-border,#f3f4f6)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  🖨 Print Result Sheet
                </button>
              </div>
            </div>
          )}

          {/* Save button */}
          <div style={{ marginTop: 8 }}>
            <button
              className="sr-btn-primary"
              onClick={saveTraining}
              disabled={trainingSaving}
              style={{ padding: '11px 22px', borderRadius: 8, fontSize: 14 }}
            >
              {trainingSaving ? 'Saving…' : 'Save Training Details'}
            </button>
          </div>
        </div>
      )}

      {/* ── Section 3: Personal Details (Attachment) ──────────────────────── */}
      {isEdit && candidate && !section2Done && (
        <LockedSectionCard no="03" title="Document Attachment" needNo={2} />
      )}
      {isEdit && candidate && section2Done && (
        <div style={cardStyle}>
          <div style={{ color: 'var(--accent, #6366f1)', fontWeight: 700, marginBottom: 4 }}>
            03. Document Attachment
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border-soft)', margin: '10px 0 18px' }} />

          <div className="sr-grid-2">
            {([
              { field: 'passport_size_photo', label: 'Passport Size Photo', hint: '826px x 1062px', accept: 'image/*' },
              { field: 'nic_color_copy', label: 'NIC Color Copy (Attach)' },
              { field: 'passport_color_copy', label: 'Passport Color Copy (Attach)' },
              { field: 'professional_certificate', label: 'Professional Certificate (Attach)' },
              { field: 'cv_copy', label: 'CV Copy (Attach)' },
            ] as { field: CandidateDocumentFileField; label: string; hint?: string; accept?: string }[]).map(
              ({ field, label, hint, accept }) => {
                const url = documents[`${field}_url` as keyof CandidateDocuments] as string | null;
                const picked = documentFiles[field];
                return (
                  <div key={field}>
                    <label style={labelStyle}>
                      {label}
                      {hint && <span style={{ color: 'oklch(0.62 0.19 25)', fontWeight: 400 }}> ({hint})</span>}
                    </label>
                    <input
                      className="sr-input"
                      type="file"
                      accept={accept ?? '.pdf,.jpg,.jpeg,.png'}
                      style={inputStyle}
                      onChange={(e) => setDocFile(field, e.target.files?.[0] ?? null)}
                    />
                    {url && !picked && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 12, color: 'var(--accent, #6366f1)', marginTop: 4, display: 'block' }}
                      >
                        View current file
                      </a>
                    )}
                  </div>
                );
              },
            )}

            {/* Service Letter — supports multiple files. */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Service Letter (Attach — multiple allowed)</label>
              <input
                className="sr-input"
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                style={inputStyle}
                onChange={(e) => {
                  // Materialise the FileList into an array *before* clearing the
                  // input, otherwise resetting value empties it first.
                  const picked = Array.from(e.target.files ?? []);
                  e.target.value = '';
                  addServiceLetterFiles(picked);
                }}
              />
              {(documents.working_experience_files.length > 0 || serviceLetterFiles.length > 0) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {documents.working_experience_files.map((f) => (
                    <span
                      key={f.path}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '2px 8px', borderRadius: 6, background: 'var(--border-soft, #eef)', }}
                    >
                      <a href={f.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent, #6366f1)' }}>
                        {f.path.split('/').pop()}
                      </a>
                      <button
                        type="button"
                        onClick={() => removeStoredServiceLetterFile(f.path)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'oklch(0.62 0.19 25)', fontWeight: 700 }}
                        title="Remove"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {serviceLetterFiles.map((file, i) => (
                    <span
                      key={`new-${i}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '2px 8px', borderRadius: 6, background: 'oklch(0.95 0.05 145)', }}
                    >
                      {file.name}
                      <button
                        type="button"
                        onClick={() => removeServiceLetterFile(i)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'oklch(0.62 0.19 25)', fontWeight: 700 }}
                        title="Remove"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Police report attachments — multiple files, upload history kept with dates. */}
            {([
              { field: 'police_certificate', label: 'Police Certificate Attachment' },
              { field: 'certified_police_report', label: 'Certified Police Report Attachment' },
            ] as { field: CandidateDatedFileField; label: string }[]).map(({ field, label }) => (
              <div key={field} style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>{label} (multiple allowed)</label>
                <input
                  className="sr-input"
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png"
                  style={inputStyle}
                  onChange={(e) => {
                    // Materialise the FileList before clearing the input value.
                    const picked = Array.from(e.target.files ?? []);
                    e.target.value = '';
                    addDatedFiles(field, picked);
                  }}
                />
                {(documents[`${field}_files`].length > 0 || datedFiles[field].length > 0) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                    {documents[`${field}_files`].map((f) => (
                      <div
                        key={f.path}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}
                      >
                        <span style={{ color: 'var(--muted)', minWidth: 92 }}>{f.uploaded_at ?? '—'}</span>
                        <a href={f.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent, #6366f1)', flex: 1 }}>
                          {f.path.split('/').pop()}
                        </a>
                        <button
                          type="button"
                          onClick={() => removeStoredDatedFile(field, f.path)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'oklch(0.62 0.19 25)', fontWeight: 700 }}
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {datedFiles[field].map((file, i) => (
                      <div
                        key={`new-${i}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}
                      >
                        <span style={{ color: 'oklch(0.55 0.15 145)', minWidth: 92 }}>new</span>
                        <span style={{ flex: 1 }}>{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeDatedFile(field, i)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'oklch(0.62 0.19 25)', fontWeight: 700 }}
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div>
              <label style={labelStyle}>Police Report Expire Date</label>
              <DatePicker
                style={inputStyle}
                value={documents.police_report_expire_date ?? ''}
                onChange={(iso) => setDocDate('police_report_expire_date', iso)}
              />
            </div>
            <div>
              <label style={labelStyle}>Document Submit Date</label>
              <DatePicker
                style={inputStyle}
                value={documents.document_submission_date ?? ''}
                onChange={(iso) => setDocDate('document_submission_date', iso)}
              />
            </div>
            <div>
              <label style={labelStyle}>Document Re-submission Date</label>
              <DatePicker
                style={inputStyle}
                value={documents.document_resubmission_date ?? ''}
                onChange={(iso) => setDocDate('document_resubmission_date', iso)}
              />
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <button
              className="sr-btn-primary"
              onClick={saveDocuments}
              disabled={documentsSaving}
              style={{ padding: '11px 22px', borderRadius: 8, fontSize: 14 }}
            >
              {documentsSaving ? 'Saving…' : 'Save Section 3'}
            </button>
          </div>
        </div>
      )}

      {/* ── Section 4: Job & Visa Processing (country-scoped) ─────────────── */}
      {isEdit && candidate && !section3Done && (
        <LockedSectionCard no="04" title="Job & Visa Processing" needNo={3} />
      )}
      {isEdit && candidate && section3Done && (
        <div style={cardStyle}>
          <div style={{ color: 'var(--accent, #6366f1)', fontWeight: 700, marginBottom: 4 }}>
            04. Job &amp; Visa Processing
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border-soft)', margin: '10px 0 18px' }} />

          {!form.country && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', color: 'var(--muted)', fontSize: 13 }}>
              Select a country in Section 1 first — the visa workflow differs by country.
            </div>
          )}

          {/* Romania workflow */}
          {form.country === 'Romania' && (
            <div className="sr-grid-3" style={{ marginBottom: 20 }}>
              <VisaDate label="Offer Letter Date" field="offer_letter_date" />
              <VisaDate label="Confirmation Letter Date" field="confirmation_letter_date" />
              <VisaDate label="Document Submission Date" field="document_submission_date" />
              <VisaDate label="Work Permit Received Date" field="work_permit_received_date" />
              <VisaDate label="Embassy Submission Date" field="embassy_submission_date" />
              <VisaDate label="Police Report Issued Date" field="police_report_issued_date" />
              <VisaDate label="Process Interview Date" field="process_interview_date" />
              <VisaDate label="Visa Received Date" field="visa_received_date" />
            </div>
          )}

          {/* Israel workflow */}
          {form.country === 'Israel' && (
            <div className="sr-grid-3" style={{ marginBottom: 20 }}>
              <VisaDate label="Agreement Sign Date" field="agreement_sign_date" />
              <VisaDate label="Police Report Date" field="police_report_date" />
            </div>
          )}

          {/* Common — Visa status (+ date) & PIBA submission (both countries) */}
          {form.country && (
            <div className="sr-grid-3">
              <div>
                <label style={labelStyle}>Visa Status</label>
                <select
                  className="sr-input"
                  style={inputStyle}
                  value={visa.visa_status ?? ''}
                  onChange={(e) => setVisaField('visa_status', (e.target.value || null) as VisaStatus | null)}
                >
                  <option value="">-- Select Visa Status --</option>
                  <option value="visa_received">Visa Received</option>
                  <option value="visa_cancel">Visa Cancel</option>
                </select>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                  Saving a status sends an SMS to the candidate.
                </span>
              </div>
              <VisaDate label="Visa Status Date" field="visa_status_date" />
              <div>
                <label style={labelStyle}>PIBA Submission Status</label>
                <select
                  className="sr-input"
                  style={inputStyle}
                  value={visa.piba_submission_status ?? ''}
                  onChange={(e) => setVisaField('piba_submission_status', (e.target.value || null) as PibaSubmissionStatus | null)}
                >
                  <option value="">-- Select PIBA Status --</option>
                  <option value="submitted">Submitted</option>
                  <option value="not_yet_submitted">Not Yet Submitted</option>
                </select>
              </div>
            </div>
          )}

          {form.country && (
            <div style={{ marginTop: 24 }}>
              <button
                className="sr-btn-primary"
                onClick={saveVisa}
                disabled={visaSaving}
                style={{ padding: '11px 22px', borderRadius: 8, fontSize: 14 }}
              >
                {visaSaving ? 'Saving…' : 'Save Section 4'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Section 5: Departure Details ──────────────────────────────────── */}
      {isEdit && candidate && !section4Done && (
        <LockedSectionCard no="05" title="Departure Details" needNo={4} />
      )}
      {isEdit && candidate && section4Done && (
        <div style={cardStyle}>
          <div style={{ color: 'var(--accent, #6366f1)', fontWeight: 700, marginBottom: 4 }}>
            05. Departure Details
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border-soft)', margin: '10px 0 18px' }} />

          <div className="sr-grid-2">
            <div>
              <label style={labelStyle}>Final Approval Date</label>
              <DatePicker
                style={inputStyle}
                value={departure.final_approval_date ?? ''}
                onChange={(v) => setDeparture((s) => ({ ...s, final_approval_date: v || null }))}
              />
            </div>

            <div>
              <label style={labelStyle}>Receipt Number</label>
              <input
                className="sr-input"
                style={inputStyle}
                value={departure.receipt_number || ''}
                onChange={(e) => setDeparture((s) => ({ ...s, receipt_number: e.target.value }))}
                placeholder="Enter receipt number"
              />
            </div>

            <div>
              <label style={labelStyle}>Flight Number</label>
              <input
                className="sr-input"
                style={inputStyle}
                value={departure.flight_number || ''}
                onChange={(e) => setDeparture((s) => ({ ...s, flight_number: e.target.value }))}
                placeholder="Enter flight number"
              />
            </div>

            <div>
              <label style={labelStyle}>Airticket Number</label>
              <input
                className="sr-input"
                style={inputStyle}
                value={departure.airticket_number || ''}
                onChange={(e) => setDeparture((s) => ({ ...s, airticket_number: e.target.value }))}
                placeholder="Enter airticket number"
              />
            </div>

            <div>
              <label style={labelStyle}>Departure Date</label>
              <DatePicker
                style={inputStyle}
                value={departure.departure_date ?? ''}
                onChange={(v) => setDeparture((s) => ({ ...s, departure_date: v || null }))}
              />
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <button
              className="sr-btn-primary"
              onClick={saveDeparture}
              disabled={departureSaving}
              style={{ padding: '11px 22px', borderRadius: 8, fontSize: 14 }}
            >
              {departureSaving ? 'Saving…' : 'Save Section 5'}
            </button>
          </div>
        </div>
      )}

      {/* ── Section 6: Employee Details ───────────────────────────────────── */}
      {isEdit && candidate && !section5Done && (
        <LockedSectionCard no="06" title="Employee Details" needNo={5} />
      )}
      {isEdit && candidate && section5Done && (
        <div style={cardStyle}>
          <div style={{ color: 'var(--accent, #6366f1)', fontWeight: 700, marginBottom: 4 }}>
            06. Employee Details
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border-soft)', margin: '10px 0 18px' }} />

          <div className="sr-grid-2">
            <div>
              <label style={labelStyle}>Registration Number</label>
              <input
                className="sr-input"
                style={inputStyle}
                value={employee.registration_number || ''}
                onChange={(e) =>
                  setEmployee((s) => ({ ...s, registration_number: e.target.value }))
                }
                placeholder="Enter registration number"
              />
              <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Type the registration number manually.
              </span>
            </div>

            <div>
              <label style={labelStyle}>Job Category</label>
              <select
                className="sr-input"
                style={inputStyle}
                value={employee.job_category_id ?? ''}
                onChange={(e) =>
                  setEmployee((s) => ({ ...s, job_category_id: e.target.value ? Number(e.target.value) : null }))
                }
              >
                <option value="">-- Select Job Category --</option>
                {jobCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Manage the list on the <strong>Job Categories</strong> page.
              </span>
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <button
              className="sr-btn-primary"
              onClick={saveEmployee}
              disabled={employeeSaving}
              style={{ padding: '11px 22px', borderRadius: 8, fontSize: 14 }}
            >
              {employeeSaving ? 'Saving…' : 'Save Section 6'}
            </button>
          </div>
        </div>
      )}

      {/* Sections & staff assignment (sequential hand-off) */}
      {isEdit && candidate && (
        <div style={cardStyle}>
          <div style={{ color: 'var(--accent, #6366f1)', fontWeight: 700, marginBottom: 4 }}>Sections &amp; Staff Assignment</div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border-soft)', margin: '10px 0 18px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SECTION_TITLES.map((title, i) => {
              const n = i + 1;
              const sec = sectionByNo(n);
              const prev = sectionByNo(n - 1);
              const submitted = sec?.status === 'submitted';
              const prevDone = n === 1 || prev?.status === 'submitted';
              const staffIds = sec?.assigned_staff_ids ?? [];
              const staffLabel = staffIds.length
                ? staffIds.map((id) => staffName(String(id))).join(', ')
                : '—';
              const mine = isAdmin || (user != null && staffIds.includes(Number(user.id)));
              return (
                <div
                  key={n}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '30px 1fr' : '30px 1.6fr 1.4fr 150px',
                    gap: 12,
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: submitted ? 'oklch(0.97 0.02 150)' : 'var(--row-bg, #fafafa)',
                    border: '1px solid var(--border-soft)',
                  }}
                >
                  <div style={{ fontWeight: 700, color: 'var(--muted)' }}>{n}</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                    {staffLabel}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {submitted ? (
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'oklch(0.45 0.12 150)' }}>✓ Submitted</span>
                    ) : !prevDone ? (
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>Locked</span>
                    ) : mine ? (
                      <button
                        onClick={() => submitSection(n)}
                        className="sr-btn-primary"
                        style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12 }}
                      >
                        Submit
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                        Waiting · {staffLabel}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
            Staff are set globally in <strong>Section Assignment</strong>.
          </div>
        </div>
      )}
    </div>
  );
}
