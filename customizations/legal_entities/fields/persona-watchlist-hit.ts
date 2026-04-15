import { LegalEntitiesCustomizer } from '../../../typings';
import { getPersonaInquiry, personaFetch } from '../persona-client';

export default (collection: LegalEntitiesCustomizer) => {
  collection.addField('persona_watchlist_hit', {
    columnType: 'Enum',
    enumValues: ['hit', 'clear', 'pending', 'no_report'],
    dependencies: ['external_id'],
    getValues: async records => {
      const results = await Promise.allSettled(
        records.map(async r => {
          if (!r.external_id) return null;
          const inquiry = await getPersonaInquiry(r.external_id);
          if (!inquiry) return null;

          // Fetch inquiry with reports included (avoids a second account lookup)
          const inquiryWithReports = await personaFetch(`/inquiries/${inquiry.id}?include=reports`);
          const included: any[] = inquiryWithReports.included ?? [];

          const watchlistReport = included.find(item => item.type === 'report/watchlist');
          if (!watchlistReport) return 'no_report';

          if (watchlistReport.attributes?.status === 'pending') return 'pending';
          return watchlistReport.attributes?.matched ? 'hit' : 'clear';
        }),
      );
      return results.map(r => (r.status === 'fulfilled' ? r.value : null));
    },
  });
};
