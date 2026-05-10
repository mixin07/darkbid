import { useDarkBidProgram } from './useDarkBidProgram'
import { useWallet } from '@solana/wallet-adapter-react'
import { useState } from 'react'
import { 
  generateBidProof, 
  computeBidHash, 
  formatProofForContract 
} from '../lib/proof-generator'

/**
 * Hook for placing a sealed bid in DarkBid auction
 * 
 * Workflow:
 * 1. Generate ZK proof proving: bidAmount >= reserve && hash(bid+secret) == commitHash
 * 2. Submit proof to Solana contract (Dev 2's commitBid instruction)
 * 3. Notify backend (Dev 1) for audit/tracking
 * 4. Save nonce locally for reveal phase
 */
export function usePlaceBid() {
  const program = useDarkBidProgram()
  const { publicKey } = useWallet()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [txHash, setTxHash] = useState(null)
  const [proofLoadingPercent, setProofLoadingPercent] = useState(0)

  async function placeBid(auctionId, bidAmount, reservePrice) {
    if (!program || !publicKey) return

    setLoading(true)
    setError(null)
    setProofLoadingPercent(0)

    try {
      // ====================================================================
      // STEP 1: Generate random nonce/secret for bid
      // ====================================================================
      setProofLoadingPercent(10)
      const bidSecret = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
      console.log('🎲 Generated bid secret');

      // ====================================================================
      // STEP 2: Compute commitment hash: hash(bid + secret)
      // This will be stored on-chain during commit phase
      // ====================================================================
      setProofLoadingPercent(20)
      const commitHash = await computeBidHash(bidAmount, bidSecret)
      console.log('📋 Computed bid commitment hash:', commitHash);

      // ====================================================================
      // STEP 3: Generate zero-knowledge proof (Dev 3)
      // PROVES:
      //   - bidAmount >= reservePrice
      //   - hash(bidAmount + bidSecret) == commitHash
      // 
      // This proof verifies commitment validity without revealing the bid
      // ====================================================================
      setProofLoadingPercent(40)
      const { proof, publicSignals } = await generateBidProof(
        bidAmount,
        bidSecret,
        reservePrice,
        commitHash
      )
      setProofLoadingPercent(80)
      console.log('✅ ZK proof generated successfully');

      // ====================================================================
      // STEP 4: Format proof for Solana smart contract
      // Converts Groth16 proof to format expected by Dev 2's contract
      // ====================================================================
      const formattedProof = formatProofForContract(proof, publicSignals)
      setProofLoadingPercent(85)

      // ====================================================================
      // STEP 5: Save nonce locally for reveal phase (critical!)
      // User MUST have this to reveal their bid later
      // ====================================================================
      localStorage.setItem(
        `bid_nonce_${auctionId}`,
        JSON.stringify({ 
          amount: bidAmount, 
          secret: bidSecret,
          commitHash,
          timestamp: Date.now(),
          bidderKey: publicKey.toString(), // Verify same wallet later
        })
      )
      console.log('💾 Bid data saved for reveal phase');

      // ====================================================================
      // STEP 6: Submit to Solana smart contract (Dev 2)
      // Calls: commitBid() instruction
      // Arguments:
      //   - commitHash: Hash of bid (public to contract)
      //   - proof: Groth16 proof of bid validity (verified on-chain)
      //   - publicSignals: [reservePrice, commitHash] for proof verification
      // ====================================================================
      setProofLoadingPercent(90)
      const tx = await program.methods
        .commitBid(
          Array.from(commitHash),  // Convert hash to array for contract
          formattedProof.proofArray,
          formattedProof.publicSignals
        )
        .accounts({
          auction: auctionId,
          bidder: publicKey,
          // Dev 2 fills in: systemProgram, rent, escrowAccount, etc.
        })
        .rpc()

      console.log('📦 Bid committed on-chain:', tx);

      // ====================================================================
      // STEP 7: Notify backend for audit trail (Dev 1)
      // Backend stores: auctionId, bidder, commitment, tx hash
      // Backend does NOT store actual bid amount (stays secret until reveal)
      // ====================================================================
      try {
        const backendResponse = await fetch(`/api/bid/commit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            auctionId,
            bidderPublicKey: publicKey.toString(),
            commitmentHash: commitHash,
            txHash: tx,
            timestamp: new Date().toISOString(),
          }),
        })

        if (!backendResponse.ok) {
          console.warn('⚠️ Backend commit failed (non-blocking):', backendResponse.statusText)
          // Don't fail - contract tx is what matters
        } else {
          console.log('✅ Backend audit trail recorded');
        }
      } catch (backendErr) {
        console.warn('⚠️ Backend unreachable (non-blocking):', backendErr.message)
        // Continue - blockchain tx is authoritative
      }

      setProofLoadingPercent(100)
      setTxHash(tx)
      console.log('🎉 Bid placement complete! Proof verified on-chain.');
      return tx

    } catch (err) {
      console.error('❌ Error placing bid:', err);
      setError(err.message || 'Failed to place bid')
      throw err
    } finally {
      setLoading(false)
      setProofLoadingPercent(0)
    }
  }

  return { 
    placeBid, 
    loading, 
    error, 
    txHash, 
    proofLoadingPercent 
  }
}
