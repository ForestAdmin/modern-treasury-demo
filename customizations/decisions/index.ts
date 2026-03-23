import { Agent } from '@forestadmin/agent';
import { Schema } from '../../typings';

import approveDecision from './actions/approve-decision';
import rejectDecision from './actions/reject-decision';

export default (agent: Agent<Schema>) => {
  agent.customizeCollection('decisions', collection => {
    approveDecision(collection);
    rejectDecision(collection);
  });
};
