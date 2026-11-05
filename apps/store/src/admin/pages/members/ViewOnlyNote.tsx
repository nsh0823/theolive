import { ShieldAlert } from 'lucide-react';

/** Shown on every 회원관리 page. The role split is UI only; masking and access control belong to the server. */
export function ViewOnlyNote() {
  return (
    <div role="note" className="flex gap-3 rounded-2xl bg-cream px-5 py-4 text-sm">
      <ShieldAlert className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="font-semibold">보기 전용 · 개인정보는 마스킹되어 표시됩니다</p>
        <p className="text-muted-foreground">
          이 화면은 UI상 점주 전용이며 보안 경계가 아니에요. 실제 접근 권한 확인과 개인정보 마스킹은
          서버에서 처리해야 해요.
        </p>
      </div>
    </div>
  );
}
