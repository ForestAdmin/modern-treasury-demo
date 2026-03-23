import { LegalEntitiesCustomizer } from '../../../typings';

export default (collection: LegalEntitiesCustomizer) => {
  collection.addField('tier', {
    columnType: 'Enum',
    enumValues: ['C1', 'C2', 'C3'],
    dependencies: ['id'],
    getValues: async (records, context) => {
      if (!records.length) return [];

      const ids = records.map(r => r.id);

      // Find all entities that are children (have a parent)
      const childRelations = await context.dataSource.getCollection('legal_entity_relationships').list(
        { conditionTree: { field: 'child_legal_entity_id', operator: 'In', value: ids } },
        ['child_legal_entity_id', 'parent_legal_entity_id'],
      );

      // Among parents, find which are themselves children (grandparent chain → C3)
      const parentIds = childRelations.map(r => r.parent_legal_entity_id).filter(Boolean);
      const grandchildRelations = parentIds.length
        ? await context.dataSource.getCollection('legal_entity_relationships').list(
            { conditionTree: { field: 'child_legal_entity_id', operator: 'In', value: parentIds } },
            ['child_legal_entity_id'],
          )
        : [];
      const parentsWithGrandparent = new Set(grandchildRelations.map(r => r.child_legal_entity_id));

      return records.map(r => {
        const rel = childRelations.find(c => c.child_legal_entity_id === r.id);
        if (!rel) return 'C1';
        if (parentsWithGrandparent.has(rel.parent_legal_entity_id)) return 'C3';
        return 'C2';
      });
    },
  });

  // Filterable: translate tier value into a condition on legal_entity_relationships
  (collection as any).emulateFieldFiltering('tier');
};
