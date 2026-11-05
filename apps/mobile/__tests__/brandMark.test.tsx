import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { BrandMark } from '@/components/ui/BrandMark';

const LOGO_ASPECT_RATIO = 672 / 584;

// Regression: inside a native-stack headerTitle the container has no width, so a
// percentage width rendered the logo at its full intrinsic size over the header.
describe('BrandMark', () => {
  it.each(['hero', 'compact'] as const)(
    'renders the %s logo with explicit numeric dimensions at the native aspect ratio',
    async (size) => {
      await render(<BrandMark size={size} />);
      const style = StyleSheet.flatten(screen.getByTestId('brand-logo').props.style);

      expect(typeof style.width).toBe('number');
      expect(typeof style.height).toBe('number');
      expect(style.width / style.height).toBeCloseTo(LOGO_ASPECT_RATIO, 1);
    },
  );

  it('keeps the compact header logo within a standard header height', async () => {
    await render(<BrandMark size="compact" />);
    const style = StyleSheet.flatten(screen.getByTestId('brand-logo').props.style);

    expect(style.height).toBeLessThanOrEqual(44);
  });
});
