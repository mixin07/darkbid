/**
 * TokenManager - Efficient JWT Token Lifecycle Management
 * Handles storage, validation, expiration, and auto-refresh
 * File: src/lib/tokenManager.js
 */

export class TokenManager {
  constructor() {
    this.TOKEN_KEY = 'darkbid_token';
    this.WALLET_KEY = 'darkbid_wallet';
    this.EXP_KEY = 'darkbid_token_exp';
    this.NONCE_KEY = 'darkbid_nonce';
    this.REFRESH_THRESHOLD = 3600; // Refresh if < 1 hour left (in seconds)
    
    console.log('[TokenManager] Initialized');
  }

  /**
   * Save token with wallet info
   * @param {string} token - JWT token
   * @param {string} wallet - Wallet public key
   * @param {number} expiresIn - Expiration time in seconds (default: 24 hours)
   */
  saveToken(token, wallet, expiresIn = 86400) {
    if (!token) {
      console.error('[TokenManager] Cannot save empty token');
      return false;
    }

    const expiresAt = Date.now() + (expiresIn * 1000);
    
    try {
      localStorage.setItem(this.TOKEN_KEY, token);
      localStorage.setItem(this.WALLET_KEY, wallet);
      localStorage.setItem(this.EXP_KEY, expiresAt.toString());
      
      const expiryDate = new Date(expiresAt);
      console.log('[TokenManager] ✅ Token saved');
      console.log('[TokenManager] Expires at:', expiryDate.toLocaleString());
      console.log('[TokenManager] Wallet:', wallet.slice(0, 8) + '...');
      
      return true;
    } catch (err) {
      console.error('[TokenManager] Failed to save token:', err);
      return false;
    }
  }

  /**
   * Get valid token from storage
   * Returns null if token doesn't exist or has expired
   * @returns {string|null} - JWT token or null
   */
  getToken() {
    try {
      const token = localStorage.getItem(this.TOKEN_KEY);
      const expiresAt = parseInt(localStorage.getItem(this.EXP_KEY)) || 0;
      
      if (!token) {
        console.log('[TokenManager] No token found');
        return null;
      }
      
      // Check if expired
      if (Date.now() > expiresAt) {
        console.log('[TokenManager] ⚠️ Token expired');
        this.clearToken();
        return null;
      }
      
      const timeLeft = Math.floor((expiresAt - Date.now()) / 1000);
      console.log('[TokenManager] ✅ Token valid, expires in:', Math.floor(timeLeft / 60) + 'min');
      return token;
    } catch (err) {
      console.error('[TokenManager] Error getting token:', err);
      return null;
    }
  }

  /**
   * Check if token is expiring soon
   * Returns true if token expires in less than REFRESH_THRESHOLD seconds
   * @returns {boolean}
   */
  isExpiringSoon() {
    try {
      const expiresAt = parseInt(localStorage.getItem(this.EXP_KEY)) || 0;
      const timeLeft = expiresAt - Date.now();
      const isExpiring = timeLeft < (this.REFRESH_THRESHOLD * 1000);
      
      if (isExpiring) {
        const minutesLeft = Math.floor(timeLeft / 1000 / 60);
        console.log('[TokenManager] ⚠️ Token expiring soon in:', minutesLeft + 'min');
      }
      
      return isExpiring;
    } catch (err) {
      console.error('[TokenManager] Error checking expiration:', err);
      return false;
    }
  }

  /**
   * Get time until token expires (in seconds)
   * @returns {number} - Seconds until expiration, or 0 if expired
   */
  getTimeToExpiry() {
    try {
      const expiresAt = parseInt(localStorage.getItem(this.EXP_KEY)) || 0;
      const timeLeft = Math.floor((expiresAt - Date.now()) / 1000);
      return Math.max(0, timeLeft);
    } catch (err) {
      console.error('[TokenManager] Error calculating expiry time:', err);
      return 0;
    }
  }

  /**
   * Clear all token data
   */
  clearToken() {
    try {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.WALLET_KEY);
      localStorage.removeItem(this.EXP_KEY);
      localStorage.removeItem(this.NONCE_KEY);
      console.log('[TokenManager] ✅ Token cleared');
      return true;
    } catch (err) {
      console.error('[TokenManager] Failed to clear token:', err);
      return false;
    }
  }

  /**
   * Get stored wallet address
   * @returns {string|null}
   */
  getWallet() {
    try {
      return localStorage.getItem(this.WALLET_KEY);
    } catch (err) {
      console.error('[TokenManager] Error getting wallet:', err);
      return null;
    }
  }

  /**
   * Check if user is authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    return !!this.getToken();
  }

  /**
   * Get all token metadata
   * @returns {object}
   */
  getMetadata() {
    return {
      token: this.getToken() ? '✅ Present' : '❌ Missing',
      wallet: this.getWallet() || '❌ None',
      expiry: new Date(parseInt(localStorage.getItem(this.EXP_KEY))),
      timeToExpiry: this.getTimeToExpiry() + ' seconds',
      isExpiringSoon: this.isExpiringSoon(),
      isAuthenticated: this.isAuthenticated()
    };
  }

  /**
   * Mark nonce as used (prevent replay attacks)
   * @param {string} nonce
   */
  markNonceAsUsed(nonce) {
    try {
      const usedNonces = JSON.parse(localStorage.getItem('used_nonces') || '[]');
      usedNonces.push({
        nonce,
        usedAt: Date.now()
      });
      // Keep only last 100 nonces to prevent localStorage bloat
      const recentNonces = usedNonces.slice(-100);
      localStorage.setItem('used_nonces', JSON.stringify(recentNonces));
      console.log('[TokenManager] Nonce marked as used');
    } catch (err) {
      console.error('[TokenManager] Error marking nonce:', err);
    }
  }

  /**
   * Check if nonce was already used
   * @param {string} nonce
   * @returns {boolean}
   */
  isNonceUsed(nonce) {
    try {
      const usedNonces = JSON.parse(localStorage.getItem('used_nonces') || '[]');
      return usedNonces.some(item => item.nonce === nonce);
    } catch (err) {
      console.error('[TokenManager] Error checking nonce:', err);
      return false;
    }
  }
}

/**
 * Singleton instance
 */
export const tokenManager = new TokenManager();

/**
 * Export convenience functions
 */
export function saveToken(token, wallet, expiresIn) {
  return tokenManager.saveToken(token, wallet, expiresIn);
}

export function getToken() {
  return tokenManager.getToken();
}

export function getWallet() {
  return tokenManager.getWallet();
}

export function isAuthenticated() {
  return tokenManager.isAuthenticated();
}

export function clearToken() {
  return tokenManager.clearToken();
}

export function isExpiringSoon() {
  return tokenManager.isExpiringSoon();
}
