import { useAnnouncement, useAnnouncements, type AnnouncementView } from '@theolive/api';

import { formatKstDate } from '@/lib/format';
import { toQueryState, type QueryState } from '@/lib/queryState';
import type { Notice } from '@/models';
import { supabase } from '@/services/supabase';

function toNotice(item: AnnouncementView): Notice {
  return {
    id: item.id,
    title: item.title,
    body: item.body,
    publishedAt: formatKstDate(item.publishedAt ?? item.createdAt),
  };
}

/** Published announcements only; the server hides drafts from members. */
export function useNoticesQuery(): QueryState<Notice[]> {
  const state = toQueryState(useAnnouncements(supabase));
  return state.status === 'success' ? { status: 'success', data: state.data.map(toNotice) } : state;
}

/** `data` is `null` when the notice does not exist or is not published. */
export function useNoticeQuery(id: string | undefined): QueryState<Notice | null> {
  const state = toQueryState(useAnnouncement(supabase, id));
  if (state.status !== 'success') return state;
  return { status: 'success', data: state.data ? toNotice(state.data) : null };
}
