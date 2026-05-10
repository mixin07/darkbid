import { useWallet } from '@solana/wallet-adapter-react'
import { useState, useEffect, useCallback } from 'react'
import { useWalletAuth } from '@/hooks/useWalletAuth.jsx'

function shortenAddress(address) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

export function WalletButton() {
  const { connected, publicKey, disconnect, connecting, select, wallets, connect, wallet } = useWallet()
  const { authenticated, login, logout, loading: authLoading } = useWalletAuth()
  const [showDropdown, setShowDropdown] = useState(false)
  const [connectError, setConnectError] = useState(null)

  // When a wallet is selected but not connected, auto-connect
  useEffect(() => {
    if (wallet && !connected && !connecting) {
      console.log('[WalletButton] Wallet selected, calling connect()...')
      connect().catch(err => {
        console.error('[WalletButton] Connect error:', err)
        setConnectError(err.message)
      })
    }
  }, [wallet, connected, connecting, connect])

  // Auto-trigger sign message when wallet connects but not yet authenticated
  useEffect(() => {
    if (connected && publicKey && !authenticated && !authLoading) {
      const timer = setTimeout(() => {
        console.log('[WalletButton] Wallet connected, triggering auth sign...')
        login().catch(err => {
          console.error('[WalletButton] Auto-auth failed:', err)
        })
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [connected, publicKey, authenticated, authLoading])

  const handleConnect = useCallback(() => {
    setConnectError(null)

    // Find Phantom in the registered wallets (Standard Wallet)
    const phantomWallet = wallets.find(w =>
      w.adapter.name.toLowerCase().includes('phantom')
    )

    if (phantomWallet) {
      console.log('[WalletButton] Found Phantom, selecting:', phantomWallet.adapter.name)
      select(phantomWallet.adapter.name)
      // The useEffect above will call connect() once the wallet state updates
    } else {
      // Phantom not installed — direct user to install
      console.log('[WalletButton] Phantom not found. Available wallets:', wallets.map(w => w.adapter.name))
      window.open('https://phantom.app/', '_blank')
    }
  }, [wallets, select])

  const handleDisconnect = useCallback(() => {
    disconnect()
    logout()
    setShowDropdown(false)
    console.log('[WalletButton] Disconnected wallet + cleared auth')
  }, [disconnect, logout])

  // LOADING STATE
  if (connecting) {
    return (
      <button className="wallet-btn wallet-btn--loading" disabled>
        Connecting...
      </button>
    )
  }

  // NOT CONNECTED
  if (!connected) {
    return (
      <div>
        <button
          className="wallet-btn wallet-btn--connect"
          onClick={handleConnect}
        >
          Connect Wallet
        </button>
        {connectError && (
          <p style={{ color: '#f87171', fontSize: '11px', marginTop: '4px', textAlign: 'center' }}>
            {connectError}
          </p>
        )}
      </div>
    )
  }

  // CONNECTED
  return (
    <div className="wallet-connected" style={{ position: 'relative' }}>
      <button
        className="wallet-btn wallet-btn--connected"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        <span className="wallet-dot" />
        {shortenAddress(publicKey.toString())}
        {!authenticated && (
          <span style={{ marginLeft: '6px', fontSize: '10px', opacity: 0.7 }}>⏳</span>
        )}
      </button>

      {showDropdown && (
        <div className="wallet-dropdown">
          <p className="wallet-full-address">
            {publicKey.toString()}
          </p>
          {!authenticated && (
            <button
              className="wallet-sign"
              onClick={() => { login(); setShowDropdown(false) }}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(124, 58, 237, 0.2)',
                border: '1px solid rgba(124, 58, 237, 0.4)',
                borderRadius: '8px',
                color: '#A78BFA',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                marginBottom: '8px',
                transition: 'all 0.2s'
              }}
            >
              ✍️ Sign Message to Authenticate
            </button>
          )}
          <button
            className="wallet-disconnect"
            onClick={handleDisconnect}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  )
}
