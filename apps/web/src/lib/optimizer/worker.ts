import { greedyOptimize } from '@cherrypicker/core/optimizer';
import { installOptimizerWorker } from './worker-protocol.js';

installOptimizerWorker(greedyOptimize);
