const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(
  path.join(__dirname, '../src/features/learning/learning-speech-match.ts'),
  'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleValue = { exports: {} };
new Function('exports', 'module', compiled)(moduleValue.exports, moduleValue);
const {
  matchLearningSpeech: match,
  matchLearningSpeechAttempt: repair,
  getLearningHiddenWords: hidden,
} = moduleValue.exports;
const firstFragment = repair('The woman carries a basket beside the table.', 'the woman table');
const repaired = repair(
  'The woman carries a basket beside the table.',
  'basket carries',
  firstFragment.matched,
);
assert.deepEqual(repaired.matched, [true, true, true, false, true, false, false, true]);
assert.deepEqual(
  firstFragment.matched,
  [true, true, false, false, false, false, false, true],
  'Inputs stay unchanged',
);
assert.equal(
  repair('This picture was taken in a craft room.', 'this picture was taken in a room craft')
    .fullyMatched,
  true,
);
assert.deepEqual(repair('the park and the station', 'the').matched, [
  true,
  false,
  false,
  false,
  false,
]);
assert.deepEqual(
  repair('the park and the station', 'the', [true, false, false, false, false]).matched,
  [true, false, false, true, false],
);
assert.equal(repair('I walk to the quiet park after my lunch break', 'I I I I').complete, false);
assert.equal(repair('It costs $85.', 'eighty five dollars').matched[2], true);
assert.equal(
  repair("I'm afraid.", 'i').matched[0],
  false,
  'Partial contractions cannot count as a whole word',
);
assert.equal(repair('A quiet park.', '', [true, false, false]).complete, false);
assert.equal(
  match('I like the park.', 'I like the').complete,
  true,
  '75% word recognition passes practice',
);
assert.equal(
  match('I do not like it.', 'I do like it').complete,
  true,
  'An omitted word is tolerated at 80%; this is practice, not semantic grading',
);
assert.equal(
  match('the park and the station', 'the park and station').complete,
  true,
  '80% recognized words passes',
);
assert.deepEqual(
  match('the park and the station', 'the park and station').matched,
  [true, true, true, false, true],
  'One occurrence still cannot fill two boxes',
);
const tenWords = 'I usually walk to the quiet park after my lunch';
assert.equal(match(tenWords, 'I usually walk the park my lunch').ratio, 0.7);
assert.equal(match(tenWords, 'I usually walk the park my lunch').complete, true);
assert.equal(match(tenWords, 'I usually walk park my lunch').complete, false);
assert.equal(match(tenWords, 'I I I I I I I I I I').complete, false);
assert.equal(match('', '').complete, false);
assert.equal(match('... !', '... !').complete, false);
assert.equal(
  match('First, I walk. Then, I read.', 'then i read first i walk').complete,
  false,
  'Word order matters',
);
assert.equal(
  match(
    "I'm afraid that you have the wrong information.",
    'I am afraid that you have the wrong information',
  ).complete,
  true,
);
assert.equal(match('It costs eighty-five dollars.', 'It costs $85.').complete, true);
assert.equal(match('It starts at nine thirty a.m.', 'It starts at 9:30 AM.').complete, true);
assert.equal(match('It ends at six p.m.', 'It ends at 6:00 PM.').complete, true);
assert.equal(match('It starts at nine oh five.', 'It starts at 9:05.').complete, true);
assert.equal(match('This is a park.', '').complete, false, 'Silence never passes');
assert.deepEqual(
  match('A man is standing beside a man.', 'A man').matched,
  [true, true, false, false, false, false, false],
  'Interim speech highlights the first occurrence, not the later repeated words',
);
assert.deepEqual(
  match('This picture was taken in a park.', 'this picture was').matched,
  [true, true, true, false, false, false, false],
  'A partial sentence gives word-by-word feedback before the final result',
);
assert.equal(hidden('This is a park.', 0).size, 0, 'Part 1 keeps full text');
assert.equal(hidden('This is a park.', 2).size, 4);
console.log('Passed: speech matching and hint edge cases');
