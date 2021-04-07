import * as dotenv from 'dotenv';
import * as Discord from 'discord.js';
import assert from 'assert';
import { PlayerManager } from 'discord.js-lavalink';

import * as CommandHandler from './command';
import { CommandEmitter } from './command/emitter';
import { DB } from './db';
//import MongoPoweredDB from './db/mongo';
import JSONPoweredDB from './db/json';
import { LavaManager } from './services/lava';
import ConfigManager from './config';
import SpotifyService from './services/spotify';
import LinkerService from './services/linker';

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

const conf = new ConfigManager();

if (conf.getDirty()) {
    console.error("[FATAL] A dirty (or nonexistant) config.json file was found, please generate a new one");
    assert(false, conf.getDirty());
}

const client = new Discord.Client();
const cmdEmitter = new CommandEmitter();
const dbEngine: DB = new JSONPoweredDB();
const spotifyEngine = new SpotifyService(conf, client);
const linkerService = new LinkerService();

CommandHandler.Initialize(conf, cmdEmitter, dbEngine);

client.on('ready', async () => {
    console.log(`[INFO] Discord ready, starting Lavalink initialization...`);

    const nodes = [{ host: 'localhost', port: 2333, password: '12345' }];

    const manager = new LavaManager(client, nodes, {
        user: client.user.id,
        shards: 1
    });

    let lavaReady = false;

    manager.on('ready', () => {
        lavaReady = true;

    
        console.log(`[INFO] Lavalink initialized, starting Spotify initialization...`);

        // I have not yet figured out a way to validate the client id and client secret without 
        //  performing a oauth authorization grant, so this function won't check if these parameters are valid
        spotifyEngine.initialize(manager);
    });

    manager.on('error', (e) => {
        if (!lavaReady) {
            console.error(`[FATAL] Lavalink Initialization failed`);
            
            client.destroy();
            process.exit(-1);
        }

        console.error('Lavalink error: ', e);
    });
});

client.on('guildCreate', (guild) => {
    console.log(`[INFO] Joined guild "${guild.name}"`);
});

client.on('guildDelete', (guild) => {
    console.log(`[INFO] Left guild "${guild.name}"`);
});

client.on('message', (msg) => {
    if (!msg.guild) return;
    if (!msg.content.startsWith(conf.get('prefix'))) return;

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

    console.log(`[INFO] Database initialized, starting Linking service...`);

    linkerService.initialize(conf, dbEngine).then((success) => {
        if (!success) {
            console.error(`[FATAL] Linking service initialization failed`);
            process.exit(-1);
        }

        console.log(`[INFO] Linker service initialized, starting Discord initialization...`);

        client.login(conf.get('token'));
    });
});