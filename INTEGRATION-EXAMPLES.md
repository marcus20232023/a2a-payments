# Integration Examples

This document shows how to integrate the A2A SHIB Payment Agent with popular AI agent frameworks.

---

## 🔌 WebSocket Real-Time Updates

### Server Startup

```bash
# Start WebSocket server (runs alongside REST API)
npm run start:ws

# Server will start on ws://localhost:8004
# REST API available at http://localhost:8004
```

### Getting Started - Node.js Client

```javascript
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

// 1. Generate authentication token
const token = jwt.sign(
  { sub: 'user123', agentId: 'agent-456' },
  'your-secret-key',
  { expiresIn: '24h' }
);

// 2. Connect to WebSocket server
const ws = new WebSocket('ws://localhost:8004');

ws.on('open', () => {
  console.log('Connected to A2A WebSocket server');

  // 3. Authenticate
  ws.send(JSON.stringify({
    type: 'auth',
    token
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString('utf8'));
  
  switch (message.type) {
    case 'auth':
      if (message.status === 'success') {
        console.log('Authenticated! User:', message.userId);
        
        // 4. Subscribe to updates
        ws.send(JSON.stringify({
          type: 'subscribe',
          channel: 'escrow',
          id: 'esc_12345'
        }));
      }
      break;

    case 'subscribed':
      console.log(`Subscribed to ${message.channel}:${message.id}`);
      console.log('Recent events:', message.recentEvents);
      break;

    case 'update':
      console.log('Received update:', message.data);
      break;

    case 'error':
      console.error('Error:', message.message);
      break;
  }
});

ws.on('close', () => {
  console.log('Disconnected from WebSocket server');
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});
```

### Getting Authentication Token (REST API)

```bash
# Generate token via REST API
curl -X POST http://localhost:8004/api/ws/token \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "agentId": "agent-456"
  }'

# Response:
# {
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "expiresIn": "24h",
#   "wsUrl": "ws://localhost:8004"
# }
```

### Browser Client (Web Dashboard)

```html
<!DOCTYPE html>
<html>
<head>
  <title>A2A Escrow Dashboard</title>
</head>
<body>
  <h1>Real-Time Escrow Updates</h1>
  <div id="status">Connecting...</div>
  <div id="escrows"></div>

  <script>
    class EscrowDashboard {
      constructor(wsUrl, token) {
        this.ws = new WebSocket(wsUrl);
        this.token = token;
        this.escrows = new Map();

        this.ws.addEventListener('open', () => this.onOpen());
        this.ws.addEventListener('message', (e) => this.onMessage(e));
        this.ws.addEventListener('error', (e) => this.onError(e));
        this.ws.addEventListener('close', () => this.onClose());
      }

      onOpen() {
        console.log('Connected to WebSocket server');
        this.updateStatus('Authenticating...');
        
        this.send({
          type: 'auth',
          token: this.token
        });
      }

      onMessage(event) {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'auth':
            if (message.status === 'success') {
              this.updateStatus('Connected & Authenticated');
              this.subscribeToEscrows();
            } else {
              this.updateStatus('Authentication failed');
            }
            break;

          case 'subscribed':
            console.log(`Subscribed to ${message.channel}:${message.id}`);
            this.updateStatus('Subscribed');
            break;

          case 'update':
            this.onEscrowUpdate(message.data);
            break;

          case 'error':
            this.updateStatus('Error: ' + message.message);
            break;
        }
      }

      onError(error) {
        console.error('WebSocket error:', error);
        this.updateStatus('Connection error');
      }

      onClose() {
        this.updateStatus('Disconnected');
      }

      subscribeToEscrows() {
        // Subscribe to multiple escrows
        const escrowIds = ['esc_abc123', 'esc_def456', 'esc_ghi789'];
        
        for (const escrowId of escrowIds) {
          this.send({
            type: 'subscribe',
            channel: 'escrow',
            id: escrowId
          });
        }
      }

      onEscrowUpdate(data) {
        this.escrows.set(data.escrowId, data);
        this.renderEscrows();
      }

      renderEscrows() {
        const html = Array.from(this.escrows.entries())
          .map(([id, data]) => `
            <div style="border: 1px solid #ccc; padding: 10px; margin: 5px;">
              <h3>${id}</h3>
              <p>State: <strong>${data.state}</strong></p>
              <p>Amount: ${data.amount} SHIB</p>
              <p>Updated: ${new Date(data.timestamp).toLocaleTimeString()}</p>
            </div>
          `)
          .join('');

        document.getElementById('escrows').innerHTML = html;
      }

      updateStatus(status) {
        document.getElementById('status').textContent = status;
      }

      send(message) {
        this.ws.send(JSON.stringify(message));
      }
    }

    // Start dashboard
    const token = 'YOUR_TOKEN_HERE';
    const dashboard = new EscrowDashboard('ws://localhost:8004', token);
  </script>
</body>
</html>
```

