import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import IDL from '../lib/darkbid.json'

// Dev 2 gives you this after deploying
// This is a placeholder - will be replaced with actual Program ID
const PROGRAM_ID = new PublicKey('DarkB1dXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')

export function useDarkBidProgram() {
  const { connection } = useConnection()
  const wallet = useWallet()

  if (!wallet.publicKey) return null

  const provider = new AnchorProvider(
    connection,
    wallet,
    { commitment: 'confirmed' }
  )

  try {
    return new Program(IDL, PROGRAM_ID, provider)
  } catch (err) {
    console.error('Failed to initialize program:', err)
    return null
  }
}
