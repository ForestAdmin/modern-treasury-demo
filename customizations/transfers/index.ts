import { Agent } from '@forestadmin/agent';
import { Schema } from '../../typings';

import sendRfi from './actions/send-rfi';
import releasePayment from './actions/release-payment';
import escalateToCompliance from './actions/escalate-to-compliance';
import blockPayment from './actions/block-payment';
import approveRelease from './actions/approve-release';
import rejectRelease from './actions/reject-release';
import addReviewNote from './actions/add-review-note';
import extendHold from './actions/extend-hold';
import markFalsePositive from './actions/mark-false-positive';

import amountDisplay from './fields/amount-display';
import daysHeld from './fields/days-held';
import slaStatus from './fields/sla-status';
import sardineRiskScore from './fields/sardine-risk-score';
import sardineAlertReason from './fields/sardine-alert-reason';

export default (agent: Agent<Schema>) => {
  agent.customizeCollection('transfers', collection => {
    sendRfi(collection);
    releasePayment(collection);
    escalateToCompliance(collection);
    blockPayment(collection);
    approveRelease(collection);
    rejectRelease(collection);
    addReviewNote(collection);
    extendHold(collection);
    markFalsePositive(collection);

    amountDisplay(collection);
    daysHeld(collection);
    slaStatus(collection);
    sardineRiskScore(collection);
    sardineAlertReason(collection);
  });
};
