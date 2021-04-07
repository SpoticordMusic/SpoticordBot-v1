import { Client, VoiceState } from "discord.js";
import ConfigManager from "../config";
import { LavaManager } from "./lava";

type MusicPlayerState = 'DISCONNECTED' | 'INACTIVE' | 'PAUSED' | 'PLAYING';

export default class MusicPlayerService {
    private spotify_client_id: string;
    private spotify_client_secret: string;

    private manager: LavaManager;

    constructor(config: ConfigManager, private client: Client) {
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

    public getPlayerState(guild_id: string): MusicPlayerState {
        
        
        return 'PLAYING';
    }
}