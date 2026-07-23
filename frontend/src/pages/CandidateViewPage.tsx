import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { toastError } from '../lib/alerts';
import { useAuth } from '../auth/AuthContext';
import { can } from '../lib/permissions';
import type {
  AttendanceRecord,
  Candidate,
  CandidateDepartureDetails,
  CandidateDocuments,
  CandidateEmployeeDetails,
  CandidateTraining,
  CandidateVisaDetails,
  JobCategory,
} from '../types';

const SKILL_LABEL: Record<string, string> = {
  skill: 'Skill',
  unskill: 'Unskill',
  training: 'Training',
};


const VISA_STATUS_LABEL: Record<string, string> = {
  visa_received: 'Visa Received',
  visa_cancel: 'Visa Cancel',
};

const PIBA_STATUS_LABEL: Record<string, string> = {
  submitted: 'Submitted',
  not_yet_submitted: 'Not Yet Submitted',
};

/** Default profile placeholder shown when no passport photo is uploaded. */
const DEFAULT_PROFILE_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="112" height="144" viewBox="0 0 112 144">' +
      '<rect width="112" height="144" fill="#e5e7eb"/>' +
      '<circle cx="56" cy="54" r="26" fill="#9ca3af"/>' +
      '<path d="M16 132c0-24 18-40 40-40s40 16 40 40z" fill="#9ca3af"/>' +
      '</svg>',
  );

const cardStyle: React.CSSProperties = {
  background: 'var(--card)',
  borderRadius: 12,
  boxShadow: 'var(--card-shadow)',
  padding: 24,
  marginBottom: 20,
};
const sectionTitleStyle: React.CSSProperties = {
  color: 'var(--accent, #6366f1)',
  fontWeight: 700,
  marginBottom: 4,
};
const hrStyle: React.CSSProperties = {
  border: 'none',
  borderTop: '1px solid var(--border-soft)',
  margin: '10px 0 18px',
};
const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 4,
  color: 'var(--label-2)',
};
const valueStyle: React.CSSProperties = { fontSize: 14, fontWeight: 500, wordBreak: 'break-word' };

/** A single read-only label/value pair. */
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <div style={{ ...valueStyle, color: empty ? 'var(--muted)' : undefined }}>
        {empty ? '—' : value}
      </div>
    </div>
  );
}

/** A link to a stored file, or a muted dash when absent. */
function FileField({ label, url }: { label: string; url: string | null | undefined }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 14, fontWeight: 500, color: 'var(--accent, #6366f1)' }}
        >
          View file
        </a>
      ) : (
        <div style={{ ...valueStyle, color: 'var(--muted)' }}>—</div>
      )}
    </div>
  );
}

function MultiFileField({ label, files }: { label: string; files: { path: string; url: string }[] | undefined }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      {files && files.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {files.map((f) => (
            <a
              key={f.path}
              href={f.url}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 14, fontWeight: 500, color: 'var(--accent, #6366f1)' }}
            >
              {f.path.split('/').pop()}
            </a>
          ))}
        </div>
      ) : (
        <div style={{ ...valueStyle, color: 'var(--muted)' }}>—</div>
      )}
    </div>
  );
}

/** Dated attachment history: each entry links to the file and shows its upload date. */
function DatedFileField({
  label,
  files,
}: {
  label: string;
  files: { path: string; url: string; uploaded_at: string | null }[] | undefined;
}) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      {files && files.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {files.map((f) => (
            <div key={f.path} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)', minWidth: 92 }}>{f.uploaded_at ?? '—'}</span>
              <a
                href={f.url}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 14, fontWeight: 500, color: 'var(--accent, #6366f1)' }}
              >
                {f.path.split('/').pop()}
              </a>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ ...valueStyle, color: 'var(--muted)' }}>—</div>
      )}
    </div>
  );
}

// Extra style (beyond the responsive grid class) some grids need.
const gridMb16: React.CSSProperties = { marginBottom: 16 };
const gridMb20: React.CSSProperties = { marginBottom: 20 };

