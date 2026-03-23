import { LegalEntitiesCustomizer } from '../../../typings';

export default (collection: LegalEntitiesCustomizer) => {
  collection.addField('kyb_status', {
    columnType: 'Enum',
    enumValues: ['approved', 'pending', 'rejected', 'not_started'],
    dependencies: ['id'],
    getValues: async (records, context) => {
      if (!records.length) return [];

      const ids = records.map(r => r.id);

      // Fetch the most recent decision per legal entity
      const decisions = await context.dataSource.getCollection('decisions').list(
        {
          conditionTree: { field: 'legal_entity_id', operator: 'In', value: ids },
          sort: [{ field: 'created_at', ascending: false }],
        },
        ['legal_entity_id', 'status'],
      );

      return records.map(r => {
        // First match = most recent (list sorted desc)
        const decision = decisions.find(d => d.legal_entity_id === r.id);
        return (decision?.status as string) ?? 'not_started';
      });
    },
  });
};
