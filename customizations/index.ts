import { Agent } from '@forestadmin/agent';
import { Schema } from '../typings';

import customizeTransfers from './transfers';
import customizeLegalEntities from './legal_entities';
import customizeVerifications from './verifications';
import customizeDecisions from './decisions';

export default (agent: Agent<Schema>) => {
  customizeTransfers(agent);
  customizeLegalEntities(agent);
  customizeVerifications(agent);
  customizeDecisions(agent);
};
