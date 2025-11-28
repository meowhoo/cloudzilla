/**
 * SweetAlert2 封裝 - Feature007
 * 提供統一的 Alert/Confirm/Toast API，整合 Theme 系統
 */

import Swal, { SweetAlertIcon } from 'sweetalert2';

// Toast 實例（右上角顯示）
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: false,
    backdrop: false,
    // Prevent backdrop flash
    showClass: {
        backdrop: 'swal2-noanimation',
    },
    hideClass: {
        backdrop: 'swal2-noanimation',
    },
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
    },
});

/**
 * 取得當前主題配置
 */
function getThemeConfig() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
        background: 'var(--color-surface)',
        color: 'var(--color-fg)',
        customClass: {
            popup: isDark ? 'swal-dark' : 'swal-light',
            confirmButton: 'swal-btn-primary',
            cancelButton: 'swal-btn-secondary',
            denyButton: 'swal-btn-danger',
        },
    };
}

/**
 * 確認對話框
 */
export async function showConfirm(options: {
    title: string;
    text?: string;
    confirmText?: string;
    cancelText?: string;
    icon?: SweetAlertIcon;
    isDanger?: boolean;
}): Promise<boolean> {
    const themeConfig = getThemeConfig();

    const result = await Swal.fire({
        title: options.title,
        text: options.text,
        icon: options.icon || 'question',
        showCancelButton: true,
        confirmButtonText: options.confirmText || '確定',
        cancelButtonText: options.cancelText || '取消',
        reverseButtons: true,
        focusCancel: options.isDanger,
        ...themeConfig,
        customClass: {
            ...themeConfig.customClass,
            confirmButton: options.isDanger ? 'swal-btn-danger' : 'swal-btn-primary',
        },
    });

    return result.isConfirmed;
}

/**
 * 輸入對話框
 */
export async function showPrompt(options: {
    title: string;
    inputPlaceholder?: string;
    inputValue?: string;
    confirmText?: string;
    cancelText?: string;
    inputValidator?: (value: string) => string | null;
}): Promise<string | null> {
    const themeConfig = getThemeConfig();

    const result = await Swal.fire({
        title: options.title,
        input: 'text',
        inputPlaceholder: options.inputPlaceholder,
        inputValue: options.inputValue || '',
        showCancelButton: true,
        confirmButtonText: options.confirmText || '確定',
        cancelButtonText: options.cancelText || '取消',
        reverseButtons: true,
        inputValidator: options.inputValidator,
        ...themeConfig,
    });

    return result.isConfirmed ? result.value : null;
}

/**
 * Toast 通知
 */
export function showToast(
    type: 'success' | 'error' | 'warning' | 'info',
    message: string,
    duration?: number
): void {
    const themeConfig = getThemeConfig();

    Toast.fire({
        icon: type,
        title: message,
        timer: duration || 3000,
        background: themeConfig.background,
        color: themeConfig.color,
        customClass: {
            popup: themeConfig.customClass.popup,
        },
    });
}

/**
 * 訊息對話框（僅確定按鈕）
 */
export async function showAlert(options: {
    title: string;
    text?: string;
    icon?: SweetAlertIcon;
    confirmText?: string;
}): Promise<void> {
    const themeConfig = getThemeConfig();

    await Swal.fire({
        title: options.title,
        text: options.text,
        icon: options.icon || 'info',
        confirmButtonText: options.confirmText || '確定',
        ...themeConfig,
    });
}
