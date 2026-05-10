import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { LockKeyhole, ShieldCheck, Trophy, Clock, Wallet, Key } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageTransition } from '@/components/shared/PageTransition'
import { WalletButton } from '@/components/shared/WalletButton'
import { AuctionCard } from '@/components/auction/AuctionCard'
import { BlackHoleCanvas } from '@/components/shared/BlackHoleCanvas'
import { ROUTES } from '@/lib/constants'

/* ── Count-up hook ─────────────────────────────────────────── */
function useCountUp(target, duration = 2000, format) {
  const [value, setValue] = useState(0)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  useEffect(() => {
    if (!inView) return
    let start = null
    const numeric = parseFloat(target.replace(/[^0-9.]/g, ''))
    const raf = (ts) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * numeric))
      if (progress < 1) requestAnimationFrame(raf)
    }
    requestAnimationFrame(raf)
  }, [inView, target, duration])

  const display = format ? format(value) : value
  return [ref, display]
}

/* ── Scroll-in wrapper ─────────────────────────────────────── */
function ScrollReveal({ children, delay = 0, direction = 'up', className = '' }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const dirs = { up: [0, 32], left: [-48, 0], right: [48, 0] }
  const [x, y] = dirs[direction] || dirs.up

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x, y }}
      animate={inView ? { opacity: 1, x: 0, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ── Data ──────────────────────────────────────────────────── */
const problems = [
  '❌ Bots see your bid instantly',
  '❌ Front-runners steal your gains',
  '❌ Winners forced to over-pay',
  '❌ Centralized, trust-required',
  '❌ No privacy guarantee',
]

const solutions = [
  '✅ Bids hidden until reveal phase',
  '✅ ZK proofs prevent all cheating',
  '✅ Fair winner selection by math',
  '✅ 100% on-chain, fully trustless',
  '✅ Cryptographic privacy guarantee',
]

const steps = [
  { icon: Wallet,    n: '01', title: 'Connect Wallet',    desc: 'Link your Phantom wallet in one click. Your identity stays private.' },
  { icon: LockKeyhole, n: '02', title: 'Seal Your Bid',  desc: 'Enter amount + auto-generated secret. Bid is hashed and locked on-chain.' },
  { icon: Clock,     n: '03', title: 'Timer Counts Down', desc: '60 seconds. All bids sealed. Bots see absolutely nothing.' },
  { icon: Key,       n: '04', title: 'Reveal Phase',      desc: 'Prove your bid with your secret key. ZK proof verified on-chain.' },
  { icon: Trophy,    n: '05', title: 'Winner Claims',     desc: 'Highest bid wins. Losers get automatic refunds. All math-guaranteed.' },
]

const stats = [
  { label: 'Stolen By Bots Annually', raw: '2', prefix: '$', suffix: 'B+' },
  { label: 'Front-Running Guarantee', raw: '0', prefix: '', suffix: 'ms' },
  { label: 'On-Chain Cryptographic',  raw: '100', prefix: '', suffix: '%' },
]

const demoAuctions = [
  { id: '1', name: 'PhantomToken', symbol: '$PHNTM', reserve: '100.00', time: '00:45', bids: '21', status: 'Live' },
  { id: '2', name: 'ZeroCoin',     symbol: '$ZERO',  reserve: '50.00',  time: '02:15', bids: '14', status: 'Live' },
  { id: '3', name: 'Eclipse',      symbol: '$ECL',   reserve: '500.00', time: '14:00', bids: '5',  status: 'Live' },
]

/* ── Landing ───────────────────────────────────────────────── */
export default function Landing() {
  // Scroll indicator fade
  const [showScroll, setShowScroll] = useState(true)
  useEffect(() => {
    const h = () => setShowScroll(window.scrollY < 60)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  return (
    <PageTransition className="w-full">

      {/* ═══════════════════════════════════════════════════════
          SECTION 1 — HERO
      ═══════════════════════════════════════════════════════ */}
      <section className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden px-6">
        {/* Canvas background */}
        <BlackHoleCanvas />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-4xl mx-auto">

          {/* Lock icon */}
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <div className="relative inline-flex items-center justify-center w-20 h-20">
              <div className="absolute inset-0 rounded-full bg-[rgba(124,58,237,0.15)] animate-pulse" />
              <LockKeyhole
                className="animate-spin-slow text-[var(--violet-400)]"
                style={{ width: 40, height: 40 }}
              />
            </div>
          </motion.div>

          {/* Logo word */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-2"
          >
            <span className="text-xs tracking-[0.3em] uppercase text-[var(--violet-400)] font-semibold">
              DARKBID PROTOCOL
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.2 }}
            className="text-display mb-6"
          >
            Bids So Secret,<br />
            <span className="bg-gradient-to-r from-[#7C3AED] via-[#A78BFA] to-[#06FFA5] bg-clip-text text-transparent">
              Even Bots Go Blind.
            </span>
          </motion.h1>

          {/* Subtext */}
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.35 }}
            className="text-lg md:text-xl text-[var(--text-secondary)] mb-10 max-w-2xl leading-relaxed"
          >
            Zero-knowledge sealed auctions on Solana.
            Fair launch, guaranteed by math — not promises.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 items-center"
          >
            <div className="relative z-10">
              <WalletButton />
            </div>
            <Link
              to={ROUTES.DASHBOARD}
              className="relative px-8 py-4 bg-[var(--violet-500)] text-white font-bold rounded-xl text-base overflow-hidden group
                shadow-[0_0_32px_rgba(124,58,237,0.3)] hover:shadow-[0_0_48px_rgba(124,58,237,0.55)]
                transition-all duration-300 hover:-translate-y-0.5"
            >
              <span className="relative z-10">🚀 Launch App</span>
              <span className="absolute inset-0 bg-gradient-to-r from-[#7C3AED] to-[#9C4FFF] opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
            <a
              href="#how-it-works"
              className="px-8 py-4 bg-transparent border border-[var(--border-default)] text-white font-medium rounded-xl
                hover:bg-[var(--bg-surface)] hover:border-[var(--violet-500)] transition-all duration-300 text-base"
            >
              How it works ↓
            </a>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ opacity: showScroll ? 1 : 0, y: showScroll ? 0 : 8 }}
          transition={{ duration: 0.4 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2"
        >
          <span className="text-xs text-[var(--text-muted)] tracking-widest uppercase">scroll</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            className="w-px h-10 bg-gradient-to-b from-[var(--violet-400)] to-transparent"
          />
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 2 — PROBLEM / SOLUTION
      ═══════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 max-w-6xl mx-auto">
        <ScrollReveal className="text-center mb-16">
          <span className="text-xs tracking-[0.25em] uppercase text-[var(--violet-400)] font-semibold mb-3 block">The Problem</span>
          <h2 className="text-h2">Why Traditional Auctions Are Broken</h2>
        </ScrollReveal>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Without DarkBid */}
          <ScrollReveal direction="left" delay={0.1}>
            <div className="h-full p-8 rounded-2xl border border-[rgba(255,59,92,0.25)] bg-[rgba(255,59,92,0.04)] flex flex-col gap-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🚨</span>
                <h3 className="text-lg font-bold text-[var(--error)]">Traditional Auctions</h3>
              </div>
              {problems.map((p, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 + 0.2 }}
                  className="flex items-center gap-3 py-2 border-b border-[rgba(255,59,92,0.1)] last:border-0"
                >
                  <span className="text-sm text-[var(--text-secondary)]">{p}</span>
                </motion.div>
              ))}
            </div>
          </ScrollReveal>

          {/* With DarkBid */}
          <ScrollReveal direction="right" delay={0.15}>
            <div className="h-full p-8 rounded-2xl border border-[rgba(6,255,165,0.25)] bg-[rgba(6,255,165,0.04)] flex flex-col gap-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🔐</span>
                <h3 className="text-lg font-bold text-[var(--success)]">DarkBid Protocol</h3>
              </div>
              {solutions.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 + 0.2 }}
                  className="flex items-center gap-3 py-2 border-b border-[rgba(6,255,165,0.1)] last:border-0"
                >
                  <span className="text-sm text-[var(--text-secondary)]">{s}</span>
                </motion.div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 3 — HOW IT WORKS
      ═══════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-24 px-6 bg-[var(--bg-surface)]">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal className="text-center mb-16">
            <span className="text-xs tracking-[0.25em] uppercase text-[var(--violet-400)] font-semibold mb-3 block">The Process</span>
            <h2 className="text-h2">How DarkBid Works</h2>
            <p className="text-[var(--text-secondary)] mt-3 max-w-xl mx-auto">
              Five steps from wallet to winner — every step cryptographically verified.
            </p>
          </ScrollReveal>

          {/* Steps grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 relative">
            {/* Connector line (desktop only) */}
            <div className="hidden lg:block absolute top-10 left-[10%] right-[10%] h-px">
              <motion.div
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, ease: 'easeInOut' }}
                className="h-full bg-gradient-to-r from-[var(--border-default)] via-[var(--violet-500)] to-[var(--border-default)]"
                style={{ transformOrigin: 'left' }}
              />
            </div>

            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 32, scale: 0.92 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5, ease: [0.22,1,0.36,1] }}
                className="relative flex flex-col items-center text-center p-6 rounded-2xl border border-[var(--border-subtle)]
                  bg-[var(--bg-elevated)] hover:border-[var(--violet-500)] hover:shadow-glow-v transition-all duration-300 group"
              >
                {/* Icon */}
                <div className="relative mb-4 w-16 h-16 flex items-center justify-center rounded-xl
                  bg-gradient-to-br from-[rgba(124,58,237,0.2)] to-[rgba(124,58,237,0.05)]
                  border border-[rgba(124,58,237,0.25)] group-hover:scale-110 transition-transform duration-300">
                  <step.icon className="w-7 h-7 text-[var(--violet-400)]" />
                </div>
                <span className="font-mono text-xs text-[var(--text-muted)] mb-1">{step.n}</span>
                <h3 className="text-base font-bold text-white mb-2">{step.title}</h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 4 — STATS BAR
      ═══════════════════════════════════════════════════════ */}
      <section className="py-20 px-6 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-6">
          {stats.map((s, i) => {
            const [ref, val] = useCountUp(s.raw)
            return (
              <ScrollReveal key={i} delay={i * 0.12}>
                <div
                  ref={ref}
                  className="p-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-center
                    hover:border-[var(--violet-500)] hover:shadow-glow-v transition-all duration-300"
                >
                  <div className="font-display text-5xl font-bold text-white mb-2">
                    {s.prefix}{val}{s.suffix}
                  </div>
                  <div className="text-sm text-[var(--text-muted)] uppercase tracking-wider">{s.label}</div>
                </div>
              </ScrollReveal>
            )
          })}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 5 — LIVE AUCTIONS PREVIEW
      ═══════════════════════════════════════════════════════ */}
      <section id="live" className="py-24 px-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-12">
          <ScrollReveal>
            <span className="text-xs tracking-[0.25em] uppercase text-[var(--violet-400)] font-semibold mb-2 block">Live Now</span>
            <h2 className="text-h2 mb-2">Active Auctions</h2>
            <p className="text-[var(--text-muted)]">Bid on the most anticipated tokens securely.</p>
          </ScrollReveal>
          <Link
            to={ROUTES.DASHBOARD}
            className="text-[var(--violet-400)] font-medium hover:text-[var(--violet-200)] transition-colors text-sm"
          >
            View All →
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {demoAuctions.map((a, i) => (
            <ScrollReveal key={a.id} delay={i * 0.1}>
              <AuctionCard {...a} isLive />
            </ScrollReveal>
          ))}
        </div>
      </section>

    </PageTransition>
  )
}
