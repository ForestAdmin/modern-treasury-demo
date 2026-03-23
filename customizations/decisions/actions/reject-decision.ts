import { DecisionsCustomizer } from '../../../typings';

// FEATURES: Enum rejection type, conditional "offboard" cascade, File attachment
export default (collection: DecisionsCustomizer) => {
  collection.addAction('Reject KYC Decision', {
    scope: 'Single',
    form: [
      {
        label: 'Rejection Reason',
        type: 'Enum',
        enumValues: [
          'identity_unverifiable',
          'pep_match_confirmed',
          'sanctions_hit_confirmed',
          'source_of_funds_unacceptable',
          'beneficial_ownership_opaque',
          'country_of_risk_prohibited',
        ],
        isRequired: true,
      },
      {
        label: 'Detailed Justification',
        type: 'String',
        isRequired: true,
        description: 'This will be stored permanently in the compliance record and may be subject to regulatory review.',
      },
      {
        label: 'Supporting Documentation',
        type: 'File',
        description: 'Attach the relevant screening report, adverse media, or evaluation export.',
      },
      {
        label: 'Offboard entity (close account)',
        type: 'Boolean',
        value: async () => false,
        description: 'If checked, the legal entity status will be set to "closed" and all accounts disabled.',
      },
    ],

    execute: async (context, resultBuilder) => {
      const record = await context.getRecord(['id', 'legal_entity_id']);
      const reason = context.formValues['Rejection Reason'] as string;
      const justification = context.formValues['Detailed Justification'] as string;
      const offboard = context.formValues['Offboard entity (close account)'] as boolean;
      const reviewer = context.caller.email;

      await context.collection.update(context.filter, {
        status: 'rejected',
        resolved_by: reviewer,
        details: { rejection_reason: reason, justification },
      });

      const entityUpdate = offboard
        ? { status: 'closed', closed_at: new Date().toISOString() }
        : { status: 'suspended', suspended_at: new Date().toISOString() };

      await context.dataSource.getCollection('legal_entities').update(
        { conditionTree: { field: 'id', operator: 'Equal', value: record.legal_entity_id } },
        entityUpdate,
      );

      if (offboard) {
        const accounts = await context.dataSource.getCollection('accounts').list(
          { conditionTree: { field: 'legal_entity_id', operator: 'Equal', value: record.legal_entity_id } },
          ['id'],
        );
        for (const account of accounts) {
          await context.dataSource.getCollection('accounts').update(
            { conditionTree: { field: 'id', operator: 'Equal', value: account.id } },
            { status: 'closed', closed_at: new Date().toISOString() },
          );
        }
      }

      return resultBuilder.success(
        `KYC Decision rejected (${reason}). Entity ${offboard ? 'offboarded and accounts closed' : 'suspended'}.`,
      );
    },
  });
};