### Python Client

```python
import asyncio
import json
import websockets
import jwt

class A2AWebSocketClient:
    def __init__(self, url, token):
        self.url = url
        self.token = token
        self.ws = None

    async def connect(self):
        """Connect to WebSocket server"""
        self.ws = await websockets.connect(self.url)
        print(f"Connected to {self.url}")

    async def authenticate(self):
        """Send authentication token"""
        await self.send({
            'type': 'auth',
            'token': self.token
        })

    async def subscribe(self, channel, id):
        """Subscribe to channel updates"""
        await self.send({
            'type': 'subscribe',
            'channel': channel,
            'id': id
        })

    async def send(self, message):
        """Send message to server"""
        await self.ws.send(json.dumps(message))

    async def receive_updates(self, handler):
        """Listen for updates"""
        async for message in self.ws:
            data = json.loads(message)
            await handler(data)

    async def close(self):
        """Close connection"""
        await self.ws.close()

# Usage
async def main():
    # Generate token
    token = jwt.encode(
        {'sub': 'user123', 'agentId': 'agent-456'},
        'your-secret-key',
        algorithm='HS256'
    )

    # Create client
    client = A2AWebSocketClient('ws://localhost:8004', token)
    await client.connect()
    await client.authenticate()
    
    # Subscribe to escrow updates
    await client.subscribe('escrow', 'esc_abc123')

    # Handle updates
    async def handle_message(msg):
        print(f"Received: {msg['type']}")
        if msg['type'] == 'update':
            print(f"Escrow {msg['id']} state: {msg['data']['state']}")

    try:
        await client.receive_updates(handle_message)
    except KeyboardInterrupt:
        await client.close()

asyncio.run(main())
```

### LangChain Agent with WebSocket Monitoring

```python
from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain.tools import Tool
from langchain_openai import ChatOpenAI
import asyncio
import json
import websockets

class A2AMonitor:
    def __init__(self, token):
        self.token = token
        self.escrow_updates = {}

    async def monitor_escrow(self, escrow_id):
        """Monitor escrow updates in background"""
        async with websockets.connect('ws://localhost:8004') as ws:
            # Authenticate
            await ws.send(json.dumps({
                'type': 'auth',
                'token': self.token
            }))
            
            # Subscribe
            await ws.send(json.dumps({
                'type': 'subscribe',
                'channel': 'escrow',
                'id': escrow_id
            }))

            # Listen for updates
            async for message in ws:
                data = json.loads(message)
                if data['type'] == 'update':
                    self.escrow_updates[escrow_id] = data['data']
                    print(f"Escrow {escrow_id}: {data['data']['state']}")

# Create monitor
monitor = A2AMonitor(token)

# Tool for LangChain
def create_escrow_and_monitor(amount: str, payee: str) -> str:
    """Create escrow and monitor updates via WebSocket"""
    # Create escrow via REST API
    response = requests.post(
        'http://localhost:8003/a2a/jsonrpc',
        json={
            'jsonrpc': '2.0',
            'method': 'message/send',
            'params': {
                'message': {
                    'kind': 'message',
                    'parts': [{
                        'kind': 'text',
                        'text': f'escrow create {amount} SHIB payee {payee}'
                    }]
                }
            },
            'id': 1
        }
    )
    
    escrow_id = response.json()['result']['escrow_id']
    
    # Monitor in background
    asyncio.create_task(monitor.monitor_escrow(escrow_id))
    
    return f"Created escrow {escrow_id}, monitoring updates..."

# Add to LangChain agent
escrow_tool = Tool(
    name="create_and_monitor_escrow",
    func=create_escrow_and_monitor,
    description="Create escrow and monitor real-time updates"
)
```

### Real-Time Price Feed Subscription

