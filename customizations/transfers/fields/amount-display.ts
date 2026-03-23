import { TransfersCustomizer } from '../../../typings';

export default (collection: TransfersCustomizer) => {
  collection.addField('amount_display', {
    columnType: 'String',
    dependencies: ['amount', 'currency'],
    getValues: records =>
      records.map(r => {
        if (r.amount == null) return '—';
        return ((r.amount as number) / 100).toLocaleString('en-US', {
          style: 'currency',
          currency: (r.currency as string) ?? 'USD',
        });
      }),
  });
};
