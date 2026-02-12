#!/usr/bin/env node

/**
 * WebSocket Real-Time Updates Tests
 * 
 * Tests:
 * 1. WebSocket connection and authentication
 * 2. Escrow subscription and updates
 * 3. Tip subscription and updates
 * 4. Marketplace PO subscription and updates
 * 5. Price feed subscription and updates
 * 6. Error handling and reconnection
 * 7. Concurrent subscriptions
 */

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { WebSocketManager } = require('../websocket-manager');
const assert = require('assert');

// Test configuration
const WS_PORT = 8004;
const WS_SECRET = 'test-secret-key';
const TEST_TIMEOUT = 10000;

let passedTests = 0;
let failedTests = 0;
const testResults = [];

/**
 * Test helper
 */
async function test(name, fn) {
  try {
    console.log(`\n⏳ ${name}...`);
    await fn();
    console.log(`✅ ${name}`);
    passedTests++;
    testResults.push({ name, status: 'PASS' });
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   Error: ${error.message}`);
    failedTests++;
    testResults.push({ name, status: 'FAIL', error: error.message });
  }
}

/**
 * Create WebSocket connection
 */
function connectWebSocket(url = `ws://localhost:${WS_PORT}`) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timeout = setTimeout(() => {
      reject(new Error('Connection timeout'));
    }, 5000);

    ws.on('open', () => {
      clearTimeout(timeout);
      resolve(ws);
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

/**
 * Send message and wait for response
 */
function sendMessage(ws, message) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Message timeout'));
    }, TEST_TIMEOUT);

    const handler = (data) => {
      clearTimeout(timeout);
      ws.off('message', handler);
      try {
        // ws library may send Buffer or string
        const text = typeof data === 'string' ? data : data.toString('utf8');
        resolve(JSON.parse(text));
      } catch (error) {
        reject(new Error(`Parse error: ${error.message}`));
      }
    };

    ws.on('message', handler);
    ws.send(JSON.stringify(message));
  });
}

/**
 * Test Suite
 */
