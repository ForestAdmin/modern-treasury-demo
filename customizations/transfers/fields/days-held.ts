import { TransfersCustomizer } from '../../../typings';

export default (collection: TransfersCustomizer) => {
  collection.addField('days_held', {
    columnType: 'Number',
    dependencies: ['held_at'],
    getValues: records =>
      records.map(r => {
        if (!r.held_at) return null;
        const ms = Date.now() - new Date(r.held_at as string).getTime();
        return Math.floor(ms / (1000 * 60 * 60 * 24));
      }),
  });

  // Sortable: delegate to the underlying held_at column
  (collection as any).replaceFieldSorting('days_held', [{ field: 'held_at', ascending: false }]);
};
