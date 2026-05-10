/**
 * Phantom Wallet Authentication Hook
 * File: src/hooks/usePhantomAuth.jsx
 * 
 * Handles complete Phantom wallet-based authentication flow
 */

import { useState, useEffect, useCallback } from 'react'
import { tokenManager } from '@/lib/tokenManager'

const API_BASE = 'http://localhost:8080'

export function usePhantomAuth() {
  const [wallet, setWallet] = useState(null)
  const [publicKey, setPublicKey] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  /**
   * Step 1: Check if Phantom is installed
   */
  const isPhantomInstalled = useCallback(() => {
    return window.solana && window.solana.isPhantom
  }, [])

  /**
   * Step 2: Connect to Phantom wallet
   */
  const connectWallet = useCallback(async () => {
    try {
      setConnecting(true)
      setError(null)

      if (!isPhantomInstalled()) {
        setError('Phantom wallet not installed. Please install it from phantom.app')
        console.error('[Phantom] Wallet not installed')
        return false
      }

      const solanaWallet = window.solana
      console.log('[Phantom] Connecting to wallet...')

      // Request connection
      const response = await solanaWallet.connect()
      const pubKey = response.publicKey.toBase58()

      setWallet(solanaWallet)
      setPublicKey(pubKey)
      console.log('[Phantom] ✅ Connected:', pubKey)

      return true
    } catch (err) {
      const message = err.message || 'Failed to connect wallet'
      setError(message)
      console.error('[Phantom] Connection error:', err)
      return false
    } finally {
      setConnecting(false)
    }
  }, [isPhantomInstalled])

  /**
   * Step 3: Authenticate with backend
   * Requests nonce → Signs message → Sends to backend → Gets JWT token
   */
  const authenticateWithBackend = useCallback(async () => {
    try {
      if (!publicKey || !wallet) {
        setError('Wallet not connected')
        return false
      }

      console.log('[Auth] Starting authentication...')

      // Step 3a: Get nonce from backend
      console.log('[Auth] Requesting nonce...')
      const nonceResponse = await fetch(`${API_BASE}/auth/nonce`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!nonceResponse.ok) {
        throw new Error(`Failed to get nonce: ${nonceResponse.status}`)
      }

      const nonceData = await nonceResponse.json()
      const nonce = nonceData.nonce

      if (tokenManager.isNonceUsed(nonce)) {
        throw new Error('Nonce already used (possible replay attack)')
      }

      console.log('[Auth] ✅ Nonce received:', nonce.slice(0, 20) + '...')

      // Step 3b: Sign message with wallet
      console.log('[Auth] Signing message...')
      const message = new TextEncoder().encode(`DarkBid Nonce: ${nonce}`)
      const signedMessage = await wallet.signMessage(message)

      console.log('[Auth] ✅ Message signed')

      // Step 3c: Send to backend
      console.log('[Auth] Authenticating with backend...')
      const authResponse = await fetch(`${API_BASE}/auth/wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: publicKey,
          signature: Array.from(signedMessage.signature),
          nonce: nonce
        })
      })

      if (!authResponse.ok) {
        const errorData = await authResponse.json()
        throw new Error(errorData.message || `Auth failed: ${authResponse.status}`)
      }

      const authData = await authResponse.json()
      const token = authData.token

      if (!token) {
        throw new Error('No token received from backend')
      }

      // Step 3d: Store token
      console.log('[Auth] ✅ Token received')
      const expiresIn = authData.expires_in || 86400
      tokenManager.saveToken(token, publicKey, expiresIn)
      tokenManager.markNonceAsUsed(nonce)

      console.log('[Auth] ✅ Authentication successful')
      setAuthenticated(true)
      setError(null)

      return true
    } catch (err) {
      const message = err.message || 'Authentication failed'
      setError(message)
      console.error('[Auth] Authentication error:', err)
      setAuthenticated(false)
      return false
    }
  }, [publicKey, wallet])

  /**
   * Complete connection flow
   * Connects wallet AND authenticates
   */
  const connect = useCallback(async () => {
    try {
      const connected = await connectWallet()
      if (!connected) return false

      const authenticated = await authenticateWithBackend()
      return authenticated
    } catch (err) {
      console.error('[Phantom] Connection flow error:', err)
      setError(err.message)
      return false
    }
  }, [connectWallet, authenticateWithBackend])

  /**
   * Disconnect wallet and clear token
   */
  const disconnect = useCallback(async () => {
    try {
      setDisconnecting(true)

      if (wallet) {
        await wallet.disconnect()
        console.log('[Phantom] Disconnected from wallet')
      }

      tokenManager.clearToken()
      setWallet(null)
      setPublicKey(null)
      setAuthenticated(false)
      setError(null)

      console.log('[Auth] ✅ Disconnected')
      return true
    } catch (err) {
      console.error('[Phantom] Disconnect error:', err)
      setError(err.message)
      return false
    } finally {
      setDisconnecting(false)
    }
  }, [wallet])

  /**
   * Initialize on mount
   * Check for existing token and Phantom
   */
  useEffect(() => {
    const init = async () => {
      try {
        // Check if already authenticated
        const token = tokenManager.getToken()
        const storedWallet = tokenManager.getWallet()

        if (token && storedWallet) {
          setPublicKey(storedWallet)
          setAuthenticated(true)
          console.log('[Auth] Restored session for:', storedWallet.slice(0, 8) + '...')
        }

        // Check if Phantom is available
        if (isPhantomInstalled()) {
          console.log('[Phantom] ✅ Phantom wallet detected')
        } else {
          console.warn('[Phantom] ⚠️ Phantom wallet not installed')
        }

        setLoading(false)
      } catch (err) {
        console.error('[Auth] Initialization error:', err)
        setLoading(false)
      }
    }

    init()
  }, [isPhantomInstalled])

  /**
   * Auto-refresh token if expiring soon
   */
  useEffect(() => {
    if (!authenticated) return

    const checkExpiry = setInterval(() => {
      if (tokenManager.isExpiringSoon()) {
        console.log('[Auth] ⚠️ Token expiring soon, would refresh here')
        // TODO: Implement token refresh
      }
    }, 60000) // Check every minute

    return () => clearInterval(checkExpiry)
  }, [authenticated])

  return {
    // State
    wallet,
    publicKey,
    authenticated,
    connecting,
    disconnecting,
    loading,
    error,
    isPhantomInstalled: isPhantomInstalled(),

    // Actions
    connect,
    disconnect,
    connectWallet,
    authenticateWithBackend,

    // Helpers
    walletAddress: publicKey ? publicKey.slice(0, 8) + '...' + publicKey.slice(-8) : null,
    isReady: !loading && isPhantomInstalled()
  }
}
