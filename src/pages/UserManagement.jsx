import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, PencilSimple, CheckCircle, Warning,
  UserPlus, X, ArrowLeft } from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'
import { useAuth } from '../lib/useAuth.jsx'
import { logActivity } from '../lib/logActivity.js'

const APP_SOURCE = (import.meta.env.VITE_APP_NAME || 'lmc_platform').toLowerCase().replace(/ /g, '_')
const DEFAULT_ROUTE = import.meta.env.VITE_DEFAULT_ROUTE
  || ({ 'Mission Control': '/opportunities', 'Warehouse IQ': '/warehouse-hq', 'Field Ops': '/dashboard' }[import.meta.env.VITE_APP_NAME] || '/dashboard')

const ROLES = ['admin', 'management', 'warehouse', 'field']
const PIPELINE_ROLES = [
  { value: null,                label: 'None (full access)' },
  { value: 'warehouse_manager', label: 'Warehouse Manager' },
  { value: 'fulfillment',       label: 'Fulfillment Worker' },
  { value: 'shipping',          label: 'Shipping Worker' },
]
const PIPELINE_LABELS = {
  warehouse_manager: 'WH Manager',
  fulfillment:       'Fulfillment',
  shipping:          'Shipping' }

export default function UserManagement() {
  const navigate  = useNavigate()
  const { isAdmin, user: currentUser } = useAuth()

  const [users,     setUsers]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [editId,    setEditId]    = useState(null)
  const [editData,  setEditData]  = useState({})
  const [saving,    setSaving]    = useState(false)
  const [flash,     setFlash]     = useState(null)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName,  setInviteName]  = useState('')
  const [inviteRole,  setInviteRole]  = useState('warehouse')
  const [invitePR,    setInvitePR]    = useState(null)
  const [inviting,    setInviting]    = useState(false)

  useEffect(() => {
    if (!isAdmin) { navigate(DEFAULT_ROUTE); return }
    loadUsers()
  }, [isAdmin])

  const loadUsers = async () => {
    const { data } = await db.from('profiles').select('*').order('created_at')
    setUsers(data || [])
    setLoading(false)
  }

  const startEdit = (u) => {
    setEditId(u.id)
    setEditData({ role: u.role, pipeline_role: u.pipeline_role, full_name: u.full_name })
  }

  const cancelEdit = () => { setEditId(null); setEditData({}) }

  const saveEdit = async (userId) => {
    setSaving(true)
    const { error } = await db.from('profiles').update({
      role:          editData.role,
      pipeline_role: editData.pipeline_role || null,
      full_name:     editData.full_name }).eq('id', userId)
    setSaving(false)
    if (error) { showFlashMsg('Save failed: ' + error.message, true); return }
    const edited = users.find(u => u.id === userId)
    await logActivity(db, currentUser?.id, APP_SOURCE, {
      category:    'profile',
      action:      'updated_user_role',
      label:       `Updated role for ${editData.full_name || edited?.email}`,
      entity_type: 'profile',
      entity_id:   userId,
      meta:        { role: editData.role, pipeline_role: editData.pipeline_role } })
    setEditId(null)
    showFlashMsg('User updated.')
    loadUsers()
  }

  const inviteUser = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    const { error } = await db.auth.admin?.inviteUserByEmail
      ? db.auth.admin.inviteUserByEmail(inviteEmail.trim())
      : db.auth.signUp({
          email: inviteEmail.trim(),
          password: Math.random().toString(36).slice(2) + 'A1!' })
    if (error && !error.message.includes('already registered')) {
      setInviting(false)
      showFlashMsg('Invite failed: ' + error.message, true)
      return
    }
    const { data: existing } = await db.from('profiles').select('id').eq('email', inviteEmail.trim()).single()
    if (existing) {
      await db.from('profiles').update({
        full_name: inviteName.trim() || null,
        role: inviteRole,
        pipeline_role: invitePR || null }).eq('id', existing.id)
    }
    setInviting(false)
    setShowInvite(false)
    setInviteEmail(''); setInviteName(''); setInviteRole('warehouse'); setInvitePR(null)
    showFlashMsg('Invite sent — user will receive an email to set their password.')
    loadUsers()
  }

  const showFlashMsg = (msg, isErr = false) => {
    setFlash({ msg, isErr })
    setTimeout(() => setFlash(null), 4000)
  }

  const roleColor = (r) => ({
    admin: { bg: 'var(--state-info-soft)', color: 'var(--state-info)' },
    management: { bg: 'var(--state-success-soft)', color: 'var(--state-success-text)' },
    warehouse: { bg: 'var(--state-warning-soft)', color: 'var(--state-warning)' },
    field: { bg: 'var(--brand-soft)', color: 'var(--brand-primary)' },
  }[r] || { bg: 'var(--surface-base)', color: 'var(--text-primary)' })

  if (!isAdmin) return null

  return (
    <div className="page-content fade-in">
      <button onClick={() => navigate(DEFAULT_ROUTE)} className="back-link">
        <ArrowLeft size="0.875rem" /> Back
      </button>

      <div className="um-invite-header">
        <button onClick={() => setShowInvite(true)} className="btn btn-navy"
          className="flex-gap-s">
          <UserPlus size="1rem" /> Invite User
        </button>
      </div>

      {flash && (
        <div className={`flash ${flash.isErr ? 'flash--error' : 'flash--success'}`}>
          {flash.isErr ? '✗' : '✓'} {flash.msg}
        </div>
      )}

      {/* Pipeline role legend */}
      <div className="card" style={{ marginBottom: 'var(--space-l)' }}>
        <div className="list-card__header">
          <span className="list-card__title"><Users size="1rem" />Pipeline Role Guide</span>
        </div>
        <div className="um-legend-grid">
          {[
            { role:'warehouse_manager', label:'Warehouse Manager', desc:'SO Queue, Run Order, Inventory. Manages the pipeline from QB import to fulfillment.' },
            { role:'fulfillment',       label:'Fulfillment Worker', desc:'Sees only Fulfillment Queue. Pulls parts from shelves, confirms pulled, pushes to shipment.' },
            { role:'shipping',          label:'Shipping Worker',    desc:'Sees only Shipment Queue. Enters carrier + tracking, marks orders shipped.' },
            { role:null,                label:'No Pipeline Role',   desc:'Full sidebar access. For office/admin users who need to see everything.' },
          ].map(item => (
            <div key={item.role || 'none'} className="um-legend-item">
              <div className="um-legend-title">{item.label}</div>
              <div className="um-legend-desc">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Users list */}
      <div className="card" style={{ marginBottom: 'var(--space-l)' }}>
        <div className="list-card__header">
          <span className="list-card__title"><Users size="1rem" />All Users</span>
          <span className="list-card__meta">{users.length} users</span>
        </div>

        {loading ? (
          <div className="spinner-pad"><div className="spinner spinner-center" /></div>
        ) : users.length === 0 ? (
          <div className="empty" style={{ padding: 'var(--space-2xl)' }}>
            <div className="empty-title">No users yet</div>
            <div className="empty-desc">Invite your first team member using the button above.</div>
          </div>
        ) : users.map((u, idx) => {
          const isEditing = editId === u.id
          const rc = roleColor(u.role)
          const isSelf = u.id === currentUser?.id
          return (
            <div key={u.id} style={{ borderBottom: idx < users.length-1 ? '1px solid var(--border-subtle)' : 'none' }}>
              {!isEditing ? (
                <div className="um-user-row">
                  <div className="avatar">
                    <span className="avatar__text">
                      {(u.full_name||u.email||'?').slice(0,2).toUpperCase()}
                    </span>
                  </div>
                  <div className="um-user-info">
                    <div className="um-user-name-row">
                      <span className="um-user-name">{u.full_name || '—'}</span>
                      {isSelf && <span className="um-self-badge">you</span>}
                      <span className="badge" style={{ background: rc.bg, color: rc.color, textTransform: 'capitalize' }}>{u.role}</span>
                      {u.pipeline_role && (
                        <span className="badge" style={{ background: 'var(--state-info-soft)', color: 'var(--state-info)' }}>
                          {PIPELINE_LABELS[u.pipeline_role] || u.pipeline_role}
                        </span>
                      )}
                    </div>
                    <div className="um-user-email">{u.email}</div>
                  </div>
                  <button onClick={() => startEdit(u)} className="um-edit-btn">
                    <PencilSimple size="0.875rem" /> Edit
                  </button>
                </div>
              ) : (
                <div className="um-edit-form">
                  <div className="um-edit-label">Editing: {u.email}</div>
                  <div className="um-edit-grid">
                    <div>
                      <label className="form-field__label">Name</label>
                      <input value={editData.full_name||''} onChange={e=>setEditData(p=>({...p,full_name:e.target.value}))} placeholder="Full name" />
                    </div>
                    <div>
                      <label className="form-field__label">App Role</label>
                      <select value={editData.role||''} onChange={e=>setEditData(p=>({...p,role:e.target.value}))}>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: 'var(--space-l)' }}>
                    <label className="form-field__label">
                      Pipeline Role <span style={{ fontWeight: 400, color: 'var(--text-muted)', textTransform: 'none' }}>(controls what this user sees on their tablet)</span>
                    </label>
                    <div className="pr-grid">
                      {PIPELINE_ROLES.map(pr => (
                        <button key={pr.value||'none'} onClick={() => setEditData(p=>({...p,pipeline_role:pr.value}))}
                          className={`pr-option${editData.pipeline_role === pr.value ? ' pr-option--active' : ''}`}>
                          {pr.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="um-actions">
                    <button onClick={cancelEdit} className="um-cancel">Cancel</button>
                    <button onClick={() => saveEdit(u.id)} disabled={saving} className="um-save">
                      {saving ? <><div className="spinner" style={{ width:14,height:14,borderWidth:2 }} /> Saving…</> : <><CheckCircle size="0.9375rem" /> Save Changes</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Invite modal */}
      {showInvite && (
        <>
          <div className="modal-overlay" onClick={() => setShowInvite(false)} />
          <div className="modal-sheet">
            <div className="modal-header">
              <div className="modal-header__title">Invite New User</div>
              <button onClick={() => setShowInvite(false)} className="modal-close">
                <X size="1.25rem" />
              </button>
            </div>
            <div className="modal-body">
              <div>
                <label className="form-field__label">Email *</label>
                <input type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="worker@company.com" />
              </div>
              <div>
                <label className="form-field__label">Full Name</label>
                <input value={inviteName} onChange={e=>setInviteName(e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <label className="form-field__label">App Role</label>
                <select value={inviteRole} onChange={e=>setInviteRole(e.target.value)}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="form-field__label">Pipeline Role</label>
                <div className="pr-grid">
                  {PIPELINE_ROLES.map(pr => (
                    <button key={pr.value||'none'} onClick={() => setInvitePR(pr.value)}
                      className={`pr-option${invitePR === pr.value ? ' pr-option--active' : ''}`}>
                      {pr.label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={inviteUser} disabled={!inviteEmail.trim() || inviting}
                className="submit-btn"
                style={{
                  background: inviteEmail.trim() ? 'var(--brand-primary)' : 'var(--border-default)',
                  color: inviteEmail.trim() ? 'var(--surface-base)' : 'var(--text-muted)',
                  cursor: inviteEmail.trim() && !inviting ? 'pointer' : 'not-allowed',
                  marginTop: 'var(--space-s)' }}>
                {inviting ? <><div className="spinner" style={{ width:16,height:16,borderWidth:2 }} /> Inviting…</> : <><UserPlus size="1rem" /> Send Invite</>}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
