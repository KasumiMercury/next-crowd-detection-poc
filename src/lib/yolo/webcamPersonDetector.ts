import { detectPersonPresence } from "./postprocess";
import { drawVideoFrameToCanvas, imageDataToYoloInput } from "./preprocess";
import type { PersonPresenceResult, YoloRuntime, YoloSession } from "./types";

export class WebcamPersonDetector {
  constructor(
    private readonly runtime: YoloRuntime,
    private readonly session: YoloSession,
    private readonly canvas: HTMLCanvasElement,
  ) {}

  async detect(video: HTMLVideoElement): Promise<PersonPresenceResult> {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      throw new Error("カメラ映像をまだ取得できていません。");
    }

    const imageData = drawVideoFrameToCanvas(video, this.canvas);
    const input = imageDataToYoloInput(imageData);
    const tensor = new this.runtime.Tensor("float32", input.data, input.dims);
    const inputName = this.session.inputNames[0];
    const outputName = this.session.outputNames[0];

    if (!inputName || !outputName) {
      throw new Error("YOLOモデルの入出力名を取得できませんでした。");
    }

    const outputs = await this.session.run({
      [inputName]: tensor,
    });
    const output = outputs[outputName];

    if (!output) {
      throw new Error("YOLOモデルの出力を取得できませんでした。");
    }

    return detectPersonPresence(output);
  }
}
