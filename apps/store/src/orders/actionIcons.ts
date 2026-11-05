import { Ban, Check, CheckCheck, Coffee, PackageCheck, type LucideIcon } from 'lucide-react';
import { STAFF_ACTION, type StaffAction } from '@/domain/orderTransitions';

export const ORDER_ACTION_ICON: Record<StaffAction, LucideIcon> = {
  [STAFF_ACTION.ACCEPT]: Check,
  [STAFF_ACTION.REJECT]: Ban,
  [STAFF_ACTION.START_PREPARING]: Coffee,
  [STAFF_ACTION.MARK_READY]: PackageCheck,
  [STAFF_ACTION.COMPLETE]: CheckCheck,
};
