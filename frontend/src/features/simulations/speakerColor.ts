// Editorial-palette speaker colours. Low-saturation accents that sit calmly on
// the off-white panels. Hash the speaker name into a stable slot so the same
// participant gets the same colour across renders.

export interface SpeakerColor {
  ink: string;
  wash: string;
  border: string;
}

const PALETTE: SpeakerColor[] = [
  { ink: '#1f3a5f', wash: '#eef3fb', border: '#cdd9eb' }, // navy
  { ink: '#5a3a8a', wash: '#f3eef9', border: '#dfd4ee' }, // plum
  { ink: '#7a5b1f', wash: '#f7f0df', border: '#e8d9b1' }, // ochre
  { ink: '#1f5a4a', wash: '#e8f3ee', border: '#c2dfd1' }, // forest
  { ink: '#7a2f3a', wash: '#f7e9eb', border: '#e5c4c9' }, // claret
  { ink: '#3a5a1f', wash: '#eef3e3', border: '#cdd9b5' }, // moss
  { ink: '#5f3a1f', wash: '#f3ece3', border: '#d9c8b1' }, // umber
  { ink: '#1f5a7a', wash: '#e8f0f7', border: '#bdd0e0' }, // teal
];

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function speakerColor(name: string): SpeakerColor {
  if (!name) return PALETTE[0];
  return PALETTE[djb2(name) % PALETTE.length];
}
