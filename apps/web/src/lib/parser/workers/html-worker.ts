import { parseHTML } from '../html.js';
import { installParserWorker } from '../worker-protocol.js';

installParserWorker((payload, bank) => {
  if (typeof payload !== 'string') throw new Error('HTML 작업 입력이 올바르지 않아요.');
  return parseHTML(payload, bank);
});
