import { LegalEntitiesCustomizer } from '../../../typings';

export default (collection: LegalEntitiesCustomizer) => {
  collection.addField('display_name', {
    columnType: 'String',
    dependencies: ['individual_id', 'business_id'],
    getValues: async (records, context) => {
      const individualIds = records.map(r => r.individual_id).filter(Boolean);
      const businessIds = records.map(r => r.business_id).filter(Boolean);

      const [individuals, businesses] = await Promise.all([
        individualIds.length
          ? context.dataSource.getCollection('individuals').list(
              { conditionTree: { field: 'id', operator: 'In', value: individualIds } },
              ['id', 'first_name', 'last_name'],
            )
          : [],
        businessIds.length
          ? context.dataSource.getCollection('businesses').list(
              { conditionTree: { field: 'id', operator: 'In', value: businessIds } },
              ['id', 'business_name'],
            )
          : [],
      ]);

      return records.map(r => {
        if (r.business_id) {
          const biz = (businesses as any[]).find(b => b.id === r.business_id);
          return (biz?.business_name as string) ?? null;
        }
        if (r.individual_id) {
          const ind = (individuals as any[]).find(i => i.id === r.individual_id);
          if (!ind) return null;
          return [ind.first_name, ind.last_name].filter(Boolean).join(' ') || null;
        }
        return null;
      });
    },
  });
};
