import { LegalEntitiesCustomizer } from '../../../typings';

// FEATURES: dynamic enumValues based on entity type (individual vs business), multi-page feel
export default (collection: LegalEntitiesCustomizer) => {
  collection.addAction('Request KYC Documents', {
    scope: 'Single',
    form: [
      // Page 1 — what kind of entity?
      {
        label: 'Entity Type',
        type: 'String',
        isReadOnly: true,
        value: async ctx => {
          const record = await ctx.getRecord(['individual_id', 'business_id']);
          return record.individual_id ? 'Individual' : 'Business';
        },
      },
      // Page 2a — individual document types
      {
        label: 'Documents Required (Individual)',
        type: 'EnumList',
        enumValues: ['government_id', 'proof_of_address', 'selfie_liveness', 'source_of_funds', 'bank_statement'],
        isRequired: true,
        if: async ctx => {
          const record = await ctx.getRecord(['individual_id']);
          return !!record.individual_id;
        },
      },
      // Page 2b — business document types
      {
        label: 'Documents Required (Business)',
        type: 'EnumList',
        enumValues: [
          'articles_of_incorporation',
          'operating_agreement',
          'ein_letter',
          'beneficial_ownership_certification',
          'audited_financials',
          'bank_statements_3_months',
        ],
        isRequired: true,
        if: async ctx => {
          const record = await ctx.getRecord(['business_id']);
          return !!record.business_id;
        },
      },
      // Page 3 — delivery
      {
        label: 'Delivery Channel',
        type: 'Enum',
        enumValues: ['persona_link', 'email', 'tam_manual_outreach'],
        isRequired: true,
        value: async () => 'persona_link',
      },
      {
        label: 'Deadline',
        type: 'Date',
        isRequired: true,
        description: 'If documents are not received by this date, the entity will be flagged for review.',
      },
      {
        label: 'Internal Notes',
        type: 'String',
        description: 'Optional — context for the TAM or ops team handling this request.',
      },
    ],

    execute: async (context, resultBuilder) => {
      const record = await context.getRecord(['id']);
      const channel = context.formValues['Delivery Channel'] as string;
      const deadline = context.formValues['Deadline'] as Date;
      const docsIndividual = context.formValues['Documents Required (Individual)'] as string[];
      const docsBusiness = context.formValues['Documents Required (Business)'] as string[];
      const docs = docsIndividual ?? docsBusiness ?? [];

      await context.dataSource.getCollection('documents').create(
        docs.map(docType => ({
          document_type: docType,
          legal_entity_id: record.id,
        })),
      );

      return resultBuilder.success(
        `KYC document request sent via ${channel} for: ${docs.join(', ')}. ` +
          `Deadline: ${new Date(deadline).toLocaleDateString()}.`,
      );
    },
  });
};
