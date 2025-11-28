/**
 * Test script for RcloneService
 * Run: node test-rclone.js
 */

// Mock Electron app for testing
const mockApp = {
    isPackaged: false,
    getAppPath: () => __dirname,
    getPath: (name) => {
        if (name === 'userData') {
            return __dirname;
        }
        return __dirname;
    }
};

// Inject mock app
global.app = mockApp;

// Load the compiled service
const path = require('path');
const fs = require('fs');

// We need to compile TypeScript first
console.log('⚠️  Please compile TypeScript first:');
console.log('   cd packages/gui && npx tsc src/main/services/RcloneService.ts --outDir .webpack/main --esModuleInterop');
console.log('');
console.log('Or use this simpler approach - test directly with main process after app starts');

// Simple test without compilation
const { spawn } = require('child_process');

const rclonePath = path.join(__dirname, 'resources', 'bin', 'rclone.exe');

console.log('🔍 Testing rclone binary...');
console.log(`📁 Binary path: ${rclonePath}`);
console.log(`✓ Binary exists: ${fs.existsSync(rclonePath)}`);
console.log('');

// Test version
console.log('📌 Testing: rclone version');
const versionProcess = spawn(rclonePath, ['version']);

versionProcess.stdout.on('data', (data) => {
    console.log('✓ Output:', data.toString().trim().split('\n')[0]);
});

versionProcess.stderr.on('data', (data) => {
    console.error('❌ Error:', data.toString());
});

versionProcess.on('close', (code) => {
    if (code === 0) {
        console.log('✓ Version check passed!');
        console.log('');
        testListRemotes();
    } else {
        console.error(`❌ Version check failed with code ${code}`);
    }
});

// Test list remotes
function testListRemotes() {
    console.log('📌 Testing: rclone listremotes');

    const configPath = path.join(__dirname, 'rclone.conf');
    const listProcess = spawn(rclonePath, ['--config', configPath, 'listremotes']);

    let output = '';

    listProcess.stdout.on('data', (data) => {
        output += data.toString();
    });

    listProcess.stderr.on('data', (data) => {
        console.error('❌ Error:', data.toString());
    });

    listProcess.on('close', (code) => {
        if (code === 0) {
            if (output.trim()) {
                console.log('✓ Configured remotes:');
                console.log(output.trim().split('\n').map(r => `  - ${r}`).join('\n'));
            } else {
                console.log('⚠️  No remotes configured yet');
                console.log('💡 To configure a remote, run:');
                console.log(`   "${rclonePath}" config`);
            }
        } else {
            console.error(`❌ List remotes failed with code ${code}`);
        }
        console.log('');
        console.log('✅ RcloneService basic tests completed!');
    });
}
