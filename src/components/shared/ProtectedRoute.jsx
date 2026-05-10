import { useWalletAuth } from '@/hooks/useWalletAuth'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletButton } from '@/components/shared/WalletButton'

export function ProtectedRoute({ children }) {
  const { authenticated, login, loading, error } = useWalletAuth()
  const { connected } = useWallet()

  // Not connected — prompt to connect wallet (don't silently redirect)
  if (!connected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 mt-[-72px]">
        <div className="glass-panel p-8 rounded-2xl max-w-md w-full text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-[rgba(124,58,237,0.1)] border border-[rgba(124,58,237,0.3)] rounded-full flex items-center justify-center mb-6">
            <span className="text-2xl">🔗</span>
          </div>
          <h2 className="text-2xl font-bold mb-3 text-white">Connect Your Wallet</h2>
          <p className="text-[var(--text-secondary)] mb-8 leading-relaxed">
            Connect your Phantom wallet to access this page. No sign-up required.
          </p>
          <WalletButton />
        </div>
      </div>
    )
  }

  // Connected but not authenticated — prompt to sign message
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 mt-[-72px]">
        <div className="glass-panel p-8 rounded-2xl max-w-md w-full text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-[rgba(124,58,237,0.1)] border border-[rgba(124,58,237,0.3)] rounded-full flex items-center justify-center mb-6">
            <span className="text-2xl">✍️</span>
          </div>
          <h2 className="text-2xl font-bold mb-3 text-white">Signature Required</h2>
          <p className="text-[var(--text-secondary)] mb-8 leading-relaxed">
            Sign a message with your wallet to verify ownership and access this page. This doesn't cost any SOL.
          </p>
          
          {error && (
            <div className="w-full p-4 mb-6 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              ❌ {error}
            </div>
          )}

          <button 
            onClick={login}
            disabled={loading}
            className="w-full btn-primary-glow text-white font-medium py-3 rounded-xl disabled:opacity-50"
          >
            {loading ? 'Waiting for Signature...' : 'Sign Message to Continue'}
          </button>
        </div>
      </div>
    )
  }

  return children
}
