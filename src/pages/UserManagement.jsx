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
    if (error) { showFlash('Save failed: ' + error.message, true); return }
    const edited = users.find(u => u.id === userId)
    await logActivity(db, user?.id, APP_SOURCE, {
      category:    'profile',
      action:      'updated_user_role',
      label:       `Updated role for ${editData.full_name || edited?.email}`,
      entity_type: 'profile',
      entity_id:   userId,
      meta:        { role: editData.role, pipeline_role: editData.pipeline_role } })
    setEditId(null)
    showFlash('User updated.')
    loadUsers()
  }

  const inviteUser = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    // Use Supabase admin invite
    const { error } = await db.auth.admin?.inviteUserByEmail
      ? db.auth.admin.inviteUserByEmail(inviteEmail.trim())
      // Fallback: signUp with a temp password — user resets via email
      : db.auth.signUp({
          email: inviteEmail.trim(),
          password: Math.random().toString(36).slice(2) + 'A1!' })
    if (error && !error.message.includes('already registered')) {
      setInviting(false)
      showFlash('Invite failed: ' + error.message, true)
      return
    }
    // Create/update profile
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
    showFlash('Invite sent — user will receive an email to set their password.')
    loadUsers()
  }

  const showFlash = (msg, isErr = false) => {
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
      {/* Header */}
      <button onClick={() => navigate(DEFAULT_ROUTE)}
        style={{ display:'flex',alignItems:'center',gap:6,background:'none',color:'var(--text-muted)',fontSize:'var(--text-xs)',cursor:'pointer',padding:0,marginBottom:'var(--space-m)' }}>
        <ArrowLeft size="0.875rem" /> Back
      </button>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-m)' }}>
        <button onClick={() => setShowInvite(true)}
          className="btn btn-navy"
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-s)' }}>
          <UserPlus size="1rem" /> Invite User
        </button>
      </div>

      {/* Flash */}
      {flash && (
        <div style={{ padding: 'var(--space-m) var(--space-l)',borderRadius:'var(--radius-l)',marginBottom:'var(--space-l)',
          background: flash.isErr ? 'var(--state-error-soft)' : 'var(--state-success-soft)',
          color: flash.isErr ? 'var(--state-error)' : 'var(--state-success-text)',fontSize:'var(--text-sm)',fontWeight:'var(--fw-semibold)' }}>
          {flash.isErr ? '✗' : '✓'} {flash.msg}
        </div>
      )}

      {/* Pipeline role legend */}
      <div className="card" style={{ marginBottom: 'var(--space-l)' }}>
        <div className="list-card__header">
          <span className="list-card__title"><Users size="1rem"  />Pipeline Role Guide</span>
        </div>
        <div style={{ padding: 'var(--space-m) var(--space-l)',display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'var(--space-m)' }}>
          {[
            { role:'warehouse_manager', label:'Warehouse Manager', desc:'SO Queue, Run Order, Inventory. Manages the pipeline from QB import to fulfillment.' },
            { role:'fulfillment',       label:'Fulfillment Worker', desc:'Sees only Fulfillment Queue. Pulls parts from shelves, confirms pulled, pushes to shipment.' },
            { role:'shipping',          label:'Shipping Worker',    desc:'Sees only Shipment Queue. Enters carrier + tracking, marks orders shipped.' },
            { role:null,                label:'No Pipeline Role',   desc:'Full sidebar access. For office/admin users who need to see everything.' },
          ].map(item => (
            <div key={item.role || 'none'} style={{ padding: 'var(--space-m)',background:'var(--surface-base)',borderRadius:'var(--radius-l)' }}>
              <div style={{ fontSize:'var(--text-xs)',fontWeight:'var(--fw-bold)',color:'var(--brand-primary)',marginBottom:4 }}>{item.label}</div>
              <div style={{ fontSize:'var(--text-xs)',color:'var(--text-muted)',lineHeight:1.5 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Users list */}
      <div className="card" style={{ marginBottom: 'var(--space-l)' }}>
        <div className="list-card__header">
          <span className="list-card__title"><Users size="1rem"  />All Users</span>
          <span className="list-card__meta">{users.length} users</span>
        </div>

        {loading ? (
          <div style={{ padding: 'var(--space-2xl)',textAlign:'center' }}><div className="spinner" style={{ margin:'0 auto' }} /></div>
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
                /* View row */
                <div style={{ display:'flex',alignItems:'center',gap:'var(--space-m)',padding: 'var(--space-m) var(--space-l)' }}>
                  {/* Avatar */}
                  <div style={{ width:38,height:38,borderRadius:'50%',background:'var(--brand-primary)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                    <span style={{ fontSize:'var(--text-sm)',fontWeight:'var(--fw-bold)',color:'var(--surface-base)' }}>
                      {(u.full_name||u.email||'?').slice(0,2).toUpperCase()}
                    </span>
                  </div>
                  {/* Info */}
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:'var(--space-s)',flexWrap:'wrap' }}>
                      <span style={{ fontWeight:'var(--fw-bold)',fontSize:'var(--text-sm)' }}>{u.full_name || '—'}</span>
                      {isSelf && <span style={{ fontSize:'var(--text-xs)',fontWeight:'var(--fw-semibold)',padding:'1px 5px',borderRadius: 'var(--radius-xs)',background:'var(--surface-base)',color:'var(--text-muted)' }}>you</span>}
                      <span style={{ fontSize:'var(--text-xs)',fontWeight:'var(--fw-bold)',padding:'2px 6px',borderRadius:4,background:rc.bg,color:rc.color,textTransform:'capitalize' }}>{u.role}</span>
                      {u.pipeline_role && (
                        <span style={{ fontSize:'var(--text-xs)',fontWeight:'var(--fw-bold)',padding:'2px 6px',borderRadius:4,background:'var(--state-info-soft)',color:'var(--state-info)' }}>
                          {PIPELINE_LABELS[u.pipeline_role] || u.pipeline_role}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize:'var(--text-xs)',color:'var(--text-muted)',marginTop:2 }}>{u.email}</div>
                  </div>
                  {/* Edit */}
                  <button onClick={() => startEdit(u)}
                    style={{ display:'flex',alignItems:'center',gap:4,background:'none',color:'var(--text-muted)',fontSize:'var(--text-xs)',cursor:'pointer',padding:'var(--space-s)' }}>
                    <PencilSimple size="0.875rem" /> Edit
                  </button>
                </div>
              ) : (
                /* Edit form */
                <div style={{ padding: 'var(--space-l)',background:'var(--surface-base)' }}>
                  <div style={{ fontSize:'var(--text-xs)',fontWeight:'var(--fw-bold)',color:'var(--brand-primary)',marginBottom:'var(--space-m)' }}>
                    Editing: {u.email}
                  </div>
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--space-m)',marginBottom: 'var(--space-m)' }}>
                    <div>
                      <label style={{ fontSize:'var(--text-xs)',fontWeight:'var(--fw-bold)',color:'var(--text-primary)',display:'block',marginBottom:6 }}>Name</label>
                      <input value={editData.full_name||''} onChange={e=>setEditData(p=>({...p,full_name:e.target.value}))} placeholder="Full name" />
                    </div>
                    <div>
                      <label style={{ fontSize:'var(--text-xs)',fontWeight:'var(--fw-bold)',color:'var(--text-primary)',display:'block',marginBottom:6 }}>App Role</label>
                      <select value={editData.role||''} onChange={e=>setEditData(p=>({...p,role:e.target.value}))}
                        style={{ width:'100%',height:40,borderRadius:'var(--radius-l)',padding:'0 var(--space-m)',background:'var(--bg)',fontSize:'var(--text-sm)',fontFamily:'var(--font)' }}>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: 'var(--space-l)' }}>
                    <label style={{ fontSize:'var(--text-xs)',fontWeight:'var(--fw-bold)',color:'var(--text-primary)',display:'block',marginBottom:6 }}>
                      Pipeline Role <span style={{ fontWeight:400,color:'var(--text-muted)',textTransform:'none' }}>(controls what this user sees on their tablet)</span>
                    </label>
                    <div style={{ display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'var(--space-s)' }}>
                      {PIPELINE_ROLES.map(pr => (
                        <button key={pr.value||'none'} onClick={() => setEditData(p=>({...p,pipeline_role:pr.value}))}
                          style={{ padding: 'var(--space-s) var(--space-m)',borderRadius:'var(--radius-l)',cursor:'pointer',fontFamily:'var(--font)',
                            border: editData.pipeline_role === pr.value ? '2px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                            background: editData.pipeline_role === pr.value ? 'var(--state-info-soft)' : 'var(--bg)',
                            color: editData.pipeline_role === pr.value ? 'var(--brand-primary)' : 'var(--text-primary)',
                            fontWeight: editData.pipeline_role === pr.value ? 700 : 400,
                            fontSize:'var(--text-xs)',textAlign:'left' }}>
                          {pr.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display:'flex',gap:'var(--space-s)' }}>
                    <button onClick={cancelEdit}
                      style={{ flex:1,padding:'var(--space-s)',borderRadius:'var(--radius-l)',background:'transparent',cursor:'pointer',fontSize:'var(--text-sm)',fontWeight:'var(--fw-semibold)',fontFamily:'var(--font)' }}>
                      Cancel
                    </button>
                    <button onClick={() => saveEdit(u.id)} disabled={saving}
                      style={{ flex:2,padding:'var(--space-s)',borderRadius:'var(--radius-l)',background:'var(--brand-primary)',color:'var(--surface-base)',cursor:'pointer',fontSize:'var(--text-sm)',fontWeight:'var(--fw-bold)',fontFamily:'var(--font)',display:'flex',alignItems:'center',justifyContent:'center',gap:6 }}>
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
          <div onClick={() => setShowInvite(false)}
            style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:299 }} />
          <div style={{ position:'fixed',bottom: 'env(safe-area-inset-bottom, 0px)',left:0,right:0,zIndex:300,background:'var(--bg)',borderRadius:'var(--radius-l) var(--radius-l) 0 0',padding:'var(--space-xl)',maxHeight:'90vh',overflowY:'auto' }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'var(--space-l)' }}>
              <div style={{ fontSize:'var(--text-lg)',fontWeight:800 }}>Invite New User</div>
              <button onClick={() => setShowInvite(false)}
                style={{ background:'none',cursor:'pointer',padding:'var(--space-xs)',color:'var(--text-muted)' }}>
                <X size="1.25rem" />
              </button>
            </div>
            <div style={{ display:'flex',flexDirection:'column',gap:'var(--space-m)' }}>
              <div>
                <label style={{ fontSize:'var(--text-xs)',fontWeight:'var(--fw-bold)',color:'var(--text-primary)',display:'block',marginBottom:6 }}>Email *</label>
                <input type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="worker@company.com" />
              </div>
              <div>
                <label style={{ fontSize:'var(--text-xs)',fontWeight:'var(--fw-bold)',color:'var(--text-primary)',display:'block',marginBottom:6 }}>Full Name</label>
                <input value={inviteName} onChange={e=>setInviteName(e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <label style={{ fontSize:'var(--text-xs)',fontWeight:'var(--fw-bold)',color:'var(--text-primary)',display:'block',marginBottom:6 }}>App Role</label>
                <select value={inviteRole} onChange={e=>setInviteRole(e.target.value)}
                  style={{ width:'100%',height:40,borderRadius:'var(--radius-l)',padding:'0 var(--space-m)',background:'var(--bg)',fontSize:'var(--text-sm)',fontFamily:'var(--font)' }}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:'var(--text-xs)',fontWeight:'var(--fw-bold)',color:'var(--text-primary)',display:'block',marginBottom:8 }}>Pipeline Role</label>
                <div style={{ display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'var(--space-s)' }}>
                  {PIPELINE_ROLES.map(pr => (
                    <button key={pr.value||'none'} onClick={() => setInvitePR(pr.value)}
                      style={{ padding: 'var(--space-s) var(--space-m)',borderRadius:'var(--radius-l)',cursor:'pointer',fontFamily:'var(--font)',
                        border: invitePR === pr.value ? '2px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                        background: invitePR === pr.value ? 'var(--state-info-soft)' : 'var(--bg)',
                        color: invitePR === pr.value ? 'var(--brand-primary)' : 'var(--text-primary)',
                        fontWeight: invitePR === pr.value ? 700 : 400,
                        fontSize:'var(--text-xs)',textAlign:'left' }}>
                      {pr.label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={inviteUser} disabled={!inviteEmail.trim() || inviting}
                style={{ width:'100%',padding:'var(--space-m)',borderRadius:'var(--radius-l)',
                  background: inviteEmail.trim() ? 'var(--brand-primary)' : 'var(--border-default)',
                  color: inviteEmail.trim() ? 'var(--surface-base)' : 'var(--text-muted)',
                  fontWeight:'var(--fw-bold)',fontSize:'var(--text-sm)',cursor: inviteEmail.trim() && !inviting ? 'pointer' : 'not-allowed',
                  fontFamily:'var(--font)',display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginTop:'0.5rem' }}>
                {inviting ? <><div className="spinner" style={{ width:16,height:16,borderWidth:2 }} /> Inviting…</> : <><UserPlus size="1rem" /> Send Invite</>}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
