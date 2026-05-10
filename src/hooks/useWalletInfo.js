import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { useState, useEffect } from 'react'

export function useWalletInfo() {
  const { publicKey, connected } = useWallet()
  const { connection } = useConnection()
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // If no wallet connected, skip
    if (!publicKey || !connected) {
      setBalance(0)
      return
    }

    setLoading(true)

    // Fetch balance from Solana
    connection
      .getBalance(publicKey)
      .then(lamports => {
        // Solana uses "lamports" — 1 SOL = 1,000,000,000 lamports
        setBalance(lamports / LAMPORTS_PER_SOL)
      })
      .catch(err => console.error('Balance fetch failed:', err))
      .finally(() => setLoading(false))

  }, [publicKey, connected, connection])

  return {
    address: publicKey?.toString() ?? null,
    shortAddress: publicKey
      ? `${publicKey.toString().slice(0,4)}...${publicKey.toString().slice(-4)}`
      : null,
    balance,
    connected,
    loading
  }
}
