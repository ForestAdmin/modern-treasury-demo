import { LegalEntitiesCustomizer } from '../../../typings';
import { getPersonaInquiry, personaFetch } from '../persona-client';

const VERIFICATION_TYPE_PREFIX = 'verification/';

export default (collection: LegalEntitiesCustomizer) => {
  collection.addField('persona_verification_summary', {
    columnType: 'Json',
    dependencies: ['external_id'],
    getValues: async records => {
      const results = await Promise.allSettled(
        records.map(async r => {
          if (!r.external_id) return null;
          const inquiry = await getPersonaInquiry(r.external_id);
          if (!inquiry) return null;

          const inquiryWithVerifications = await personaFetch(
            `/inquiries/${inquiry.id}?include=verifications`,
          );
          const included: any[] = inquiryWithVerifications.included ?? [];

          const summary: Record<string, string> = {};
          for (const item of included) {
            if (!item.type?.startsWith(VERIFICATION_TYPE_PREFIX)) continue;
            const checkName = item.type.slice(VERIFICATION_TYPE_PREFIX.length).replace(/-/g, '_');
            summary[checkName] = item.attributes?.status ?? 'unknown';
          }

          return Object.keys(summary).length > 0 ? summary : null;
        }),
      );
      return results.map(r => (r.status === 'fulfilled' ? r.value : null));
    },
  });
};
