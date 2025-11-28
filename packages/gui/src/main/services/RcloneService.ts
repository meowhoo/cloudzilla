import { spawn, ChildProcess } from 'child_process';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { RcloneOutputParser } from './transfer/RcloneOutputParser';

/**
 * File item returned from rclone lsjson
 */
export interface RcloneFileItem {
    Path: string;
    Name: string;
    Size: number;
    MimeType: string;
    ModTime: string;
    IsDir: boolean;
    ID?: string;
}

/**
 * Individual file in transferring array from rclone stats
 */
export interface RcloneTransferringItem {
    name: string;
    size: number;
    bytes: number;
    percentage: number;
    speed: number;
    eta: number;
    group?: string;
}

/**
 * Progress event from rclone
 */
export interface RcloneProgress {
    bytes: number;
    checks: number;
    deletes: number;
    elapsedTime: number;
    errors: number;
    eta: number;
    fatalError: boolean;
    retryError: boolean;
    renames: number;
    serverSideCopies: number;
    serverSideCopyBytes: number;
    serverSideMoveBytes: number;
    serverSideMoves: number;
    speed: number;
    totalBytes: number;
    totalChecks: number;
    totalTransfers: number;
    transferTime: number;
    transfers: number;
    // Array of files currently being transferred (from stats.transferring)
    transferring?: RcloneTransferringItem[];
}

export interface CopyOptions {
    taskId?: string; // External task ID for tracking
    onProgress?: (progress: RcloneProgress) => void;
    onError?: (error: string) => void;
    onStdout?: (line: string) => void; // For console log capture
    onStderr?: (line: string) => void; // For error log capture
    bandwidthLimit?: number; // KB/s, 0 or undefined = unlimited
}

export interface TransferResult {
    success: boolean;
    bytesTransferred: number;
    errors: number;
}

/**
 * RcloneService - Wrapper for rclone command-line tool
 *
 * Provides methods to interact with cloud storage via rclone binary
 */
export class RcloneService {
    private rclonePath: string;
    private configPath: string;
    private activeProcesses: Map<string, ChildProcess> = new Map();

    constructor() {
        // Determine rclone binary path
        this.rclonePath = this.getRclonePath();

        // Config path priority:
        // 1. RCLONE_CONFIG environment variable (if set)
        // 2. rclone's default path (Windows: %APPDATA%\rclone\rclone.conf, Unix: ~/.config/rclone/rclone.conf)
        if (process.env.RCLONE_CONFIG) {
            this.configPath = process.env.RCLONE_CONFIG;
            console.log(`[RcloneService] Using RCLONE_CONFIG env: ${this.configPath}`);
        } else {
            const homeDir = process.env.USERPROFILE || process.env.HOME || '';
            if (process.platform === 'win32') {
                this.configPath = path.join(process.env.APPDATA || '', 'rclone', 'rclone.conf');
            } else {
                this.configPath = path.join(homeDir, '.config', 'rclone', 'rclone.conf');
            }
        }

        console.log(`[RcloneService] Binary: ${this.rclonePath}`);
        console.log(`[RcloneService] Config: ${this.configPath}`);

        // Verify rclone binary exists
        if (!fs.existsSync(this.rclonePath)) {
            throw new Error(`rclone binary not found at: ${this.rclonePath}`);
        }
    }

    /**
     * Get rclone binary path (platform-specific)
     */
    private getRclonePath(): string {
        const isPackaged = app.isPackaged;
        const appPath = app.getAppPath();

        if (isPackaged) {
            // Release mode: binary is in resources/bin/
            const resourcesPath = process.resourcesPath;
            return path.join(resourcesPath, 'bin', 'rclone.exe');
        } else {
            // Debug mode: binary is in packages/gui/resources/bin/
            return path.join(appPath, 'resources', 'bin', 'rclone.exe');
        }
    }

