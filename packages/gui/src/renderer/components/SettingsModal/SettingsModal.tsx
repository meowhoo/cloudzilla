import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../../i18n';
import { X, Settings, Wifi, HelpCircle, Shield } from 'lucide-react';
import { SystemTab } from './tabs/SystemTab';
import { NetworkTab } from './tabs/NetworkTab';
import { FAQTab } from './tabs/FAQTab';
import { PrivacyTab } from './tabs/PrivacyTab';
import './SettingsModal.css';

export type SettingsTab = 'system' | 'network' | 'faq' | 'privacy';

export interface AppSettings {
    theme: 'light' | 'dark' | 'system';
    language: 'en-US' | 'zh-TW';
    showHiddenFiles: boolean;
    maxConcurrentTransfers: number;
    bandwidthLimitKBps: number;
    autoRetry: boolean;
    retryAttempts: number;
}

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: SettingsTab;
}

const defaultSettings: AppSettings = {
    theme: 'system',
    language: 'zh-TW',
    showHiddenFiles: false,
    maxConcurrentTransfers: 2,
    bandwidthLimitKBps: 0,
    autoRetry: true,
    retryAttempts: 3,
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    initialTab = 'system',
}) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
    const [settings, setSettings] = useState<AppSettings>(defaultSettings);
    const [isDirty, setIsDirty] = useState(false);

    // Load settings on mount
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const config = await (window as any).electronAPI.config.load();
                setSettings({
                    theme: config.theme || 'system',
                    language: config.language || 'zh-TW',
                    showHiddenFiles: config.showHiddenFiles || false,
                    maxConcurrentTransfers: config.maxConcurrentTransfers || 4,
                    bandwidthLimitKBps: config.bandwidthLimitKBps || 0,
                    autoRetry: config.autoRetry !== false,
                    retryAttempts: config.retryAttempts || 3,
                });
            } catch (error) {
                console.error('Failed to load settings:', error);
            }
        };
        if (isOpen) {
            loadSettings();
            setIsDirty(false);
        }
    }, [isOpen]);

    // Reset to initial tab when modal opens
    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab);
        }
    }, [isOpen, initialTab]);

    const handleSettingChange = <K extends keyof AppSettings>(
        key: K,
        value: AppSettings[K]
    ) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        setIsDirty(true);
    };

    const handleSave = async () => {
        try {
            // Apply theme change (triggers broadcast to all windows)
            await (window as any).electronAPI.theme.save(settings.theme);
            // Apply language change immediately
            await i18n.changeLanguage(settings.language);
            // Save all settings to config
            await (window as any).electronAPI.config.save(settings);
            setIsDirty(false);
            onClose();
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    };

    const handleCancel = () => {
        onClose();
    };

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    };

    if (!isOpen) return null;

    const tabs: { id: SettingsTab; icon: React.ReactNode; labelKey: string }[] = [
        { id: 'system', icon: <Settings size={16} />, labelKey: 'settings.tabs.system' },
        { id: 'network', icon: <Wifi size={16} />, labelKey: 'settings.tabs.network' },
        { id: 'faq', icon: <HelpCircle size={16} />, labelKey: 'settings.tabs.faq' },
        { id: 'privacy', icon: <Shield size={16} />, labelKey: 'settings.tabs.privacy' },
    ];

    const showFooter = activeTab === 'system' || activeTab === 'network';

    return (
        <div
            className="settings-modal-overlay"
            onClick={handleOverlayClick}
            onKeyDown={handleKeyDown}
            tabIndex={-1}
        >
            <div className="settings-modal-window">
                {/* Header */}
                <div className="settings-modal__header">
                    <h2>{t('settings.title')}</h2>
                    <button className="settings-modal__close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="settings-modal__body">
                    {/* Sidebar */}
                    <nav className="settings-sidebar">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                className={`settings-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                <span className="nav-icon">{tab.icon}</span>
                                <span className="nav-text">{t(tab.labelKey)}</span>
                            </button>
                        ))}
                    </nav>

                    {/* Content */}
                    <div className="settings-content">
                        {activeTab === 'system' && (
                            <SystemTab
                                settings={settings}
                                onChange={handleSettingChange}
                            />
                        )}
                        {activeTab === 'network' && (
                            <NetworkTab
                                settings={settings}
                                onChange={handleSettingChange}
                            />
                        )}
                        {activeTab === 'faq' && <FAQTab />}
                        {activeTab === 'privacy' && <PrivacyTab />}
                    </div>
                </div>

                {/* Footer - only for system/network tabs */}
                {showFooter && (
                    <div className="settings-modal__footer">
                        <button className="btn-secondary" onClick={handleCancel}>
                            {t('common.cancel')}
                        </button>
                        <button className="btn-primary" onClick={handleSave}>
                            {t('common.save')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
