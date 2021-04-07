import { MessageEmbed } from "discord.js";
import { CommandEvent } from "./emitter";

export async function link(event: CommandEvent) {
    const link_url = event.config.get('spotify_link_url') || 'http://localhost:4481/link/';

    if (await event.db.getToken(event.msg.author.id)) {
        await event.send(new MessageEmbed({
            description: 'You have already linked your Spotify account.',
            color: '#0773D6'
        }));

        return;
    }

    const link_id = await event.db.initializeLink(event.msg.author.id);
    
    try {
        await event.msg.author.send(new MessageEmbed({
            author: {name: 'Link your Spotify account', icon_url: 'https://spoticord.com/img/spotify-logo.png'},
            description: `Go to [this link](${link_url}${link_id}) to connect your Spotify account.`,
            footer: {text: `This message was requested by the ${event.config.get('prefix')}link command`},
            color: '#0773D6'
        }));
    } catch {
        await event.send(new MessageEmbed({
            description: 'You must allow direct messages from server members to use this command\n(You can disable it afterwards)',
            color: '#D61516'
        }));
    }
}

export async function unlink(event: CommandEvent) {
    if (!await event.db.getToken(event.msg.author.id)) {
        await event.send(new MessageEmbed({
            description: 'You cannot unlink your Spotify account if you haven\'t linked one.',
            color: '#D61516'
        }));

        return;
    }

    await event.db.deleteToken(event.msg.author.id);

    await event.send(new MessageEmbed({
        description: 'Successfully unlinked your Spotify account',
        color: '#0773D6'
    }));
}

export async function rename(event: CommandEvent) {
    const name = event.args.join(' ');

    if (!name || name.trim().length == 0) {
        return await event.send(new MessageEmbed({
            description: 'An empty device name is not allowed',
            color: '#D61516'
        }));
    }

    if (name.length > 16) {
        return await event.send(new MessageEmbed({
            description: 'Device name may not be longer than 16 characters',
            color: '#D61516'
        }))
    }

    await event.db.setDeviceName(event.msg.author.id, name);

    await event.send(new MessageEmbed({
        description: `Successfully changed the Spotify device name to **${_dc_escape(name)}**`,
        color: '#0773D6'
    }));
}

export async function help(event: CommandEvent) {
    await event.send(new MessageEmbed({
        author: { name: 'Spoticord Help', icon_url: 'https://spoticord.com/img/spoticord-logo-clean.png' },
        title: 'These following links might help you out',
        description: 
            'If you need help setting Spoticord up you can check out the **[Documentation](https://spoticord.com/documentation)** page on the Spoticord website.\n' +
            '(This bot is unofficial, so setup might differ from the official documentation)\n\n' +
            'If you want to build your own Spoticord you can check out the official [Github Repository](https://github.com/SpoticordMusic/Spoticord)',
        color: '#43B581'
    }));
}

function _dc_escape(text: string): string {
    return text
        .replace(/\\\\/g, '\\\\')
        .replace(/\*/g, '\\*')
        .replace(/\_/g, '\\_')
        .replace(/\~/g, '\\~')
        .replace(/\`/g, '\\`');
}