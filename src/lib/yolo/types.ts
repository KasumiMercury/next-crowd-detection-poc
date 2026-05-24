import type {
  InferenceSession,
  Tensor,
  TensorConstructor,
} from "onnxruntime-web";

export type PersonPresenceResult = {
  hasPerson: boolean;
  maxScore: number | null;
};

export type YoloInput = {
  data: Float32Array;
  dims: [number, number, number, number];
};

export type YoloRuntime = {
  Tensor: TensorConstructor;
};

export type YoloSession = InferenceSession;

export type YoloTensor = Tensor;
