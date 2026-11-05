/**
 * Display masking for member contact data.
 *
 * In production the SERVER must return pre-masked values (or no value at all). Masking on the client is
 * not a privacy boundary: anything the client receives can be read from the network. These helpers exist
 * for the fixture layer and as the agreed display format.
 */

const LOCAL_KEEP_LONG = 4;
const LOCAL_KEEP_SHORT = 1;
const LOCAL_LONG_MIN_LENGTH = 5;
const PHONE_TAIL_LENGTH = 4;
const KOREA_COUNTRY_CODE = '82';
const MOBILE_LENGTH = 11;
const LANDLINE_OR_OLD_MOBILE_LENGTH = 10;
const MASK = '***';

export function maskEmail(email: string | null): string | null {
  if (email === null) return null;
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return MASK;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const keep = local.length >= LOCAL_LONG_MIN_LENGTH ? LOCAL_KEEP_LONG : LOCAL_KEEP_SHORT;
  return `${local.slice(0, keep)}${MASK}@${domain}`;
}

function toKoreanDomesticDigits(digits: string): string {
  return digits.startsWith(KOREA_COUNTRY_CODE)
    ? `0${digits.slice(KOREA_COUNTRY_CODE.length)}`
    : digits;
}

export function maskPhone(phone: string | null): string | null {
  if (phone === null) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 0) return null;
  if (digits.length <= PHONE_TAIL_LENGTH) return '****';
  const tail = digits.slice(-PHONE_TAIL_LENGTH);

  const domestic = toKoreanDomesticDigits(digits);
  const isKorean = phone.trim().startsWith('+')
    ? digits.startsWith(KOREA_COUNTRY_CODE)
    : domestic.startsWith('0');
  if (isKorean && domestic.length === MOBILE_LENGTH) return `${domestic.slice(0, 3)}-****-${tail}`;
  if (isKorean && domestic.length === LANDLINE_OR_OLD_MOBILE_LENGTH)
    return `${domestic.slice(0, 3)}-***-${tail}`;
  // Anything else (foreign or malformed): reveal only the last four digits.
  return `***-${tail}`;
}
