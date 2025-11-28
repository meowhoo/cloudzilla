import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import type { Configuration } from 'webpack';
import * as path from 'path';

import type { ModuleOptions } from 'webpack';

// Main process rules (can use node-loader etc)
const mainRules: Required<ModuleOptions>['rules'] = [
    {
        test: /native_modules[/\\].+\.node$/,
        use: 'node-loader',
    },
    {
        test: /[/\\]node_modules[/\\].+\.(m?js|node)$/,
        parser: { amd: false },
        use: {
            loader: '@vercel/webpack-asset-relocator-loader',
            options: {
                outputAssetBase: 'native_modules',
            },
        },
    },
    {
        test: /\.tsx?$/,
        exclude: /(node_modules|\.webpack)/,
        use: {
            loader: 'ts-loader',
            options: {
                transpileOnly: true,
            },
        },
    },
];

// Renderer process rules (NO node-loader or relocator)
const rendererRules: Required<ModuleOptions>['rules'] = [
    {
        test: /\.tsx?$/,
        exclude: /(node_modules|\.webpack)/,
        use: {
            loader: 'ts-loader',
            options: {
                transpileOnly: true,
            },
        },
    },
    {
        test: /\.css$/,
        use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
    },
];

// Plugins
import type IForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ForkTsCheckerWebpackPlugin: typeof IForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const plugins = [
    new ForkTsCheckerWebpackPlugin({
        logger: 'webpack-infrastructure',
    }),
];

// Main Webpack Config
const mainConfig: Configuration = {
    entry: './src/main/index.ts',
    module: {
        rules: mainRules,
    },
    plugins,
    resolve: {
        extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
        plugins: [new TsconfigPathsPlugin()],
    },
};

// Renderer Webpack Config
const rendererConfig: Configuration = {
    module: {
        rules: rendererRules,
    },
    plugins,
    resolve: {
        extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
        plugins: [new TsconfigPathsPlugin()],
    },
};

// Forge Config
const config: ForgeConfig = {
    packagerConfig: {
        asar: true,
        name: 'CloudZilla',
        executableName: 'cloudzilla',
        icon: '../../build/icons/icon', // .ico/.icns added automatically per platform
        extraResource: [
            './resources/bin',
            '../../LICENSE',
        ],
    },
    rebuildConfig: {},
    makers: [
        new MakerSquirrel({
            name: 'CloudZilla',
            authors: 'CloudZilla Team',
            description: 'Cloud storage file transfer utility',
            setupExe: 'CloudZilla-Setup.exe',
            iconUrl: 'https://raw.githubusercontent.com/meowhoo/cloudzilla/main/build/icons/icon.ico',
            setupIcon: path.resolve(__dirname, '../../build/icons/icon.ico'),
        }),
        new MakerZIP({}, ['darwin', 'win32']),
        new MakerRpm({}),
        new MakerDeb({}),
    ],
    plugins: [
        new AutoUnpackNativesPlugin({}),
        new WebpackPlugin({
            mainConfig,
            renderer: {
                config: rendererConfig,
                entryPoints: [
                    {
                        html: './src/renderer/index.html',
                        js: './src/renderer/index.tsx',
                        name: 'main_window',
                        preload: {
                            js: './src/preload/index.ts',
                        },
                    },
                ],
            },
        }),
    ],
};

export default config;
