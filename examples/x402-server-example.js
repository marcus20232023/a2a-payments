/**
 * X402 Server Example
 * 
 * Demonstrates how to build an API that charges for access using X402 protocol.
 * Perfect for AI agents selling data feeds, compute, or services.
 * 
 * Use cases:
 * - Premium data APIs (market data, research papers)
 * - GPU compute rental (pay per minute)
 * - Agent services (code review, translation)
 * - Web scraping APIs (pay per request)
 */

const express = require('express');
const { X402Handler } = require('../x402-handler');
const { EscrowSystem } = require('../escrow');

// Initialize Express server
const app = express();
app.use(express.json());

// Initialize X402 handler
const escrow = new EscrowSystem('./escrow-x402-server.json');
const x402 = new X402Handler(escrow);

// Server configuration
const SERVER_CONFIG = {
  wallet: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  port: 8402, // X402 port 😊
  pricing: {
    marketData: 0.02, // 2 cents per request
    historicalData: 0.05, // 5 cents per dataset
    gpuCompute: 0.50, // 50 cents per minute
    codeReview: 0.10 // 10 cents per review
  }
};

/**
 * Middleware: Check for X402 payment
 */
function requirePayment(service, price) {
  return async (req, res, next) => {
    const paymentProof = req.headers['x-payment-proof'];
    const escrowId = req.headers['x-payment-escrow-id'];

    // No payment provided → return 402
    if (!paymentProof || !escrowId) {
      console.log(`⚠️  Payment required for ${service}: ${price} USDC`);
      
      const response = x402.requirePayment(
        price,
        'USDC',
        SERVER_CONFIG.wallet,
        service,
        { network: 'polygon' }
      );

      return res.status(402)
        .set(response.headers)
        .json(response.body);
    }

    // Verify payment
    const verification = await x402.verifyPaymentProof(req.headers, price);

    if (!verification.valid) {
      console.log(`❌ Payment verification failed: ${verification.error}`);
      return res.status(402).json({
        error: 'Invalid payment',
        message: verification.error
      });
    }

    console.log(`✅ Payment verified: ${escrowId}`);
    
    // Store escrow for later release
    req.escrow = verification.escrow;
    req.paymentProof = verification.proof;
    
    next();
  };
}

/**
 * API: Real-time market data
 * Price: 2 cents per request
 */
app.get('/api/market-data/:symbol', 
  requirePayment('Real-time market data', SERVER_CONFIG.pricing.marketData),
  async (req, res) => {
    const { symbol } = req.params;

    console.log(`📊 Delivering market data for ${symbol}`);

    // Generate mock market data
    const data = {
      symbol: symbol.toUpperCase(),
      price: Math.random() * 100000,
      change24h: (Math.random() - 0.5) * 10,
      volume24h: Math.random() * 50000000000,
      timestamp: Date.now(),
      source: 'Premium Market Data API'
    };

    // Release escrow (service delivered)
    await escrow.release(req.escrow.id, `Market data delivered: ${symbol}`);
    console.log(`💰 Escrow released: ${req.escrow.id}`);

    res.json(data);
  }
);

/**
 * API: Historical data download
 * Price: 5 cents per dataset
 */
app.get('/api/historical/:symbol/:timeframe',
  requirePayment('Historical data download', SERVER_CONFIG.pricing.historicalData),
  async (req, res) => {
    const { symbol, timeframe } = req.params;

    console.log(`📈 Delivering historical data: ${symbol} (${timeframe})`);

    const data = {
      symbol: symbol.toUpperCase(),
      timeframe,
      records: 10000, // Mock 10k data points
      startDate: '2020-01-01',
      endDate: '2025-12-31',
      format: 'CSV',
      downloadUrl: `https://cdn.example.com/data/${symbol}_${timeframe}.csv`,
      size: '2.5 MB'
    };

    await escrow.release(req.escrow.id, `Historical data delivered: ${symbol}`);
    console.log(`💰 Escrow released: ${req.escrow.id}`);

    res.json(data);
  }
);

/**
 * API: GPU compute rental
 * Price: 50 cents per minute
 */
app.post('/api/gpu-compute',
  requirePayment('GPU compute - 1 minute', SERVER_CONFIG.pricing.gpuCompute),
  async (req, res) => {
    const { task, model } = req.body;

    console.log(`🖥️  Running GPU compute task: ${task}`);

    // Simulate compute work
    const result = {
      task,
      model: model || 'default',
      status: 'completed',
      duration: 58.2, // seconds
      output: 'Model training complete. Accuracy: 94.2%',
      gpuType: 'NVIDIA RTX 3090',
      cost: SERVER_CONFIG.pricing.gpuCompute
    };

    await escrow.release(req.escrow.id, `GPU compute completed: ${task}`);
    console.log(`💰 Escrow released: ${req.escrow.id}`);

    res.json(result);
  }
);

