import { TransfersCustomizer } from '../../../typings';

// FEATURES: readonly summary banner, dynamic approval-gate warning (if), required reasoning
export default (collection: TransfersCustomizer) => {
  collection.addAction('Release Payment', {
    scope: 'Single',
    form: [
      // Live summary pulled from the record + related entity
      {
        label: 'Transfer Summary',
        type: 'String',
        isReadOnly: true,
        value: async ctx => {
          const record = await ctx.getRecord(['id', 'amount', 'currency', 'payment_type', 'direction', 'held_reason', 'account_id']);
          const accounts = await ctx.dataSource.getCollection('accounts').list(
            { conditionTree: { field: 'id', operator: 'Equal', value: record.account_id } },
            ['party_name', 'legal_entity_id'],
          );
          const les = accounts.length
            ? await ctx.dataSource.getCollection('legal_entities').list(
                { conditionTree: { field: 'id', operator: 'Equal', value: accounts[0].legal_entity_id } },
                ['risk_rating'],
              )
            : [];
          const amount = ((record.amount as number) / 100).toLocaleString('en-US', {
            style: 'currency',
            currency: (record.currency as string) ?? 'USD',
          });
          const party = accounts[0]?.party_name ?? 'Unknown';
          const risk = les[0]?.risk_rating ?? 'unknown';
          return `${amount} ${String(record.direction).toUpperCase()} via ${String(record.payment_type).toUpperCase()} — ${party} (risk: ${risk}) — held for: ${record.held_reason}`;
        },
      },
      // Approval gate warning — visible only when gate is triggered
      {
        label: '⚠️ Approval Required',
        type: 'String',
        isReadOnly: true,
        if: async ctx => {
          const record = await ctx.getRecord(['amount', 'account_id']);
          const accounts = await ctx.dataSource.getCollection('accounts').list(
            { conditionTree: { field: 'id', operator: 'Equal', value: record.account_id } },
            ['legal_entity_id'],
          );
          if (!accounts.length) return false;
          const les = await ctx.dataSource.getCollection('legal_entities').list(
            { conditionTree: { field: 'id', operator: 'Equal', value: accounts[0].legal_entity_id } },
            ['risk_rating'],
          );
          return (record.amount as number) > 1000000 || les[0]?.risk_rating === 'high';
        },
        value: async () =>
          'This transfer requires Compliance approval (amount > $10,000 or high-risk entity). ' +
          'Submitting will route your request to the Compliance queue — you will not release directly.',
      },
      {
        label: 'Reasoning',
        type: 'String',
        isRequired: true,
        description:
          'Mandatory audit trail entry. Be specific: source of funds, why the amount is consistent with the business profile, any supporting evidence reviewed.',
      },
    ],

    execute: async (context, resultBuilder) => {
      const record = await context.getRecord(['id', 'status', 'amount', 'account_id']);
      if (record.status !== 'held') return resultBuilder.error('Only held payments can be released.');

      const accounts = await context.dataSource.getCollection('accounts').list(
        { conditionTree: { field: 'id', operator: 'Equal', value: record.account_id } },
        ['legal_entity_id'],
      );
      const les = accounts.length
        ? await context.dataSource.getCollection('legal_entities').list(
            { conditionTree: { field: 'id', operator: 'Equal', value: accounts[0].legal_entity_id } },
            ['risk_rating'],
          )
        : [];

      const needsApproval = (record.amount as number) > 1000000 || les[0]?.risk_rating === 'high';
      const reviewer = context.caller.email;
      const reasoning = context.formValues['Reasoning'] as string;

      if (needsApproval) {
        await context.dataSource.getCollection('payment_holds').update(
          {
            conditionTree: {
              aggregator: 'And',
              conditions: [
                { field: 'transfer_id', operator: 'Equal', value: record.id },
                { field: 'status', operator: 'Equal', value: 'active' },
              ],
            },
          },
          {
            status: 'pending_compliance_approval',
            notes: `[Release requested by ${reviewer}]\n${reasoning}`,
            reviewed_by: reviewer,
          },
        );
        return resultBuilder.success(
          'Your release request has been sent to the Compliance queue. You will be notified when a decision is made.',
        );
      }

      await context.collection.update(context.filter, { status: 'processing' });
      await context.dataSource.getCollection('payment_holds').update(
        {
          conditionTree: {
            aggregator: 'And',
            conditions: [
              { field: 'transfer_id', operator: 'Equal', value: record.id },
              { field: 'status', operator: 'Equal', value: 'active' },
            ],
          },
        },
        { status: 'released', reviewed_by: reviewer, reviewed_at: new Date().toISOString(), release_reason: reasoning },
      );

      return resultBuilder.success('Payment released successfully. Transfer is now processing.');
    },
  });
};
