import { VerificationsCustomizer } from '../../../typings';

// FEATURES: Enum reason, conditional "sanctions referral" field, resultBuilder.redirectTo
export default (collection: VerificationsCustomizer) => {
  collection.addAction('Reject Verification', {
    scope: 'Single',
    form: [
      {
        label: 'Rejection Reason',
        type: 'Enum',
        enumValues: [
          'document_expired',
          'document_tampered',
          'identity_mismatch',
          'sanctions_confirmed_hit',
          'pep_confirmed',
          'insufficient_documentation',
          'model_false_positive_confirmed',
        ],
        isRequired: true,
      },
      {
        label: 'Rejection Notes',
        type: 'String',
        isRequired: true,
        description: 'Detail exactly what was found. These notes will be stored and may be reviewed by regulators.',
      },
      // Only shown for sanctions / PEP hits
      {
        label: 'File SAR (Suspicious Activity Report)',
        type: 'Boolean',
        value: async () => false,
        if: async ctx =>
          ['sanctions_confirmed_hit', 'pep_confirmed'].includes(ctx.formValues['Rejection Reason'] as string),
        description: 'Check to flag this for SAR filing. Compliance team will be automatically notified.',
      },
    ],

    execute: async (context, resultBuilder) => {
      const record = await context.getRecord(['id', 'transfer_id']);
      const reason = context.formValues['Rejection Reason'] as string;
      const notes = context.formValues['Rejection Notes'] as string;

      await context.collection.update(context.filter, { status: 'failed', rejection_reason: `${reason}: ${notes}` });

      // Escalate the parent transfer if it's a serious hit
      if (['sanctions_confirmed_hit', 'pep_confirmed'].includes(reason) && record.transfer_id) {
        await context.dataSource.getCollection('transfers').update(
          { conditionTree: { field: 'id', operator: 'Equal', value: record.transfer_id } },
          { escalated_at: new Date().toISOString(), held_reason: `verification_rejected:${reason}` },
        );
      }

      return resultBuilder.success(`Verification rejected: ${reason}.`);
    },
  });
};
