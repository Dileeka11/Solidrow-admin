import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { EditIcon, PlusIcon, TrashIcon } from '../components/icons';
import { confirmDelete, toastError, toastSuccess } from '../lib/alerts';
import { useIsMobile } from '../lib/useMediaQuery';
import type { FinancialYear, OpeningBalanceAccount, OpeningBalancesResponse } from '../types';

// ─── styles ──────────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = { padding: '10px 12px', borderRadius: 7, fontSize: 14 };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--label-2)' };

type YearForm = { year_name: string; start_date: string; end_date: string; is_active: boolean };
const EMPTY_FORM: YearForm = { year_name: '', start_date: '', end_date: '', is_active: false };

// ─── Opening Balance sub-screen ───────────────────────────────────────────────
function OpeningBalanceScreen({
  year,
  onBack,
}: {
  year: FinancialYear;
  onBack: () => void;
}) {
  const [data, setData] = useState<OpeningBalancesResponse | null>(null);
  const [saving, setSaving] = useState(false);
  // local edits: account_id → { debit, credit }
  const [edits, setEdits] = useState<Record<number, { debit: string; credit: string }>>({});

  useEffect(() => {
    api
      .get<OpeningBalancesResponse>(`/accounting/financial-years/${year.id}/opening-balances`)
      .then((res) => {
        setData(res.data);
        const init: typeof edits = {};
        res.data.accounts.forEach((a) => {
          init[a.account_id] = { debit: a.debit, credit: a.credit };
        });
        setEdits(init);
      })
      .catch(() => toastError('Could not load opening balances.'));
  }, [year.id]);

  function setField(accountId: number, field: 'debit' | 'credit', value: string) {
    setEdits((prev) => ({ ...prev, [accountId]: { ...prev[accountId], [field]: value } }));
  }

  async function save() {
    setSaving(true);
    try {
      const balances = Object.entries(edits).map(([id, v]) => ({
        account_id: Number(id),
        debit: v.debit || '0',
        credit: v.credit || '0',
      }));
      await api.post(`/accounting/financial-years/${year.id}/opening-balances`, { balances });
      toastSuccess('Opening balances saved.');
    } catch {
      toastError('Could not save opening balances.');
    } finally {
      setSaving(false);
    }
  }

  if (!data) return <div style={{ padding: 20, color: 'var(--muted)' }}>Loading…</div>;

  // Group accounts by category → group for display
  type GroupedRow = { group: string; category: string; accounts: OpeningBalanceAccount[] };
  const groups: Record<string, GroupedRow> = {};
  data.accounts.forEach((a) => {
    const key = `${a.category_name}__${a.group_name}`;
    if (!groups[key]) groups[key] = { category: a.category_name ?? '', group: a.group_name ?? '', accounts: [] };
    groups[key].accounts.push(a);
  });

  return (
    <div className="fade-in-s">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
        >
          ← Back
        </button>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Opening Balances</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            {year.year_name} &nbsp;·&nbsp; {year.start_date} → {year.end_date}
          </div>
        </div>
      </div>

      {Object.values(groups).map(({ category, group, accounts }) => (
        <div key={`${category}-${group}`} style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', overflow: 'hidden', marginBottom: 16 }}>
          {/* Group header */}
          <div style={{ padding: '10px 20px', background: 'var(--surface-2, #f8f9fb)', borderBottom: '1px solid var(--row-border)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{category}</span>
            <span style={{ fontSize: 13, fontWeight: 700, marginLeft: 10 }}>{group}</span>
          </div>
          {/* Column header */}
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 160px 160px', columnGap: 12, padding: '8px 20px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid var(--row-border)' }}>
            <div>Code</div>
            <div>Account</div>
            <div style={{ textAlign: 'right' }}>Debit (LKR)</div>
            <div style={{ textAlign: 'right' }}>Credit (LKR)</div>
          </div>
          {accounts.map((acc) => {
            const e = edits[acc.account_id] ?? { debit: '0.00', credit: '0.00' };
            return (
              <div key={acc.account_id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 160px 160px', columnGap: 12, padding: '10px 20px', alignItems: 'center', borderBottom: '1px solid var(--row-border)', fontSize: 14 }}>
                <div style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--muted)' }}>{acc.account_code}</div>
                <div style={{ paddingLeft: acc.parent_id ? 16 : 0 }}>{acc.account_name}</div>
                <div>
                  <input
                    id={`ob-debit-${acc.account_id}`}
                    className="sr-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={e.debit}
                    onChange={(ev) => setField(acc.account_id, 'debit', ev.target.value)}
                    style={{ ...inputStyle, width: '100%', textAlign: 'right' }}
                  />
                </div>
                <div>
                  <input
                    id={`ob-credit-${acc.account_id}`}
                    className="sr-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={e.credit}
                    onChange={(ev) => setField(acc.account_id, 'credit', ev.target.value)}
                    style={{ ...inputStyle, width: '100%', textAlign: 'right' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
        <button onClick={onBack} style={{ padding: '10px 18px', borderRadius: 8, fontSize: 14, background: 'var(--row-border)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}>
          Cancel
        </button>
        <button className="sr-btn-primary" onClick={save} disabled={saving} style={{ padding: '10px 22px', borderRadius: 8, fontSize: 14 }}>
          {saving ? 'Saving…' : 'Save Opening Balances'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FinancialYearPage() {
  const isMobile = useIsMobile();
  const [years, setYears] = useState<FinancialYear[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialYear | null>(null);
  const [form, setForm] = useState<YearForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Opening-balance sub-screen
  const [obYear, setObYear] = useState<FinancialYear | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<FinancialYear[]>('/accounting/financial-years');
      setYears(res.data);
    } catch {
      setYears([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(y: FinancialYear) {
    setEditing(y);
    setForm({ year_name: y.year_name, start_date: y.start_date, end_date: y.end_date, is_active: y.is_active });
    setFormError('');
    setModalOpen(true);
  }

  async function save() {
    if (!form.year_name.trim()) { setFormError('Year name is required.'); return; }
    if (!form.start_date) { setFormError('Start date is required.'); return; }
    if (!form.end_date) { setFormError('End date is required.'); return; }
    if (form.end_date <= form.start_date) { setFormError('End date must be after start date.'); return; }
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await api.put(`/accounting/financial-years/${editing.id}`, form);
        toastSuccess('Financial year updated.');
      } else {
        await api.post('/accounting/financial-years', form);
        toastSuccess('Financial year created.');
      }
      setModalOpen(false);
      await load();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
      setFormError(data?.errors ? Object.values(data.errors)[0]?.[0] ?? '' : data?.message ?? 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(y: FinancialYear) {
    if (y.is_active) { toastError('Cannot delete the active financial year.'); return; }
    const ok = await confirmDelete(`Delete financial year "${y.year_name}"?`);
    if (!ok) return;
    try {
      await api.delete(`/accounting/financial-years/${y.id}`);
      toastSuccess('Deleted.');
      await load();
    } catch { toastError('Could not delete.'); }
  }

  async function handleSetActive(y: FinancialYear) {
    try {
      await api.post(`/accounting/financial-years/${y.id}/set-active`);
      toastSuccess(`"${y.year_name}" set as active year.`);
      await load();
    } catch { toastError('Could not set active year.'); }
  }

  // Show opening-balance screen when a year is selected.
  if (obYear) return <OpeningBalanceScreen year={obYear} onBack={() => setObYear(null)} />;

  const gridCols = isMobile ? '1fr auto' : '160px 140px 140px 100px 1fr 200px';

  return (
    <div className="fade-in-s">
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Financial Years</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>{years.length} financial year{years.length !== 1 ? 's' : ''} defined</div>
        </div>
        <button id="btn-new-financial-year" className="sr-btn-primary" onClick={openAdd} style={{ padding: '10px 16px', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <PlusIcon /> New Financial Year
        </button>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', overflow: 'hidden' }}>
        {!isMobile && (
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, columnGap: 16, padding: '12px 20px', fontSize: 12, fontWeight: 700, color: 'var(--muted)', borderBottom: '1px solid var(--row-border)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            <div>Year</div>
            <div>Start Date</div>
            <div>End Date</div>
            <div>Status</div>
            <div />
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>
        )}

        {loading && <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--muted)' }}>Loading…</div>}
        {!loading && years.length === 0 && <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--muted)' }}>No financial years yet.</div>}

        {years.map((y) => (
          <div key={y.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr auto' : gridCols, columnGap: 16, padding: '14px 20px', fontSize: 14, alignItems: 'center', borderBottom: '1px solid var(--row-border)' }}>
            <div style={{ fontWeight: 700 }}>{y.year_name}</div>
            {!isMobile && <div style={{ color: 'var(--muted)' }}>{y.start_date}</div>}
            {!isMobile && <div style={{ color: 'var(--muted)' }}>{y.end_date}</div>}
            {!isMobile && (
              <div>
                {y.is_active ? (
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'oklch(0.93 0.07 150)', color: 'oklch(0.38 0.13 150)' }}>● Active</span>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: 'oklch(0.94 0.01 250)', color: 'oklch(0.55 0.02 250)' }}>Inactive</span>
                )}
              </div>
            )}
            {!isMobile && (
              <div>
                <button
                  id={`btn-ob-${y.id}`}
                  onClick={() => setObYear(y)}
                  style={{ fontSize: 13, padding: '6px 12px', borderRadius: 7, border: '1px solid var(--accent, #6366f1)', color: 'var(--accent, #6366f1)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                >
                  Opening Balances
                </button>
                {!y.is_active && (
                  <button
                    id={`btn-activate-${y.id}`}
                    onClick={() => handleSetActive(y)}
                    style={{ fontSize: 13, padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', color: 'var(--muted)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', marginLeft: 8 }}
                  >
                    Set Active
                  </button>
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button id={`btn-edit-fy-${y.id}`} onClick={() => openEdit(y)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}><EditIcon /></button>
              <button id={`btn-delete-fy-${y.id}`} onClick={() => handleDelete(y)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.55 0.16 25)', padding: 4 }}><TrashIcon /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setModalOpen(false)}>
          <div className="fade-in-xs" style={{ background: 'var(--card, white)', borderRadius: 14, width: 480, maxWidth: '92vw', padding: 28, boxShadow: '0 8px 32px oklch(0 0 0 / 0.18)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 22 }}>{editing ? 'Edit Financial Year' : 'New Financial Year'}</div>

            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label htmlFor="fy-year-name" style={labelStyle}>Year Name *</label>
                <input id="fy-year-name" className="sr-input" style={{ ...inputStyle, width: '100%' }} value={form.year_name} placeholder="e.g. 2027/2028" onChange={(e) => setForm({ ...form, year_name: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label htmlFor="fy-start-date" style={labelStyle}>Start Date *</label>
                  <input id="fy-start-date" className="sr-input" type="date" style={{ ...inputStyle, width: '100%' }} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="fy-end-date" style={labelStyle}>End Date *</label>
                  <input id="fy-end-date" className="sr-input" type="date" style={{ ...inputStyle, width: '100%' }} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                <input id="fy-is-active" type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} style={{ width: 16, height: 16 }} />
                Set as active financial year
              </label>
            </div>

            {formError && <div style={{ color: 'oklch(0.55 0.16 25)', fontSize: 13, marginTop: 14 }}>{formError}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
              <button onClick={() => setModalOpen(false)} style={{ padding: '10px 16px', borderRadius: 8, fontSize: 14, background: 'var(--row-border)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button id="btn-save-fy" className="sr-btn-primary" onClick={save} disabled={saving} style={{ padding: '10px 22px', borderRadius: 8, fontSize: 14 }}>
                {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
