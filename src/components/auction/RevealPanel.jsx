import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Lock, Zap, ArrowRight, PackageOpen } from 'lucide-react'
import { revealBid } from '@/lib/api'
import { buildCommitHash } from '@/lib/commit'
import { useWalletAuth } from '@/hooks/useWalletAuth.jsx'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'

export function RevealPanel({
  onReveal,
  auctionId,
  bidId,
  sealedHash = '',
  initialAmount = '',
  initialSecret = ''
}) {
  const { userId } = useWalletAuth()
  const [amount, setAmount] = useState(initialAmount)
  const [secret, setSecret] = useState(initialSecret)
  const [revealTxSig, setRevealTxSig] = useState('')
  const [matchStatus, setMatchStatus] = useState(null) // null | 'match' | 'no-match'
  const [zkPhase, setZkPhase] = useState('idle')
  const [zkProgress, setZkProgress] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const sealedHashDisplay = sealedHash
    ? (sealedHash.startsWith('0x') ? sealedHash : `0x${sealedHash}`)
    : 'No sealed hash found'

  useEffect(() => {
    let cancelled = false

    const checkMatch = async () => {
      if (!amount || !secret || !sealedHash || !userId) {
        setMatchStatus(null)
        return
      }

      const amt = Number.parseFloat(amount)
      if (!Number.isFinite(amt)) {
        setMatchStatus('no-match')
        return
      }

      const lamports = Math.round(amt * LAMPORTS_PER_SOL)
      const computed = await buildCommitHash(lamports, secret, userId)
      if (cancelled) return

      const expected = sealedHash.startsWith('0x') ? sealedHash.slice(2) : sealedHash
      setMatchStatus(computed && expected ? (computed === expected ? 'match' : 'no-match') : 'no-match')
    }

    checkMatch()
    return () => { cancelled = true }
  }, [amount, secret, sealedHash, userId])

  const handleReveal = async () => {
    setSubmitError(null)
    setSubmitSuccess(false)

    if (!auctionId || !bidId) {
      setSubmitError('Missing auction or bid reference')
      return
    }
    if (!revealTxSig) {
      setSubmitError('Reveal transaction signature is required')
      return
    }
    if (matchStatus !== 'match') {
      setSubmitError('Commit hash does not match the sealed bid')
      return
    }

    try {
      setIsSubmitting(true)
      setZkPhase('generating')
      setZkProgress(25)

      const amt = Number.parseFloat(amount)
      const lamports = Math.round(amt * LAMPORTS_PER_SOL)

      await revealBid({
        bidId,
        auctionId,
        amount: lamports,
        nonce: secret,
        revealTxSig
      })

      setZkProgress(100)
      setZkPhase('done')
      setSubmitSuccess(true)
      setTimeout(() => onReveal?.(), 500)
    } catch (err) {
      setSubmitError(err.message)
      setZkPhase('idle')
      setZkProgress(0)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {/* Left Column: Current State & ZK Proof */}
      <div className="md:col-span-5 flex flex-col gap-8">
        {/* Current State Card */}
        <div className="glass-panel p-8 rounded-[24px] relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-40 h-40 bg-[var(--violet-500)] opacity-[0.05] rounded-full blur-3xl -mr-10 -mt-10" />
          <h2 className="text-xl font-display text-white mb-6 flex items-center gap-3">
            <PackageOpen className="w-5 h-5 text-[var(--violet-400)]" />
            Your Sealed Bid
          </h2>
          <div className="space-y-6">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider">Hash</span>
              <div className="bg-black/40 border border-white/5 rounded-lg p-3 font-mono text-[var(--violet-400)] truncate shadow-inner">
                {sealedHashDisplay}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider">Status</span>
              <div className="inline-flex items-center gap-3 px-4 py-2 rounded-lg bg-[var(--warning)]/5 border border-[var(--warning)]/20 w-fit">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--warning)] animate-pulse" style={{ boxShadow: '0 0 10px rgba(255,165,0,0.8)' }} />
                <span className="font-mono text-xs text-[var(--warning)] uppercase tracking-wider">
                  {zkPhase === 'generating' ? 'Submitting Reveal...' : zkPhase === 'done' ? 'Reveal Submitted' : 'Awaiting Reveal'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ZK Proof Generation (Simulated Active State) */}
        <div className="glass-panel p-8 rounded-[24px] flex flex-col items-center justify-center py-12 text-center relative overflow-hidden h-full min-h-[280px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(124,58,237,0.1)_0%,_transparent_60%)] pointer-events-none" />
          
          <div className="relative w-32 h-32 mb-8 flex items-center justify-center">
            <div className="absolute w-full h-full rounded-full zk-geo-1" />
            <div className="absolute w-[80%] h-[80%] rounded-sm zk-geo-2" />
            <div className="absolute w-[60%] h-[60%] rounded-full zk-geo-3" />
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="w-12 h-12 bg-[var(--violet-900)]/50 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(124,58,237,0.5)] border border-[var(--violet-500)]/40">
                <Zap className="w-6 h-6 text-[var(--violet-400)]" />
              </div>
            </div>
          </div>
          
          <p className="text-lg font-mono text-[var(--violet-400)] mb-6 tracking-wide">
            {zkPhase === 'idle' ? 'Awaiting cryptographic reveal.' : zkPhase === 'generating' ? 'Generating proof...' : 'Proof Verification Ready'}
          </p>
          
          {/* Progress Bar */}
          <div className="w-full max-w-[240px] h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
            <div 
              className="h-full bg-gradient-to-r from-[var(--violet-600)] to-[var(--violet-400)] rounded-full relative shadow-[0_0_10px_rgba(124,58,237,0.5)]"
              style={{ width: `${Math.max(zkProgress, 5)}%`, transition: 'width 0.1s linear' }}
            >
              <div className="absolute top-0 right-0 bottom-0 left-0 bg-gradient-to-r from-transparent via-white/40 to-transparent translate-x-[-100%] animate-[shimmer_1.5s_infinite]" />
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Reveal Form */}
      <div className="md:col-span-7 h-full">
        <div className="glass-panel p-8 md:p-10 rounded-[32px] h-full flex flex-col relative overflow-hidden">
          <div className="absolute top-[-50%] right-[-50%] w-full h-full bg-[radial-gradient(circle_at_center,_rgba(124,58,237,0.05)_0%,_transparent_70%)] pointer-events-none" />
          
          <h2 className="text-2xl font-display text-white mb-8 border-b border-white/10 pb-6 relative z-10 tracking-tight">
            Reveal Details
          </h2>
          
          <div className="flex-grow flex flex-col justify-center space-y-8 relative z-10">
            {/* Original Bid Input */}
            <div className="flex flex-col gap-3">
              <label className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-widest pl-1">Original Bid Amount (SOL)</label>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-mono font-bold transition-colors group-focus-within:text-[var(--violet-400)]">◎</span>
                <input 
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-12 pr-4 font-mono text-white focus:border-[var(--violet-500)] focus:ring-1 focus:ring-[var(--violet-500)] transition-all shadow-inner outline-none disabled:opacity-50" 
                  placeholder="0.00" 
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  disabled={zkPhase !== 'idle'}
                />
              </div>
            </div>

            {/* Secret Key Input */}
            <div className="flex flex-col gap-3">
              <label className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-widest pl-1">Secret Key</label>
              <div className="relative group">
                <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] transition-colors group-focus-within:text-[var(--violet-400)]" />
                <input 
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-12 pr-4 font-mono text-white focus:border-[var(--violet-500)] focus:ring-1 focus:ring-[var(--violet-500)] transition-all shadow-inner outline-none disabled:opacity-50" 
                  placeholder="Enter your secret key" 
                  type="password" 
                  value={secret}
                  onChange={e => setSecret(e.target.value)}
                  disabled={zkPhase !== 'idle'}
                />
              </div>
            </div>

            {/* Reveal Tx Signature */}
            <div className="flex flex-col gap-3">
              <label className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-widest pl-1">Reveal Tx Signature</label>
              <input
                className="w-full bg-black/40 border border-white/10 rounded-xl py-4 px-4 font-mono text-white focus:border-[var(--violet-500)] focus:ring-1 focus:ring-[var(--violet-500)] transition-all shadow-inner outline-none disabled:opacity-50"
                placeholder="Paste Solana transaction signature"
                value={revealTxSig}
                onChange={e => setRevealTxSig(e.target.value)}
                disabled={zkPhase !== 'idle'}
              />
            </div>

            {/* Verification Message */}
            <AnimatePresence mode="wait">
              {matchStatus === 'match' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="bg-[#10b981]/10 border border-[#10b981]/20 rounded-xl p-4 flex items-center gap-4 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                >
                  <CheckCircle2 className="text-[#10b981] w-5 h-5" />
                  <span className="text-base font-medium text-[#10b981] tracking-wide">Matches! Ready to reveal</span>
                </motion.div>
              )}
            </AnimatePresence>

            {matchStatus === 'no-match' && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">
                Commit hash does not match the sealed bid. Check the amount and secret.
              </div>
            )}

            {submitError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">
                {submitError}
              </div>
            )}

            {submitSuccess && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-sm text-green-400">
                Reveal submitted successfully.
              </div>
            )}
          </div>

          {/* CTA Action */}
          <div className="mt-10 pt-8 border-t border-white/10 flex justify-end relative z-10">
            <button 
              onClick={handleReveal}
              disabled={matchStatus !== 'match' || zkPhase !== 'idle' || isSubmitting}
              className="btn-primary-glow text-white px-10 py-4 rounded-xl font-mono text-base uppercase tracking-widest flex items-center gap-3 w-full md:w-auto justify-center transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Reveal My Bid'}
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
