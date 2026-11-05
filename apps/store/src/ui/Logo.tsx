import logoUrl from '@/assets/logo.png';

// Official logo, used as-is. Native size is 672x584; both sizes keep that 1.1507 aspect ratio.
export const LOGO_SIZE = {
  COMPACT: { width: 46, height: 40 },
  REGULAR: { width: 69, height: 60 },
} as const;

type LogoProps = { size?: keyof typeof LOGO_SIZE };

export function Logo({ size = 'COMPACT' }: LogoProps) {
  const { width, height } = LOGO_SIZE[size];
  return <img src={logoUrl} width={width} height={height} alt="The O'live Café" />;
}
