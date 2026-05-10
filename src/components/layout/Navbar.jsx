import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LockKeyhole, Menu, X, LogOut } from 'lucide-react'
import { WalletButton } from '@/components/shared/WalletButton'
import { useWalletAuth } from '@/hooks/useWalletAuth.jsx'
import { ROUTES } from '@/lib/constants'
import { motion, AnimatePresence } from 'framer-motion'

const NAV_LINKS = [
  { label: 'Auctions',  to: ROUTES.DASHBOARD },
  { label: 'Create',    to: ROUTES.LAUNCH },
  { label: 'Docs',      to: '#' },
]

export function Navbar() {
  const [scrolled, setScrolled]   = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const { authenticated, logout } = useWalletAuth()

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  // Close mobile nav on route change
  useEffect(() => { setMobileOpen(false) }, [location])

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300
          ${scrolled
            ? 'bg-[rgba(10,10,15,0.88)] backdrop-blur-[14px] border-b border-[var(--border-subtle)]'
            : 'bg-transparent'
          }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-[72px] flex items-center justify-between">

          {/* Logo */}
          <Link to={ROUTES.HOME} className="flex items-center gap-2.5 group shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[rgba(124,58,237,0.15)] border border-[rgba(124,58,237,0.3)] flex items-center justify-center
              group-hover:bg-[rgba(124,58,237,0.25)] group-hover:border-[var(--violet-500)] transition-all group-hover:shadow-glow-v">
              <LockKeyhole className="w-4 h-4 text-[var(--violet-400)]" />
            </div>
            <span className="font-display font-bold text-lg text-white tracking-tight">DarkBid</span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(link => {
              const active = location.pathname === link.to
              return (
                <Link
                  key={link.label}
                  to={link.to}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                    ${active
                      ? 'text-white bg-[var(--bg-surface)] border border-[var(--border-strong)]'
                      : 'text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-surface)]'
                    }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>

          {/* Right: wallet + auth + mobile burger */}
          <div className="flex items-center gap-3">
            <WalletButton />
            {authenticated && (
              <button
                onClick={logout}
                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-text-muted hover:text-white hover:bg-bg-surface transition-all"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            )}
            <button
              onClick={() => setMobileOpen(v => !v)}
              className="md:hidden p-2 rounded-lg text-text-muted hover:text-white hover:bg-bg-surface transition-all"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.22 }}
            className="fixed top-[72px] left-0 right-0 z-40 bg-[rgba(10,10,15,0.97)] backdrop-blur-xl border-b border-[var(--border-subtle)] px-6 py-4 flex flex-col gap-2 md:hidden"
          >
            {NAV_LINKS.map(link => (
              <Link
                key={link.label}
                to={link.to}
                className="py-3 px-4 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-surface)] transition-all"
              >
                {link.label}
              </Link>
            ))}
            <div className="h-px bg-border-subtle my-2" />
            <div className="flex flex-col gap-2 pt-2">
              <WalletButton />
            </div>
            {authenticated && (
              <button
                onClick={logout}
                className="py-3 px-4 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all flex items-center gap-2 mt-2"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
