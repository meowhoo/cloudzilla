import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files
import enCommon from './locales/en-US/common.json';
import enSettings from './locales/en-US/settings.json';
import zhTWCommon from './locales/zh-TW/common.json';
import zhTWSettings from './locales/zh-TW/settings.json';

const resources = {
    'en-US': {
        common: enCommon,
        settings: enSettings,
    },
    'zh-TW': {
        common: zhTWCommon,
        settings: zhTWSettings,
    },
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: 'en-US', // Default language (will be overridden by config)
        fallbackLng: 'en-US',
        defaultNS: 'common',
        ns: ['common', 'settings'],
        interpolation: {
            escapeValue: false, // React already handles XSS
        },
    });

export default i18n;
