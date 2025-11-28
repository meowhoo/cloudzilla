import { RcloneProgress, CopyOptions } from '../RcloneService';

/**
 * Parsed result from a single line of rclone output
 */
export interface ParsedLine {
    type: 'stats' | 'log' | 'text';
    stats?: RcloneProgress;
    logLevel?: string;
    logMessage?: string;
    rawText?: string;
}

/**
 * RcloneOutputParser
 *
 * Extracts and parses JSON output from rclone commands.
 * Handles both stats (progress) and log messages in JSON format.
 *
 * This class consolidates the duplicated parsing logic from
 * RcloneService's copy(), move(), delete(), and retryTransfer() methods.
 */
export class RcloneOutputParser {
    private errorMessages: string[] = [];
    private lastProgress: RcloneProgress | null = null;

    constructor() {
        this.reset();
    }

    /**
     * Reset parser state (call before starting a new transfer)
     */
    reset(): void {
        this.errorMessages = [];
        this.lastProgress = null;
    }

    /**
     * Get accumulated error messages
     */
    getErrors(): string[] {
        return [...this.errorMessages];
    }

    /**
     * Get error messages as a single string
     */
    getErrorString(): string {
        return this.errorMessages.join('\n');
    }

    /**
     * Get last recorded progress
     */
    getLastProgress(): RcloneProgress | null {
        return this.lastProgress;
    }

    /**
     * Parse a single line of rclone output
     * @param line Raw line from stdout/stderr
     * @returns Parsed result with type and data
     */
    parseLine(line: string): ParsedLine {
        if (!line.trim()) {
            return { type: 'text', rawText: '' };
        }

        try {
            const json = JSON.parse(line);

            // Progress stats (from --use-json-log)
            if (json.stats) {
                this.lastProgress = json.stats;
                return {
                    type: 'stats',
                    stats: json.stats
                };
            }

            // Log messages (level + msg)
            if (json.level && json.msg) {
                const logMessage = `[${json.level.toUpperCase()}] ${json.msg}`;

                // Track errors
                if (json.level === 'error') {
                    this.errorMessages.push(json.msg);
                }

                return {
                    type: 'log',
                    logLevel: json.level,
                    logMessage
                };
            }

            // Unknown JSON structure
            return { type: 'text', rawText: line };

        } catch (e) {
            // Not JSON, treat as plain text
            return { type: 'text', rawText: line };
        }
    }

    /**
     * Process output line and dispatch to appropriate callbacks
     * This is a convenience method that combines parsing with callback invocation.
     *
     * @param line Raw line from rclone
     * @param source Whether line came from 'stdout' or 'stderr'
     * @param options CopyOptions containing callbacks
     */
    processLine(
        line: string,
        source: 'stdout' | 'stderr',
        options?: CopyOptions
    ): void {
        const parsed = this.parseLine(line);

        switch (parsed.type) {
            case 'stats':
                if (options?.onProgress && parsed.stats) {
                    options.onProgress(parsed.stats);
                }
                break;

            case 'log':
                if (parsed.logMessage) {
                    // Route to appropriate callback based on source
                    if (source === 'stdout' && options?.onStdout) {
                        options.onStdout(parsed.logMessage);
                    } else if (source === 'stderr' && options?.onStderr) {
                        options.onStderr(parsed.logMessage);
                    }

                    // Also report errors through onError
                    if (parsed.logLevel === 'error' && options?.onError) {
                        options.onError(parsed.logMessage);
                    }
                }
                break;

            case 'text':
                if (parsed.rawText) {
                    if (source === 'stdout' && options?.onStdout) {
                        options.onStdout(parsed.rawText);
                    } else if (source === 'stderr') {
                        // Non-JSON stderr is typically an error
                        this.errorMessages.push(parsed.rawText);
                        if (options?.onStderr) {
                            options.onStderr(parsed.rawText);
                        }
                    }
                }
                break;
        }
    }

    /**
     * Process multiple lines at once (from a data chunk)
     * @param data Raw data buffer or string
     * @param source 'stdout' or 'stderr'
     * @param options CopyOptions containing callbacks
     */
    processData(
        data: Buffer | string,
        source: 'stdout' | 'stderr',
        options?: CopyOptions
    ): void {
        const lines = data.toString().split('\n');
        for (const line of lines) {
            this.processLine(line, source, options);
        }
    }

    /**
     * Create a stdout handler for ChildProcess
     * @param options CopyOptions containing callbacks
     * @returns Handler function for process.stdout.on('data', ...)
     */
    createStdoutHandler(options?: CopyOptions): (data: Buffer) => void {
        return (data: Buffer) => {
            this.processData(data, 'stdout', options);
        };
    }

    /**
     * Create a stderr handler for ChildProcess
     * @param options CopyOptions containing callbacks
     * @returns Handler function for process.stderr.on('data', ...)
     */
    createStderrHandler(options?: CopyOptions): (data: Buffer) => void {
        return (data: Buffer) => {
            this.processData(data, 'stderr', options);
        };
    }

    /**
     * Log progress to console (for debugging)
     * @param operationType Name of operation (copy, move, delete, etc.)
     * @param transferId Transfer ID for logging
     */
    logProgress(operationType: string, transferId: string): void {
        if (this.lastProgress) {
            const p = this.lastProgress;
            console.log(
                `[RcloneOutputParser] ${operationType} progress for ${transferId}: ` +
                `bytes=${p.bytes}, totalBytes=${p.totalBytes}, ` +
                `speed=${p.speed}, transferring=${p.transferring?.length || 0}`
            );
        }
    }
}
