"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type CameraStatus = "idle" | "starting" | "active" | "error";

const cameraStatusLabel: Record<CameraStatus, string> = {
  idle: "停止中",
  starting: "起動中",
  active: "使用中",
  error: "エラー",
};

export function WebcamPreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setStatus("idle");
  }, []);

  const startCamera = useCallback(async () => {
    setStatus("starting");
    setErrorMessage(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setErrorMessage("このブラウザではWebカメラを利用できません。");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => {
          track.stop();
        });
        return;
      }

      stopCamera();
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setStatus("active");
    } catch (error) {
      setStatus("error");

      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setErrorMessage("カメラの使用が許可されませんでした。");
        return;
      }

      setErrorMessage("カメラを起動できませんでした。");
    }
  }, [stopCamera]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      streamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
    };
  }, []);

  const isStarting = status === "starting";
  const isActive = status === "active";

  return (
    <section className="flex w-full max-w-4xl flex-col gap-6 px-6 py-10 sm:px-10">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-zinc-500">Webcam Preview</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
          Webカメラで人の在席を確認する
        </h1>
        <p className="max-w-2xl text-base leading-7 text-zinc-600">
          カメラ映像のプレビューを表示します。YOLOによる判定はまだ実装していません。
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-950 shadow-sm">
        <video
          ref={videoRef}
          className="aspect-video w-full bg-zinc-950 object-cover"
          autoPlay
          muted
          playsInline
        />
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-500">カメラ状態</span>
          <span className="text-lg font-semibold text-zinc-950">
            {cameraStatusLabel[status]}
          </span>
          {errorMessage ? (
            <p className="text-sm font-medium text-red-600">{errorMessage}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={startCamera}
            disabled={isStarting || isActive}
            className="inline-flex h-11 items-center justify-center rounded-md bg-zinc-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {isStarting ? "起動中..." : "カメラを開始"}
          </button>
          <button
            type="button"
            onClick={stopCamera}
            disabled={!isActive}
            className="inline-flex h-11 items-center justify-center rounded-md border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-400"
          >
            カメラを停止
          </button>
        </div>
      </div>
    </section>
  );
}
