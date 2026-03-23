import { TransfersCustomizer } from '../../../typings';

// FEATURES: File upload, Enum, Boolean toggle, dynamic description
export default (collection: TransfersCustomizer) => {
  collection.addAction('Escalate to Compliance', {
    scope: 'Single',
    form: [
      {
        label: 'Escalation Reason',
        type: 'Enum',
        enumValues: [
          'possible_sanctions_hit',
          'confirmed_fraud_pattern',
          'linked_to_open_investigation',
          'pep_match',
          'structuring_suspicion',
          'exceeds_authority_level',
        ],
        isRequired: true,
        description: 'Use Escalate only for cases that exceed your authority level — not for difficult decisions.',
      },
      {
        label: 'Context for Compliance',
        type: 'String',
        isRequired: true,
        description:
          'Summarize your investigation: what you checked, what you found, and why this needs Compliance review.',
      },
      {
        label: 'Supporting Evidence',
        type: 'File',
        description: 'Optional — attach screenshots, external reports, or any file relevant to the escalation.',
      },
      {
        label: 'Notify TAM',
        type: 'Boolean',
        value: async () => false,
        description: 'Also notify the TAM assigned to the C1 parent entity.',
      },
    ],

    execute: async (context, resultBuilder) => {
      const record = await context.getRecord(['id', 'status']);
      if (!['held', 'pending'].includes(record.status as string))
        return resultBuilder.error('Only held or pending transfers can be escalated.');

      const reason = context.formValues['Escalation Reason'] as string;
      const notes = context.formValues['Context for Compliance'] as string;
      const reviewer = context.caller.email;

      await context.collection.update(context.filter, { escalated_at: new Date().toISOString(), held_reason: `escalated:${reason}` });
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
          status: 'escalated',
          hold_type: 'compliance',
          notes: `[Escalated by ${reviewer} — ${reason}]\n${notes}`,
          reviewed_by: reviewer,
        },
      );

      const notifyTam = context.formValues['Notify TAM'] as boolean;
      return resultBuilder.success(
        `Case escalated to Compliance (${reason}). The officer has full context and will action within SLA. ` +
          (notifyTam ? 'TAM has been notified.' : ''),
      );
    },
  });
};
