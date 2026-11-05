export const PIN_LENGTH = 4;

export type PinStep = 'enter' | 'confirm';
export type PinFlowState = { step: PinStep; first: string; entry: string; error: string | null };
export type PinFlowEvent =
  { type: 'digit'; value: string } | { type: 'delete' } | { type: 'reset' };

export const INITIAL_PIN_FLOW: PinFlowState = { step: 'enter', first: '', entry: '', error: null };

export const PIN_MISMATCH_MESSAGE = '비밀번호가 일치하지 않아요. 처음부터 다시 입력해 주세요.';

/** Pure state machine for set/confirm; completion is `isPinConfirmed`. */
export function pinFlowReducer(state: PinFlowState, event: PinFlowEvent): PinFlowState {
  if (event.type === 'reset') return INITIAL_PIN_FLOW;
  if (event.type === 'delete') return { ...state, entry: state.entry.slice(0, -1) };
  if (!/^\d$/.test(event.value) || state.entry.length >= PIN_LENGTH) return state;
  const entry = state.entry + event.value;
  if (entry.length < PIN_LENGTH) return { ...state, entry, error: null };
  if (state.step === 'enter') return { step: 'confirm', first: entry, entry: '', error: null };
  if (entry === state.first) return { ...state, entry, error: null };
  return { ...INITIAL_PIN_FLOW, error: PIN_MISMATCH_MESSAGE };
}

export const isPinConfirmed = (state: PinFlowState) =>
  state.step === 'confirm' && state.entry.length === PIN_LENGTH && state.entry === state.first;
