// Sonidos cortos generados con WebAudio — sin archivos externos.
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

export type SoundKind = "dm" | "mencion" | "general";

const TONOS: Record<SoundKind, number[]> = {
  dm: [880, 1320],       // ding agudo (DM directo)
  mencion: [660, 990],   // medio (mención canal)
  general: [520, 780],   // suave (notificación general)
};

export function reproducirSonido(kind: SoundKind, volumen = 0.35): void {
  const ac = getCtx();
  if (!ac) return;
  if (ac.state === "suspended") {
    ac.resume().catch(() => {});
  }
  const tones = TONOS[kind];
  const now = ac.currentTime;
  tones.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + i * 0.08);
    gain.gain.setValueAtTime(0, now + i * 0.08);
    gain.gain.linearRampToValueAtTime(volumen, now + i * 0.08 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.16);
    osc.connect(gain).connect(ac.destination);
    osc.start(now + i * 0.08);
    osc.stop(now + i * 0.08 + 0.18);
  });
}

// Llamar tras un gesto de usuario para "desbloquear" autoplay en Safari/Chrome.
export function precalentarAudio(): void {
  const ac = getCtx();
  if (ac && ac.state === "suspended") ac.resume().catch(() => {});
}
