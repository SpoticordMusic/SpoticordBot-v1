import { GuildMember, MessageEmbed } from "discord.js";
import { CommandEvent } from "./emitter";

export async function join(event: CommandEvent) {
    if (!event.msg.member.voice.channel) {
        return await event.send(new MessageEmbed({
            description: 'You need to connect to a voice channel',
            author: { name: 'Cannot join voice channel', icon_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Forbidden_Symbol_Transparent.svg/1200px-Forbidden_Symbol_Transparent.svg.png' },
            color: '#D61516'
        }));
    }

    if (!await event.db.getToken(event.msg.author.id)) {
        const prefix = event.config.get('prefix');
        
        return await event.send(new MessageEmbed({
            description: `You need to link your Spotify account with the bot using the "${prefix}link" command`,
            author: { name: 'Cannot join voice channel', icon_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Forbidden_Symbol_Transparent.svg/1200px-Forbidden_Symbol_Transparent.svg.png' },
            color: '#D61516'
        }));
    }

    const botPerms = event.msg.guild.member(event.msg.client.user).permissionsIn(event.msg.member.voice.channel);
    if (!botPerms.has('CONNECT') || !botPerms.has('SPEAK')) {
        return await event.send(new MessageEmbed({
            description: 'I don\'t have the appropriate permissions to play music in that channel',
            author: { name: 'Cannot join voice channel', icon_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Forbidden_Symbol_Transparent.svg/1200px-Forbidden_Symbol_Transparent.svg.png' },
            color: '#D61516'
        }));
    }

    
}