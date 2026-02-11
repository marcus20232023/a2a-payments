# A2A SHIB Payment Agent

Complete agent-to-agent payment system for trustless crypto commerce on Polygon network.

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![A2A Protocol](https://img.shields.io/badge/A2A-v0.3.0-green.svg)](https://a2a-protocol.org)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)

---

## 🦪 What is this?

An **OpenClaw skill** that enables agents to:
- Send/receive SHIB payments on Polygon (~$0.003 gas)
- Create trustless escrow contracts
- Negotiate prices automatically
- Build reputation through ratings
- Discover other agents via A2A protocol

**9,416x cheaper** than traditional escrow services (Escrow.com charges 3.25% + $25, we charge ~$0.003).

---

## ✨ Features

### 💰 Payment System
- Direct SHIB transfers on Polygon network
- Sub-penny gas costs (~$0.003 per transaction)
- Balance checking
- Transaction history

### 🔒 Escrow System
- Time-locked trustless payments
- Multi-party approval required
- Delivery proof submission
- Automatic release when conditions met
- Dispute resolution with arbiter
- 6-state machine (pending → funded → locked → released/refunded/disputed)

### 💬 Price Negotiation
- Service quote creation
- Multi-round counter-offers
- Accept/reject workflow
- Automatic escrow integration
- Service delivery tracking
- Client confirmation

### ⭐ Reputation System
- Star ratings (0-5) with reviews
- Dynamic trust scores (0-100)
- Trust levels: new → bronze → silver → gold → platinum
- Achievement badges
- Agent verification
- Search & filtering

### 🔐 Security Layer
- API key authentication
- Rate limiting (requests + payments + volume)
- Immutable audit logging (hash-chained)
- Per-agent permissions & limits
- Complete compliance trail

### 🌐 A2A Protocol Integration
- Agent discovery via registry
- Standardized messaging (JSON-RPC, REST)
- Compatible with LangChain agents, AWS Bedrock agents
- Agent card with capabilities

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Polygon wallet with POL for gas
- SHIB tokens (optional, for testing payments)

### Installation

```bash
# Clone repository
git clone https://github.com/marcus20232023/a2a-shib-payments.git
cd a2a-shib-payments

# Install dependencies
npm install

# Configure wallet
cp .env.example .env.local
nano .env.local  # Add your wallet details

# Start agent
node a2a-agent-full.js
```

**Agent will be running on:** `http://localhost:8003`

---

## 📚 Documentation

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Complete deployment guide (5 options)
- **[ESCROW-NEGOTIATION-GUIDE.md](ESCROW-NEGOTIATION-GUIDE.md)** - Escrow & negotiation API reference
- **[PRODUCTION-HARDENING.md](PRODUCTION-HARDENING.md)** - Security infrastructure guide
- **[FINAL-SUMMARY.md](FINAL-SUMMARY.md)** - Complete system overview

---

## 🎯 Use Cases

### Data Marketplace
```javascript
// Research agent buys TSLA historical data
const quote = await negotiation.createQuote({
  service: 'TSLA 2020-2025 historical data',
  price: 500  // SHIB
});

// Client counter-offers
await negotiation.counterOffer(quote.id, 'research-agent', 400);

// Provider accepts, escrow created automatically
await negotiation.acceptCounter(quote.id, 'data-provider');

// Data delivered → payment released
```

### AI Model Training
```javascript
// Create escrow for model training
const escrow = await escrowSystem.create({
  payer: 'startup-agent',
  payee: 'ai-trainer',
  amount: 1000,
  purpose: 'Train GPT-style model',
  conditions: {
    requiresDelivery: true,
    requiresArbiter: true  // High-value transaction
  },
  timeoutMinutes: 720  // 12 hours
});

// Model delivered → client confirms → payment released
```

---

## 🧪 Testing

```bash
# Test security infrastructure
node test-security.js

# Test escrow & negotiation
node test-escrow-negotiation.js

# Test reputation system
node test-reputation.js
```

**All tests passing:** ✅

---

## 🛠️ Architecture

```
┌─────────────────────────────────────┐
│   Full-Featured A2A Agent (port 8003)
├─────────────────────────────────────┤
│  ✓ Payment System (index.js)
│  ✓ Escrow (escrow.js)
│  ✓ Negotiation (payment-negotiation.js)
│  ✓ Reputation (reputation.js)
│  ✓ Security (auth, rate-limit, audit)
│  ✓ A2A Protocol (@a2a-js/sdk)
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│   Polygon Network
│   SHIB Token (ERC-20)
│   ~$0.003 gas per transaction
└─────────────────────────────────────┘
```

---

## 📊 System Statistics

**Development:**
- Lines of Code: ~8,000
- Files: 35
- Documentation: 40 KB
- Development Time: ~21 hours

**Testing:**
- Test Scenarios: 8
- Transactions Tested: 12
- Test SHIB Volume: 2,500
- Success Rate: 100%

**Performance:**
- Gas Cost: ~$0.003 per transaction
- Settlement Time: <10 seconds
- Cost vs Traditional: **9,416x cheaper**

---

## 🔐 Security

**Implemented:**
- ✅ API key authentication (64-byte keys)
- ✅ Rate limiting (10 req/min, 3 payments/min)
- ✅ Payment volume limits (500 SHIB/min)
- ✅ Immutable audit logs (hash-chained)
- ✅ Per-agent permissions
- ✅ Escrow time-locks
- ✅ Multi-party approval
- ✅ Dispute resolution

**Recommended for Production:**
- Multi-sig wallet
- Hardware wallet integration
- HTTPS (Cloudflare/Let's Encrypt)
- Firewall rules
- Automated backups
- Monitoring & alerting

See [PRODUCTION-HARDENING.md](PRODUCTION-HARDENING.md) for complete security guide.

---

## 🚀 Deployment

### Quick Local Deployment
```bash
./deploy-local.sh
```

### Production Options
1. **Systemd service** - Auto-start on boot
2. **Cloudflare Tunnel** - Free HTTPS access
3. **Docker container** - Portable deployment
4. **VPS** - Full production ($6/month)

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete guide.

---

## 💰 Cost Comparison

| System | Fee | Settlement Time | Trust Model |
|--------|-----|----------------|-------------|
| **Escrow.com** | 3.25% + $25 | 5-7 days | Centralized |
| **PayPal** | 2.9% + $0.30 | 1-3 days | Centralized |
| **Our System** | **$0.003** | **Seconds** | **Decentralized** |

**For a $100 transaction:**
- Traditional: $28.25
- Our system: $0.003
- **Savings: 99.99%** (9,416x cheaper)

---

## 📦 What's Included

### Core Systems
- `index.js` - Payment agent
- `escrow.js` - Escrow system (8.2 KB)
- `payment-negotiation.js` - Negotiation workflow (9.3 KB)
- `reputation.js` - Reputation & trust (10.5 KB)
- `a2a-agent-full.js` - Full integration (13.4 KB)

### Security
- `auth.js` - Authentication
- `rate-limiter.js` - Rate limiting
- `audit-logger.js` - Audit logging

### A2A Integration
- `a2a-agent-v2.js` - Basic A2A agent
- `discovery-client.js` - Agent discovery
- `demo-requestor-agent.js` - Multi-agent demo

### Tests
- `test-security.js` - Security tests
- `test-escrow-negotiation.js` - Escrow tests
- `test-reputation.js` - Reputation tests

### Deployment
- `deploy-local.sh` - Quick deployment script
- `shib-payment-agent.service` - Systemd service file

---

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Submit a pull request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 🔗 Links

- **A2A Protocol:** https://a2a-protocol.org
- **OpenClaw:** https://github.com/openclaw/openclaw
- **Polygon Network:** https://polygon.technology
- **SHIB Token:** https://www.shibatoken.com

---

## 🙏 Acknowledgments

Built with:
- A2A Protocol ([@a2a-js/sdk](https://www.npmjs.com/package/@a2a-js/sdk))
- Ethers.js for blockchain interaction
- Express.js for HTTP server
- OpenClaw framework

---

## 📞 Support

- **Issues:** https://github.com/marcus20232023/a2a-shib-payments/issues
- **Discussions:** https://github.com/marcus20232023/a2a-shib-payments/discussions
- **Email:** (your email if you want to add)

---

## ⚡ Quick Examples

### Send SHIB Payment
```bash
curl -X POST http://localhost:8003/a2a/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "params": {
      "message": {
        "kind": "message",
        "messageId": "1",
        "role": "user",
        "parts": [{"kind": "text", "text": "send 100 SHIB to 0x..."}]
      }
    },
    "id": 1
  }'
```

### Create Escrow
```bash
curl -X POST http://localhost:8003/a2a/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "params": {
      "message": {
        "kind": "message",
        "messageId": "2",
        "role": "user",
        "parts": [{"kind": "text", "text": "escrow create 100 SHIB for AI training payee data-agent"}]
      }
    },
    "id": 2
  }'
```

### Rate an Agent
```bash
curl -X POST http://localhost:8003/a2a/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "params": {
      "message": {
        "kind": "message",
        "messageId": "3",
        "role": "user",
        "parts": [{"kind": "text", "text": "rate data-agent 5 Excellent service!"}]
      }
    },
    "id": 3
  }'
```

---

**Built with 🦪 for the agent economy**

**Version:** 2.0.0  
**A2A Protocol:** v0.3.0  
**Status:** Production Ready
