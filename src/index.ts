import * as dotenv from 'dotenv';
import * as Discord from 'discord.js';
import assert from 'assert';

import { CommandEmitter } from './command/emitter';
import CoreCommands from './command/core';
import MusicCommands from './command/music';
import { DB } from './db';
import MongoPoweredDB from './db/mongo';
import JSONPoweredDB from './db/json';
import { LavaManager } from './services/lava';
import ConfigManager from './config';
import MusicPlayerService from './services/music';
import LinkerService from './services/linker';
import { SpotifyWebHelper } from './services/spotify/user';
import SpoticordRealtime from './services/realtime';
import disbut from 'discord.js-buttons';

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

const dbConfig = conf.get('database');

const client = new Discord.Client();
const dbEngine: DB = dbConfig.strategy === 'mongo' ? new MongoPoweredDB(`mongodb://${dbConfig.username}:${encodeURIComponent(dbConfig.password)}@${dbConfig.host}:${dbConfig.port}/`, dbConfig.db) : new JSONPoweredDB(dbConfig.filename);
const cmdEmitter = new CommandEmitter(conf, dbEngine);
const musicService = new MusicPlayerService(conf, client, dbEngine);
const linkerService = new LinkerService();

disbut(client);

client.on('ready', async () => {

    await client.user.setActivity({
        name: 'Spotify songs 🤪'
    });

    // Add command handlers

    const core = new CoreCommands(musicService);
    cmdEmitter.addCommandHandler('link', core.link);
    cmdEmitter.addCommandHandler('unlink', core.unlink);
    cmdEmitter.addCommandHandler('rename', core.rename, 'name');
    cmdEmitter.addCommandHandler('help', core.help, 'h');

    const music = new MusicCommands(musicService);
    cmdEmitter.addCommandHandler('join', music.join);
    cmdEmitter.addCommandHandler('leave', music.leave, 'dc', 'kick', 'disconnect');
    cmdEmitter.addCommandHandler('playing', music.playing, 'nowplaying', 'np');
    cmdEmitter.addCommandHandler('24/7', music.stay, 'stay');
    music.attachButtonHandlers(client);

    console.log(`[INFO] Discord ready, starting Lavalink initialization...`);

    const nodes = conf.get('nodes');

    const manager = new LavaManager(client, nodes, {
        user: client.user.id,
        shards: 1
    });

    let lavaReady = false;

    manager.on('error', (e) => {
        if (!lavaReady) {
            console.error(`[FATAL] Lavalink Initialization failed`);
            
            client.destroy();
            process.exit(-1);
        }

        console.error('Lavalink error: ', e);
    });

    await manager.connect();

    lavaReady = true;

    console.log(`[INFO] Lavalink initialized, starting Spotify initialization...`);

    // I have not yet figured out a way to validate the client id and client secret without 
    //  performing an oauth authorization grant, so this function won't check if these parameters are valid
    musicService.initialize(manager);
    SpotifyWebHelper.init(dbEngine, conf.get('spotify_client_id'), conf.get('spotify_client_secret'));

    if (conf.get('realtime')) {
        console.log('[INFO] Spotify initialized, starting Realtime initialization...');
        SpoticordRealtime.startRealtimeService(conf.get('realtime').port, conf.get('realtime').host, client, musicService);
    }

    console.log(`[INFO] Initialization completed`);
});

client.on('guildCreate', (guild) => {
    console.log(`[INFO] Joined guild "${guild.name}"`);
});

client.on('guildDelete', (guild) => {
    console.log(`[INFO] Left guild "${guild.name}"`);
});

client.on('error', (error) => {
    console.error('[DISCORD ERROR]');
    console.error(error);
});

client.on('message', (msg) => {
    if (!msg.guild) return;
    if (!msg.content.startsWith(conf.get('prefix'))) return;

    const args = msg.content.substr(1).split(' ');
    const cmd = args.shift().toLowerCase();

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

process.on('SIGINT', () => {
    console.log('[SIGINT] Shutting down...');
    client.destroy();
    process.exit();
});