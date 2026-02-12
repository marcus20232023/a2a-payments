#!/usr/bin/env node

/**
 * WebSocket Server for A2A Payments Real-Time Updates
 * 
 * Runs alongside the REST API to provide real-time updates for:
 * - Escrow state changes
 * - Tipping updates
 * - Marketplace PO lifecycle
 * - Price feeds
 */

const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const path = require('path');
const fs = require('fs');
const { WebSocketManager } = require('./websocket-manager');
const { EscrowSystem } = require('./escrow');
const { MarketplaceAdapter } = require('./marketplace-adapter');

// Load config
function loadConfig() {
  const envPath = path.join(process.env.HOME, '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    });
  }

  return {
    wsPort: process.env.WS_PORT || 8004,
    wsSecret: process.env.WS_SECRET || 'dev-secret-key',
    restPort: process.env.REST_PORT || 8003,
    nodeEnv: process.env.NODE_ENV || 'development'
  };
}

/**
 * WebSocket Server with REST API
 */
class WebSocketServer {
  constructor(config) {
    this.config = config;
    this.app = express();
    this.server = http.createServer(this.app);
    this.wsManager = new WebSocketManager({
      jwtSecret: config.wsSecret,
      heartbeatInterval: 30000,
      maxConnections: 1000
    });

    // Initialize integrations
    this.escrow = new EscrowSystem();
    this.marketplace = new MarketplaceAdapter({
      escrowSystem: this.escrow,
      paymentNegotiationSystem: null // Optional
    });

    this.setupExpress();
    this.setupWebSocket();
    this.setupEventHandlers();
  }

