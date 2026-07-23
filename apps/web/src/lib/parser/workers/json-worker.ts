import { parseJSON } from '../json.js';
import {
  decodeParserTextPayload,
  installParserWorker,
} from '../worker-protocol.js';

installParserWorker((payload, bank) => {
  if (!(payload instanceof ArrayBuffer)) {
    throw new Error('JSON 작업 입력이 올바르지 않아요.');
  }
  return parseJSON(decodeParserTextPayload(payload, 'json'), bank);
});
