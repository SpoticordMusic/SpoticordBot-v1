import { Client, MessageEmbed, TextChannel, User, VoiceChannel, VoiceState } from "discord.js";
import ConfigManager from "../config";
import { DB } from "../db";
import { LavaManager, LavaTrackInfo } from "./lava";
import { SpotifyPlayer } from "./spotify/player";
import { Track } from "./spotify/state";
import { SpotifyUser } from "./spotify/user";

type MusicPlayerState = 'DISCONNECTED' | 'INACTIVE' | 'PAUSED' | 'PLAYING';
type UserState = 'INACTIVE' | 'ACTIVE';

export default class MusicPlayerService {
    private spotify_client_id: string;
    private spotify_client_secret: string;

    private manager: LavaManager;

    private players: Map<string, SpotifyPlayer> = new Map<string, SpotifyPlayer>();
    private users: Map<string, SpotifyUser> = new Map<string, SpotifyUser>();
    private update_ignore: Map<string, boolean> = new Map<string, boolean>();

    constructor(config: ConfigManager, private client: Client, private db: DB) {
        this.spotify_client_id = config.get('spotify_client_id');
        this.spotify_client_secret = config.get('spotify_client_secret');
    
        this.onVoiceStateUpdate = this.onVoiceStateUpdate.bind(this);
    }

    public initialize(manager: LavaManager) {
        this.client.on('voiceStateUpdate', this.onVoiceStateUpdate);

        this.manager = manager;
    }

    protected async onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
        if (oldState.id === this.client.user.id) {
            if (this.update_ignore.has(oldState.guild.id) && this.update_ignore.get(oldState.guild.id)) {
                this.update_ignore.set(oldState.guild.id, false);
                return;
            }

            if (oldState.channelID && !newState.channelID) {
                // Bot LEFT voice channel
                if (this.players.has(oldState.guild.id)) {
                    await this.players.get(oldState.guild.id).leave();

                    this.players.delete(oldState.guild.id);
                }
            } else if (oldState.channelID && newState.channelID && oldState.channelID !== newState.channelID) {
                // Bot MOVED voice channel
                
                await this.players.get(newState.guild.id).updateChannel(newState.channel);
            }

            return;
        }

        if (this.players.has(oldState.guild.id)) { // Old state was in a guild where music is playing
            const player = this.players.get(oldState.guild.id);

            if (player.voice_channel.id === oldState.channelID && player.voice_channel.id !== newState.channelID) { // User got out of channel with bot
                player.userLeft(oldState.id);
            }
        }

        if (this.players.has(newState.guild.id)) {
            const player = this.players.get(newState.guild.id);

            if (player.voice_channel.id === newState.channelID && player.voice_channel.id !== oldState.channelID) {
                await player.userJoined(newState.id);
            }
        }
    }

    public getLavaManager(): LavaManager {
        return this.manager;
    }

    public getPlayerState(guild_id: string): MusicPlayerState {
        if (!this.players.has(guild_id)) return 'DISCONNECTED';
        
        return 'PLAYING';
    }

    public getPlayerChannel(guild_id: string): VoiceChannel | null {
        if (!this.players.has(guild_id)) return null;

        return this.players.get(guild_id).voice_channel;
    }

    public getPlayerHost(guild_id: string): SpotifyUser | null {
        if (!this.players.has(guild_id)) return null;

        return this.players.get(guild_id).getHost();
    }

    public getUserState(user_id: string): UserState {
        return this.users.has(user_id) ? 'ACTIVE' : 'INACTIVE';
    }

    public toggle247(guild_id: string): boolean {
        if (!this.players.has(guild_id)) return false;

        const player = this.players.get(guild_id);
        return player.toggle247();
    }

    public async playerUserJoin(guild_id: string, user_id: string) {
        if (!this.players.has(guild_id)) return;

        const player = this.players.get(guild_id);
        await player.userJoined(user_id);
    }

    public createUser(user_id: string): SpotifyUser {
        if (this.users.has(user_id)) return this.users.get(user_id);

        const spotifyUser = new SpotifyUser(user_id, this.db, this.spotify_client_id, this.spotify_client_secret);
    
        this.users.set(user_id, spotifyUser);

        return spotifyUser;
    }

    public destroyUser(user_id: string) {
        if (!this.users.has(user_id)) return;

        const user = this.users.get(user_id);

        user.destroy();

        this.users.delete(user_id);
    }

    public async joinChannel(guild_id: string, voice_channel: VoiceChannel, text_channel: TextChannel): Promise<SpotifyPlayer> {
        if (this.players.has(guild_id)) return this.players.get(guild_id);

        const player = new SpotifyPlayer(guild_id, voice_channel, text_channel, this.client, this, this.db);

        await player.join();

        this.players.set(guild_id, player);

        return player;
    }

    public async leaveGuild(guild_id: string, afk: boolean = false) {
        if (!this.players.has(guild_id)) return;

        // Prevent race condition with the onVoiceStateUpdate cb
        this.update_ignore.set(guild_id, true);

        const player = this.players.get(guild_id);
        await player.leave();

        this.players.delete(guild_id);

        if (afk) {
            try {
                await player.text_channel.send(new MessageEmbed({
                    description: 'I left the voice channel because of inactivity',
                    author: {name: 'Left voice channel'},
                    color: '#d61516'
                }));
            } catch (ex) {}
        }
    }

    public getTrackInfo(guild_id: string): [Track, LavaTrackInfo] | null {
        if (!this.players.has(guild_id)) return null;

        const player = this.players.get(guild_id);
        return player.getTrackInfo();
    }

    public getDiscordUser(discord_id: string): User | null {
        return this.client.users.cache.get(discord_id)
    }
}