```javascript
class PriceFeedSubscriber {
  constructor(wsUrl, token, assets = ['SHIB', 'ETH', 'BTC']) {
    this.wsUrl = wsUrl;
    this.token = token;
    this.assets = assets;
    this.prices = new Map();
  }

  connect() {
    this.ws = new WebSocket(this.wsUrl);

    this.ws.on('open', () => {
      this.authenticate();
    });

    this.ws.on('message', (data) => {
      const msg = JSON.parse(data.toString('utf8'));
      
      if (msg.type === 'auth' && msg.status === 'success') {
        this.subscribeToAssets();
      } else if (msg.type === 'update' && msg.channel === 'prices') {
        this.onPriceUpdate(msg.data);
      }
    });
  }

  authenticate() {
    this.ws.send(JSON.stringify({
      type: 'auth',
      token: this.token
    }));
  }

  subscribeToAssets() {
    for (const asset of this.assets) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        channel: 'prices',
        id: asset
      }));
    }
  }

  onPriceUpdate(data) {
    this.prices.set(data.assetId, {
      price: data.price,
      change: data.change,
      timestamp: data.timestamp
    });

    console.log(`${data.assetId}: $${data.price} (${data.change}%)`);
  }

  getCurrentPrices() {
    return Object.fromEntries(this.prices);
  }
}

// Usage
const subscriber = new PriceFeedSubscriber(
  'ws://localhost:8004',
  token,
  ['SHIB', 'ETH', 'BTC', 'USDC']
);
subscriber.connect();

// Check prices periodically
setInterval(() => {
  console.log('Current prices:', subscriber.getCurrentPrices());
}, 5000);
```

### WebSocket Connection Pool for High-Volume Monitoring

```javascript
class WebSocketPool {
  constructor(wsUrl, token, poolSize = 5) {
    this.wsUrl = wsUrl;
    this.token = token;
    this.poolSize = poolSize;
    this.connections = [];
    this.subscriptionIndex = 0;
  }

  async initialize() {
    for (let i = 0; i < this.poolSize; i++) {
      const ws = new WebSocket(this.wsUrl);
      const conn = {
        ws,
        subscriptions: new Set(),
        ready: false
      };

      await new Promise((resolve) => {
        ws.on('open', () => {
          // Authenticate
          ws.send(JSON.stringify({
            type: 'auth',
            token: this.token
          }));

          ws.on('message', (data) => {
            const msg = JSON.parse(data.toString('utf8'));
            if (msg.type === 'auth' && msg.status === 'success') {
              conn.ready = true;
              resolve();
            }
          });
        });
      });

      this.connections.push(conn);
    }

    console.log(`WebSocket pool initialized with ${this.poolSize} connections`);
  }

  subscribe(channel, id, handler) {
    // Load balance subscriptions across pool
    const conn = this.connections[this.subscriptionIndex % this.poolSize];
    this.subscriptionIndex++;

    conn.subscriptions.add(`${channel}:${id}`);

    conn.ws.send(JSON.stringify({
      type: 'subscribe',
      channel,
      id
    }));

    // Register message handler
    conn.ws.on('message', (data) => {
      const msg = JSON.parse(data.toString('utf8'));
      if (msg.type === 'update' && msg.channel === channel && msg.id === id) {
        handler(msg.data);
      }
    });
  }

  shutdown() {
    for (const conn of this.connections) {
      conn.ws.close();
    }
  }
}

// Usage for high-volume monitoring
const pool = new WebSocketPool('ws://localhost:8004', token, 10);
await pool.initialize();

// Subscribe 1000+ escrows across 10 connections
for (let i = 0; i < 1000; i++) {
  pool.subscribe('escrow', `esc_${i}`, (data) => {
    // Handle escrow update
  });
}
```

### Marketplace PO Real-Time Updates

```javascript
class MarketplaceDashboard {
  constructor(wsUrl, token) {
    this.wsUrl = wsUrl;
    this.token = token;
    this.purchaseOrders = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);

    this.ws.on('open', () => {
      this.authenticate();
    });

    this.ws.on('message', (data) => {
      this.handleMessage(JSON.parse(data.toString('utf8')));
    });
  }

  authenticate() {
    this.ws.send(JSON.stringify({
      type: 'auth',
      token: this.token
    }));
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'auth':
        if (msg.status === 'success') {
          this.loadDashboard();
        }
        break;

      case 'update':
        if (msg.channel === 'marketplace') {
          this.onPOUpdate(msg.data);
        }
        break;
    }
  }

  loadDashboard() {
    // Subscribe to active purchase orders
    const activeOrders = [
      'po_data_analytics_200shib',
      'po_api_integration_500shib',
      'po_testing_services_300shib'
    ];

    for (const poId of activeOrders) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        channel: 'marketplace',
        id: poId
      }));
    }
  }

  onPOUpdate(data) {
    this.purchaseOrders.set(data.poId, {
      ...data,
      lastUpdated: new Date()
    });

    this.displayPOStatus(data.poId);
  }

  displayPOStatus(poId) {
    const po = this.purchaseOrders.get(poId);
    
    console.log(`
