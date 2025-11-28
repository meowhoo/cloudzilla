import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

export interface RcloneRemote {
    name: string;
    type: string;
}

export interface OAuthResult {
    success: boolean;
    remoteName?: string;
    error?: string;
}

/**
 * RcloneConfigManager (v2)
 *
 * Manages rclone remote configurations using `rclone authorize` command.
 * This approach is simpler and more robust than interactive config screen-scraping.
 *
 * Flow:
 * 1. startOAuth() - spawns `rclone authorize <provider>`, browser opens automatically
 * 2. completeOAuth() - waits for token, creates config with `rclone config create`
 */
export class RcloneConfigManager {
    private rclonePath: string;
    private configPath: string;

    // OAuth state
    private oauthProcess: ChildProcess | null = null;
    private oauthProvider: string | null = null;
    private oauthRemoteName: string | null = null;

    constructor() {
        // Determine rclone binary path (same logic as RcloneService)
        const isDev = !app.isPackaged;
        if (isDev) {
            // In dev mode, app.getAppPath() returns the gui package directory
            this.rclonePath = path.join(app.getAppPath(), 'resources', 'bin', 'rclone.exe');
        } else {
            this.rclonePath = path.join(process.resourcesPath, 'bin', 'rclone.exe');
        }

        // Config path priority:
        // 1. RCLONE_CONFIG environment variable (if set)
        // 2. rclone's default path (Windows: %APPDATA%\rclone\rclone.conf)
        if (process.env.RCLONE_CONFIG) {
            this.configPath = process.env.RCLONE_CONFIG;
            console.log(`[RcloneConfigManager] Using RCLONE_CONFIG env: ${this.configPath}`);

            const configDir = path.dirname(this.configPath);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
        } else {
            let configDir: string;
            if (process.platform === 'win32') {
                configDir = path.join(process.env.APPDATA || '', 'rclone');
            } else {
                configDir = path.join(app.getPath('home'), '.config', 'rclone');
            }
            this.configPath = path.join(configDir, 'rclone.conf');

            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
        }

        console.log('[RcloneConfigManager] Initialized');
        console.log('[RcloneConfigManager] Binary path:', this.rclonePath);
        console.log('[RcloneConfigManager] Config path:', this.configPath);
    }

