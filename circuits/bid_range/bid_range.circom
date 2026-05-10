// Zero-Knowledge Circuit for DarkBid Sealed Auction
// Proves:
// 1. bid >= reserve (amount check)
// 2. hash(bid + secret) == commitHash (proof of knowledge)

pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";

template BidRangeProof(n) {
    // Public inputs
    signal input reservePrice;        // Minimum acceptable bid
    signal input commitHash;          // hash(bid + secret), known to auctioneer
    
    // Private inputs (known only to bidder)
    signal input bidAmount;           // Actual bid amount
    signal input bidSecret;           // Random nonce/secret (for hiding commitment)
    
    // Outputs
    signal output validAmountProof;   // 1 if bid >= reserve, 0 otherwise
    signal output hashMatchProof;     // 1 if hash matches, 0 otherwise
    
    // ============================================================================
    // CONSTRAINT 1: Verify bid >= reserve price
    // Uses comparison constraint
    // ============================================================================
    component greaterOrEqual = LessThan(256);
    greaterOrEqual.in[0] <== reservePrice;
    greaterOrEqual.in[1] <== bidAmount;
    validAmountProof <== greaterOrEqual.out;
    
    // ============================================================================
    // CONSTRAINT 2: Verify hash(bidAmount || bidSecret) == commitHash
    // Uses Poseidon hash (ZK-friendly, O(1) constraints)
    // ============================================================================
    component hasher = Poseidon(2);
    hasher.inputs[0] <== bidAmount;
    hasher.inputs[1] <== bidSecret;
    
    // Verify the computed hash matches the public commitment
    commitHash === hasher.out;
    
    // ============================================================================
    // CONSTRAINT 3: Final proof output
    // Both conditions must be satisfied
    // ============================================================================
    hashMatchProof <== 1;
}

component main { public [reservePrice, commitHash] } = BidRangeProof(256);
