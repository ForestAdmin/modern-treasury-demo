import { TransfersCustomizer } from '../../../typings';

export default (collection: TransfersCustomizer) => {
  collection.addField('sardine_alert_reason', {
    columnType: 'String',
    dependencies: ['id'],
    getValues: async (records, context) => {
      if (!records.length) return [];

      const ids = records.map(r => r.id);
      const verifications = await context.dataSource.getCollection('verifications').list(
        {
          conditionTree: {
            aggregator: 'And',
            conditions: [
              { field: 'transfer_id', operator: 'In', value: ids },
              { field: 'vendor_id', operator: 'Equal', value: 'sardine' },
            ],
          },
        },
        ['transfer_id', 'data'],
      );

      return records.map(r => {
        const v = verifications.find(v => v.transfer_id === r.id);
        if (!v?.data) return null;
        const data = typeof v.data === 'string' ? JSON.parse(v.data) : v.data;
        const signals: string[] = data?.signals ?? [];
        return signals.length ? signals.join(', ') : null;
      });
    },
  });
};
