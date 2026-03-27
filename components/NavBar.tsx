'use client'
import { useRef, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { label: 'Monthly', path: '/' },
  { label: 'Yearly', path: '/total' },
  { label: 'Insights', path: '/insights' },
  { label: 'Reports', path: '/reports' },
]

export default function NavBar() {
  const router = useRouter()
  const pathname = usePathname()
  const navRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({ left: 0, width: 0, opacity: 0 })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const activeIdx = NAV_ITEMS.findIndex(item => item.path === pathname)
    const idx = activeIdx >= 0 ? activeIdx : 0
    const btn = buttonRefs.current[idx]
    const nav = navRef.current
    if (!btn || !nav) return
    const navRect = nav.getBoundingClientRect()
    const btnRect = btn.getBoundingClientRect()
    setIndicatorStyle({
      left: btnRect.left - navRect.left,
      width: btnRect.width,
      opacity: 1,
      transition: ready ? 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1), width 0.25s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
    })
    if (!ready) setTimeout(() => setReady(true), 50)
  }, [pathname, ready])

  return (
    <div ref={navRef} className="relative flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5 gap-0.5">
      {/* Sliding indicator */}
      <div
        className="absolute top-0.5 bottom-0.5 rounded-lg bg-slate-700"
        style={{ ...indicatorStyle, position: 'absolute' }}
        aria-hidden
      />
      {NAV_ITEMS.map(({ label, path }, i) => {
        const isActive = path === pathname
        return (
          <button
            key={path}
            ref={el => { buttonRefs.current[i] = el }}
            onClick={() => router.push(path)}
            className={`relative z-10 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 ${
              isActive ? 'text-slate-100' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
