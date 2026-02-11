/**
 * X402 Client Example
 * 
 * Demonstrates how an AI agent can automatically pay for services
 * using the X402 protocol (HTTP 402 Payment Required).
 * 
 * Use case: Agent needs real-time market data and pays 2 cents per request
 */

const { X402Handler } = require('../x402-handler');
const { EscrowSystem } = require('../escrow');

// Mock fetch for demo (in real system, use node-fetch or axios)
async function mockFetch(url, options = {}) {
  console.log(`\n📡 Fetching: ${url}`);
  
  // First request: no payment → 402 response
  if (!options.headers || !options.headers['X-Payment-Proof']) {
    console.log('⚠️  No payment provided, server returns 402');
    
    return {
      status: 402,
      statusText: 'Payment Required',
      ok: false,
      headers: {
        'x-payment-amount': '0.02', // 2 cents
        'x-payment-token': 'USDC',
        'x-payment-address': '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        'x-payment-escrow-id': 'server-escrow-123',
        'x-payment-description': 'Real-time BTC market data'
      },
      json: async () => ({
        error: 'Payment Required',
        message: 'This API requires payment: $0.02 per request'
      })
    };
  }
  
  // Second request: payment proof provided → deliver content
  console.log('✅ Payment proof verified, delivering content');
  
  return {
    status: 200,
    ok: true,
    headers: {
      'content-type': 'application/json'
    },
    json: async () => ({
      symbol: 'BTC',
      price: 98234.56,
      change24h: 2.34,
      volume24h: 28500000000,
      timestamp: Date.now(),
      source: 'Premium Market Data API'
    })
  };
}

/**
 * Example: Agent fetches market data with automatic payment
 */
