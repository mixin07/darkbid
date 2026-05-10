// Build commit hash aligned with backend hashing (amount:nonce:bidder_id_bytes)
export async function buildCommitHash(amount, nonce, bidderId) {
  if (!bidderId || typeof bidderId !== 'string') {
    return null
  }

  const bidderBytes = uuidToBytes(bidderId)
  if (!bidderBytes) {
    return null
  }

  const encoder = new TextEncoder()
  const amountBytes = encoder.encode(String(amount))
  const nonceBytes = encoder.encode(nonce)
  const colon = encoder.encode(':')

  const totalLen = amountBytes.length + 1 + nonceBytes.length + 1 + bidderBytes.length
  const data = new Uint8Array(totalLen)

  let offset = 0
  data.set(amountBytes, offset)
  offset += amountBytes.length
  data.set(colon, offset)
  offset += 1
  data.set(nonceBytes, offset)
  offset += nonceBytes.length
  data.set(colon, offset)
  offset += 1
  data.set(bidderBytes, offset)

  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function uuidToBytes(uuid) {
  const hex = uuid.replace(/-/g, '')
  if (hex.length !== 32) {
    return null
  }

  const bytes = new Uint8Array(16)
  for (let i = 0; i < 16; i += 1) {
    const idx = i * 2
    bytes[i] = Number.parseInt(hex.slice(idx, idx + 2), 16)
  }

  return bytes
}
