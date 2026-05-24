import type { PersonPresenceResult, YoloTensor } from "./types";

const personClassId = 0;
const yoloBoxValueCount = 4;
const confidenceThreshold = 0.5;

export async function detectPersonPresence(
  output: YoloTensor,
): Promise<PersonPresenceResult> {
  const data = await output.getData();

  if (!(data instanceof Float32Array)) {
    throw new Error("YOLOの出力形式が float32 ではありません。");
  }

  const dims = output.dims;

  if (dims.length === 3 && dims[0] === 1) {
    return detectFromThreeDimensionalOutput(data, dims[1], dims[2]);
  }

  if (dims.length === 2) {
    return detectFromThreeDimensionalOutput(data, dims[0], dims[1]);
  }

  throw new Error(`YOLOの出力shapeを解釈できません: [${dims.join(", ")}]`);
}

function detectFromThreeDimensionalOutput(
  data: Float32Array,
  firstDim: number,
  secondDim: number,
): PersonPresenceResult {
  if (firstDim > secondDim) {
    return detectFromRowMajorOutput(data, firstDim, secondDim);
  }

  return detectFromChannelMajorOutput(data, firstDim, secondDim);
}

function detectFromChannelMajorOutput(
  data: Float32Array,
  channelCount: number,
  detectionCount: number,
): PersonPresenceResult {
  if (channelCount <= yoloBoxValueCount + personClassId) {
    throw new Error(`YOLOの出力チャンネル数が不足しています: ${channelCount}`);
  }

  const personScoreOffset =
    (yoloBoxValueCount + personClassId) * detectionCount;
  let maxScore: number | null = null;

  for (
    let detectionIndex = 0;
    detectionIndex < detectionCount;
    detectionIndex += 1
  ) {
    const score = data[personScoreOffset + detectionIndex];

    if (maxScore === null || score > maxScore) {
      maxScore = score;
    }
  }

  return {
    hasPerson: maxScore !== null && maxScore >= confidenceThreshold,
    maxScore,
  };
}

function detectFromRowMajorOutput(
  data: Float32Array,
  detectionCount: number,
  channelCount: number,
): PersonPresenceResult {
  if (channelCount <= yoloBoxValueCount + personClassId) {
    throw new Error(`YOLOの出力チャンネル数が不足しています: ${channelCount}`);
  }

  let maxScore: number | null = null;

  for (
    let detectionIndex = 0;
    detectionIndex < detectionCount;
    detectionIndex += 1
  ) {
    const score =
      data[detectionIndex * channelCount + yoloBoxValueCount + personClassId];

    if (maxScore === null || score > maxScore) {
      maxScore = score;
    }
  }

  return {
    hasPerson: maxScore !== null && maxScore >= confidenceThreshold,
    maxScore,
  };
}
