import { Client, VoiceState } from "discord.js";
import EventEmitter from "events";
import ConfigManager from "../config";
import { LavaManager } from "./lava";

export default class SpotifyService {
    private client_id: string;
    private client_secret: string;

    private manager: LavaManager;

    constructor(config: ConfigManager, private client: Client) {
        this.client_id = config.get('spotify_client_id');
        this.client_secret = config.get('spotify_client_secret');
    
        this.onVoiceStateUpdate = this.onVoiceStateUpdate.bind(this);
    }

    public initialize(manager: LavaManager) {
        this.client.on('voiceStateUpdate', this.onVoiceStateUpdate);

        this.manager = manager;
    }

    protected onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
        
    }
}

class SpotifyPlayer extends EventEmitter {
    constructor(public guild_id: string, public channel_id: string) {
        super();
    }
}