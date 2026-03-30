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
    admin: { bg: 'var(--blue-soft)', color: 'var(--blue)' },
    management: { bg: 'var(--success-soft)', color: 'var(--success-text)' },
    warehouse: { bg: 'var(--warning-soft)', color: 'var(--warning)' },
    field: { bg: 'var(--purple-soft)', color: 'var(--purple)' },
  }[r] || { bg: 'var(--white)', color: 'var(--black)' })

  if (!isAdmin) return null

  return (
    <div className="page-content fade-in">
      {/* Header */}
      <button onClick={() => navigate(DEFAULT_ROUTE)}
        style={{ display:'flex',alignItems:'center',gap:6,background:'none',color:'var(--text-3)',fontSize:'var(--text-xs)',cursor:'pointer',padding:0,marginBottom:'var(--mar-m)' }}>
        <ArrowLeft size={14} /> Back
      </button>

      <div style={{ display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:'var(--mar-xl)' }}>
        <div>
          <div style={{ fontSize:'var(--text-xs)',fontWeight:'var(--fw-bold)',color:'var(--black)',marginBottom:4 }}>ADMIN</div>
          <div style={{ fontSize:'var(--text-base)',fontWeight:800 }}>User Management</div>
          <div style={{ fontSize:'var(--text-sm)',color:'var(--text-3)',marginTop:4 }}>
            Manage roles and pipeline assignments for all users
          </div>
        </div>
        <button onClick={() => setShowInvite(true)}
          style={{ display:'flex',alignItems:'center',gap:'var(--gap-s)',padding: 'var(--pad-s) var(--pad-l)',borderRadius:'var(--r-s)',background:'var(--navy)',color:'var(--white)',fontWeight:'var(--fw-bold)',fontSize:'var(--text-sm)',cursor:'pointer',fontFamily:'var(--font)',flexShrink:0 }}>
          <UserPlus size={16} /> Invite User
        </button>
      </div>

      {/* Flash */}
      {flash && (
        <div style={{ padding: 'var(--pad-m) var(--pad-l)',borderRadius:'var(--r-l)',marginBottom:'var(--mar-l)',
          background: flash.isErr ? 'var(--error-soft)' : 'var(--success-soft)',
          color: flash.isErr ? 'var(--error-alt)' : 'var(--success-text)',fontSize:'var(--text-sm)',fontWeight:'var(--fw-semibold)' }}>
          {flash.isErr ? '✗' : '✓'} {flash.msg}
        </div>
      )}

      {/* Pipeline role legend */}
      <div className="card" style={{ marginBottom: 'var(--mar-l)' }}>
        <div className="card-header">
          <span className="card-title"><Users size={16}  />Pipeline Role Guide</span>
        </div>
        <div style={{ padding: 'var(--pad-m) var(--pad-l)',display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'var(--gap-m)' }}>
          {[
            { role:'warehouse_manager', label:'Warehouse Manager', desc:'SO Queue, Run Order, Inventory. Manages the pipeline from QB import to fulfillment.' },
            { role:'fulfillment',       label:'Fulfillment Worker', desc:'Sees only Fulfillment Queue. Pulls parts from shelves, confirms pulled, pushes to shipment.' },
            { role:'shipping',          label:'Shipping Worker',    desc:'Sees only Shipment Queue. Enters carrier + tracking, marks orders shipped.' },
            { role:null,                label:'No Pipeline Role',   desc:'Full sidebar access. For office/admin users who need to see everything.' },
          ].map(item => (
            <div key={item.role || 'none'} style={{ padding: 'var(--pad-m)',background:'var(--white)',borderRadius:'var(--r-l)' }}>
              <div style={{ fontSize:'var(--text-xs)',fontWeight:'var(--fw-bold)',color:'var(--navy)',marginBottom:4 }}>{item.label}</div>
              <div style={{ fontSize:'var(--text-xs)',color:'var(--text-3)',lineHeight:1.5 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Users list */}
      <div className="card" style={{ marginBottom: 'var(--mar-l)' }}>
        <div className="card-header">
          <span className="card-title"><Users size={16}  />All Users</span>
          <span className="card-header__meta">{users.length} users</span>
        </div>

        {loading ? (
          <div style={{ padding: 'var(--pad-xxl)',textAlign:'center' }}><div className="spinner" style={{ margin:'0 auto' }} /></div>
        ) : users.map((u, idx) => {
          const isEditing = editId === u.id
          const rc = roleColor(u.role)
          const isSelf = u.id === currentUser?.id
          return (
            <div key={u.id} style={{ borderBottom: idx < users.length-1 ? '1px solid var(--border-l)' : 'none' }}>
              {!isEditing ? (
                /* View row */
                <div style={{ display:'flex',alignItems:'center',gap:'var(--gap-m)',padding: 'var(--pad-m) var(--pad-l)' }}>
                  {/* Avatar */}
                  <div style={{ width:38,height:38,borderRadius:'50%',background:'var(--navy)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                    <span style={{ fontSize:'var(--text-sm)',fontWeight:'var(--fw-bold)',color:'var(--white)' }}>
                      {(u.full_name||u.email||'?').slice(0,2).toUpperCase()}
                    </span>
                  </div>
                  {/* Info */}
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:'var(--gap-s)',flexWrap:'wrap' }}>
                      <span style={{ fontWeight:'var(--fw-bold)',fontSize:'var(--text-sm)' }}>{u.full_name || '—'}</span>
                      {isSelf && <span style={{ fontSize:'var(--text-xs)',fontWeight:'var(--fw-semibold)',padding:'1px 5px',borderRadius: 'var(--r-xs)',background:'var(--white)',color:'var(--text-3)' }}>you</span>}
                      <span style={{ fontSize:'var(--text-xs)',fontWeight:'var(--fw-bold)',padding:'2px 6px',borderRadius:4,background:rc.bg,color:rc.color,textTransform:'capitalize' }}>{u.role}</span>
                      {u.pipeline_role && (
                        <span style={{ fontSize:'var(--text-xs)',fontWeight:'var(--fw-bold)',padding:'2px 6px',borderRadius:4,background:'var(--blue-tint-80)',color:'var(--blue-shade-20)' }}>
                          {PIPELINE_LABELS[u.pipeline_role] || u.pipeline_role}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize:'var(--text-xs)',color:'var(--text-3)',marginTop:2 }}>{u.email}</div>
                  </div>
                  {/* Edit */}
                  <button onClick={() => startEdit(u)}
                    style={{ display:'flex',alignItems:'center',gap:4,background:'none',color:'var(--text-3)',fontSize:'var(--text-xs)',cursor:'pointer',padding:'var(--pad-s)' }}>
                    <PencilSimple size={14} /> Edit
                  </button>
                </div>
              ) : (
                /* Edit form */
                <div style={{ padding: 'var(--pad-l)',background:'var(--white)' }}>
                  <div style={{ fontSize:'var(--text-xs)',fontWeight:'var(--fw-bold)',color:'var(--navy)',marginBottom:'var(--mar-m)' }}>
                    Editing: {u.email}
                  </div>
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--gap-m)',marginBottom: 'var(--mar-m)' }}>
                    <div>
                      <label style={{ fontSize:'var(--text-xs)',fontWeight:'var(--fw-bold)',color:'var(--black)',display:'block',marginBottom:6 }}>Name</label>
                      <input value={editData.full_name||''} onChange={e=>setEditData(p=>({...p,full_name:e.target.value}))} placeholder="Full name" />
                    </div>
                    <div>
                      <label style={{ fontSize:'var(--text-xs)',fontWeight:'var(--fw-bold)',color:'var(--black)',display:'block',marginBottom:6 }}>App Role</label>
                      <select value={editData.role||''} onChange={e=>setEditData(p=>({...p,role:e.target.value}))}
                        style={{ width:'100%',height:40,borderRadius:'var(--r-l)',padding:'0 var(--pad-m)',background:'var(--bg)',fontSize:'var(--text-sm)',fontFamily:'var(--font)' }}>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: 'var(--mar-l)' }}>
                    <label style={{ fontSize:'var(--text-xs)',fontWeight:'var(--fw-bold)',color:'var(--black)',display:'block',marginBottom:6 }}>
                      Pipeline Role <span style={{ fontWeight:400,color:'var(--text-3)',textTransform:'none' }}>(controls what this user sees on their tablet)</span>
                    </label>
                    <div style={{ display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'var(--gap-s)' }}>
                      {PIPELINE_ROLES.map(pr => (
                        <button key={pr.value||'none'} onClick={() => setEditData(p=>({...p,pipeline_role:pr.value}))}
                          style={{ padding: 'var(--pad-s) var(--pad-m)',borderRadius:'var(--r-l)',cursor:'pointer',fontFamily:'var(--font)',
                            border: editData.pipeline_role === pr.value ? '2px solid var(--navy)' : '1px solid var(--border-l)',
                            background: editData.pipeline_role === pr.value ? 'var(--blue-soft)' : 'var(--bg)',
                            color: editData.pipeline_role === pr.value ? 'var(--navy)' : 'var(--black)',
                            fontWeight: editData.pipeline_role === pr.value ? 700 : 400,
                            fontSize:'var(--text-xs)',textAlign:'left' }}>
                          {pr.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display:'flex',gap:'var(--gap-s)' }}>
                    <button onClick={cancelEdit}
                      style={{ flex:1,padding:'var(--pad-s)',borderRadius:'var(--r-l)',background:'transparent',cursor:'pointer',fontSize:'var(--text-sm)',fontWeight:'var(--fw-semibold)',fontFamily:'var(--font)' }}>
                      Cancel
                    </button>
                    <button onClick={() => saveEdit(u.id)} disabled={saving}
                      style={{ flex:2,padding:'var(--pad-s)',borderRadius:'var(--r-l)',background:'var(--navy)',color:'var(--white)',cursor:'pointer',fontSize:'var(--text-sm)',fontWeight:'var(--fw-bold)',fontFamily:'var(--font)',display:'flex',alignItems:'center',justifyContent:'center',gap:6 }}>
                      {saving ? <><div className="spinner" style={{ width:14,height:14,borderWidth:2 }} /> Saving…</> : <><CheckCircle size={15} /> Save Changes</>}
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
          <div style={{ position:'fixed',bottom: 'env(safe-area-inset-bottom, 0px)',left:0,right:0,zIndex:300,background:'var(--bg)',borderRadius:'var(--r-xl) var(--r-xl) 0 0',padding:'var(--pad-xl)',maxHeight:'90vh',overflowY:'auto' }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'var(--mar-l)' }}>
              <div style={{ fontSize:'var(--text-lg)',fontWeight:800 }}>Invite New User</div>
              <button onClick={() => setShowInvite(false)}
                style={{ background:'none',cursor:'pointer',padding:'var(--pad-xs)',color:'var(--text-3)' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ display:'flex',flexDirection:'column',gap:'var(--gap-m)' }}>
              <div>
                <label style={{ fontSize:'var(--text-xs)',fontWeight:'var(--fw-bold)',color:'var(--black)',display:'block',marginBottom:6 }}>Email *</label>
                <input type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="worker@company.com" />
              </div>
              <div>
                <label style={{ fontSize:'var(--text-xs)',fontWeight:'var(--fw-bold)',color:'var(--black)',display:'block',marginBottom:6 }}>Full Name</label>
                <input value={inviteName} onChange={e=>setInviteName(e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <label style={{ fontSize:'var(--text-xs)',fontWeight:'var(--fw-bold)',color:'var(--black)',display:'block',marginBottom:6 }}>App Role</label>
                <select value={inviteRole} onChange={e=>setInviteRole(e.target.value)}
                  style={{ width:'100%',height:40,borderRadius:'var(--r-l)',padding:'0 var(--pad-m)',background:'var(--bg)',fontSize:'var(--text-sm)',fontFamily:'var(--font)' }}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:'var(--text-xs)',fontWeight:'var(--fw-bold)',color:'var(--black)',display:'block',marginBottom:8 }}>Pipeline Role</label>
                <div style={{ display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'var(--gap-s)' }}>
                  {PIPELINE_ROLES.map(pr => (
                    <button key={pr.value||'none'} onClick={() => setInvitePR(pr.value)}
                      style={{ padding: 'var(--pad-s) var(--pad-m)',borderRadius:'var(--r-l)',cursor:'pointer',fontFamily:'var(--font)',
                        border: invitePR === pr.value ? '2px solid var(--navy)' : '1px solid var(--border-l)',
                        background: invitePR === pr.value ? 'var(--blue-soft)' : 'var(--bg)',
                        color: invitePR === pr.value ? 'var(--navy)' : 'var(--black)',
                        fontWeight: invitePR === pr.value ? 700 : 400,
                        fontSize:'var(--text-xs)',textAlign:'left' }}>
                      {pr.label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={inviteUser} disabled={!inviteEmail.trim() || inviting}
                style={{ width:'100%',padding:'var(--pad-m)',borderRadius:'var(--r-xl)',
                  background: inviteEmail.trim() ? 'var(--navy)' : 'var(--border)',
                  color: inviteEmail.trim() ? 'var(--white)' : 'var(--text-3)',
                  fontWeight:'var(--fw-bold)',fontSize:'var(--text-sm)',cursor: inviteEmail.trim() && !inviting ? 'pointer' : 'not-allowed',
                  fontFamily:'var(--font)',display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginTop:'0.5rem' }}>
                {inviting ? <><div className="spinner" style={{ width:16,height:16,borderWidth:2 }} /> Inviting…</> : <><UserPlus size={16} /> Send Invite</>}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
