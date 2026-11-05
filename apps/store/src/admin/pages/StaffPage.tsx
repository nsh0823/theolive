import { useState } from 'react';
import { Pencil, Plus, ShieldAlert } from 'lucide-react';
import { saveStaff } from '@/data/actions';
import { useStaffQuery } from '@/data/queries';
import { STAFF_PERMISSION_LABEL } from '@/domain/labels';
import type { StaffMember } from '@/domain/models';
import { Badge, BADGE_TONE } from '@/ui/Badge';
import { Button, IconButton } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { QueryBoundary } from '@/ui/QueryBoundary';
import { Switch } from '@/ui/Switch';
import { DataTable, Td, Th, Tr } from '@/ui/Table';
import { useToast } from '@/ui/Toast';
import { StaffFormDialog } from './StaffFormDialog';

export function StaffPage() {
  const staff = useStaffQuery();
  const { notify } = useToast();
  const [target, setTarget] = useState<StaffMember | 'new' | null>(null);
  const [deactivating, setDeactivating] = useState<StaffMember | null>(null);

  function toggleActive(member: StaffMember, isActive: boolean): void {
    if (!isActive) {
      setDeactivating(member);
      return;
    }
    saveStaff({ ...member, isActive });
    notify(`${member.name} 계정을 활성화했어요`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="note" className="flex gap-3 rounded-2xl bg-cream px-5 py-4 text-sm">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <p>
          이 화면의 직원·점주 구분과 권한 설정은{' '}
          <strong>화면 표시용이며 보안 경계가 아니에요.</strong> 실제 접근 권한은 서버(RLS와 서버
          검증)에서 확인해야 해요.
        </p>
      </div>
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
          status={staff.status}
          isEmpty={staff.data.length === 0}
          onRetry={staff.refetch}
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
              {staff.data.map((member) => (
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
          target={target}
          onClose={() => setTarget(null)}
          onSave={(member) => {
            saveStaff(member);
            notify(target === 'new' ? `${member.name}님을 초대했어요` : '직원 정보를 저장했어요');
            setTarget(null);
          }}
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
            saveStaff({ ...deactivating, isActive: false });
            notify(`${deactivating.name} 계정을 비활성화했어요`);
          }
          setDeactivating(null);
        }}
      />
    </div>
  );
}
