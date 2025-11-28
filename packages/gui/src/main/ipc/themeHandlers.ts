import { ipcMain, nativeTheme, BrowserWindow } from 'electron';
import { ConfigManager } from '../config/ConfigManager';

export function setupThemeHandlers(configManager: ConfigManager) {
    /**
     * Get current theme setting from config
     */
    ipcMain.handle('theme:get', () => {
        return configManager.get('theme') || 'system';
    });

    /**
     * Get OS theme preference
     */
    ipcMain.handle('theme:get-os', () => {
        return {
            dark: nativeTheme.shouldUseDarkColors,
            actualTheme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
        };
    });

    /**
     * Save theme and broadcast to all windows
     */
    ipcMain.handle('theme:save', (event, theme: 'light' | 'dark' | 'system') => {
        try {
            // Save to config
            configManager.set('theme', theme);

            // Update nativeTheme
            nativeTheme.themeSource = theme;

            // Calculate actual theme for broadcast
            const actualTheme = theme === 'system'
                ? (nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
                : theme;

            // Broadcast to all windows
            BrowserWindow.getAllWindows().forEach(win => {
                if (!win.isDestroyed()) {
                    win.webContents.send('theme-changed-broadcast', actualTheme);
                }
            });

            console.log(`[ThemeHandler] Theme saved: ${theme}, actual: ${actualTheme}`);

            return { success: true, actualTheme };
        } catch (err) {
            console.error('[ThemeHandler] Failed to save theme:', err);
            return { success: false, error: (err as Error).message };
        }
    });
}

/**
 * Setup nativeTheme monitoring
 * Broadcasts OS theme changes when user has 'system' theme selected
 */
export function setupNativeThemeMonitoring(configManager: ConfigManager) {
    nativeTheme.on('updated', () => {
        const currentTheme = configManager.get('theme');

        // Only broadcast if user has 'system' theme selected
        if (currentTheme === 'system') {
            const actualTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';

            console.log(`[NativeTheme] OS theme changed to: ${actualTheme}`);

            // Broadcast to all windows
            BrowserWindow.getAllWindows().forEach(win => {
                if (!win.isDestroyed()) {
                    win.webContents.send('os-theme-changed', {
                        dark: nativeTheme.shouldUseDarkColors,
                        actualTheme
                    });
                }
            });
        }
    });

    console.log('[NativeTheme] Monitoring initialized');
}
