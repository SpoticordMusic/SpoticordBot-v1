import { Client, VoiceState } from "discord.js";
import ConfigManager from "../config";
import { DB } from "../db";
import { LavaManager } from "./lava";
import { SpotifyPlayer } from "./spotify/player";
import { SpotifyUser } from "./spotify/user";

type MusicPlayerState = 'DISCONNECTED' | 'INACTIVE' | 'PAUSED' | 'PLAYING';
type UserState = 'INACTIVE' | 'ACTIVE';

export default class MusicPlayerService {
    private spotify_client_id: string;
    private spotify_client_secret: string;

    private manager: LavaManager;

    private players: Map<string, SpotifyPlayer> = new Map<string, SpotifyPlayer>();
    private users: Map<string, SpotifyUser> = new Map<string, SpotifyUser>();

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
            if (oldState.channelID && !newState.channelID) {
                // Bot LEFT voice channel
                if (this.players.has(oldState.guild.id)) {
                    await this.players.get(oldState.guild.id).leave();

                    this.players.delete(oldState.guild.id);
                }
            } else if (!oldState.channelID && newState.channelID) {
                // Bot JOINED voice channel
                if (!this.players.has(oldState.guild.id)) {
                    const player = new SpotifyPlayer(newState.guild.id, newState.channelID, this.client, this, this.db);

                    this.players.set(newState.guild.id, player);

                    await player.join();
                }
            } else if (oldState.channelID && newState.channelID && oldState.channelID !== newState.channelID) {
                // Bot MOVED voice channel
                if (!this.players.has(oldState.guild.id)) {
                    const player = new SpotifyPlayer(newState.guild.id, newState.channelID, this.client, this, this.db);

                    this.players.set(newState.guild.id, player);

                    await player.join();
                } else {
                    this.players.get(newState.guild.id).updateChannel(newState.channelID);
                }
            }

            return;
        }

        if (this.players.has(oldState.guild.id)) { // Old state was in a guild where music is playing
            const player = this.players.get(oldState.guild.id);

            if (player.channel_id === oldState.channelID) { // User got out of channel with bot
                player.userLeft(oldState.id);
            }
        }

        if (this.players.has(newState.guild.id)) {
            const player = this.players.get(newState.guild.id);

            if (player.channel_id === newState.channelID) {
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

    public getUserState(user_id: string): UserState {
        return this.users.has(user_id) ? 'ACTIVE' : 'INACTIVE';
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

    public async joinChannel(guild_id: string, channel_id: string): Promise<SpotifyPlayer> {
        if (this.players.has(guild_id)) return this.players.get(guild_id);

        const player = new SpotifyPlayer(guild_id, channel_id, this.client, this, this.db);

        await player.join();

        this.players.set(guild_id, player);

        return player;
    }
}