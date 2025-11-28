import { createRoot } from 'react-dom/client';
import App from './renderer/app';
import './renderer/index.css';
import { ErrorBoundary } from './renderer/components/ErrorBoundary';
import './i18n'; // Initialize i18n

const container = document.getElementById('root');

const root = createRoot(container!);
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
