import { parseCSV } from '../csv.js';
import { installParserWorker } from '../worker-protocol.js';

installParserWorker((payload, bank) => {
  if (typeof payload !== 'string') throw new Error('CSV 작업 입력이 올바르지 않아요.');
  return parseCSV(payload, bank);
});
