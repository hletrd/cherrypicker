import { greedyOptimize } from '@cherrypicker/core';
import { installOptimizerWorker } from './worker-protocol.js';

installOptimizerWorker(greedyOptimize);
