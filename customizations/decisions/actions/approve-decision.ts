import { DecisionsCustomizer } from '../../../typings';

// FEATURES: multi-page form (KYC level → expiry → notes), readonly context panel
export default (collection: DecisionsCustomizer) => {
  collection.addAction('Approve KYC Decision', {
    scope: 'Single',
    form: [
      // Page 1 — context
      {
        label: 'Current Decision Status',
        type: 'String',
        isReadOnly: true,
        value: async ctx => {
          const record = await ctx.getRecord(['status', 'details', 'legal_entity_id']);
          const les = await ctx.dataSource.getCollection('legal_entities').list(
            { conditionTree: { field: 'id', operator: 'Equal', value: record.legal_entity_id } },
            ['risk_rating', 'status'],
          );
          return `Decision status: ${record.status} | Entity risk: ${les[0]?.risk_rating} | Entity status: ${les[0]?.status}`;
        },
      },
      // Page 2 — approval settings
      {
        label: 'Approved KYC Level',
        type: 'Enum',
        enumValues: ['standard', 'enhanced', 'simplified'],
        isRequired: true,
        value: async () => 'standard',
      },
      {
        label: 'Valid Until',
        type: 'Date',
        isRequired: true,
        description: 'KYC decisions must be renewed periodically. Standard = 1 year, Enhanced = 2 years.',
      },
      // Page 3 — notes
      {
        label: 'Approval Notes',
        type: 'String',
        description: 'Optional — document any special considerations, waivers, or enhanced monitoring requirements.',
      },
      {
        label: 'Trigger Enhanced Monitoring',
        type: 'Boolean',
        value: async ctx => {
          const record = await ctx.getRecord(['legal_entity_id']);
          const les = await ctx.dataSource.getCollection('legal_entities').list(
            { conditionTree: { field: 'id', operator: 'Equal', value: record.legal_entity_id } },
            ['risk_rating'],
          );
          return les[0]?.risk_rating === 'medium';
        },
        description: 'Enable transaction monitoring alerts for this entity.',
      },
    ],

    execute: async (context, resultBuilder) => {
      const record = await context.getRecord(['id', 'legal_entity_id']);
      const kycLevel = context.formValues['Approved KYC Level'] as string;
      const validUntil = context.formValues['Valid Until'] as string;
      const reviewer = context.caller.email;

      await context.collection.update(context.filter, {
        status: 'approved',
        resolved_by: reviewer,
        expires_at: validUntil,
        details: { kyc_level: kycLevel, approved_by: reviewer },
      });

      await context.dataSource.getCollection('legal_entities').update(
        { conditionTree: { field: 'id', operator: 'Equal', value: record.legal_entity_id } },
        { status: 'active' },
      );

      return resultBuilder.success(
        `KYC Decision approved (level: ${kycLevel}) — valid until ${new Date(validUntil).toLocaleDateString()}.`,
      );
    },
  });
};
