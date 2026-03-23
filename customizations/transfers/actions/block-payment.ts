import { TransfersCustomizer } from '../../../typings';

// FEATURES: readonly warning banner, required text reason, Boolean confirmation (irreversible action)
export default (collection: TransfersCustomizer) => {
  collection.addAction('Block Payment', {
    scope: 'Single',
    form: [
      {
        label: '🚨 Irreversible Action',
        type: 'String',
        isReadOnly: true,
        value: async () =>
          'Blocking a payment permanently cancels the transfer. This action requires four-eyes validation ' +
          'and cannot be undone. Only proceed if you have confirmed authority to block.',
      },
      {
        label: 'Blocking Reason',
        type: 'String',
        isRequired: true,
        description: 'Provide the exact regulatory or compliance justification. This will appear in the audit trail.',
      },
      {
        label: 'I confirm this action is irreversible',
        type: 'Boolean',
        isRequired: true,
        value: async () => false,
      },
    ],

    execute: async (context, resultBuilder) => {
      const confirmed = context.formValues['I confirm this action is irreversible'] as boolean;
      if (!confirmed) return resultBuilder.error('You must confirm that this action is irreversible.');

      const record = await context.getRecord(['id', 'status']);
      if (record.status === 'cancelled') return resultBuilder.error('This transfer is already cancelled.');

      const reason = context.formValues['Blocking Reason'] as string;
      const reviewer = context.caller.email;

      await context.collection.update(context.filter, { status: 'cancelled', cancelled_at: new Date().toISOString() });
      await context.dataSource.getCollection('payment_holds').update(
        { conditionTree: { field: 'transfer_id', operator: 'Equal', value: record.id } },
        { status: 'cancelled', reviewed_by: reviewer, reviewed_at: new Date().toISOString(), release_reason: `BLOCKED: ${reason}` },
      );

      return resultBuilder.success(`Transfer blocked and cancelled. Reason logged: "${reason}".`);
    },
  });
};
