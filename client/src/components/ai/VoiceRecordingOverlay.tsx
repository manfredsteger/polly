import { useEffect, useRef, useCallback } from "react";
import { Mic, Send, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface VoiceRecordingOverlayProps {
  isVisible: boolean;
  onStop: () => void;
  audioStream?: MediaStream | null;
  isTranscribing?: boolean;
  isListening?: boolean;
}

export function VoiceRecordingOverlay({
  isVisible,
  onStop,
  audioStream,
  isTranscribing = false,
  isListening = false,
}: VoiceRecordingOverlayProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const getPrimaryColor = useCallback(() => {
    const rawValue = getComputedStyle(document.documentElement)
      .getPropertyValue("--primary")
      .trim();
    if (!rawValue) return { full: "hsl(220, 70%, 45%)", half: "hsla(220, 70%, 45%, 0.4)" };
    return {
      full: `hsl(${rawValue})`,
      half: `hsla(${rawValue}, 0.4)`,
    };
  }, []);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    ctx.lineWidth = 3;
    const { full, half } = getPrimaryColor();
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, half);
    gradient.addColorStop(0.5, full);
    gradient.addColorStop(1, half);
    ctx.strokeStyle = gradient;
    ctx.beginPath();

    const sliceWidth = width / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const y = (dataArray[i] / 128.0) * (height / 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    animationRef.current = requestAnimationFrame(drawWaveform);
  }, [getPrimaryColor]);

  useEffect(() => {
    if (!isVisible || !audioStream) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }
    try {
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
      audioContext.createMediaStreamSource(audioStream).connect(analyser);
      drawWaveform();
    } catch (error) {
      console.error("[VoiceOverlay] Audio visualization error:", error);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [isVisible, audioStream, drawWaveform]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget && isListening) onStop();
      }}
    >
      <div
        className="relative bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/15 mb-3 animate-pulse">
            <Mic className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-1">
            {isTranscribing ? t("home.aiTranscribing") : t("home.aiListening")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {isTranscribing ? t("home.aiTranscribingHint") : t("home.aiSpeak")}
          </p>
        </div>

        <div className="relative h-20 mb-4 rounded-xl overflow-hidden bg-muted/30 border border-border">
          <canvas ref={canvasRef} className="w-full h-full" />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <div className="absolute left-7 top-1/2 -translate-y-1/2 text-xs text-red-400 font-medium">REC</div>
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={isListening ? onStop : undefined}
            disabled={!isListening}
            className="flex items-center justify-center w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg disabled:opacity-50 transition-colors"
          >
            {isTranscribing ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Send className="w-6 h-6" />
            )}
          </button>
        </div>
        <p className="text-center text-sm text-muted-foreground mt-2">
          {isTranscribing ? t("home.aiProcessingHint") : t("home.aiSendRecord")}
        </p>
      </div>
    </div>
  );
}
