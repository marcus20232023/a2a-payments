# X402 Protocol Integration Guide

**HTTP 402 "Payment Required" for Agent-to-Agent Commerce**

---

## Table of Contents

1. [What is X402?](#what-is-x402)
2. [Why X402 Matters](#why-x402-matters)
3. [How It Works](#how-it-works)
4. [Client Integration](#client-integration)
5. [Server Integration](#server-integration)
6. [Escrow Integration](#escrow-integration)
7. [Use Cases](#use-cases)
8. [Comparison with Traditional APIs](#comparison-with-traditional-apis)
9. [Security Considerations](#security-considerations)
10. [Roadmap](#roadmap)

---

## What is X402?

X402 is a protocol for machine-to-machine micropayments using the HTTP 402 "Payment Required" status code. It enables AI agents to automatically pay for services without human intervention.

### The Protocol Flow

```
┌──────────┐                           ┌──────────┐
│  Client  │                           │  Server  │
│  Agent   │                           │  Agent   │
└────┬─────┘                           └────┬─────┘
     │                                      │
     │  1. GET /api/data                    │
     │─────────────────────────────────────>│
     │                                      │
     │  2. HTTP 402 Payment Required        │
     │  Headers: X-Payment-Amount: 0.02     │
     │           X-Payment-Token: USDC      │
     │           X-Payment-Address: 0x...   │
     │<─────────────────────────────────────│
     │                                      │
     │  3. Create Escrow & Pay              │
     │  (Blockchain transaction)            │
     │                                      │
     │  4. GET /api/data                    │
     │  Headers: X-Payment-Proof: {...}     │
     │─────────────────────────────────────>│
     │                                      │
     │  5. HTTP 200 OK                      │
     │  Body: { data: "..." }               │
     │<─────────────────────────────────────│
     │                                      │
     │  6. Release Escrow                   │
     │  (Automatic on successful delivery)  │
     │                                      │
```

### Key Features

- ✅ **Automatic**: Agents handle payments without human intervention
- ✅ **Trustless**: Escrow ensures both parties are protected
- ✅ **Micropayments**: Optimized for sub-dollar transactions
- ✅ **Low Cost**: ~$0.003 gas on Polygon (vs $5-20 on Ethereum)
- ✅ **Fast**: Settlement in seconds, not days
- ✅ **Standardized**: Built on HTTP 402 standard

---

## Why X402 Matters

### Market Opportunity

**Current X402 Market:**
- 📊 **$600M** annualized volume
- 🔢 **38M** transactions
- 💰 **$0.06** average per transaction
- 🌐 **Growing fast** - machines paying machines

**Real-World Use Cases:**
- Data feeds: 2¢ per request
- Research papers: 3¢ per download
- GPU compute: 50¢ per minute
- Web scraping: pay-per-crawl
- Agent services: translation, code review, analysis

### Why Traditional APIs Don't Work

| Challenge | Traditional API | X402 Protocol |
|-----------|----------------|---------------|
| **Setup** | API keys, contracts, billing | Instant, automatic |
| **Minimum** | $10-100/month | Pay per request |
| **Trust** | Centralized provider | Decentralized escrow |
| **Speed** | Monthly billing | Real-time settlement |
| **Agents** | Manual integration | Native machine-to-machine |

**Example:** An AI agent wants to buy ONE research paper ($0.03). Traditional systems require monthly subscriptions ($50+). X402 charges exactly 3 cents.

---

## How It Works

### For Clients (Paying for Services)

1. **Request resource** → Server returns HTTP 402
2. **Parse payment details** from response headers
3. **Create escrow** with required amount
4. **Retry request** with payment proof
5. **Receive content** → Escrow auto-releases

### For Servers (Selling Services)

1. **Check for payment** in request headers
2. **No payment?** → Return HTTP 402 with pricing
3. **Verify payment** from escrow proof
4. **Deliver content** to client
5. **Release escrow** → Receive funds

### Payment Headers (Client → Server)

```http
X-Payment-Proof: {"escrowId":"x402_abc123","txHash":"0x...","amount":0.02}
X-Payment-Escrow-Id: x402_abc123
X-Payment-TxHash: 0x1234567890abcdef...
```

### Payment Required Headers (Server → Client)

```http
HTTP/1.1 402 Payment Required
X-Payment-Amount: 0.02
X-Payment-Token: USDC
X-Payment-Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
X-Payment-Escrow-Id: server-escrow-123
X-Payment-Description: Real-time BTC market data
Content-Type: application/json
```

---

## Client Integration

### Basic Client Example

```javascript
const { X402Handler } = require('./x402-handler');
const { EscrowSystem } = require('./escrow');

// Initialize
const escrow = new EscrowSystem();
const x402 = new X402Handler(escrow, {
  autoRelease: true,
  defaultTimeout: 300 // 5 minutes
});

// Make request
const response = await fetch('https://api.example.com/data', {
  headers: { 'X-Agent-Wallet': agentWallet }
});

// Handle 402 automatically
if (response.status === 402) {
  const paidResponse = await x402.handlePaymentRequired(
    response,
    {
      url: 'https://api.example.com/data',
      method: 'GET',
      headers: { 'X-Agent-Wallet': agentWallet }
    },
    { agentId: 'my-agent', wallet: agentWallet }
  );
  
  const data = await paidResponse.json();
  console.log('Data received:', data);
}
```

### Advanced Client Features

**Batch Requests:**
```javascript
const symbols = ['BTC', 'ETH', 'SOL'];

for (const symbol of symbols) {
  const response = await fetch(`https://api.example.com/data/${symbol}`);
  
  if (response.status === 402) {
    const paid = await x402.handlePaymentRequired(response, ...);
    const data = await paid.json();
    results.push({ symbol, data });
  }
}

console.log(`Total cost: ${symbols.length * 0.02} USDC`);
```

**Error Handling:**
```javascript
try {
  const paid = await x402.handlePaymentRequired(response, request, agent);
  return await paid.json();
} catch (error) {
  console.error('Payment failed:', error.message);
  // Escrow will auto-refund after timeout
}
```

**Custom Timeout:**
```javascript
const x402 = new X402Handler(escrow, {
  defaultTimeout: 600, // 10 minutes for slower services
  maxRetries: 5,
  retryDelay: 2000
});
```

---

## Server Integration

### Basic Server Example

```javascript
const express = require('express');
const { X402Handler } = require('./x402-handler');
const { EscrowSystem } = require('./escrow');

const app = express();
const escrow = new EscrowSystem();
const x402 = new X402Handler(escrow);

// Middleware: Require payment
function requirePayment(price, description) {
  return async (req, res, next) => {
    const proof = req.headers['x-payment-proof'];
    const escrowId = req.headers['x-payment-escrow-id'];
    
    // No payment? Return 402
    if (!proof || !escrowId) {
      const response = x402.requirePayment(
        price,
        'USDC',
        SERVER_WALLET,
        description
      );
      
      return res.status(402)
        .set(response.headers)
        .json(response.body);
    }
    
    // Verify payment
    const verification = await x402.verifyPaymentProof(req.headers, price);
    
    if (!verification.valid) {
      return res.status(402).json({ error: verification.error });
    }
    
    req.escrow = verification.escrow;
    next();
  };
}

// Paid endpoint
app.get('/api/premium-data',
  requirePayment(0.05, 'Premium market data'),
  async (req, res) => {
    // Deliver content
    const data = { /* your data */ };
    res.json(data);
    
    // Release escrow
    await escrow.release(req.escrow.id, 'Data delivered');
  }
);

app.listen(8402);
```

### Pricing Tiers

```javascript
const PRICING = {
  basic: 0.01,      // 1 cent
  standard: 0.05,   // 5 cents
  premium: 0.10,    // 10 cents
  enterprise: 0.50  // 50 cents
};

app.get('/api/data/:tier',
  (req, res, next) => {
    const price = PRICING[req.params.tier] || PRICING.basic;
    requirePayment(price, `${req.params.tier} data access`)(req, res, next);
  },
  async (req, res) => {
    const data = getDataForTier(req.params.tier);
    res.json(data);
    await escrow.release(req.escrow.id);
  }
);
```

### Free Endpoints (No Payment)

```javascript
// Health check (free)
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Pricing info (free)
app.get('/pricing', (req, res) => {
  res.json({
    protocol: 'X402',
    currency: 'USDC',
    services: [
      { name: 'Basic', price: 0.01 },
      { name: 'Premium', price: 0.05 }
    ]
  });
});
```

---

## Escrow Integration

### X402-Specific Escrow Methods

**Create X402 Escrow:**
```javascript
const escrow = escrowSystem.createX402Escrow(
  {
    recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    amount: 0.02,
    token: 'USDC',
    description: 'Market data request'
  },
  {
    payer: 'agent-001',
    autoRelease: true,
    timeoutMinutes: 5
  }
);
```

**Verify Payment:**
```javascript
const verification = escrowSystem.verifyX402Payment(escrowId, 0.02);

if (verification.valid) {
  // Deliver content
  await escrowSystem.releaseX402(escrowId, 'Content delivered');
}
```

**Auto-Release on Timeout:**
```javascript
// Escrow auto-refunds after 5 minutes if not released
// No manual intervention needed
setInterval(() => {
  escrowSystem.processTimeouts();
}, 60000); // Check every minute
```

### Escrow States

```
pending → funded → locked → released ✅
                         ↘ refunded  🔄
                         ↘ disputed  ⚠️
```

---

## Use Cases

### 1. Data Marketplace

**Scenario:** Research agent needs historical stock data

```javascript
// Client
const data = await fetchWithPayment('https://data-api.com/stocks/TSLA/2020-2025');
// Cost: 5 cents, delivered in 2 seconds

// Server charges
requirePayment(0.05, 'TSLA 2020-2025 historical data')
```

**Market:** Millions of agents buying/selling data feeds

### 2. GPU Compute Rental

**Scenario:** AI training agent rents GPU time

```javascript
// Client
const result = await fetch('https://gpu-api.com/train', {
  method: 'POST',
  body: JSON.stringify({ model: 'gpt-mini', duration: 60 })
});
// Cost: 50 cents per minute

// Server charges
requirePayment(0.50 * minutes, `GPU compute - ${minutes} minutes`)
```

**Market:** Pay-per-minute compute (no monthly contracts)

### 3. Agent Services

**Scenario:** Code review agent analyzes pull request

```javascript
// Client
const review = await fetch('https://code-review-agent.com/analyze', {
  method: 'POST',
  body: JSON.stringify({ repo: 'owner/repo', pr: 123 })
});
// Cost: 10 cents per review

// Server charges
requirePayment(0.10, 'AI code review service')
```

**Market:** Freelance AI agents offering services

### 4. Web Scraping API

**Scenario:** Research agent needs scraped data from website

```javascript
// Client
const scraped = await fetch('https://scraper.com/crawl', {
  method: 'POST',
  body: JSON.stringify({ url: 'https://example.com' })
});
// Cost: 3 cents per page

// Server charges
requirePayment(0.03 * pages, `Scrape ${pages} pages`)
```

**Market:** Pay-per-crawl (vs expensive monthly plans)

---

## Comparison with Traditional APIs

### Cost Comparison (for $100 transaction)

| System | Fee | Time | Trust |
|--------|-----|------|-------|
| **Credit Card** | $2.90 + $0.30 = $3.20 | Instant | Centralized |
| **PayPal** | 2.9% + $0.30 = $3.20 | 1-3 days | Centralized |
| **Escrow.com** | 3.25% + $25 = $28.25 | 5-7 days | Centralized |
| **X402 (Our System)** | **$0.003 gas** | **Seconds** | **Trustless** |

**Savings:** 99.99% cheaper than traditional escrow

### API Comparison

| Feature | Stripe API | X402 Protocol |
|---------|-----------|---------------|
| **Setup time** | Days (account, verification) | Instant |
| **Minimum charge** | $0.50 | $0.001 |
| **Monthly fee** | None (but % fees) | None |
| **Per-transaction** | 2.9% + $0.30 | ~$0.003 gas |
| **Settlement** | 2-7 days | Seconds |
| **Chargebacks** | Yes (risky for sellers) | No (trustless) |
| **Agent-native** | ❌ Needs bank account | ✅ Wallet only |

**For 1¢ transaction:**
- Stripe: $0.01 + $0.30 + 2.9% = $0.31 (3,100% markup!)
- X402: $0.01 + $0.003 = $0.013 (30% markup)

---

## Security Considerations

### Client Security

✅ **Verify server identity** before payment
```javascript
// Check SSL certificate
if (!url.startsWith('https://')) {
  throw new Error('Insecure server');
}

// Verify wallet address from trusted registry
if (!trustedWallets.includes(paymentInfo.recipient)) {
  console.warn('Unknown recipient wallet');
}
```

✅ **Set payment limits**
```javascript
const MAX_PAYMENT = 1.00; // $1 max per transaction

if (paymentInfo.amount > MAX_PAYMENT) {
  throw new Error(`Payment too high: ${paymentInfo.amount}`);
}
```

✅ **Monitor spending**
```javascript
const dailySpending = calculateDailySpending();

if (dailySpending > DAILY_LIMIT) {
  throw new Error('Daily spending limit reached');
}
```

### Server Security

✅ **Verify escrow on-chain**
```javascript
// Don't trust client headers alone
const escrow = await blockchain.getEscrow(escrowId);

if (!escrow || escrow.amount < requiredAmount) {
  return res.status(402).json({ error: 'Payment not verified' });
}
```

✅ **Rate limiting**
```javascript
const rateLimit = require('express-rate-limit');

app.use('/api/', rateLimit({
  windowMs: 60000, // 1 minute
  max: 100 // 100 requests per minute
}));
```

✅ **Audit logging**
```javascript
// Log all X402 transactions
auditLog.record({
  type: 'x402-payment',
  escrowId,
  amount,
  service,
  client: req.ip,
  timestamp: Date.now()
});
```

### Escrow Security

✅ **Time-locks** prevent indefinite holds
✅ **Multi-party approval** for high-value transactions
✅ **Dispute resolution** via arbiter
✅ **Automatic refunds** on timeout

---

## Roadmap

### Phase 1: Core Protocol ✅ (Current)

- ✅ X402 handler with escrow integration
- ✅ Client and server examples
- ✅ Auto-release on delivery
- ✅ Timeout handling
- ✅ Payment verification

### Phase 2: Enhanced Features 🚧 (Q1 2026)

- [ ] Multi-token support (SHIB, POL, DAI)
- [ ] Batch payment optimization
- [ ] WebSocket real-time notifications
- [ ] Payment channels (reduce gas)
- [ ] Subscription support

### Phase 3: Ecosystem 🔮 (Q2 2026)

- [ ] Agent marketplace integration
- [ ] Reputation-based pricing
- [ ] Automatic price negotiation
- [ ] Cross-chain payments (Ethereum, BSC)
- [ ] Insurance pool for escrows

### Phase 4: Enterprise 🔮 (Q3 2026)

- [ ] SLA monitoring
- [ ] Advanced analytics
- [ ] Compliance reporting
- [ ] Enterprise SSO integration
- [ ] White-label deployment

---

## FAQ

### How is this different from APIs with API keys?

**API Keys:** Require signup, billing, monthly minimums, and trust in provider.
**X402:** Instant, per-request, trustless, agent-native.

### What happens if the server never delivers content?

Escrow has a timeout (default 5 minutes). If content isn't delivered, funds auto-refund to client.

### Can I use X402 with any token?

Currently USDC and SHIB. Multi-token support coming in Phase 2.

### What if I don't have a wallet?

You need a crypto wallet to use X402. Create one with MetaMask, Trust Wallet, or similar.

### Is this compatible with existing payment APIs?

X402 is a NEW protocol for agent commerce. It's not a drop-in replacement for Stripe/PayPal. It's designed for machine-to-machine micropayments where traditional APIs don't work well.

### What are the gas costs?

On Polygon: ~$0.003 per transaction. On Ethereum: $5-20. We recommend Polygon for micropayments.

### Can humans use this too?

Technically yes, but it's optimized for automated agent workflows. Humans typically prefer traditional checkout flows.

---

## Getting Started

### 1. Clone Repository

```bash
git clone https://github.com/marcus20232023/a2a-payments.git
cd a2a-payments
npm install
```

### 2. Run Client Example

```bash
node examples/x402-client-example.js
```

### 3. Run Server Example

```bash
node examples/x402-server-example.js
# Server starts on http://localhost:8402
```

### 4. Test Integration

```bash
# Terminal 1: Start server
node examples/x402-server-example.js

# Terminal 2: Run client
node examples/x402-client-example.js
```

---

## Support

- **📖 Documentation:** [/docs](../docs/)
- **🐛 Issues:** [GitHub Issues](https://github.com/marcus20232023/a2a-payments/issues)
- **💬 Discussions:** [GitHub Discussions](https://github.com/marcus20232023/a2a-payments/discussions)
- **📧 Contact:** Open an issue or discussion

---

## License

MIT License - See [LICENSE](../LICENSE)

---

**Built for the agent economy. Powered by X402 protocol.**

🦪💰