async function runTests() {
  console.log(`
╔════════════════════════════════════════╗
║   WebSocket Real-Time Updates Tests    ║
╚════════════════════════════════════════╝
  `);

  // Start test server
  const { WebSocketServer } = require('../websocket-server');
  const config = {
    wsPort: WS_PORT,
    wsSecret: WS_SECRET,
    nodeEnv: 'test'
  };

  const server = new WebSocketServer(config);
  server.start();

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 1000));

  try {
    // Test 1: Connection
    await test('WebSocket Connection', async () => {
      const ws = await connectWebSocket();
      const response = await sendMessage(ws, { type: 'ping' });
      assert.strictEqual(response.type, 'pong');
      ws.close();
    });

    // Test 2: Authentication
    await test('Authentication with Token', async () => {
      const ws = await connectWebSocket();
      
      const token = jwt.sign(
        { sub: 'user123', agentId: 'agent456' },
        WS_SECRET,
        { expiresIn: '24h' }
      );

      const response = await sendMessage(ws, {
        type: 'auth',
        token,
        userId: 'user123',
        agentId: 'agent456'
      });

      assert.strictEqual(response.type, 'auth');
      assert.strictEqual(response.status, 'success');
      assert.strictEqual(response.userId, 'user123');
      ws.close();
    });

    // Test 3: Failed authentication
    await test('Authentication Failure', async () => {
      const ws = await connectWebSocket();
      
      const response = await sendMessage(ws, {
        type: 'auth',
        token: 'invalid-token'
      });

      assert.strictEqual(response.type, 'auth');
      assert.strictEqual(response.status, 'error');
      ws.close();
    });

    // Test 4: Subscribe to Escrow
    await test('Escrow Subscription', async () => {
      const ws = await connectWebSocket();
      
      const token = jwt.sign(
        { sub: 'user123', agentId: 'agent456' },
        WS_SECRET,
        { expiresIn: '24h' }
      );

      // Authenticate
      await sendMessage(ws, {
        type: 'auth',
        token
      });

      // Subscribe
      const subResponse = await sendMessage(ws, {
        type: 'subscribe',
        channel: 'escrow',
        id: 'esc_test123'
      });

      assert.strictEqual(subResponse.type, 'subscribed');
      assert.strictEqual(subResponse.channel, 'escrow');
      assert.strictEqual(subResponse.id, 'esc_test123');
      ws.close();
    });

    // Test 5: Escrow Update Broadcast
    await test('Escrow Update Broadcast', async () => {
      const ws = await connectWebSocket();
      
      const token = jwt.sign(
        { sub: 'user123', agentId: 'agent456' },
        WS_SECRET,
        { expiresIn: '24h' }
      );

      // Authenticate
      await sendMessage(ws, { type: 'auth', token });

      // Subscribe to escrow
      await sendMessage(ws, {
        type: 'subscribe',
        channel: 'escrow',
        id: 'esc_broadcast1'
      });

      // Wait for subscription confirmation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Publish update from another connection
      const publishWs = await connectWebSocket();
      const publishToken = jwt.sign(
        { sub: 'publisher', agentId: 'publisher-agent' },
        WS_SECRET,
        { expiresIn: '24h' }
      );
      await sendMessage(publishWs, { type: 'auth', token: publishToken });

      // Publish update
      server.wsManager.publishEscrowUpdate('esc_broadcast1', {
        state: 'funded',
        txHash: '0x123abc'
      });

      // Receive update
      const updateResponse = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Update not received'));
        }, TEST_TIMEOUT);

        const handler = (data) => {
          clearTimeout(timeout);
          ws.off('message', handler);
          try {
            const text = typeof data === 'string' ? data : data.toString('utf8');
            const message = JSON.parse(text);
            if (message.type === 'update' && message.channel === 'escrow') {
              resolve(message);
            }
          } catch (error) {
            // Parse error, ignore and continue listening
          }
        };
        
        ws.on('message', handler);
      });

      assert.strictEqual(updateResponse.type, 'update');
      assert.strictEqual(updateResponse.channel, 'escrow');
      assert.strictEqual(updateResponse.data.state, 'funded');
      assert.strictEqual(updateResponse.data.txHash, '0x123abc');
      ws.close();
      publishWs.close();
    });

    // Test 6: Subscribe to Tips
    await test('Tips Subscription', async () => {
      const ws = await connectWebSocket();
      
      const token = jwt.sign(
        { sub: 'user123', agentId: 'agent456' },
        WS_SECRET,
        { expiresIn: '24h' }
      );

      await sendMessage(ws, { type: 'auth', token });

      const response = await sendMessage(ws, {
        type: 'subscribe',
        channel: 'tips',
        id: 'repo-abc123'
      });

      assert.strictEqual(response.type, 'subscribed');
      assert.strictEqual(response.channel, 'tips');
      ws.close();
    });

    // Test 7: Subscribe to Marketplace
    await test('Marketplace Subscription', async () => {
      const ws = await connectWebSocket();
      
      const token = jwt.sign(
        { sub: 'user123', agentId: 'agent456' },
        WS_SECRET,
        { expiresIn: '24h' }
      );

      await sendMessage(ws, { type: 'auth', token });

      const response = await sendMessage(ws, {
        type: 'subscribe',
        channel: 'marketplace',
        id: 'po_xyz789'
      });

      assert.strictEqual(response.type, 'subscribed');
      assert.strictEqual(response.channel, 'marketplace');
      ws.close();
    });

    // Test 8: Subscribe to Prices
    await test('Price Feed Subscription', async () => {
      const ws = await connectWebSocket();
      
      const token = jwt.sign(
        { sub: 'user123', agentId: 'agent456' },
        WS_SECRET,
        { expiresIn: '24h' }
      );

      await sendMessage(ws, { type: 'auth', token });

      const response = await sendMessage(ws, {
        type: 'subscribe',
        channel: 'prices',
        id: 'SHIB'
      });

      assert.strictEqual(response.type, 'subscribed');
      assert.strictEqual(response.channel, 'prices');
      ws.close();
    });

    // Test 9: Unsubscribe
    await test('Unsubscribe', async () => {
      const ws = await connectWebSocket();
      
      const token = jwt.sign(
        { sub: 'user123', agentId: 'agent456' },
        WS_SECRET,
        { expiresIn: '24h' }
      );

      await sendMessage(ws, { type: 'auth', token });
      await sendMessage(ws, {
        type: 'subscribe',
        channel: 'escrow',
        id: 'esc_unsub1'
      });

      const response = await sendMessage(ws, {
        type: 'unsubscribe',
        channel: 'escrow',
        id: 'esc_unsub1'
      });

      assert.strictEqual(response.type, 'unsubscribed');
      ws.close();
    });

    // Test 10: Multiple concurrent subscriptions
    await test('Multiple Concurrent Subscriptions', async () => {
      const ws = await connectWebSocket();
      
      const token = jwt.sign(
        { sub: 'user123', agentId: 'agent456' },
        WS_SECRET,
        { expiresIn: '24h' }
      );

      await sendMessage(ws, { type: 'auth', token });

      // Subscribe to multiple channels
      const channels = [
        { channel: 'escrow', id: 'esc_multi1' },
        { channel: 'tips', id: 'repo_multi1' },
        { channel: 'marketplace', id: 'po_multi1' },
        { channel: 'prices', id: 'BTC' }
      ];

      for (const sub of channels) {
        const response = await sendMessage(ws, {
          type: 'subscribe',
          ...sub
        });
        assert.strictEqual(response.type, 'subscribed');
      }

      ws.close();
    });

    // Test 11: Unauthenticated subscribe rejection
    await test('Unauthenticated Subscribe Rejection', async () => {
      const ws = await connectWebSocket();
      
      const response = await sendMessage(ws, {
        type: 'subscribe',
        channel: 'escrow',
        id: 'esc_noauth'
      });

      assert.strictEqual(response.type, 'error');
      ws.close();
    });

    // Test 12: Get WebSocket stats
    await test('WebSocket Stats Endpoint', async () => {
      const stats = server.wsManager.getStats();
      assert(stats.totalConnections >= 0);
      assert(Array.isArray(stats.subscriptions.escrow));
      assert(Array.isArray(stats.subscriptions.tips));
      assert(Array.isArray(stats.subscriptions.marketplace));
      assert(Array.isArray(stats.subscriptions.prices));
    });

  } catch (error) {
    console.error('\nTest suite error:', error);
  } finally {
    // Cleanup
    server.wsManager.shutdown();
    server.server.close();
    
    // Print summary
    console.log(`
╔════════════════════════════════════════╗
║          Test Summary                  ║
╚════════════════════════════════════════╝

Total Tests: ${passedTests + failedTests}
✅ Passed: ${passedTests}
❌ Failed: ${failedTests}

${failedTests > 0 ? '\nFailed Tests:\n' + testResults
  .filter(t => t.status === 'FAIL')
  .map(t => `  - ${t.name}: ${t.error}`)
  .join('\n') : ''}

${passedTests === (passedTests + failedTests) ? '\n🎉 All tests passed!' : ''}
    `);

    process.exit(failedTests > 0 ? 1 : 0);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
