/**
 * 快速啟動入口點 - 用於開發時跳過 webpack 編譯
 * 使用方式: npm run dev (需先執行過 npm run start 至少一次)
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');

// 開發模式下的 webpack 輸出路徑
const WEBPACK_DIR = path.join(__dirname, '.webpack', process.arch);

// 設定 webpack 魔術常數的等效值
global.MAIN_WINDOW_WEBPACK_ENTRY = `file://${path.join(WEBPACK_DIR, 'renderer', 'main_window', 'index.html')}`;
global.MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY = path.join(WEBPACK_DIR, 'renderer', 'main_window', 'preload.js');

// 載入編譯後的主進程程式碼
require(path.join(WEBPACK_DIR, 'main', 'index.js'));
