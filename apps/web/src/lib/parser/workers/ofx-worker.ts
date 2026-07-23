import { parseOFX } from '../ofx.js';
import {
  decodeParserTextPayload,
  installParserWorker,
} from '../worker-protocol.js';

installParserWorker((payload, bank) => {
  if (!(payload instanceof ArrayBuffer)) {
    throw new Error('OFX 작업 입력이 올바르지 않아요.');
  }
  return parseOFX(decodeParserTextPayload(payload), bank);
});
