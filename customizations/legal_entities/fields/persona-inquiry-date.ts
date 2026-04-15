import { LegalEntitiesCustomizer } from '../../../typings';
import { getPersonaInquiry } from '../persona-client';

export default (collection: LegalEntitiesCustomizer) => {
  collection.addField('persona_inquiry_date', {
    columnType: 'Date',
    dependencies: ['external_id'],
    getValues: async records => {
      const results = await Promise.allSettled(
        records.map(async r => {
          if (!r.external_id) return null;
          const inquiry = await getPersonaInquiry(r.external_id);
          return (inquiry?.attributes?.completedAt as string) ?? null;
        }),
      );
      return results.map(r => (r.status === 'fulfilled' ? r.value : null));
    },
  });
};