  setupExpress() {
    // Middleware
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      console.log(`[API] ${req.method} ${req.path}`);
      next();
    });

    // REST API Routes
    this.setupRestRoutes();
  }

  setupRestRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        service: 'a2a-websocket',
        uptime: process.uptime(),
        connections: this.wsManager.clients.size,
        timestamp: Date.now()
      });
    });

    // Get WebSocket stats
    this.app.get('/api/ws/stats', (req, res) => {
      res.json(this.wsManager.getStats());
    });

    // Generate authentication token
    this.app.post('/api/ws/token', (req, res) => {
      const { userId, agentId } = req.body;

      if (!userId || !agentId) {
        return res.status(400).json({ error: 'userId and agentId required' });
      }

      try {
        const token = this.wsManager.generateToken(userId, agentId, {
          type: 'websocket'
        });

        res.json({
          token,
          expiresIn: '24h',
          wsUrl: `ws://localhost:${this.config.wsPort}`
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Publish escrow update (for backend services)
    this.app.post('/api/escrow/:escrowId/publish', (req, res) => {
      const { escrowId } = req.params;
      const { state, data } = req.body;

      try {
        this.wsManager.publishEscrowUpdate(escrowId, {
          state,
          ...data
        });

        res.json({
          success: true,
          message: `Published update for escrow ${escrowId}`,
          subscribers: this.wsManager.subscriptions.escrow.get(escrowId)?.size || 0
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Publish tip update
    this.app.post('/api/tips/:repoId/publish', (req, res) => {
      const { repoId } = req.params;
      const { amount, sender, data } = req.body;

      try {
        this.wsManager.publishTipUpdate(repoId, {
          amount,
          sender,
          ...data
        });

        res.json({
          success: true,
          message: `Published tip for repo ${repoId}`,
          subscribers: this.wsManager.subscriptions.tips.get(repoId)?.size || 0
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Publish marketplace update
    this.app.post('/api/marketplace/:poId/publish', (req, res) => {
      const { poId } = req.params;
      const { status, data } = req.body;

      try {
        this.wsManager.publishMarketplaceUpdate(poId, {
          status,
          ...data
        });

        res.json({
          success: true,
          message: `Published update for PO ${poId}`,
          subscribers: this.wsManager.subscriptions.marketplace.get(poId)?.size || 0
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Publish price update
    this.app.post('/api/prices/:assetId/publish', (req, res) => {
      const { assetId } = req.params;
      const { price, change, data } = req.body;

      try {
        this.wsManager.publishPriceUpdate(assetId, {
          price,
          change,
          ...data
        });

        res.json({
          success: true,
          message: `Published price for ${assetId}`,
          subscribers: this.wsManager.subscriptions.prices.get(assetId)?.size || 0
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Query endpoint for WebSocket handlers
    this.app.post('/api/query', (req, res) => {
      const { channel, id, query } = req.body;

      // Emit query event for WebSocket handlers
      this.wsManager.emit('query', {
        channel,
        id,
        query,
        respond: (data) => {
          res.json({ success: true, data });
        }
      });

      // Timeout if no handler responds
      setTimeout(() => {
        if (!res.headersSent) {
          res.status(408).json({ error: 'Query timeout' });
        }
      }, 5000);
    });
  }

  setupWebSocket() {
    // Create WebSocket server on HTTP server
    const wss = new WebSocket.Server({ server: this.server });

    wss.on('connection', (ws, request) => {
      this.wsManager.handleConnection(ws, request);
    });

    // Handle WebSocket server errors
    wss.on('error', (error) => {
      console.error('[WebSocket Server] Error:', error);
    });

    console.log('[WebSocket Server] Ready for connections');
  }

  setupEventHandlers() {
    // Monitor WebSocket events
    this.wsManager.on('client:connected', ({ clientId }) => {
      console.log(`[Events] Client connected: ${clientId}`);
    });

    this.wsManager.on('client:authenticated', ({ clientId, userId, agentId }) => {
      console.log(`[Events] Client authenticated: ${clientId} (${userId}/${agentId})`);
    });

    this.wsManager.on('client:subscribed', ({ clientId, channel, id }) => {
      console.log(`[Events] Client subscribed: ${clientId} -> ${channel}:${id}`);
    });

    this.wsManager.on('client:disconnected', ({ clientId }) => {
      console.log(`[Events] Client disconnected: ${clientId}`);
    });

    this.wsManager.on('broadcast', ({ channel, id, subscribers }) => {
      if (subscribers > 0) {
        console.log(`[Events] Broadcast ${channel}:${id} to ${subscribers} subscribers`);
      }
    });

    // Handle queries
    this.wsManager.on('query', async ({ clientId, channel, id, query, respond }) => {
      try {
        switch (channel) {
          case 'escrow':
            const escrow = this.escrow.get(id);
            respond(escrow || { error: 'Not found' });
            break;
          case 'marketplace':
            const po = this.marketplace.getPurchaseOrder(id);
            respond(po || { error: 'Not found' });
            break;
          default:
            respond({ error: 'Unknown channel' });
        }
      } catch (error) {
        respond({ error: error.message });
      }
    });
  }

  start() {
    this.server.listen(this.config.wsPort, () => {
      console.log(`
╔════════════════════════════════════════╗
║     A2A WebSocket Server Started       ║
╚════════════════════════════════════════╝

  WebSocket: ws://localhost:${this.config.wsPort}
  REST API: http://localhost:${this.config.wsPort}
  Health: http://localhost:${this.config.wsPort}/health
  Stats: http://localhost:${this.config.wsPort}/api/ws/stats

  Environment: ${this.config.nodeEnv}
  Time: ${new Date().toISOString()}

Next steps:
  1. Generate token: POST /api/ws/token with userId & agentId
  2. Connect to WebSocket with token
  3. Subscribe to channels: escrow, tips, marketplace, prices

For development: 
  npm run test:websocket
      `);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('[Server] SIGTERM received, shutting down...');
      this.wsManager.shutdown();
      this.server.close(() => {
        console.log('[Server] Closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('[Server] SIGINT received, shutting down...');
      this.wsManager.shutdown();
      this.server.close(() => {
        console.log('[Server] Closed');
        process.exit(0);
      });
    });
  }
}

// Main
if (require.main === module) {
  const config = loadConfig();
  const server = new WebSocketServer(config);
  server.start();
}

module.exports = { WebSocketServer };
