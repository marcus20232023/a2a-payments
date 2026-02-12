/**
 * Tipping System for A2A Payments
 * 
 * Allows agents to send tips to other agents or addresses
 * Features:
 * - Tip creation and tracking
 * - Tip history by recipient
 * - Tip statistics
 * - Integration with webhook events
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class TippingSystem {
  constructor(storePath = './tips-state.json') {
    this.storePath = storePath;
    this.tips = this.loadState();
  }

  loadState() {
    if (fs.existsSync(this.storePath)) {
      try {
        const data = fs.readFileSync(this.storePath, 'utf8');
        return JSON.parse(data);
      } catch (error) {
        console.error('Error loading tips state:', error);
        return {};
      }
    }
    return {};
  }

  saveState() {
    try {
      fs.writeFileSync(this.storePath, JSON.stringify(this.tips, null, 2));
    } catch (error) {
      console.error('Error saving tips state:', error);
    }
  }

  /**
   * Create a tip
   * 
   * @param {object} params
   * @param {string} params.sender - Agent ID or address of sender
   * @param {string} params.recipient - Agent ID or address of recipient
   * @param {number} params.amount - Tip amount
   * @param {string} params.token - Token symbol (SHIB, USDC, etc.)
   * @param {string} params.reason - Reason for tip (optional)
   * @param {object} params.metadata - Additional metadata (optional)
   * @returns {object} Tip record
   */
  create({ sender, recipient, amount, token = 'SHIB', reason = '', metadata = {} }) {
    if (!sender || !recipient) {
      throw new Error('Sender and recipient are required');
    }

    if (amount <= 0) {
      throw new Error('Tip amount must be greater than 0');
    }

    const tipId = 'tip_' + crypto.randomBytes(16).toString('hex');
    const now = Date.now();

    const tip = {
      id: tipId,
      sender,
      recipient,
      amount,
      token,
      reason,
      status: 'pending', // pending → sent → confirmed
      createdAt: now,
      sentAt: null,
      confirmedAt: null,
      txHash: null,
      metadata
    };

    this.tips[tipId] = tip;
    this.saveState();

    return tip;
  }

  /**
   * Mark tip as sent
   */
  markSent(tipId, txHash = null) {
    const tip = this.tips[tipId];
    if (!tip) {
      throw new Error('Tip not found');
    }

    if (tip.status !== 'pending') {
      throw new Error(`Cannot mark tip as sent from state: ${tip.status}`);
    }

    tip.status = 'sent';
    tip.sentAt = Date.now();
    if (txHash) {
      tip.txHash = txHash;
    }

    this.saveState();
    return tip;
  }

  /**
   * Confirm tip (mark as delivered/complete)
   */
  confirm(tipId, confirmationData = {}) {
    const tip = this.tips[tipId];
    if (!tip) {
      throw new Error('Tip not found');
    }

    if (!['pending', 'sent'].includes(tip.status)) {
      throw new Error(`Cannot confirm tip in state: ${tip.status}`);
    }

    tip.status = 'confirmed';
    tip.confirmedAt = Date.now();
    
    if (confirmationData.txHash) {
      tip.txHash = confirmationData.txHash;
    }

    if (confirmationData.blockNumber) {
      tip.metadata.blockNumber = confirmationData.blockNumber;
    }

    this.saveState();
    return tip;
  }

  /**
   * Get tip by ID
   */
  get(tipId) {
    return this.tips[tipId] || null;
  }

  /**
   * List tips with filters
   */
  list(filters = {}) {
    let results = Object.values(this.tips);

    if (filters.sender) {
      results = results.filter(t => t.sender === filters.sender);
    }

    if (filters.recipient) {
      results = results.filter(t => t.recipient === filters.recipient);
    }

    if (filters.status) {
      results = results.filter(t => t.status === filters.status);
    }

    if (filters.token) {
      results = results.filter(t => t.token === filters.token);
    }

    if (filters.minAmount) {
      results = results.filter(t => t.amount >= filters.minAmount);
    }

    if (filters.startDate) {
      results = results.filter(t => t.createdAt >= filters.startDate);
    }

    if (filters.endDate) {
      results = results.filter(t => t.createdAt <= filters.endDate);
    }

    return results;
  }

  /**
   * Get tips for recipient (all received tips)
   */
  getReceivedTips(recipient, limit = 100) {
    return this.list({ recipient })
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  /**
   * Get tips from sender
   */
  getSentTips(sender, limit = 100) {
    return this.list({ sender })
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  /**
   * Get total tips received by recipient
   */
  getTotalReceived(recipient, token = null) {
    const tips = this.list({
      recipient,
      status: 'confirmed',
      token
    });

    return tips.reduce((sum, t) => sum + t.amount, 0);
  }

  /**
   * Get total tips sent by sender
   */
  getTotalSent(sender, token = null) {
    const tips = this.list({
      sender,
      status: 'confirmed',
      token
    });

    return tips.reduce((sum, t) => sum + t.amount, 0);
  }

  /**
   * Get tip statistics
   */
  getStats(filters = {}) {
    const tips = this.list(filters);

    const stats = {
      total: tips.length,
      byStatus: {
        pending: 0,
        sent: 0,
        confirmed: 0
      },
      totalAmount: 0,
      confirmedAmount: 0,
      averageTip: 0,
      largestTip: 0,
      smallestTip: Infinity,
      byToken: {},
      topRecipients: [],
      topSenders: []
    };

    // Count by status and amount
    for (const tip of tips) {
      stats.byStatus[tip.status]++;
      stats.totalAmount += tip.amount;
      
      if (tip.status === 'confirmed') {
        stats.confirmedAmount += tip.amount;
      }

      stats.largestTip = Math.max(stats.largestTip, tip.amount);
      stats.smallestTip = Math.min(stats.smallestTip, tip.amount);

      // By token
      if (!stats.byToken[tip.token]) {
        stats.byToken[tip.token] = { count: 0, amount: 0 };
      }
      stats.byToken[tip.token].count++;
      stats.byToken[tip.token].amount += tip.amount;
    }

    // Calculate averages
    if (tips.length > 0) {
      stats.averageTip = (stats.totalAmount / tips.length).toFixed(2);
    }

    if (stats.smallestTip === Infinity) {
      stats.smallestTip = 0;
    }

    // Top recipients
    const recipientMap = {};
    for (const tip of tips.filter(t => t.status === 'confirmed')) {
      if (!recipientMap[tip.recipient]) {
        recipientMap[tip.recipient] = { recipient: tip.recipient, count: 0, amount: 0 };
      }
      recipientMap[tip.recipient].count++;
      recipientMap[tip.recipient].amount += tip.amount;
    }

    stats.topRecipients = Object.values(recipientMap)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    // Top senders
    const senderMap = {};
    for (const tip of tips.filter(t => t.status === 'confirmed')) {
      if (!senderMap[tip.sender]) {
        senderMap[tip.sender] = { sender: tip.sender, count: 0, amount: 0 };
      }
      senderMap[tip.sender].count++;
      senderMap[tip.sender].amount += tip.amount;
    }

    stats.topSenders = Object.values(senderMap)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    return stats;
  }

  /**
   * Leaderboard - most tipped recipients
   */
  getLeaderboard(limit = 10, token = null) {
    const recipientMap = {};
    const tips = token
      ? this.list({ token, status: 'confirmed' })
      : this.list({ status: 'confirmed' });

    for (const tip of tips) {
      if (!recipientMap[tip.recipient]) {
        recipientMap[tip.recipient] = {
          recipient: tip.recipient,
          totalTips: 0,
          totalAmount: 0,
          count: 0
        };
      }
      recipientMap[tip.recipient].totalAmount += tip.amount;
      recipientMap[tip.recipient].count++;
    }

    return Object.values(recipientMap)
      .map(r => ({
        ...r,
        averageTip: (r.totalAmount / r.count).toFixed(2)
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, limit);
  }
}

module.exports = { TippingSystem };
