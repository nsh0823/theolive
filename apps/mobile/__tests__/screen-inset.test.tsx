import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { CONTENT_BOTTOM_GAP, TAB_BAR_HEIGHT, tabBarClearance } from '@/lib/layout';

const HOME_INDICATOR_INSET = 34;
const FOOTER_HEIGHT = 120;

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));

function scrollPadding(): number {
  const style = StyleSheet.flatten(screen.getByTestId('screen-scroll').props.contentContainerStyle);
  return style.paddingBottom;
}

// Regression: the floating tab bar covered the last element on Home ("리워드 전체 보기").
describe('Screen tab bar clearance', () => {
  it('reserves tab bar height plus the home-indicator inset below the last element', async () => {
    await render(
      <Screen>
        <Text>last</Text>
      </Screen>,
    );
    expect(scrollPadding()).toBe(tabBarClearance(HOME_INDICATOR_INSET) + CONTENT_BOTTOM_GAP);
    expect(scrollPadding()).toBeGreaterThanOrEqual(TAB_BAR_HEIGHT + HOME_INDICATOR_INSET);
  });

  it('skips the tab bar space on screens outside the tab navigator', async () => {
    await render(
      <Screen hasTabBar={false}>
        <Text>last</Text>
      </Screen>,
    );
    expect(scrollPadding()).toBe(HOME_INDICATOR_INSET + CONTENT_BOTTOM_GAP);
  });

  it('lifts the sticky footer above the tab bar and pads content by its measured height', async () => {
    await render(
      <Screen footer={<Text>footer</Text>}>
        <Text>last</Text>
      </Screen>,
    );
    const footer = screen.getByTestId('screen-footer');
    expect(StyleSheet.flatten(footer.props.style).bottom).toBe(
      tabBarClearance(HOME_INDICATOR_INSET),
    );
    await fireEvent(footer, 'layout', { nativeEvent: { layout: { height: FOOTER_HEIGHT } } });
    expect(scrollPadding()).toBe(
      tabBarClearance(HOME_INDICATOR_INSET) + FOOTER_HEIGHT + CONTENT_BOTTOM_GAP,
    );
  });
});
