import { LegalEntitiesCustomizer } from '../../../typings';
import { getPersonaInquiry, personaFetch } from '../persona-client';

const FINAL_STATUSES = ['approved', 'declined'];

// FEATURES: readonly status banner, guard against double-approval, optional reason field
export default (collection: LegalEntitiesCustomizer) => {
  collection.addAction('Approve KYC', {
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
        description: 'Optional reason for approval — appended to the audit log in Persona.',
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
          `Cannot approve: inquiry is already "${currentStatus}". This action is irreversible.`,
        );
      }

      const operatorReason = context.formValues['Reason'] as string | undefined;
      const reason = [
        `Approved by ${context.caller.email} via Forest Admin`,
        operatorReason,
      ]
        .filter(Boolean)
        .join(' — ');

      await personaFetch(`/inquiries/${inquiry.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ meta: { reason } }),
      });

      return resultBuilder.success(`KYC inquiry ${inquiry.id} approved successfully.`);
    },
  });
};