PO: ${poId}
Status: ${po.status}
Amount: ${po.amount} SHIB
Seller: ${po.seller}
Buyer: ${po.buyer}
Delivery Progress: ${po.deliveryProgress || 'N/A'}
Updated: ${po.lastUpdated.toLocaleTimeString()}
    `);
  }
}

// Usage
const dashboard = new MarketplaceDashboard('ws://localhost:8004', token);
await dashboard.connect();
```

---

## 🦜 LangChain Integration

### Python Example

```python
from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain.tools import Tool
from langchain_openai import ChatOpenAI
import requests

# A2A Payment Tool
def call_payment_agent(query: str) -> str:
    """Send a message to the A2A SHIB payment agent"""
    response = requests.post(
        "http://localhost:8003/a2a/jsonrpc",
        json={
            "jsonrpc": "2.0",
            "method": "message/send",
            "params": {
                "message": {
                    "kind": "message",
                    "messageId": "langchain-1",
                    "role": "user",
                    "parts": [{"kind": "text", "text": query}]
                }
            },
            "id": 1
        }
    )
    return response.json()["result"]["parts"][0]["text"]

payment_tool = Tool(
    name="A2A_Payment_Agent",
    func=call_payment_agent,
    description="Send SHIB payments, create escrows, negotiate prices, check reputation"
)

# Create LangChain agent with payment capability
llm = ChatOpenAI(model="gpt-4")
agent = create_openai_functions_agent(llm, [payment_tool], system_message)
agent_executor = AgentExecutor(agent=agent, tools=[payment_tool])

# Use it
result = agent_executor.invoke({"input": "Check my SHIB balance"})
print(result["output"])

result = agent_executor.invoke({
    "input": "Create an escrow for 500 SHIB to pay data-agent for market data"
})
print(result["output"])
```

### JavaScript/TypeScript Example

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

// A2A Payment Tool
const paymentTool = new DynamicStructuredTool({
  name: "a2a_payment_agent",
  description: "Send SHIB payments, create escrows, negotiate prices, check reputation",
  schema: z.object({
    query: z.string().describe("The payment-related query or command"),
  }),
  func: async ({ query }) => {
    const response = await fetch("http://localhost:8003/a2a/jsonrpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "message/send",
        params: {
          message: {
            kind: "message",
            messageId: "langchain-1",
            role: "user",
            parts: [{ kind: "text", text: query }]
          }
        },
        id: 1
      })
    });
    const data = await response.json();
    return data.result.parts[0].text;
  }
});

// Create agent
const model = new ChatOpenAI({ modelName: "gpt-4" });
const agent = await createOpenAIFunctionsAgent({
  llm: model,
  tools: [paymentTool],
  prompt: systemPrompt
});

const executor = new AgentExecutor({ agent, tools: [paymentTool] });

// Use it
const result = await executor.invoke({
  input: "Create an escrow for 500 SHIB to pay data-agent"
});
console.log(result.output);
```

---

## ☁️ AWS Bedrock Agents Integration

### Agent Action Group Configuration

```json
{
  "actionGroupName": "SHIBPaymentActions",
  "description": "SHIB payment, escrow, and reputation actions",
  "actionGroupExecutor": {
    "lambda": "arn:aws:lambda:us-east-1:123456789012:function:a2a-payment-proxy"
  },
  "apiSchema": {
    "payload": "..."
  }
}
```

### Lambda Proxy Function (Node.js)

```javascript
const fetch = require('node-fetch');