async function fetchMarketDataWithPayment() {
  console.log('='.repeat(60));
  console.log('X402 Client Example: Fetch Market Data with Auto-Payment');
  console.log('='.repeat(60));

  // Initialize X402 handler
  const escrow = new EscrowSystem('./escrow-x402-client.json');
  const x402 = new X402Handler(escrow, {
    autoRelease: true,
    defaultTimeout: 300 // 5 minutes
  });

  const agentWallet = '0x1234567890123456789012345678901234567890';
  const apiUrl = 'https://api.premium-data.com/market-data/BTC';

  try {
    // Step 1: Agent makes initial request
    console.log('\n📊 Agent requesting market data...');
    const response = await mockFetch(apiUrl, {
      headers: {
        'X-Agent-Wallet': agentWallet,
        'User-Agent': 'AI-Trading-Agent/1.0'
      }
    });

    // Step 2: Check if payment is required
    if (response.status === 402) {
      console.log('\n💰 Payment required! Handling automatically...');
      
      // Step 3: X402 handler processes payment and retries request
      const paidResponse = await x402.handlePaymentRequired(
        response,
        {
          url: apiUrl,
          method: 'GET',
          headers: {
            'X-Agent-Wallet': agentWallet,
            'User-Agent': 'AI-Trading-Agent/1.0'
          }
        },
        {
          agentId: 'trading-agent-001',
          wallet: agentWallet
        }
      );

      // Step 4: Process received data
      const data = await paidResponse.json();
      console.log('\n📈 Market Data Received:');
      console.log(JSON.stringify(data, null, 2));

      // Step 5: Show escrow statistics
      console.log('\n📊 X402 Transaction Statistics:');
      const stats = x402.getStats();
      console.log(JSON.stringify(stats, null, 2));

      console.log('\n✅ Transaction complete!');
      console.log(`💵 Cost: 2¢ (USDC) + ~0.3¢ (gas) = 2.3¢ total`);
      console.log(`⚡ Settlement time: ~3 seconds`);
      console.log(`🎯 Use case: AI agent paid for premium data feed`);

    } else {
      // Content already available (no payment needed)
      const data = await response.json();
      console.log('\n✅ Free data received:');
      console.log(JSON.stringify(data, null, 2));
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  }
}

/**
 * Example: Batch multiple paid requests efficiently
 */
async function batchPaidRequests() {
  console.log('\n' + '='.repeat(60));
  console.log('X402 Batch Example: Multiple Paid API Calls');
  console.log('='.repeat(60));

  const escrow = new EscrowSystem('./escrow-x402-batch.json');
  const x402 = new X402Handler(escrow);

  const symbols = ['BTC', 'ETH', 'SOL', 'MATIC'];
  const results = [];

  console.log(`\n📊 Fetching data for ${symbols.length} symbols...`);

  for (const symbol of symbols) {
    try {
      const response = await mockFetch(`https://api.premium-data.com/market-data/${symbol}`);
      
      if (response.status === 402) {
        const paidResponse = await x402.handlePaymentRequired(
          response,
          {
            url: `https://api.premium-data.com/market-data/${symbol}`,
            method: 'GET'
          },
          { agentId: 'batch-requester', wallet: '0xABC...' }
        );
        
        const data = await paidResponse.json();
        results.push({ symbol, data });
        console.log(`  ✅ ${symbol}: $${data.price}`);
      }
    } catch (error) {
      console.error(`  ❌ ${symbol}: ${error.message}`);
    }
  }

  console.log(`\n📊 Batch Statistics:`);
  const stats = x402.getStats();
  console.log(`  Total requests: ${results.length}`);
  console.log(`  Total cost: ${(results.length * 0.02).toFixed(2)} USDC`);
  console.log(`  Avg per request: 2¢`);
  console.log(`  Success rate: ${stats.successRate}`);
}

/**
 * Example: Handle payment failure gracefully
 */
async function handlePaymentFailure() {
  console.log('\n' + '='.repeat(60));
  console.log('X402 Error Handling: Payment Failure Recovery');
  console.log('='.repeat(60));

  const escrow = new EscrowSystem('./escrow-x402-error.json');
  const x402 = new X402Handler(escrow, {
    maxRetries: 3,
    retryDelay: 500
  });

  try {
    // Simulate a payment that fails verification
    console.log('\n⚠️  Simulating payment failure...');
    
    const mockInvalidResponse = {
      status: 402,
      headers: {
        'x-payment-amount': '0.05',
        'x-payment-token': 'USDC',
        'x-payment-address': '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        'x-payment-description': 'GPU compute - 1 minute'
      },
      json: async () => ({ error: 'Payment Required' })
    };

    // This will fail because server rejects the payment
    await x402.handlePaymentRequired(
      mockInvalidResponse,
      { url: 'https://compute.example.com/gpu', method: 'POST' },
      { agentId: 'gpu-client', wallet: '0xDEF...' }
    );

  } catch (error) {
    console.log('\n❌ Payment failed:', error.message);
    console.log('🔄 Agent can retry with different wallet or report failure');
    console.log('💡 Escrow will auto-refund after timeout (5 minutes)');
  }
}

// Run examples
async function main() {
  try {
    // Example 1: Single paid request
    await fetchMarketDataWithPayment();

    // Example 2: Batch requests (commented out for brevity)
    // await batchPaidRequests();

    // Example 3: Error handling (commented out for brevity)
    // await handlePaymentFailure();

    console.log('\n' + '='.repeat(60));
    console.log('✅ All examples completed!');
    console.log('='.repeat(60));
    console.log('\nNext steps:');
    console.log('  1. Integrate real HTTP client (fetch/axios)');
    console.log('  2. Connect to actual blockchain wallet');
    console.log('  3. Add monitoring and logging');
    console.log('  4. Deploy to production server');
    console.log('\n💡 This positions your agent to tap into $600M X402 market!');
    
  } catch (error) {
    console.error('\n❌ Example failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = {
  fetchMarketDataWithPayment,
  batchPaidRequests,
  handlePaymentFailure
};
