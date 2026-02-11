# SHIB Payments Skill

Send and receive SHIB (Shiba Inu) tokens on Polygon using A2A protocol.

## Quick Start

### 1. Install Dependencies
```bash
cd skills/shib-payments
npm install
```

### 2. Configure Wallet
```bash
# Add to ~/.env.local
POLYGON_RPC=https://polygon-rpc.com
POLYGON_PRIVATE_KEY=0xYourPrivateKey
POLYGON_WALLET_ADDRESS=0xYourWalletAddress
```

### 3. Test Balance
```bash
node index.js balance
```

### 4. Send Payment
```bash
node index.js send 0xRecipientAddress 1000
```

## Usage from OpenClaw

The agent can call this skill when you request SHIB payments:

```
You: Send 1000 SHIB to 0x1234...
Agent: *calls skill* Sent 1000 SHIB, tx: 0xabc...

You: What's my SHIB balance?
Agent: *calls skill* You have 50,000 SHIB on Polygon

You: Send $5 worth of SHIB to Alice
Agent: *calculates current SHIB price* *calls skill* Sent 400,000 SHIB (~$5)
```

## Configuration

- **Network:** Polygon (eip155:137)
- **SHIB Contract:** 0x6f8a06447ff6fcf75d803135a7de15ce88c1d4ec
- **Gas Token:** POL
- **Avg Gas Cost:** ~$0.004 per transaction

## Security

- Never commit private keys
- Use hardware wallet for production
- Test on Polygon Amoy testnet first
- Set gas limits to prevent runaway costs

## Troubleshooting

**"Insufficient POL for gas"**
- Get POL from exchange or DEX
- Minimum: 0.1 POL for 20+ transactions

**"SHIB balance too low"**
- Bridge from Ethereum: https://portal.polygon.technology/bridge
- Or swap on QuickSwap

See full guide: `/home/marc/clawd/docs/a2a-shib-payments-guide.md`
