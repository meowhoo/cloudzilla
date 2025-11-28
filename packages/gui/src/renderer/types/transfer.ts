/**
 * Transfer Types and Interfaces
 * Centralized type definitions for file transfer operations
 */

export type TransferType = 'upload' | 'download' | 'copy' | 'move' | 'sync' | 'delete';
export type TransferStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type LogType = 'info' | 'success' | 'warning' | 'error' | 'debug';

/**
 * Transfer source or destination location
 */
export interface TransferLocation {
    type: 'local' | 'remote';
    path: string;
    remoteName?: string; // e.g., "gdrive", "dropbox"
}

/**
 * Transfer progress details
 */
export interface TransferProgress {
    bytesTransferred: number;
    percentage: number;
    speed: number; // bytes per second
    eta: number; // seconds
    transfers?: number; // current transferring files (for folders)
    totalTransfers?: number; // total files (for folders)
    currentFile?: string; // current file name (for folders)
}

/**
 * Main transfer task interface
 * 1 TransferTask = 1 rclone command = 1 user operation
 */
export interface TransferTask {
    id: string;
    type: TransferType;
    status: TransferStatus;

    // File/Folder information
    fileName: string;
    fileSize: number;
    isDirectory: boolean;
    fileCount?: number; // total files (for folders)

    // Source and destination
    source: TransferLocation;
    destination: TransferLocation;

    // Progress tracking
    progress: TransferProgress;

    // Debugging and process info
    rcloneCommand?: string; // full rclone command for debugging
    processId?: number; // OS process ID

    // Timestamps
    createdAt: number;
    startedAt?: number;
    completedAt?: number;

    // Error handling
    error?: string;
    retryCount?: number;
}

/**
 * Console log entry
 */
export interface LogEntry {
    id: string;
    timestamp: number;
    message: string;
    type: LogType;
    taskId?: string; // associated task ID (optional)
}

/**
 * Store schemas for electron-store
 */
export interface TransferTaskStore {
    tasks: TransferTask[];
}

export interface LogStore {
    logs: LogEntry[];
}

/**
 * IPC Event payloads
 */
export interface TransferStartPayload {
    task: Omit<TransferTask, 'id' | 'status' | 'progress' | 'createdAt'>;
}

export interface TransferProgressUpdatePayload {
    taskId: string;
    progress: TransferProgress;
    status: TransferStatus;
}

export interface TransferCompletePayload {
    taskId: string;
    success: boolean;
    error?: string;
}

export interface LogAddPayload {
    log: Omit<LogEntry, 'id'>;
}

/**
 * Individual file being transferred (from rclone stats.transferring)
 * Used by Progress Tab to show file-level progress
 */
export interface TransferringFile {
    name: string;           // File name
    size: number;           // Total file size (bytes)
    bytes: number;          // Bytes transferred so far
    percentage: number;     // Progress percentage (0-100)
    speed: number;          // Transfer speed (bytes/sec)
    eta: number;            // Estimated time remaining (seconds)
    taskId: string;         // Parent task ID
    taskName: string;       // Parent task name (for UI display)
}

/**
 * Transferring files update payload (for Progress Tab)
 */
export interface TransferringFilesPayload {
    files: TransferringFile[];
    totalBytes: number;     // Total bytes across all files
    totalSpeed: number;     // Combined speed
}
