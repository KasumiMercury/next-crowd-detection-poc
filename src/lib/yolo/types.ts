export type PersonBoundingBox = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  score: number;
  trackId: number;
};

export type PersonPresenceResult = {
  hasPerson: boolean;
  maxScore: number | null;
  currentCount: number;
  totalCount: number;
  boxes: PersonBoundingBox[];
};
