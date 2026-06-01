import { BYTETracker } from "@pj-hoakari/web-crowd-detection-utils/bytetrack";
import type { ExecutionProvider } from "@pj-hoakari/web-crowd-detection-utils/onnx";
import { isWebGpuAvailable } from "@pj-hoakari/web-crowd-detection-utils/onnx";
import {
  createLetterboxCapturer,
  reverseLetterboxBoxes,
} from "@pj-hoakari/web-crowd-detection-utils/source";
import {
  createYoloDetector,
  type Detection,
  type YoloDetector,
} from "@pj-hoakari/web-crowd-detection-utils/yolo";
import type { PersonPresenceResult } from "./types";

const inputSize = 640;
const confidenceThreshold = 0.5;
const personClassId = 0;

type CreateWebcamPersonDetectorOptions = {
  modelPath: string;
};

export class WebcamPersonDetector {
  private constructor(
    private readonly detector: YoloDetector,
    private readonly capturer: ReturnType<typeof createLetterboxCapturer>,
    private readonly tracker: BYTETracker,
  ) {}

  static async create({
    modelPath,
  }: CreateWebcamPersonDetectorOptions): Promise<WebcamPersonDetector> {
    const response = await fetch(modelPath, {
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          `${modelPath} が見つかりません。public/models/yolov8n.onnx を配置してください。`,
        );
      }

      throw new Error(
        `モデルファイルを取得できませんでした。HTTP ${response.status}`,
      );
    }

    const modelBuffer = await response.arrayBuffer();
    const detector = await createDetectorWithFallback(modelBuffer);
    const capturer = createLetterboxCapturer({ inputSize });
    const tracker = new BYTETracker();

    return new WebcamPersonDetector(detector, capturer, tracker);
  }

  async detect(video: HTMLVideoElement): Promise<PersonPresenceResult> {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      throw new Error("カメラ映像をまだ取得できていません。");
    }

    const { imageData, params } = this.capturer.capture(video);
    const detections = await this.detector.detect(imageData);
    const sourceDetections = reverseLetterboxBoxes(detections, params);
    const trackedPeople = this.tracker.update(sourceDetections);
    const maxScore = getMaxPersonScore(detections);

    return {
      hasPerson: trackedPeople.length > 0,
      maxScore,
      currentCount: trackedPeople.length,
      totalCount: this.tracker.totalCount,
    };
  }

  reset(): void {
    this.tracker.reset();
  }

  async release(): Promise<void> {
    await this.detector.session.release();
  }
}

async function createDetectorWithFallback(
  modelBuffer: ArrayBuffer,
): Promise<YoloDetector> {
  const preferredProvider: ExecutionProvider = isWebGpuAvailable()
    ? "webgpu"
    : "wasm";

  try {
    return await createDetector(modelBuffer, preferredProvider);
  } catch (error) {
    if (preferredProvider !== "webgpu") {
      throw error;
    }

    return createDetector(modelBuffer, "wasm");
  }
}

function createDetector(
  modelBuffer: ArrayBuffer,
  executionProvider: ExecutionProvider,
): Promise<YoloDetector> {
  return createYoloDetector({
    modelPath: modelBuffer,
    executionProvider,
    inputSize,
    postprocess: {
      format: "auto",
      confThreshold: confidenceThreshold,
      classFilter: [personClassId],
    },
  });
}

function getMaxPersonScore(detections: readonly Detection[]): number | null {
  let maxScore: number | null = null;

  for (const detection of detections) {
    if (detection.classId !== personClassId) {
      continue;
    }

    if (maxScore === null || detection.score > maxScore) {
      maxScore = detection.score;
    }
  }

  return maxScore;
}
