'use client'

import { useState, useEffect, useRef } from 'react'

interface Props {
  username: string
  onClose: () => void
  onUsernameChange: (newUsername: string) => void
}

type Tab = 'username' | 'password'

export default function AccountModal({ username, onClose, onUsernameChange }: Props) {
  const [tab, setTab] = useState<Tab>('username')
  const overlayRef = useRef<HTMLDivElement>(null)

  // Username tab state
  const [newUsername, setNewUsername] = useState(username)
  const [usernamePassword, setUsernamePassword] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [usernameSuccess, setUsernameSuccess] = useState('')
  const [usernameSaving, setUsernameSaving] = useState(false)

  // Password tab state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function switchTab(t: Tab) {
    setTab(t)
    setUsernameError(''); setUsernameSuccess('')
    setPasswordError(''); setPasswordSuccess('')
  }

  async function handleUsernameSubmit(e: React.FormEvent) {
    e.preventDefault()
    setUsernameError(''); setUsernameSuccess('')
    const trimmed = newUsername.trim()
    if (!trimmed) { setUsernameError('Username cannot be empty.'); return }
    if (trimmed === username) { setUsernameError('That is already your username.'); return }
    if (!usernamePassword) { setUsernameError('Enter your current password to confirm.'); return }

    setUsernameSaving(true)
    try {
      const res = await fetch('/api/auth/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: usernamePassword, newUsername: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) { setUsernameError(data.error); return }
      onUsernameChange(data.username)
      setUsernameSuccess('Username updated successfully.')
      setUsernamePassword('')
    } finally {
      setUsernameSaving(false)
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError(''); setPasswordSuccess('')
    if (newPassword !== confirmPassword) { setPasswordError('New passwords do not match.'); return }
    if (newPassword.length < 6) { setPasswordError('New password must be at least 6 characters.'); return }

    setPasswordSaving(true)
    try {
      const res = await fetch('/api/auth/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) { setPasswordError(data.error); return }
      setPasswordSuccess('Password updated successfully.')
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    } finally {
      setPasswordSaving(false)
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="text-slate-200 font-semibold text-base">Account Settings</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800">
          {(['username', 'password'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`flex-1 py-2.5 text-sm font-semibold capitalize transition-colors ${
                tab === t
                  ? 'text-slate-100 border-b-2 border-blue-500 -mb-px'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t === 'username' ? 'Change Username' : 'Change Password'}
            </button>
          ))}
        </div>

        {/* Username tab */}
        {tab === 'username' && (
          <form onSubmit={handleUsernameSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">New Username</label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                maxLength={50}
                required
                autoFocus
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Current Password <span className="text-slate-600">(to confirm)</span>
              </label>
              <input
                type="password"
                value={usernamePassword}
                onChange={(e) => setUsernamePassword(e.target.value)}
                required
                placeholder="Enter your current password"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition"
              />
            </div>
            {usernameError && (
              <p className="text-red-400 text-sm bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
                {usernameError}
              </p>
            )}
            {usernameSuccess && (
              <p className="text-emerald-400 text-sm bg-emerald-950/40 border border-emerald-800/50 rounded-xl px-3 py-2">
                {usernameSuccess}
              </p>
            )}
            <button
              type="submit"
              disabled={usernameSaving}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition text-sm"
            >
              {usernameSaving ? 'Saving…' : 'Update Username'}
            </button>
          </form>
        )}

        {/* Password tab */}
        {tab === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoFocus
                autoComplete="current-password"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="At least 6 characters"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition"
              />
            </div>
            {passwordError && (
              <p className="text-red-400 text-sm bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
                {passwordError}
              </p>
            )}
            {passwordSuccess && (
              <p className="text-emerald-400 text-sm bg-emerald-950/40 border border-emerald-800/50 rounded-xl px-3 py-2">
                {passwordSuccess}
              </p>
            )}
            <button
              type="submit"
              disabled={passwordSaving}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition text-sm"
            >
              {passwordSaving ? 'Saving…' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
