import { useRef, useEffect } from "react";

interface VoiceVisualizerProps {
  isActive: boolean;
  audioContext: AudioContext | null;
  analyser: AnalyserNode | null;
  role: "agent" | "prospect";
  size?: number;
}

export function VoiceVisualizer({ isActive, analyser, role, size = 80 }: VoiceVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const dataRef = useRef<Uint8Array>(new Uint8Array(32));
  const smoothedRef = useRef<Float32Array>(new Float32Array(24));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const isAgent = role === "agent";
    const primary = isAgent ? "99,102,241" : "16,185,129";
    const cx = size / 2;
    const cy = size / 2;
    const radius = (size / 2) * 0.36;
    const bars = 24;
    let running = true;

    const paint = (active: boolean) => {
      ctx.clearRect(0, 0, size, size);
      const data = dataRef.current;
      if (analyser && active) {
        analyser.getByteFrequencyData(data);
      } else {
        data.fill(active ? 28 : 6);
      }

      let ampSum = 0;
      for (let j = 0; j < 8; j++) ampSum += data[j];
      const avgAmp = ampSum / 8 / 255;

      ctx.beginPath();
      ctx.arc(cx, cy, radius + 6 + avgAmp * 8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${primary},${active ? 0.1 : 0.04})`;
      ctx.fill();

      ctx.strokeStyle = `rgba(${primary},${active ? 0.7 : 0.25})`;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      for (let i = 0; i < bars; i++) {
        const dataIdx = Math.floor((i / bars) * data.length);
        const target = data[dataIdx] / 255;
        smoothedRef.current[i] += (target - smoothedRef.current[i]) * 0.2;
        const amp = smoothedRef.current[i] * (active ? 1 : 0.15);
        const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
        const barLen = radius * 0.28 * (0.3 + amp * 0.7) + 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
        ctx.lineTo(
          cx + Math.cos(angle) * (radius + barLen),
          cy + Math.sin(angle) * (radius + barLen),
        );
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${primary},${active ? 0.08 : 0.03})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${primary},${active ? 0.35 : 0.12})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };

    const loop = () => {
      if (!running) return;
      paint(true);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    paint(isActive);
    if (isActive) {
      animFrameRef.current = requestAnimationFrame(loop);
    }

    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [analyser, isActive, role, size]);

  return <canvas ref={canvasRef} style={{ width: size, height: size }} />;
}
