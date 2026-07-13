import { useState, type FormEvent } from 'react';
import { api } from '../api/client';

interface ProgressSection {
  section_no: number;
  title: string;
  submitted: boolean;
}

interface ProgressResult {
  full_name: string;
  registration_no: string;
  total_sections: number;
  is_completed: boolean;
  sections: ProgressSection[];
}

const BRAND = 'oklch(0.55 0.2 265)';
const DONE = 'oklch(0.62 0.16 150)';

export default function ProgressCheckPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ProgressResult | null>(null);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      setError('Please enter your passport, mobile or NIC number.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await api.get<ProgressResult>('/progress', { params: { q } });
      setResult(res.data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const submittedCount = result?.sections.filter((s) => s.submitted).length ?? 0;
  const total = result?.total_sections ?? 6;
  const percent = total > 0 ? Math.round((submittedCount / total) * 100) : 0;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '48px 16px',
        background: 'oklch(0.97 0.01 265)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 620 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'oklch(0.28 0.04 265)' }}>
            Solidrow Registration
          </div>
          <div style={{ fontSize: 14, color: 'oklch(0.5 0.02 265)', marginTop: 4 }}>
            Check your registration progress
          </div>
        </div>

        <form
          onSubmit={handleSearch}
          style={{
            background: 'white',
            borderRadius: 14,
            boxShadow: '0 6px 24px oklch(0.4 0.05 265 / 0.10)',
            padding: 20,
            display: 'flex',
            gap: 10,
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Passport No / Mobile No / NIC"
            autoFocus
            style={{
              flex: 1,
              padding: '12px 14px',
              borderRadius: 9,
              border: '1px solid oklch(0.9 0.01 265)',
              fontSize: 15,
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px 22px',
              borderRadius: 9,
              border: 'none',
              background: BRAND,
              color: 'white',
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.7 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>

        {error && (
          <div
            style={{
              marginTop: 16,
              padding: '14px 16px',
              borderRadius: 10,
              background: 'oklch(0.96 0.03 25)',
              border: '1px solid oklch(0.85 0.06 25)',
              color: 'oklch(0.45 0.15 25)',
              fontSize: 14,
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        {result && (
          <div
            style={{
              marginTop: 20,
              background: 'white',
              borderRadius: 14,
              boxShadow: '0 6px 24px oklch(0.4 0.05 265 / 0.10)',
              padding: 24,
            }}
          >
            {/* Candidate header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'oklch(0.25 0.03 265)' }}>
                  {result.full_name}
                </div>
                <div style={{ fontSize: 12, color: 'oklch(0.55 0.02 265)', marginTop: 2 }}>
                  {result.registration_no}
                </div>
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '5px 12px',
                  borderRadius: 999,
                  background: result.is_completed ? 'oklch(0.94 0.05 150)' : 'oklch(0.95 0.02 265)',
                  color: result.is_completed ? DONE : 'oklch(0.5 0.03 265)',
                }}
              >
                {result.is_completed ? '✓ Completed' : `${submittedCount} / ${total} sections`}
              </div>
            </div>

            {/* Overall progress bar */}
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'oklch(0.5 0.02 265)', marginBottom: 6 }}>
                <span>Overall progress</span>
                <span style={{ fontWeight: 600 }}>{percent}%</span>
              </div>
              <div style={{ height: 10, borderRadius: 999, background: 'oklch(0.93 0.01 265)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${percent}%`,
                    background: DONE,
                    borderRadius: 999,
                    transition: 'width 0.5s ease',
                  }}
                />
              </div>
            </div>

            {/* Section stepper */}
            <div style={{ display: 'flex', marginTop: 26 }}>
              {result.sections.map((s, i) => {
                const isLast = i === result.sections.length - 1;
                const nextDone = !isLast && result.sections[i + 1].submitted;
                return (
                  <div key={s.section_no} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
                    {/* Connector to next node */}
                    {!isLast && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 15,
                          left: '50%',
                          width: '100%',
                          height: 3,
                          background: s.submitted && nextDone ? DONE : 'oklch(0.9 0.01 265)',
                        }}
                      />
                    )}
                    {/* Node */}
                    <div
                      style={{
                        position: 'relative',
                        zIndex: 1,
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        margin: '0 auto',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        fontWeight: 700,
                        color: s.submitted ? 'white' : 'oklch(0.55 0.02 265)',
                        background: s.submitted ? DONE : 'white',
                        border: `2px solid ${s.submitted ? DONE : 'oklch(0.86 0.01 265)'}`,
                      }}
                    >
                      {s.submitted ? '✓' : s.section_no}
                    </div>
                    {/* Label */}
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 10.5,
                        lineHeight: 1.3,
                        padding: '0 4px',
                        color: s.submitted ? 'oklch(0.35 0.03 265)' : 'oklch(0.6 0.02 265)',
                        fontWeight: s.submitted ? 600 : 400,
                      }}
                    >
                      {s.title}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
