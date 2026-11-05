import type { DailySalesPoint } from '@/domain/summaries';
import { formatWon } from '@/lib/format';

const WIDTH = 640;
const HEIGHT = 240;
const PAD = { top: 28, right: 12, bottom: 32, left: 12 } as const;
const BAR_GAP_RATIO = 0.35;
const MAN_WON = 10000;

/** Hand-rolled SVG bars (no chart library). Today is Deep Olive, earlier days Sage; values are labelled directly. */
export function SalesChart({ points }: { points: DailySalesPoint[] }) {
  const max = Math.max(...points.map((point) => point.value), 1);
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const slot = plotWidth / points.length;
  const barWidth = slot * (1 - BAR_GAP_RATIO);

  return (
    <figure>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="최근 7일 일별 매출 막대 차트"
        className="h-auto w-full"
      >
        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={HEIGHT - PAD.bottom}
          y2={HEIGHT - PAD.bottom}
          className="stroke-border"
          strokeWidth={1}
        />
        {points.map((point, index) => {
          const barHeight = Math.max(2, (point.value / max) * plotHeight);
          const x = PAD.left + slot * index + (slot - barWidth) / 2;
          const y = HEIGHT - PAD.bottom - barHeight;
          return (
            <g key={point.dayKey}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={6}
                className={point.isToday ? 'fill-primary' : 'fill-sage'}
              >
                <title>{`${point.label}: ${formatWon(point.value)}`}</title>
              </rect>
              <text
                x={x + barWidth / 2}
                y={y - 8}
                textAnchor="middle"
                className="fill-foreground text-[11px] font-semibold"
              >
                {`${(point.value / MAN_WON).toFixed(1)}만`}
              </text>
              <text
                x={x + barWidth / 2}
                y={HEIGHT - 10}
                textAnchor="middle"
                className={
                  point.isToday
                    ? 'fill-foreground text-[11px] font-bold'
                    : 'fill-muted-foreground text-[11px]'
                }
              >
                {point.isToday ? '오늘' : point.label}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">
        {points.map((point) => `${point.label} ${formatWon(point.value)}`).join(', ')}
      </figcaption>
    </figure>
  );
}