/**
 * API: Code review service
 * Price: 10 cents per review
 */
app.post('/api/code-review',
  requirePayment('AI code review', SERVER_CONFIG.pricing.codeReview),
  async (req, res) => {
    const { code, language } = req.body;

    console.log(`🔍 Performing code review (${language})`);

    const review = {
      language: language || 'javascript',
      linesAnalyzed: code ? code.split('\n').length : 100,
      issues: [
        { severity: 'medium', line: 42, message: 'Variable name too short' },
        { severity: 'low', line: 87, message: 'Consider using const instead of let' }
      ],
      score: 8.5,
      suggestions: [
        'Add more comments',
        'Improve error handling',
        'Use async/await consistently'
      ],
      estimatedRefactorTime: '2 hours'
    };

    await escrow.release(req.escrow.id, 'Code review delivered');
    console.log(`💰 Escrow released: ${req.escrow.id}`);

    res.json(review);
  }
);

/**
 * API: Health check (free endpoint)
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    protocol: 'X402',
    services: Object.keys(SERVER_CONFIG.pricing),
    wallet: SERVER_CONFIG.wallet,
    network: 'polygon'
  });
});

/**
 * API: Pricing information (free endpoint)
 */
app.get('/pricing', (req, res) => {
  res.json({
    protocol: 'X402',
    currency: 'USDC',
    network: 'polygon',
    estimatedGas: 0.003, // USD
    services: [
      {
        name: 'Real-time market data',
        endpoint: '/api/market-data/:symbol',
        price: SERVER_CONFIG.pricing.marketData,
        description: 'Live crypto market data with sub-second latency'
      },
      {
        name: 'Historical data',
        endpoint: '/api/historical/:symbol/:timeframe',
        price: SERVER_CONFIG.pricing.historicalData,
        description: 'Full historical data exports (CSV format)'
      },
      {
        name: 'GPU compute',
        endpoint: '/api/gpu-compute',
        price: SERVER_CONFIG.pricing.gpuCompute,
        description: 'NVIDIA RTX 3090 compute rental (per minute)'
      },
      {
        name: 'Code review',
        endpoint: '/api/code-review',
        price: SERVER_CONFIG.pricing.codeReview,
        description: 'AI-powered code quality analysis'
      }
    ]
  });
});

/**
 * API: X402 statistics (free endpoint)
 */
app.get('/stats', (req, res) => {
  const stats = x402.getStats();
  const escrowStats = escrow.getStats();

  res.json({
    x402: stats,
    escrow: escrowStats,
    revenue: {
      total: stats.totalVolume,
      perTransaction: stats.avgTransaction,
      currency: 'USDC'
    }
  });
});

/**
 * Start server
 */
function startServer() {
  app.listen(SERVER_CONFIG.port, () => {
    console.log('='.repeat(60));
    console.log('🦪 X402 Payment Server Started');
    console.log('='.repeat(60));
    console.log(`\n📡 Server: http://localhost:${SERVER_CONFIG.port}`);
    console.log(`💰 Wallet: ${SERVER_CONFIG.wallet}`);
    console.log(`🌐 Network: Polygon`);
    console.log(`\n📊 Available Services:`);
    
    Object.entries(SERVER_CONFIG.pricing).forEach(([service, price]) => {
      console.log(`  • ${service}: ${price} USDC`);
    });

    console.log(`\n🔗 Endpoints:`);
    console.log(`  GET  /pricing - View all services and prices`);
    console.log(`  GET  /health  - Server health check`);
    console.log(`  GET  /stats   - X402 transaction statistics`);
    console.log(`  GET  /api/market-data/:symbol - Real-time data (paid)`);
    console.log(`  GET  /api/historical/:symbol/:timeframe - Historical data (paid)`);
    console.log(`  POST /api/gpu-compute - GPU rental (paid)`);
    console.log(`  POST /api/code-review - Code review (paid)`);

    console.log(`\n💡 Test with:`);
    console.log(`  curl http://localhost:${SERVER_CONFIG.port}/pricing`);
    console.log(`  node examples/x402-client-example.js`);
    console.log('\n' + '='.repeat(60));
  });
}

// Run server if executed directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