    /**
     * Execute rclone command and return stdout
     */
    private exec(args: string[], timeoutMs = 30000): Promise<string> {
        return new Promise((resolve, reject) => {
            const proc = spawn(this.rclonePath, args, {
                windowsHide: true,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            let stdout = '';
            let stderr = '';

            // Timeout to prevent hanging
            const timeout = setTimeout(() => {
                proc.kill();
                reject(new Error(`Command timed out after ${timeoutMs}ms. stdout: ${stdout}, stderr: ${stderr}`));
            }, timeoutMs);

            proc.stdout.on('data', (data) => {
                const chunk = data.toString();
                stdout += chunk;
                console.log('[exec stdout]:', chunk);
            });

            proc.stderr.on('data', (data) => {
                const chunk = data.toString();
                stderr += chunk;
                console.log('[exec stderr]:', chunk);
            });

            proc.on('close', (code) => {
                clearTimeout(timeout);
                if (code !== 0) {
                    reject(new Error(stderr || `Process exited with code ${code}`));
                } else {
                    resolve(stdout.trim());
                }
            });

            proc.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }

    /**
     * List all configured remotes
     */
    async listRemotes(): Promise<RcloneRemote[]> {
        try {
            const output = await this.exec(['listremotes', '--long', '--config', this.configPath]);

            if (!output) {
                console.log('[RcloneConfigManager] No remotes found');
                return [];
            }

            const lines = output.split('\n').filter(line => line.trim());
            const remotes = lines.map(line => {
                const [name, type] = line.split(':');
                return {
                    name: name.trim(),
                    type: type ? type.trim() : 'unknown'
                };
            });

            console.log('[RcloneConfigManager] Listed remotes:', remotes.map(r => r.name).join(', '));
            return remotes;
        } catch (err) {
            console.error('[RcloneConfigManager] Failed to list remotes:', err);
            return [];
        }
    }

    /**
     * Delete a remote configuration
     */
    async deleteRemote(name: string): Promise<void> {
        try {
            await this.exec(['config', 'delete', name, '--config', this.configPath]);
            console.log(`[RcloneConfigManager] Deleted remote: ${name}`);
        } catch (err) {
            console.error(`[RcloneConfigManager] Failed to delete remote ${name}:`, err);
            throw err;
        }
    }

    /**
     * Start OAuth flow using `rclone authorize`
     * Browser opens automatically by rclone
     */
    async startOAuth(provider: string, remoteName: string): Promise<void> {
        if (this.oauthProcess) {
            throw new Error('Another OAuth process is already running. Please wait or cancel it first.');
        }

        // Store OAuth state
        this.oauthProvider = provider;
        this.oauthRemoteName = remoteName;

        // Spawn rclone authorize - browser opens automatically
        this.oauthProcess = spawn(this.rclonePath, ['authorize', provider]);

        console.log(`[RcloneConfigManager] Started: rclone authorize ${provider}`);

        // Log output for debugging
        this.oauthProcess.stdout?.on('data', (data) => {
            console.log('[OAuth stdout]:', data.toString());
        });

        this.oauthProcess.stderr?.on('data', (data) => {
            console.log('[OAuth stderr]:', data.toString());
        });
    }

    /**
     * Wait for OAuth to complete and create remote config
     */
    async completeOAuth(): Promise<OAuthResult> {
        if (!this.oauthProcess || !this.oauthProvider || !this.oauthRemoteName) {
            return { success: false, error: 'No OAuth process running' };
        }

        const provider = this.oauthProvider;
        const remoteName = this.oauthRemoteName;

        try {
            // Wait for process to complete and capture token
            const tokenJson = await this.waitForToken();

            console.log('[RcloneConfigManager] Token received, creating remote...');

            // Create remote with token
            await this.createRemoteWithToken(remoteName, provider, tokenJson);

            // Verify remote was created
            const remotes = await this.listRemotes();
            const found = remotes.find(r => r.name === remoteName);

            if (found) {
                console.log(`[RcloneConfigManager] Remote '${remoteName}' created successfully`);
                return { success: true, remoteName };
            } else {
                return { success: false, error: 'Remote not found after creation' };
            }
        } catch (err) {
            console.error('[RcloneConfigManager] OAuth failed:', err);
            return { success: false, error: (err as Error).message };
        } finally {
            this.cleanup();
        }
    }

    /**
     * Wait for rclone authorize to output token JSON
     */
    private waitForToken(): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!this.oauthProcess) {
                reject(new Error('No OAuth process'));
                return;
            }

            let stdout = '';
            let stderr = '';

            const timeout = setTimeout(() => {
                if (this.oauthProcess) {
                    this.oauthProcess.kill();
                }
                reject(new Error('OAuth timeout (120s) - please complete authorization in browser'));
            }, 120000);

            this.oauthProcess.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            this.oauthProcess.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            this.oauthProcess.on('close', (code) => {
                clearTimeout(timeout);

                console.log(`[RcloneConfigManager] rclone authorize exited with code ${code}`);
                console.log('[RcloneConfigManager] stdout:', stdout);

                if (code !== 0) {
                    reject(new Error(`rclone authorize failed: ${stderr || 'Unknown error'}`));
                    return;
                }

                // Extract token JSON from output
                // Format: {"access_token":"...","token_type":"Bearer","refresh_token":"...","expiry":"..."}
                // The token appears after "Paste the following into your remote machine --->"
                const tokenMatch = stdout.match(/--->\s*(\{[\s\S]*?\})\s*<---/);
                if (tokenMatch && tokenMatch[1]) {
                    try {
                        const token = tokenMatch[1].trim();
                        JSON.parse(token); // Validate JSON
                        resolve(token);
                        return;
                    } catch {
                        // Try fallback pattern
                    }
                }

                // Fallback: find any JSON with access_token
                const jsonMatch = stdout.match(/\{[^{}]*"access_token"[^{}]*\}/);
                if (jsonMatch) {
                    try {
                        JSON.parse(jsonMatch[0]);
                        resolve(jsonMatch[0]);
                        return;
                    } catch {
                        // Invalid JSON
                    }
                }

                reject(new Error('Failed to parse token from rclone output'));
            });

            this.oauthProcess.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }

    /**
     * Create remote configuration with token
     */
    private async createRemoteWithToken(
        name: string,
        provider: string,
        tokenJson: string
    ): Promise<void> {
        console.log(`[RcloneConfigManager] Creating remote: ${name} (${provider})`);

        try {
            if (provider === 'onedrive') {
                // For OneDrive, we need special handling:
                // 1. Write config directly to file (bypass validation)
                // 2. Fetch drives to get drive_type and drive_id
                // 3. Update config with correct values
                await this.createOneDriveConfig(name, tokenJson);
            } else {
                // For other providers, use normal config create
                const args = [
                    'config', 'create', name, provider,
                    'token', tokenJson,
                    '--config', this.configPath
                ];
                await this.exec(args);
                console.log(`[RcloneConfigManager] Created remote: ${name}`);
            }
        } catch (err) {
            console.error(`[RcloneConfigManager] Failed to create remote:`, err);
            throw err;
        }
    }

    /**
     * Create OneDrive config by writing directly to config file
     * This bypasses rclone's validation during config create
     */
    private async createOneDriveConfig(name: string, tokenJson: string): Promise<void> {
        console.log(`[RcloneConfigManager] Creating OneDrive config directly for ${name}...`);

        // Step 1: Write config with drive_type=personal (needed to fetch drives)
        // We'll update it later based on actual drive type
        const configEntry = `\n[${name}]\ntype = onedrive\ntoken = ${tokenJson}\ndrive_type = personal\n`;
        fs.appendFileSync(this.configPath, configEntry);
        console.log(`[RcloneConfigManager] Wrote initial config for ${name}`);

        // Step 2: Fetch drives and set correct drive_type + drive_id
        await this.fetchAndSetOneDriveConfig(name);
    }

    /**
     * Fetch OneDrive drive configuration using Microsoft Graph API directly
     * This avoids the chicken-and-egg problem with rclone backend drives
     */
    private async fetchAndSetOneDriveConfig(name: string): Promise<void> {
        console.log(`[RcloneConfigManager] Fetching OneDrive config for ${name}...`);

        try {
            // Get the token from config
            const configOutput = await this.exec(['config', 'dump', '--config', this.configPath]);
            const config = JSON.parse(configOutput);
            const remoteConfig = config[name];

            if (!remoteConfig || !remoteConfig.token) {
                throw new Error('No token found in config');
            }

            const tokenData = JSON.parse(remoteConfig.token);
            const accessToken = tokenData.access_token;

            console.log('[RcloneConfigManager] Calling Microsoft Graph API to list drives...');

            // Call Microsoft Graph API directly to get drives
            const https = await import('https');
            const drives = await new Promise<any[]>((resolve, reject) => {
                const req = https.request({
                    hostname: 'graph.microsoft.com',
                    path: '/v1.0/me/drives',
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try {
                            const result = JSON.parse(data);
                            if (result.error) {
                                reject(new Error(result.error.message));
                            } else {
                                resolve(result.value || []);
                            }
                        } catch (e) {
                            reject(e);
                        }
                    });
                });
                req.on('error', reject);
                req.setTimeout(30000, () => {
                    req.destroy();
                    reject(new Error('Request timeout'));
                });
                req.end();
            });

            console.log(`[RcloneConfigManager] Found ${drives.length} drives from Graph API`);
            drives.forEach((d: any, i: number) => {
                console.log(`[RcloneConfigManager] Drive ${i}: type=${d.driveType}, id=${d.id}, name=${d.name}`);
            });

            if (drives.length === 0) {
                throw new Error('No drives found for OneDrive account');
            }

            // Strategy: Find real OneDrive (ID without "b!" prefix), fallback to second drive
            // SharePoint/documentLibrary IDs start with "b!", real OneDrive personal IDs are hex like "7D8A36DB6D066A84"
            let selectedDrive = drives.find(d => !d.id.startsWith('b!'));
            if (selectedDrive) {
                console.log(`[RcloneConfigManager] Found OneDrive (non-SharePoint ID)`);
            } else if (drives.length >= 2) {
                selectedDrive = drives[1]; // Fallback to second drive (index 1)
                console.log(`[RcloneConfigManager] No OneDrive found, using second drive (index 1)`);
            } else {
                selectedDrive = drives[0]; // Only one drive available
                console.log(`[RcloneConfigManager] Using first drive (only one available)`);
            }

            const driveId = selectedDrive.id;
            const driveType = selectedDrive.driveType || 'personal';

            console.log(`[RcloneConfigManager] Selected drive - type: ${driveType}, id: ${driveId}`);

            // Update the config file directly (avoid rclone config update which validates and times out)
            await this.updateConfigFileDirect(name, {
                'drive_type': driveType,
                'drive_id': driveId
            });

            console.log(`[RcloneConfigManager] Updated ${name} with drive_type=${driveType}, drive_id=${driveId}`);
        } catch (err) {
            console.error('[RcloneConfigManager] Failed to fetch OneDrive config:', err);
            // Don't throw - the remote is created, just may need manual config
            console.warn('[RcloneConfigManager] OneDrive remote created but drive config not set. Manual configuration may be needed.');
        }
    }

