/** Free MyMemory Translation API (no key required for light use) */
const MYMEMORY = 'https://api.mymemory.translated.net/get';

function hasChinese(text: string) {
  return /[\u4e00-\u9fff]/.test(text);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function translateOne(text: string): Promise<string> {
  const url = `${MYMEMORY}?q=${encodeURIComponent(text)}&langpair=zh-CN|en`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`翻译接口失败 (${res.status})`);
  }
  const data = (await res.json()) as {
    responseStatus?: number;
    responseData?: { translatedText?: string };
    quotaFinished?: boolean;
  };
  if (data.quotaFinished) {
    throw new Error('今日免费翻译额度已用完，请稍后再试');
  }
  if (data.responseStatus !== 200 || !data.responseData?.translatedText) {
    throw new Error('翻译失败，请稍后重试');
  }
  let out = data.responseData.translatedText.trim();
  // MyMemory sometimes echoes "MYMEMORY WARNING..." 
  if (out.toUpperCase().includes('MYMEMORY WARNING')) {
    throw new Error('翻译额度不足或请求过频，请稍后再试');
  }
  return out;
}

/** Translate unique Chinese strings; returns map original -> English */
export async function translateZhToEn(texts: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(texts.map((t) => t.trim()).filter((t) => t && hasChinese(t)))];
  const map: Record<string, string> = {};

  for (let i = 0; i < unique.length; i++) {
    const src = unique[i];
    // MyMemory free limit ~500 bytes per request
    if (Buffer.byteLength(src, 'utf8') > 450) {
      // split by lines
      const lines = src.split(/\n/);
      const translatedLines: string[] = [];
      for (const line of lines) {
        if (!line.trim() || !hasChinese(line)) {
          translatedLines.push(line);
          continue;
        }
        translatedLines.push(await translateOne(line.trim()));
        await sleep(300);
      }
      map[src] = translatedLines.join('\n');
    } else {
      map[src] = await translateOne(src);
      if (i < unique.length - 1) await sleep(280);
    }
  }
  return map;
}
