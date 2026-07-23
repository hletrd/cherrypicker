import { parseOFX } from '../ofx.js';
import { installParserWorker } from '../worker-protocol.js';

installParserWorker((payload, bank) => {
  if (typeof payload !== 'string') throw new Error('OFX 작업 입력이 올바르지 않아요.');
  return parseOFX(payload, bank);
});