exports.handler = async (event) => {
  const { apiPath, requestBody } = event;
  
  // Map Bedrock action to A2A command
  let command = '';
  switch (apiPath) {
    case '/payment/send':
      command = `send ${requestBody.amount} SHIB to ${requestBody.recipient}`;
      break;
    case '/escrow/create':
      command = `escrow create ${requestBody.amount} SHIB for ${requestBody.purpose} payee ${requestBody.payee}`;
      break;
    case '/reputation/check':
      command = `reputation check ${requestBody.agentId}`;
      break;
    default:
      return { statusCode: 400, body: 'Unknown action' };
  }

  // Call A2A agent
  const response = await fetch('http://your-agent:8003/a2a/jsonrpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'message/send',
      params: {
        message: {
          kind: 'message',
          messageId: event.messageId,
          role: 'user',
          parts: [{ kind: 'text', text: command }]
        }
      },
      id: 1
    })
  });

  const data = await response.json();
  
  return {
    statusCode: 200,
    body: {
      messageVersion: '1.0',
      response: {
        actionGroup: event.actionGroup,
        apiPath: event.apiPath,
        httpMethod: event.httpMethod,
        httpStatusCode: 200,
        responseBody: {
          'application/json': {
            body: data.result.parts[0].text
          }
        }
      }
    }
  };
};
```

### OpenAPI Schema for Bedrock

```yaml
openapi: 3.0.0
info:
  title: A2A SHIB Payment API
  version: 1.0.0
paths:
  /payment/send:
    post:
      summary: Send SHIB payment
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                amount:
                  type: number
                recipient:
                  type: string
      responses:
        '200':
          description: Payment sent
  /escrow/create:
    post:
      summary: Create escrow
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                amount:
                  type: number
                purpose:
                  type: string
                payee:
                  type: string
      responses:
        '200':
          description: Escrow created
  /reputation/check:
    post:
      summary: Check agent reputation
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                agentId:
                  type: string
      responses:
        '200':
          description: Reputation data
```

---

## 🦪 OpenClaw Integration

### As a Skill

The agent can be used as a standalone OpenClaw skill:

```bash
# Install in OpenClaw skills directory
cd ~/clawd/skills
git clone https://github.com/marcus20232023/a2a-payments.git shib-payments
cd shib-payments
npm install

# Configure
cp .env.example .env.local
nano .env.local  # Add wallet details

# Start
node a2a-agent-full.js
```

### SKILL.md Example

```markdown
# SKILL.md - SHIB Payment Agent

## Description
A2A protocol payment agent for SHIB on Polygon. Provides escrow, negotiation, and reputation services.

## Usage
The agent runs on port 8003. OpenClaw can communicate via A2A protocol.

## Commands
- `send [amount] SHIB to [address]` - Send payment
- `balance` - Check SHIB balance
- `escrow create [amount] SHIB for [purpose] payee [agent]` - Create escrow
- `reputation check [agentId]` - Check agent reputation

## Configuration
Set in `.env.local`:
- WALLET_PRIVATE_KEY
- RPC_URL (Polygon)
- SHIB_CONTRACT_ADDRESS

## Port
8003 (default)
```

---

## 🤖 AutoGen Integration

### Multi-Agent Setup

```python
import autogen
import requests

# A2A Payment Proxy Agent
payment_proxy = autogen.AssistantAgent(
    name="PaymentProxy",
    llm_config={"config_list": config_list},
    system_message="You handle payments via the A2A SHIB payment system."
)

def call_a2a_agent(message: str) -> str:
    response = requests.post(
        "http://localhost:8003/a2a/jsonrpc",
        json={
            "jsonrpc": "2.0",
            "method": "message/send",
            "params": {
                "message": {
                    "kind": "message",
                    "messageId": "autogen-1",
                    "role": "user",
                    "parts": [{"kind": "text", "text": message}]
                }
            },
            "id": 1
        }
    )
    return response.json()["result"]["parts"][0]["text"]

# Register A2A function
autogen.register_function(
    call_a2a_agent,
    caller=payment_proxy,
    executor=user_proxy,
    name="a2a_payment",
    description="Send SHIB payments, create escrows, check reputation"
)

# Use in conversation
user_proxy.initiate_chat(
    payment_proxy,
    message="Create an escrow for 500 SHIB to buy market data from data-agent"
)
```

---

## 🌐 Direct A2A Protocol Integration

### REST API

```bash
# Send message via REST
curl -X POST http://localhost:8003/a2a/rest/message/send \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "kind": "message",
      "messageId": "rest-1",
      "role": "user",
      "parts": [{"kind": "text", "text": "balance"}]
    }
  }'
```

### JSON-RPC

```javascript
const response = await fetch('http://localhost:8003/a2a/jsonrpc', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'message/send',
    params: {
      message: {
        kind: 'message',
        messageId: 'custom-1',
        role: 'user',
        parts: [{ kind: 'text', text: 'send 100 SHIB to 0x...' }]
      }
    },
    id: 1
  })
});

