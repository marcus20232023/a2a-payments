/**
 * WebSocket Manager for Real-Time A2A Payments Updates
 * 
 * Features:
 * - Real-time escrow status updates
 * - Tipping status updates
 * - Marketplace PO status updates
 * - Price feed subscriptions
 * - WebSocket authentication
 * - Connection handling and error recovery
 * - Automatic reconnection support
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const EventEmitter = require('events');

/**
 * WebSocketManager - Server-side WebSocket handler
 */
class WebSocketManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      jwtSecret: options.jwtSecret || crypto.randomBytes(32).toString('hex'),
      tokenExpiry: options.tokenExpiry || '24h',
      maxConnections: options.maxConnections || 1000,
      heartbeatInterval: options.heartbeatInterval || 30000,
      messageTimeout: options.messageTimeout || 5000,
      ...options
    };

    this.clients = new Map(); // clientId -> { ws, subscriptions, auth, lastActivity }
    this.subscriptions = {
      escrow: new Map(), // escrowId -> Set<clientId>
      tips: new Map(), // repoId -> Set<clientId>
      marketplace: new Map(), // poId -> Set<clientId>
      prices: new Map() // assetId -> Set<clientId>
    };

    this.eventQueue = []; // Event log for catchup
    this.maxEventLog = options.maxEventLog || 100;

    this._startHeartbeat();
  }

  /**
   * Handle incoming WebSocket connection
   */
  handleConnection(ws, request) {
    const clientId = 'client_' + crypto.randomBytes(12).toString('hex');
    
    console.log(`[WebSocket] New connection: ${clientId}`);

    if (this.clients.size >= this.options.maxConnections) {
      ws.close(1008, 'Server at capacity');
      return;
    }

    const client = {
      id: clientId,
      ws,
      subscriptions: {
        escrow: new Set(),
        tips: new Set(),
        marketplace: new Set(),
        prices: new Set()
      },
      auth: {
        authenticated: false,
        userId: null,
        agentId: null
      },
      lastActivity: Date.now(),
      sessionStarted: Date.now()
    };

    this.clients.set(clientId, client);

    // Attach handlers
    ws.on('message', (data) => this._handleMessage(clientId, data));
    ws.on('close', () => this._handleClose(clientId));
    ws.on('error', (error) => this._handleError(clientId, error));
    ws.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) client.lastActivity = Date.now();
    });

    // Send welcome message
    this._send(clientId, {
      type: 'connection',
      status: 'connected',
      clientId,
      message: 'Connected to A2A WebSocket server. Please authenticate.'
    });

    this.emit('client:connected', { clientId });
  }

  /**
   * Handle incoming message
   */
  _handleMessage(clientId, data) {
    try {
      const message = JSON.parse(data.toString('utf8'));
      const client = this.clients.get(clientId);

      if (!client) return;

      client.lastActivity = Date.now();

      switch (message.type) {
        case 'auth':
          this._handleAuth(clientId, message);
          break;
        case 'subscribe':
          this._handleSubscribe(clientId, message);
          break;
        case 'unsubscribe':
          this._handleUnsubscribe(clientId, message);
          break;
        case 'ping':
          this._send(clientId, { type: 'pong', timestamp: Date.now() });
          break;
        case 'query':
          this._handleQuery(clientId, message);
          break;
        default:
          this._send(clientId, { type: 'error', message: 'Unknown message type' });
      }
    } catch (error) {
      console.error(`[WebSocket] Message parse error (${clientId}):`, error.message);
      this._send(clientId, { type: 'error', message: 'Invalid message format' });
    }
  }

  /**
   * Authentication handler
   */
  _handleAuth(clientId, message) {
    const { token, agentId, userId } = message;

    if (!token) {
      this._send(clientId, { type: 'auth', status: 'error', message: 'Token required' });
      return;
    }

    try {
      const decoded = jwt.verify(token, this.options.jwtSecret);
      
      const client = this.clients.get(clientId);
      if (client) {
        client.auth = {
          authenticated: true,
          userId: userId || decoded.sub,
          agentId: agentId || decoded.agentId,
          tokenExp: decoded.exp
        };

        this._send(clientId, {
          type: 'auth',
          status: 'success',
          userId: client.auth.userId,
          agentId: client.auth.agentId,
          message: 'Authenticated successfully'
        });

        this.emit('client:authenticated', {
          clientId,
          userId: client.auth.userId,
          agentId: client.auth.agentId
        });
      }
    } catch (error) {
      this._send(clientId, {
        type: 'auth',
        status: 'error',
        message: 'Invalid or expired token'
      });
    }
  }

  /**
   * Subscribe to updates
   */
  _handleSubscribe(clientId, message) {
    const { channel, id } = message;
    const client = this.clients.get(clientId);

    if (!client || !client.auth.authenticated) {
      this._send(clientId, { type: 'error', message: 'Not authenticated' });
      return;
    }

    if (!['escrow', 'tips', 'marketplace', 'prices'].includes(channel)) {
      this._send(clientId, { type: 'error', message: 'Invalid channel' });
      return;
    }

    const subscriptionId = `${channel}:${id}`;

    // Add to client's subscriptions
    if (client.subscriptions[channel]) {
      client.subscriptions[channel].add(id);
    }

    // Add to global subscriptions
    if (!this.subscriptions[channel].has(id)) {
      this.subscriptions[channel].set(id, new Set());
    }
    this.subscriptions[channel].get(id).add(clientId);

    // Send recent events for catchup
    const recentEvents = this.eventQueue
      .filter(e => e.channel === channel && e.id === id)
      .slice(-10); // Last 10 events

    this._send(clientId, {
      type: 'subscribed',
      channel,
      id,
      subscriptionId,
      message: `Subscribed to ${subscriptionId}`,
      recentEvents // Catchup data
    });

    this.emit('client:subscribed', { clientId, channel, id });
  }

  /**
   * Unsubscribe from updates
   */
  _handleUnsubscribe(clientId, message) {
    const { channel, id } = message;
    const client = this.clients.get(clientId);

    if (!client) return;

    // Remove from client's subscriptions
    if (client.subscriptions[channel]) {
      client.subscriptions[channel].delete(id);
    }

    // Remove from global subscriptions
    if (this.subscriptions[channel].has(id)) {
      this.subscriptions[channel].get(id).delete(clientId);
    }

    this._send(clientId, {
      type: 'unsubscribed',
      channel,
      id,
      message: `Unsubscribed from ${channel}:${id}`
    });

    this.emit('client:unsubscribed', { clientId, channel, id });
  }

  /**
   * Query handler (e.g., get current state of escrow)
   */
  _handleQuery(clientId, message) {
    const { channel, id, query } = message;
    const client = this.clients.get(clientId);

    if (!client || !client.auth.authenticated) {
      this._send(clientId, { type: 'error', message: 'Not authenticated' });
      return;
    }

    // Emit event for handler to process (e.g., fetch escrow state)
    this.emit('query', {
      clientId,
      channel,
      id,
      query,
      respond: (data) => {
        this._send(clientId, {
          type: 'query-response',
          channel,
          id,
          data
        });
      }
    });
  }

  /**
   * Broadcast update to subscribed clients
   */
  broadcastUpdate(channel, id, update) {
    const subscriptionKey = `${channel}:${id}`;
    const subscribers = this.subscriptions[channel]?.get(id) || new Set();

    const message = {
      type: 'update',
      channel,
      id,
      timestamp: Date.now(),
      data: typeof update === 'object' ? update : { value: update }
    };

    // Store in event log for catchup
    this.eventQueue.push({
      ...message,
      receivedAt: Date.now()
    });

    if (this.eventQueue.length > this.maxEventLog) {
      this.eventQueue.shift();
    }

    // Send to all subscribers
    for (const clientId of subscribers) {
      this._send(clientId, message);
    }

    this.emit('broadcast', { channel, id, subscribers: subscribers.size });
  }

  /**
   * Publish escrow update
   */
  publishEscrowUpdate(escrowId, stateData) {
    this.broadcastUpdate('escrow', escrowId, {
      escrowId,
      ...stateData,
      timestamp: Date.now()
    });
  }

  /**
   * Publish tipping update
   */
  publishTipUpdate(repoId, tipData) {
    this.broadcastUpdate('tips', repoId, {
      repoId,
      ...tipData,
      timestamp: Date.now()
    });
  }

  /**
   * Publish marketplace PO update
   */
  publishMarketplaceUpdate(poId, poData) {
    this.broadcastUpdate('marketplace', poId, {
      poId,
      ...poData,
      timestamp: Date.now()
    });
  }

  /**
   * Publish price feed update
   */
  publishPriceUpdate(assetId, priceData) {
    this.broadcastUpdate('prices', assetId, {
      assetId,
      ...priceData,
      timestamp: Date.now()
    });
  }

  /**
   * Send message to specific client
   */
  _send(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== 1) return;

    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`[WebSocket] Send error (${clientId}):`, error.message);
    }
  }

  /**
   * Broadcast to all connected clients
   */
  broadcast(message) {
    for (const client of this.clients.values()) {
      if (client.ws.readyState === 1) {
        try {
          client.ws.send(JSON.stringify(message));
        } catch (error) {
          console.error(`[WebSocket] Broadcast error:`, error.message);
        }
      }
    }
  }

  /**
   * Handle connection close
   */
  _handleClose(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    console.log(`[WebSocket] Client disconnected: ${clientId}`);

    // Clean up subscriptions
    for (const channel of Object.keys(this.subscriptions)) {
      for (const [id, subscribers] of this.subscriptions[channel]) {
        subscribers.delete(clientId);
        if (subscribers.size === 0) {
          this.subscriptions[channel].delete(id);
        }
      }
    }

    this.clients.delete(clientId);
    this.emit('client:disconnected', { clientId });
  }

  /**
   * Handle connection error
   */
  _handleError(clientId, error) {
    console.error(`[WebSocket] Error (${clientId}):`, error.message);
    this.emit('error', { clientId, error });
  }

  /**
   * Generate authentication token
   */
  generateToken(userId, agentId, options = {}) {
    const payload = {
      sub: userId,
      agentId,
      iat: Math.floor(Date.now() / 1000),
      ...options
    };

    return jwt.sign(payload, this.options.jwtSecret, {
      expiresIn: this.options.tokenExpiry
    });
  }

  /**
   * Verify authentication token
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, this.options.jwtSecret);
    } catch (error) {
      return null;
    }
  }

  /**
   * Heartbeat to keep connections alive and detect dead clients
   */
  _startHeartbeat() {
    setInterval(() => {
      const now = Date.now();
      const timeout = 90000; // 90 seconds

      for (const [clientId, client] of this.clients) {
        // Check for inactive clients
        if (now - client.lastActivity > timeout) {
          console.log(`[WebSocket] Closing inactive client: ${clientId}`);
          client.ws.close(1000, 'Inactivity timeout');
          this._handleClose(clientId);
        }
        // Send ping
        else if (client.ws.readyState === 1) {
          try {
            client.ws.ping();
          } catch (error) {
            console.error(`[WebSocket] Ping error (${clientId}):`, error.message);
          }
        }
      }

      // Log stats
      if (this.clients.size > 0) {
        console.log(`[WebSocket] Active connections: ${this.clients.size}`);
      }
    }, this.options.heartbeatInterval);
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      totalConnections: this.clients.size,
      subscriptions: {
        escrow: Array.from(this.subscriptions.escrow.entries()).map(([id, subs]) => ({
          id,
          subscribers: subs.size
        })),
        tips: Array.from(this.subscriptions.tips.entries()).map(([id, subs]) => ({
          id,
          subscribers: subs.size
        })),
        marketplace: Array.from(this.subscriptions.marketplace.entries()).map(([id, subs]) => ({
          id,
          subscribers: subs.size
        })),
        prices: Array.from(this.subscriptions.prices.entries()).map(([id, subs]) => ({
          id,
          subscribers: subs.size
        }))
      },
      eventLogSize: this.eventQueue.length
    };
  }

  /**
   * Close all connections gracefully
   */
  shutdown() {
    console.log('[WebSocket] Shutting down...');
    for (const client of this.clients.values()) {
      try {
        client.ws.close(1000, 'Server shutting down');
      } catch (error) {
        console.error('[WebSocket] Close error:', error.message);
      }
    }
    this.clients.clear();
  }
}

module.exports = {
  WebSocketManager
};
