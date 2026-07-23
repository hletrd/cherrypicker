import { parseCSVBuffer } from '../csv.js';
import { installParserWorker } from '../worker-protocol.js';

installParserWorker((payload, bank) => {
  if (!(payload instanceof ArrayBuffer)) {
    throw new Error('CSV 작업 입력이 올바르지 않아요.');
  }
  return parseCSVBuffer(payload, bank);
});
