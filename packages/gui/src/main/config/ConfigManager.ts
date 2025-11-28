import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface AppConfig {
    language: string;
    theme: 'light' | 'dark' | 'system';
    version: string;
    sites: Array<{
        id: string;
        name: string;
        provider: string;
        clientId?: string;
        clientSecret?: string;
    }>;
    // System settings
    showHiddenFiles?: boolean;
    // Transfer settings
    maxConcurrentTransfers?: number;
    bandwidthLimitKBps?: number;  // KB/s, 0 = unlimited
    autoRetry?: boolean;
    retryAttempts?: number;
}

const DEFAULT_CONFIG: AppConfig = {
    language: 'en-US',
    theme: 'system',
    version: app.getVersion(),
    sites: [],
    showHiddenFiles: false,
    maxConcurrentTransfers: 2,
    bandwidthLimitKBps: 0,  // 0 = unlimited
    autoRetry: true,
    retryAttempts: 3,
};

export class ConfigManager {
    private configPath: string;
    private config: AppConfig | null = null;

    constructor() {
        // 🎯 參考 novel_browser 做法：
        // - Debug 模式：使用專案根目錄的 app-config.json（方便開發）
        // - Release 模式：使用 AppData/Roaming 的 app-config.json

        let configDir: string;

        if (app.isPackaged) {
            // Release: 使用 userData 目錄
            configDir = app.getPath('userData');
        } else {
            // Debug: 使用專案根目錄
            // app.getAppPath() 在開發模式下返回專案根目錄（packages/gui）
            // 我們需要往上兩層到達 mv_cloud 根目錄
            const guiPath = app.getAppPath();
            configDir = path.resolve(guiPath, '..', '..');
        }

        this.configPath = path.join(configDir, 'app-config.json');

        console.log(`[ConfigManager] Config path: ${this.configPath} (isPackaged: ${app.isPackaged})`);
    }

    /**
     * Load configuration from file
     */
    load(): AppConfig {
        if (this.config) {
            return this.config;
        }

        try {
            if (fs.existsSync(this.configPath)) {
                const content = fs.readFileSync(this.configPath, 'utf8');
                this.config = { ...DEFAULT_CONFIG, ...JSON.parse(content) };
            } else {
                this.config = { ...DEFAULT_CONFIG };
                this.save(this.config);
            }
        } catch (err) {
            console.error('Failed to load config:', err);
            this.config = { ...DEFAULT_CONFIG };
        }

        // Config is guaranteed to be non-null here
        return this.config!;
    }

    /**
     * Save configuration to file
     */
    save(config: Partial<AppConfig>): void {
        try {
            this.config = { ...this.load(), ...config };

            // Ensure directory exists
            const configDir = path.dirname(this.configPath);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }

            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
        } catch (err) {
            console.error('Failed to save config:', err);
            throw err;
        }
    }

    /**
     * Get a specific config value
     */
    get<K extends keyof AppConfig>(key: K): AppConfig[K] {
        const config = this.load();
        return config[key];
    }

    /**
     * Set a specific config value
     */
    set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
        const config = this.load();
        config[key] = value;
        this.save(config);
    }

    /**
     * Clear cached config (force reload on next access)
     */
    clearCache(): void {
        this.config = null;
    }

    /**
     * Get config file path (for debugging)
     */
    getConfigPath(): string {
        return this.configPath;
    }
}
