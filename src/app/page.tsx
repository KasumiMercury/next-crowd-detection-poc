import { CrowdDetector } from "@/components/crowd-detector";

export default function Page() {
  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Crowd Detection PoC</h1>
      <CrowdDetector />
    </main>
  );
}
