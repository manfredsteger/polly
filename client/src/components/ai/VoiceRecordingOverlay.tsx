import { useEffect, useRef, useCallback, useState } from "react";
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
  const [visualizationActive, setVisualizationActive] = useState(false);

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
      setVisualizationActive(false);
      return;
    }

    let cancelled = false;

    const setupAudio = async () => {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) {
          console.warn("[VoiceOverlay] AudioContext not supported");
          return;
        }

        const audioContext = new AudioContextClass();
        audioContextRef.current = audioContext;

        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }

        if (cancelled) {
          audioContext.close();
          return;
        }

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;

        const source = audioContext.createMediaStreamSource(audioStream);
        source.connect(analyser);

        if (!cancelled) {
          setVisualizationActive(true);
          drawWaveform();
        }
      } catch (error: any) {
        console.error("[VoiceOverlay] Audio visualization error:", error?.message || error);
        setVisualizationActive(false);
      }
    };

    setupAudio();

    return () => {
      cancelled = true;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      analyserRef.current = null;
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

  const showFallbackAnimation = isListening && !visualizationActive;

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

          {showFallbackAnimation && (
            <div className="absolute inset-0 flex items-center justify-center gap-[3px]">
              {Array.from({ length: 24 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-primary rounded-full"
                  style={{
                    width: "3px",
                    animation: `voiceBar 1.2s ease-in-out ${i * 0.05}s infinite`,
                  }}
                />
              ))}
            </div>
          )}

          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-red-400 font-semibold tracking-wider">REC</span>
          </div>
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

      <style>{`
        @keyframes voiceBar {
          0%, 100% { height: 4px; }
          50% { height: ${isListening ? '32px' : '4px'}; }
        }
      `}</style>
    </div>
  );
}
