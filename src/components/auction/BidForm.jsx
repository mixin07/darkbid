import { useState, useEffect } from 'react'
import { WalletButton } from '@/components/shared/WalletButton'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletAuth } from '@/hooks/useWalletAuth.jsx'
import { commitBid } from '@/lib/api'
import { buildCommitHash } from '@/lib/commit'
import { Lock, RefreshCw, Copy, AlertTriangle } from 'lucide-react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'

// Auto-generate 64-char key
function generateKey() {
  const array = new Uint8Array(32)
  window.crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

export function BidForm({ reserve = 0, auctionId, onBid }) {
  const { connected } = useWallet()
  const { authenticated, userId } = useWalletAuth()
  const [amount, setAmount] = useState('1.25')
  const [secret, setSecret] = useState('')
  const [hash,   setHash]   = useState('')
  const [commitTxSig, setCommitTxSig] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // Initialization
  useEffect(() => { setSecret(generateKey()) }, [])
  
  // Realtime Hash
  useEffect(() => {
    if (!amount || !secret || !userId) {
      setHash('')
      return
    }

    const t = setTimeout(async () => {
      const amt = Number.parseFloat(amount)
      if (!Number.isFinite(amt)) {
        setHash('')
        return
      }

      const lamports = Math.round(amt * LAMPORTS_PER_SOL)
      const h = await buildCommitHash(lamports, secret, userId)
      setHash(h || '')
    }, 150)

    return () => clearTimeout(t)
  }, [amount, secret, userId])

  const copySecret = () => {
    navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!connected || !authenticated || !amount || Number(amount) < reserve || isSubmitting) return
    if (!hash || !commitTxSig) {
      setSubmitError('Commit hash and transaction signature are required')
      return
    }

    try {
      setIsSubmitting(true)
      setSubmitError(null)

      // Validate bid amount
      if (Number(amount) < reserve) {
        setSubmitError(`Bid must be at least ${reserve}`)
        return
      }

      // Save secret and amount to localStorage for later reveal
      localStorage.setItem(`bid_secret_${auctionId}`, secret)
      localStorage.setItem(`bid_amount_${auctionId}`, amount)

      // Call backend API to commit bid
      const response = await commitBid(auctionId, hash, commitTxSig)

      console.log('✅ Bid committed:', response)
      setSubmitSuccess(true)
      setAmount('')
      setSecret(generateKey())
      setCommitTxSig('')

      // Call parent callback
      const bidId = response?.bid_id || null
      if (bidId) {
        localStorage.setItem(`bid_id_${auctionId}`, bidId)
      }
      localStorage.setItem(`bid_hash_${auctionId}`, hash)

      onBid?.({ amount, secret, hash, bidId })

      // Clear success message after 3 seconds
      setTimeout(() => setSubmitSuccess(false), 3000)
    } catch (err) {
      console.error('❌ Bid error:', err)
      setSubmitError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!connected) {
    return (
      <div className="glass-panel rounded-2xl p-8 flex flex-col items-center justify-center relative shadow-[0_15px_40px_rgba(0,0,0,0.4)] border border-white/10 min-h-[400px]">
        <Lock className="w-12 h-12 text-[var(--violet-400)] mb-4" />
        <h3 className="font-display font-bold mb-2 text-white text-xl">Connect Your Wallet</h3>
        <p className="text-sm text-[var(--text-secondary)] mb-6">Connect Phantom to place a sealed bid</p>
        <WalletButton />
      </div>
    )
  }

  // Abbreviated string logic
  const displaySecret = secret ? `${secret.slice(0,7)}...${secret.slice(-6)}` : ''
  
  return (
    <div className="glass-panel rounded-2xl p-8 flex flex-col relative shadow-[0_15px_40px_rgba(0,0,0,0.4)] border border-white/10 w-full h-full">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[var(--violet-500)]/20 to-transparent rounded-tr-2xl opacity-50 pointer-events-none" />
      
      <h2 className="font-display text-2xl text-white mb-8 flex items-center gap-3">
        <span className="w-1.5 h-6 bg-[var(--violet-400)] rounded-full glow-effect" />
        Construct Sealed Bid
      </h2>

      <div className="space-y-8">
        
        {/* Bid Amount Input */}
        <div>
          <label className="block font-mono text-xs text-[var(--text-muted)] uppercase tracking-[0.2em] mb-3">Bid Amount (SOL)</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
              <span className="text-[var(--violet-400)] font-mono font-bold">◎</span>
            </div>
            <input 
              className="w-full bg-black/40 border border-white/10 rounded-xl py-5 pl-12 pr-4 text-white font-mono text-[24px] focus:outline-none focus:border-[var(--violet-400)] focus:ring-1 focus:ring-[var(--violet-400)] focus:bg-black/60 transition-all duration-300 backdrop-blur-md shadow-inner" 
              placeholder="0.00" 
              type="number"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>
        </div>

        {/* Secret Key Generation */}
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40 backdrop-blur-md p-1 group">
          <div className="absolute inset-0 data-stream-bg opacity-20 group-hover:opacity-40 transition-opacity pointer-events-none" />
          
          <div className="relative flex justify-between items-end mb-2 px-3 pt-2">
            <label className="block font-mono text-[10px] text-[var(--violet-400)] uppercase tracking-[0.2em]">Cryptographic Secret</label>
            <button 
              onClick={() => setSecret(generateKey())}
              className="text-[var(--text-muted)] hover:text-white font-mono text-[10px] flex items-center gap-1 transition-colors uppercase tracking-wider relative z-10"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Regenerate
            </button>
          </div>
          
          <div className="flex relative z-10 mx-2 mb-2 bg-black/50 border border-white/5 rounded-lg overflow-hidden group-hover:border-[var(--violet-400)]/30 transition-colors">
            <input 
              className="w-full bg-transparent border-none py-3 px-4 text-white/80 font-mono text-sm focus:ring-0 cursor-copy truncate tracking-wider outline-none" 
              readOnly 
              title={secret} 
              type="text" 
              value={displaySecret}
              onClick={copySecret}
            />
            <button 
              onClick={copySecret}
              className="px-4 border-l border-white/10 text-[var(--text-muted)] hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center cursor-pointer relative z-10"
            >
              {copied ? <span className="text-[10px] font-bold text-[var(--success)]">COPIED</span> : <Copy className="w-[18px] h-[18px]" />}
            </button>
          </div>
          <p className="px-3 pb-2 font-mono text-[10px] text-[var(--text-muted)] tracking-wider">Save this secret. Required to unseal winning bid.</p>
        </div>

        {/* Hash Preview */}
        <div className="p-5 bg-black/40 border border-white/10 rounded-xl relative overflow-hidden group">
          <div className="absolute inset-0 data-stream-bg opacity-10 group-hover:opacity-30 transition-opacity" style={{ animationDirection: 'reverse' }} />
          <div className="relative z-10">
            <label className="block font-mono text-[10px] text-[var(--violet-400)] uppercase tracking-[0.2em] mb-3">Resulting Hash Preview</label>
            <p className="font-mono text-xs text-[var(--text-secondary)] break-all leading-relaxed tracking-wider opacity-80 min-h-[36px]">
              {hash ? `0x${hash}` : 'Waiting for input...'}
            </p>
          </div>
        </div>

        {/* Commit Transaction Signature */}
        <div>
          <label className="block font-mono text-xs text-[var(--text-muted)] uppercase tracking-[0.2em] mb-3">Commit Tx Signature</label>
          <input
            className="w-full bg-black/40 border border-white/10 rounded-xl py-4 px-4 text-white font-mono text-sm focus:outline-none focus:border-[var(--violet-400)] focus:ring-1 focus:ring-[var(--violet-400)]"
            placeholder="Paste Solana transaction signature"
            value={commitTxSig}
            onChange={e => setCommitTxSig(e.target.value)}
          />
        </div>

        {/* Error Display */}
        {submitError && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-mono">
            ❌ {submitError}
          </div>
        )}

        {/* Success Display */}
        {submitSuccess && (
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-mono">
            ✅ Bid sealed! Secret saved locally. You can reveal during reveal phase.
          </div>
        )}

        {/* CTA */}
        <button 
          onClick={handleSubmit}
          disabled={isSubmitting || Number(amount) < reserve || !authenticated || !hash || !commitTxSig}
          className="w-full btn-primary-glow text-white font-display font-medium text-lg py-5 rounded-xl flex items-center justify-center gap-3 active:scale-[0.98] border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Lock className="w-[24px] h-[24px] group-hover:scale-110 transition-transform" />
          <span className="tracking-wide">{isSubmitting ? 'Sealing...' : 'Seal & Submit Bid'}</span>
        </button>

        {/* Warning */}
        <div className="flex items-start gap-3 text-outline bg-black/30 backdrop-blur-sm p-4 rounded-xl border border-white/5">
          <AlertTriangle className="w-[18px] h-[18px] text-[var(--warning)] shrink-0 mt-0.5 opacity-80" />
          <p className="font-mono text-[11px] leading-relaxed tracking-wide opacity-80 text-[var(--text-secondary)]">Losing bids automatically refunded upon auction conclusion. Ensure sufficient balance for network fees.</p>
        </div>

      </div>
    </div>
  )
}
