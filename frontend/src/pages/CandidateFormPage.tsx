import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { api } from '../api/client';
import { toastError, toastSuccess } from '../lib/alerts';
import { useAuth } from '../auth/AuthContext';
import type { Candidate, CandidateDocumentFileField, CandidateDocuments, CandidateSection, CandidateTraining, CandidateVisaDetails, PibaSubmissionStatus, PreTestCycle, Staff, TrainingMode, VisaStatus } from '../types';

const SECTION_TITLES = [
  'Personal Details',
  'Training Details',
  'Document Attachment',
  'Job & Visa Processing',
];

const COUNTRY_LETTER: Record<string, string> = { Romania: 'R', Israel: 'I' };

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

  if (/^\d{9}[VX]$/.test(nic)) {
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
    pre_test_cycles: [],
    final_test_attendance_records: [],
    final_test_date: null,
    final_test_result: null,
  };
  const [training, setTraining] = useState<CandidateTraining>(EMPTY_TRAINING);
  const [trainingSaving, setTrainingSaving] = useState(false);

  // Section 3 — Personal Details (Attachment)
  const EMPTY_DOCUMENTS: CandidateDocuments = {
    passport_size_photo_url: null,
    nic_color_copy_url: null,
    passport_color_copy_url: null,
    professional_certificate_url: null,
    working_experience_url: null,
    cv_copy_url: null,
    local_pcc_url: null,
    second_pcc_color_copy_url: null,
    local_pcc_attach_date: null,
    second_pcc_submit_date: null,
    document_submission_date: null,
  };
  const [documents, setDocuments] = useState<CandidateDocuments>(EMPTY_DOCUMENTS);
  const [documentFiles, setDocumentFiles] = useState<Partial<Record<CandidateDocumentFileField, File>>>({});
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
        .then((r) => setTraining(r.data))
        .catch(() => setTraining(EMPTY_TRAINING));
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
    setSaving(true);
    try {
      if (isEdit) {
        const fd = buildFormData();
        fd.append('_method', 'PUT');
        const r = await api.post<Candidate>(`/candidates/${id}`, fd);
        hydrate(r.data);
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

  function printQr() {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const w = window.open('', '_blank', 'width=800,height=1000');
    if (!w) return;
    w.document.write(`
      <html><head><title>Attendance QR</title>
      <style>
        @page { size: A5; margin: 12mm; }
        body { font-family: system-ui, sans-serif; text-align: center; }
        h2 { margin: 0 0 4px; } p { margin: 2px 0; color: #444; }
        img { width: 320px; height: 320px; margin-top: 24px; }
      </style></head>
      <body onload="window.print(); setTimeout(()=>window.close(), 300);">
        <h2>Attendance QR</h2>
        <p>${form.full_name || ''}</p>
        <p>${candidateRegNo}</p>
        <img src="${dataUrl}" />
      </body></html>`);
    w.document.close();
  }

  const staffName = (sid: string) => staff.find((s) => String(s.id) === sid)?.name ?? '—';
  const sectionByNo = (n: number): CandidateSection | undefined =>
    candidate?.sections?.find((s) => s.section_no === n);

  // Sequential unlock: a section's edit card opens only once the previous one is submitted.
  const isSectionSubmitted = (n: number) => sectionByNo(n)?.status === 'submitted';
  const section1Done = isSectionSubmitted(1);
  const section2Done = isSectionSubmitted(2);
  const section3Done = isSectionSubmitted(3);

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

  function setTrainingMode(mode: TrainingMode) {
    setTraining((prev) => {
      const cycles =
        (mode === 'pre_test' || mode === 'both') && prev.pre_test_cycles.length === 0
          ? [{ cycle_no: 1, attendance_records: [], test_date: null, test_result: null }]
          : prev.pre_test_cycles;
      return { ...prev, training_mode: mode, pre_test_cycles: cycles };
    });
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
          { cycle_no: nextNo, attendance_records: [], test_date: null, test_result: null },
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
      setTraining(r.data);
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
      setTraining(r.data);
    } catch {
      toastError('Could not remove attendance.');
    }
  }

  /** True if any pre-test cycle has result = 'pass'. */
  const preTestPassed = training.pre_test_cycles.some((c) => c.test_result === 'pass');

  /** True when the final test section is unlocked. */
  const finalTestUnlocked =
    training.training_mode === 'final_test' ||
    ((training.training_mode === 'pre_test' || training.training_mode === 'both') && preTestPassed);

  async function saveTraining() {
    setTrainingSaving(true);
    try {
      const fd = new FormData();
      fd.append('training_mode', training.training_mode ?? '');
      fd.append('pre_test_cycles', JSON.stringify(training.pre_test_cycles));
      fd.append('final_test_attendance_records', JSON.stringify(training.final_test_attendance_records));
      fd.append('final_test_date', training.final_test_date ?? '');
      fd.append('final_test_result', training.final_test_result ?? '');
      if (trainingBondFile) fd.append('training_bond', trainingBondFile);
      const r = await api.post<CandidateTraining>(`/candidates/${id}/training`, fd);
      setTraining(r.data);
      setTrainingBondFile(null);
      await markSectionComplete(2); // completing Section 2 unlocks Section 3
      toastSuccess('Training details saved');
    } catch {
      toastError('Could not save training details.');
    } finally {
      setTrainingSaving(false);
    }
  }

  // ── Section 3: Documents helpers ──────────────────────────────────────────

  const setDocDate = (key: 'local_pcc_attach_date' | 'second_pcc_submit_date' | 'document_submission_date', value: string) =>
    setDocuments((d) => ({ ...d, [key]: value || null }));

  const setDocFile = (field: CandidateDocumentFileField, file: File | null) =>
    setDocumentFiles((prev) => {
      const next = { ...prev };
      if (file) next[field] = file;
      else delete next[field];
      return next;
    });

  async function saveDocuments() {
    if (!id) return;
    setDocumentsSaving(true);
    try {
      const fd = new FormData();
      (Object.entries(documentFiles) as [CandidateDocumentFileField, File][]).forEach(([field, file]) => {
        fd.append(field, file);
      });
      fd.append('local_pcc_attach_date', documents.local_pcc_attach_date ?? '');
      fd.append('second_pcc_submit_date', documents.second_pcc_submit_date ?? '');
      fd.append('document_submission_date', documents.document_submission_date ?? '');
      const r = await api.post<CandidateDocuments>(`/candidates/${id}/documents`, fd);
      setDocuments(r.data);
      setDocumentFiles({});
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

  // A labelled date input bound to a visa field (compact helper for the grid).
  const VisaDate = ({ label, field }: { label: string; field: keyof CandidateVisaDetails }) => (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        className="sr-input"
        type="date"
        style={inputStyle}
        value={(visa[field] as string | null) ?? ''}
        onChange={(e) => setVisaDate(field, e.target.value)}
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
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
            <input className="sr-input" type="date" style={inputStyle} value={form.registration_date} onChange={(e) => set('registration_date', e.target.value)} />
          </div>

          <div>
            <label style={labelStyle}>Passport Size Photo (Profile)</label>
            <input className="sr-input" type="file" accept="image/*" style={inputStyle} onChange={(e) => onPassportChange(e.target.files?.[0] ?? null)} />
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
                <input className="sr-input" type="date" style={inputStyle} value={form.passport_collected_date} onChange={(e) => set('passport_collected_date', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Passport Number</label>
                <input className="sr-input" style={inputStyle} value={form.passport_number} onChange={(e) => set('passport_number', e.target.value)} />
              </div>
            </>
          )}

          <div>
            <label style={labelStyle}>Birth Date</label>
            <input className="sr-input" style={inputStyle} value={form.birth_date} onChange={(e) => set('birth_date', e.target.value)} placeholder="YYYY/MM/DD" />
          </div>
          <div>
            <label style={labelStyle}>Gender</label>
            <select className="sr-input" style={inputStyle} value={form.gender} onChange={(e) => set('gender', e.target.value)}>
              <option value="">-- Select --</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Email Address</label>
            <input className="sr-input" style={inputStyle} value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Phone Number</label>
            <input className="sr-input" style={inputStyle} value={form.phone_number} onChange={(e) => set('phone_number', e.target.value)} maxLength={10} />
          </div>
          <div>
            <label style={labelStyle}>WhatsApp Number</label>
            <input className="sr-input" style={inputStyle} value={form.whatsapp_number} onChange={(e) => set('whatsapp_number', e.target.value)} maxLength={10} />
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

          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.other_coordinator} onChange={(e) => set('other_coordinator', e.target.checked)} />
              Other Coordinator
            </label>
            {form.other_coordinator && (
              <>
                <input className="sr-input" style={{ ...inputStyle, width: 240 }} placeholder="Other Coordinator Name" value={form.other_coordinator_name} onChange={(e) => set('other_coordinator_name', e.target.value)} />
                <input className="sr-input" style={{ ...inputStyle, width: 220 }} placeholder="Coordinator Mobile" maxLength={10} value={form.other_coordinator_mobile} onChange={(e) => set('other_coordinator_mobile', e.target.value)} />
              </>
            )}
          </div>

          {passportPreview && (
            <div>
              <label style={labelStyle}>Photo Preview</label>
              <img src={passportPreview} alt="passport" style={{ width: 96, height: 120, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
            </div>
          )}
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
              <button className="sr-btn-primary" onClick={printQr} style={{ padding: '10px 18px', borderRadius: 8, fontSize: 14 }}>
                Generate / Print (A5)
              </button>
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

          {/* 2.1 Training Bond + Mode row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <div>
              <label style={labelStyle}>Training Mode</label>
              <select
                className="sr-input"
                style={inputStyle}
                value={training.training_mode ?? ''}
                onChange={(e) => setTrainingMode(e.target.value as TrainingMode)}
              >
                <option value="">-- Select Training Mode --</option>
                <option value="pre_test">Pre Test</option>
                <option value="final_test">Final Test</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div>
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

          {/* Pre-Test Cycles (shown for pre_test / both) */}
          {/* 2.2 Pre-Test Cycles */}
          {(training.training_mode === 'pre_test' || training.training_mode === 'both') && (
            <div style={{ marginBottom: 28 }}>
              {training.pre_test_cycles.map((cycle, idx) => {
                const attendCount = cycle.attendance_records.length;
                const canTest = attendCount >= 7;
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

                    {/* Attendance Sheet */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <label style={labelStyle}>Attendance Sheet</label>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
                          background: canTest ? 'oklch(0.92 0.05 150)' : 'oklch(0.93 0.03 260)',
                          color: canTest ? 'oklch(0.40 0.14 150)' : 'oklch(0.45 0.06 260)',
                        }}>
                          {attendCount} / 7 days
                        </span>
                        {!canTest && <span style={{ fontSize: 11, color: 'var(--muted)' }}>Need at least 7 days to take Pre Test</span>}
                      </div>

                      {/* Table */}
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 10 }}>
                        <thead>
                          <tr style={{ background: 'var(--row-border,#f3f4f6)' }}>
                            <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--label-2)', borderBottom: '1px solid var(--border-soft)', width: 36 }}>#</th>
                            <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--label-2)', borderBottom: '1px solid var(--border-soft)' }}>Date &amp; Time</th>
                            <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--label-2)', borderBottom: '1px solid var(--border-soft)', width: 90 }}>Status</th>
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
                                  <span style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.40 0.14 150)', background: 'oklch(0.92 0.05 150)', padding: '2px 8px', borderRadius: 20 }}>
                                    ✓ Present
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
                        <input
                          type="date"
                          className="sr-input"
                          style={{ ...inputStyle, width: 180 }}
                          id={`att-pre-${cycle.cycle_no}`}
                        />
                        <button
                          className="sr-btn-primary"
                          style={{ padding: '8px 14px', borderRadius: 7, fontSize: 12 }}
                          onClick={async () => {
                            const el = document.getElementById(`att-pre-${cycle.cycle_no}`) as HTMLInputElement;
                            if (el?.value) { await addAttendanceRecord(cycle.cycle_no, el.value); el.value = ''; }
                          }}
                        >
                          + Add Date
                        </button>
                      </div>
                    </div>

                    {/* Pre-Test date + result */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div>
                        <label style={labelStyle}>Pre Test Date</label>
                        <input
                          type="date"
                          className="sr-input"
                          style={{ ...inputStyle, opacity: canTest ? 1 : 0.45 }}
                          disabled={!canTest}
                          value={cycle.test_date ?? ''}
                          onChange={(e) => updateCycle(cycle.cycle_no, { test_date: e.target.value || null })}
                          title={!canTest ? 'Need 7+ attendance days first' : ''}
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
                          Candidate must attend another 7 days before the next pre test.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 2.3 Final Test */}
          {training.training_mode && (
            <div
              style={{
                border: `1.5px solid ${finalTestUnlocked ? 'oklch(0.78 0.14 260)' : 'var(--border-soft)'}`,
                borderRadius: 10,
                padding: '16px 20px',
                background: finalTestUnlocked ? 'oklch(0.985 0.008 260)' : 'oklch(0.97 0 0)',
                marginBottom: 20,
                opacity: finalTestUnlocked ? 1 : 0.65,
                pointerEvents: finalTestUnlocked ? 'auto' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent,#6366f1)' }}>Final Test</span>
                {!finalTestUnlocked && (training.training_mode === 'pre_test' || training.training_mode === 'both') && (
                  <span style={{ fontSize: 11, color: 'var(--muted)', background: 'oklch(0.93 0.01 0)', padding: '2px 8px', borderRadius: 20 }}>
                    Locked — Pre Test must be passed first
                  </span>
                )}
                {training.final_test_result === 'pass' && <span style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.42 0.14 150)', background: 'oklch(0.92 0.05 150)', padding: '2px 8px', borderRadius: 20 }}>✓ PASS</span>}
                {training.final_test_result === 'fail' && <span style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.42 0.16 25)', background: 'oklch(0.93 0.05 25)', padding: '2px 8px', borderRadius: 20 }}>✗ FAIL</span>}
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
                  <input type="date" className="sr-input" style={{ ...inputStyle, width: 180 }} id="att-final" />
                  <button
                    className="sr-btn-primary"
                    style={{ padding: '8px 14px', borderRadius: 7, fontSize: 12 }}
                    onClick={async () => {
                      const el = document.getElementById('att-final') as HTMLInputElement;
                      if (el?.value) { await addAttendanceRecord('final', el.value); el.value = ''; }
                    }}
                  >
                    + Add Date
                  </button>
                </div>
              </div>

              {/* Final test date + result */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Final Test Date</label>
                  <input
                    type="date"
                    className="sr-input"
                    style={inputStyle}
                    value={training.final_test_date ?? ''}
                    onChange={(e) => setTraining((t) => ({ ...t, final_test_date: e.target.value || null }))}
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
            </div>
          )}

          {/* Save button */}
          {training.training_mode && (
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
          )}
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {([
              { field: 'passport_size_photo', label: 'Passport Size Photo', hint: '826px x 1062px', accept: 'image/*' },
              { field: 'nic_color_copy', label: 'NIC Color Copy (Attach)' },
              { field: 'passport_color_copy', label: 'Passport Color Copy (Attach)' },
              { field: 'professional_certificate', label: 'Professional Certificate (Attach)' },
              { field: 'working_experience', label: 'Attach Working Experience' },
              { field: 'cv_copy', label: 'CV Copy (Attach)' },
              { field: 'local_pcc', label: 'Local PCC (Attach)' },
              { field: 'second_pcc_color_copy', label: '2nd PCC Color Copy (Attach)' },
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

            <div>
              <label style={labelStyle}>Local PCC Attach Date</label>
              <input
                className="sr-input"
                type="date"
                style={inputStyle}
                value={documents.local_pcc_attach_date ?? ''}
                onChange={(e) => setDocDate('local_pcc_attach_date', e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>2nd PCC Submit Date</label>
              <input
                className="sr-input"
                type="date"
                style={inputStyle}
                value={documents.second_pcc_submit_date ?? ''}
                onChange={(e) => setDocDate('second_pcc_submit_date', e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Document Submission Date</label>
              <input
                className="sr-input"
                type="date"
                style={inputStyle}
                value={documents.document_submission_date ?? ''}
                onChange={(e) => setDocDate('document_submission_date', e.target.value)}
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
              <VisaDate label="Agreement Sign Date" field="agreement_sign_date" />
              <VisaDate label="Police Report Date" field="police_report_date" />
            </div>
          )}

          {/* Common — Visa status (+ date) & PIBA submission (both countries) */}
          {form.country && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
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
                    gridTemplateColumns: '30px 1.6fr 1.4fr 150px',
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
