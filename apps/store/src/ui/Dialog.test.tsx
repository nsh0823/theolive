import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Dialog } from './Dialog';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        열기
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="테스트 대화상자">
        <input aria-label="내용" />
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('moves focus in, closes on Escape, and returns focus to the opener', async () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: '열기' });
    await userEvent.click(opener);
    expect(screen.getByRole('dialog', { name: '테스트 대화상자' })).toContainElement(
      document.activeElement instanceof HTMLElement ? document.activeElement : null,
    );
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
