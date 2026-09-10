/** Pricing rules matching the sample quotation */
export function calcItemAmount(input: {
  type: string;
  width: number;
  height: number;
  unitPrice: number;
  sqm?: number;
}): { sqm: number; amount: number } {
  const width = Number(input.width) || 0;
  const height = Number(input.height) || 0;
  const unitPrice = Number(input.unitPrice) || 0;
  const isBlind = input.type.includes('百叶');

  if (isBlind) {
    const sqm =
      width > 0 && height > 0
        ? Math.round(width * height * 100) / 100
        : Math.round((Number(input.sqm) || 0) * 100) / 100;
    const amount = Math.round(sqm * unitPrice * 100) / 100;
    return { sqm, amount };
  }

  const amount = Math.round(width * unitPrice * 100) / 100;
  return { sqm: 0, amount };
}
