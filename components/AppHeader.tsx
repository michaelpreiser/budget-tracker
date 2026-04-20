'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '@/components/NavBar'
import AccountModal from '@/components/AccountModal'

interface Props {
  navigator?: React.ReactNode
}

export default function AppHeader({ navigator }: Props) {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [adminStats, setAdminStats] = useState<{ userCount: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((d) => { if (d.username) setUsername(d.username) })
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowUserMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <header className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 px-4 py-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 h-14">

          {/* Logo + Nav */}
          <div className="flex items-center gap-1">
            <div className="relative flex items-center justify-center w-8 h-8 mr-2 flex-shrink-0">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 opacity-20 animate-pulse" style={{ animationDuration: '3s' }} />
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 relative z-10" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 9C3 7.34315 4.34315 6 6 6H18C19.6569 6 21 7.34315 21 9V18C21 19.6569 19.6569 21 18 21H6C4.34315 21 3 19.6569 3 18V9Z" stroke="url(#appHGrad)" strokeWidth="1.5"/>
                <path d="M3 9H21" stroke="url(#appHGrad)" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M7 3L7 6" stroke="url(#appHGrad)" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M17 3L17 6" stroke="url(#appHGrad)" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="8" cy="14" r="1" fill="url(#appHGrad)"/>
                <circle cx="12" cy="14" r="1" fill="url(#appHGrad)"/>
                <circle cx="16" cy="14" r="1" fill="url(#appHGrad)"/>
                <defs>
                  <linearGradient id="appHGrad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#60a5fa"/><stop offset="1" stopColor="#a78bfa"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h1 className="text-sm font-bold tracking-tight text-slate-100 mr-3 hidden sm:block">Budget Tracker</h1>
            <NavBar />
          </div>

          {/* Page-specific navigator (month/year picker) */}
          {navigator}

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu((v) => !v)}
              className="flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold leading-none">
                  {username?.charAt(0)?.toUpperCase() ?? 'U'}
                </span>
              </div>
              <span className="text-slate-300 text-sm font-medium hidden sm:block">{username}</span>
              <svg className="w-3 h-3 text-slate-500" viewBox="0 0 12 12" fill="currentColor">
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-40 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
                <div className="px-3 py-2 border-b border-slate-700">
                  <p className="text-slate-400 text-xs">Signed in as</p>
                  <p className="text-slate-200 text-sm font-semibold truncate">{username}</p>
                </div>
                <button
                  onClick={() => { setShowUserMenu(false); setShowAccountModal(true) }}
                  className="w-full text-left px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Account Settings
                </button>
                {username === 'Michael Preiser' && (
                  <button
                    onClick={async () => {
                      setShowUserMenu(false)
                      const r = await fetch('/api/admin/stats')
                      if (r.ok) setAdminStats(await r.json())
                      setShowAdminPanel(true)
                    }}
                    className="w-full text-left px-3 py-2.5 text-sm text-amber-400 hover:bg-slate-700 transition-colors border-t border-slate-700"
                  >
                    Admin
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2.5 text-sm text-red-400 hover:bg-slate-700 transition-colors border-t border-slate-700"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {showAccountModal && (
        <AccountModal
          username={username}
          onClose={() => setShowAccountModal(false)}
          onUsernameChange={(name) => setUsername(name)}
        />
      )}

      {showAdminPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-slate-100 font-bold text-base">Admin</h2>
              <button
                onClick={() => setShowAdminPanel(false)}
                className="text-slate-500 hover:text-slate-300 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="bg-slate-800 rounded-xl px-4 py-3">
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Total Users</p>
              <p className="text-3xl font-bold tabular-nums text-slate-100">
                {adminStats ? adminStats.userCount : '—'}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
