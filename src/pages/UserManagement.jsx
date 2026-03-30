import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, PencilSimple, CheckCircle, Warning,
  UserPlus, X, ArrowLeft,
} from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'
import { useAuth } from '../lib/useAuth.jsx'
import { logActivity } from '../lib/logActivity.js'

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
  shipping:          'Shipping',
}

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
    if (!isAdmin) { navigate('/warehouse-hq'); return }
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
      full_name:     editData.full_name,
    }).eq('id', userId)
    setSaving(false)
    if (error) { showFlash('Save failed: ' + error.message, true); return }
    const edited = users.find(u => u.id === userId)
    await logActivity(db, user?.id, 'warehouse_iq', {
      category:    'profile',
      action:      'updated_user_role',
      label:       `Updated role for ${editData.full_name || edited?.email}`,
      entity_type: 'profile',
      entity_id:   userId,
      meta:        { role: editData.role, pipeline_role: editData.pipeline_role },
    })
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
          password: Math.random().toString(36).slice(2) + 'A1!',
        })
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
        pipeline_role: invitePR || null,
      }).eq('id', existing.id)
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
    admin: { bg: '#EFF6FF', color: '#1D4ED8' },
    management: { bg: '#F0FDF4', color: '#15803D' },
    warehouse: { bg: '#FFFBEB', color: '#D97706' },
    field: { bg: '#F5F3FF', color: '#7C3AED' },
  }[r] || { bg: 'var(--surface-raised)', color: 'var(--black)' })

  if (!isAdmin) return null

  return (
    <div className="page-content fade-in">
      {/* Header */}
      <button onClick={() => navigate('/warehouse-hq')}
        style={{ display:'flex',alignItems:'center',gap:6,border:'none',background:'none',color:'var(--text-3)',fontSize:'var(--text-xs)',cursor:'pointer',padding:0,marginBottom:'var(--sp-3)' }}>
        <ArrowLeft size={14} /> Back
      </button>

      <div style={{ display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:'var(--sp-5)' }}>
        <div>
          <div style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--black)',marginBottom:4 }}>ADMIN</div>
          <div style={{ fontSize:'var(--text-base)',fontWeight:800 }}>User Management</div>
          <div style={{ fontSize:'var(--text-sm)',color:'var(--text-3)',marginTop:4 }}>
            Manage roles and pipeline assignments for all users
          </div>
        </div>
        <button onClick={() => setShowInvite(true)}
          style={{ display:'flex',alignItems:'center',gap:'var(--sp-2)',padding:'var(--sp-2) var(--sp-4)',borderRadius:'var(--r-xl)',border:'none',background:'var(--navy)',color:'#fff',fontWeight:700,fontSize:'var(--text-sm)',cursor:'pointer',fontFamily:'var(--font)',flexShrink:0 }}>
          <UserPlus size={16} /> Invite User
        </button>
      </div>

      {/* Flash */}
      {flash && (
        <div style={{ padding:'var(--sp-3) var(--sp-4)',borderRadius:'var(--r-l)',marginBottom:'var(--sp-4)',
          background: flash.isErr ? 'var(--error-soft)' : 'var(--success-soft)',
          color: flash.isErr ? 'var(--error-alt)' : 'var(--success-text)',fontSize:'var(--text-sm)',fontWeight:600 }}>
          {flash.isErr ? '✗' : '✓'} {flash.msg}
        </div>
      )}

      {/* Pipeline role legend */}
      <div className="card" style={{ marginBottom:'var(--sp-4)' }}>
        <div className="card-header">
          <span className="card-title"><Users size={15} style={{ marginRight:6 }} />Pipeline Role Guide</span>
        </div>
        <div style={{ padding:'var(--sp-3) var(--sp-4)',display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'var(--sp-3)' }}>
          {[
            { role:'warehouse_manager', label:'Warehouse Manager', desc:'SO Queue, Run Order, Inventory. Manages the pipeline from QB import to fulfillment.' },
            { role:'fulfillment',       label:'Fulfillment Worker', desc:'Sees only Fulfillment Queue. Pulls parts from shelves, confirms pulled, pushes to shipment.' },
            { role:'shipping',          label:'Shipping Worker',    desc:'Sees only Shipment Queue. Enters carrier + tracking, marks orders shipped.' },
            { role:null,                label:'No Pipeline Role',   desc:'Full sidebar access. For office/admin users who need to see everything.' },
          ].map(item => (
            <div key={item.role || 'none'} style={{ padding:'var(--sp-3)',background:'var(--surface-raised)',borderRadius:'var(--r-l)' }}>
              <div style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--navy)',marginBottom:4 }}>{item.label}</div>
              <div style={{ fontSize:'var(--text-xs)',color:'var(--text-3)',lineHeight:1.5 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Users list */}
      <div className="card" style={{ marginBottom:'var(--sp-4)' }}>
        <div className="card-header">
          <span className="card-title"><Users size={15} style={{ marginRight:6 }} />All Users</span>
          <span style={{ fontSize:'var(--text-xs)',color:'rgba(255,255,255,0.55)' }}>{users.length} users</span>
        </div>

        {loading ? (
          <div style={{ padding:'var(--sp-6)',textAlign:'center' }}><div className="spinner" style={{ margin:'0 auto' }} /></div>
        ) : users.map((u, idx) => {
          const isEditing = editId === u.id
          const rc = roleColor(u.role)
          const isSelf = u.id === currentUser?.id
          return (
            <div key={u.id} style={{ borderBottom: idx < users.length-1 ? '1px solid var(--border-l)' : 'none' }}>
              {!isEditing ? (
                /* View row */
                <div style={{ display:'flex',alignItems:'center',gap:'var(--sp-3)',padding:'var(--sp-3) var(--sp-4)' }}>
                  {/* Avatar */}
                  <div style={{ width:38,height:38,borderRadius:'50%',background:'var(--navy)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                    <span style={{ fontSize:'var(--text-sm)',fontWeight:700,color:'#fff' }}>
                      {(u.full_name||u.email||'?').slice(0,2).toUpperCase()}
                    </span>
                  </div>
                  {/* Info */}
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:'var(--sp-2)',flexWrap:'wrap' }}>
                      <span style={{ fontWeight:700,fontSize:'var(--text-sm)' }}>{u.full_name || '—'}</span>
                      {isSelf && <span style={{ fontSize:'var(--text-xs)',fontWeight:600,padding:'1px 5px',borderRadius:3,background:'var(--surface-raised)',color:'var(--text-3)' }}>you</span>}
                      <span style={{ fontSize:'var(--text-xs)',fontWeight:700,padding:'2px 6px',borderRadius:4,background:rc.bg,color:rc.color,textTransform:'capitalize' }}>{u.role}</span>
                      {u.pipeline_role && (
                        <span style={{ fontSize:'var(--text-xs)',fontWeight:700,padding:'2px 6px',borderRadius:4,background:'#ECFEFF',color:'#0891B2' }}>
                          {PIPELINE_LABELS[u.pipeline_role] || u.pipeline_role}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize:'var(--text-xs)',color:'var(--text-3)',marginTop:2 }}>{u.email}</div>
                  </div>
                  {/* Edit */}
                  <button onClick={() => startEdit(u)}
                    style={{ display:'flex',alignItems:'center',gap:4,border:'none',background:'none',color:'var(--text-3)',fontSize:'var(--text-xs)',cursor:'pointer',padding:'var(--sp-2)' }}>
                    <PencilSimple size={14} /> Edit
                  </button>
                </div>
              ) : (
                /* Edit form */
                <div style={{ padding:'var(--sp-4)',background:'var(--surface-raised)' }}>
                  <div style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--navy)',marginBottom:'var(--sp-3)' }}>
                    Editing: {u.email}
                  </div>
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--sp-3)',marginBottom:'var(--sp-3)' }}>
                    <div>
                      <label style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--black)',display:'block',marginBottom:6 }}>Name</label>
                      <input value={editData.full_name||''} onChange={e=>setEditData(p=>({...p,full_name:e.target.value}))} placeholder="Full name" />
                    </div>
                    <div>
                      <label style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--black)',display:'block',marginBottom:6 }}>App Role</label>
                      <select value={editData.role||''} onChange={e=>setEditData(p=>({...p,role:e.target.value}))}
                        style={{ width:'100%',height:40,borderRadius:'var(--r-l)',border:'1px solid var(--border)',padding:'0 var(--sp-3)',background:'var(--bg)',fontSize:'var(--text-sm)',fontFamily:'var(--font)' }}>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom:'var(--sp-4)' }}>
                    <label style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--black)',display:'block',marginBottom:6 }}>
                      Pipeline Role <span style={{ fontWeight:400,color:'var(--text-3)',textTransform:'none' }}>(controls what this user sees on their tablet)</span>
                    </label>
                    <div style={{ display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'var(--sp-2)' }}>
                      {PIPELINE_ROLES.map(pr => (
                        <button key={pr.value||'none'} onClick={() => setEditData(p=>({...p,pipeline_role:pr.value}))}
                          style={{ padding:'var(--sp-2) var(--sp-3)',borderRadius:'var(--r-l)',cursor:'pointer',fontFamily:'var(--font)',
                            border: editData.pipeline_role === pr.value ? '2px solid var(--navy)' : '1px solid var(--border-l)',
                            background: editData.pipeline_role === pr.value ? '#EFF6FF' : 'var(--bg)',
                            color: editData.pipeline_role === pr.value ? 'var(--navy)' : 'var(--black)',
                            fontWeight: editData.pipeline_role === pr.value ? 700 : 400,
                            fontSize:'var(--text-xs)',textAlign:'left' }}>
                          {pr.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display:'flex',gap:'var(--sp-2)' }}>
                    <button onClick={cancelEdit}
                      style={{ flex:1,padding:'var(--sp-2)',borderRadius:'var(--r-l)',border:'1px solid var(--border-l)',background:'transparent',cursor:'pointer',fontSize:'var(--text-sm)',fontWeight:600,fontFamily:'var(--font)' }}>
                      Cancel
                    </button>
                    <button onClick={() => saveEdit(u.id)} disabled={saving}
                      style={{ flex:2,padding:'var(--sp-2)',borderRadius:'var(--r-l)',border:'none',background:'var(--navy)',color:'#fff',cursor:'pointer',fontSize:'var(--text-sm)',fontWeight:700,fontFamily:'var(--font)',display:'flex',alignItems:'center',justifyContent:'center',gap:6 }}>
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
          <div style={{ position:'fixed',bottom:0,left:0,right:0,zIndex:300,background:'var(--bg)',borderRadius:'var(--r-xl) var(--r-xl) 0 0',padding:'var(--sp-5)',boxShadow:'0 -4px 24px rgba(0,0,0,0.15)',maxHeight:'90vh',overflowY:'auto' }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'var(--sp-4)' }}>
              <div style={{ fontSize:'var(--text-lg)',fontWeight:800 }}>Invite New User</div>
              <button onClick={() => setShowInvite(false)}
                style={{ border:'none',background:'none',cursor:'pointer',padding:'var(--sp-1)',color:'var(--text-3)' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ display:'flex',flexDirection:'column',gap:'var(--sp-3)' }}>
              <div>
                <label style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--black)',display:'block',marginBottom:6 }}>Email *</label>
                <input type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="worker@company.com" />
              </div>
              <div>
                <label style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--black)',display:'block',marginBottom:6 }}>Full Name</label>
                <input value={inviteName} onChange={e=>setInviteName(e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <label style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--black)',display:'block',marginBottom:6 }}>App Role</label>
                <select value={inviteRole} onChange={e=>setInviteRole(e.target.value)}
                  style={{ width:'100%',height:40,borderRadius:'var(--r-l)',border:'1px solid var(--border)',padding:'0 var(--sp-3)',background:'var(--bg)',fontSize:'var(--text-sm)',fontFamily:'var(--font)' }}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--black)',display:'block',marginBottom:8 }}>Pipeline Role</label>
                <div style={{ display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'var(--sp-2)' }}>
                  {PIPELINE_ROLES.map(pr => (
                    <button key={pr.value||'none'} onClick={() => setInvitePR(pr.value)}
                      style={{ padding:'var(--sp-2) var(--sp-3)',borderRadius:'var(--r-l)',cursor:'pointer',fontFamily:'var(--font)',
                        border: invitePR === pr.value ? '2px solid var(--navy)' : '1px solid var(--border-l)',
                        background: invitePR === pr.value ? '#EFF6FF' : 'var(--bg)',
                        color: invitePR === pr.value ? 'var(--navy)' : 'var(--black)',
                        fontWeight: invitePR === pr.value ? 700 : 400,
                        fontSize:'var(--text-xs)',textAlign:'left' }}>
                      {pr.label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={inviteUser} disabled={!inviteEmail.trim() || inviting}
                style={{ width:'100%',padding:'var(--sp-3)',borderRadius:'var(--r-xl)',border:'none',
                  background: inviteEmail.trim() ? 'var(--navy)' : 'var(--border)',
                  color: inviteEmail.trim() ? '#fff' : 'var(--text-3)',
                  fontWeight:700,fontSize:'var(--text-sm)',cursor: inviteEmail.trim() && !inviting ? 'pointer' : 'not-allowed',
                  fontFamily:'var(--font)',display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginTop:'var(--sp-2)' }}>
                {inviting ? <><div className="spinner" style={{ width:16,height:16,borderWidth:2 }} /> Inviting…</> : <><UserPlus size={16} /> Send Invite</>}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
