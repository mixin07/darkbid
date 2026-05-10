/**
 * ZK Proof Testing & Benchmarking
 * 
 * Run: node scripts/test-proving.js
 * 
 * Tests the complete proof generation pipeline:
 * 1. Circuit compilation
 * 2. Witness generation
 * 3. Proof generation
 * 4. Proof verification
 * 5. Performance benchmarking
 */

const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const circuitDir = 'circuits/bid_range';
const r1csPath = path.join(circuitDir, 'bid_range.r1cs');
const wasmPath = path.join(circuitDir, 'bid_range_js', 'bid_range.wasm');
const zkeyPath = path.join(circuitDir, 'bid_range.zkey');
const vkeyPath = path.join(circuitDir, 'bid_range_vkey.json');

async function runBenchmark() {
  console.log('🧪 DarkBid ZK Proof Benchmark');
  console.log('================================\n');

  try {
    // Check files exist
    if (!fs.existsSync(wasmPath)) {
      console.error('❌ WASM not found. First run: npm run circom:compile');
      process.exit(1);
    }

    if (!fs.existsSync(zkeyPath)) {
      console.error('❌ zKey not found. First run: npm run circom:setup');
      process.exit(1);
    }

    // Load artifacts
    console.log('📦 Loading circuit artifacts...');
    const wasm = fs.readFileSync(wasmPath);
    const zkey = fs.readFileSync(zkeyPath);
    const vkey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));
    console.log('✅ All artifacts loaded\n');

    // Test Parameters
    const testCases = [
      {
        name: 'Valid Bid (Above Reserve)',
        bidAmount: 100,
        bidSecret: 12345,
        reservePrice: 50,
        shouldPass: true,
      },
      {
        name: 'Minimum Valid Bid (Equal to Reserve)',
        bidAmount: 50,
        bidSecret: 67890,
        reservePrice: 50,
        shouldPass: true,
      },
      {
        name: 'Invalid Bid (Below Reserve)',
        bidAmount: 25,
        bidSecret: 11111,
        reservePrice: 50,
        shouldPass: false,
      },
    ];

    let totalTime = 0;
    let successCount = 0;
    const results = [];

    for (const testCase of testCases) {
      console.log(`📝 Test: ${testCase.name}`);
      console.log(`   Bid: ${testCase.bidAmount}, Reserve: ${testCase.reservePrice}`);

      try {
        // Prepare witness input
        const INPUT = {
          bidAmount: testCase.bidAmount.toString(),
          bidSecret: testCase.bidSecret.toString(),
          reservePrice: testCase.reservePrice.toString(),
          commitHash: crypto.randomInt(1, 2 ** 32).toString(),
        };

        // Generate witness
        const startWitness = performance.now();
        const buffer = await snarkjs.wtns.calculate(INPUT, wasm);
        const witnessTime = performance.now() - startWitness;

        // Generate proof
        const startProof = performance.now();
        const { proof, publicSignals } = await snarkjs.groth16.prove(zkey, buffer);
        const proofTime = performance.now() - startProof;

        // Verify proof
        const startVerify = performance.now();
        const isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
        const verifyTime = performance.now() - startVerify;

        const totalCaseTime = witnessTime + proofTime + verifyTime;
        totalTime += totalCaseTime;

        if (isValid === testCase.shouldPass) {
          successCount++;
          console.log(`   ✅ PASS (${totalCaseTime.toFixed(2)}ms)`);
          console.log(`      Witness: ${witnessTime.toFixed(2)}ms`);
          console.log(`      Prove:   ${proofTime.toFixed(2)}ms`);
          console.log(`      Verify:  ${verifyTime.toFixed(2)}ms`);
        } else {
          console.log(
            `   ❌ FAIL - Expected ${testCase.shouldPass}, got ${isValid}`
          );
        }

        results.push({
          name: testCase.name,
          witnessTime: witnessTime.toFixed(2),
          proofTime: proofTime.toFixed(2),
          verifyTime: verifyTime.toFixed(2),
          totalTime: totalCaseTime.toFixed(2),
        });

      } catch (err) {
        console.log(`   ❌ ERROR: ${err.message}`);
      }

      console.log('');
    }

    // Summary
    console.log('================================');
    console.log('📊 Benchmark Results');
    console.log('================================');
    console.table(results);

    const avgProofTime = (totalTime / testCases.length / 1000).toFixed(2);
    console.log(`\nAverage Time Per Proof: ${avgProofTime}s`);
    console.log(`Success Rate: ${successCount}/${testCases.length}`);

    if (avgProofTime < 3) {
      console.log('✅ Performance target MET (< 3 seconds)');
    } else {
      console.warn('⚠️ Performance target MISSED (> 3 seconds)');
    }

    if (successCount === testCases.length) {
      console.log('✅ All tests PASSED');
    } else {
      console.log(`❌ ${testCases.length - successCount} tests FAILED`);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

runBenchmark();
