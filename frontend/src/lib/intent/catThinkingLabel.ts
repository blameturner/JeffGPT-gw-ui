const CAT_PUNS = [
  'Pawing at tools\u2026',
  'Sharpening claws\u2026',
  'Batting things around\u2026',
  'Chasing the thread\u2026',
  'Unraveling the yarn\u2026',
];

let lastIndex = -1;

export function catThinkingLabel(): string {
  let i: number;
  do {
    i = Math.floor(Math.random() * CAT_PUNS.length);
  } while (i === lastIndex && CAT_PUNS.length > 1);
  lastIndex = i;
  return CAT_PUNS[i];
}
