import { useState } from 'react';
import { Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { deleteNotice, nextId, saveNotice, setNoticeStatus } from '@/data/actions';
import { useNoticesQuery } from '@/data/queries';
import { NOTICE_STATUS_LABEL } from '@/domain/labels';
import { NOTICE_STATUS, type Notice } from '@/domain/models';
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
  const notices = useNoticesQuery();
  const { notify } = useToast();
  const [target, setTarget] = useState<Notice | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Notice | null>(null);
  const sorted = [...notices.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

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
          status={notices.status}
          isEmpty={sorted.length === 0}
          onRetry={notices.refetch}
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
              {sorted.map((notice) => {
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
                          onClick={() => {
                            setNoticeStatus(
                              notice.id,
                              isPublished ? NOTICE_STATUS.UNPUBLISHED : NOTICE_STATUS.PUBLISHED,
                              new Date().toISOString(),
                            );
                            notify(
                              isPublished ? '공지를 비공개로 전환했어요' : '공지를 게시했어요',
                            );
                          }}
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
          onClose={() => setTarget(null)}
          onSave={(title, body, status, existing) => {
            const nowIso = new Date().toISOString();
            const wasPublished = existing?.status === NOTICE_STATUS.PUBLISHED;
            const publishedAt =
              status === NOTICE_STATUS.PUBLISHED
                ? wasPublished
                  ? (existing?.publishedAt ?? nowIso)
                  : nowIso
                : null;
            saveNotice({
              id: existing?.id ?? nextId('notice'),
              title,
              body,
              status,
              createdAt: existing?.createdAt ?? nowIso,
              publishedAt,
            });
            notify('공지를 저장했어요');
            setTarget(null);
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
          if (deleting) deleteNotice(deleting.id);
          setDeleting(null);
          notify('공지를 삭제했어요');
        }}
      />
    </div>
  );
}
