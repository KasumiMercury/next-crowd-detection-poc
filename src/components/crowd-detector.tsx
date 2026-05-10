"use client";

import { isWebGpuAvailable } from "@kasumimercury/web-crowd-detection-utils/onnx";
import {
  createLetterboxCapturer,
  reverseLetterboxBoxes,
} from "@kasumimercury/web-crowd-detection-utils/source";
import {
  createYoloDetector,
  type Detection,
  type YoloDetector,
} from "@kasumimercury/web-crowd-detection-utils/yolo";
import { useEffect, useRef, useState } from "react";

const INPUT_SIZE = 640;
const MODEL_URL = "/models/yolo26n.onnx";

export function CrowdDetector() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [started, setStarted] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!started) return;

    const controller = new AbortController();
    const { signal } = controller;
    let stream: MediaStream | null = null;
    setError(null);

    (async () => {
      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) {
          throw new Error("Video or canvas element is not mounted");
        }

        setStatus("Fetching model…");
        const modelResponse = await fetch(MODEL_URL, { signal });
        if (!modelResponse.ok) {
          throw new Error(
            `Failed to fetch model: ${modelResponse.status} ${modelResponse.statusText}`,
          );
        }
        const modelBuffer = await modelResponse.arrayBuffer();
        if (signal.aborted) return;

        const preferred = isWebGpuAvailable() ? "webgpu" : "wasm";
        setStatus(`Initializing detector (backend: ${preferred})…`);
        let detector: YoloDetector;
        try {
          detector = await createYoloDetector({
            modelPath: modelBuffer,
            executionProvider: preferred,
            inputSize: INPUT_SIZE,
            postprocess: { format: "auto" },
          });
        } catch (err) {
          if (preferred !== "webgpu") throw err;
          setStatus(
            `WebGPU init failed (${(err as Error).message}); falling back to WASM`,
          );
          detector = await createYoloDetector({
            modelPath: modelBuffer,
            executionProvider: "wasm",
            inputSize: INPUT_SIZE,
            postprocess: { format: "auto" },
          });
        }
        if (signal.aborted) return;

        setStatus("Requesting camera…");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (signal.aborted) {
          for (const track of stream.getTracks()) {
            track.stop();
          }
          stream = null;
          return;
        }

        video.srcObject = stream;
        await video.play();

        const capturer = createLetterboxCapturer({ inputSize: INPUT_SIZE });
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Failed to acquire 2D canvas context");
        }

        setStatus(`Running (backend: ${detector.backend})`);

        while (!signal.aborted) {
          if (video.readyState < video.HAVE_CURRENT_DATA) {
            await waitForFrame();
            continue;
          }

          syncCanvasSize(canvas, video);

          const { imageData, params } = capturer.capture(video);
          const detections = await detector.detect(imageData);
          if (signal.aborted) break;

          const mapped = reverseLetterboxBoxes(detections, params);
          drawDetections(ctx, canvas, mapped);
          await waitForFrame();
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } catch (err) {
        if (signal.aborted) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setStatus("Error");
      }
    })();

    return () => {
      controller.abort();
      if (stream) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
      }
      const video = videoRef.current;
      if (video) {
        video.srcObject = null;
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      setStatus("Idle");
    };
  }, [started]);

  return (
    <div className="flex w-full max-w-4xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setStarted((s) => !s)}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80"
        >
          {started ? "Stop" : "Start"}
        </button>
        <span className="text-sm text-foreground/80">{status}</span>
      </div>

      {error && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {error}
        </p>
      )}

      <div className="relative w-full overflow-hidden rounded-md border border-foreground/15 bg-black">
        <video
          ref={videoRef}
          muted
          playsInline
          className="block w-full"
          aria-label="Webcam preview"
        >
          <track kind="captions" />
        </video>
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      </div>

      <p className="text-xs text-foreground/60">
        Model: <code>{MODEL_URL}</code>
      </p>
    </div>
  );
}

function syncCanvasSize(canvas: HTMLCanvasElement, video: HTMLVideoElement) {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
    canvas.width = w;
    canvas.height = h;
  }
}

function drawDetections(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  detections: readonly Detection[],
) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const fontSize = Math.max(12, Math.round(canvas.width / 60));
  const lineWidth = Math.max(2, Math.round(canvas.width / 320));

  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = "#00ff88";
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textBaseline = "top";

  for (const d of detections) {
    const w = d.x2 - d.x1;
    const h = d.y2 - d.y1;
    ctx.strokeRect(d.x1, d.y1, w, h);

    const label = `${Math.round(d.score * 100)}%`;
    const labelH = fontSize + 4;
    const labelW = ctx.measureText(label).width + 8;
    ctx.fillStyle = "#00ff88";
    ctx.fillRect(d.x1, d.y1 - labelH, labelW, labelH);
    ctx.fillStyle = "#000";
    ctx.fillText(label, d.x1 + 4, d.y1 - labelH + 2);
  }
}

function waitForFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}
