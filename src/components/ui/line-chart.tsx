import { useTranslation } from 'react-i18next';
import { Circle, Line, Path, Svg } from 'react-native-svg';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// FR-7: actual paid, budgeted, and rolling average over time.
export type LineChartPoint = {
  label: string;
  actual: number | null;
  budgeted: number;
  rollingAverage: number | null;
};

export type LineChartProps = {
  data: LineChartPoint[];
  width?: number;
  height?: number;
};

const PADDING_X = 16;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 24;
const GRID_LINES = 3;

function buildPath(
  values: (number | null)[],
  toX: (index: number) => number,
  toY: (value: number) => number,
) {
  const segments: string[] = [];
  let segmentOpen = false;

  values.forEach((value, index) => {
    if (value == null) {
      segmentOpen = false;
      return;
    }
    const command = segmentOpen ? 'L' : 'M';
    segments.push(`${command}${toX(index)},${toY(value)}`);
    segmentOpen = true;
  });

  return segments.join(' ');
}

export function LineChart({ data, width = 320, height = 180 }: LineChartProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const allValues = data
    .flatMap((point) => [point.actual, point.budgeted, point.rollingAverage])
    .filter((value): value is number => value != null);
  const maxY = Math.max(...allValues, 1) * 1.1;

  const plotWidth = width - PADDING_X * 2;
  const plotHeight = height - PADDING_TOP - PADDING_BOTTOM;
  const xStep = data.length > 1 ? plotWidth / (data.length - 1) : 0;

  const toX = (index: number) => PADDING_X + index * xStep;
  const toY = (value: number) => PADDING_TOP + plotHeight - (value / maxY) * plotHeight;

  const actualPath = buildPath(
    data.map((d) => d.actual),
    toX,
    toY,
  );
  const budgetedPath = buildPath(
    data.map((d) => d.budgeted),
    toX,
    toY,
  );
  const averagePath = buildPath(
    data.map((d) => d.rollingAverage),
    toX,
    toY,
  );

  return (
    <View>
      <Svg width={width} height={height} accessibilityLabel={t('history.chartAccessibilityLabel')}>
        {Array.from({ length: GRID_LINES }).map((_, i) => {
          const y = PADDING_TOP + (plotHeight / (GRID_LINES - 1)) * i;
          return (
            <Line
              key={i}
              x1={PADDING_X}
              y1={y}
              x2={width - PADDING_X}
              y2={y}
              stroke={theme.border}
              strokeWidth={1}
            />
          );
        })}

        <Path
          d={budgetedPath}
          stroke={theme.textSecondary}
          strokeWidth={1.5}
          strokeDasharray="4,4"
          fill="none"
        />
        <Path
          d={averagePath}
          stroke={theme.warning}
          strokeWidth={1.5}
          strokeDasharray="1,3"
          fill="none"
        />
        <Path d={actualPath} stroke={theme.tint} strokeWidth={2.5} fill="none" />

        {data.map(
          (point, index) =>
            point.actual != null && (
              <Circle key={index} cx={toX(index)} cy={toY(point.actual)} r={3} fill={theme.tint} />
            ),
        )}
      </Svg>

      <View style={styles.labelRow}>
        {data.map((point, index) => (
          <ThemedText key={index} type="caption" style={styles.label}>
            {point.label}
          </ThemedText>
        ))}
      </View>

      <View style={styles.legendRow}>
        <LegendEntry color={theme.tint} label={t('history.legend.actual')} />
        <LegendEntry color={theme.textSecondary} label={t('history.legend.budgeted')} />
        <LegendEntry color={theme.warning} label={t('history.legend.sixMonthAvg')} />
      </View>
    </View>
  );
}

function LegendEntry({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendEntry}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <ThemedText type="caption">{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: PADDING_X - Spacing.one,
  },
  label: {
    flex: 1,
    textAlign: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  legendEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
