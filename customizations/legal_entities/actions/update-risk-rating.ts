import { LegalEntitiesCustomizer } from '../../../typings';

// FEATURES: readonly current value, dynamic isRequired on justification, Enum
export default (collection: LegalEntitiesCustomizer) => {
  collection.addAction('Update Risk Rating', {
    scope: 'Single',
    form: [
      {
        label: 'Current Risk Rating',
        type: 'String',
        isReadOnly: true,
        value: async ctx => {
          const record = await ctx.getRecord(['risk_rating']);
          return (record.risk_rating as string) ?? 'not set';
        },
      },
      {
        label: 'New Risk Rating',
        type: 'Enum',
        enumValues: ['low', 'medium', 'high', 'critical'],
        isRequired: true,
      },
      {
        label: 'Justification',
        type: 'String',
        isRequired: async ctx => ['high', 'critical'].includes(ctx.formValues['New Risk Rating'] as string),
        description: 'Required when escalating to high or critical. Will be stored in the compliance record.',
      },
      {
        label: 'Suspend all active payments',
        type: 'Boolean',
        value: async () => false,
        if: async ctx => ['high', 'critical'].includes(ctx.formValues['New Risk Rating'] as string),
        description: 'Immediately put all active transfers for this entity into held status.',
      },
    ],

    execute: async (context, resultBuilder) => {
      const record = await context.getRecord(['id', 'risk_rating']);
      const newRating = context.formValues['New Risk Rating'] as string;
      const justification = context.formValues['Justification'] as string;
      const suspendPayments = context.formValues['Suspend all active payments'] as boolean;

      await context.collection.update(context.filter, { risk_rating: newRating });

      if (suspendPayments) {
        // Find accounts linked to this legal entity
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
                  { field: 'status', operator: 'Equal', value: 'pending' },
                ],
              },
            },
            { status: 'held', held_at: new Date().toISOString(), held_reason: `risk_rating_escalated_to_${newRating}` },
          );
        }
      }

      return resultBuilder.success(
        `Risk rating updated from ${record.risk_rating} to ${newRating}.` +
          (justification ? ` Justification: "${justification}".` : '') +
          (suspendPayments ? ' Active payments suspended.' : ''),
      );
    },
  });
};
