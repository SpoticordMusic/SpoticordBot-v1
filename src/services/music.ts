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

    protected onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
        
    }

    public getLavaManager(): LavaManager {
        return this.manager;
    }

    public getPlayerState(guild_id: string): MusicPlayerState {
        if (!this.players.has(guild_id)) return 'DISCONNECTED';
        
        return 'PLAYING';
    }

    public getUserState(user_id: string): UserState {
        return this.players.has(user_id) ? 'ACTIVE' : 'INACTIVE';
    }

    public createUser(user_id: string): SpotifyUser {
        if (this.players.has(user_id)) return this.players[user_id];

        const spotifyUser = new SpotifyUser(user_id, this.db, this.spotify_client_id, this.spotify_client_secret);
    
        this.users.set(user_id, spotifyUser);

        return spotifyUser;
    }

    public async joinChannel(guild_id: string, channel_id: string): Promise<SpotifyPlayer> {
        if (this.players.has(guild_id)) return this.players[guild_id];

        const player = new SpotifyPlayer(guild_id, channel_id, this.client, this, this.db);

        await player.join();

        this.players.set(guild_id, player);

        return player;
    }
}