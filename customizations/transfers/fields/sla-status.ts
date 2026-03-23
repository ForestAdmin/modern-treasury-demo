import { TransfersCustomizer } from '../../../typings';

// SLA thresholds (hours) by held_reason / risk level
const SLA_HOURS: Record<string, number> = {
  sanctions_screening: 1,
  fraud_alert: 1,
  high_risk_counterparty: 4,
  compliance_review_required: 4,
  manual_review: 4,
  kyc_pending: 8,
  exceeds_velocity_limit: 8,
  new_account_seasoning: 24,
  default: 8,
};

function slaThresholdHours(heldReason: string | null): number {
  if (!heldReason) return SLA_HOURS.default;
  for (const key of Object.keys(SLA_HOURS)) {
    if (heldReason.includes(key)) return SLA_HOURS[key];
  }
  return SLA_HOURS.default;
}

export default (collection: TransfersCustomizer) => {
  collection.addField('sla_status', {
    columnType: 'Enum',
    enumValues: ['ok', 'warning', 'breached'],
    dependencies: ['held_at', 'held_reason'],
    getValues: records =>
      records.map(r => {
        if (!r.held_at) return null;
        const hoursElapsed = (Date.now() - new Date(r.held_at as string).getTime()) / (1000 * 60 * 60);
        const sla = slaThresholdHours(r.held_reason as string | null);
        if (hoursElapsed >= sla) return 'breached';
        if (hoursElapsed >= sla * 0.75) return 'warning';
        return 'ok';
      }),
  });
};
