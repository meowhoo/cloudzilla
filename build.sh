#!/bin/bash
set -e

echo "========================================"
echo "CloudZilla - 快速打包"
echo "========================================"

# 解析參數
SKIP_ICONS=false
ONLY_PACKAGE=false
BUILD_APPX=false

for arg in "$@"; do
  case $arg in
    --skip-icons)
      SKIP_ICONS=true
      shift
      ;;
    --only-package)
      ONLY_PACKAGE=true
      shift
      ;;
    --appx)
      BUILD_APPX=true
      shift
      ;;
    --help|-h)
      echo ""
      echo "用法: ./build.sh [選項]"
      echo ""
      echo "選項:"
      echo "  --skip-icons     跳過 icon 生成"
      echo "  --only-package   只打包，不製作安裝程式"
      echo "  --appx           額外打包 APPX 版本"
      echo "  --help, -h       顯示此幫助訊息"
      echo ""
      exit 0
      ;;
  esac
done

# 清理暫存檔案和快取
echo ""
echo "清理暫存檔案和快取..."
rm -rf packages/gui/.webpack packages/gui/out 2>/dev/null || true
rm -rf packages/*/dist 2>/dev/null || true
echo "✅ 清理完成"
echo ""

# ========================================
# 步驟 1/4: 生成 Icons
# ========================================
if [ "$SKIP_ICONS" = false ]; then
    echo "步驟 1/4: 生成 Icons..."
    rm -rf build/icons 2>/dev/null || true
    npm run build:icons
    echo "✅ Icons 生成完成"
else
    echo "步驟 1/4: 跳過 icon 生成 (--skip-icons)"
fi
echo ""

# ========================================
# 步驟 2/4: 生成 APPX Icons
# ========================================
if [ "$SKIP_ICONS" = false ]; then
    echo "步驟 2/4: 生成 APPX Icons..."
    rm -rf build/appx 2>/dev/null || true
    npm run build:appx-icons
    echo "✅ APPX Icons 生成完成"
else
    echo "步驟 2/4: 跳過 APPX icon 生成 (--skip-icons)"
fi
echo ""

# ========================================
# 步驟 3/4: 打包 Electron GUI
# ========================================
echo "步驟 3/4: 打包 Electron GUI..."
echo ""

cd packages/gui

if [ "$ONLY_PACKAGE" = true ]; then
    echo "執行: electron-forge package"
    echo ""
    npx electron-forge package
else
    echo "執行: electron-forge make"
    echo "打包格式: Squirrel (Windows 安裝程式) + ZIP"
    echo ""
    npx electron-forge make
fi

cd ../..

echo ""
echo "✅ Electron GUI 打包完成"
echo ""

# ========================================
# 步驟 4/4: 打包 APPX（可選）
# ========================================
if [ "$BUILD_APPX" = true ]; then
    echo "步驟 4/4: 打包 APPX..."
    echo ""

    # 檢查並添加 Windows SDK 到 PATH
    SDK_BASE="/c/Program Files (x86)/Windows Kits/10/bin"

    if [ -d "$SDK_BASE" ]; then
        # 尋找最新的 SDK 版本
        LATEST_SDK=$(ls -1 "$SDK_BASE" | grep "^10\." | sort -V | tail -1)
        if [ -n "$LATEST_SDK" ]; then
            SDK_PATH="$SDK_BASE/$LATEST_SDK/x64"

            if [ -f "$SDK_PATH/makeappx.exe" ]; then
                echo "✓ 找到 Windows SDK: $LATEST_SDK"
                export PATH="$SDK_PATH:$PATH"
            else
                echo "⚠ 警告: 找不到 makeappx.exe，APPX 打包可能失敗"
            fi
        fi
    else
        echo "⚠ 警告: 找不到 Windows SDK"
    fi

    cd packages/gui

    echo "執行: electron-builder --prepackaged"
    npx electron-builder --prepackaged out/CloudZilla-win32-x64 --win appx --x64

    cd ../..

    echo ""
    echo "✅ APPX 打包完成"

    # 簽名 APPX
    echo ""
    echo "簽名 APPX..."
    if [ -f "build/CloudZilla.pfx" ]; then
        powershell.exe -ExecutionPolicy Bypass -File sign-appx.ps1
        echo "✅ APPX 簽名完成"
    else
        echo "⚠ 警告: 找不到證書檔案，跳過簽名"
    fi

    # 打包 APPX 安裝包
    echo ""
    echo "建立 APPX 安裝包..."
    rm -rf dist-appx 2>/dev/null || true
    mkdir -p dist-appx
    cp packages/gui/out/make/appx/*.appx dist-appx/
    cp build/CloudZilla.pfx dist-appx/
    cp test-install-appx.ps1 dist-appx/
    cp APPX-README.txt dist-appx/README.txt
    echo "✅ APPX 安裝包已建立於 dist-appx/"
else
    echo "步驟 4/4: 跳過 APPX 打包（使用 --appx 啟用）"
fi
echo ""

echo "========================================"
echo "✅ 打包完成！"
echo "========================================"

# 顯示輸出檔案
echo ""
echo "📦 輸出檔案:"

if [ "$ONLY_PACKAGE" = true ]; then
    ls -lhd packages/gui/out/*-win32-* 2>/dev/null || echo "（找不到輸出目錄）"
else
    if [ -d "packages/gui/out/make/squirrel.windows" ]; then
        ls -lh packages/gui/out/make/squirrel.windows/x64/*.exe 2>/dev/null || true
    fi
    if [ -d "packages/gui/out/make/zip/win32/x64" ]; then
        ls -lh packages/gui/out/make/zip/win32/x64/*.zip 2>/dev/null || true
    fi
    if [ -d "packages/gui/out/make/appx" ]; then
        ls -lh packages/gui/out/make/appx/*.appx 2>/dev/null || true
    fi
fi

echo ""
echo "📍 輸出位置: packages/gui/out/make/"

# 顯示 APPX 安裝包
if [ -d "dist-appx" ]; then
    echo ""
    echo "📦 APPX 安裝包 (可直接複製到其他電腦):"
    ls -lh dist-appx/
    echo ""
    echo "📍 APPX 安裝包位置: dist-appx/"
    echo "   在目標電腦以系統管理員執行: powershell -ExecutionPolicy Bypass -File test-install-appx.ps1"
fi

echo ""
echo "========================================"
