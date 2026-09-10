import type { QuoteItem } from '../types';

export type SpanInfo = {
  floorSpan: number;
  areaSpan: number;
  noSpan: number;
  showFloor: boolean;
  showArea: boolean;
  showNo: boolean;
  /** 按楼层分组后的序号（样张：同一楼层共用一个序号） */
  groupNo: number;
};

/** Compute rowspan for consecutive same floor / area；序号与楼层同步合并 */
export function computeSpans(items: QuoteItem[]): SpanInfo[] {
  const spans: SpanInfo[] = items.map(() => ({
    floorSpan: 1,
    areaSpan: 1,
    noSpan: 1,
    showFloor: true,
    showArea: true,
    showNo: true,
    groupNo: 1,
  }));

  let groupNo = 0;
  for (let i = 0; i < items.length; ) {
    let j = i + 1;
    while (j < items.length && items[j].floor === items[i].floor && items[i].floor) j++;
    const floorSpan = j - i;
    groupNo += 1;
    spans[i].floorSpan = floorSpan;
    spans[i].noSpan = floorSpan;
    spans[i].groupNo = groupNo;
    for (let k = i + 1; k < j; k++) {
      spans[k].showFloor = false;
      spans[k].showNo = false;
      spans[k].floorSpan = 0;
      spans[k].noSpan = 0;
      spans[k].groupNo = groupNo;
    }

    let a = i;
    while (a < j) {
      let b = a + 1;
      while (b < j && items[b].area === items[a].area && items[a].area) {
        b++;
      }
      spans[a].areaSpan = b - a;
      for (let k = a + 1; k < b; k++) {
        spans[k].showArea = false;
        spans[k].areaSpan = 0;
      }
      a = b;
    }
    i = j;
  }
  return spans;
}
