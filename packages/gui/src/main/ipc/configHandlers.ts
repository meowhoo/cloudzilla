import { ipcMain, BrowserWindow } from 'electron';
import { ConfigManager, AppConfig } from '../config/ConfigManager';
import { TransferQueueManager } from '../services/TransferQueueManager';

export function setupConfigHandlers(
    configManager: ConfigManager,
    transferQueueManager?: TransferQueueManager
) {
    /**
     * Load entire configuration
     */
    ipcMain.handle('config:load', () => {
        return configManager.load();
    });

    /**
     * Save configuration (partial update)
     */
    ipcMain.handle('config:save', (event, updates: Partial<AppConfig>) => {
        try {
            configManager.save(updates);

            // Broadcast showHiddenFiles changes to all windows
            if ('showHiddenFiles' in updates) {
                console.log(`[ConfigHandler] showHiddenFiles changed to: ${updates.showHiddenFiles}`);
                BrowserWindow.getAllWindows().forEach(win => {
                    if (!win.isDestroyed()) {
                        win.webContents.send('show-hidden-files-changed-broadcast', updates.showHiddenFiles);
                    }
                });
            }

            // Update TransferQueueManager settings (applies to new tasks)
            if (transferQueueManager) {
                if ('maxConcurrentTransfers' in updates && updates.maxConcurrentTransfers !== undefined) {
                    console.log(`[ConfigHandler] maxConcurrentTransfers changed to: ${updates.maxConcurrentTransfers}`);
                    transferQueueManager.setMaxConcurrent(updates.maxConcurrentTransfers);
                }
            }

            return { success: true };
        } catch (err) {
            return { success: false, error: (err as Error).message };
        }
    });

    /**
     * Get a specific config value
     */
    ipcMain.handle('config:get', (event, key: keyof AppConfig) => {
        return configManager.get(key);
    });

    /**
     * Set a specific config value and broadcast if it's language
     */
    ipcMain.handle('config:set', (event, key: keyof AppConfig, value: any) => {
        try {
            configManager.set(key, value);

            // Broadcast language changes to all windows
            if (key === 'language') {
                console.log(`[ConfigHandler] Language changed to: ${value}`);
                BrowserWindow.getAllWindows().forEach(win => {
                    if (!win.isDestroyed()) {
                        win.webContents.send('language-changed-broadcast', value);
                    }
                });
            }

            return { success: true };
        } catch (err) {
            return { success: false, error: (err as Error).message };
        }
    });
}
