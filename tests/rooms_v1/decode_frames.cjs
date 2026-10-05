// Runs the exact candidate decoder; never patches its schema or product source.
const fs = require('node:fs');
const path = require('node:path');
const target = fs.realpathSync(process.argv[2]);
if (!path.isAbsolute(target) || !target.endsWith(`${path.sep}online${path.sep}wire.cjs`)) {
  throw new Error('EXPLICIT_DECODER_REQUIRED');
}
const {readMessage} = require(target);
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const rows = JSON.parse(input).map(({frame, op}, index) => {
    try {
      const value = readMessage(JSON.stringify(frame), op);
      return {index, type: frame.type, accepted: value !== null, ignored: value === null};
    } catch (error) {
      return {index, type: frame.type, accepted: false,
        error: error.message === 'INVALID_MESSAGE' ? 'INVALID_MESSAGE' : error.name};
    }
  });
  process.stdout.write(JSON.stringify({decoder: target, rows}) + '\n');
  if (rows.some(row => !row.accepted && !row.ignored)) process.exitCode = 1;
});
