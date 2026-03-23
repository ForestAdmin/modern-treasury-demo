import { LegalEntitiesCustomizer } from '../../../typings';

export default (collection: LegalEntitiesCustomizer) => {
  collection.addField('active_transfers_held_count', {
    columnType: 'Number',
    dependencies: ['id'],
    getValues: async (records, context) => {
      if (!records.length) return [];

      const entityIds = records.map(r => r.id);

      // Get all accounts linked to these legal entities
      const accounts = await context.dataSource.getCollection('accounts').list(
        { conditionTree: { field: 'legal_entity_id', operator: 'In', value: entityIds } },
        ['id', 'legal_entity_id'],
      );

      if (!accounts.length) return records.map(() => 0);

      const accountIds = accounts.map(a => a.id);

      // Count held transfers per account, then group back to legal entity
      const heldTransfers = await context.dataSource.getCollection('transfers').aggregate(
        {
          conditionTree: {
            aggregator: 'And',
            conditions: [
              { field: 'account_id', operator: 'In', value: accountIds },
              { field: 'status', operator: 'Equal', value: 'held' },
            ],
          },
        },
        { operation: 'Count', groups: [{ field: 'account_id' }] },
      );

      // Build a map: legal_entity_id → count
      const countByEntity: Record<number, number> = {};
      for (const row of heldTransfers) {
        const accountId = row.group?.['account_id'] as number;
        const account = accounts.find(a => a.id === accountId);
        if (!account) continue;
        const leId = account.legal_entity_id as number;
        countByEntity[leId] = (countByEntity[leId] ?? 0) + (row.value as number);
      }

      return records.map(r => countByEntity[r.id as number] ?? 0);
    },
  });
};
