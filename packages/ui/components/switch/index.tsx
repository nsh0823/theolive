'use client';
import React from 'react';
import { Switch as RNSwitch } from 'react-native';
import { createSwitch } from '@gluestack-ui/core/switch/creator';
import { withStyleContext } from '@gluestack-ui/utils/nativewind-utils';
import { useResolveClassNames } from 'uniwind';

const UISwitch = createSwitch({
  Root: withStyleContext(RNSwitch),
});

type ISwitchProps = React.ComponentProps<typeof UISwitch>;

// Restyled from the generated version: RN's Switch has no `className`, so the track and
// thumb colors are resolved from theme tokens instead (primary on, border off).
const Switch = React.forwardRef<React.ComponentRef<typeof UISwitch>, ISwitchProps>(
  function Switch(props, ref) {
    const on = useResolveClassNames('text-primary').color;
    const off = useResolveClassNames('text-muted-foreground').color;
    const thumb = useResolveClassNames('text-card').color;
    return (
      <UISwitch
        ref={ref}
        trackColor={{ true: on, false: off }}
        thumbColor={thumb}
        ios_backgroundColor={off}
        {...props}
      />
    );
  },
);

Switch.displayName = 'Switch';
export { Switch };
