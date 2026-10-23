export type Point = [number, number];
export type Band = [number, number];
export interface Ellipse { cx: number; cy: number; rx: number; ry: number }
export interface Eye {
  opening: Point[];
  roi: Point[];
  x0: number;
  x1: number;
  top: number[];
  bot: number[];
}
export interface Strand {
  name: string;
  nodes: Point[];
  sigma: number;
  k: number;
  max: number;
}
export interface Accessory {
  name: string;
  pivot: Point;
  tip: Point;
  split: number;
  box: [number, number, number, number];
  color: { redness: number; minRed: number };
}
export interface Hand {
  outline: Point[];
  jaw: Point[];
  jawRange: Band;
  background: Point[];
  elbow: Point;
  wrist: Point;
  knuckle: Point;
  contact: Point;
  forearmShare: number;
  armBand: Band;
  wristBand: Band;
  handBand: Band;
  fingerXBand: Band;
  fingerYBand: Band;
  pinBand: Band;
}
export interface Rig {
  version: 1;
  image: { width: number; height: number };
  head: Ellipse & {
    shiftX: number; shiftY: number; pivotX: number; pivotY: number;
    maxRoll: number; weightBand: Band; turnBand: Band;
    /** Optional neck-centred pitch projection; angles in radians, depth in source pixels. */
    pitch?: { maxAngle: number; depth: number; facePreservation?: number; views?: { id: string; angleY: number }[] };
    /** Independently drawn head poses. Neutral (0, 0) is implicit; degrees. */
    views?: { id: string; angleX: number; angleY: number }[];
  };
  body: {
    pivotX: number; pivotY: number; maxRoll: number;
    breathBand: Band; rollBand: Band; chest: Ellipse; shoulders: Ellipse[];
    /** Optional secondary torso travel in source pixels. */
    motion?: { turn: number; nod: number; shoulder: number };
  };
  face: Record<'nose' | 'mouth' | 'eyeA' | 'eyeB' | 'earL' | 'earR', Ellipse> & {
    brow: Ellipse & { band: Band };
    jaw: Ellipse & { band: Band };
  };
  buns?: Partial<Record<'bunL' | 'bunR', Ellipse>>;
  eyes: Eye[];
  mouth: {
    cx: number; cy: number; angle: number; halfLen: number; bow: number;
    area: Ellipse & { angle: number };
  };
  cheeks: Point[];
  /** Independent of blush: compact regions ordered image-left, image-right. */
  cheekPuff?: { regions: [Ellipse, Ellipse]; displacement: number };
  strands?: Strand[];
  accessories?: Accessory[];
  hand?: Hand;
  mesh: {
    baseCell: number;
    fine: { x0: number; x1: number; y0: number; y1: number; cell: number };
    handCell: number; tasselCell: number; eyeBallCell: number;
    eyeCell: number; spriteCell: number;
  };
  view: { padTop: number; padSide: number; gazeCenter?: Point };
}
