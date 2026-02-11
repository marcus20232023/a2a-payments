/**
 * X402 Protocol Handler
 * 
 * HTTP 402 "Payment Required" protocol for agent-to-agent micropayments.
 * Integrates with existing escrow system for trustless payments.
 * 
 * Features:
 * - Parse 402 responses and create escrow automatically
 * - Generate 402 responses for service providers
 * - Auto-release escrow on successful content delivery
 * - Timeout and refund handling
 * - Payment proof verification
 * 
 * Market: $600M annualized volume, 38M transactions
 * Use cases: data feeds, compute, APIs, agent services
 */

const crypto = require('crypto');
const { EscrowSystem } = require('./escrow');

class X402Handler {
  constructor(escrowSystem, options = {}) {
    this.escrow = escrowSystem || new EscrowSystem();
    this.defaultTimeout = options.defaultTimeout || 300; // 5 minutes
    this.autoRelease = options.autoRelease !== false; // Default true
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000; // 1 second
  }

  /**
   * Handle HTTP 402 Payment Required response
   * 
   * @param {object} response - HTTP response object
   * @param {object} httpRequest - Original request to retry after payment
   * @param {object} payerInfo - Payer agent information
   * @returns {Promise<object>} Response after payment
   */
  async handlePaymentRequired(response, httpRequest, payerInfo) {
    if (response.status !== 402) {
      throw new Error(`Expected HTTP 402, got ${response.status}`);
    }

    // Parse payment details from response headers
    const paymentInfo = this.parsePaymentHeaders(response.headers);
    
    console.log(`[X402] Payment required: ${paymentInfo.amount} ${paymentInfo.token} to ${paymentInfo.recipient}`);
    console.log(`[X402] Description: ${paymentInfo.description}`);

    // Create escrow for payment
    const escrow = await this.createX402Escrow(paymentInfo, payerInfo);
    console.log(`[X402] Escrow created: ${escrow.id}`);

    // Fund escrow (in real system, this would trigger blockchain transaction)
    const txHash = this.generateMockTxHash();
    await this.escrow.fund(escrow.id, txHash);
    console.log(`[X402] Escrow funded: ${txHash}`);

    // Retry request with payment proof
    const paidResponse = await this.retryWithPayment(httpRequest, escrow, paymentInfo);

    // Verify content was delivered
    if (paidResponse.ok) {
      console.log(`[X402] Content delivered successfully`);
      
      // Submit delivery proof (may auto-release depending on conditions)
      this.escrow.submitDelivery(escrow.id, {
        submittedBy: paymentInfo.recipient,
        data: { status: 'delivered', timestamp: Date.now() },
        signature: 'x402-auto-confirmed'
      });
      
      // Check if escrow needs manual release (if not already released)
      const updatedEscrow = this.escrow.get(escrow.id);
      if (updatedEscrow.state === 'locked' && this.autoRelease) {
        await this.escrow.release(escrow.id, 'X402 automatic release - content delivered');
        console.log(`[X402] Escrow released: ${escrow.id}`);
      } else if (updatedEscrow.state === 'released') {
        console.log(`[X402] Escrow already released: ${escrow.id}`);
      }
    } else {
      console.error(`[X402] Content delivery failed: ${paidResponse.status}`);
      throw new Error(`Payment made but content not delivered: ${paidResponse.status}`);
    }

    return paidResponse;
  }

  /**
   * Parse payment information from HTTP 402 response headers
   * 
   * @param {object} headers - Response headers
   * @returns {object} Payment information
   */
  parsePaymentHeaders(headers) {
    // Support both lowercase and original case headers
    const getHeader = (name) => {
      const lower = name.toLowerCase();
      return headers[lower] || headers[name] || null;
    };

    const amount = parseFloat(getHeader('x-payment-amount'));
    const token = getHeader('x-payment-token') || 'USDC';
    const recipient = getHeader('x-payment-address');
    const escrowId = getHeader('x-payment-escrow-id');
    const description = getHeader('x-payment-description') || 'X402 payment';

    if (!amount || !recipient) {
      throw new Error('Invalid 402 response: missing x-payment-amount or x-payment-address');
    }

    return {
      amount,
      token,
      recipient,
      escrowId,
      description
    };
  }

  /**
   * Create escrow for X402 payment
   * 
   * @param {object} paymentInfo - Payment details from 402 response
   * @param {object} payerInfo - Payer agent information
   * @returns {Promise<object>} Created escrow
   */
  async createX402Escrow(paymentInfo, payerInfo) {
    return this.escrow.create({
      payer: payerInfo.agentId || payerInfo.wallet || 'unknown-agent',
      payee: paymentInfo.recipient,
      amount: paymentInfo.amount,
      purpose: `X402: ${paymentInfo.description}`,
      conditions: {
        requiresApproval: false, // Auto-approve for micropayments
        requiresDelivery: true,
        requiresArbiter: false,
        autoRelease: this.autoRelease,
        protocol: 'x402'
      },
      timeoutMinutes: this.defaultTimeout / 60
    });
  }

