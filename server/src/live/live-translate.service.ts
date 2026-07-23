import { Injectable, Logger } from '@nestjs/common';

const BN_GLOSSARY: Record<string, string> = {
  hello: 'হ্যালো',
  hi: 'হাই',
  thanks: 'ধন্যবাদ',
  'thank you': 'ধন্যবাদ',
  love: 'ভালোবাসা',
  gift: 'গিফট',
  beautiful: 'সুন্দর',
  song: 'গান',
  dance: 'নাচ',
  welcome: 'স্বাগততম',
  bye: 'বিদায়',
  yes: 'হ্যাঁ',
  no: 'না',
  good: 'ভালো',
  great: 'দারুণ',
  funny: 'মজার',
  friend: 'বন্ধু',
  live: 'লাইভ',
  host: 'হোস্ট',
};

@Injectable()
export class LiveTranslateService {
  private readonly logger = new Logger(LiveTranslateService.name);
  private cache = new Map<string, string>();

  async translate(text: string, target: 'bn' | 'en' = 'bn') {
    const cleaned = text.trim();
    if (!cleaned) return { text: '', translated: '', target, provider: 'none' };
    const key = `${target}:${cleaned.toLowerCase()}`;
    if (this.cache.has(key)) {
      return {
        text: cleaned,
        translated: this.cache.get(key)!,
        target,
        provider: 'cache',
      };
    }

    // Fast path: glossary for common live chat words
    const lower = cleaned.toLowerCase();
    if (target === 'bn' && BN_GLOSSARY[lower]) {
      const translated = BN_GLOSSARY[lower];
      this.cache.set(key, translated);
      return { text: cleaned, translated, target, provider: 'glossary' };
    }

    // Free MyMemory API (no key) — best-effort, fails open to original
    try {
      const langpair = target === 'bn' ? 'en|bn' : 'bn|en';
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleaned.slice(0, 400))}&langpair=${langpair}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        const data = (await res.json()) as {
          responseData?: { translatedText?: string };
        };
        const translated = data.responseData?.translatedText?.trim();
        if (translated && translated.toLowerCase() !== lower) {
          this.cache.set(key, translated);
          return { text: cleaned, translated, target, provider: 'mymemory' };
        }
      }
    } catch (error) {
      this.logger.debug(`translate failed: ${String(error)}`);
    }

    return {
      text: cleaned,
      translated: cleaned,
      target,
      provider: 'passthrough',
    };
  }
}
