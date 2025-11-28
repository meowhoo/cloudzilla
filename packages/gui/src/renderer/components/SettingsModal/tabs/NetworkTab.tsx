import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppSettings } from '../SettingsModal';

interface NetworkTabProps {
    settings: AppSettings;
    onChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

export const NetworkTab: React.FC<NetworkTabProps> = ({ settings, onChange }) => {
    const { t } = useTranslation();

    return (
        <div className="settings-tab">
            <h3 className="settings-section-title">{t('settings.network.title')}</h3>

            {/* Hint: Settings apply to new tasks */}
            <div className="settings-hint">
                {t('settings.network.applyToNewTasks')}
            </div>

            {/* Max Concurrent Transfers */}
            <div className="settings-item">
                <div className="settings-item__label">
                    <span className="settings-item__title">{t('settings.network.maxTransfers')}</span>
                    <span className="settings-item__subtitle">{t('settings.network.maxTransfersDesc')}</span>
                </div>
                <input
                    type="number"
                    className="settings-input"
                    value={settings.maxConcurrentTransfers}
                    min={1}
                    max={4}
                    onChange={(e) => onChange('maxConcurrentTransfers', parseInt(e.target.value) || 2)}
                />
            </div>

            {/* Bandwidth Limit */}
            <div className="settings-item">
                <div className="settings-item__label">
                    <span className="settings-item__title">{t('settings.network.bandwidthLimit')}</span>
                    <span className="settings-item__subtitle">{t('settings.network.bandwidthLimitDesc')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                        type="number"
                        className="settings-input"
                        value={settings.bandwidthLimitKBps}
                        min={0}
                        onChange={(e) => onChange('bandwidthLimitKBps', parseInt(e.target.value) || 0)}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>KB/s</span>
                </div>
            </div>

            {/* Auto Retry */}
            <div className="settings-item">
                <div className="settings-item__label">
                    <span className="settings-item__title">{t('settings.network.autoRetry')}</span>
                    <span className="settings-item__subtitle">{t('settings.network.autoRetryDesc')}</span>
                </div>
                <button
                    className={`settings-toggle ${settings.autoRetry ? 'active' : ''}`}
                    onClick={() => onChange('autoRetry', !settings.autoRetry)}
                    aria-pressed={settings.autoRetry}
                />
            </div>

            {/* Retry Attempts */}
            {settings.autoRetry && (
                <div className="settings-item">
                    <div className="settings-item__label">
                        <span className="settings-item__title">{t('settings.network.retryAttempts')}</span>
                        <span className="settings-item__subtitle">{t('settings.network.retryAttemptsDesc')}</span>
                    </div>
                    <input
                        type="number"
                        className="settings-input"
                        value={settings.retryAttempts}
                        min={1}
                        max={10}
                        onChange={(e) => onChange('retryAttempts', parseInt(e.target.value) || 3)}
                    />
                </div>
            )}
        </div>
    );
};
