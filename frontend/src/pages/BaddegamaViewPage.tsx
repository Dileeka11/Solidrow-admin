import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { api } from '../api/client';
import { toastError } from '../lib/alerts';

type Reg = Record<string, string | number | null>;
type Option = { id: number; name: string };

const RESULTS = ['Pass', 'Pass + Training', 'Fail'];
const CALL_STATUS = [
  { v: 'completed', l: 'Completed' },
  { v: 'pending', l: 'Pending' },
  { v: 'in_progress', l: 'In Progress' },
  { v: 'not_answered', l: 'Not Answered' },
];
const EMPLOYEE_STATUS = [
  { v: 'ok', l: 'OK' },
  { v: 'not_ok', l: 'Not OK' },
];

export default function BaddegamaViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const editing = !location.pathname.endsWith('/view');

  const [reg, setReg] = useState<Reg | null>(null);
  const [names, setNames] = useState<Record<string, string | null>>({});
  const [provinces, setProvinces] = useState<Option[]>([]);
  const [countries, setCountries] = useState<Option[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) { navigate('/baddegama'); return; }
    api.get(`/baddegama-registrations/${id}`)
      .then((r) => {
        setReg(r.data.registration);
        setNames({ province: r.data.province_name, country: r.data.country_name, location: r.data.location_name, agent: r.data.agent_name });
      })
      .catch(() => { toastError('Could not load registration.'); navigate('/baddegama'); });
    api.get<Option[]>('/baddegama/provinces').then((r) => setProvinces(r.data)).catch(() => {});
    api.get<Option[]>('/baddegama/countries').then((r) => setCountries(r.data)).catch(() => {});
  }, [id]);

  const set = (k: string, v: string) => setReg((p) => (p ? { ...p, [k]: v } : p));

  const nowLocal = useMemo(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }, []);

  async function save() {
    if (!reg) return;
    setSaving(true);
    try {
      const { data } = await api.put(`/baddegama-registrations/${id}`, {
        ...reg,
        call_date_time: reg.call_date_time || nowLocal,
      });
      await Swal.fire({ title: 'Saved!', text: data.message || 'Registration updated.', icon: 'success', timer: 1800, showConfirmButton: false });
      if (data.sms_status) {
        const ok = String(data.sms_status).includes('success');
        await Swal.fire({ title: ok ? 'SMS Sent!' : 'SMS Failed', text: data.sms_status, icon: ok ? 'success' : 'error', timer: 2500, showConfirmButton: false });
      }
      navigate('/baddegama');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Update failed.';
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!reg) return <div style={{ padding: 20, color: 'var(--muted)' }}>Loading…</div>;

  const v = (k: string) => (reg[k] ?? '') as string;

  return (
    <div className="fade-in-s" style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{editing ? 'Edit Registration' : 'View Registration'}</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>{v('registration_code')} · {v('full_name')}</div>
        </div>
        <button className="sr-btn-secondary" onClick={() => navigate('/baddegama')} style={{ padding: '9px 16px', borderRadius: 8, fontSize: 14, whiteSpace: 'nowrap' }}>← Back</button>
      </div>

      <Section title="Personal Information">
        {textField('Full Name', 'full_name', v, set, editing)}
        {textField('NIC', 'nic', v, set, editing)}
        {textField('Passport No', 'passport_number', v, set, editing)}
        {dateField('Birthday', 'birthday', v, set, editing)}
        {textField('Age', 'age', v, set, editing, 'number')}
        {selectField('Gender', 'gender', v, set, editing, [{ v: 'male', l: 'Male' }, { v: 'female', l: 'Female' }])}
        {selectField('Marital Status', 'marital_status', v, set, editing, [{ v: 'single', l: 'Single' }, { v: 'married', l: 'Married' }])}
        {textField('Mobile Number', 'mobile_number', v, set, editing)}
        {textField('WhatsApp Number', 'whatsapp_number', v, set, editing)}
        {editing
          ? optionField('Province', 'province_id', v, set, provinces)
          : readOnly('Province', names.province ?? '—')}
      </Section>

      <Section title="Job & Professional">
        {textField('Current Job', 'current_job', v, set, editing)}
        {textField('Experience (years)', 'experience', v, set, editing, 'number')}
        {textField('Job Abroad', 'job_abroad', v, set, editing)}
        {editing
          ? optionField('Destination Country', 'destination_country', v, set, countries)
          : readOnly('Destination Country', names.country ?? '—')}
        {readOnly('Application Type (Location)', names.location ?? '—')}
        {readOnly('Registration Date', v('created_at') || '—')}
      </Section>

      <Section title="Marks & Result">
        {textField('Marks', 'marks', v, set, editing, 'number')}
        {selectField('Result', 'result', v, set, editing, RESULTS.map((r) => ({ v: r, l: r })))}
      </Section>

      <Section title="Call Center & Status Tracking">
        {selectField('Call Status', 'call_status', v, set, editing, CALL_STATUS)}
        {selectField('Employee Status', 'employee_status', v, set, editing, EMPLOYEE_STATUS)}
        {editing
          ? field('Call Date & Time', <input type="datetime-local" style={inputStyle} value={(v('call_date_time') || '').replace(' ', 'T').slice(0, 16) || nowLocal} onChange={(e) => set('call_date_time', e.target.value)} />)
          : readOnly('Call Date & Time', v('call_date_time') || '—')}
        <div style={{ gridColumn: '1 / -1' }}>
          {field('Call Notes', editing
            ? <textarea style={{ ...inputStyle, minHeight: 90 }} value={v('call_notes')} onChange={(e) => set('call_notes', e.target.value)} />
            : <div style={roStyle}>{v('call_notes') || '—'}</div>)}
        </div>
      </Section>

      {editing && (
        <button className="sr-btn-primary" onClick={save} disabled={saving} style={{ padding: '12px 22px', borderRadius: 8, fontSize: 14, marginTop: 8, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      )}
    </div>
  );
}

// ── Presentational helpers ──────────────────────────────────────────────────
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--card)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const roStyle: React.CSSProperties = { padding: '9px 12px', borderRadius: 8, background: 'var(--row-border)', fontSize: 14, minHeight: 20 };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', padding: '20px 24px', marginBottom: 18 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', columnGap: 20, rowGap: 4 }}>{children}</div>
    </div>
  );
}

