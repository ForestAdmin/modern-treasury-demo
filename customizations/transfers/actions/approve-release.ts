import { TransfersCustomizer } from '../../../typings';

// FEATURES: readonly pre-filled fields (reviewer identity, transfer details), simple approval notes
export default (collection: TransfersCustomizer) => {
  collection.addAction('Approve Release', {
    scope: 'Single',
    form: [
      {
        label: 'Reviewed By',
        type: 'String',
        isReadOnly: true,
        value: async ctx => ctx.caller.email,
      },
      {
        label: 'L1 Reasoning',
        type: 'String',
        isReadOnly: true,
        value: async ctx => {
          const record = await ctx.getRecord(['id']);
          const holds = await ctx.dataSource.getCollection('payment_holds').list(
            { conditionTree: { field: 'transfer_id', operator: 'Equal', value: record.id } },
            ['notes', 'reviewed_by'],
          );
          return holds[0]?.notes ?? 'No reasoning recorded.';
        },
        description: 'Reasoning submitted by the L1 operator requesting release.',
      },
      {
        label: 'Compliance Notes',
        type: 'String',
        description: 'Optional — add context for the audit trail (regulatory basis, additional checks performed).',
      },
    ],

    execute: async (context, resultBuilder) => {
      const record = await context.getRecord(['id', 'status']);
      const reviewer = context.caller.email;
      const notes = context.formValues['Compliance Notes'] as string;

      await context.collection.update(context.filter, { status: 'processing', approved_at: new Date().toISOString() });
      await context.dataSource.getCollection('payment_holds').update(
        {
          conditionTree: {
            aggregator: 'And',
            conditions: [
              { field: 'transfer_id', operator: 'Equal', value: record.id },
              { field: 'status', operator: 'Equal', value: 'pending_compliance_approval' },
            ],
          },
        },
        {
          status: 'released',
          reviewed_by: reviewer,
          reviewed_at: new Date().toISOString(),
          release_reason: notes || 'Approved by Compliance.',
        },
      );

      return resultBuilder.success('Release approved. Transfer is now processing.');
    },
  });
};
