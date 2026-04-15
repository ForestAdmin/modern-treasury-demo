import { Agent } from '@forestadmin/agent';
import { Schema } from '../../typings';

import updateRiskRating from './actions/update-risk-rating';
import suspendCounterparty from './actions/suspend-counterparty';
import requestKycDocuments from './actions/request-kyc-documents';
import approveKyc from './actions/approve-kyc';
import declineKyc from './actions/decline-kyc';
import addToBlocklist from './actions/add-to-blocklist';

import tier from './fields/tier';
import activeTransfersHeldCount from './fields/active-transfers-held-count';
import kybStatus from './fields/kyb-status';
import displayName from './fields/display-name';
import personaKycStatus from './fields/persona-kyc-status';
import personaWatchlistHit from './fields/persona-watchlist-hit';
import personaVerificationSummary from './fields/persona-verification-summary';
import personaInquiryDate from './fields/persona-inquiry-date';

export default (agent: Agent<Schema>) => {
  agent.customizeCollection('legal_entities', collection => {
    updateRiskRating(collection);
    suspendCounterparty(collection);
    requestKycDocuments(collection);
    approveKyc(collection);
    declineKyc(collection);
    addToBlocklist(collection);

    tier(collection);
    activeTransfersHeldCount(collection);
    kybStatus(collection);
    displayName(collection);
    personaKycStatus(collection);
    personaWatchlistHit(collection);
    personaVerificationSummary(collection);
    personaInquiryDate(collection);
  });
};
