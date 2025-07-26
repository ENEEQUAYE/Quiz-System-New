// Environment Configuration
// Change this to switch between local development and production

const ENVIRONMENT = 'production'; // Change to 'development' for local testing

const CONFIG = {
    development: {
        API_URL: 'http://localhost:5000/api',
        WS_URL: 'ws://localhost:5000'
    },
    production: {
        API_URL: 'https://quiz-system-new.onrender.com/api',
        WS_URL: 'wss://quiz-system-new.onrender.com'
    }
};

// Export the current environment's configuration
const API_URL = CONFIG[ENVIRONMENT].API_URL;
const WS_URL = CONFIG[ENVIRONMENT].WS_URL;

console.log(`Running in ${ENVIRONMENT} mode`);
console.log(`API URL: ${API_URL}`);
