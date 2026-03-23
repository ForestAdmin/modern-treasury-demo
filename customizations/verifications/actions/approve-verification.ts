import { VerificationsCustomizer } from '../../../typings';

// FEATURES: readonly verification detail banner, optional override notes
export default (collection: VerificationsCustomizer) => {
  collection.addAction('Approve Verification', {
    scope: 'Single',
    form: [
      {
        label: 'Verification Details',
        type: 'String',
        isReadOnly: true,
        value: async ctx => {
          const record = await ctx.getRecord(['verification_type', 'status', 'vendor_id', 'data']);
          return `Type: ${record.verification_type} | Vendor: ${record.vendor_id} | Status: ${record.status}`;
        },
      },
      {
        label: 'Override Notes',
        type: 'String',
        description: 'Optional — explain if this approval overrides an automated rejection or a partial match.',
      },
    ],

    execute: async (context, resultBuilder) => {
      const record = await context.getRecord(['id', 'status', 'transfer_id']);
      if (record.status === 'approved') return resultBuilder.error('Verification is already approved.');

      await context.collection.update(context.filter, { status: 'approved' });

      return resultBuilder.success(`Verification approved by ${context.caller.email}.`);
    },
  });
};
