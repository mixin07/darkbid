import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ROUTES } from '@/lib/constants'
import { Button } from '@/components/ui/button'

const STATUS_COLORS = {
  Live:      { badge: 'bg-[rgba(6,255,165,0.12)] border-[rgba(6,255,165,0.3)] text-[#06FFA5]', dot: 'bg-[#06FFA5]', timer: '#06FFA5' },
  Revealing: { badge: 'bg-[rgba(255,165,0,0.12)] border-[rgba(255,165,0,0.3)] text-[#FFA500]', dot: 'bg-[#FFA500]', timer: '#FFA500' },
  Ended:     { badge: 'bg-[rgba(139,143,168,0.12)] border-[rgba(139,143,168,0.2)] text-[#8B8FA8]', dot: 'bg-[#8B8FA8]', timer: '#8B8FA8' },
  Upcoming:  { badge: 'bg-[rgba(167,139,250,0.12)] border-[rgba(167,139,250,0.3)] text-[#A78BFA]', dot: 'bg-[#A78BFA]', timer: '#A78BFA' },
}

function ProgressBar({ value, max, status }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const color = status === 'Live' ? '#06FFA5' : status === 'Revealing' ? '#FFA500' : '#4A5060'

  return (
    <div className="w-full h-1.5 rounded-full bg-[var(--bg-overlay)] overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
        style={{ height: '100%', background: color, borderRadius: 999 }}
      />
    </div>
  )
}

export function AuctionCard({ id, name, symbol, reserve, time, bids, status = 'Live', isLive }) {
  const resolvedStatus = isLive ? 'Live' : status
  const colors = STATUS_COLORS[resolvedStatus] || STATUS_COLORS.Ended
  const maxBids = 30
  const displaySymbol = symbol || 'N/A'
  const displayReserve = reserve || 'N/A'
  const displayTime = time || 'N/A'

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="relative flex flex-col gap-5 p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]
        hover:border-[var(--violet-500)] hover:shadow-[0_8px_32px_rgba(124,58,237,0.2)]
        transition-colors duration-300 group cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="font-display text-base font-bold text-white leading-tight block">{name}</span>
          <span className="font-mono text-xs text-[var(--text-muted)] mt-0.5 block">{displaySymbol}</span>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold tracking-wider shrink-0 animate-pulse-badge ${colors.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
          {resolvedStatus.toUpperCase()}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold block mb-1">Reserve</span>
          <span className="font-mono text-sm text-white">◎ {displayReserve}</span>
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold block mb-1">Time Left</span>
          <span className="font-mono text-sm font-bold" style={{ color: colors.timer }}>
            {displayTime === 'Ended' ? 'Closed' : displayTime}
          </span>
        </div>
      </div>

      {/* Progress bar + bids */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">Sealed Bids</span>
          <span className="font-mono text-xs text-[var(--text-secondary)]">{bids}/{maxBids}</span>
        </div>
        <ProgressBar value={parseInt(bids) || 0} max={maxBids} status={resolvedStatus} />
      </div>

      {/* CTA */}
      <Link to={ROUTES.AUCTION.replace(':id', id)} className="block">
        <Button
          className="w-full font-semibold rounded-xl border-none transition-all duration-300
            bg-gradient-to-r from-[var(--violet-600)] to-[var(--violet-500)]
            hover:from-[var(--violet-500)] hover:to-[#9C4FFF]
            group-hover:shadow-[0_0_24px_rgba(124,58,237,0.4)]
            text-white"
        >
          {resolvedStatus === 'Ended' ? 'View Results' : resolvedStatus === 'Revealing' ? 'Reveal Bid →' : 'View Auction →'}
        </Button>
      </Link>
    </motion.div>
  )
}
