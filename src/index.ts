import * as dotenv from 'dotenv';
import Spoticord from './services/spoticord';

const _env = dotenv.config().parsed;

console.debug = (...data: any[]) => {
    if (process.env.NODE_ENV !== 'development') return;
    console.log(`[DEBUG]`, ...data);
}

if (process.env.NODE_ENV === 'development') {
    Object.keys(_env).forEach((k) => {
        console.debug(`[ENV] ${k}=${_env[k]}`);
    })
}

Spoticord.initialize();

process.on('SIGINT', () => {
    console.log('[SIGINT] Shutting down...');
    Spoticord.destroy();
    process.exit();
});