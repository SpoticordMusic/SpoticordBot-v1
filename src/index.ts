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

// const conf = new ConfigManager();

// if (conf.getDirty()) {
//     console.error("[FATAL] A dirty (or nonexistant) config.json file was found, please generate a new one");
//     assert(false, conf.getDirty());
// }

// const dbConfig = conf.get('database');

// const client = new Discord.Client({ intents: [
//     Discord.Intents.FLAGS.GUILDS,
//     Discord.Intents.FLAGS.GUILD_MESSAGES,
//     Discord.Intents.FLAGS.GUILD_VOICE_STATES
// ] });

// const dbEngine: DB = dbConfig.strategy === 'mongo' ? new MongoPoweredDB(`mongodb://${dbConfig.username}:${encodeURIComponent(dbConfig.password)}@${dbConfig.host}:${dbConfig.port}/`, dbConfig.db) : new JSONPoweredDB(dbConfig.filename);
// const cmdEmitter = new CommandEmitter(conf, dbEngine);
// const musicService = new MusicPlayerService(conf, client, dbEngine);
// const linkerService = new LinkerService();

// client.on('ready', async () => {

//     await registerSlashCommands(conf, client);

//     await client.user.setActivity({
//         name: 'Spotify songs 🤪'
//     });

//     // Add command handlers

//     const core = new CoreCommands(musicService);
//     cmdEmitter.addCommandHandler('link', core.link);
//     cmdEmitter.addCommandHandler('unlink', core.unlink);
//     cmdEmitter.addCommandHandler('rename', core.rename, 'name');
//     cmdEmitter.addCommandHandler('help', core.help, 'h');

//     const music = new MusicCommands(musicService);
//     cmdEmitter.addCommandHandler('join', music.join);
//     cmdEmitter.addCommandHandler('leave', music.leave, 'dc', 'kick', 'disconnect');
//     cmdEmitter.addCommandHandler('playing', music.playing, 'nowplaying', 'np');
//     cmdEmitter.addCommandHandler('24/7', music.stay, 'stay');
//     music.attachButtonHandlers(client);

//     console.log(`[INFO] Discord ready, starting Lavalink initialization...`);

//     const nodes = conf.get('nodes');

//     const manager = new Manager({
//         nodes,
//         send(id, payload) {
//             const guild = client.guilds.cache.get(id);
//             guild && guild.shard.send(payload);
//         },
//         plugins: [
//             new SpotifyPlugin({
//                 clientID: conf.get('spotify_client_id'),
//                 clientSecret: conf.get('spotify_client_secret')
//             })
//         ],
//         shards: 1
//     });

//     manager.init(client.user.id);

//     console.log(`[INFO] Lavalink initialized, starting Spotify initialization...`);

//     client.on('raw', d => manager.updateVoiceState(d));

//     // I have not yet figured out a way to validate the client id and client secret without 
//     //  performing an oauth authorization grant, so this function won't check if these parameters are valid
//     musicService.initialize(manager);
//     SpotifyWebHelper.init(dbEngine, conf.get('spotify_client_id'), conf.get('spotify_client_secret'));

//     if (conf.get('realtime')) {
//         console.log('[INFO] Spotify initialized, starting Realtime initialization...');
//         SpoticordRealtime.startRealtimeService(conf.get('realtime').port, conf.get('realtime').host, client, musicService);
//     }

//     console.log(`[INFO] Initialization completed`);
// });

// client.on('guildCreate', (guild) => {
//     console.log(`[INFO] Joined guild "${guild.name}"`);
// });

// client.on('guildDelete', (guild) => {
//     console.log(`[INFO] Left guild "${guild.name}"`);
// });

// client.on('error', (error) => {
//     console.error('[DISCORD ERROR]');
//     console.error(error);
// });

// client.on('message', (msg) => {
//     if (!msg.guild) return;
//     if (!msg.content.startsWith(conf.get('prefix'))) return;

//     const args = msg.content.substr(1).split(' ');
//     const cmd = args.shift().toLowerCase();

//     console.debug(`[CMD] ${cmd} -> ${args.map(a => `"${a}"`).join(' ')}`)

//     cmdEmitter.emit(cmd, args, msg);
// });

process.on('SIGINT', () => {
    console.log('[SIGINT] Shutting down...');
    Spoticord.destroy();
    process.exit();
});