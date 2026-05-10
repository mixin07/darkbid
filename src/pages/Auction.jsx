import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Lock, Unlock } from 'lucide-react'

import { AUCTION_STATES } from '@/lib/constants'
import { CountdownTimer } from '@/components/auction/CountdownTimer'
import { BidForm } from '@/components/auction/BidForm'
import { RevealPanel } from '@/components/auction/RevealPanel'
import { WinnerPanel } from '@/components/auction/WinnerPanel'
import { getAuction, getAuctionResult } from '@/lib/api'
import { useWalletAuth } from '@/hooks/useWalletAuth.jsx'

export function Auction() {
  const { id } = useParams()
  const { walletAddress } = useWalletAuth()
  const [auction, setAuction] = useState(null)
  const [result, setResult] = useState(null)
  const [state, setState] = useState(AUCTION_STATES.BIDDING)
  const [timeLeft, setTimeLeft] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true

    const loadAuction = async () => {
      try {
        setLoading(true)
        setError(null)

        const [auctionData, resultData] = await Promise.all([
          getAuction(id),
          getAuctionResult(id).catch(() => null)
        ])

        if (!active) return
        setAuction(auctionData)
        setResult(resultData)
      } catch (err) {
        if (!active) return
        setError(err.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    if (id) loadAuction()
    return () => { active = false }
  }, [id])

  useEffect(() => {
    if (!auction) return

    const commitEndMs = auction.commit_end_at ? Date.parse(auction.commit_end_at) : null
    const revealEndMs = auction.reveal_end_at ? Date.parse(auction.reveal_end_at) : null
    const createdAtMs = auction.created_at ? Date.parse(auction.created_at) : null

    if (!commitEndMs || !revealEndMs) return

    const updateTime = () => {
      const now = Date.now()
      const phase = now < commitEndMs
        ? AUCTION_STATES.BIDDING
        : now < revealEndMs
          ? AUCTION_STATES.REVEAL
          : AUCTION_STATES.CLOSED

      setState(phase)

      const target = phase === AUCTION_STATES.BIDDING ? commitEndMs : revealEndMs
      const secondsLeft = Math.max(0, Math.floor((target - now) / 1000))
      setTimeLeft(secondsLeft)

      const total = phase === AUCTION_STATES.BIDDING && createdAtMs
        ? Math.max(1, Math.floor((commitEndMs - createdAtMs) / 1000))
        : Math.max(1, Math.floor((revealEndMs - commitEndMs) / 1000))

      setTotalDuration(total)
    }

    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [auction])

  const reserveSol = auction?.reserve_price != null
    ? auction.reserve_price / 1_000_000_000
    : null
  const reserveDisplay = reserveSol !== null
    ? `${reserveSol.toFixed(2)} SOL`
    : 'N/A'

  const bidHash = id ? localStorage.getItem(`bid_hash_${id}`) : ''
  const bidAmount = id ? localStorage.getItem(`bid_amount_${id}`) : ''
  const bidSecret = id ? localStorage.getItem(`bid_secret_${id}`) : ''
  const bidId = id ? localStorage.getItem(`bid_id_${id}`) : null

  if (loading) {
    return (
      <div className="pt-32 pb-24 px-6 text-center text-[var(--text-secondary)]">
        Loading auction...
      </div>
    )
  }

  if (error) {
    return (
      <div className="pt-32 pb-24 px-6 text-center text-red-400">
        {error}
      </div>
    )
  }

  if (!auction) {
    return (
      <div className="pt-32 pb-24 px-6 text-center text-[var(--text-secondary)]">
        Auction not found.
      </div>
    )
  }

  return (
    <div className="pt-32 pb-24 px-4 sm:px-6 md:px-8 max-w-[1200px] mx-auto relative z-10 w-full">
      <Link to="/dashboard" className="absolute top-24 left-8 text-[var(--text-muted)] hover:text-white flex items-center gap-2 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <AnimatePresence mode="wait">
        <motion.div
          key={state}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="flex flex-col w-full"
        >
          {/* Header Area based on state */}
          {state === AUCTION_STATES.BIDDING && (
            <div className="mb-12 flex flex-col items-center text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[var(--violet-400)]/40 bg-[var(--violet-500)]/10 mb-6 backdrop-blur-md shadow-[0_0_20px_rgba(124,58,237,0.2)]">
                <Lock className="w-4 h-4 text-[var(--violet-400)]" />
                <span className="font-mono text-xs text-[var(--violet-400)] tracking-[0.2em] uppercase font-bold text-shadow-sm">
                  Active Sealed Auction
                </span>
              </div>
              <h1 className="font-display text-[56px] text-white mb-3 tracking-tight drop-shadow-2xl">
                {auction.title}
              </h1>
              <p className="font-mono text-lg text-[var(--text-muted)] uppercase tracking-wider">
                Reserve Price: <span className="text-white font-medium text-glow">{reserveDisplay}</span>
              </p>
            </div>
          )}

          {state === AUCTION_STATES.REVEAL && (
            <div className="text-center mb-16 w-full max-w-3xl mx-auto flex flex-col items-center">
              <h1 className="text-[48px] font-display font-bold text-white flex items-center justify-center gap-4 mb-4 drop-shadow-2xl tracking-tighter">
                <Unlock className="w-12 h-12 text-[var(--violet-400)] glow-effect" strokeWidth={1.5} />
                REVEAL PHASE
              </h1>
              <p className="text-xl text-[var(--text-secondary)]">Time to show your hand!</p>
            </div>
          )}

          {state === AUCTION_STATES.CLOSED && (
            <div className="mb-12 flex flex-col items-center text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[var(--success)]/40 bg-[var(--success)]/10 mb-6">
                <span className="font-mono text-xs text-[var(--success)] tracking-[0.2em] uppercase font-bold">
                  Auction Concluded
                </span>
              </div>
              <h1 className="font-display text-[48px] text-white mb-3 tracking-tight drop-shadow-2xl">
                {auction.title}
              </h1>
            </div>
          )}

          {/* Grid Layout Container */}
          <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-8">
            
            {state === AUCTION_STATES.BIDDING && (
              <>
                <div className="md:col-span-5 h-full">
                  <CountdownTimer 
                    timeLeft={timeLeft} 
                    totalDuration={totalDuration} 
                    bids={result?.total_bids ?? 0} 
                  />
                </div>
                <div className="md:col-span-7 h-full">
                  <BidForm reserve={reserveSol ?? 0} auctionId={id} />
                </div>
              </>
            )}

            {state === AUCTION_STATES.REVEAL && (
              <RevealPanel
                auctionId={id}
                bidId={bidId}
                sealedHash={bidHash}
                initialAmount={bidAmount}
                initialSecret={bidSecret}
              />
            )}

            {state === AUCTION_STATES.CLOSED && (
              <div className="md:col-span-12 w-full max-w-4xl mx-auto">
                <WinnerPanel result={result} viewerWallet={walletAddress} />
              </div>
            )}
            
          </div>

        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export default Auction
