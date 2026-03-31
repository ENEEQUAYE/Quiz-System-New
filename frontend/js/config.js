// Auto environment configuration.
// Priority:
// 1) ?apiBaseUrl=<url> query param (saved to localStorage)
// 2) localStorage.API_BASE_URL
// 3) Local hosts/file protocol -> localhost backend
// 4) Deployed hosts -> Vercel backend

const LOCAL_API_URL = 'http://localhost:5000/api';
const LOCAL_WS_URL = 'ws://localhost:5000';
const DEPLOYED_API_URL = 'https://cesstigsms.vercel.app/api';
const DEPLOYED_WS_URL = 'wss://cesstigsms.vercel.app';

function normalizeBaseUrl(url) {
    if (!url || typeof url !== 'string') return null;
    return url.endsWith('/') ? url.slice(0, -1) : url;
}

function readApiOverride() {
    try {
        const params = new URLSearchParams(window.location.search);
        const queryOverride = normalizeBaseUrl(params.get('apiBaseUrl'));

        if (queryOverride) {
            localStorage.setItem('API_BASE_URL', queryOverride);
            return queryOverride;
        }

        return normalizeBaseUrl(localStorage.getItem('API_BASE_URL'));
    } catch (error) {
        return null;
    }
}

function detectEnvironment() {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;

    const isLocalhost =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1';

    const isFileProtocol = protocol === 'file:';

    return isLocalhost || isFileProtocol ? 'development' : 'production';
}

function toWsUrl(apiBaseUrl) {
    if (!apiBaseUrl) return null;

    const origin = apiBaseUrl.replace(/\/api$/, '');

    if (origin.startsWith('https://')) {
        return origin.replace('https://', 'wss://');
    }

    if (origin.startsWith('http://')) {
        return origin.replace('http://', 'ws://');
    }

    return null;
}

const ENVIRONMENT = detectEnvironment();
const overrideApiUrl = readApiOverride();

const API_URL = overrideApiUrl || (ENVIRONMENT === 'development' ? LOCAL_API_URL : DEPLOYED_API_URL);
const WS_URL = toWsUrl(API_URL) || (ENVIRONMENT === 'development' ? LOCAL_WS_URL : DEPLOYED_WS_URL);

window.API_URL = API_URL;
window.WS_URL = WS_URL;

console.log('Running in ' + ENVIRONMENT + ' mode');
console.log('API URL: ' + API_URL);
