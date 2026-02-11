/**
 * X402 Protocol Integration Tests
 * 
 * Tests all X402 functionality:
 * - Client payment handling
 * - Server payment requirements
 * - Escrow integration
 * - Auto-release functionality
 * - Error handling
 */

const { X402Handler } = require('./x402-handler');
const { EscrowSystem } = require('./escrow');

// Test configuration
const TEST_CONFIG = {
  clientWallet: '0x1234567890123456789012345678901234567890',
  serverWallet: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  testAmount: 0.02, // 2 cents
  testToken: 'USDC'
};

// Test results tracker
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function assert(condition, message) {
  if (condition) {
    results.passed++;
    results.tests.push({ status: 'PASS', message });
    console.log(`✅ PASS: ${message}`);
  } else {
    results.failed++;
    results.tests.push({ status: 'FAIL', message });
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Test failed: ${message}`);
  }
}

/**
 * Test 1: Parse 402 response headers
 */
function testParsePaymentHeaders() {
  console.log('\n📋 Test 1: Parse 402 Response Headers');
  
  const escrow = new EscrowSystem('./test-escrow-x402.json');
  const x402 = new X402Handler(escrow);

  const mockHeaders = {
    'x-payment-amount': '0.02',
    'x-payment-token': 'USDC',
    'x-payment-address': TEST_CONFIG.serverWallet,
    'x-payment-escrow-id': 'server-escrow-123',
    'x-payment-description': 'Test service'
  };

  const paymentInfo = x402.parsePaymentHeaders(mockHeaders);

  assert(paymentInfo.amount === 0.02, 'Payment amount parsed correctly');
  assert(paymentInfo.token === 'USDC', 'Payment token parsed correctly');
  assert(paymentInfo.recipient === TEST_CONFIG.serverWallet, 'Recipient address parsed correctly');
  assert(paymentInfo.description === 'Test service', 'Description parsed correctly');

  console.log('  Payment info:', paymentInfo);
}

/**
 * Test 2: Create X402 escrow
 */
async function testCreateX402Escrow() {
  console.log('\n📋 Test 2: Create X402 Escrow');
  
  const escrow = new EscrowSystem('./test-escrow-x402.json');
  const x402 = new X402Handler(escrow);

  const paymentInfo = {
    amount: TEST_CONFIG.testAmount,
    token: TEST_CONFIG.testToken,
    recipient: TEST_CONFIG.serverWallet,
    description: 'Test payment'
  };

  const payerInfo = {
    agentId: 'test-agent',
    wallet: TEST_CONFIG.clientWallet
  };

  const createdEscrow = await x402.createX402Escrow(paymentInfo, payerInfo);

  assert(createdEscrow !== null, 'Escrow created successfully');
  assert(createdEscrow.amount === TEST_CONFIG.testAmount, 'Escrow amount correct');
  assert(createdEscrow.payee === TEST_CONFIG.serverWallet, 'Payee address correct');
  assert(createdEscrow.purpose.startsWith('X402:'), 'Purpose marked as X402');
  assert(createdEscrow.state === 'pending', 'Initial state is pending');

  console.log('  Escrow ID:', createdEscrow.id);
  console.log('  Amount:', createdEscrow.amount, createdEscrow.conditions.token);
}

/**
 * Test 3: Generate 402 response
 */
function testRequirePayment() {
  console.log('\n📋 Test 3: Generate 402 Response');
  
  const escrow = new EscrowSystem('./test-escrow-x402.json');
  const x402 = new X402Handler(escrow);

  const response = x402.requirePayment(
    0.05,
    'USDC',
    TEST_CONFIG.serverWallet,
    'Premium API access'
  );

  assert(response.status === 402, 'Status code is 402');
  assert(response.headers['X-Payment-Amount'] === '0.05', 'Amount header set correctly');
  assert(response.headers['X-Payment-Token'] === 'USDC', 'Token header set correctly');
  assert(response.headers['X-Payment-Address'] === TEST_CONFIG.serverWallet, 'Address header set correctly');
  assert(response.body.paymentInfo.amount === 0.05, 'Body contains payment info');

  console.log('  Response headers:', response.headers);
  console.log('  Response body:', response.body.message);
}

/**
 * Test 4: Verify payment proof
 */
async function testVerifyPaymentProof() {
  console.log('\n📋 Test 4: Verify Payment Proof');
  
  const escrow = new EscrowSystem('./test-escrow-x402.json');
  const x402 = new X402Handler(escrow);

  // Create and fund escrow
  const paymentInfo = {
    amount: TEST_CONFIG.testAmount,
    token: TEST_CONFIG.testToken,
    recipient: TEST_CONFIG.serverWallet,
    description: 'Test payment'
  };

  const createdEscrow = await x402.createX402Escrow(paymentInfo, {
    agentId: 'test-agent',
    wallet: TEST_CONFIG.clientWallet
  });

  const txHash = x402.generateMockTxHash();
  escrow.fund(createdEscrow.id, txHash);

  // Verify payment
  const headers = {
    'x-payment-proof': JSON.stringify({
      escrowId: createdEscrow.id,
      txHash,
      amount: TEST_CONFIG.testAmount
    }),
    'x-payment-escrow-id': createdEscrow.id
  };

  const verification = await x402.verifyPaymentProof(headers, TEST_CONFIG.testAmount);

  assert(verification.valid === true, 'Payment verification successful');
  assert(verification.escrow.id === createdEscrow.id, 'Escrow ID matches');
  assert(['funded', 'locked'].includes(verification.escrow.state), 'Escrow is funded or locked');

  console.log('  Verification:', verification.valid ? 'VALID' : 'INVALID');
  console.log('  Escrow state:', verification.escrow.state);
}

/**
 * Test 5: End-to-end payment flow
 */
async function testEndToEndFlow() {
  console.log('\n📋 Test 5: End-to-End Payment Flow');
  
  const escrow = new EscrowSystem('./test-escrow-x402.json');
  const x402 = new X402Handler(escrow, { autoRelease: true });

  // Simulate 402 response
  const mock402Response = {
    status: 402,
    headers: {
      'x-payment-amount': '0.02',
      'x-payment-token': 'USDC',
      'x-payment-address': TEST_CONFIG.serverWallet,
      'x-payment-description': 'Market data API'
    },
    json: async () => ({ error: 'Payment required' })
  };

  const httpRequest = {
    url: 'https://api.example.com/data',
    method: 'GET',
    headers: {}
  };

  const payerInfo = {
    agentId: 'test-agent',
    wallet: TEST_CONFIG.clientWallet
  };

  // Handle payment (mocked fetch returns success after payment)
  const paidResponse = await x402.handlePaymentRequired(
    mock402Response,
    httpRequest,
    payerInfo
  );

  assert(paidResponse.ok === true, 'Content delivered after payment');
  
  const stats = x402.getStats();
  assert(stats.totalTransactions > 0, 'Transaction recorded in stats');
  assert(parseInt(stats.successRate) > 0, 'Success rate calculated');

  console.log('  Transaction stats:', stats);
}

/**
 * Test 6: Handle payment failure
 */
async function testPaymentFailure() {
  console.log('\n📋 Test 6: Handle Payment Failure');
  
  const escrow = new EscrowSystem('./test-escrow-x402.json');
  const x402 = new X402Handler(escrow);

  // Test with insufficient payment
  const escrowId = 'nonexistent-escrow';
  const headers = {
    'x-payment-proof': JSON.stringify({ escrowId }),
    'x-payment-escrow-id': escrowId
  };

  const verification = await x402.verifyPaymentProof(headers, 0.05);

  assert(verification.valid === false, 'Invalid payment rejected');
  assert(verification.error !== undefined, 'Error message provided');

  console.log('  Error:', verification.error);
}

/**
 * Test 7: Escrow timeout and auto-refund
 */
async function testEscrowTimeout() {
  console.log('\n📋 Test 7: Escrow Timeout and Auto-Refund');
  
  const escrow = new EscrowSystem('./test-escrow-x402-timeout.json');
  
  // Create escrow with expired timeout
  const testEscrow = escrow.create({
    payer: TEST_CONFIG.clientWallet,
    payee: TEST_CONFIG.serverWallet,
    amount: 0.02,
    purpose: 'X402: Timeout test',
    timeoutMinutes: -1 // Set to past (negative = already expired)
  });

  const txHash = '0x' + Math.random().toString(16).substring(2);
  escrow.fund(testEscrow.id, txHash);

  // Verify escrow is now funded or locked
  const fundedEscrow = escrow.get(testEscrow.id);
  assert(['funded', 'locked'].includes(fundedEscrow.state), 'Escrow is funded or locked');

  // Process timeouts
  const expired = escrow.processTimeouts();

  assert(expired.length >= 1, 'Expired escrow detected');
  assert(expired.includes(testEscrow.id), 'Test escrow timed out');
  
  const refundedEscrow = escrow.get(testEscrow.id);
  assert(refundedEscrow.state === 'refunded', 'Escrow auto-refunded');

  console.log('  Expired escrows:', expired.length);
  console.log('  Final state:', refundedEscrow.state);
}

/**
 * Test 8: X402 statistics
 */
async function testStatistics() {
  console.log('\n📋 Test 8: X402 Statistics');
  
  const escrow = new EscrowSystem('./test-escrow-x402.json');
  const x402 = new X402Handler(escrow);

  // Create multiple X402 escrows
  for (let i = 0; i < 5; i++) {
    const paymentInfo = {
      amount: 0.02 * (i + 1),
      token: 'USDC',
      recipient: TEST_CONFIG.serverWallet,
      description: `Test payment ${i + 1}`
    };
    
    const testEscrow = await x402.createX402Escrow(paymentInfo, {
      agentId: `agent-${i}`,
      wallet: TEST_CONFIG.clientWallet
    });

    const txHash = x402.generateMockTxHash();
    escrow.fund(testEscrow.id, txHash);
    
    if (i % 2 === 0) {
      // Submit delivery proof before releasing
      escrow.submitDelivery(testEscrow.id, {
        submittedBy: TEST_CONFIG.serverWallet,
        data: { delivered: true },
        signature: 'test-sig'
      });
      
      // Only release if not already released by submitDelivery
      const currentState = escrow.get(testEscrow.id);
      if (currentState.state === 'locked') {
        escrow.release(testEscrow.id, 'Test release');
      }
    }
  }

  const stats = x402.getStats();

  assert(stats.totalTransactions >= 5, 'All transactions recorded');
  assert(stats.totalVolume > 0, 'Total volume calculated');
  assert(stats.avgTransaction !== '0.0000', 'Average transaction calculated');
  assert(stats.byState !== undefined, 'State breakdown available');

  console.log('  Total transactions:', stats.totalTransactions);
  console.log('  Total volume:', stats.totalVolume, 'USDC');
  console.log('  Avg transaction:', stats.avgTransaction, 'USDC');
  console.log('  Success rate:', stats.successRate);
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('='.repeat(60));
  console.log('X402 Protocol Integration Tests');
  console.log('='.repeat(60));

  try {
    testParsePaymentHeaders();
    await testCreateX402Escrow();
    testRequirePayment();
    await testVerifyPaymentProof();
    await testEndToEndFlow();
    await testPaymentFailure();
    await testEscrowTimeout();
    await testStatistics();

    console.log('\n' + '='.repeat(60));
    console.log('Test Results');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📊 Total:  ${results.passed + results.failed}`);
    console.log(`🎯 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

    if (results.failed === 0) {
      console.log('\n🎉 All tests passed! X402 integration is working correctly.');
      console.log('\n💡 Next steps:');
      console.log('  1. Run client example: node examples/x402-client-example.js');
      console.log('  2. Run server example: node examples/x402-server-example.js');
      console.log('  3. Review docs: docs/X402-INTEGRATION.md');
      console.log('  4. Commit code and open PR');
    } else {
      console.error('\n⚠️  Some tests failed. Please review the errors above.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests };
