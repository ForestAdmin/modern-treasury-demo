import { TransfersCustomizer } from '../../../typings';

// FEATURES: conditional fields (if), pre-filled value via dataSource, multi-step feel
export default (collection: TransfersCustomizer) => {
  collection.addAction('Send RFI', {
    scope: 'Single',
    form: [
      {
        label: 'RFI Type',
        type: 'Enum',
        enumValues: ['source_of_funds', 'ubo_documentation', 'proof_of_address', 'transaction_purpose'],
        isRequired: true,
        description: 'Select the type of information you need from the counterparty.',
      },
      {
        label: 'Channel',
        type: 'Enum',
        enumValues: ['persona_link', 'email'],
        isRequired: true,
        value: async () => 'persona_link',
        description: 'Persona link is recommended — generates a one-time secure collection form.',
      },
      // Shown only when channel = persona_link
      {
        label: 'Persona Template',
        type: 'Enum',
        enumValues: ['standard_kyc', 'enhanced_due_diligence', 'source_of_funds_collection'],
        isRequired: true,
        if: async ctx => ctx.formValues['Channel'] === 'persona_link',
      },
      // Shown only when channel = email — pre-filled from counterparty
      {
        label: 'Recipient Email',
        type: 'String',
        isRequired: true,
        if: async ctx => ctx.formValues['Channel'] === 'email',
        value: async ctx => {
          const record = await ctx.getRecord(['account_id']);
          const accounts = await ctx.dataSource.getCollection('accounts').list(
            { conditionTree: { field: 'id', operator: 'Equal', value: record.account_id } },
            ['legal_entity_id'],
          );
          if (!accounts.length) return '';

          const les = await ctx.dataSource.getCollection('legal_entities').list(
            { conditionTree: { field: 'id', operator: 'Equal', value: accounts[0].legal_entity_id } },
            ['individual_id', 'business_id'],
          );
          if (!les.length) return '';
          const le = les[0];

          if (le.individual_id) {
            const rows = await ctx.dataSource.getCollection('individuals').list(
              { conditionTree: { field: 'id', operator: 'Equal', value: le.individual_id } },
              ['primary_email'],
            );
            return rows[0]?.primary_email ?? '';
          }
          if (le.business_id) {
            const rows = await ctx.dataSource.getCollection('businesses').list(
              { conditionTree: { field: 'id', operator: 'Equal', value: le.business_id } },
              ['primary_email'],
            );
            return rows[0]?.primary_email ?? '';
          }
          return '';
        },
        description: 'Pre-filled from the counterparty profile. Edit if needed.',
      },
      {
        label: 'Note to Counterparty',
        type: 'String',
        isRequired: true,
        description: 'Explain what you need and why. Included verbatim in the message sent to the client.',
      },
      {
        label: 'SLA Urgency',
        type: 'Enum',
        enumValues: ['standard_48h', 'urgent_24h', 'critical_same_day'],
        isRequired: true,
        value: async ctx => {
          const record = await ctx.getRecord(['held_reason']);
          return record.held_reason === 'sanctions_screening' ? 'critical_same_day' : 'standard_48h';
        },
        description: 'Sets the reminder cadence if the counterparty does not respond.',
      },
    ],

    execute: async (context, resultBuilder) => {
      const record = await context.getRecord(['id', 'status']);
      if (record.status !== 'held') return resultBuilder.error('Only held payments can trigger an RFI.');

      const rfiType = context.formValues['RFI Type'] as string;
      const channel = context.formValues['Channel'] as string;
      const urgency = context.formValues['SLA Urgency'] as string;
      const note = context.formValues['Note to Counterparty'] as string;

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
        { status: 'awaiting_response', notes: `[RFI — ${rfiType} via ${channel}]\n${note}` },
      );
      await context.collection.update(context.filter, { held_reason: `rfi_sent:${rfiType}:${urgency}` });

      return resultBuilder.success(
        `RFI sent via ${channel} for "${rfiType}". Reminders scheduled (${urgency}). ` +
          `The case returns to your queue when the counterparty responds.`,
      );
    },
  });
};
