import { useInviteStaff, useStaffList, useUpdateStaff, type StaffListItem } from '@theolive/api';
import { APP_ERROR_MESSAGE, toAppErrorCode } from '@theolive/types';
import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { useSupabase } from '@/auth/AuthContext';
import { toBoundaryStatus } from '@/data/queryStatus';
import { STAFF_PERMISSION_LABEL } from '@/domain/labels';
import { Badge, BADGE_TONE } from '@/ui/Badge';
import { Button, IconButton } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { QueryBoundary } from '@/ui/QueryBoundary';
import { Switch } from '@/ui/Switch';
import { DataTable, Td, Th, Tr } from '@/ui/Table';
import { useToast } from '@/ui/Toast';
import { StaffFormDialog, type StaffFormValues } from './StaffFormDialog';

function errorMessage(error: unknown): string {
  return APP_ERROR_MESSAGE[toAppErrorCode(error instanceof Error ? error : null)];
}

export function StaffPage() {
  const client = useSupabase();
  const staff = useStaffList(client);
  const updateStaff = useUpdateStaff(client);
  const inviteStaff = useInviteStaff(client);
  const { notify } = useToast();
  const [target, setTarget] = useState<StaffListItem | 'new' | null>(null);
  const [deactivating, setDeactivating] = useState<StaffListItem | null>(null);
  const members = staff.data ?? [];

  function saveMember(member: StaffListItem, successMessage: string, onDone?: () => void): void {
    updateStaff.mutate(
      {
        userId: member.id,
        displayName: member.name,
        role: member.role,
        permissions: member.permissions,
        isActive: member.isActive,
      },
      {
        onSuccess: () => {
          notify(successMessage);
          onDone?.();
        },
        onError: (error) => notify(errorMessage(error)),
      },
    );
  }

  function toggleActive(member: StaffListItem, isActive: boolean): void {
    if (!isActive) {
      setDeactivating(member);
      return;
    }
    saveMember({ ...member, isActive }, `${member.name} 계정을 활성화했어요`);
  }

  function handleSave(values: StaffFormValues): void {
    if (target === 'new') {
      inviteStaff.mutate(
        {
          email: values.email,
          displayName: values.name,
          role: 'STAFF',
          permissions: values.permissions,
        },
        {
          onSuccess: () => {
            notify(`${values.name}님을 초대했어요`);
            setTarget(null);
          },
          onError: (error) => notify(errorMessage(error)),
        },
      );
      return;
    }
    if (target) {
      saveMember(
        { ...target, name: values.name, permissions: values.permissions },
        '직원 정보를 저장했어요',
        () => setTarget(null),
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          icon={<Plus className="size-4" aria-hidden="true" />}
          onClick={() => setTarget('new')}
        >
          직원 추가
        </Button>
      </div>
      <Card>
        <QueryBoundary
          status={toBoundaryStatus(staff.status)}
          isEmpty={members.length === 0}
          onRetry={() => void staff.refetch()}
          emptyTitle="등록된 직원이 없어요"
          emptyAction={<Button onClick={() => setTarget('new')}>직원 추가</Button>}
          loadingLabel="직원 목록을 불러오는 중이에요"
        >
          <DataTable caption="직원 목록">
            <thead>
              <tr>
                <Th>이름</Th>
                <Th>이메일</Th>
                <Th>권한</Th>
                <Th>계정 상태</Th>
                <Th>활성화</Th>
                <Th>
                  <span className="sr-only">관리</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <Tr key={member.id}>
                  <Td className="font-semibold">{member.name}</Td>
                  <Td className="text-muted-foreground">{member.email}</Td>
                  <Td>
                    <span className="flex flex-wrap gap-1">
                      {member.permissions.map((p) => (
                        <Badge key={p} tone={BADGE_TONE.SAGE}>
                          {STAFF_PERMISSION_LABEL[p]}
                        </Badge>
                      ))}
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={member.isActive ? BADGE_TONE.PRIMARY : BADGE_TONE.NEUTRAL}>
                      {member.isActive ? '활성' : '비활성'}
                    </Badge>
                  </Td>
                  <Td>
                    <Switch
                      checked={member.isActive}
                      onChange={(value) => toggleActive(member, value)}
                      label={`${member.name} 계정 활성화`}
                    />
                  </Td>
                  <Td>
                    <IconButton
                      label={`${member.name} 정보 수정`}
                      className="size-11"
                      onClick={() => setTarget(member)}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </IconButton>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        </QueryBoundary>
      </Card>
      {target ? (
        <StaffFormDialog
          key={target === 'new' ? 'new' : target.id}
          existing={target === 'new' ? null : target}
          isSaving={updateStaff.isPending || inviteStaff.isPending}
          onClose={() => setTarget(null)}
          onSave={handleSave}
        />
      ) : null}
      <ConfirmDialog
        open={deactivating !== null}
        title={`${deactivating?.name ?? ''} 계정을 비활성화할까요?`}
        description="비활성화하면 Store Web에 로그인할 수 없어요. 언제든 다시 활성화할 수 있어요."
        confirmLabel="비활성화"
        isDestructive
        onCancel={() => setDeactivating(null)}
        onConfirm={() => {
          if (deactivating) {
            saveMember(
              { ...deactivating, isActive: false },
              `${deactivating.name} 계정을 비활성화했어요`,
            );
          }
          setDeactivating(null);
        }}
      />
    </div>
  );
}
