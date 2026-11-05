import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ANNOUNCEMENT_STATUS,
  toAppErrorCode,
  type AnnouncementRow,
  type AnnouncementStatus,
} from '@theolive/types';
import { announcementSchema, type AnnouncementInput } from '@theolive/validation';

import type { TypedSupabaseClient } from './client';
import { AppError } from './functionErrors';
import { queryKeys } from './query-keys';

// Announcements (공지). Customers read the published ones; Store Admin manages all of them. Row-level security is
// the boundary: a customer cannot read a draft or write at all, and published_at is stamped by the database.

type Db = Pick<TypedSupabaseClient, 'from'>;

export type AnnouncementView = {
  id: string;
  title: string;
  body: string;
  status: AnnouncementStatus;
  /** `null` while unpublished. */
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toAnnouncementView(row: AnnouncementRow): AnnouncementView {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    status: row.status,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---- Customer app ----

export async function fetchAnnouncements(client: Db): Promise<AnnouncementView[]> {
  const { data, error } = await client
    .from('announcements')
    .select('*')
    .eq('status', ANNOUNCEMENT_STATUS.PUBLISHED)
    .order('published_at', { ascending: false })
    .order('id', { ascending: false });
  if (error) throw error;
  return data.map(toAnnouncementView);
}

/** `null` when it does not exist or is not published (the customer cannot tell which). */
export async function fetchAnnouncement(client: Db, id: string): Promise<AnnouncementView | null> {
  const { data, error } = await client
    .from('announcements')
    .select('*')
    .eq('id', id)
    .eq('status', ANNOUNCEMENT_STATUS.PUBLISHED)
    .maybeSingle();
  if (error) throw error;
  return data ? toAnnouncementView(data) : null;
}

export function useAnnouncements(client: TypedSupabaseClient) {
  return useQuery({
    queryKey: queryKeys.announcements.list(),
    queryFn: () => fetchAnnouncements(client),
  });
}

export function useAnnouncement(client: TypedSupabaseClient, id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.announcements.detail(id ?? ''),
    queryFn: () => fetchAnnouncement(client, id ?? ''),
    enabled: Boolean(id),
  });
}

// ---- Store Admin ----

export async function fetchAnnouncementsAdmin(client: Db): Promise<AnnouncementView[]> {
  const { data, error } = await client
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  if (error) throw error;
  return data.map(toAnnouncementView);
}

export type SaveAnnouncementInput = AnnouncementInput & { id: string | null };

/** Creates (`id` null) or edits an announcement. The status is part of the form; the server stamps the date. */
export async function saveAnnouncement(client: Db, input: SaveAnnouncementInput): Promise<void> {
  const parsed = announcementSchema.safeParse({
    title: input.title,
    body: input.body,
    status: input.status,
  });
  if (!parsed.success) throw new AppError('INVALID_INPUT');
  const { error } =
    input.id === null
      ? await client.from('announcements').insert(parsed.data)
      : await client.from('announcements').update(parsed.data).eq('id', input.id);
  if (error) throw new AppError(toAppErrorCode(error));
}

export async function setAnnouncementStatus(
  client: Db,
  id: string,
  status: AnnouncementStatus,
): Promise<void> {
  const { error } = await client.from('announcements').update({ status }).eq('id', id);
  if (error) throw new AppError(toAppErrorCode(error));
}

export async function deleteAnnouncement(client: Db, id: string): Promise<void> {
  const { error } = await client.from('announcements').delete().eq('id', id);
  if (error) throw new AppError(toAppErrorCode(error));
}

export function useAnnouncementsAdmin(client: TypedSupabaseClient) {
  return useQuery({
    queryKey: queryKeys.announcements.admin(),
    queryFn: () => fetchAnnouncementsAdmin(client),
  });
}

function useAnnouncementMutation<TInput>(
  client: TypedSupabaseClient,
  action: (client: TypedSupabaseClient, input: TInput) => Promise<void>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => action(client, input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all }),
  });
}

export function useSaveAnnouncement(client: TypedSupabaseClient) {
  return useAnnouncementMutation(client, saveAnnouncement);
}

export function useSetAnnouncementStatus(client: TypedSupabaseClient) {
  return useAnnouncementMutation(
    client,
    (target: TypedSupabaseClient, input: { id: string; status: AnnouncementStatus }) =>
      setAnnouncementStatus(target, input.id, input.status),
  );
}

export function useDeleteAnnouncement(client: TypedSupabaseClient) {
  return useAnnouncementMutation(client, (target: TypedSupabaseClient, id: string) =>
    deleteAnnouncement(target, id),
  );
}
