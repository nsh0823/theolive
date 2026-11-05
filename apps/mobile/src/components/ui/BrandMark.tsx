import { Image, View } from 'react-native';

// Official logo, 672x584. Rendered as-is with its native aspect ratio (no crop, recolor, or stretch).
const LOGO_SOURCE = require('../../../assets/brand/logo.png');
const LOGO_ASPECT_RATIO = 672 / 584;

// Explicit point widths, not percentages: a native-stack headerTitle gives its child no
// width, so a percentage width falls back to the image's intrinsic size and overflows.
const LOGO_WIDTH = { hero: 192, compact: 44 } as const;

type Props = { size?: keyof typeof LOGO_WIDTH };

export function BrandMark({ size = 'hero' }: Props) {
  const width = LOGO_WIDTH[size];
  const height = Math.round(width / LOGO_ASPECT_RATIO);

  return (
    <View
      className="self-center"
      accessible
      accessibilityRole="image"
      accessibilityLabel="더올리브 The O'live 로고"
    >
      <Image
        testID="brand-logo"
        source={LOGO_SOURCE}
        resizeMode="contain"
        style={{ width, height }}
      />
    </View>
  );
}
