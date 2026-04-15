import { LegalEntitiesCustomizer } from '../../../typings';
import { getPersonaInquiry } from '../persona-client';

export default (collection: LegalEntitiesCustomizer) => {
  collection.addField('persona_kyc_status', {
    columnType: 'Enum',
    enumValues: ['approved', 'declined', 'needs_review', 'completed', 'failed', 'expired', 'pending', 'no_account', 'no_inquiry'],
    dependencies: ['external_id'],
    getValues: async records => {
      const results = await Promise.allSettled(
        records.map(async r => {
          if (!r.external_id) return 'no_account';
          const inquiry = await getPersonaInquiry(r.external_id);
          if (!inquiry) return 'no_account';
          return (inquiry.attributes?.status as string) ?? 'no_inquiry';
        }),
      );
      return results.map(r => (r.status === 'fulfilled' ? r.value : null));
    },
  });
};
