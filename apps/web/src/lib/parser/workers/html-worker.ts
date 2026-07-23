import { parseHTML } from '../html.js';
import {
  decodeParserTextPayload,
  installParserWorker,
} from '../worker-protocol.js';

installParserWorker((payload, bank) => {
  if (!(payload instanceof ArrayBuffer)) {
    throw new Error('HTML 작업 입력이 올바르지 않아요.');
  }
  return parseHTML(decodeParserTextPayload(payload, 'html'), bank);
});
