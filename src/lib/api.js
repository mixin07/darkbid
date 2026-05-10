/**
 * API wrapper that automatically includes JWT token in requests
 * Usage: api('/auctions') or api('/login', { method: 'POST', body: {...} })
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

/**
 * Get stored JWT token from localStorage
 */
export function getToken() {
  const token = localStorage.getItem('darkbid_token')
  console.log('[API] Token:', token ? '✅ Present' : '❌ Missing')
  return token
}

/**
 * Store JWT token in localStorage
 */
export function setToken(token) {
  if (token) {
    localStorage.setItem('darkbid_token', token)
    console.log('[API] Token stored')
  } else {
    localStorage.removeItem('darkbid_token')
    console.log('[API] Token cleared')
  }
}

/**
 * Clear stored JWT token
 */
export function clearToken() {
  localStorage.removeItem('darkbid_token')
  console.log('[API] Token cleared')
}

/**
 * Fetch wrapper that includes JWT token in Authorization header
 * @param {string} endpoint - API endpoint (e.g., '/auth/login')
 * @param {object} options - Fetch options (method, body, headers, etc.)
 * @returns {Promise<object>} - Parsed JSON response
 */
export async function api(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`
  const token = getToken()

  // Build headers
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  }

  // Add JWT token if available
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  console.log(`[API] ${options.method || 'GET'} ${endpoint}`)

  try {
    const response = await fetch(url, {
      ...options,
      headers
    })

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type')
    const data = contentType?.includes('application/json')
      ? await response.json()
      : await response.text()

    // Log response
    if (!response.ok) {
      console.error(`[API] ❌ ${response.status}`, data)
      throw new Error(data?.message || `HTTP ${response.status}`)
    }

    console.log(`[API] ✅ ${response.status}`, data)
    return data
  } catch (err) {
    console.error(`[API] Error:`, err.message)
    throw err
  }
}

/**
 * Common API endpoints
 */

// AUTH
export async function register(walletAddress, email, password) {
  return api('/register', {
    method: 'POST',
    body: JSON.stringify({
      wallet_address: walletAddress,
      email: email || null,
      password: password || null
    })
  })
}

export async function login(walletAddress, password) {
  const response = await api('/login', {
    method: 'POST',
    body: JSON.stringify({
      wallet_address: walletAddress,
      password: password || null
    })
  })
  if (response.token) {
    setToken(response.token)
  }
  return response
}

export async function getAuthNonce(walletAddress) {
  const qs = new URLSearchParams({ wallet: walletAddress })
  return api(`/auth/nonce?${qs.toString()}`)
}

export async function walletAuth(walletAddress, signature, nonce) {
  const response = await api('/login', {
    method: 'POST',
    body: JSON.stringify({
      wallet_address: walletAddress,
      signature,
      nonce
    })
  })
  if (response.token) {
    setToken(response.token)
  }
  return response
}

// AUCTIONS
export async function listAuctions() {
  return api('/auctions')
}

export async function getAuction(id) {
  return api(`/auction/${id}`)
}

export async function createAuction(auctionData) {
  return api('/auction/create', {
    method: 'POST',
    body: JSON.stringify(auctionData)
  })
}

export async function getAuctionResult(id) {
  return api(`/auction/${id}/result`)
}

// BIDS
export async function commitBid(auctionId, commitHash, commitTxSig) {
  return api('/bid/commit', {
    method: 'POST',
    body: JSON.stringify({
      auction_id: auctionId,
      commit_hash: commitHash,
      commit_tx_sig: commitTxSig
    })
  })
}

export async function revealBid({ bidId, auctionId, amount, nonce, revealTxSig, zkProof }) {
  return api('/bid/reveal', {
    method: 'POST',
    body: JSON.stringify({
      bid_id: bidId,
      auction_id: auctionId,
      reveal_amount: amount,
      nonce,
      reveal_tx_sig: revealTxSig,
      zk_proof: zkProof || null
    })
  })
}

// HEALTH
export async function health() {
  return api('/health')
}
