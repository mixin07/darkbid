import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PageTransition } from '@/components/shared/PageTransition'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuctionCard } from '@/components/auction/AuctionCard'
import { Info, Zap } from 'lucide-react'
import { useWalletAuth } from '@/hooks/useWalletAuth.jsx'
import { createAuction } from '@/lib/api'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'

function humanDuration(seconds) {
  const s = parseInt(seconds) || 0
  if (s <= 0) return '—'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const parts = []
  if (h > 0)   parts.push(`${h}h`)
  if (m > 0)   parts.push(`${m}m`)
  if (sec > 0 && h === 0) parts.push(`${sec}s`)
  return parts.join(' ') || '—'
}

const DURATION_PRESETS = [
  { label: '30 min',  s: '1800' },
  { label: '60 min',  s: '3600' },
  { label: '2 hours', s: '7200' },
  { label: '6 hours', s: '21600' },
]

const FieldLabel = ({ children }) => (
  <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">{children}</label>
)

export default function Launch() {
  const { authenticated } = useWalletAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: 'MyToken',
    symbol: '$MTK',
    supply: '1000000',
    reserve: '50',
    duration: '3600',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleCreateAuction = async () => {
    try {
      setSubmitting(true)
      setSubmitError(null)

      // Validate form
      if (!form.name || !form.symbol || !form.reserve || !form.duration) {
        setSubmitError('Please fill in all fields')
        setSubmitting(false)
        return
      }

      // Send to backend
      const reserveLamports = Math.round(parseFloat(form.reserve) * LAMPORTS_PER_SOL)

      const response = await createAuction({
        title: form.name,
        reserve_price: reserveLamports,
        commit_duration_seconds: parseInt(form.duration, 10),
        reveal_duration_seconds: parseInt(form.duration, 10)
      })

      console.log('✅ Auction created:', response)
      setSubmitSuccess(true)

      // Redirect to dashboard after 1 second
      setTimeout(() => {
        navigate('/dashboard')
      }, 1000)
    } catch (err) {
      setSubmitError(err.message)
      console.error('❌ Create auction error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  // Authentication is handled by ProtectedRoute

  return (
    <PageTransition className="w-full max-w-7xl mx-auto px-6 py-12">

      {/* Header */}
      <div className="mb-12">
        <h1 className="text-display mb-3">Create Auction</h1>
        <p className="text-[var(--text-secondary)] text-lg max-w-2xl">
          Deploy a mathematically provable fair token launch.
          All bids are sealed, ZK-verified, and 100% on-chain.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_420px] gap-12">

        {/* ── Form ── */}
        <div className="flex flex-col gap-10">

          {/* Token Details */}
          <section className="flex flex-col gap-6">
            <h3 className="font-display font-bold text-white border-b border-[var(--border-subtle)] pb-4">
              Token Details
            </h3>

            <div className="grid grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <FieldLabel>Token Name</FieldLabel>
                <Input
                  value={form.name}
                  onChange={set('name')}
                  placeholder="e.g. DarkToken"
                  className="bg-[var(--bg-elevated)] border-[var(--border-default)] focus-visible:ring-[var(--violet-500)] text-white"
                />
              </div>
              <div className="flex flex-col gap-2">
                <FieldLabel>Token Symbol</FieldLabel>
                <Input
                  value={form.symbol}
                  onChange={set('symbol')}
                  placeholder="e.g. $DRK"
                  className="bg-[var(--bg-elevated)] border-[var(--border-default)] focus-visible:ring-[var(--violet-500)] font-mono text-white"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <FieldLabel>Tokens to Sell</FieldLabel>
              <div className="relative">
                <Input
                  type="number"
                  value={form.supply}
                  onChange={set('supply')}
                  className="bg-[var(--bg-elevated)] border-[var(--border-default)] focus-visible:ring-[var(--violet-500)] pr-16 font-mono text-white"
                />
                <button
                  onClick={() => setForm(f => ({ ...f, supply: '1000000000' }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--violet-400)] hover:text-[var(--violet-200)] transition-colors"
                >
                  MAX
                </button>
              </div>
              {form.supply && (
                <span className="text-[11px] text-[var(--text-muted)] font-mono">
                  = {Number(form.supply).toLocaleString()} tokens
                </span>
              )}
            </div>
          </section>

          {/* Auction Settings */}
          <section className="flex flex-col gap-6">
            <h3 className="font-display font-bold text-white border-b border-[var(--border-subtle)] pb-4">
              Auction Settings
            </h3>

            {/* Reserve price */}
            <div className="flex flex-col gap-2">
              <FieldLabel>Reserve Price</FieldLabel>
              <div className="relative">
                <Input
                  type="number"
                  value={form.reserve}
                  onChange={set('reserve')}
                  placeholder="0.00"
                  className="bg-[var(--bg-elevated)] border-[var(--border-default)] focus-visible:ring-[var(--violet-500)] pr-16 font-mono text-white"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-mono text-xs">SOL</span>
              </div>
            </div>

            {/* Duration */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <FieldLabel>Auction Duration</FieldLabel>
                {form.duration && (
                  <span className="text-xs font-mono text-[var(--violet-400)]">
                    = {humanDuration(form.duration)}
                  </span>
                )}
              </div>

              {/* Preset buttons */}
              <div className="grid grid-cols-4 gap-2">
                {DURATION_PRESETS.map(p => (
                  <button
                    key={p.s}
                    onClick={() => setForm(f => ({ ...f, duration: p.s }))}
                    className={`py-2.5 rounded-xl text-xs font-semibold transition-all border
                      ${form.duration === p.s
                        ? 'bg-[var(--violet-500)] border-[var(--violet-400)] text-white shadow-glow-v'
                        : 'bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-white'
                      }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Custom input */}
              <div className="relative">
                <Input
                  type="number"
                  value={form.duration}
                  onChange={set('duration')}
                  placeholder="Custom seconds..."
                  className="bg-[var(--bg-elevated)] border-[var(--border-default)] focus-visible:ring-[var(--violet-500)] pr-20 font-mono text-white"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-mono text-xs">seconds</span>
              </div>
            </div>

            {/* Deploy */}
            {submitError && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {submitError}
              </div>
            )}

            {submitSuccess && (
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
                ✅ Auction created! Redirecting to dashboard...
              </div>
            )}

            <motion.div whileTap={{ scale: 0.98 }}>
              <Button 
                onClick={handleCreateAuction}
                disabled={submitting || !authenticated}
                className="w-full py-6 text-lg font-display font-bold text-white rounded-xl border-none transition-all
                bg-gradient-to-r from-[var(--violet-500)] to-[#9C4FFF]
                hover:shadow-[0_0_32px_rgba(124,58,237,0.5)] hover:-translate-y-0.5
                disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center justify-center gap-2">
                <Zap className="w-5 h-5" />
                {submitting ? 'Creating Auction...' : 'Deploy Auction on Solana →'}
              </Button>
            </motion.div>
          </section>
        </div>

        {/* ── Preview ── */}
        <div>
          <div className="sticky top-24 p-8 rounded-3xl border border-[var(--border-subtle)] bg-[rgba(10,10,15,0.8)] backdrop-blur-xl shadow-modal">
            <div className="flex items-center gap-2 mb-6">
              <span className="w-2 h-2 rounded-full bg-[var(--violet-400)] animate-pulse" />
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-semibold">Live Preview</span>
            </div>

            <div className="pointer-events-none">
              <AuctionCard
                id="preview"
                name={form.name || 'TokenName'}
                symbol={form.symbol || '$SYM'}
                reserve={form.reserve || '0'}
                time={humanDuration(form.duration)}
                bids="0"
                isLive
              />
            </div>

            <div className="mt-6 flex items-start gap-3 p-4 rounded-xl bg-[rgba(124,58,237,0.07)] border border-[rgba(124,58,237,0.15)]">
              <Info className="w-4 h-4 text-[var(--violet-400)] shrink-0 mt-0.5" />
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                This is exactly how bidders will see your auction card on the dashboard.
              </p>
            </div>
          </div>
        </div>

      </div>
    </PageTransition>
  )
}
