import { Client } from 'discord.js';
import { LavalinkNodeOptions, PlayerManager, PlayerManagerOptions } from 'discord.js-lavalink';
import fetch from 'node-fetch';
import { URLSearchParams } from 'url';

export interface LavaTrackInfo {
    track: string,
    info: {
        identifier: string,
        isSeekable: boolean,
        author: string,
        length: number,
        isStream: false,
        position: number,
        title: string,
        uri: string
    }
}

export class LavaManager extends PlayerManager {
    constructor(client: Client, nodes: LavalinkNodeOptions[], opts: PlayerManagerOptions) {
        super(client, nodes, opts);
    }

    public async getSongs(search: string): Promise<LavaTrackInfo[]> {
        const node = this.nodes.first();

        const params = new URLSearchParams();
        params.append("identifier", search);

        return (await (await fetch(`http://${node.host}:${node.port}/loadtracks?${params}`, { headers: { Authorization: node.password } })).json()).tracks;
    }
}