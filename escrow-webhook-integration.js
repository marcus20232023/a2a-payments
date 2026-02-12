/**
 * Escrow-Webhook Integration
 * 
 * Automatically emits webhook events when escrow state changes
 * This module bridges the escrow system with the webhook event system
 */

const { WebhookManager } = require('./event-webhooks');
const { EscrowSystem } = require('./escrow');

class EscrowWithWebhooks extends EscrowSystem {
  constructor(storePath = './escrow-state.json', webhookManager = null) {
    super(storePath);
    this.webhookManager = webhookManager || new WebhookManager();
  }

  /**
   * Create escrow and emit event
   */
  create(params) {
    const escrow = super.create(params);

    // Emit webhook event
    this.webhookManager.emit('escrow_created', {
      escrowId: escrow.id,
      payer: escrow.payer,
      payee: escrow.payee,
      amount: escrow.amount,
      token: params.token || 'SHIB',
      purpose: escrow.purpose,
      conditions: escrow.conditions,
      createdAt: escrow.timeline.created
    }).catch(error => {
      console.error('Failed to emit escrow_created event:', error);
    });

    return escrow;
  }

  /**
   * Fund escrow and emit event
   */
  fund(escrowId, txHash) {
    const escrow = super.fund(escrowId, txHash);

    // Emit webhook event
    this.webhookManager.emit('escrow_funded', {
      escrowId: escrow.id,
      payer: escrow.payer,
      payee: escrow.payee,
      amount: escrow.amount,
      txHash: escrow.txHash,
      fundedAt: escrow.timeline.funded
    }).catch(error => {
      console.error('Failed to emit escrow_funded event:', error);
    });

    return escrow;
  }

  /**
   * Approve and lock escrow, emit event
   */
  approve(escrowId, approverId) {
    const escrow = super.approve(escrowId, approverId);

    // Only emit lock event when transitioning to locked state
    if (escrow.state === 'locked') {
      this.webhookManager.emit('escrow_locked', {
        escrowId: escrow.id,
        payer: escrow.payer,
        payee: escrow.payee,
        amount: escrow.amount,
        approvals: escrow.approvals,
        lockedAt: escrow.timeline.locked
      }).catch(error => {
        console.error('Failed to emit escrow_locked event:', error);
      });
    }

    return escrow;
  }

  /**
   * Submit delivery and emit event
   */
  submitDelivery(escrowId, proof) {
    const escrow = super.submitDelivery(escrowId, proof);

    // Emit delivery proof event (if not auto-released)
    if (escrow.state === 'locked') {
      this.webhookManager.emit('delivery_proof_submitted', {
        escrowId: escrow.id,
        deliveryProof: {
          submittedBy: escrow.deliveryProof.submittedBy,
          timestamp: escrow.deliveryProof.timestamp
        }
      }).catch(error => {
        console.error('Failed to emit delivery_proof_submitted event:', error);
      });
    }

    return escrow;
  }

  /**
   * Release escrow and emit event
   */
  release(escrowId, reason = 'manual release') {
    const escrow = super.release(escrowId, reason);

    // Emit webhook event
    this.webhookManager.emit('escrow_released', {
      escrowId: escrow.id,
      payer: escrow.payer,
      payee: escrow.payee,
      amount: escrow.amount,
      reason: reason,
      releasedAt: escrow.timeline.released
    }).catch(error => {
      console.error('Failed to emit escrow_released event:', error);
    });

    return escrow;
  }

  /**
   * Refund escrow and emit event
   */
  refund(escrowId, reason = 'manual refund') {
    const escrow = super.refund(escrowId, reason);

    // Emit webhook event
    this.webhookManager.emit('escrow_refunded', {
      escrowId: escrow.id,
      payer: escrow.payer,
      payee: escrow.payee,
      amount: escrow.amount,
      reason: reason,
      refundedAt: escrow.timeline.refunded
    }).catch(error => {
      console.error('Failed to emit escrow_refunded event:', error);
    });

    return escrow;
  }

  /**
   * Open dispute and emit event
   */
  dispute(escrowId, disputerId, reason) {
    const escrow = super.dispute(escrowId, reason);

    // Emit webhook event
    this.webhookManager.emit('escrow_disputed', {
      escrowId: escrow.id,
      payer: escrow.payer,
      payee: escrow.payee,
      amount: escrow.amount,
      disputerId: disputerId,
      reason: reason,
      disputedAt: escrow.timeline.disputed
    }).catch(error => {
      console.error('Failed to emit escrow_disputed event:', error);
    });

    return escrow;
  }

  /**
   * Resolve dispute and emit appropriate event
   */
  resolveDispute(escrowId, decision, arbiter) {
    const escrow = super.resolveDispute(escrowId, decision, arbiter);

    // The parent method already calls release or refund, 
    // so events are emitted there
    // But we can emit an additional resolution event if needed
    this.webhookManager.emit('dispute_resolved', {
      escrowId: escrow.id,
      decision: decision,
      arbiter: arbiter,
      resolvedAt: Date.now()
    }).catch(error => {
      console.error('Failed to emit dispute_resolved event:', error);
    });

    return escrow;
  }

  /**
   * Process timeouts and emit refund events
   */
  processTimeouts() {
    const expired = super.processTimeouts();

    // Emit events for each expired escrow
    for (const escrowId of expired) {
      const escrow = this.get(escrowId);
      if (escrow) {
        this.webhookManager.emit('escrow_timeout', {
          escrowId: escrow.id,
          payer: escrow.payer,
          payee: escrow.payee,
          amount: escrow.amount,
          timeoutAt: escrow.timeline.refunded
        }).catch(error => {
          console.error('Failed to emit escrow_timeout event:', error);
        });
      }
    }

    return expired;
  }
}

module.exports = { EscrowWithWebhooks };
