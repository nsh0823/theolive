import { MAX_LINE_QUANTITY, useCartStore } from '@/store/useCartStore';

beforeEach(() => {
  useCartStore.setState({ lines: [], orderType: 'TAKEOUT' });
});

describe('useCartStore', () => {
  it('merges the same menu item and temperature', () => {
    const { addLine } = useCartStore.getState();
    addLine('americano', 'HOT', 1);
    addLine('americano', 'HOT', 2);
    expect(useCartStore.getState().lines).toEqual([
      { menuItemId: 'americano', temperature: 'HOT', quantity: 3 },
    ]);
  });

  it('keeps different temperatures as separate lines', () => {
    const { addLine } = useCartStore.getState();
    addLine('americano', 'HOT', 1);
    addLine('americano', 'ICE', 1);
    expect(useCartStore.getState().lines).toHaveLength(2);
  });

  it('clamps quantity to the allowed range', () => {
    const { addLine, setQuantity } = useCartStore.getState();
    addLine('latte', 'ICE', 1);
    setQuantity('latte', 'ICE', 0);
    expect(useCartStore.getState().lines[0]?.quantity).toBe(1);
    setQuantity('latte', 'ICE', 999);
    expect(useCartStore.getState().lines[0]?.quantity).toBe(MAX_LINE_QUANTITY);
  });

  it('removes a line', () => {
    const { addLine, removeLine } = useCartStore.getState();
    addLine('latte', 'ICE', 1);
    removeLine('latte', 'ICE');
    expect(useCartStore.getState().lines).toEqual([]);
  });
});

describe('items without a temperature choice (OQ-16)', () => {
  it('stores them with a null temperature, merges them and keeps ids only', () => {
    const { addLine } = useCartStore.getState();
    addLine('bottled-water', null, 1);
    addLine('bottled-water', null, 2);
    expect(useCartStore.getState().lines).toEqual([
      { menuItemId: 'bottled-water', temperature: null, quantity: 3 },
    ]);
  });

  it('removes and re-quantifies them by item id and null temperature', () => {
    const { addLine, setQuantity, removeLine } = useCartStore.getState();
    addLine('bottled-water', null, 1);
    setQuantity('bottled-water', null, 5);
    expect(useCartStore.getState().lines[0]?.quantity).toBe(5);
    removeLine('bottled-water', null);
    expect(useCartStore.getState().lines).toEqual([]);
  });
});
