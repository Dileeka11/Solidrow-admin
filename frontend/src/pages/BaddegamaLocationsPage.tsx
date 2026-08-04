import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import Swal from 'sweetalert2';
import { api } from '../api/client';
import { EditIcon, PlusIcon, TrashIcon } from '../components/icons';
import { confirmDelete, toastError, toastSuccess } from '../lib/alerts';
import { useAuth } from '../auth/AuthContext';
import { can } from '../lib/permissions';

type Location = { id: number; name: string; agent: string | null; is_active_registration: number };

export default function BaddegamaLocationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canEdit = can(user, 'baddegama.edit');
  const canAdd = can(user, 'baddegama.add');
  const canDelete = can(user, 'baddegama.delete');

  const [rows, setRows] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrLoc, setQrLoc] = useState<Location | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const formUrl = (id: number) => `${window.location.origin}/baddegama-registration?loc=${id}`;

  function qrCanvas(): HTMLCanvasElement | null {
    return qrRef.current?.querySelector('canvas') ?? null;
  }

  function downloadQr() {
    const canvas = qrCanvas();
    if (!canvas || !qrLoc) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `qr-${qrLoc.name.replace(/\s+/g, '-').toLowerCase()}.png`;
    a.click();
  }

  function printQr() {
    const canvas = qrCanvas();
    if (!canvas || !qrLoc) return;
    const img = canvas.toDataURL('image/png');
    const w = window.open('', '_blank', 'width=480,height=640');
    if (!w) return;
    w.document.write(
      `<html><head><title>QR — ${qrLoc.name}</title></head>` +
      `<body style="font-family:sans-serif;text-align:center;padding:32px" onload="window.print()">` +
      `<h2>Solidrow FESTI — Baddegama Registration</h2>` +
      `<h3 style="margin:4px 0 20px">📍 ${qrLoc.name}</h3>` +
      `<img src="${img}" style="width:320px;height:320px" />` +
      `<p style="color:#555;font-size:13px;margin-top:16px">Scan to register at ${qrLoc.name}</p>` +
      `</body></html>`,
    );
    w.document.close();
  }

  async function load() {
    const res = await api.get<Location[]>('/baddegama-locations');
    setRows(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function openForm(existing?: Location) {
    const { value, isConfirmed } = await Swal.fire({
      title: existing ? 'Edit Location' : 'Add Location',
      html:
        `<input id="sw-name" class="swal2-input" placeholder="Location name" value="${existing?.name ?? ''}">` +
        `<input id="sw-agent" class="swal2-input" placeholder="Foreign agent (optional)" value="${existing?.agent ?? ''}">`,
      showCancelButton: true,
      confirmButtonText: existing ? 'Save' : 'Add',
      confirmButtonColor: '#2563eb',
      focusConfirm: false,
      preConfirm: () => {
        const name = (document.getElementById('sw-name') as HTMLInputElement).value.trim();
        const agent = (document.getElementById('sw-agent') as HTMLInputElement).value.trim();
        if (!name) {
          Swal.showValidationMessage('Location name is required');
          return false;
        }
        return { name, agent };
      },
    });
    if (!isConfirmed || !value) return;

    try {
      if (existing) {
        await api.put(`/baddegama-locations/${existing.id}`, value);
        toastSuccess('Location updated');
      } else {
        await api.post('/baddegama-locations', value);
        toastSuccess('Location added');
      }
      load();
    } catch {
      toastError('Could not save location.');
    }
  }

  async function setActive(l: Location) {
    if (l.is_active_registration) return;
    try {
      await api.post(`/baddegama-locations/${l.id}/set-active`);
      toastSuccess(`New sign-ups now attach to ${l.name}`);
      load();
    } catch {
      toastError('Could not set active location.');
    }
  }

  async function remove(l: Location) {
    const ok = await confirmDelete(`Delete location "${l.name}"?`);
    if (!ok) return;
    try {
      await api.delete(`/baddegama-locations/${l.id}`);
      setRows((prev) => prev.filter((x) => x.id !== l.id));
      toastSuccess('Location deleted');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not delete location.';
      toastError(msg);
    }
  }

  return (
    <div className="fade-in-s" style={{ maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>Registration Locations</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>
            The location marked <b>Active</b> is the branch new public sign-ups attach to.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="sr-btn-secondary" onClick={() => navigate('/baddegama')} style={{ padding: '10px 16px', borderRadius: 8, fontSize: 14, whiteSpace: 'nowrap' }}>← Registrations</button>
          {canAdd && (
            <button className="sr-btn-primary" onClick={() => openForm()} style={{ padding: '10px 16px', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <PlusIcon /> Add Location
            </button>
          )}
        </div>
      </div>

      <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '48px 1.4fr 1.2fr 130px 96px', columnGap: 12, padding: '14px 20px', fontSize: 12, fontWeight: 600, color: 'var(--muted)', borderBottom: '1px solid var(--border-soft)' }}>
          <div>#</div><div>Name</div><div>Foreign Agent</div><div>Registration</div><div>Action</div>
        </div>

        {loading && <div style={{ padding: 20, fontSize: 13, color: 'var(--muted)' }}>Loading…</div>}
        {!loading && rows.length === 0 && <div style={{ padding: 20, fontSize: 13, color: 'var(--muted)' }}>No locations yet.</div>}

        {rows.map((l, i) => (
          <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '48px 1.4fr 1.2fr 130px 96px', columnGap: 12, padding: '13px 20px', fontSize: 13, alignItems: 'center', borderBottom: '1px solid var(--row-border)' }}>
            <div style={{ color: 'var(--muted)' }}>{i + 1}</div>
            <div style={{ fontWeight: 500 }}>{l.name}</div>
            <div style={{ color: 'var(--label-2)' }}>{l.agent || 'Direct'}</div>
            <div>
              {l.is_active_registration ? (
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: 'oklch(0.92 0.06 150)', color: 'oklch(0.4 0.12 150)' }}>● Active</span>
              ) : canEdit ? (
                <button onClick={() => setActive(l)} style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, border: '1px solid var(--border-soft)', background: 'transparent', cursor: 'pointer', color: 'var(--muted)' }}>
                  Set active
                </button>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>—</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="sr-icon-btn" onClick={() => setQrLoc(l)} aria-label="QR" title="Registration QR" style={{ fontSize: 15 }}>▦</button>
              {canEdit && <button className="sr-icon-btn" onClick={() => openForm(l)} aria-label="Edit" title="Edit"><EditIcon /></button>}
              {canDelete && <button className="sr-icon-btn" onClick={() => remove(l)} aria-label="Delete" title="Delete"><TrashIcon /></button>}
            </div>
          </div>
        ))}
      </div>

      {qrLoc && (
        <div
          onClick={() => setQrLoc(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 28, width: 380, maxWidth: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Registration QR</div>
            <div style={{ fontSize: 14, color: '#0e7490', fontWeight: 600, marginBottom: 16 }}>📍 {qrLoc.name}</div>

            <div ref={qrRef} style={{ display: 'inline-block', padding: 16, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
              <QRCodeCanvas value={formUrl(qrLoc.id)} size={240} level="M" includeMargin />
            </div>

            <div style={{ fontSize: 12, color: '#64748b', margin: '14px 0', wordBreak: 'break-all', background: '#f1f5f9', padding: '8px 10px', borderRadius: 8 }}>
              {formUrl(qrLoc.id)}
            </div>
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 16 }}>
              Scan to open the registration form locked to <b>{qrLoc.name}</b>. The candidate registers on their own.
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="sr-btn-primary" onClick={printQr} style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13 }}>Print</button>
              <button className="sr-btn-secondary" onClick={downloadQr} style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13 }}>Download PNG</button>
              <button className="sr-btn-secondary" onClick={() => { navigator.clipboard?.writeText(formUrl(qrLoc.id)); toastSuccess('Link copied'); }} style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13 }}>Copy Link</button>
              <button className="sr-btn-secondary" onClick={() => setQrLoc(null)} style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13 }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