  /**
   * Retry HTTP request with payment proof
   * 
   * @param {object} httpRequest - Original request
   * @param {object} escrow - Created escrow
   * @param {object} paymentInfo - Payment details
   * @returns {Promise<object>} Response after payment
   */
  async retryWithPayment(httpRequest, escrow, paymentInfo) {
    const paymentProof = {
      escrowId: escrow.id,
      txHash: escrow.txHash,
      amount: escrow.amount,
      token: paymentInfo.token,
      timestamp: Date.now()
    };

    // Add payment proof to request headers
    const headers = {
      ...httpRequest.headers,
      'X-Payment-Proof': JSON.stringify(paymentProof),
      'X-Payment-Escrow-Id': escrow.id,
      'X-Payment-TxHash': escrow.txHash
    };

    // Retry with exponential backoff
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.makeRequest({
          ...httpRequest,
          headers
        });

        if (response.ok) {
          return response;
        }

        if (response.status === 402) {
          throw new Error('Payment proof rejected by server');
        }

        console.warn(`[X402] Retry ${attempt}/${this.maxRetries} failed: ${response.status}`);
      } catch (error) {
        console.error(`[X402] Request failed:`, error.message);
        
        if (attempt === this.maxRetries) {
          throw error;
        }
      }

      // Wait before retry (exponential backoff)
      await this.sleep(this.retryDelay * Math.pow(2, attempt - 1));
    }

    throw new Error(`Failed to retrieve content after ${this.maxRetries} retries`);
  }

  /**
   * Generate HTTP 402 response for service providers
   * 
   * @param {number} amount - Payment amount
   * @param {string} token - Token symbol (USDC, SHIB, etc.)
   * @param {string} recipient - Recipient wallet address
   * @param {string} description - Service description
   * @param {object} options - Additional options
   * @returns {object} 402 response object
   */
  requirePayment(amount, token, recipient, description, options = {}) {
    const escrowId = this.generateEscrowId();
    
    const response = {
      status: 402,
      statusText: 'Payment Required',
      headers: {
        'X-Payment-Amount': amount.toString(),
        'X-Payment-Token': token,
        'X-Payment-Address': recipient,
        'X-Payment-Escrow-Id': escrowId,
        'X-Payment-Description': description,
        'Content-Type': 'application/json'
      },
      body: {
        error: 'Payment Required',
        message: 'This resource requires payment',
        paymentInfo: {
          amount,
          token,
          recipient,
          escrowId,
          description,
          protocol: 'x402',
          network: options.network || 'polygon',
          estimatedGas: options.estimatedGas || 0.003 // USD
        },
        instructions: {
          step1: 'Create escrow with specified amount and recipient',
          step2: 'Fund escrow and obtain transaction hash',
          step3: 'Retry request with X-Payment-Proof header',
          step4: 'Content will be delivered and escrow released automatically'
        }
      }
    };

    return response;
  }

  /**
   * Verify payment proof from client request
   * 
   * @param {object} headers - Request headers
   * @param {number} expectedAmount - Expected payment amount
   * @returns {Promise<object>} Verification result
   */
  async verifyPaymentProof(headers, expectedAmount) {
    const proofHeader = headers['x-payment-proof'] || headers['X-Payment-Proof'];
    const escrowId = headers['x-payment-escrow-id'] || headers['X-Payment-Escrow-Id'];

    if (!proofHeader || !escrowId) {
      return {
        valid: false,
        error: 'Missing payment proof'
      };
    }

    try {
      const proof = typeof proofHeader === 'string' ? JSON.parse(proofHeader) : proofHeader;
      
      // Get escrow from system
      const escrow = this.escrow.get(escrowId);
      
      if (!escrow) {
        return {
          valid: false,
          error: 'Escrow not found'
        };
      }

      // Verify escrow is funded and amount matches
      if (escrow.state !== 'funded' && escrow.state !== 'locked') {
        return {
          valid: false,
          error: `Escrow not funded (state: ${escrow.state})`
        };
      }

      if (escrow.amount < expectedAmount) {
        return {
          valid: false,
          error: `Insufficient payment: ${escrow.amount} < ${expectedAmount}`
        };
      }

      return {
        valid: true,
        escrow,
        proof
      };
    } catch (error) {
      return {
        valid: false,
        error: `Invalid payment proof: ${error.message}`
      };
    }
  }

  /**
   * Helper: Generate escrow ID
   */
  generateEscrowId() {
    return 'x402_' + crypto.randomBytes(16).toString('hex');
  }

  /**
   * Helper: Generate mock transaction hash (for testing)
   */
  generateMockTxHash() {
    return '0x' + crypto.randomBytes(32).toString('hex');
  }

  /**
   * Helper: Make HTTP request (wrapper for fetch/axios)
   */
  async makeRequest(request) {
    // In real implementation, use fetch() or axios
    // For now, return mock response for testing
    
    // Check if payment proof exists
    const hasPayment = request.headers['X-Payment-Proof'];
    
    return {
      ok: hasPayment ? true : false,
      status: hasPayment ? 200 : 402,
      headers: {},
      json: async () => ({
        data: hasPayment ? 'Premium content delivered' : 'Payment required'
      })
    };
  }

  /**
   * Helper: Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get X402 transaction statistics
   */
  getStats() {
    const allEscrows = this.escrow.list();
    const x402Escrows = allEscrows.filter(e => 
      e.purpose && e.purpose.startsWith('X402:')
    );

    const totalVolume = x402Escrows.reduce((sum, e) => sum + e.amount, 0);
    const avgTransaction = x402Escrows.length > 0 ? totalVolume / x402Escrows.length : 0;

    const byState = x402Escrows.reduce((acc, e) => {
      acc[e.state] = (acc[e.state] || 0) + 1;
      return acc;
    }, {});

    return {
      totalTransactions: x402Escrows.length,
      totalVolume,
      avgTransaction: avgTransaction.toFixed(4),
      byState,
      successRate: x402Escrows.length > 0 
        ? ((byState.released || 0) / x402Escrows.length * 100).toFixed(1) + '%'
        : '0%'
    };
  }
}

module.exports = { X402Handler };