const data = await response.json();
console.log(data.result);
```

### Agent Discovery

```javascript
// Discover payment agent via A2A registry
const response = await fetch('http://localhost:8003/.well-known/agent-card.json');
const agentCard = await response.json();

console.log(agentCard.name);         // "SHIB Payment Agent"
console.log(agentCard.capabilities); // Payment, escrow, negotiation, reputation
console.log(agentCard.endpoints);    // A2A endpoints
```

---

## 📦 Docker Integration

### Docker Compose Multi-Agent Setup

```yaml
version: '3.8'
services:
  payment-agent:
    image: node:18
    working_dir: /app
    volumes:
      - ./a2a-payments:/app
    environment:
      - WALLET_PRIVATE_KEY=${WALLET_PRIVATE_KEY}
      - RPC_URL=https://polygon-rpc.com
    command: npm start
    ports:
      - "8003:8003"
    networks:
      - agent-network

  langchain-agent:
    image: python:3.11
    working_dir: /app
    volumes:
      - ./langchain-agent:/app
    environment:
      - A2A_PAYMENT_URL=http://payment-agent:8003
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    command: python agent.py
    networks:
      - agent-network
    depends_on:
      - payment-agent

networks:
  agent-network:
    driver: bridge
```

---

## 🔒 Production Best Practices

### 1. Authentication

```javascript
// Add API key authentication
const response = await fetch('http://localhost:8003/a2a/jsonrpc', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.A2A_API_KEY
  },
  body: JSON.stringify({...})
});
```

### 2. Error Handling

```python
def safe_a2a_call(query: str, max_retries: int = 3) -> str:
    for attempt in range(max_retries):
        try:
            response = requests.post(
                "http://localhost:8003/a2a/jsonrpc",
                json={...},
                timeout=10
            )
            response.raise_for_status()
            return response.json()["result"]["parts"][0]["text"]
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)  # Exponential backoff
```

### 3. Rate Limiting

```javascript
// Respect rate limits (10 req/min by default)
import { RateLimiter } from 'limiter';

const limiter = new RateLimiter({
  tokensPerInterval: 10,
  interval: 'minute'
});

await limiter.removeTokens(1);
const result = await callA2AAgent(query);
```

---

## 📚 Additional Resources

- **A2A Protocol Spec:** https://a2a-protocol.org
- **Main Documentation:** [README.md](README.md)
- **API Reference:** [ESCROW-NEGOTIATION-GUIDE.md](ESCROW-NEGOTIATION-GUIDE.md)
- **Security Guide:** [PRODUCTION-HARDENING.md](PRODUCTION-HARDENING.md)
- **Deployment Options:** [DEPLOYMENT.md](DEPLOYMENT.md)

---

## 🪝 Event Webhooks

### Overview

The event webhooks system allows external services to listen to payment events in real-time. Events are delivered to registered webhook URLs with automatic retry logic and exponential backoff.

### Supported Events

- `escrow_created` - New escrow created
- `escrow_funded` - Escrow funded with payment
- `escrow_locked` - Escrow locked and ready for release
- `escrow_released` - Funds released to payee
- `escrow_refunded` - Escrow refunded to payer
- `escrow_disputed` - Dispute opened on escrow
- `tipping_received` - Tip received
- `payment_settled` - Payment settlement completed

### Webhook Registration

```javascript
const { WebhookManager } = require('./event-webhooks');

const webhooks = new WebhookManager();

// Register a webhook
const registration = webhooks.register(
  'https://your-service.com/webhooks/payments',
  ['escrow_created', 'escrow_released'],
  {
    description: 'Main payment notifications',
    headers: {
      'X-API-Key': 'your-secret-key'
    }
  }
);

console.log('Webhook ID:', registration.webhookId);
console.log('Secret:', registration.secret); // Store this securely!
```

### Webhook Delivery

Events are sent as HTTP POST requests with the following headers:

```
Content-Type: application/json
X-Webhook-ID: wh_xxxxxxxxxxxxx
X-Event-ID: evt_xxxxxxxxxxxxx
X-Event-Type: escrow_created
X-Timestamp: 1234567890
X-Signature: sha256_hmac_signature
```

Example webhook payload:

```json
{
  "id": "evt_abc123def456",
  "type": "escrow_created",
  "timestamp": 1707619200000,
  "data": {
    "escrowId": "esc_xyz789",
    "payer": "agent-1",
    "payee": "agent-2",
    "amount": 1000,
    "token": "SHIB",
    "purpose": "Payment for services"
  },
  "context": {
    "service": "a2a-payments"
  }
}
```

### Signature Verification

Always verify webhook signatures to ensure authenticity:

```javascript
const crypto = require('crypto');

