import { Agent } from '@forestadmin/agent';
import { Schema } from '../../typings';

import updateRiskRating from './actions/update-risk-rating';
import suspendCounterparty from './actions/suspend-counterparty';
import requestKycDocuments from './actions/request-kyc-documents';

import tier from './fields/tier';
import activeTransfersHeldCount from './fields/active-transfers-held-count';
import kybStatus from './fields/kyb-status';
import displayName from './fields/display-name';

export default (agent: Agent<Schema>) => {
  agent.customizeCollection('legal_entities', collection => {
    updateRiskRating(collection);
    suspendCounterparty(collection);
    requestKycDocuments(collection);

    tier(collection);
    activeTransfersHeldCount(collection);
    kybStatus(collection);
    displayName(collection);
  });
};
