import * as dotenv from 'dotenv';
import * as Discord from 'discord.js';
import assert from 'assert';
import { Node } from 'lavalink';

import * as CommandHandler from './command';
import { CommandEmitter } from './command/emitter';
import { DB } from './db';
import MongoPoweredDB from './db/mongo';
import JSONPoweredDB from './db/json';

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

assert(!!process.env.TOKEN, "A token must be provided");
assert(!!process.env.PREFIX, "A prefix must be provided")

const client = new Discord.Client();
const cmdEmitter = new CommandEmitter();
const dbEngine: DB = process.env.DB_ENGINE === 'MONGO' ? new MongoPoweredDB() : new JSONPoweredDB();

CommandHandler.Initialize(cmdEmitter, dbEngine);

client.on('ready', () => {
    console.log(`[INFO] Discord ready, starting Lavalink initialization...`);

    const voice = new Node({
        password: '123',
        userID: process.env.DC_BOT_ID,
        send: (guildID, packet) {
            client.guilds.cache.has(guildID) && client.ws.
        }
    })
});

client.on('guildCreate', (guild) => {
    console.log(`[INFO] Joined guild "${guild.name}"`);
});

client.on('guildDelete', (guild) => {
    console.log(`[INFO] Left guild "${guild.name}"`);
});

client.on('message', (msg) => {
    if (!msg.guild) return;
    if (!msg.content.startsWith(process.env.PREFIX)) return;

    const args = msg.content.substr(1).split(' ');
    const cmd = args.shift();

    console.debug(`[CMD] ${cmd} -> ${args.map(a => `"${a}"`).join(' ')}`)

    cmdEmitter.emit(cmd, args, msg);
});

dbEngine.initialize().then((success) => {
    if (!success) {
        console.error(`[FATAL] DB Initialization failed`);
        process.exit(-1);
    }

    console.log(`[INFO] Database initialized, starting Discord initialization...`);

    client.login(process.env.TOKEN);
});