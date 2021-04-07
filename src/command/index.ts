import { MessageEmbed } from "discord.js";
import ConfigManager from "../config";
import { DB } from "../db";
import { CommandEmitter } from "./emitter";

export function Initialize(config: ConfigManager, emitter: CommandEmitter, db: DB) {
    const link_url = config.get('spotify_link_url') || 'http://localhost:4481/link/';

    emitter.on('link', async e => {
        if (await db.getToken(e.msg.author.id)) {
            await e.send(new MessageEmbed({
                description: 'You have already linked your Spotify account.',
                color: '#0773D6'
            }));

            return;
        }

        const link_id = await db.initializeLink(e.msg.author.id);
        
        try {
            await e.msg.author.send(new MessageEmbed({
                author: {name: 'Link your Spotify account', icon_url: 'https://spoticord.com/img/spotify-logo.png'},
                description: `Go to [this link](${link_url}${link_id}) to connect your Spotify account.`,
                footer: {text: `This message was requested by the ${config.get('prefix')}link command`},
                color: '#0773D6'
            }));
        } catch {
            await e.send(new MessageEmbed({
                description: 'You must allow direct messages from server members to use this command\n(You can disable it afterwards)',
                color: '#D61516'
            }));
        }
    })
}