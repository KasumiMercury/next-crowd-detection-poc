"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PersonPresenceResult } from "@/lib/yolo/types";
import { WebcamPersonDetector } from "@/lib/yolo/webcamPersonDetector";

type CameraStatus = "idle" | "starting" | "active" | "error";
type ModelStatus = "loading" | "ready" | "error";
type InferenceStatus = "idle" | "running" | "error";

const yoloModelPath = "/models/yolov8n.onnx";
const inferenceIntervalMs = 750;

const cameraStatusLabel: Record<CameraStatus, string> = {
  idle: "停止中",
  starting: "起動中",
  active: "使用中",
  error: "エラー",
};

const modelStatusLabel: Record<ModelStatus, string> = {
  loading: "読み込み中",
  ready: "読み込み完了",
  error: "読み込み失敗",
};

const inferenceStatusLabel: Record<InferenceStatus, string> = {
  idle: "待機中",
  running: "推論中",
  error: "エラー",
};

export function WebcamPreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<WebcamPersonDetector | null>(null);
  const inferenceRunningRef = useRef(false);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus>("loading");
  const [modelErrorMessage, setModelErrorMessage] = useState<string | null>(
    null,
  );
  const [inferenceStatus, setInferenceStatus] =
    useState<InferenceStatus>("idle");
  const [inferenceErrorMessage, setInferenceErrorMessage] = useState<
    string | null
  >(null);
  const [presenceResult, setPresenceResult] =
    useState<PersonPresenceResult | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setStatus("idle");
    setInferenceStatus("idle");
    setInferenceErrorMessage(null);
    setPresenceResult(null);
  }, []);

  const startCamera = useCallback(async () => {
    setStatus("starting");
    setErrorMessage(null);
    setInferenceErrorMessage(null);
    setPresenceResult(null);

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
    let canceled = false;

    async function loadYoloModel() {
      setModelStatus("loading");
      setModelErrorMessage(null);

      try {
        const detector = await WebcamPersonDetector.create({
          modelPath: yoloModelPath,
        });

        if (canceled) {
          await detector.release();
          return;
        }

        detectorRef.current = detector;
        setModelStatus("ready");
      } catch (error) {
        if (canceled) {
          return;
        }

        setModelStatus("error");
        setModelErrorMessage(
          error instanceof Error
            ? `モデルを読み込めませんでした: ${error.message}`
            : "モデルを読み込めませんでした。",
        );
      }
    }

    void loadYoloModel();

    return () => {
      canceled = true;
      mountedRef.current = false;
      streamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
      const detector = detectorRef.current;
      detectorRef.current = null;
      void detector?.release();
    };
  }, []);

  useEffect(() => {
    if (status !== "active" || modelStatus !== "ready") {
      return;
    }

    let canceled = false;

    async function runInference() {
      const video = videoRef.current;
      const detector = detectorRef.current;

      if (canceled || inferenceRunningRef.current || !video || !detector) {
        return;
      }

      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        return;
      }

      inferenceRunningRef.current = true;
      setInferenceStatus("running");
      setInferenceErrorMessage(null);

      try {
        const result = await detector.detect(video);

        if (!canceled) {
          setPresenceResult(result);
          setInferenceStatus("idle");
        }
      } catch (error) {
        if (!canceled) {
          setInferenceStatus("error");
          setInferenceErrorMessage(
            error instanceof Error
              ? `推論に失敗しました: ${error.message}`
              : "推論に失敗しました。",
          );
        }
      } finally {
        inferenceRunningRef.current = false;
      }
    }

    void runInference();
    const intervalId = window.setInterval(runInference, inferenceIntervalMs);

    return () => {
      canceled = true;
      window.clearInterval(intervalId);
    };
  }, [status, modelStatus]);

  const isStarting = status === "starting";
  const isActive = status === "active";
  const presenceLabel = presenceResult
    ? presenceResult.hasPerson
      ? "人がいます"
      : "人はいません"
    : "未判定";

  return (
    <section className="flex w-full max-w-4xl flex-col gap-6 px-6 py-10 sm:px-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
          Webカメラ YOLO 人検出
        </h1>
        <p className="max-w-2xl text-base leading-7 text-zinc-600">
          Webカメラ映像をYOLOで推論し、人がいるかどうかを判定します。
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

      <div className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-500">モデル状態</span>
          <span className="text-lg font-semibold text-zinc-950">
            {modelStatusLabel[modelStatus]}
          </span>
          <span className="text-sm text-zinc-600">{yoloModelPath}</span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-500">推論中状態</span>
          <span className="text-lg font-semibold text-zinc-950">
            {inferenceStatusLabel[inferenceStatus]}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-500">判定結果</span>
          <span className="text-lg font-semibold text-zinc-950">
            {presenceLabel}
          </span>
          {presenceResult?.maxScore != null ? (
            <span className="text-sm text-zinc-600">
              最大スコア: {presenceResult.maxScore.toFixed(2)}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-500">
            エラーメッセージ
          </span>
          {modelErrorMessage || inferenceErrorMessage ? (
            <p className="text-sm font-medium text-red-600">
              {modelErrorMessage ?? inferenceErrorMessage}
            </p>
          ) : (
            <span className="text-sm text-zinc-600">なし</span>
          )}
        </div>
      </div>
    </section>
  );
}
