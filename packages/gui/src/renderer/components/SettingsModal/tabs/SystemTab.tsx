import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppSettings } from '../SettingsModal';

interface SystemTabProps {
    settings: AppSettings;
    onChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

export const SystemTab: React.FC<SystemTabProps> = ({ settings, onChange }) => {
    const { t } = useTranslation();

    return (
        <div className="settings-tab">
            <h3 className="settings-section-title">{t('settings.system.title')}</h3>

            {/* Theme */}
            <div className="settings-item">
                <div className="settings-item__label">
                    <span className="settings-item__title">{t('settings.system.theme')}</span>
                    <span className="settings-item__subtitle">{t('settings.system.themeDesc')}</span>
                </div>
                <select
                    className="settings-select"
                    value={settings.theme}
                    onChange={(e) => onChange('theme', e.target.value as AppSettings['theme'])}
                >
                    <option value="system">{t('settings.system.themeSystem')}</option>
                    <option value="light">{t('settings.system.themeLight')}</option>
                    <option value="dark">{t('settings.system.themeDark')}</option>
                </select>
            </div>

            {/* Language */}
            <div className="settings-item">
                <div className="settings-item__label">
                    <span className="settings-item__title">{t('settings.system.language')}</span>
                    <span className="settings-item__subtitle">{t('settings.system.languageDesc')}</span>
                </div>
                <select
                    className="settings-select"
                    value={settings.language}
                    onChange={(e) => onChange('language', e.target.value as AppSettings['language'])}
                >
                    <option value="zh-TW">繁體中文</option>
                    <option value="en-US">English</option>
                </select>
            </div>

            {/* Show Hidden Files */}
            <div className="settings-item">
                <div className="settings-item__label">
                    <span className="settings-item__title">{t('settings.system.showHiddenFiles')}</span>
                    <span className="settings-item__subtitle">{t('settings.system.showHiddenFilesDesc')}</span>
                </div>
                <button
                    className={`settings-toggle ${settings.showHiddenFiles ? 'active' : ''}`}
                    onClick={() => onChange('showHiddenFiles', !settings.showHiddenFiles)}
                    aria-pressed={settings.showHiddenFiles}
                />
            </div>
        </div>
    );
};
