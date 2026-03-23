import { TransfersCustomizer } from '../../../typings';

// FEATURES: Enum with conditional follow-up field, dynamic description based on rejection type
export default (collection: TransfersCustomizer) => {
  collection.addAction('Reject Release', {
    scope: 'Single',
    form: [
      {
        label: 'Rejection Type',
        type: 'Enum',
        enumValues: ['return_to_l1_for_rfi', 'return_to_l1_insufficient_reasoning', 'block_transfer'],
        isRequired: true,
        description: 'Choose "block" only if the transfer must be permanently cancelled.',
      },
      {
        label: 'Comment for L1 Operator',
        type: 'String',
        isRequired: true,
        description: 'Explain what is missing or what action the L1 operator must take.',
        // Only shown for return_to_l1 types
        if: async ctx =>
          (ctx.formValues['Rejection Type'] as string)?.startsWith('return_to_l1'),
      },
      {
        label: 'Blocking Justification',
        type: 'String',
        isRequired: true,
        description: 'Regulatory or compliance justification for permanently blocking this transfer.',
        // Only shown when blocking
        if: async ctx => ctx.formValues['Rejection Type'] === 'block_transfer',
      },
    ],

    execute: async (context, resultBuilder) => {
      const record = await context.getRecord(['id']);
      const rejectionType = context.formValues['Rejection Type'] as string;
      const reviewer = context.caller.email;

      if (rejectionType === 'block_transfer') {
        const justification = context.formValues['Blocking Justification'] as string;
        await context.collection.update(context.filter, { status: 'cancelled', cancelled_at: new Date().toISOString() });
        await context.dataSource.getCollection('payment_holds').update(
          { conditionTree: { field: 'transfer_id', operator: 'Equal', value: record.id } },
          { status: 'cancelled', reviewed_by: reviewer, reviewed_at: new Date().toISOString(), release_reason: `BLOCKED: ${justification}` },
        );
        return resultBuilder.success('Transfer has been blocked and cancelled.');
      }

      const comment = context.formValues['Comment for L1 Operator'] as string;
      await context.collection.update(context.filter, { status: 'held' });
      await context.dataSource.getCollection('payment_holds').update(
        { conditionTree: { field: 'transfer_id', operator: 'Equal', value: record.id } },
        {
          status: 'active',
          notes: `[Rejected by Compliance — ${rejectionType}]\n${comment}`,
          reviewed_by: reviewer,
        },
      );

      return resultBuilder.success(
        `Release rejected. Case returned to L1 queue with comment: "${comment}"`,
      );
    },
  });
};
