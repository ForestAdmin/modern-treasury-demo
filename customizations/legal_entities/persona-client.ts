const BASE_URL = 'https://withpersona.com/api/v1';

export async function personaFetch(path: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.PERSONA_API_KEY}`,
      'Key-Inflection': 'camel',
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    throw new Error(`Persona API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

/**
 * Looks up the most recent Persona inquiry for a given Persona account ID.
 * The account ID (format: act_xxx) should be stored in legal_entity.external_id.
 *
 * Returns null if the account is not found or has no inquiries.
 */
export async function getPersonaInquiry(personaAccountId: string): Promise<any | null> {
  const accountResp = await personaFetch(`/accounts/${encodeURIComponent(personaAccountId)}`);
  const account = accountResp.data;
  if (!account) return null;

  const inquiryResp = await personaFetch(
    `/inquiries?filter[account-id]=${account.id}&sort=-createdAt&page[size]=1`,
  );
  return inquiryResp.data?.[0] ?? null;
}
