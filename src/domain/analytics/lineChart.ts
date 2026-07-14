export type LineChartInputPoint = {
  label: string;
  value: number;
};

export type LineChartPlotPoint = LineChartInputPoint & {
  x: number;
  y: number;
};

export function getLineChartPlot(
  points: readonly LineChartInputPoint[],
  width: number,
  height: number,
  padding = 10,
): LineChartPlotPoint[] {
  if (points.length === 0 || width <= 0 || height <= 0) return [];

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const drawableWidth = Math.max(width - padding * 2, 0);
  const drawableHeight = Math.max(height - padding * 2, 0);
  const singleX = padding + drawableWidth / 2;
  const singleY = padding + drawableHeight / 2;

  return points.map((point, index) => ({
    ...point,
    x:
      points.length === 1
        ? singleX
        : padding + (index / (points.length - 1)) * drawableWidth,
    y: max === min ? singleY : padding + ((max - point.value) / range) * drawableHeight,
  }));
}