// In your webhook endpoint
app.post('/webhooks/payments', (req, res) => {
  const signature = req.headers['x-signature'];
  const webhookId = req.headers['x-webhook-id'];
  const event = req.body;

  // Verify signature (you need to store webhook secret)
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(event))
    .digest('hex');

  if (!crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )) {
    return res.status(401).json({ error: 'Signature mismatch' });
  }

  // Process event
  console.log(`Received ${event.type} event:`, event.data);
  res.json({ received: true });
});
```

### Discord Notifications

Example: Send payment notifications to Discord

```javascript
const fetch = require('node-fetch');

app.post('/webhooks/payments', async (req, res) => {
  const event = req.body;

  // Format message based on event type
  let discordMessage = {
    content: `Payment event: ${event.type}`,
    embeds: [{
      title: event.type.toUpperCase(),
      description: JSON.stringify(event.data, null, 2),
      timestamp: new Date(event.timestamp).toISOString(),
      color: getColorForEventType(event.type)
    }]
  };

  if (event.type === 'escrow_created') {
    discordMessage = {
      content: `💰 New Escrow: ${event.data.amount} ${event.data.token}`,
      embeds: [{
        title: 'Escrow Created',
        fields: [
          { name: 'From', value: event.data.payer, inline: true },
          { name: 'To', value: event.data.payee, inline: true },
          { name: 'Amount', value: `${event.data.amount} ${event.data.token}` },
          { name: 'Purpose', value: event.data.purpose }
        ],
        color: 0x4CAF50
      }]
    };
  } else if (event.type === 'escrow_released') {
    discordMessage = {
      content: `✅ Payment Released: ${event.data.escrowId}`,
      embeds: [{
        title: 'Escrow Released',
        description: 'Funds have been released to the payee',
        color: 0x2196F3
      }]
    };
  }

  // Send to Discord webhook
  await fetch(process.env.DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(discordMessage)
  });

  res.json({ received: true });
});

function getColorForEventType(type) {
  const colors = {
    escrow_created: 0x4CAF50,    // Green
    escrow_released: 0x2196F3,   // Blue
    escrow_refunded: 0xFF9800,   // Orange
    escrow_disputed: 0xF44336,   // Red
    tipping_received: 0x9C27B0,  // Purple
    payment_settled: 0x00BCD4    // Cyan
  };
  return colors[type] || 0x9E9E9E; // Gray default
}
```

### Email Alerts

Example: Send email alerts for important payment events

```javascript
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

app.post('/webhooks/payments', async (req, res) => {
  const event = req.body;

  // Only email important events
  if (['escrow_disputed', 'escrow_refunded'].includes(event.type)) {
    const emailContent = {
      from: 'notifications@payments.local',
      to: process.env.ALERT_EMAIL,
      subject: `ALERT: ${event.type}`,
      html: `
        <h2>${event.type.replace(/_/g, ' ').toUpperCase()}</h2>
        <p><strong>Event ID:</strong> ${event.id}</p>
        <p><strong>Time:</strong> ${new Date(event.timestamp).toLocaleString()}</p>
        <h3>Details:</h3>
        <pre>${JSON.stringify(event.data, null, 2)}</pre>
      `
    };

    await transporter.sendMail(emailContent);
  }

  res.json({ received: true });
});
```

### Logging Service

Example: Log all payment events to a database

```javascript
const sqlite3 = require('sqlite3');

const db = new sqlite3.Database('./payment-events.db');

// Initialize schema
db.run(`
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    webhook_id TEXT,
    data JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_type (type),
    INDEX idx_timestamp (timestamp)
  )
`);

app.post('/webhooks/payments', async (req, res) => {
  const event = req.body;
  const webhookId = req.headers['x-webhook-id'];

  db.run(
    `INSERT INTO events (id, type, timestamp, webhook_id, data)
     VALUES (?, ?, ?, ?, ?)`,
    [event.id, event.type, event.timestamp, webhookId, JSON.stringify(event.data)],
    (err) => {
      if (err) {
        console.error('Failed to log event:', err);
      }
    }
  );

  res.json({ received: true });
});

