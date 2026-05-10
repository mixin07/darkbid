import { useState, useContext, createContext, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import bs58 from 'bs58'
import { getToken, setToken, clearToken, walletAuth, getAuthNonce } from '../lib/api'

export const WalletAuthContext = createContext(null)

export function useWalletAuth() {
  const context = useContext(WalletAuthContext)
  if (!context) {
    throw new Error('useWalletAuth must be used within WalletAuthProvider')
  }
  return context
}

export function WalletAuthProvider({ children }) {
  const { connected, publicKey, signMessage } = useWallet()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Restore session if token exists and wallet is connected
  useEffect(() => {
    const token = getToken()
    const claims = token ? decodeJwt(token) : null
    if (token && publicKey && connected) {
      setUser({
        walletAddress: claims?.wallet || publicKey.toString(),
        userId: claims?.sub || null,
        authenticated: true
      })
      console.log('[WalletAuth] Session restored for:', publicKey.toString().slice(0, 8) + '...')
    }
  }, [publicKey, connected])

  // Clear auth when wallet disconnects
  useEffect(() => {
    if (!connected && user) {
      console.log('[WalletAuth] Wallet disconnected, clearing auth')
      setUser(null)
      clearToken()
    }
  }, [connected, user])

  const login = async () => {
    if (!connected || !publicKey || !signMessage) {
      const msg = 'Wallet not connected or signMessage not available'
      setError(msg)
      console.error('[WalletAuth]', msg)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Get nonce from backend
      const nonceResponse = await getAuthNonce(publicKey.toString())
      const nonce = nonceResponse.nonce
      console.log('[WalletAuth] Nonce received:', nonce?.slice(0, 20) + '...')

      // Create message to sign
      const message = new TextEncoder().encode(
        `Sign this message to authenticate with DarkBid\nNonce: ${nonce}`
      )

      // Sign with Phantom wallet
      const signature = await signMessage(message)
      console.log('[WalletAuth] Message signed successfully')

      // Convert signature to Base58 for backend verification
      const signatureB58 = bs58.encode(signature)

      // Send signature to backend for verification
      const response = await walletAuth(publicKey.toString(), signatureB58, nonce)

      if (response.token) {
        setToken(response.token)
        setUser({
          walletAddress: publicKey.toString(),
          userId: response.user_id || decodeJwt(response.token)?.sub || null,
          authenticated: true
        })
        console.log('[WalletAuth] Authenticated successfully')
        return response
      }

      throw new Error('No token received from backend')
    } catch (err) {
      console.error('[WalletAuth] Error:', err)
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    clearToken()
    setError(null)
    console.log('[WalletAuth] Logged out')
  }

  const value = {
    user,
    loading,
    error,
    authenticated: !!user,
    walletAddress: user?.walletAddress,
    userId: user?.userId || null,
    login,
    logout
  }

  return (
    <WalletAuthContext.Provider value={value}>
      {children}
    </WalletAuthContext.Provider>
  )
}

function decodeJwt(token) {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const pad = '='.repeat((4 - (normalized.length % 4)) % 4)
    const json = atob(normalized + pad)
    return JSON.parse(json)
  } catch {
    return null
  }
}
