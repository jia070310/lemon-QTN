export type MeasureUnit = 'm' | 'ft';

export const MEASURE_UNIT_OPTIONS: {
  value: MeasureUnit;
  label: string;
  widthLabel: string;
  heightLabel: string;
  areaLabel: string;
  widthEn: string;
  heightEn: string;
  areaEn: string;
}[] = [
  {
    value: 'm',
    label: '米制 (M / ㎡)',
    widthLabel: '宽(M)',
    heightLabel: '高(M)',
    areaLabel: '平方(㎡)',
    widthEn: 'W',
    heightEn: 'H',
    areaEn: 'SQM',
  },
  {
    value: 'ft',
    label: '英制 (英尺 / ft²)',
    widthLabel: '宽(英尺)',
    heightLabel: '高(英尺)',
    areaLabel: '平方(ft²)',
    widthEn: 'W(ft)',
    heightEn: 'H(ft)',
    areaEn: 'SQFT',
  },
];

export function getMeasureLabels(unit: MeasureUnit = 'm') {
  return MEASURE_UNIT_OPTIONS.find((o) => o.value === unit) ?? MEASURE_UNIT_OPTIONS[0];
}

/** 宽/高常用预设 */
export const WIDTH_HEIGHT_PRESETS: Record<MeasureUnit, number[]> = {
  m: [0.8, 1.0, 1.2, 1.5, 1.8, 2.0, 2.2, 2.4, 2.5, 2.8, 3.0, 3.2, 3.5, 4.0, 4.5, 5.0],
  ft: [2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 8, 9, 10, 12, 14],
};

/** 平方常用预设（可手选，百叶也会自动算） */
export const AREA_PRESETS: Record<MeasureUnit, number[]> = {
  m: [1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 8, 10],
  ft: [10, 12, 15, 18, 20, 24, 30, 36, 40, 48, 60],
};
