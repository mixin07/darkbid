/**
 * ZK Proof Generation Utility for DarkBid
 * 
 * Generates zero-knowledge proofs that:
 * 1. Bid amount >= reserve price
 * 2. hash(bid + secret) matches the committed hash
 * 
 * Optimized for browser: < 3 seconds proof generation
 */

import snarkjs from 'snarkjs';

// Import compiled circuit (WASM)
// These paths should point to the compiled circuit files
const WASM_PATH = '/bid_range_js/bid_range.wasm';
const ZKEY_PATH = '/bid_range_js/bid_range.zkey';
const VKEY_PATH = '/bid_range.vkey.json';

let cachedWasm = null;
let cachedZkey = null;
let cachedVkey = null;

/**
 * Load circuit artifacts (cached for performance)
 */
async function loadCircuitArtifacts() {
  try {
    if (!cachedWasm) {
      console.log('📦 Loading WASM circuit...');
      const wasmRes = await fetch(WASM_PATH);
      cachedWasm = await wasmRes.arrayBuffer();
    }

    if (!cachedZkey) {
      console.log('📦 Loading zKey...');
      const zkeyRes = await fetch(ZKEY_PATH);
      cachedZkey = await zkeyRes.arrayBuffer();
    }

    if (!cachedVkey) {
      console.log('📦 Loading verification key...');
      const vkeyRes = await fetch(VKEY_PATH);
      cachedVkey = await vkeyRes.json();
    }

    return { wasm: cachedWasm, zkey: cachedZkey, vkey: cachedVkey };
  } catch (error) {
    console.error('❌ Failed to load circuit artifacts:', error);
    throw new Error('Could not load ZK circuit files');
  }
}

/**
 * Generate a ZK proof for bid submission
 * 
 * @param {number} bidAmount - The actual bid amount (kept secret)
 * @param {number} bidSecret - Random nonce/salt for hiding commitment
 * @param {number} reservePrice - Minimum acceptable bid (public)
 * @param {string} commitHash - hash(bid + secret), known to auctioneer (public)
 * @returns {Promise<{proof, publicSignals}>} ZK proof ready for smart contract
 */
export async function generateBidProof(bidAmount, bidSecret, reservePrice, commitHash) {
  const startTime = performance.now();

  try {
    console.log('🔐 Generating ZK proof for bid...');
    console.log(`   Bid: ${bidAmount}, Reserve: ${reservePrice}`);

    // Load circuit artifacts
    const { wasm, zkey, vkey } = await loadCircuitArtifacts();

    // Prepare witness input
    const INPUT = {
      bidAmount: bidAmount.toString(),
      bidSecret: bidSecret.toString(),
      reservePrice: reservePrice.toString(),
      commitHash: commitHash.toString(),
    };

    console.log('⚙️ Computing witness...');
    
    // Generate witness from circuit
    const buffer = await snarkjs.wtns.calculate(INPUT, wasm);

    console.log('✍️ Creating proof...');
    
    // Generate proof using zKey
    const { proof, publicSignals } = await snarkjs.groth16.prove(zkey, buffer);

    const endTime = performance.now();
    const duration = (endTime - startTime) / 1000;

    console.log(`✅ Proof generated in ${duration.toFixed(2)}s`);

    if (duration > 3) {
      console.warn('⚠️ Warning: Proof generation took > 3 seconds');
    }

    return {
      proof,
      publicSignals,
      duration,
    };
  } catch (error) {
    console.error('❌ Failed to generate proof:', error);
    throw error;
  }
}

/**
 * Verify a proof locally (for testing)
 * 
 * @param {object} proof - The proof object from generateBidProof
 * @param {array} publicSignals - Public signals from generateBidProof
 * @returns {Promise<boolean>} True if proof is valid
 */
export async function verifyProofLocally(proof, publicSignals) {
  try {
    console.log('🔍 Verifying proof locally...');

    const { vkey } = await loadCircuitArtifacts();

    const isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);

    if (isValid) {
      console.log('✅ Proof is valid');
    } else {
      console.log('❌ Proof is invalid');
    }

    return isValid;
  } catch (error) {
    console.error('❌ Verification failed:', error);
    return false;
  }
}

/**
 * Format proof for smart contract consumption
 * Converts proof to a flat array suitable for Solana CPI call
 * 
 * @param {object} proof - Groth16 proof object
 * @param {array} publicSignals - Public signals
 * @returns {object} Formatted for smart contract
 */
export function formatProofForContract(proof, publicSignals) {
  const proofArray = [
    proof.pi_a[0],
    proof.pi_a[1],
    proof.pi_b[0][1],
    proof.pi_b[0][0],
    proof.pi_b[1][1],
    proof.pi_b[1][0],
    proof.pi_c[0],
    proof.pi_c[1],
    ...publicSignals,
  ];

  return {
    proofArray: proofArray.map(x => x.toString()),
    publicSignals: publicSignals.map(x => x.toString()),
  };
}

/**
 * Compute Poseidon hash for bid commitment
 * This matches what the contract expects
 * 
 * @param {number} bidAmount 
 * @param {number} bidSecret 
 * @returns {Promise<string>} Hash digest
 */
export async function computeBidHash(bidAmount, bidSecret) {
  try {
    // Use snarkjs built-in Poseidon hash
    const hash = await snarkjs.poseidon([bidAmount, bidSecret]);
    
    return snarkjs.F.toString(hash);
  } catch (error) {
    console.error('❌ Hash computation failed:', error);
    throw error;
  }
}

export default {
  generateBidProof,
  verifyProofLocally,
  formatProofForContract,
  computeBidHash,
};