/** Read-only attendance list. */
function AttendanceList({ records }: { records: AttendanceRecord[] }) {
  if (records.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--muted)' }}>No attendance recorded.</div>;
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ background: 'var(--row-border,#f3f4f6)' }}>
          <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--label-2)', width: 40 }}>#</th>
          <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--label-2)' }}>Date &amp; Time</th>
          <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--label-2)', width: 90 }}>Source</th>
        </tr>
      </thead>
      <tbody>
        {[...records]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((rec, ri) => (
            <tr key={rec.date} style={{ borderBottom: '1px solid var(--border-soft)' }}>
              <td style={{ padding: '7px 12px', color: 'var(--muted)', fontSize: 12 }}>{ri + 1}</td>
              <td style={{ padding: '7px 12px' }}>
                <span style={{ fontWeight: 500 }}>{rec.date}</span>
                {rec.time && <span style={{ marginLeft: 10, color: 'var(--muted)', fontSize: 12 }}>{rec.time}</span>}
              </td>
              <td style={{ padding: '7px 12px', fontSize: 12, color: 'var(--muted)' }}>
                {rec.source === 'qr' ? 'QR Scan' : 'Manual'}
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}

function ResultBadge({ result }: { result: 'pass' | 'fail' | null }) {
  if (result === 'pass')
    return <span style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.42 0.14 150)', background: 'oklch(0.92 0.05 150)', padding: '2px 8px', borderRadius: 20 }}>✓ PASS</span>;
  if (result === 'fail')
    return <span style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.42 0.16 25)', background: 'oklch(0.93 0.05 25)', padding: '2px 8px', borderRadius: 20 }}>✗ FAIL</span>;
  return <span style={{ fontSize: 11, color: 'var(--muted)' }}>Pending</span>;
}

/** Collapsible section card. Completed sections start open; incomplete ones start closed. */
function SectionCard({
  title,
  complete,
  children,
}: {
  title: string;
  complete: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(complete);
  return (
    <div style={cardStyle}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <span style={{ ...sectionTitleStyle, marginBottom: 0 }}>{title}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!complete && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--muted)',
                background: 'var(--row-bg, #f3f4f6)',
                border: '1px solid var(--border-soft)',
                padding: '2px 10px',
                borderRadius: 20,
              }}
            >
              Not completed
            </span>
          )}
          <span
            style={{
              color: 'var(--muted)',
              fontSize: 12,
              display: 'inline-block',
              transform: open ? 'rotate(90deg)' : 'none',
              transition: 'transform .15s',
            }}
          >
            ▶
          </span>
        </span>
      </button>
      {open && (
        <>
          <hr style={hrStyle} />
          {children}
        </>
      )}
    </div>
  );
}