    /**
     * Execute rclone command and return output
     */
    private async exec(args: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            const process = spawn(this.rclonePath, [
                '--config', this.configPath,
                ...args
            ]);

            let stdout = '';
            let stderr = '';

            process.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`rclone exited with code ${code}: ${stderr}`));
                } else {
                    resolve(stdout);
                }
            });

            process.on('error', (err) => {
                reject(new Error(`Failed to spawn rclone: ${err.message}`));
            });
        });
    }

    /**
     * Get rclone version
     */
    async getVersion(): Promise<string> {
        try {
            const output = await this.exec(['version']);
            const match = output.match(/rclone v([\d.]+)/);
            return match ? match[1] : 'unknown';
        } catch (err) {
            throw new Error(`Failed to get rclone version: ${(err as Error).message}`);
        }
    }

    /**
     * List files in a remote path
     * @param remote Remote name (e.g., "gdrive:")
     * @param remotePath Path within remote (e.g., "/folder")
     */
    async list(remote: string, remotePath: string = ''): Promise<RcloneFileItem[]> {
        try {
            const fullPath = `${remote}${remotePath}`;
            console.log(`[RcloneService] Listing: ${fullPath}`);

            const output = await this.exec([
                'lsjson',
                '--no-mimetype',
                '--no-modtime',
                fullPath
            ]);

            const items: RcloneFileItem[] = JSON.parse(output);
            console.log(`[RcloneService] Found ${items.length} items`);

            return items;
        } catch (err) {
            throw new Error(`Failed to list files: ${(err as Error).message}`);
        }
    }

    /**
     * Copy files from source to destination
     * @param source Source path (e.g., "gdrive:/folder/file.txt")
     * @param dest Destination path (e.g., "dropbox:/backup/")
     */
    async copy(source: string, dest: string, options?: CopyOptions): Promise<TransferResult> {
        return new Promise((resolve, reject) => {
            // Use external taskId if provided, otherwise generate internal ID
            const transferId = options?.taskId || `copy_${Date.now()}`;

            const args = [
                'copy',
                source,
                dest,
                '--stats', '500ms',
                '--stats-log-level', 'INFO',
                '--use-json-log',
                '-v',
                '--ignore-times' // Force copy regardless of existing files
            ];

            // Add bandwidth limit if specified (KB/s)
            if (options?.bandwidthLimit && options.bandwidthLimit > 0) {
                args.push('--bwlimit', `${options.bandwidthLimit}K`);
            }

            console.log(`[RcloneService] Starting copy: ${transferId}`);
            console.log(`[RcloneService] Command: rclone ${args.join(' ')}`);

            const process = spawn(this.rclonePath, [
                '--config', this.configPath,
                ...args
            ]);

            this.activeProcesses.set(transferId, process);

            // Use RcloneOutputParser to handle JSON parsing
            const parser = new RcloneOutputParser();

            process.stdout?.on('data', parser.createStdoutHandler(options));
            process.stderr?.on('data', parser.createStderrHandler(options));

            process.on('close', (code) => {
                this.activeProcesses.delete(transferId);
                const lastProgress = parser.getLastProgress();
                console.log(`[RcloneService] Copy completed: ${transferId} (exit code: ${code})`);

                if (code !== 0) {
                    reject(new Error(`Copy failed with code ${code}: ${parser.getErrorString()}`));
                } else {
                    resolve({
                        success: true,
                        bytesTransferred: lastProgress?.bytes || 0,
                        errors: lastProgress?.errors || 0
                    });
                }
            });

            process.on('error', (err) => {
                this.activeProcesses.delete(transferId);
                console.error(`[RcloneService] Copy error: ${transferId}`, err);
                reject(new Error(`Failed to spawn rclone: ${err.message}`));
            });
        });
    }

    /**
     * Move files from source to destination (with progress tracking)
     * @param source Source path (e.g., "gdrive:/folder/file.txt")
     * @param dest Destination path (e.g., "dropbox:/backup/")
     */
    async move(source: string, dest: string, options?: CopyOptions): Promise<TransferResult> {
        return new Promise((resolve, reject) => {
            // Use external taskId if provided, otherwise generate internal ID
            const transferId = options?.taskId || `move_${Date.now()}`;

            const args = [
                'move',
                source,
                dest,
                '--stats', '500ms',
                '--stats-log-level', 'INFO',
                '--use-json-log',
                '-v',
                '--ignore-times' // Force move regardless of existing files
            ];

            // Add bandwidth limit if specified (KB/s)
            if (options?.bandwidthLimit && options.bandwidthLimit > 0) {
                args.push('--bwlimit', `${options.bandwidthLimit}K`);
            }

            console.log(`[RcloneService] Starting move: ${transferId}`);
            console.log(`[RcloneService] Command: rclone ${args.join(' ')}`);

            const process = spawn(this.rclonePath, [
                '--config', this.configPath,
                ...args
            ]);

            this.activeProcesses.set(transferId, process);

            // Use RcloneOutputParser to handle JSON parsing
            const parser = new RcloneOutputParser();

            process.stdout?.on('data', parser.createStdoutHandler(options));
            process.stderr?.on('data', parser.createStderrHandler(options));

            process.on('close', (code) => {
                this.activeProcesses.delete(transferId);
                const lastProgress = parser.getLastProgress();
                console.log(`[RcloneService] Move completed: ${transferId} (exit code: ${code})`);

                if (code !== 0) {
                    reject(new Error(`Move failed with code ${code}: ${parser.getErrorString()}`));
                } else {
                    resolve({
                        success: true,
                        bytesTransferred: lastProgress?.bytes || 0,
                        errors: lastProgress?.errors || 0
                    });
                }
            });

            process.on('error', (err) => {
                this.activeProcesses.delete(transferId);
                console.error(`[RcloneService] Move error: ${transferId}`, err);
                reject(new Error(`Failed to spawn rclone: ${err.message}`));
            });
        });
    }

    /**
     * Delete files at remote path with progress tracking
     * Phase 1 spec: delete requires progress tracking
     */
    async delete(remote: string, remotePath: string, options?: CopyOptions): Promise<TransferResult> {
        const transferId = options?.taskId || Date.now().toString();
        const fullPath = `${remote}${remotePath}`;

        console.log(`[RcloneService] Starting delete: ${fullPath}`);

        return new Promise((resolve, reject) => {
            const args = [
                'delete',
                fullPath,
                '--stats', '500ms',
                '--stats-log-level', 'INFO',
                '--use-json-log',
                '-v'
            ];

            const rclone = spawn(this.rclonePath, [
                '--config', this.configPath,
                ...args
            ]);
            this.activeProcesses.set(transferId, rclone);

            // Use RcloneOutputParser to handle JSON parsing
            const parser = new RcloneOutputParser();

            rclone.stdout?.on('data', parser.createStdoutHandler(options));
            rclone.stderr?.on('data', parser.createStderrHandler(options));

            rclone.on('close', (code: number | null) => {
                this.activeProcesses.delete(transferId);
                const lastProgress = parser.getLastProgress();
                console.log(`[RcloneService] Delete completed: ${fullPath} (exit code: ${code})`);

                if (code === 0) {
                    resolve({
                        success: true,
                        bytesTransferred: lastProgress?.bytes || 0,
                        errors: lastProgress?.errors || 0
                    });
                } else {
                    const errorMsg = parser.getErrorString() || `rclone exited with code ${code}`;
                    console.error(`[RcloneService] Delete failed: ${fullPath}`, errorMsg);
                    reject(new Error(`Failed to delete: ${errorMsg}`));
                }
            });

            rclone.on('error', (err: Error) => {
                this.activeProcesses.delete(transferId);
                console.error(`[RcloneService] Delete error: ${transferId}`, err);
                reject(new Error(`Failed to spawn rclone: ${err.message}`));
            });
        });
    }

    /**
     * Purge (delete) a directory and all contents at remote path
     * @param fullPath Full path including remote (e.g., "gdrive:/folder")
     */
    async purge(fullPath: string): Promise<void> {
        console.log(`[RcloneService] Purging directory: ${fullPath}`);

        return new Promise((resolve, reject) => {
            const args = ['purge', fullPath];

            const rclone = spawn(this.rclonePath, [
                '--config', this.configPath,
                ...args
            ]);

            let stderr = '';

            rclone.stderr?.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            rclone.on('close', (code: number | null) => {
                if (code === 0) {
                    console.log(`[RcloneService] Purge completed: ${fullPath}`);
                    resolve();
                } else {
                    console.error(`[RcloneService] Purge failed: ${fullPath}`, stderr);
                    reject(new Error(`Failed to purge: ${stderr || `exit code ${code}`}`));
                }
            });

            rclone.on('error', (err: Error) => {
                console.error(`[RcloneService] Purge error: ${fullPath}`, err);
                reject(new Error(`Failed to spawn rclone: ${err.message}`));
            });
        });
    }

    /**
     * Delete a single file at remote path
     * @param fullPath Full path including remote (e.g., "gdrive:/folder/file.txt")
     */
    async deleteFile(fullPath: string): Promise<void> {
        console.log(`[RcloneService] Deleting file: ${fullPath}`);

        return new Promise((resolve, reject) => {
            const args = ['delete', fullPath];

            const rclone = spawn(this.rclonePath, [
                '--config', this.configPath,
                ...args
            ]);

            let stderr = '';

            rclone.stderr?.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            rclone.on('close', (code: number | null) => {
                if (code === 0) {
                    console.log(`[RcloneService] Delete completed: ${fullPath}`);
                    resolve();
                } else {
                    console.error(`[RcloneService] Delete failed: ${fullPath}`, stderr);
                    reject(new Error(`Failed to delete: ${stderr || `exit code ${code}`}`));
                }
            });

            rclone.on('error', (err: Error) => {
                console.error(`[RcloneService] Delete error: ${fullPath}`, err);
                reject(new Error(`Failed to spawn rclone: ${err.message}`));
            });
        });
    }

    /**
     * Rename (move) a file or folder within the same remote
     * @param sourcePath Full source path (e.g., "gdrive:/old-name.txt")
     * @param destPath Full destination path (e.g., "gdrive:/new-name.txt")
     */
    async rename(sourcePath: string, destPath: string): Promise<void> {
        console.log(`[RcloneService] Renaming: ${sourcePath} -> ${destPath}`);

        return new Promise((resolve, reject) => {
            const args = ['moveto', sourcePath, destPath];

            const rclone = spawn(this.rclonePath, [
                '--config', this.configPath,
                ...args
            ]);

            let stderr = '';

            rclone.stderr?.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            rclone.on('close', (code: number | null) => {
                if (code === 0) {
                    console.log(`[RcloneService] Rename completed: ${sourcePath} -> ${destPath}`);
                    resolve();
                } else {
                    console.error(`[RcloneService] Rename failed: ${sourcePath}`, stderr);
                    reject(new Error(`Failed to rename: ${stderr || `exit code ${code}`}`));
                }
            });

            rclone.on('error', (err: Error) => {
                console.error(`[RcloneService] Rename error: ${sourcePath}`, err);
                reject(new Error(`Failed to spawn rclone: ${err.message}`));
            });
        });
    }

    /**
     * Create a directory at remote path
     * @param fullPath Full path including remote (e.g., "gdrive:/newfolder")
     */
    async mkdir(fullPath: string): Promise<void> {
        console.log(`[RcloneService] Creating directory: ${fullPath}`);

        return new Promise((resolve, reject) => {
            const args = ['mkdir', fullPath];

            const rclone = spawn(this.rclonePath, [
                '--config', this.configPath,
                ...args
            ]);

            let stderr = '';

            rclone.stderr?.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            rclone.on('close', (code: number | null) => {
                if (code === 0) {
                    console.log(`[RcloneService] Mkdir completed: ${fullPath}`);
                    resolve();
                } else {
                    console.error(`[RcloneService] Mkdir failed: ${fullPath}`, stderr);
                    reject(new Error(`Failed to mkdir: ${stderr || `exit code ${code}`}`));
                }
            });

            rclone.on('error', (err: Error) => {
                console.error(`[RcloneService] Mkdir error: ${fullPath}`, err);
                reject(new Error(`Failed to spawn rclone: ${err.message}`));
            });
        });
    }

    /**
     * Cancel an active transfer
     */
    cancel(transferId: string): void {
        const process = this.activeProcesses.get(transferId);
        if (process) {
            console.log(`[RcloneService] Cancelling transfer: ${transferId}`);
            process.kill('SIGTERM');
            this.activeProcesses.delete(transferId);
        } else {
            console.warn(`[RcloneService] Transfer not found for cancellation: ${transferId}`);
        }
    }

    /**
     * Get list of active tasks with PIDs
     * Per Feature003 spec: returns {taskId, pid} for diagnostics
     */
    listActiveTasks(): Array<{ taskId: string; pid: number | null }> {
        const result: Array<{ taskId: string; pid: number | null }> = [];
        for (const [taskId, process] of this.activeProcesses.entries()) {
            result.push({
                taskId,
                pid: process.pid ?? null
            });
        }
        return result;
    }

    /**
     * Get active process by task ID
     */
    getActiveProcess(taskId: string): ChildProcess | undefined {
        return this.activeProcesses.get(taskId);
    }

    /**
     * Check if a task is currently active
     */
    isTaskActive(taskId: string): boolean {
        return this.activeProcesses.has(taskId);
    }

    /**
     * Retry a transfer with smart resume (skip existing files)
     * This is useful for resuming failed/cancelled transfers
     * @param type Transfer type ('copy' or 'move')
     * @param source Source path
     * @param dest Destination path
     * @param options Transfer options
     */
    async retryTransfer(
        type: 'copy' | 'move',
        source: string,
        dest: string,
        options?: CopyOptions
    ): Promise<TransferResult> {
        console.log(`[RcloneService] Retrying ${type} with smart resume (--ignore-existing)`);

        // Use the appropriate method with --ignore-existing flag
        return new Promise((resolve, reject) => {
            const transferId = options?.taskId || `${type}_retry_${Date.now()}`;

            const args = [
                type,
                source,
                dest,
                '--stats', '500ms',
                '--stats-log-level', 'INFO',
                '--use-json-log',
                '-v',
                '--ignore-existing' // Skip files that already exist at destination
            ];

            // Add bandwidth limit if specified (KB/s)
            if (options?.bandwidthLimit && options.bandwidthLimit > 0) {
                args.push('--bwlimit', `${options.bandwidthLimit}K`);
            }

            console.log(`[RcloneService] Starting retry: ${transferId}`);
            console.log(`[RcloneService] Command: rclone ${args.join(' ')}`);

            const process = spawn(this.rclonePath, [
                '--config', this.configPath,
                ...args
            ]);

            this.activeProcesses.set(transferId, process);

            // Use RcloneOutputParser to handle JSON parsing
            const parser = new RcloneOutputParser();

            process.stdout?.on('data', parser.createStdoutHandler(options));
            process.stderr?.on('data', parser.createStderrHandler(options));

            process.on('close', (code) => {
                this.activeProcesses.delete(transferId);
                const lastProgress = parser.getLastProgress();
                console.log(`[RcloneService] Retry completed: ${transferId} (exit code: ${code})`);

                if (code !== 0) {
                    reject(new Error(`Retry failed with code ${code}: ${parser.getErrorString()}`));
                } else {
                    resolve({
                        success: true,
                        bytesTransferred: lastProgress?.bytes || 0,
                        errors: lastProgress?.errors || 0
                    });
                }
            });

            process.on('error', (err) => {
                this.activeProcesses.delete(transferId);
                console.error(`[RcloneService] Retry error: ${transferId}`, err);
                reject(new Error(`Failed to spawn rclone: ${err.message}`));
            });
        });
    }

    /**
     * Get config file path
     */
    getConfigPath(): string {
        return this.configPath;
    }
}
