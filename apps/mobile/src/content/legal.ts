/**
 * Terms and privacy policy shown before and after sign-in (OTH-06, AUTH-01). Static content, not a table: it
 * changes with the app release.
 * PENDING OWNER-APPROVED LEGAL COPY: the bodies below are placeholders and must be replaced with the final texts
 * before launch.
 */
export type LegalDocument = { id: string; title: string; body: string };

export const LEGAL_DOCUMENTS: readonly LegalDocument[] = [
  { id: 'terms', title: '이용약관', body: '최신 이용약관 본문이 이곳에 표시됩니다. (placeholder)' },
  {
    id: 'privacy',
    title: '개인정보 처리방침',
    body: '최신 개인정보 처리방침 본문이 이곳에 표시됩니다. (placeholder)',
  },
];

export function findLegalDocument(id: string | undefined): LegalDocument | null {
  return LEGAL_DOCUMENTS.find((document) => document.id === id) ?? null;
}
