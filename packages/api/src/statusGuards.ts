import {
  ORDER_STATUS,
  PAYMENT_STATUS,
  type OrderStatus,
  type PaymentStatus,
} from '@theolive/types';

import { AppError } from './functionErrors';

const ORDER_STATUSES: readonly string[] = Object.values(ORDER_STATUS);
const PAYMENT_STATUSES: readonly string[] = Object.values(PAYMENT_STATUS);

function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && ORDER_STATUSES.includes(value);
}

function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === 'string' && PAYMENT_STATUSES.includes(value);
}

/** Edge Function and RPC answers are untyped JSON; anything that is not a known status is a server fault. */
export function toOrderStatus(value: unknown): OrderStatus {
  if (!isOrderStatus(value)) throw new AppError('INTERNAL');
  return value;
}

export function toPaymentStatus(value: unknown): PaymentStatus {
  if (!isPaymentStatus(value)) throw new AppError('INTERNAL');
  return value;
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) throw new AppError('INTERNAL');
  return Object.fromEntries(Object.entries(value));
}