    /**
     * Update rclone config file directly without validation
     * This bypasses rclone's validation which can timeout for partially configured remotes
     */
    private async updateConfigFileDirect(remoteName: string, updates: Record<string, string>): Promise<void> {
        console.log(`[RcloneConfigManager] Updating config file directly for ${remoteName}...`);

        // Read current config
        const configContent = fs.readFileSync(this.configPath, 'utf-8');
        const lines = configContent.split('\n');

        // Find the section for this remote
        const sectionHeader = `[${remoteName}]`;
        let sectionStart = -1;
        let sectionEnd = lines.length;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line === sectionHeader) {
                sectionStart = i;
            } else if (sectionStart !== -1 && line.startsWith('[') && line.endsWith(']')) {
                sectionEnd = i;
                break;
            }
        }

        if (sectionStart === -1) {
            throw new Error(`Remote section [${remoteName}] not found in config`);
        }

        // Build a map of existing keys in this section
        const existingKeys = new Map<string, number>(); // key -> line index
        for (let i = sectionStart + 1; i < sectionEnd; i++) {
            const line = lines[i];
            const match = line.match(/^(\w+)\s*=\s*/);
            if (match) {
                existingKeys.set(match[1], i);
            }
        }

        // Update existing keys or prepare new lines
        const newLines: string[] = [];
        for (const [key, value] of Object.entries(updates)) {
            if (existingKeys.has(key)) {
                // Update existing line
                lines[existingKeys.get(key)!] = `${key} = ${value}`;
            } else {
                // Add new line after section header
                newLines.push(`${key} = ${value}`);
            }
        }

        // Insert new lines after section header
        if (newLines.length > 0) {
            lines.splice(sectionStart + 1, 0, ...newLines);
        }

        // Write back
        fs.writeFileSync(this.configPath, lines.join('\n'));
        console.log(`[RcloneConfigManager] Config file updated directly for ${remoteName}`);
    }

    /**
     * Cancel ongoing OAuth process
     */
    cancelOAuth(): void {
        if (this.oauthProcess) {
            this.oauthProcess.kill();
            this.cleanup();
            console.log('[RcloneConfigManager] OAuth process cancelled');
        }
    }

    /**
     * Cleanup OAuth state
     */
    private cleanup(): void {
        this.oauthProcess = null;
        this.oauthProvider = null;
        this.oauthRemoteName = null;
    }

    /**
     * Simple non-OAuth remote creation (e.g., local, SFTP with credentials)
     */
    async createRemote(name: string, provider: string, config: Record<string, string>): Promise<void> {
        try {
            const args = ['config', 'create', name, provider, '--config', this.configPath];

            for (const [key, value] of Object.entries(config)) {
                args.push(key, value);
            }

            await this.exec(args);
            console.log(`[RcloneConfigManager] Created remote: ${name}`);
        } catch (err) {
            console.error(`[RcloneConfigManager] Failed to create remote ${name}:`, err);
            throw err;
        }
    }

    /**
     * Get remote configuration details
     */
    async getRemoteConfig(name: string): Promise<Record<string, string>> {
        try {
            const output = await this.exec(['config', 'dump', '--config', this.configPath]);
            const config = JSON.parse(output);
            return config[name] || {};
        } catch (err) {
            console.error(`[RcloneConfigManager] Failed to get config for ${name}:`, err);
            return {};
        }
    }

    /**
     * Check if rclone is available
     */
    async isAvailable(): Promise<boolean> {
        try {
            await this.exec(['version']);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get config file path
     */
    getConfigPath(): string {
        return this.configPath;
    }
}