export default function CandidateViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = can(user, 'candidates.edit');

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [training, setTraining] = useState<CandidateTraining | null>(null);
  const [documents, setDocuments] = useState<CandidateDocuments | null>(null);
  const [visa, setVisa] = useState<CandidateVisaDetails | null>(null);
  const [employee, setEmployee] = useState<CandidateEmployeeDetails | null>(null);
  const [departure, setDeparture] = useState<CandidateDepartureDetails | null>(null);
  const [jobCategories, setJobCategories] = useState<JobCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      try {
        const c = await api.get<Candidate>(`/candidates/${id}`);
        if (!alive) return;
        setCandidate(c.data);
      } catch {
        if (alive) {
          toastError('Could not load candidate.');
          navigate('/candidates');
        }
        return;
      }
      // Section data is best-effort — a missing section just shows blanks.
      const [t, d, v, e, dep, jc] = await Promise.all([
        api.get<CandidateTraining>(`/candidates/${id}/training`).then((r) => r.data).catch(() => null),
        api.get<CandidateDocuments>(`/candidates/${id}/documents`).then((r) => r.data).catch(() => null),
        api.get<CandidateVisaDetails>(`/candidates/${id}/visa-details`).then((r) => r.data).catch(() => null),
        api.get<CandidateEmployeeDetails>(`/candidates/${id}/employee-details`).then((r) => r.data).catch(() => null),
        api.get<CandidateDepartureDetails>(`/candidates/${id}/departure-details`).then((r) => r.data).catch(() => null),
        api.get<JobCategory[]>('/job-categories').then((r) => r.data).catch(() => []),
      ]);
      if (!alive) return;
      setTraining(t);
      setDocuments(d);
      setVisa(v);
      setEmployee(e);
      setDeparture(dep);
      setJobCategories(jc ?? []);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [id, navigate]);

  if (loading || !candidate) {
    return (
      <div className="fade-in-s" style={{ maxWidth: 1080 }}>
        <button
          onClick={() => navigate('/candidates')}
          style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 12, fontFamily: 'inherit' }}
        >
          ← Back to candidates
        </button>
        <div style={{ ...cardStyle, color: 'var(--muted)', fontSize: 13 }}>Loading…</div>
      </div>
    );
  }

  const c = candidate;
  const isDone = (n: number) => c.sections?.find((s) => s.section_no === n)?.status === 'submitted';

  return (
    <div className="fade-in-s" style={{ maxWidth: 1080 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <button
            onClick={() => navigate('/candidates')}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 6, fontFamily: 'inherit' }}
          >
            ← Back to candidates
          </button>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{c.full_name || 'Candidate'}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>{c.registration_no}</div>
        </div>
        {canEdit && (
          <button
            className="sr-btn-primary"
            onClick={() => navigate(`/candidates/${c.id}`)}
            style={{ padding: '10px 18px', borderRadius: 8, fontSize: 14 }}
          >
            Edit
          </button>
        )}
      </div>

      {/* Section 1: Personal Details */}
      <SectionCard title="01. Personal Details" complete={isDone(1)}>
        <div style={{ display: 'flex', gap: 24, marginBottom: 20 }}>
          <img
            src={c.passport_image_url || DEFAULT_PROFILE_IMAGE}
            alt="passport"
            style={{ width: 96, height: 120, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', flexShrink: 0, background: 'var(--row-border, #f3f4f6)' }}
          />
          <div className="sr-grid-3" style={{ flex: 1 }}>
            <Field label="Registration No" value={c.registration_no} />
            <Field label="Candidate Reg. No" value={c.candidate_reg_no} />
            <Field label="Registration Date" value={c.registration_date ? c.registration_date.slice(0, 10) : null} />
            <Field label="Country" value={c.country} />
            <Field label="Candidate Skill" value={c.candidate_skill ? SKILL_LABEL[c.candidate_skill] : null} />
            <Field label="Name as in Passport" value={c.full_name} />
          </div>
        </div>

        <div className="sr-grid-3">
          <Field label="Address" value={c.address} />
          <Field label="NIC Number" value={c.nic} />
          <Field label="Birth Date" value={c.birth_date} />
          <Field label="Gender" value={c.gender} />
          <Field label="Passport Retention" value={c.passport_retention} />
          <Field label="Passport Collected Date" value={c.passport_collected_date} />
          <Field label="Passport Number" value={c.passport_number} />
          <Field label="Email Address" value={c.email} />
          <Field label="Phone Number" value={c.phone_number} />
          <Field label="WhatsApp Number" value={c.whatsapp_number} />
          <Field label="Province of Residence" value={c.province} />
          <Field label="District" value={c.district} />
          <Field label="Divisional Secretariat" value={c.ds_division} />
          <Field label="Grama Niladhari Division" value={c.gn_division} />
          <Field label="Staff Coordinator" value={c.staff_coordinator} />
          <Field label="Agent" value={c.agent} />
          {c.other_coordinator && (
            <>
              <Field label="Other Coordinator Name" value={c.other_coordinator_name} />
              <Field label="Other Coordinator Mobile" value={c.other_coordinator_mobile} />
            </>
          )}
        </div>
      </SectionCard>

      {/* Section 2: Training Details */}
      <SectionCard title="02. Training Details" complete={isDone(2)}>
        <div className="sr-grid-2" style={gridMb20}>
          <FileField label="Training Bond" url={training?.training_bond_url} />
          <Field label="Pre-Test Number" value={training?.pre_test_number ?? null} />
        </div>

        {(training?.pre_test_cycles?.length ?? 0) > 0 &&
          training!.pre_test_cycles.map((cycle) => (
            <div
              key={cycle.cycle_no}
              style={{ border: '1px solid var(--border-soft)', borderRadius: 10, padding: '16px 20px', marginBottom: 16, background: 'var(--row-bg,#fafafa)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent,#6366f1)' }}>
                  Pre Test — Cycle {cycle.cycle_no}
                </span>
                <ResultBadge result={cycle.test_result} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={labelStyle}>Attendance ({cycle.attendance_records.length} days)</div>
                <AttendanceList records={cycle.attendance_records} />
              </div>
              <div className="sr-grid-2">
                <Field label="Pre Test Date" value={cycle.test_date} />
                <Field label="Result" value={cycle.test_result ? (cycle.test_result === 'pass' ? 'Pass' : 'Fail') : null} />
              </div>
              <Field label="Agent" value={cycle.test_agent} />
            </div>
          ))}

        {training && (
          <div style={{ border: '1px solid var(--border-soft)', borderRadius: 10, padding: '16px 20px', background: 'var(--row-bg,#fafafa)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent,#6366f1)' }}>Final Test</span>
              <ResultBadge result={training.final_test_result} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={labelStyle}>Attendance ({training.final_test_attendance_records.length} days)</div>
              <AttendanceList records={training.final_test_attendance_records} />
            </div>
            <div className="sr-grid-2">
              <Field label="Final Test Date" value={training.final_test_date} />
              <Field label="Result" value={training.final_test_result ? (training.final_test_result === 'pass' ? 'Pass' : 'Fail') : null} />
            </div>
            <Field label="Agent" value={training.final_test_agent} />
          </div>
        )}

        {!training && (
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>No training details recorded yet.</div>
        )}
      </SectionCard>

      {/* Section 3: Document Attachment */}
      <SectionCard title="03. Document Attachment" complete={isDone(3)}>
        <div className="sr-grid-2">
          <FileField label="Passport Size Photo" url={documents?.passport_size_photo_url} />
          <FileField label="NIC Color Copy" url={documents?.nic_color_copy_url} />
          <FileField label="Passport Color Copy" url={documents?.passport_color_copy_url} />
          <FileField label="Professional Certificate" url={documents?.professional_certificate_url} />
          <MultiFileField label="Service Letter" files={documents?.working_experience_files} />
          <FileField label="CV Copy" url={documents?.cv_copy_url} />
          <DatedFileField label="Police Certificate" files={documents?.police_certificate_files} />
          <DatedFileField label="Certified Police Report" files={documents?.certified_police_report_files} />
          <Field label="Police Report Expire Date" value={documents?.police_report_expire_date} />
          <Field label="Document Submit Date" value={documents?.document_submission_date} />
          <Field label="Document Re-submission Date" value={documents?.document_resubmission_date} />
        </div>
      </SectionCard>

      {/* Section 4: Job & Visa Processing */}
      <SectionCard title="04. Job & Visa Processing" complete={isDone(4)}>
        {c.country === 'Romania' && (
          <div className="sr-grid-3" style={gridMb16}>
            <Field label="Offer Letter Date" value={visa?.offer_letter_date} />
            <Field label="Confirmation Letter Date" value={visa?.confirmation_letter_date} />
            <Field label="Document Submission Date" value={visa?.document_submission_date} />
            <Field label="Work Permit Received Date" value={visa?.work_permit_received_date} />
            <Field label="Embassy Submission Date" value={visa?.embassy_submission_date} />
            <Field label="Police Report Issued Date" value={visa?.police_report_issued_date} />
            <Field label="Process Interview Date" value={visa?.process_interview_date} />
            <Field label="Visa Received Date" value={visa?.visa_received_date} />
          </div>
        )}

        {c.country === 'Israel' && (
          <div className="sr-grid-3" style={gridMb16}>
            <Field label="Agreement Sign Date" value={visa?.agreement_sign_date} />
            <Field label="Police Report Date" value={visa?.police_report_date} />
          </div>
        )}

        <div className="sr-grid-3">
          <Field label="Visa Status" value={visa?.visa_status ? VISA_STATUS_LABEL[visa.visa_status] : null} />
          <Field label="Visa Status Date" value={visa?.visa_status_date} />
          <Field label="PIBA Submission Status" value={visa?.piba_submission_status ? PIBA_STATUS_LABEL[visa.piba_submission_status] : null} />
        </div>
      </SectionCard>

      {/* Section 5: Departure Details */}
      <SectionCard title="05. Departure Details" complete={isDone(5)}>
        <div className="sr-grid-3">
          <Field label="Final Approval Date" value={departure?.final_approval_date} />
          <Field label="Receipt Number" value={departure?.receipt_number} />
          <Field label="Flight Number" value={departure?.flight_number} />
          <Field label="Air Ticket Number" value={departure?.airticket_number} />
          <Field label="Departure Date" value={departure?.departure_date} />
        </div>
      </SectionCard>

      {/* Section 6: Employee Details */}
      <SectionCard title="06. Employee Details" complete={isDone(6)}>
        <div className="sr-grid-2">
          <Field label="Registration Number" value={employee?.registration_number} />
          <Field
            label="Job Category"
            value={
              employee?.job_category_id
                ? jobCategories.find((j) => j.id === employee.job_category_id)?.name ?? '—'
                : null
            }
          />
        </div>
      </SectionCard>

      {/* Sections progress overview */}
      {c.sections && c.sections.length > 0 && (
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>Sections Progress</div>
          <hr style={hrStyle} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {['Personal Details', 'Training Details', 'Document Attachment', 'Job & Visa Processing', 'Departure Details', 'Employee Details'].map((title, i) => {
              const n = i + 1;
              const sec = c.sections?.find((s) => s.section_no === n);
              const submitted = sec?.status === 'submitted';
              return (
                <div
                  key={n}
                  style={{ display: 'grid', gridTemplateColumns: '30px 1fr 120px', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 8, background: submitted ? 'oklch(0.97 0.02 150)' : 'var(--row-bg, #fafafa)', border: '1px solid var(--border-soft)' }}
                >
                  <div style={{ fontWeight: 700, color: 'var(--muted)' }}>{n}</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
                  <div style={{ textAlign: 'right', fontSize: 11, fontWeight: 600, color: submitted ? 'oklch(0.45 0.12 150)' : 'var(--muted)' }}>
                    {submitted ? '✓ Submitted' : 'Pending'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
