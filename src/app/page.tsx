import { WebcamPreview } from "./webcam-preview";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 justify-center bg-zinc-50 font-sans">
      <main className="flex w-full justify-center">
        <WebcamPreview />
      </main>
    </div>
  );
}
