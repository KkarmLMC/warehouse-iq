import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle, SpinnerGap } from '@phosphor-icons/react'
import { useAuth } from '../lib/useAuth.jsx'
import { db } from '../lib/supabase.js'
import { logActivity } from '../lib/logActivity.js'

export default function AddEditPart() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { id } = useParams() // present if editing
  const isEdit = !!id

  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  const [form, setForm] = useState({
    name: '',
    sku: '',
    description: '',
    manufacturer: '',
    manufacturer_part_no: '',
    category_id: '',
    unit_of_measure: 'each',
    unit_cost: '',
    barcode: '',
    notes: '' })

  useEffect(() => {
    db.from('part_categories').select('*').order('name').then(({ data }) => setCategories(data || []))
    if (isEdit) {
      db.from('parts').select('*').eq('id', id).single().then(({ data }) => {
        if (data) {
          setForm({
            name: data.name || '',
            sku: data.sku || '',
            description: data.description || '',
            manufacturer: data.manufacturer || '',
            manufacturer_part_no: data.manufacturer_part_no || '',
            category_id: data.category_id || '',
            unit_of_measure: data.unit_of_measure || 'each',
            unit_cost: data.unit_cost || '',
            barcode: data.barcode || '',
            notes: data.notes || '' })
        }
        setLoading(false)
      })
    }
  }, [id, isEdit])

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => { const n = { ...e }; delete n[k]; return n })
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Part name is required'
    return errs
  }

  const handleSubmit = async () => {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)

    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      description: form.description.trim() || null,
      manufacturer: form.manufacturer.trim() || null,
      manufacturer_part_no: form.manufacturer_part_no.trim() || null,
      category_id: form.category_id || null,
      unit_of_measure: form.unit_of_measure || 'each',
      unit_cost: form.unit_cost ? parseFloat(form.unit_cost) : null,
      barcode: form.barcode.trim() || null,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString() }

    if (isEdit) {
      await db.from('parts').update(payload).eq('id', id)
      await logActivity(db, user?.id, 'warehouse_iq', {
        category:    'parts',
        action:      'updated',
        label:       `Updated Part ${form.sku || form.name}`,
        entity_type: 'part',
        entity_id:   id,
        meta:        { sku: form.sku, name: form.name } })
      navigate(`/warehouse-hq/part/${id}`)
    } else {
      const { data } = await db.from('parts').insert(payload).select().single()
      await logActivity(db, user?.id, 'warehouse_iq', {
        category:    'parts',
        action:      'created',
        label:       `Created Part ${form.sku || form.name}`,
        entity_type: 'part',
        entity_id:   data.id,
        meta:        { sku: form.sku, name: form.name } })
      navigate(`/warehouse-hq/part/${data.id}`)
    }
    setSaving(false)
  }

  if (loading) return <div className="page-content fade-in" style={{ display: 'flex', justifyContent: 'center', padding: 'var(--pad-xxl)' }}><div className="spinner" /></div>

  const Field = ({ label, error, required, children }) => (
    <div style={{ marginBottom: 'var(--mar-l)' }}>
      <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, color: error ? 'var(--red)' : 'var(--black)', marginBottom: 'var(--mar-xs)' }}>
        {label}{required && <span style={{ color: 'var(--red)', marginLeft: 4 }}>*</span>}
      </label>
      {children}
      {error && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--red)', marginTop: 4 }}>{error}</div>}
    </div>
  )

  return (
    <div className="page-content fade-in">
      <div style={{ background: 'var(--navy)', borderRadius: 'var(--r-m)', padding: 'var(--pad-xl)', marginBottom: 'var(--mar-l)', color: '#fff' }}>
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800 }}>{isEdit ? 'Edit Part' : 'New Part'}</div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--white)', marginTop: 4 }}>
          {isEdit ? 'Update part details' : 'Add a part to the catalog'}
        </div>
      </div>

      <div style={{ background: 'var(--white)', borderRadius: 'var(--r-m)', padding: 'var(--pad-xl)', marginBottom: 'var(--mar-l)' }}>
        <Field label="Part Name" error={errors.name} required>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Franklin Rod Air Terminal 1/2&quot;" style={{ width: '100%', borderColor: errors.name ? 'var(--red)' : undefined }} />
        </Field>

        <Field label="SKU / Part Number">
          <input value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="e.g. AT-FR-12-CU" style={{ width: '100%', fontFamily: 'var(--mono)' }} />
        </Field>

        <Field label="Category">
          <select value={form.category_id} onChange={e => set('category_id', e.target.value)} style={{ width: '100%' }}>
            <option value="">Select category…</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>

        <Field label="Manufacturer">
          <input value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)} placeholder="e.g. Lightning Master Corp" style={{ width: '100%' }} />
        </Field>

        <Field label="Manufacturer Part No.">
          <input value={form.manufacturer_part_no} onChange={e => set('manufacturer_part_no', e.target.value)} placeholder="e.g. LMC-1234-A" style={{ width: '100%', fontFamily: 'var(--mono)' }} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-m)' }}>
          <Field label="Unit of Measure">
            <select value={form.unit_of_measure} onChange={e => set('unit_of_measure', e.target.value)} style={{ width: '100%' }}>
              {['each', 'ft', 'roll', 'box', 'bag', 'set', 'pair', 'lb'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
          <Field label="Unit Cost ($)">
            <input type="number" step="0.01" min="0" value={form.unit_cost} onChange={e => set('unit_cost', e.target.value)} placeholder="0.00" style={{ width: '100%' }} />
          </Field>
        </div>

        <Field label="Barcode (manufacturer)">
          <input value={form.barcode} onChange={e => set('barcode', e.target.value)} placeholder="Scan or enter barcode" style={{ width: '100%', fontFamily: 'var(--mono)' }} />
        </Field>

        <Field label="Description">
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} placeholder="Describe this part…" style={{ width: '100%', resize: 'vertical' }} />
        </Field>

        <Field label="Notes">
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Internal notes…" style={{ width: '100%', resize: 'vertical' }} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-m)', marginBottom: 'var(--mar-xxl)' }}>
        <button onClick={() => navigate(-1)} style={{ padding: 'var(--pad-m)', borderRadius: 'var(--r-m)', background: 'var(--white)', color: 'var(--black)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={saving} style={{ padding: 'var(--pad-m)', borderRadius: 'var(--r-m)', background: saving ? 'var(--hover)' : 'var(--navy)', color: saving ? 'var(--text-3)' : '#fff', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: saving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--gap-s)' }}>
          {saving ? <><SpinnerGap size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : <><CheckCircle size={14} /> {isEdit ? 'Save Changes' : 'Add Part'}</>}
        </button>
      </div>
    </div>
  )
}
