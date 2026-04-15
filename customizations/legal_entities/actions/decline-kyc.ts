import { LegalEntitiesCustomizer } from '../../../typings';
import { getPersonaInquiry, personaFetch } from '../persona-client';

const FINAL_STATUSES = ['approved', 'declined'];

// FEATURES: readonly status banner, required reason for audit trail, guard against re-declining
export default (collection: LegalEntitiesCustomizer) => {
  collection.addAction('Decline KYC', {
    scope: 'Single',
    form: [
      {
        label: 'Current KYC Status',
        type: 'String',
        isReadOnly: true,
        value: async ctx => {
          const record = await ctx.getRecord(['external_id']);
          if (!record.external_id) return 'No Persona account ID set (external_id is empty)';
          const inquiry = await getPersonaInquiry(record.external_id);
          if (!inquiry) return 'No Persona account found';
          return inquiry.attributes?.status ?? 'unknown';
        },
      },
      {
        label: 'Reason',
        type: 'String',
        isRequired: true,
        description: 'Required — this reason is passed to Persona and stored as part of the audit trail.',
      },
    ],

    execute: async (context, resultBuilder) => {
      const record = await context.getRecord(['external_id']);
      if (!record.external_id) return resultBuilder.error('external_id is not set on this record — cannot look up Persona account.');
      const inquiry = await getPersonaInquiry(record.external_id);

      if (!inquiry) {
        return resultBuilder.error('No Persona account or inquiry found for this entity.');
      }

      const currentStatus: string = inquiry.attributes?.status ?? '';
      if (FINAL_STATUSES.includes(currentStatus)) {
        return resultBuilder.error(
          `Cannot decline: inquiry is already "${currentStatus}". This action is irreversible.`,
        );
      }

      const operatorReason = context.formValues['Reason'] as string;
      const reason = `Declined by ${context.caller.email} via Forest Admin — ${operatorReason}`;

      await personaFetch(`/inquiries/${inquiry.id}/decline`, {
        method: 'POST',
        body: JSON.stringify({ meta: { reason } }),
      });

      return resultBuilder.success(`KYC inquiry ${inquiry.id} declined.`);
    },
  });
};
