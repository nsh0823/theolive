import { useState } from 'react';
import { Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  useAnnouncementsAdmin,
  useDeleteAnnouncement,
  useSaveAnnouncement,
  useSetAnnouncementStatus,
  type AnnouncementView,
} from '@theolive/api';
import { useSupabase } from '@/auth/AuthContext';
import { toBoundaryStatus } from '@/data/queryStatus';
import { NOTICE_STATUS_LABEL } from '@/domain/labels';
import { NOTICE_STATUS } from '@/domain/models';
import { describeError } from '@/lib/errorMessage';
import { Badge, BADGE_TONE } from '@/ui/Badge';
import { Button, IconButton } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { QueryBoundary } from '@/ui/QueryBoundary';
import { DataTable, Td, Th, Tr } from '@/ui/Table';
import { useToast } from '@/ui/Toast';
import { formatDateTime } from '@/lib/format';
import { NoticeFormDialog } from './NoticeFormDialog';

export function NoticesPage() {
  const client = useSupabase();
  const notices = useAnnouncementsAdmin(client);
  const save = useSaveAnnouncement(client);
  const setStatus = useSetAnnouncementStatus(client);
  const remove = useDeleteAnnouncement(client);
  const { notify } = useToast();
  const [target, setTarget] = useState<AnnouncementView | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AnnouncementView | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const list = notices.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          icon={<Plus className="size-4" aria-hidden="true" />}
          onClick={() => setTarget('new')}
        >
          공지 작성
        </Button>
      </div>
      <Card>
        <QueryBoundary
          status={toBoundaryStatus(notices.status)}
          isEmpty={list.length === 0}
          onRetry={() => void notices.refetch()}
          emptyTitle="작성된 공지가 없어요"
          emptyDescription="고객 앱에 보여줄 첫 공지를 작성해 보세요."
          emptyAction={<Button onClick={() => setTarget('new')}>공지 작성</Button>}
          loadingLabel="공지를 불러오는 중이에요"
        >
          <DataTable caption="공지사항 목록과 게시 이력">
            <thead>
              <tr>
                <Th>제목</Th>
                <Th>게시 상태</Th>
                <Th>작성일</Th>
                <Th>게시일</Th>
                <Th>
                  <span className="sr-only">관리</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {list.map((notice) => {
                const isPublished = notice.status === NOTICE_STATUS.PUBLISHED;
                return (
                  <Tr key={notice.id}>
                    <Td>
                      <p className="font-semibold">{notice.title}</p>
                      <p className="max-w-md truncate text-xs text-muted-foreground">
                        {notice.body}
                      </p>
                    </Td>
                    <Td>
                      <Badge tone={isPublished ? BADGE_TONE.PRIMARY : BADGE_TONE.NEUTRAL}>
                        {NOTICE_STATUS_LABEL[notice.status]}
                      </Badge>
                    </Td>
                    <Td className="tabular-nums">{formatDateTime(notice.createdAt)}</Td>
                    <Td className="tabular-nums">
                      {notice.publishedAt ? formatDateTime(notice.publishedAt) : '-'}
                    </Td>
                    <Td>
                      <span className="flex">
                        <IconButton
                          label={`${notice.title} ${isPublished ? '비공개로 전환' : '게시'}`}
                          className="size-11"
                          disabled={setStatus.isPending}
                          onClick={() =>
                            setStatus.mutate(
                              {
                                id: notice.id,
                                status: isPublished
                                  ? NOTICE_STATUS.UNPUBLISHED
                                  : NOTICE_STATUS.PUBLISHED,
                              },
                              {
                                onSuccess: () =>
                                  notify(
                                    isPublished
                                      ? '공지를 비공개로 전환했어요'
                                      : '공지를 게시했어요',
                                  ),
                                onError: (error) => notify(describeError(error)),
                              },
                            )
                          }
                        >
                          {isPublished ? (
                            <EyeOff className="size-4" aria-hidden="true" />
                          ) : (
                            <Eye className="size-4" aria-hidden="true" />
                          )}
                        </IconButton>
                        <IconButton
                          label={`${notice.title} 수정`}
                          className="size-11"
                          onClick={() => setTarget(notice)}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </IconButton>
                        <IconButton
                          label={`${notice.title} 삭제`}
                          className="size-11"
                          onClick={() => setDeleting(notice)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </IconButton>
                      </span>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </DataTable>
        </QueryBoundary>
      </Card>
      {target ? (
        <NoticeFormDialog
          key={target === 'new' ? 'new' : target.id}
          target={target}
          isSaving={save.isPending}
          error={saveError}
          onClose={() => {
            setSaveError(null);
            setTarget(null);
          }}
          onSave={(title, body, status, existing) => {
            setSaveError(null);
            save.mutate(
              { id: existing?.id ?? null, title, body, status },
              {
                onSuccess: () => {
                  notify('공지를 저장했어요');
                  setTarget(null);
                },
                onError: (error) => setSaveError(describeError(error)),
              },
            );
          }}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        title="공지를 삭제할까요?"
        description="삭제하면 고객 앱에서도 사라지고 복구할 수 없어요. 숨기려면 비공개로 전환하세요."
        confirmLabel="삭제"
        isDestructive
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, {
            onSuccess: () => notify('공지를 삭제했어요'),
            onError: (error) => notify(describeError(error)),
          });
          setDeleting(null);
        }}
      />
    </div>
  );
}
