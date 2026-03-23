import { LegalEntitiesCustomizer } from '../../../typings';

// FEATURES: readonly entity summary, Enum reason, Boolean cascade, confirmation checkbox
export default (collection: LegalEntitiesCustomizer) => {
  collection.addAction('Suspend Counterparty', {
    scope: 'Single',
    form: [
      {
        label: 'Entity',
        type: 'String',
        isReadOnly: true,
        value: async ctx => {
          const record = await ctx.getRecord(['id', 'individual_id', 'business_id', 'risk_rating', 'status']);
          if (record.individual_id) {
            const rows = await ctx.dataSource.getCollection('individuals').list(
              { conditionTree: { field: 'id', operator: 'Equal', value: record.individual_id } },
              ['first_name', 'last_name'],
            );
            return `${rows[0]?.first_name} ${rows[0]?.last_name} — risk: ${record.risk_rating} — status: ${record.status}`;
          }
          const rows = await ctx.dataSource.getCollection('businesses').list(
            { conditionTree: { field: 'id', operator: 'Equal', value: record.business_id } },
            ['business_name'],
          );
          return `${rows[0]?.business_name} — risk: ${record.risk_rating} — status: ${record.status}`;
        },
      },
      {
        label: 'Suspension Reason',
        type: 'Enum',
        enumValues: [
          'aml_investigation',
          'fraud_confirmed',
          'sanctions_match',
          'kyc_failure',
          'suspicious_activity_report',
          'regulatory_instruction',
        ],
        isRequired: true,
      },
      {
        label: 'Additional Context',
        type: 'String',
        description: 'Optional — case number, regulator reference, or internal investigation ID.',
      },
      {
        label: 'Block all pending transfers',
        type: 'Boolean',
        value: async () => true,
        description: 'Cancel all pending and held transfers associated with this entity.',
      },
      {
        label: 'I confirm this will block access for this counterparty',
        type: 'Boolean',
        isRequired: true,
        value: async () => false,
      },
    ],

    execute: async (context, resultBuilder) => {
      const confirmed = context.formValues['I confirm this will block access for this counterparty'] as boolean;
      if (!confirmed) return resultBuilder.error('Confirmation is required to suspend a counterparty.');

      const record = await context.getRecord(['id']);
      const reason = context.formValues['Suspension Reason'] as string;
      const blockTransfers = context.formValues['Block all pending transfers'] as boolean;
      const reviewer = context.caller.email;

      await context.collection.update(context.filter, { status: 'suspended', suspended_at: new Date().toISOString() });

      if (blockTransfers) {
        const accounts = await context.dataSource.getCollection('accounts').list(
          { conditionTree: { field: 'legal_entity_id', operator: 'Equal', value: record.id } },
          ['id'],
        );
        for (const account of accounts) {
          await context.dataSource.getCollection('transfers').update(
            {
              conditionTree: {
                aggregator: 'And',
                conditions: [
                  { field: 'account_id', operator: 'Equal', value: account.id },
                  { field: 'status', operator: 'In', value: ['pending', 'held'] },
                ],
              },
            },
            { status: 'cancelled', cancelled_at: new Date().toISOString() },
          );
        }
      }

      return resultBuilder.success(
        `Counterparty suspended (${reason}) by ${reviewer}. ` +
          (blockTransfers ? 'All pending transfers have been cancelled.' : ''),
      );
    },
  });
};
