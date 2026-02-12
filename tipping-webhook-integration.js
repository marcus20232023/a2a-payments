/**
 * Tipping-Webhook Integration
 * 
 * Automatically emits webhook events when tips are created and confirmed
 * This module bridges the tipping system with the webhook event system
 */

const { WebhookManager } = require('./event-webhooks');
const { TippingSystem } = require('./tipping');

class TippingWithWebhooks extends TippingSystem {
  constructor(storePath = './tips-state.json', webhookManager = null) {
    super(storePath);
    this.webhookManager = webhookManager || new WebhookManager();
  }

  /**
   * Create tip and emit event
   */
  create(params) {
    const tip = super.create(params);

    // Emit tip_created event
    this.webhookManager.emit('tip_created', {
      tipId: tip.id,
      sender: tip.sender,
      recipient: tip.recipient,
      amount: tip.amount,
      token: tip.token,
      reason: tip.reason,
      createdAt: tip.createdAt
    }).catch(error => {
      console.error('Failed to emit tip_created event:', error);
    });

    return tip;
  }

  /**
   * Mark tip as sent and emit event
   */
  markSent(tipId, txHash = null) {
    const tip = super.markSent(tipId, txHash);

    // Emit tip_sent event
    this.webhookManager.emit('tip_sent', {
      tipId: tip.id,
      sender: tip.sender,
      recipient: tip.recipient,
      amount: tip.amount,
      token: tip.token,
      txHash: tip.txHash,
      sentAt: tip.sentAt
    }).catch(error => {
      console.error('Failed to emit tip_sent event:', error);
    });

    return tip;
  }

  /**
   * Confirm tip and emit received event
   */
  confirm(tipId, confirmationData = {}) {
    const tip = super.confirm(tipId, confirmationData);

    // Emit tipping_received event (main event for listeners)
    this.webhookManager.emit('tipping_received', {
      tipId: tip.id,
      sender: tip.sender,
      recipient: tip.recipient,
      amount: tip.amount,
      token: tip.token,
      reason: tip.reason,
      txHash: tip.txHash,
      confirmedAt: tip.confirmedAt
    }).catch(error => {
      console.error('Failed to emit tipping_received event:', error);
    });

    return tip;
  }

  /**
   * Get received tips and emit acknowledgment
   */
  getReceivedTips(recipient, limit = 100) {
    const tips = super.getReceivedTips(recipient, limit);

    // Emit a stats event for recipient
    if (tips.length > 0) {
      const totalReceived = this.getTotalReceived(recipient);
      this.webhookManager.emit('recipient_stats_updated', {
        recipient: recipient,
        totalTipsReceived: tips.length,
        totalAmount: totalReceived,
        updatedAt: Date.now()
      }).catch(error => {
        console.error('Failed to emit recipient_stats_updated event:', error);
      });
    }

    return tips;
  }

  /**
   * Payment settled event
   */
  settlePayment(tipId, settlementData = {}) {
    const tip = this.get(tipId);
    if (!tip) {
      throw new Error('Tip not found');
    }

    // Update tip with settlement data
    tip.metadata.settlementData = settlementData;
    tip.metadata.settledAt = Date.now();
    this.saveState();

    // Emit payment_settled event
    this.webhookManager.emit('payment_settled', {
      tipId: tip.id,
      sender: tip.sender,
      recipient: tip.recipient,
      amount: tip.amount,
      token: tip.token,
      settlementData: settlementData,
      settledAt: tip.metadata.settledAt
    }).catch(error => {
      console.error('Failed to emit payment_settled event:', error);
    });

    return tip;
  }
}

module.exports = { TippingWithWebhooks };
