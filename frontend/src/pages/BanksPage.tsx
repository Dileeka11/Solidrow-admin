import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { EditIcon, PlusIcon, TrashIcon } from '../components/icons';
import { confirmDelete, toastError, toastSuccess } from '../lib/alerts';
import type { Bank, BankBranch } from '../types';

const inputStyle: React.CSSProperties = { padding: '9px 12px', borderRadius: 7, fontSize: 14 };

export default function BanksPage() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBank, setNewBank] = useState('');

  // Branch modal state
  const [branchModal, setBranchModal] = useState<{ bankId: number; editing: BankBranch | null } | null>(null);
  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<Bank[]>('/accounting/banks');
      setBanks(res.data);
    } catch {
      setBanks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addBank(e: React.FormEvent) {
    e.preventDefault();
    const name = newBank.trim();
    if (!name) return;
    try {
      await api.post('/accounting/banks', { name });
      setNewBank('');
      toastSuccess('Bank added');
      await load();
    } catch (err: unknown) {
      toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not add the bank.');
    }
  }

  async function renameBank(bank: Bank) {
    const name = window.prompt('Bank name', bank.name)?.trim();
    if (!name || name === bank.name) return;
    try {
      await api.put(`/accounting/banks/${bank.id}`, { name });
      toastSuccess('Bank updated');
      await load();
    } catch (err: unknown) {
      toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not update the bank.');
    }
  }

  async function deleteBank(bank: Bank) {
    const ok = await confirmDelete(`Delete bank "${bank.name}" and all its branches?`);
    if (!ok) return;
    try {
      await api.delete(`/accounting/banks/${bank.id}`);
      toastSuccess('Bank deleted');
      await load();
    } catch {
      toastError('Could not delete the bank.');
    }
  }

  function openBranchAdd(bankId: number) {
    setBranchModal({ bankId, editing: null });
    setBranchName('');
    setBranchCode('');
  }

  function openBranchEdit(bankId: number, branch: BankBranch) {
    setBranchModal({ bankId, editing: branch });
    setBranchName(branch.name);
    setBranchCode(branch.branch_code ?? '');
  }

  async function saveBranch() {
    if (!branchModal) return;
    if (!branchName.trim()) {
      toastError('Branch name is required.');
      return;
    }
    setBusy(true);
    try {
      const payload = { name: branchName.trim(), branch_code: branchCode.trim() || null };
      if (branchModal.editing) {
        await api.put(`/accounting/bank-branches/${branchModal.editing.id}`, payload);
        toastSuccess('Branch updated');
      } else {
        await api.post(`/accounting/banks/${branchModal.bankId}/branches`, payload);
        toastSuccess('Branch added');
      }
      setBranchModal(null);
      await load();
    } catch (err: unknown) {
      toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not save the branch.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteBranch(branch: BankBranch) {
    const ok = await confirmDelete(`Delete branch "${branch.name}"?`);
    if (!ok) return;
    try {
      await api.delete(`/accounting/bank-branches/${branch.id}`);
      toastSuccess('Branch deleted');
      await load();
    } catch {
      toastError('Could not delete the branch.');
    }
  }

  return (
    <div className="fade-in-s" style={{ maxWidth: 820 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Bank & Branch Master</div>
        <div style={{ fontSize: 14, color: 'var(--muted)' }}>{banks.length} banks</div>
      </div>

      <form onSubmit={addBank} style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', padding: 20, marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--label-2)' }}>New bank name</label>
          <input className="sr-input" style={{ ...inputStyle, width: '100%' }} value={newBank} onChange={(e) => setNewBank(e.target.value)} placeholder="e.g. HNB, Commercial Bank" />
        </div>
        <button type="submit" className="sr-btn-primary" style={{ padding: '10px 18px', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <PlusIcon />
          Add Bank
        </button>
      </form>

      {loading && <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</div>}
      {!loading && banks.length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)' }}>No banks yet — add one above.</div>}

      {banks.map((bank) => (
        <div key={bank.id} style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--row-border)', background: 'oklch(0.98 0.005 250)' }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{bank.name}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => openBranchAdd(bank.id)} className="sr-btn-primary" style={{ padding: '6px 12px', borderRadius: 7, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}><PlusIcon /> Branch</button>
              <button onClick={() => renameBank(bank)} title="Rename bank" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}><EditIcon /></button>
              <button onClick={() => deleteBank(bank)} title="Delete bank" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.55 0.16 25)', padding: 4 }}><TrashIcon /></button>
            </div>
          </div>
          {bank.branches.length === 0 && <div style={{ padding: '12px 20px', fontSize: 13, color: 'var(--muted)' }}>No branches yet.</div>}
          {bank.branches.map((br) => (
            <div key={br.id} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 70px', columnGap: 16, padding: '11px 20px', fontSize: 14, alignItems: 'center', borderBottom: '1px solid var(--row-border)' }}>
              <div style={{ fontWeight: 500 }}>{br.name}</div>
              <div style={{ color: 'var(--muted)', fontFamily: 'monospace', fontSize: 13 }}>{br.branch_code || '—'}</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => openBranchEdit(bank.id, br)} title="Edit branch" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}><EditIcon /></button>
                <button onClick={() => deleteBranch(br)} title="Delete branch" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.55 0.16 25)', padding: 4 }}><TrashIcon /></button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {branchModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setBranchModal(null)}>
          <div className="fade-in-xs" style={{ background: 'white', borderRadius: 14, width: 420, maxWidth: '90vw', padding: 28 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>{branchModal.editing ? 'Edit Branch' : 'Add Branch'}</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--label-2)' }}>Branch Name *</label>
              <input className="sr-input" style={{ ...inputStyle, width: '100%' }} value={branchName} onChange={(e) => setBranchName(e.target.value)} placeholder="e.g. Colombo Main" />
            </div>
            <div style={{ marginBottom: 22 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--label-2)' }}>Branch Code</label>
              <input className="sr-input" style={{ ...inputStyle, width: '100%' }} value={branchCode} onChange={(e) => setBranchCode(e.target.value)} placeholder="Optional" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setBranchModal(null)} style={{ padding: '10px 16px', borderRadius: 8, fontSize: 14, background: 'var(--row-border, #f3f4f6)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button className="sr-btn-primary" onClick={saveBranch} disabled={busy} style={{ padding: '10px 18px', borderRadius: 8, fontSize: 14 }}>{busy ? 'Saving…' : branchModal.editing ? 'Update' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
