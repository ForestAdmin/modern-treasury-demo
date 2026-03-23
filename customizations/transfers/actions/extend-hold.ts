import { TransfersCustomizer } from '../../../typings';

// FEATURES: Date picker, readonly current expiry pre-filled, Bulk scope
export default (collection: TransfersCustomizer) => {
  collection.addAction('Extend Hold', {
    scope: 'Bulk',
    form: [
      {
        label: 'Current Expiry',
        type: 'String',
        isReadOnly: true,
        value: async ctx => {
          const records = await ctx.getRecords(['id']);
          if (records.length !== 1) return 'Multiple records selected.';
          const holds = await ctx.dataSource.getCollection('payment_holds').list(
            { conditionTree: { field: 'transfer_id', operator: 'Equal', value: records[0].id } },
            ['expires_at'],
          );
          const exp = holds[0]?.expires_at;
          return exp ? new Date(exp as string).toLocaleString() : 'No expiry set';
        },
      },
      {
        label: 'New Expiry Date',
        type: 'Date',
        isRequired: true,
        description: 'The hold will remain active until this date. Must be in the future.',
      },
      {
        label: 'Extension Reason',
        type: 'Enum',
        enumValues: [
          'awaiting_rfi_response',
          'ongoing_investigation',
          'pending_regulatory_guidance',
          'counterparty_verification_in_progress',
        ],
        isRequired: true,
      },
    ],

    execute: async (context, resultBuilder) => {
      const records = await context.getRecords(['id']);
      const newExpiry = context.formValues['New Expiry Date'] as string;
      const reason = context.formValues['Extension Reason'] as string;
      const reviewer = context.caller.email;

      if (new Date(newExpiry) <= new Date()) return resultBuilder.error('New expiry date must be in the future.');

      for (const record of records) {
        await context.dataSource.getCollection('payment_holds').update(
          {
            conditionTree: {
              aggregator: 'And',
              conditions: [
                { field: 'transfer_id', operator: 'Equal', value: record.id },
                { field: 'status', operator: 'In', value: ['active', 'awaiting_response'] },
              ],
            },
          },
          {
            expires_at: newExpiry,
            notes: `[Hold extended to ${new Date(newExpiry).toLocaleDateString()} by ${reviewer} — ${reason}]`,
          },
        );
        await context.dataSource.getCollection('transfers').update(
          { conditionTree: { field: 'id', operator: 'Equal', value: record.id } },
          { hold_expires_at: newExpiry },
        );
      }

      return resultBuilder.success(
        `Hold extended to ${new Date(newExpiry).toLocaleDateString()} for ${records.length} transfer(s).`,
      );
    },
  });
};
