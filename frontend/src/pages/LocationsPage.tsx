import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { EditIcon, PlusIcon, TrashIcon } from '../components/icons';
import { confirmDelete, toastError, toastSuccess } from '../lib/alerts';
import { useIsMobile } from '../lib/useMediaQuery';

interface Loc {
  id: number | string;
  name: string;
}

const inputStyle: React.CSSProperties = { padding: '10px 12px', borderRadius: 7, fontSize: 14, width: '100%' };
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 5,
  color: 'var(--label-2)',
};

function errMessage(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

export default function LocationsPage() {
  const isMobile = useIsMobile();

  const [provinces, setProvinces] = useState<Loc[]>([]);
  const [districts, setDistricts] = useState<Loc[]>([]);
  const [dsDivisions, setDsDivisions] = useState<Loc[]>([]);
  const [gnDivisions, setGnDivisions] = useState<Loc[]>([]);

  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [ds, setDs] = useState(''); // selected DS division id (drives GN list)

  // DS division add / edit form
  const [dsName, setDsName] = useState('');
  const [dsEditing, setDsEditing] = useState<Loc | null>(null);
  const [dsSaving, setDsSaving] = useState(false);

  // GN division add / edit form
  const [gnName, setGnName] = useState('');
  const [gnEditing, setGnEditing] = useState<Loc | null>(null);
  const [gnSaving, setGnSaving] = useState(false);

  // --- Loads ---------------------------------------------------------------
  useEffect(() => {
    api.get<Loc[]>('/locations/provinces').then((r) => setProvinces(r.data)).catch(() => setProvinces([]));
  }, []);

  function loadDsDivisions(districtId: string) {
    api
      .get<Loc[]>(`/locations/ds-divisions?district_id=${districtId}`)
      .then((r) => setDsDivisions(r.data))
      .catch(() => setDsDivisions([]));
  }

  function loadGnDivisions(dsId: string) {
    api
      .get<Loc[]>(`/locations/gn-divisions?ds_division_id=${dsId}`)
      .then((r) => setGnDivisions(r.data))
      .catch(() => setGnDivisions([]));
  }

  function onProvinceChange(value: string) {
    setProvince(value);
    setDistrict('');
    setDs('');
    setDsDivisions([]);
    setGnDivisions([]);
    cancelDsEdit();
    cancelGnEdit();
    if (value) {
      api
        .get<Loc[]>(`/locations/districts?province_id=${value}`)
        .then((r) => setDistricts(r.data))
        .catch(() => setDistricts([]));
    } else {
      setDistricts([]);
    }
  }

  function onDistrictChange(value: string) {
    setDistrict(value);
    setDs('');
    setGnDivisions([]);
    cancelDsEdit();
    cancelGnEdit();
    if (value) loadDsDivisions(value);
    else setDsDivisions([]);
  }

  function onSelectDs(value: string) {
    setDs(value);
    cancelGnEdit();
    if (value) loadGnDivisions(value);
    else setGnDivisions([]);
  }

  // --- DS division CRUD ----------------------------------------------------
  function startDsEdit(d: Loc) {
    setDsEditing(d);
    setDsName(d.name);
  }
  function cancelDsEdit() {
    setDsEditing(null);
    setDsName('');
  }

  async function submitDs(e: React.FormEvent) {
    e.preventDefault();
    const name = dsName.trim();
    if (!name) return toastError('DS division name is required.');
    if (!district) return toastError('Select a district first.');
    setDsSaving(true);
    try {
      if (dsEditing) {
        const res = await api.put<Loc>(`/locations/ds-divisions/${dsEditing.id}`, { name });
        setDsDivisions((prev) =>
          prev.map((x) => (x.id === dsEditing.id ? res.data : x)).sort((a, b) => a.name.localeCompare(b.name)),
        );
        toastSuccess('DS division updated');
      } else {
        const res = await api.post<Loc>('/locations/ds-divisions', { district_id: district, name });
        setDsDivisions((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
        toastSuccess('DS division added');
      }
      cancelDsEdit();
    } catch (err) {
      toastError(errMessage(err, 'Could not save the DS division.'));
    } finally {
      setDsSaving(false);
    }
  }

  async function deleteDs(d: Loc) {
    const ok = await confirmDelete(`Delete DS division "${d.name}"? Its GN divisions will also be removed.`);
    if (!ok) return;
    try {
      await api.delete(`/locations/ds-divisions/${d.id}`);
      setDsDivisions((prev) => prev.filter((x) => x.id !== d.id));
      if (String(ds) === String(d.id)) {
        setDs('');
        setGnDivisions([]);
      }
      if (dsEditing?.id === d.id) cancelDsEdit();
      toastSuccess('DS division deleted');
    } catch (err) {
      toastError(errMessage(err, 'Could not delete the DS division.'));
    }
  }

  // --- GN division CRUD ----------------------------------------------------
  function startGnEdit(g: Loc) {
    setGnEditing(g);
    setGnName(g.name);
  }
  function cancelGnEdit() {
    setGnEditing(null);
    setGnName('');
  }

  async function submitGn(e: React.FormEvent) {
    e.preventDefault();
    const name = gnName.trim();
    if (!name) return toastError('GN division name is required.');
    if (!ds) return toastError('Select a DS division first.');
    setGnSaving(true);
    try {
      if (gnEditing) {
        const res = await api.put<Loc>(`/locations/gn-divisions/${gnEditing.id}`, { name });
        setGnDivisions((prev) =>
          prev.map((x) => (x.id === gnEditing.id ? res.data : x)).sort((a, b) => a.name.localeCompare(b.name)),
        );
        toastSuccess('GN division updated');
      } else {
        const res = await api.post<Loc>('/locations/gn-divisions', {
          district_id: district,
          ds_division_id: ds,
          name,
        });
        setGnDivisions((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
        toastSuccess('GN division added');
      }
      cancelGnEdit();
    } catch (err) {
      toastError(errMessage(err, 'Could not save the GN division.'));
    } finally {
      setGnSaving(false);
    }
  }

  async function deleteGn(g: Loc) {
    const ok = await confirmDelete(`Delete GN division "${g.name}"?`);
    if (!ok) return;
    try {
      await api.delete(`/locations/gn-divisions/${g.id}`);
      setGnDivisions((prev) => prev.filter((x) => x.id !== g.id));
      if (gnEditing?.id === g.id) cancelGnEdit();
      toastSuccess('GN division deleted');
    } catch (err) {
      toastError(errMessage(err, 'Could not delete the GN division.'));
    }
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--card)',
    borderRadius: 12,
    boxShadow: 'var(--card-shadow)',
    overflow: 'hidden',
    flex: 1,
  };
  const cancelBtnStyle: React.CSSProperties = {
    padding: '11px 16px',
    borderRadius: 8,
    fontSize: 14,
    background: 'var(--row-border, #f3f4f6)',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  };

  function renderList(
    items: Loc[],
    emptyText: string,
    onEdit: (x: Loc) => void,
    onDelete: (x: Loc) => void,
    highlightId?: string,
    onRowClick?: (x: Loc) => void,
  ) {
    if (items.length === 0) {
      return <div style={{ padding: '16px 20px', fontSize: 13, color: 'var(--muted)' }}>{emptyText}</div>;
    }
    return items.map((x) => {
      const active = highlightId !== undefined && String(highlightId) === String(x.id);
      return (
        <div
          key={x.id}
          onClick={onRowClick ? () => onRowClick(x) : undefined}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 70px',
            columnGap: 12,
            padding: '12px 20px',
            fontSize: 14,
            alignItems: 'center',
            borderBottom: '1px solid var(--row-border)',
            cursor: onRowClick ? 'pointer' : 'default',
            background: active ? 'var(--row-border, #f3f4f6)' : undefined,
          }}
        >
          <div style={{ fontWeight: active ? 600 : 500 }}>{x.name}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(x);
              }}
              title="Edit"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}
            >
              <EditIcon />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(x);
              }}
              title="Delete"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.55 0.16 25)', padding: 4 }}
            >
              <TrashIcon />
            </button>
          </div>
        </div>
      );
    });
  }

  return (
    <div className="fade-in-s" style={{ maxWidth: 980 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Locations</div>
        <div style={{ fontSize: 14, color: 'var(--muted)' }}>
          Add Divisional Secretariat &amp; Grama Niladhari divisions used on the candidate form
        </div>
      </div>

      {/* Province + District selectors */}
      <div
        style={{
          background: 'var(--card)',
          borderRadius: 12,
          boxShadow: 'var(--card-shadow)',
          padding: 20,
          marginBottom: 20,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: 16,
        }}
      >
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Province</label>
          <select className="sr-input" style={inputStyle} value={province} onChange={(e) => onProvinceChange(e.target.value)}>
            <option value="">-- Select Province --</option>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>District</label>
          <select
            className="sr-input"
            style={inputStyle}
            value={district}
            onChange={(e) => onDistrictChange(e.target.value)}
            disabled={!province}
          >
            <option value="">-- Select District --</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!district ? (
        <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--muted)' }}>
          Select a province and district to manage divisions.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 20, alignItems: 'flex-start' }}>
          {/* DS divisions */}
          <div style={cardStyle}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--row-border)', fontWeight: 600 }}>
              Divisional Secretariat ({dsDivisions.length})
            </div>
            <form onSubmit={submitDs} style={{ padding: 16, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={labelStyle}>{dsEditing ? 'Edit DS division' : 'New DS division'}</label>
                <input
                  className="sr-input"
                  style={inputStyle}
                  value={dsName}
                  onChange={(e) => setDsName(e.target.value)}
                  maxLength={38}
                  placeholder="e.g. Baddegama"
                />
              </div>
              <button
                type="submit"
                className="sr-btn-primary"
                disabled={dsSaving}
                style={{ padding: '11px 16px', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {!dsEditing && <PlusIcon />}
                {dsSaving ? 'Saving…' : dsEditing ? 'Update' : 'Add'}
              </button>
              {dsEditing && (
                <button type="button" onClick={cancelDsEdit} style={cancelBtnStyle}>
                  Cancel
                </button>
              )}
            </form>
            {renderList(dsDivisions, 'No DS divisions yet — add one above.', startDsEdit, deleteDs, ds, (x) =>
              onSelectDs(String(x.id)),
            )}
          </div>

          {/* GN divisions */}
          <div style={cardStyle}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--row-border)', fontWeight: 600 }}>
              Grama Niladhari Division ({gnDivisions.length})
            </div>
            {!ds ? (
              <div style={{ padding: '16px 20px', fontSize: 13, color: 'var(--muted)' }}>
                Select a DS division on the left to manage its GN divisions.
              </div>
            ) : (
              <>
                <form onSubmit={submitGn} style={{ padding: 16, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <label style={labelStyle}>{gnEditing ? 'Edit GN division' : 'New GN division'}</label>
                    <input
                      className="sr-input"
                      style={inputStyle}
                      value={gnName}
                      onChange={(e) => setGnName(e.target.value)}
                      maxLength={34}
                      placeholder="e.g. Meepe"
                    />
                  </div>
                  <button
                    type="submit"
                    className="sr-btn-primary"
                    disabled={gnSaving}
                    style={{ padding: '11px 16px', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    {!gnEditing && <PlusIcon />}
                    {gnSaving ? 'Saving…' : gnEditing ? 'Update' : 'Add'}
                  </button>
                  {gnEditing && (
                    <button type="button" onClick={cancelGnEdit} style={cancelBtnStyle}>
                      Cancel
                    </button>
                  )}
                </form>
                {renderList(gnDivisions, 'No GN divisions yet — add one above.', startGnEdit, deleteGn)}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
