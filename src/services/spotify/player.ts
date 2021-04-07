import { Player } from "discord.js-lavalink";
import EventEmitter from "events";
import { LavaManager } from "../lava";

class SpotifyPlayer extends EventEmitter {
    protected player: Player;

    constructor(public guild_id: string, public channel_id: string, public manager: LavaManager) {
        super();
    }

    public async join() {
        this.player = this.manager.join({
            channel: this.channel_id,
            guild: this.guild_id,
            host: 'localhost'
        }, { selfdeaf: true });
    }
}