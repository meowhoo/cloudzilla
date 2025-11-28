/**
 * Transfer module exports
 *
 * This module contains extracted components from TransferQueueManager
 * and RcloneService to reduce complexity and improve testability.
 */

// Output parsing
export { RcloneOutputParser, ParsedLine } from './RcloneOutputParser';

// IPC broadcasting
export { TransferBroadcaster, TransferChannels } from './TransferBroadcaster';

// Task execution
export {
    TaskExecutor,
    TaskExecutionResult,
    TaskExecutionCallbacks
} from './TaskExecutor';
