import { useDarkBidProgram } from './useDarkBidProgram'
import { useWallet } from '@solana/wallet-adapter-react'
import { useState } from 'react'

/**
 * Hook for revealing a sealed bid during reveal phase
 * 
 * Important: This is called AFTER bidding window closes
 * 
 * Workflow:
 * 1. Retrieve nonce from localStorage (saved by usePlaceBid)
 * 2. Send PLAIN bid amount + nonce to contract
 * 3. Contract re-hashes and verifies against stored commitment
 * 4. Contract updates winner selection with revealed amount
 * 5. Notify backend for audit trail
 * 
 * Note: NO ZK proof needed in reveal phase
 *       Proof was already verified during commit phase (Dev 3)
 */
export function useRevealBid() {
  const program = useDarkBidProgram()
  const { publicKey } = useWallet()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [txHash, setTxHash] = useState(null)

  async function revealBid(auctionId) {
    if (!program || !publicKey) return

    setLoading(true)
    setError(null)

    try {
      // ====================================================================
      // STEP 1: Retrieve saved bid data from localStorage
      // This was saved by usePlaceBid during commit phase
      // ====================================================================
      const saved = localStorage.getItem(`bid_nonce_${auctionId}`)
      if (!saved) {
        throw new Error('❌ No bid found to reveal. Did you commit a bid?')
      }

      const { amount, secret, commitHash, bidderKey } = JSON.parse(saved)

      // Safety check: same wallet must reveal
      if (bidderKey && bidderKey !== publicKey.toString()) {
        throw new Error('❌ Bid was placed with different wallet. Use original wallet.')
      }

      console.log('📂 Retrieved saved bid data:', { amount, commitHash });

      // ====================================================================
      // STEP 2: Send PLAIN bid + secret to contract (Dev 2)
      // The contract will:
      //   1. Re-compute hash(amount, secret)
      //   2. Verify it matches the stored commitHash
      //   3. Check amount >= reserve (double-check)
      //   4. Store for winner selection
      // 
      // Note: NO ZK proof sent here - proof was verified during commit!
      // ====================================================================
      const tx = await program.methods
        .revealBid(amount, secret)  // PLAIN values, no proof
        .accounts({
          auction: auctionId,
          bidder: publicKey,
          // Dev 2 fills in: systemProgram, rental, auction account, etc.
        })
        .rpc()

      console.log('📦 Bid revealed on-chain:', tx);

      // ====================================================================
      // STEP 3: Notify backend for audit trail (Dev 1)
      // Backend records: auctionId, bidder, actual amount, nonce, tx hash
      // This is the first time backend sees actual bid amount
      // ====================================================================
      try {
        const backendResponse = await fetch(`/api/bid/reveal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            auctionId,
            bidderPublicKey: publicKey.toString(),
            bidAmount: amount,
            bidNonce: secret,
            commitmentHash: commitHash,
            txHash: tx,
            timestamp: new Date().toISOString(),
          }),
        })

        if (!backendResponse.ok) {
          console.warn('⚠️ Backend reveal failed (non-blocking):', backendResponse.statusText)
          // Don't fail - contract tx is what matters
        } else {
          console.log('✅ Backend audit trail recorded');
        }
      } catch (backendErr) {
        console.warn('⚠️ Backend unreachable (non-blocking):', backendErr.message)
        // Continue - blockchain tx is authoritative
      }

      setTxHash(tx)
      console.log('🎉 Bid reveal complete!');
      return tx

    } catch (err) {
      console.error('❌ Error revealing bid:', err);
      setError(err.message || 'Failed to reveal bid')
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { revealBid, loading, error, txHash }
}
