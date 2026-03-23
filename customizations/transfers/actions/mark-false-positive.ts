import { TransfersCustomizer } from '../../../typings';

// FEATURES: Bulk scope, dynamic isRequired on justification based on amount
export default (collection: TransfersCustomizer) => {
  collection.addAction('Mark as False Positive', {
    scope: 'Bulk',
    form: [
      {
        label: 'False Positive Category',
        type: 'Enum',
        enumValues: [
          'known_counterparty_recurring_payment',
          'internal_test_transaction',
          'model_error_low_risk_confirmed',
          'rule_misconfiguration',
        ],
        isRequired: true,
      },
      {
        label: 'Justification',
        type: 'String',
        isRequired: async ctx => {
          // Mandatory when any selected transfer exceeds $5k
          const records = await ctx.getRecords(['amount']);
          return records.some(r => (r.amount as number) > 500000);
        },
        description: 'Required for transfers above $5,000. Used to improve the fraud model.',
      },
      {
        label: 'Suppress future alerts for this counterparty',
        type: 'Boolean',
        value: async () => false,
        description: 'Add this counterparty to the low-risk allowlist for future transactions.',
      },
    ],

    execute: async (context, resultBuilder) => {
      const records = await context.getRecords(['id', 'status']);
      const category = context.formValues['False Positive Category'] as string;
      const reviewer = context.caller.email;

      const held = records.filter(r => r.status === 'held');
      if (!held.length) return resultBuilder.error('No held transfers in selection.');

      for (const record of held) {
        await context.dataSource.getCollection('transfers').update(
          { conditionTree: { field: 'id', operator: 'Equal', value: record.id } },
          { status: 'processing', approved_at: new Date().toISOString() },
        );
        await context.dataSource.getCollection('payment_holds').update(
          { conditionTree: { field: 'transfer_id', operator: 'Equal', value: record.id } },
          { status: 'released', reviewed_by: reviewer, reviewed_at: new Date().toISOString(), release_reason: `false_positive:${category}` },
        );
      }

      return resultBuilder.success(
        `${held.length} transfer(s) marked as false positive (${category}) and released.`,
      );
    },
  });
};
