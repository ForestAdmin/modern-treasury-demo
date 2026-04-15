import { LegalEntitiesCustomizer } from '../../../typings';
import { personaFetch } from '../persona-client';

// FEATURES: readonly warning banner, email pre-fill from linked individual, optional phone blocklist
export default (collection: LegalEntitiesCustomizer) => {
  collection.addAction('Add to Persona Blocklist', {
    scope: 'Single',
    form: [
      {
        label: '⚠️ Warning',
        type: 'String',
        isReadOnly: true,
        value: async () =>
          'This action permanently adds the user to a Persona blocklist. ' +
          'Removal is not supported via the API. Proceed only after a confirmed fraud or compliance determination.',
      },
      {
        label: 'Email',
        type: 'String',
        isReadOnly: true,
        value: async ctx => {
          const record = await ctx.getRecord(['individual_id']);
          if (!record.individual_id) return 'No linked individual';

          const individuals = await ctx.dataSource.getCollection('individuals').list(
            { conditionTree: { field: 'id', operator: 'Equal', value: record.individual_id } },
            ['primary_email'],
          );
          return (individuals[0]?.primary_email as string) ?? 'No email on record';
        },
      },
      {
        label: 'Reason',
        type: 'String',
        isRequired: true,
        description: 'Internal audit reason — stored in the success log, not sent to Persona.',
      },
      {
        label: 'Also blocklist phone number',
        type: 'Boolean',
        description: 'If enabled, the linked individual\'s primary phone will also be added to the blocklist.',
      },
    ],

    execute: async (context, resultBuilder) => {
      const listId = process.env.PERSONA_BLOCKLIST_ID;
      if (!listId) {
        return resultBuilder.error(
          'PERSONA_BLOCKLIST_ID environment variable is not set. ' +
          'Set it to the Persona list ID (format: lst_XXXX) before using this action.',
        );
      }

      const record = await context.getRecord(['individual_id']);
      if (!record.individual_id) {
        return resultBuilder.error('This legal entity has no linked individual — cannot determine email or phone.');
      }

      const individuals = await context.dataSource.getCollection('individuals').list(
        { conditionTree: { field: 'id', operator: 'Equal', value: record.individual_id } },
        ['primary_email', 'primary_phone'],
      );
      const individual = individuals[0];
      if (!individual?.primary_email) {
        return resultBuilder.error('No email address found on the linked individual record.');
      }

      const email = individual.primary_email as string;
      const phone = individual.primary_phone as string | null;
      const includePhone = context.formValues['Also blocklist phone number'] as boolean;
      const reason = context.formValues['Reason'] as string;

      await personaFetch('/list-items/email-address', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'list-item/email-address',
            attributes: { value: email, listId },
          },
        }),
      });

      const blocklisted = [`email (${email})`];

      if (includePhone && phone) {
        await personaFetch('/list-items/phone-number', {
          method: 'POST',
          body: JSON.stringify({
            data: {
              type: 'list-item/phone-number',
              attributes: { value: phone, listId },
            },
          }),
        });
        blocklisted.push(`phone (${phone})`);
      }

      return resultBuilder.success(
        `Added to Persona blocklist (${listId}): ${blocklisted.join(', ')}. ` +
        `Reason: "${reason}". Action taken by ${context.caller.email}.`,
      );
    },
  });
};
