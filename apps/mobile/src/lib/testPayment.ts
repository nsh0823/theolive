import { TEST_PG_SCENARIO, type TestPgScenario } from '@theolive/types';

/** Scenarios every build shows: approve, fail, cancel. */
export const PRIMARY_SCENARIOS: { scenario: TestPgScenario; label: string }[] = [
  { scenario: TEST_PG_SCENARIO.SUCCESS, label: '승인' },
  { scenario: TEST_PG_SCENARIO.FAIL, label: '실패' },
  { scenario: TEST_PG_SCENARIO.CANCEL, label: '취소' },
];

/** Edge cases for developers only (`__DEV__` builds): they exercise recovery paths of the server. */
export const DEV_SCENARIOS: { scenario: TestPgScenario; label: string }[] = [
  { scenario: TEST_PG_SCENARIO.SUCCESS_WEBHOOK_ONLY, label: '승인 (앱 종료 시뮬레이션: 웹훅만)' },
  { scenario: TEST_PG_SCENARIO.SUCCESS_DUPLICATE_WEBHOOK, label: '승인 + 웹훅 중복' },
  { scenario: TEST_PG_SCENARIO.SUCCESS_LATE, label: '승인 (주문 만료 후 늦은 승인)' },
  { scenario: TEST_PG_SCENARIO.AMOUNT_MISMATCH, label: '승인 (금액 불일치)' },
];

export function visibleScenarios(isDev: boolean) {
  return isDev ? [...PRIMARY_SCENARIOS, ...DEV_SCENARIOS] : PRIMARY_SCENARIOS;
}
