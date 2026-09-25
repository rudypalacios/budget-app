import { robustAverage, withoutOutliers } from './estimate';

describe('withoutOutliers (Tukey 1.5 × IQR)', () => {
  it('drops a one-off spike', () => {
    expect(withoutOutliers([800, 900, 850, 750, 6800, 900])).toEqual([800, 900, 850, 750, 900]);
  });

  it('keeps a sporadic but recurring pattern', () => {
    expect(withoutOutliers([0, 0, 500, 0, 0, 1200])).toEqual([0, 0, 500, 0, 0, 1200]);
  });

  it('treats a single non-zero month among zeros as an outlier', () => {
    expect(withoutOutliers([0, 0, 0, 0, 0, 1200])).toEqual([0, 0, 0, 0, 0]);
  });

  it('drops an unusually low month too', () => {
    expect(withoutOutliers([1000, 1050, 950, 1000, 1020, 10])).toEqual([
      1000, 1050, 950, 1000, 1020,
    ]);
  });
});

describe('robustAverage (D12)', () => {
  it('is null for no values', () => {
    expect(robustAverage([])).toBeNull();
  });

  it('is a plain average below 4 values (too few to call anything an outlier)', () => {
    expect(robustAverage([100, 100, 1000])).toBe(400);
  });

  it('excludes a one-off spike from 4+ values', () => {
    expect(robustAverage([800, 900, 850, 750, 6800, 900])).toBe(840);
  });

  it('keeps a sporadic-by-nature pattern', () => {
    expect(robustAverage([0, 0, 500, 0, 0, 1200])).toBeCloseTo(283.33, 2);
  });
});
