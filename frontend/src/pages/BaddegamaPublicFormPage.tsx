import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { api } from '../api/client';

/**
 * Public, standalone Baddegama registration form (no admin auth).
 * Step 1 verifies the mobile number by OTP; Step 2 collects the sign-up.
 */

type Option = { id: number; name: string };

const MOBILE_RE = /^07[01245678][0-9]{7}$/;
const NAME_RE = /^[A-Z ]+$/;
const PASSPORT_RE = /^[NP][0-9]+$/;

function validateNIC(nic: string): boolean {
  const oldRe = /^(?:19|20)?\d{9}[VX]$/;
  const newRe = /^[0-9]{12}$/;
  return (nic.length === 10 && oldRe.test(nic)) || (nic.length === 12 && newRe.test(nic));
}

function showError(message: string) {
  Swal.fire({ title: 'Error!', text: message, icon: 'error', timer: 3000, showConfirmButton: false });
}

const EMPTY = {
  full_name: '',
  nic: '',
  passport_number: '',
  birthday: '',
  age: '',
  gender: '',
  marital_status: '',
  whatsapp_number: '',
  province_id: '',
  current_job: '',
  experience: '',
  job_abroad: '',
  destination_country: '',
};

export default function BaddegamaPublicFormPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({ ...EMPTY });
  const [provinces, setProvinces] = useState<Option[]>([]);
  const [countries, setCountries] = useState<Option[]>([]);
  const [type, setType] = useState<number | ''>('');
  const [locationName, setLocationName] = useState<string>('');

  // A QR code scanned at a branch opens this form with ?loc=<id>, locking the
  // sign-up to that specific location. Without it we fall back to the globally
  // active registration location.
  const [searchParams] = useSearchParams();
  const locParam = searchParams.get('loc');

  useEffect(() => {
    api.get<Option[]>('/baddegama/provinces').then((r) => setProvinces(r.data)).catch(() => {});
    api.get<Option[]>('/baddegama/countries').then((r) => setCountries(r.data)).catch(() => {});

    if (locParam && /^\d+$/.test(locParam)) {
      api.get<{ id: number; name: string }>(`/baddegama/location/${locParam}`)
        .then((r) => { setType(r.data.id); setLocationName(r.data.name); })
        .catch(() => {
          // Bad/unknown location in the QR — fall back to the active one.
          api.get<{ type: number }>('/baddegama/active-location').then((r) => setType(r.data.type)).catch(() => {});
        });
    } else {
      api.get<{ type: number }>('/baddegama/active-location').then((r) => setType(r.data.type)).catch(() => {});
    }
  }, [locParam]);

  const mobileValid = MOBILE_RE.test(mobile);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // ── Step 1: OTP ──────────────────────────────────────────────────────────
  function onMobileChange(v: string) {
    setMobile(v);
    // Editing the number resets any prior verification.
    setVerified(false);
    setOtpSent(false);
    setOtp('');
  }

  async function sendOtp() {
    if (!mobileValid) {
      showError('Please enter a valid mobile number (e.g. 0771234567).');
      return;
    }
    setSendingOtp(true);
    try {
      const { data } = await api.post('/baddegama/otp/send', { mobile });
      if (data.status === 'success') {
        setOtpSent(true);
        Swal.fire({ title: 'OTP Sent!', text: 'Please check your SMS for the verification code.', icon: 'success', timer: 2000, showConfirmButton: false });
      } else {
        showError(data.message || 'Failed to send OTP.');
      }
    } catch {
      showError('Failed to send OTP. Please try again.');
    } finally {
      setSendingOtp(false);
    }
  }

  async function verifyOtp() {
    if (!otp) {
      showError('Please enter the OTP code.');
      return;
    }
    setVerifying(true);
    try {
      const { data } = await api.post('/baddegama/otp/verify', { mobile, otp });
      if (data.status === 'success') {
        setVerified(true);
        setStep(2);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        Swal.fire({ title: 'Verified!', text: 'Mobile number verified. Proceeding to the form…', icon: 'success', timer: 2000, showConfirmButton: false });
      } else {
        showError(data.message || 'Invalid OTP code.');
      }
    } catch {
      showError('Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  }

  // ── Step 2: submit ───────────────────────────────────────────────────────
  function validate(): string | null {
    if (!form.full_name) return 'Please enter your full name';
    if (!NAME_RE.test(form.full_name)) return 'Full name must contain only English letters and spaces';
    if (!form.nic) return 'Please enter your NIC number';
    if (!validateNIC(form.nic)) return 'Please enter a valid Sri Lankan NIC (e.g. 123456789V or 123456789012)';
    if (form.passport_number && !PASSPORT_RE.test(form.passport_number)) return 'Passport must start with N or P followed by numbers';
    if (!form.birthday) return 'Please select your birthday';
    if (!form.age) return 'Please enter your age';
    if (!form.gender) return 'Please select your gender';
    if (!form.marital_status) return 'Please select your marital status';
    if (!mobileValid) return 'Please verify a valid mobile number';
    if (!form.province_id) return 'Please select your province';
    if (!form.current_job) return 'Please enter your current job';
    if (!form.experience) return 'Please enter your experience';
    if (!form.destination_country) return 'Please select your destination country';
    return null;
  }

  async function submit() {
    const err = validate();
    if (err) {
      showError(err);
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post('/baddegama/register', {
        ...form,
        mobile_number: mobile,
        type,
      });
      if (data.status === 'success') {
        await Swal.fire({ title: 'Success!', text: 'Registration successful!', icon: 'success', timer: 2000, showConfirmButton: false });
        const ok = String(data.sms_status || '').includes('success');
        await Swal.fire({
          title: ok ? 'SMS Sent!' : 'SMS Failed!',
          text: `${data.sms_status || ''}${data.registration_code ? `  Reg No: ${data.registration_code}` : ''}`,
          icon: ok ? 'success' : 'error',
          timer: 3000,
          showConfirmButton: false,
        });
        // Reset for the next registrant.
        setForm({ ...EMPTY });
        setMobile('');
        setOtp('');
        setOtpSent(false);
        setVerified(false);
        setStep(1);
      } else {
        showError(data.message || 'Something went wrong!');
      }
    } catch {
      showError('A server error occurred while processing your request.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Styles ───────────────────────────────────────────────────────────────
  const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#334155' };
  const input: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1',
    fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff',
  };
  const field = (l: string, node: React.ReactNode, hint?: React.ReactNode) => (
    <div style={{ marginBottom: 16 }}>
      <label style={label}>{l}</label>
      {node}
      {hint}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#0f172a,#1e293b)', padding: '32px 16px' }}>
      <div className="registration-card" style={{ maxWidth: 760, margin: '0 auto', background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
        {/* Banner */}
        <div style={{ background: '#0e7490', color: '#fff', padding: '24px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.3 }}>Solidrow FESTI (Pvt) Ltd</div>
          <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>Foreign Employment Agency — Baddegama Registration</div>
          <div style={{ fontSize: 13, opacity: 0.9 }}>විදේශ රැකියා නියෝජිත ආයතනය — ලියාපදිංචි කිරීම</div>
          {locationName && (
            <div style={{ display: 'inline-block', marginTop: 10, padding: '4px 14px', borderRadius: 999, background: 'rgba(255,255,255,0.18)', fontSize: 13, fontWeight: 700 }}>
              📍 {locationName}
            </div>
          )}
        </div>

        {/* Step tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ flex: 1, textAlign: 'center', padding: '14px', fontWeight: 700, fontSize: 14, color: verified ? '#16a34a' : step === 1 ? '#0e7490' : '#94a3b8', borderBottom: step === 1 ? '3px solid #0e7490' : '3px solid transparent' }}>
            {verified ? '✓ Phone Verified' : '1 · Phone Verification'}
          </div>
          <div style={{ flex: 1, textAlign: 'center', padding: '14px', fontWeight: 700, fontSize: 14, color: step === 2 ? '#0e7490' : '#94a3b8', borderBottom: step === 2 ? '3px solid #0e7490' : '3px solid transparent', pointerEvents: verified ? 'auto' : 'none', opacity: verified ? 1 : 0.6 }}>
            2 · Registration Form
          </div>
        </div>

        <div style={{ padding: '28px' }}>
          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div>
              <p style={{ fontSize: 14, color: '#475569', marginTop: 0 }}>
                Enter your mobile number to receive a verification code.<br />
                <span style={{ color: '#64748b' }}>සත්‍යාපන කේතයක් ලබා ගැනීමට ඔබගේ ජංගම දුරකථන අංකය ඇතුළත් කරන්න.</span>
              </p>
              {field(
                'Mobile Number / ජංගම දුරකථන අංකය',
                <div style={{ display: 'flex', gap: 8 }}>
                  <input style={input} value={mobile} maxLength={10} placeholder="07XXXXXXXX" onChange={(e) => onMobileChange(e.target.value.replace(/[^0-9]/g, ''))} />
                  <button onClick={sendOtp} disabled={sendingOtp || !mobileValid} style={{ ...btn('#0e7490'), whiteSpace: 'nowrap', opacity: sendingOtp || !mobileValid ? 0.6 : 1 }}>
                    {sendingOtp ? 'Sending…' : otpSent ? 'Resend OTP' : 'Send OTP'}
                  </button>
                </div>,
                <div style={{ fontSize: 12, marginTop: 6, fontWeight: 600, color: mobile === '' ? '#64748b' : mobileValid ? '#16a34a' : '#dc2626' }}>
                  {mobile === '' ? 'Verification required' : mobileValid ? '✓ Valid format — verification required' : '✗ Invalid mobile format (e.g. 0771234567)'}
                </div>,
              )}

              {otpSent && (
                field(
                  'Verification Code / සත්‍යාපන කේතය',
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input style={input} value={otp} maxLength={6} placeholder="6-digit code" onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))} />
                    <button onClick={verifyOtp} disabled={verifying} style={{ ...btn('#16a34a'), whiteSpace: 'nowrap', opacity: verifying ? 0.6 : 1 }}>
                      {verifying ? 'Verifying…' : 'Confirm OTP'}
                    </button>
                  </div>,
                )
              )}
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', columnGap: 20 }}>
                {field(
                  'Full Name (as in passport) / සම්පූර්ණ නම',
                  <input style={input} value={form.full_name} onChange={(e) => set('full_name', e.target.value.toUpperCase())} />,
                  hint(form.full_name, NAME_RE.test(form.full_name), 'Valid name', 'Only English letters and spaces'),
                )}
                {field(
                  'NIC / ජාතික හැඳුනුම්පත් අංකය',
                  <input style={input} value={form.nic} onChange={(e) => set('nic', e.target.value.toUpperCase())} />,
                  hint(form.nic, validateNIC(form.nic), 'Valid NIC format', 'Invalid NIC format'),
                )}
                {field(
                  'Passport No (optional) / විදේශ ගමන් බලපත්‍ර අංකය',
                  <input style={input} value={form.passport_number} onChange={(e) => {
                    let v = e.target.value;
                    if (v.length) { const c = v.charAt(0).toUpperCase(); if (c === 'N' || c === 'P') v = c + v.substring(1); }
                    set('passport_number', v);
                  }} />,
                  form.passport_number ? hint(form.passport_number, PASSPORT_RE.test(form.passport_number), 'Valid passport', 'Must start with N or P followed by numbers') : undefined,
                )}
                {field('Birthday / උපන් දිනය',
                  <input type="date" style={input} value={form.birthday} onChange={(e) => {
                    const b = e.target.value; set('birthday', b);
                    if (b) { const d = new Date(b); const a = Math.floor((Date.now() - d.getTime()) / 3.15576e10); if (a > 0 && a < 120) set('age', String(a)); }
                  }} />,
                )}
                {field('Age / වයස', <input type="number" style={input} value={form.age} onChange={(e) => set('age', e.target.value)} />)}
                {field('Gender / ස්ත්‍රී පුරුෂ භාවය',
                  <select style={input} value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                    <option value="">Select…</option>
                    <option value="male">Male / පුරුෂ</option>
                    <option value="female">Female / ස්ත්‍රී</option>
                  </select>)}
                {field('Marital Status / විවාහක අවිවාහක බව',
                  <select style={input} value={form.marital_status} onChange={(e) => set('marital_status', e.target.value)}>
                    <option value="">Select…</option>
                    <option value="single">Single / අවිවාහක</option>
                    <option value="married">Married / විවාහක</option>
                  </select>)}
                {field('Mobile (verified) / තහවුරු කළ අංකය', <input style={{ ...input, background: '#f1f5f9' }} value={mobile} readOnly />)}
                {field('WhatsApp Number / වට්ස්ඇප් අංකය', <input style={input} value={form.whatsapp_number} onChange={(e) => set('whatsapp_number', e.target.value.replace(/[^0-9]/g, ''))} />)}
                {field('Province / පළාත',
                  <select style={input} value={form.province_id} onChange={(e) => set('province_id', e.target.value)}>
                    <option value="">Select…</option>
                    {provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>)}
                {field('Current Job / වර්තමාන රැකියාව', <input style={input} value={form.current_job} onChange={(e) => set('current_job', e.target.value)} />)}
                {field('Experience (years) / පළපුරුද්ද', <input type="number" style={input} value={form.experience} onChange={(e) => set('experience', e.target.value)} />)}
                {field('Destination Country / අපේක්ෂිත රට',
                  <select style={input} value={form.destination_country} onChange={(e) => set('destination_country', e.target.value)}>
                    <option value="">Select…</option>
                    {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>)}
              </div>

              <button onClick={submit} disabled={submitting} style={{ ...btn('#0e7490'), width: '100%', padding: '14px', fontSize: 15, marginTop: 8, opacity: submitting ? 0.6 : 1 }}>
                {submitting ? 'Submitting…' : 'Complete Registration'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function btn(color: string): React.CSSProperties {
  return { background: color, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' };
}

function hint(value: string, ok: boolean, good: string, bad: string) {
  if (!value) return undefined;
  return <div style={{ fontSize: 12, marginTop: 6, fontWeight: 600, color: ok ? '#16a34a' : '#dc2626' }}>{ok ? `✓ ${good}` : `✗ ${bad}`}</div>;
}
