#!/usr/bin/env node

/**
 * Circuit Setup Script - Generates zKey from R1CS
 * 
 * This script:
 * 1. Uses Powers of Tau ceremony (standard for production)
 * 2. Generates proving and verification keys
 * 3. Extracts Solidity verifier contract
 */

const fs = require('fs');
const path = require('path');
const snarkjs = require('snarkjs');

const circuitPath = 'circuits/bid_range';
const r1csPath = path.join(circuitPath, 'bid_range.r1cs');
const wasmPath = path.join(circuitPath, 'bid_range_js', 'bid_range.wasm');
const zkeyPath = path.join(circuitPath, 'bid_range.zkey');
const vkeyPath = path.join(circuitPath, 'bid_range_vkey.json');
const verifierPath = path.join(circuitPath, 'BidRangeVerifier.sol');

// Powers of Tau ceremony (production settings)
const ptauUrl = 'https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_21.ptau';
const ptauPath = path.join(circuitPath, 'powersOfTau.ptau');

async function downloadFile(url, outputPath) {
  console.log(`📥 Downloading ${url}...`);
  const https = require('https');
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {});
      reject(err);
    });
  });
}

async function setup() {
  console.log('🔧 DarkBid ZK Circuit Setup');
  console.log('============================\n');

  try {
    // Check if compiled circuit exists
    if (!fs.existsSync(r1csPath)) {
      console.error('❌ R1CS file not found. Run: npm run circom:compile');
      process.exit(1);
    }

    // Download Powers of Tau if not present
    if (!fs.existsSync(ptauPath)) {
      console.log('⏳ Downloading Powers of Tau ceremony...');
      await downloadFile(ptauUrl, ptauPath);
      console.log('✅ Powers of Tau downloaded\n');
    } else {
      console.log('✅ Using cached Powers of Tau\n');
    }

    // Phase 2: Trusted Setup
    console.log('🔐 Generating zKey (Proving Key)...');
    const zkeyRes = await snarkjs.zKey.newZKey(
      r1csPath,
      ptauPath,
      zkeyPath,
      console.log
    );
    console.log('✅ zKey generated\n');

    // Export verification key
    console.log('📝 Exporting verification key...');
    const vkey = await snarkjs.zKey.exportVerificationKey(zkeyPath);
    fs.writeFileSync(vkeyPath, JSON.stringify(vkey, null, 2));
    console.log('✅ Verification key exported\n');

    // Generate Solidity verifier contract
    console.log('📄 Generating Solidity verifier contract...');
    const solidityTemplate = await snarkjs.zKey.exportSolidityVerifier(zkeyPath);
    fs.writeFileSync(verifierPath, solidityTemplate);
    console.log('✅ Verifier contract generated\n');

    console.log('============================');
    console.log('🎉 Setup Complete!');
    console.log('============================');
    console.log(`Proving Key:       ${zkeyPath}`);
    console.log(`Verification Key:  ${vkeyPath}`);
    console.log(`Verifier Contract: ${verifierPath}`);
    console.log('');
    console.log('Next Steps:');
    console.log('  1. Copy verifier contract to Solana program');
    console.log('  2. Deploy to devnet');
    console.log('  3. Test with sample proofs');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

setup();
