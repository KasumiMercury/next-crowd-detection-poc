import type { YoloInput } from "./types";

export const yoloInputSize = 640;

export function drawVideoFrameToCanvas(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  inputSize = yoloInputSize,
) {
  canvas.width = inputSize;
  canvas.height = inputSize;

  const context = canvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (!context) {
    throw new Error("canvas の 2D コンテキストを取得できませんでした。");
  }

  context.drawImage(video, 0, 0, inputSize, inputSize);
  return context.getImageData(0, 0, inputSize, inputSize);
}

export function imageDataToYoloInput(imageData: ImageData): YoloInput {
  const { data, width, height } = imageData;
  const pixelCount = width * height;
  const input = new Float32Array(3 * pixelCount);

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const rgbaIndex = pixelIndex * 4;

    input[pixelIndex] = data[rgbaIndex] / 255;
    input[pixelCount + pixelIndex] = data[rgbaIndex + 1] / 255;
    input[pixelCount * 2 + pixelIndex] = data[rgbaIndex + 2] / 255;
  }

  return {
    data: input,
    dims: [1, 3, height, width],
  };
}
