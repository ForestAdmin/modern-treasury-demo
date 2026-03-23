import { Agent } from '@forestadmin/agent';
import { Schema } from '../../typings';

import approveVerification from './actions/approve-verification';
import rejectVerification from './actions/reject-verification';

export default (agent: Agent<Schema>) => {
  agent.customizeCollection('verifications', collection => {
    approveVerification(collection);
    rejectVerification(collection);
  });
};