// Query recent events
app.get('/api/events', (req, res) => {
  const type = req.query.type;
  const limit = parseInt(req.query.limit) || 100;

  let query = 'SELECT * FROM events';
  let params = [];

  if (type) {
    query += ' WHERE type = ?';
    params.push(type);
  }

  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(limit);

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    res.json(rows.map(row => ({
      ...row,
      data: JSON.parse(row.data)
    })));
  });
});
```

### Webhook Management API

```javascript
const { WebhookManager } = require('./event-webhooks');
const webhooks = new WebhookManager();

// List webhooks
app.get('/api/webhooks', (req, res) => {
  const list = webhooks.list(req.query);
  res.json(list);
});

// Get webhook details
app.get('/api/webhooks/:id', (req, res) => {
  const webhook = webhooks.get(req.params.id);
  if (!webhook) {
    return res.status(404).json({ error: 'Webhook not found' });
  }
  res.json(webhook);
});

// Register webhook
app.post('/api/webhooks', (req, res) => {
  try {
    const { url, eventTypes, description } = req.body;
    const registration = webhooks.register(url, eventTypes, { description });
    res.status(201).json(registration);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update webhook
app.patch('/api/webhooks/:id', (req, res) => {
  try {
    const updated = webhooks.update(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete webhook
app.delete('/api/webhooks/:id', (req, res) => {
  try {
    webhooks.unregister(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get webhook history
app.get('/api/webhooks/:id/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const history = webhooks.getHistory(req.params.id, limit);
  res.json(history);
});

// Test webhook delivery
app.post('/api/webhooks/:id/test', async (req, res) => {
  try {
    const result = await webhooks.testWebhook(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get statistics
app.get('/api/webhooks/:id/stats', (req, res) => {
  const stats = webhooks.getStats(req.params.id);
  res.json(stats);
});
```

### Retry and Backoff Configuration

The webhook system uses exponential backoff for retries:

```javascript
const { WebhookManager } = require('./event-webhooks');

const webhooks = new WebhookManager();

// Customize retry behavior
webhooks.config.maxRetries = 5;              // Max 5 retries
webhooks.config.initialDelayMs = 1000;       // Start with 1 second
webhooks.config.maxDelayMs = 3600000;        // Max 1 hour between retries
webhooks.config.backoffMultiplier = 2;       // Double delay each attempt
webhooks.config.requestTimeoutMs = 10000;    // 10 second timeout per request

// Retry schedule example:
// Attempt 1: Immediate
// Attempt 2: 1 second delay
// Attempt 3: 2 second delay
// Attempt 4: 4 second delay
// Attempt 5: 8 second delay
```

---

## 🤝 Community Examples

Have an integration example for another framework? Submit a PR!

**Wanted:**
- CrewAI integration
- Semantic Kernel integration
- LlamaIndex integration
- Haystack integration

**Contributors:**
- *(Your name here!)*


### ERC-20 tokens

#### USDC (Amoy testnet)

We added a minimal ERC-20/USDC adapter in `adapters/erc20-usdc.js` and a read-only test in `test/test-usdc.js` which you can run to inspect token metadata (symbol/decimals) on Polygon Amoy testnet (Mumbai's successor).

Usage:

1. Install dependencies:

   cd /home/marc/projects/a2a-payments
   npm install

2. The test is pre-configured with an Amoy USDC token address: `0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582`. You can verify or change this in `test/test-usdc.js`.

3. Choose a reliable Amoy RPC provider. Public endpoints may require API keys; recommended options:
   - Alchemy: `https://polygon-amoy.g.alchemy.com/v2/<YOUR_KEY>`
   - Infura: `https://polygon-amoy.infura.io/v3/<YOUR_KEY>`
   - Ankr / Chainstack: provide your project-specific endpoint

4. Run the read-only test (no funds required):

   node test/test-usdc.js

Notes:
- If you see network/timeout/403 errors, it usually means the public RPC endpoint blocked requests or requires an API key — switch to your provider with a key.
- The adapter returns raw token units; USDC typically uses 6 decimals. Convert amounts accordingly when making transfers (e.g., `ethers.parseUnits('1.0', 6)`).
- For full integration tests that perform transfers, add a dedicated funded test wallet (do NOT commit private keys). Use local environment variables or a secrets vault for test keys.
