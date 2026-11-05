import { NativeTabs } from 'expo-router/native-tabs';

import { useToneColor } from '@/lib/useToneColor';

/** PRD 4.1 / DESIGN.md: exactly four tabs, in this order, rendered natively. */
export default function TabsLayout() {
  const active = useToneColor('primary');
  const inactive = useToneColor('muted');
  const surface = useToneColor('card');

  return (
    <NativeTabs
      tintColor={active}
      backgroundColor={surface}
      iconColor={{ default: inactive, selected: active }}
      labelStyle={{ default: { color: inactive }, selected: { color: active } }}
    >
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Label>홈</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="order">
        <NativeTabs.Trigger.Label>오더</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'cup.and.saucer', selected: 'cup.and.saucer.fill' }}
          md="local_cafe"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="reward">
        <NativeTabs.Trigger.Label>리워드</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'gift', selected: 'gift.fill' }} md="redeem" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="other">
        <NativeTabs.Trigger.Label>더보기</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="ellipsis" md="more_horiz" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
