import { Agent } from '@forestadmin/agent';
import { Schema } from '../../typings';

import updateRiskRating from './actions/update-risk-rating';
import suspendCounterparty from './actions/suspend-counterparty';
import requestKycDocuments from './actions/request-kyc-documents';

export default (agent: Agent<Schema>) => {
  agent.customizeCollection('legal_entities', collection => {
    updateRiskRating(collection);
    suspendCounterparty(collection);
    requestKycDocuments(collection);
  });
};
