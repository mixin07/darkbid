import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PageTransition } from '@/components/shared/PageTransition'
import { AuctionCard } from '@/components/auction/AuctionCard'
import { Filter, Loader2 } from 'lucide-react'
import { getAuction, getAuctionResult, getToken, listAuctions } from '@/lib/api'
import { useWalletInfo } from '@/hooks/useWalletInfo'

const FILTERS = ['All', 'Live', 'Revealing', 'Ended']

const FILTER_COLORS = {
  Live:      'text-[#06FFA5]',
  Revealing: 'text-[#FFA500]',
  Ended:     'text-[#8B8FA8]',
  All:       'text-white',
}

const cardVariants = {
  hidden:  { opacity: 0, y: 24, scale: 0.96 },
  visible: (i) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.07, duration: 0.45, ease: [0.22,1,0.36,1] }
  }),
}

function formatSol(lamports) {
  if (lamports === null || lamports === undefined) return 'N/A'
  const sol = lamports / 1_000_000_000
  return sol.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatTimeLeft(secondsLeft) {
  if (!Number.isFinite(secondsLeft) || secondsLeft <= 0) return 'Ended'
  const hours = Math.floor(secondsLeft / 3600)
  const minutes = Math.floor((secondsLeft % 3600) / 60)
  const seconds = secondsLeft % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function deriveStatus(rawStatus, nowMs, commitEndMs, revealEndMs) {
  if (rawStatus === 'Ended' || (revealEndMs && nowMs >= revealEndMs)) return 'Ended'
  if (rawStatus === 'Reveal' || (commitEndMs && nowMs >= commitEndMs)) return 'Revealing'
  return 'Live'
}

function formatTokenPreview(token) {
  if (!token) return 'Missing'
  const head = token.slice(0, 8)
  const tail = token.slice(-6)
  return `${head}...${tail}`
}

export default function Dashboard() {
  const [filter, setFilter] = useState('All')
  const [auctions, setAuctions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { shortAddress, balance, connected } = useWalletInfo()
  const tokenPreview = formatTokenPreview(getToken())

  // Fetch auctions on mount
  useEffect(() => {
    const fetchAuctions = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await listAuctions()
        const summaries = Array.isArray(data) ? data : []
        const details = await Promise.all(
          summaries.map(a => getAuction(a.id).catch(() => null))
        )
        const results = await Promise.all(
          summaries.map(a => getAuctionResult(a.id).catch(() => null))
        )

        const nowMs = Date.now()
        const normalized = summaries.map((summary, idx) => {
          const detail = details[idx]
          const result = results[idx]
          const commitEndMs = summary.commit_end_at ? Date.parse(summary.commit_end_at) : null
          const revealEndMs = summary.reveal_end_at ? Date.parse(summary.reveal_end_at) : null
          const status = deriveStatus(summary.status, nowMs, commitEndMs, revealEndMs)
          const targetMs = status === 'Live' ? commitEndMs : status === 'Revealing' ? revealEndMs : null
          const secondsLeft = targetMs ? Math.max(0, Math.floor((targetMs - nowMs) / 1000)) : 0

          return {
            id: summary.id,
            name: detail?.title || summary.title || 'Untitled Auction',
            symbol: null,
            reserve: detail?.reserve_price ?? null,
            time: status === 'Ended' ? 'Ended' : formatTimeLeft(secondsLeft),
            bids: result?.total_bids ?? 0,
            status,
          }
        })

        console.log('[Dashboard] Fetched auctions:', normalized)
        setAuctions(normalized)
      } catch (err) {
        console.error('[Dashboard] Error fetching auctions:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    
    fetchAuctions()
  }, [])

  const filtered = filter === 'All' ? auctions : auctions.filter(a => a.status === filter)

  const counts = {
    All:       auctions.length,
    Live:      auctions.filter(a => a.status === 'Live').length,
    Revealing: auctions.filter(a => a.status === 'Revealing').length,
    Ended:     auctions.filter(a => a.status === 'Ended').length,
  }

  return (
    <PageTransition className="w-full max-w-7xl mx-auto px-6 py-12">

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-display mb-3">Auctions</h1>
        <p className="text-[var(--text-secondary)] text-lg max-w-xl">
          Browse all sealed-bid token launches. Bid, reveal, and claim — all cryptographically fair.
        </p>
      </div>

      {/* Session Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-2">Wallet</div>
          <div className="text-white font-mono">
            {connected && shortAddress ? shortAddress : 'Not connected'}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-2">
            Balance: {connected ? `${balance.toFixed(3)} SOL` : 'N/A'}
          </div>
        </div>
        <div className="p-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-2">Auth Token</div>
          <div className="text-white font-mono">{tokenPreview}</div>
          <div className="text-xs text-[var(--text-muted)] mt-2">Stored in localStorage</div>
        </div>
        <div className="p-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-2">Network</div>
          <div className="text-white font-mono">Devnet</div>
          <div className="text-xs text-[var(--text-muted)] mt-2">Wallet adapter connected</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-8 p-1 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] w-fit">
        <Filter className="w-4 h-4 text-[var(--text-muted)] ml-2 shrink-0" />
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`relative px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200
              ${filter === f
                ? 'bg-[var(--bg-elevated)] text-white shadow-card'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
          >
            <span className={filter === f && FILTER_COLORS[f] ? FILTER_COLORS[f] : ''}>
              {f === 'Live' ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#06FFA5] animate-pulse" />
                  Live
                </span>
              ) : f}
            </span>
            {/* Count pill */}
            <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-mono
              ${filter === f ? 'bg-[var(--violet-500)] text-white' : 'bg-[var(--bg-overlay)] text-[var(--text-muted)]'}`}>
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {/* Grid */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            key="loading"
            className="col-span-full py-24 text-center flex flex-col items-center justify-center"
          >
            <Loader2 className="w-8 h-8 text-violet-500 animate-spin mb-4" />
            <p className="text-text-muted">Loading auctions...</p>
          </motion.div>
        ) : error ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            key="error"
            className="col-span-full py-24 text-center"
          >
            <div className="p-6 rounded-lg bg-red-500/10 border border-red-500/30 max-w-md mx-auto">
              <h3 className="text-red-400 font-bold mb-2">Error Loading Auctions</h3>
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={filter}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filtered.length > 0 ? filtered.map((a, i) => (
              <motion.div
                key={a.id}
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
              >
                <AuctionCard
                  {...a}
                  reserve={a.reserve !== null ? formatSol(a.reserve) : 'N/A'}
                  isLive={a.status === 'Live'}
                />
              </motion.div>
            )) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="col-span-full py-24 text-center border border-dashed border-[var(--border-subtle)] rounded-2xl bg-[var(--bg-surface)]/30"
              >
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="text-xl font-bold text-white mb-2">No {filter.toLowerCase()} auctions</h3>
                <p className="text-[var(--text-muted)]">Check back soon or launch your own token.</p>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  )
}
