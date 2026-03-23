import { TransfersCustomizer } from '../../../typings';

// FEATURES: simple form, no status change — pure audit trail entry
export default (collection: TransfersCustomizer) => {
  collection.addAction('Add Review Note', {
    scope: 'Single',
    form: [
      {
        label: 'Note',
        type: 'String',
        isRequired: true,
        description: 'This note will be appended to the hold record and timestamped. It does not change the payment status.',
      },
      {
        label: 'Visibility',
        type: 'Enum',
        enumValues: ['internal_only', 'visible_to_l1', 'visible_to_compliance'],
        isRequired: true,
        value: async () => 'internal_only',
      },
    ],

    execute: async (context, resultBuilder) => {
      const record = await context.getRecord(['id']);
      const note = context.formValues['Note'] as string;
      const visibility = context.formValues['Visibility'] as string;
      const author = context.caller.email;
      const timestamp = new Date().toISOString();

      const holds = await context.dataSource.getCollection('payment_holds').list(
        { conditionTree: { field: 'transfer_id', operator: 'Equal', value: record.id } },
        ['id', 'notes'],
      );
      if (!holds.length) return resultBuilder.error('No active hold found for this transfer.');

      const existing = (holds[0].notes as string) ?? '';
      await context.dataSource.getCollection('payment_holds').update(
        { conditionTree: { field: 'id', operator: 'Equal', value: holds[0].id } },
        { notes: `${existing}\n\n[${timestamp} — ${author} — ${visibility}]\n${note}` },
      );

      return resultBuilder.success('Note added to the hold record.');
    },
  });
};
