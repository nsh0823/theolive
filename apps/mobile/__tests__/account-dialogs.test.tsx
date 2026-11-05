import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { useAccountDialogs } from '@/components/other/AccountDialogs';
import { useDeleteAccountMutation } from '@/hooks/useAccount';
import { useCurrentProfile } from '@/hooks/useCurrentProfile';
import { useUpdateNicknameMutation } from '@/hooks/useProfileQuery';
import { useCartStore } from '@/store/useCartStore';

jest.mock('@/hooks/useAccount', () => ({ useDeleteAccountMutation: jest.fn() }));
jest.mock('@/hooks/useAuth', () => ({ useSignOut: () => ({ mutate: jest.fn() }) }));
jest.mock('@/hooks/useCurrentProfile', () => ({ useCurrentProfile: jest.fn() }));

function Harness() {
  const { dialogs, askDeletion, askNickname } = useAccountDialogs();
  return (
    <>
      <Pressable onPress={askDeletion} accessibilityLabel="탈퇴 열기">
        <Text>탈퇴</Text>
      </Pressable>
      <Pressable onPress={askNickname} accessibilityLabel="닉네임 열기">
        <Text>닉네임</Text>
      </Pressable>
      {dialogs}
    </>
  );
}

const mutate = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useDeleteAccountMutation).mockReturnValue({ mutate, isPending: false } as never);
  jest.mocked(useCurrentProfile).mockReturnValue({ data: { nickname: '피터' } } as never);
});

async function openDeletion() {
  await render(<Harness />);
  await fireEvent.press(screen.getByLabelText('탈퇴 열기'));
}

describe('account deletion', () => {
  it('asks first and only deletes after the confirmation', async () => {
    await openDeletion();
    expect(mutate).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('탈퇴하기'));
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('clears member data on the device only after the server succeeded', async () => {
    useCartStore.setState({
      lines: [{ menuItemId: 'm', name: 'x', unitPrice: 1000, temperature: null, quantity: 1 }],
    } as never);
    mutate.mockImplementation((_v, options: { onSuccess: () => void }) => {
      expect(useCartStore.getState().lines).toHaveLength(1);
      options.onSuccess();
    });
    await openDeletion();
    await act(async () => {
      await fireEvent.press(screen.getByLabelText('탈퇴하기'));
    });
    expect(useCartStore.getState().lines).toHaveLength(0);
  });

  it('explains an active order in plain language and keeps the data', async () => {
    mutate.mockImplementation((_v, options: { onError: (error: unknown) => void }) =>
      options.onError({ code: 'ACTIVE_ORDER_EXISTS' }),
    );
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await openDeletion();
    await act(async () => {
      await fireEvent.press(screen.getByLabelText('탈퇴하기'));
    });
    expect(screen.getByText(/진행 중인 주문이 있어서 탈퇴할 수 없어요/)).toBeOnTheScreen();
  });

  it('ignores a second tap while the request runs', async () => {
    jest.mocked(useDeleteAccountMutation).mockReturnValue({ mutate, isPending: true } as never);
    await openDeletion();
    await fireEvent.press(screen.getByLabelText('처리 중'));
    expect(mutate).not.toHaveBeenCalled();
  });
});

describe('nickname change', () => {
  const update = jest.fn();
  beforeEach(() => {
    jest
      .mocked(useUpdateNicknameMutation)
      .mockReturnValue({ mutate: update, isPending: false } as never);
  });

  async function openNickname() {
    await render(<Harness />);
    await fireEvent.press(screen.getByLabelText('닉네임 열기'));
  }

  it('starts from the current nickname and saves a valid one', async () => {
    await openNickname();
    expect(screen.getByLabelText('닉네임').props.value).toBe('피터');
    await fireEvent.changeText(screen.getByLabelText('닉네임'), ' 새이름 ');
    await fireEvent.press(screen.getByLabelText('저장'));
    expect(update).toHaveBeenCalledWith('새이름', expect.any(Object));
  });

  it('refuses an empty nickname without calling the server', async () => {
    await openNickname();
    await fireEvent.changeText(screen.getByLabelText('닉네임'), '   ');
    await fireEvent.press(screen.getByLabelText('저장'));
    expect(screen.getByText('닉네임을 입력해 주세요.')).toBeOnTheScreen();
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses a nickname over 20 characters', async () => {
    await openNickname();
    await fireEvent.changeText(screen.getByLabelText('닉네임'), '가'.repeat(21));
    await fireEvent.press(screen.getByLabelText('저장'));
    expect(screen.getByText('닉네임은 20자 이하로 입력해 주세요.')).toBeOnTheScreen();
    expect(update).not.toHaveBeenCalled();
  });

  it('shows a plain message when saving fails', async () => {
    update.mockImplementation((_v, options: { onError: () => void }) => options.onError());
    await openNickname();
    await fireEvent.press(screen.getByLabelText('저장'));
    expect(screen.getByText(/닉네임을 바꾸지 못했어요/)).toBeOnTheScreen();
  });
});
