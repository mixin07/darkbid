import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ExternalLink, Coins, RotateCcw, Receipt } from 'lucide-react'
import { ConfettiBurst } from '@/components/shared/ConfettiBurst'

function shortenWallet(wallet) {
  if (!wallet || wallet.length < 10) return 'N/A'
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
}

function formatSol(lamports) {
  if (lamports === null || lamports === undefined) return 'N/A'
  const sol = lamports / 1_000_000_000
  return sol.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function WinnerPanel({ result, viewerWallet }) {
  const confettiRef = useRef(null)
  const winner = result?.winner || null
  const isWinner = Boolean(
    winner && viewerWallet && winner.bidder_wallet === viewerWallet
  )

  useEffect(() => {
    if (isWinner) {
      const t = setTimeout(() => confettiRef.current?.fire(), 600)
      return () => clearTimeout(t)
    }
  }, [isWinner])

  const winnerWalletShort = winner ? shortenWallet(winner.bidder_wallet) : 'N/A'
  const winnerAmount = winner ? formatSol(winner.amount) : 'N/A'

  return (
    <>
      <ConfettiBurst ref={confettiRef} />

      <div className="flex flex-col gap-6 max-w-2xl mx-auto">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 240, damping: 18, delay: 0.1 }}
          className={`p-8 rounded-2xl border text-center flex flex-col items-center gap-4
            ${isWinner
              ? 'bg-[rgba(6,255,165,0.05)] border-[rgba(6,255,165,0.35)] shadow-[0_0_48px_rgba(6,255,165,0.12)]'
              : 'bg-[var(--bg-surface)] border-[var(--border-default)]'
            }`}
        >
          <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl
            ${isWinner
              ? 'bg-[rgba(6,255,165,0.12)] border-2 border-[rgba(6,255,165,0.4)]'
              : 'bg-[var(--bg-elevated)] border border-[var(--border-default)]'
            }`}
          >
            {isWinner ? 'WIN' : 'END'}
          </div>

          <div>
            <h2 className="text-2xl font-display font-bold text-white mb-1">
              {isWinner ? 'You Won the Auction' : 'Auction Complete'}
            </h2>
            <p className="text-[var(--text-secondary)]">
              {winner
                ? `Winning bid: ◎ ${winnerAmount} SOL`
                : 'Winner not finalized yet.'}
            </p>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)]">
            <span className="font-mono text-xs text-[var(--text-muted)]">Winner:</span>
            <span className="font-mono text-xs text-white">{winnerWalletShort}</span>
            {winner?.bidder_wallet && (
              <a href={`https://explorer.solana.com/address/${winner.bidder_wallet}?cluster=devnet`} target="_blank" rel="noreferrer">
                <ExternalLink className="w-3 h-3 text-[var(--text-muted)] hover:text-white transition-colors" />
              </a>
            )}
          </div>
        </motion.div>

        <div className="p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col gap-4">
          <h3 className="font-display font-bold text-white">Bid Summary</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Total Bids</div>
              <div className="text-lg font-mono text-white">{result?.total_bids ?? 0}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Revealed</div>
              <div className="text-lg font-mono text-white">{result?.revealed_bids ?? 0}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Valid</div>
              <div className="text-lg font-mono text-white">{result?.valid_bids ?? 0}</div>
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.4 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          {isWinner ? (
            <button className="sm:col-span-3 py-4 rounded-xl font-display font-bold text-base flex items-center justify-center gap-2
              bg-[var(--success)] text-[#001A0F] animate-glow-green hover:-translate-y-0.5 transition-all">
              <Coins className="w-5 h-5" /> Claim Tokens
            </button>
          ) : (
            <>
              <button className="py-3.5 rounded-xl font-semibold border-2 border-[var(--success)] text-[var(--success)]
                hover:bg-[rgba(6,255,165,0.08)] transition-all flex items-center justify-center gap-2 col-span-2">
                <RotateCcw className="w-4 h-4" /> Get Refund
              </button>
              <button className="py-3.5 rounded-xl font-semibold border border-[var(--border-default)] text-[var(--text-secondary)]
                hover:bg-[var(--bg-elevated)] hover:text-white transition-all flex items-center justify-center gap-2">
                <Receipt className="w-4 h-4" /> Receipt
              </button>
            </>
          )}
        </motion.div>
      </div>
    </>
  )
}
