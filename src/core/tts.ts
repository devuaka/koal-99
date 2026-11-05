// Text to speech helpers (browser speechSynthesis), shared by the TTS app and the terminal's SAY.
export const ttsOK = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

export function voiceList(): SpeechSynthesisVoice[] {
  if (!ttsOK()) return [];
  return speechSynthesis.getVoices().slice().sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
}

export function pickVoice(uri?: string): SpeechSynthesisVoice | undefined {
  const list = voiceList();
  if (uri) {
    const v = list.find((x) => x.voiceURI === uri);
    if (v) return v;
  }
  const lang = (navigator.language || 'en').toLowerCase();
  return list.find((v) => v.lang.toLowerCase() === lang && v.default) ?? list.find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2))) ?? list.find((v) => v.default) ?? list[0];
}

/** Split text into sentence-sized pieces; long utterances get cut off in some browsers. o = offset in the text. */
export function chunks(text: string, max = 200): { t: string; o: number }[] {
  const out: { t: string; o: number }[] = [];
  const re = /[^.!?\n]+[.!?]*\s*|\n+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    let s = m[0];
    let off = m.index;
    while (s.length > max) {
      let cut = s.lastIndexOf(' ', max);
      if (cut < max / 2) cut = max;
      out.push({ t: s.slice(0, cut), o: off });
      s = s.slice(cut);
      off += cut;
    }
    if (s.trim()) out.push({ t: s, o: off });
  }
  return out;
}

export interface TtsSettings {
  voice: string;
  rate: number;
  pitch: number;
  vol: number;
}

export function loadTtsSettings(): TtsSettings {
  try {
    return { voice: '', rate: 1, pitch: 1, vol: 1, ...(JSON.parse(localStorage.getItem('koal99.tts') ?? '{}') as Partial<TtsSettings>) };
  } catch {
    return { voice: '', rate: 1, pitch: 1, vol: 1 };
  }
}

export function saveTtsSettings(s: TtsSettings) {
  try {
    localStorage.setItem('koal99.tts', JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Speak text with the saved voice settings. */
export function say(text: string) {
  if (!ttsOK() || !text.trim()) return;
  const st = loadTtsSettings();
  speechSynthesis.cancel();
  for (const c of chunks(text)) {
    const u = new SpeechSynthesisUtterance(c.t);
    const v = pickVoice(st.voice);
    if (v) {
      u.voice = v;
      u.lang = v.lang;
    }
    u.rate = st.rate;
    u.pitch = st.pitch;
    u.volume = st.vol;
    speechSynthesis.speak(u);
  }
}
