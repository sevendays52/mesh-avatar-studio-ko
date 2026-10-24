import { expect, test } from 'vitest';
import { checkedBounds, coverageHint } from '../src/live/coverage';

test('face guidance distinguishes missing, small, clipped and usable regions', () => {
  for (const value of [null, {}, { x: 0, y: 0, width: NaN, height: .5 }, { x: 0, y: 0, width: 0, height: .5 }])
    expect(checkedBounds(value)).toBeNull();
  expect(coverageHint(null)).toBe('waiting');
  expect(coverageHint(checkedBounds({ x: .4, y: .4, width: .1, height: .15 }))).toBe('small');
  for (const x of [-.1, .8]) expect(coverageHint(checkedBounds({ x, y: .2, width: .3, height: .5 }))).toBe('edge');
  expect(coverageHint(checkedBounds({ x: .2, y: .15, width: .4, height: .6 }))).toBe('good');
});