function field(label: string, node: React.ReactNode) {
  return <div style={{ marginBottom: 14 }}><label style={labelStyle}>{label}</label>{node}</div>;
}

function readOnly(label: string, value: string) {
  return field(label, <div style={roStyle}>{value}</div>);
}

type VFn = (k: string) => string;
type SetFn = (k: string, v: string) => void;

function textField(label: string, key: string, v: VFn, set: SetFn, editing: boolean, type = 'text') {
  return field(label, editing
    ? <input type={type} style={inputStyle} value={v(key)} onChange={(e) => set(key, e.target.value)} />
    : <div style={roStyle}>{v(key) || '—'}</div>);
}

function dateField(label: string, key: string, v: VFn, set: SetFn, editing: boolean) {
  return field(label, editing
    ? <input type="date" style={inputStyle} value={(v(key) || '').slice(0, 10)} onChange={(e) => set(key, e.target.value)} />
    : <div style={roStyle}>{v(key) || '—'}</div>);
}

function selectField(label: string, key: string, v: VFn, set: SetFn, editing: boolean, opts: { v: string; l: string }[]) {
  if (!editing) {
    const match = opts.find((o) => o.v === v(key));
    return readOnly(label, match?.l ?? (v(key) || '—'));
  }
  return field(label,
    <select style={inputStyle} value={v(key)} onChange={(e) => set(key, e.target.value)}>
      <option value="">Select…</option>
      {opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>);
}

function optionField(label: string, key: string, v: VFn, set: SetFn, opts: Option[]) {
  return field(label,
    <select style={inputStyle} value={v(key)} onChange={(e) => set(key, e.target.value)}>
      <option value="">Select…</option>
      {opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>);
}
