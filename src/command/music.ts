import { MessageEmbed } from "discord.js";
import MusicPlayerService from "../services/music";
import { CommandEvent } from "./emitter";

// TODO: Fix this shit ass way of passing the Music Player Service to the command handlers
var music: MusicPlayerService = null;

export function initialize(music_service: MusicPlayerService) {
    music = music_service;
}

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

    if (music.getPlayerState(event.msg.guild.id) === 'DISCONNECTED') {
        await music.joinChannel(event.msg.guild.id, event.msg.member.voice.channelID);

        return await event.send(new MessageEmbed({
            description: `Come listen along in <#${event.msg.member.voice.channelID}>`,
            author: {name: 'Connected to voice channel', icon_url: 'https://images.emojiterra.com/mozilla/512px/1f50a.png'},
            color: '#0773d6'
        }));
    }

    if (music.getPlayerChannel(event.msg.guild.id) === event.msg.member.voice.channelID) {
        await music.playerUserJoin(event.msg.guild.id, event.msg.author.id);

        return await event.send(new MessageEmbed({
            description: `You have joined the listening party, check your Spotify!`,
            color: '#0773d6'
        }));
    }

    if (!music.getPlayerHost(event.msg.guild.id)) {
        await music.leaveGuild(event.msg.guild.id);
        await music.joinChannel(event.msg.guild.id, event.msg.member.voice.channelID);

        return await event.send(new MessageEmbed({
            description: `Come listen along in <#${event.msg.member.voice.channelID}>`,
            author: {name: 'Connected to voice channel', icon_url: 'https://images.emojiterra.com/mozilla/512px/1f50a.png'},
            color: '#0773d6'
        }));
    }

    return await event.send(new MessageEmbed({
        description: `The bot is currently being used in another voice channel`,
        author: {name: 'Cannot join voice channel', icon_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Forbidden_Symbol_Transparent.svg/1200px-Forbidden_Symbol_Transparent.svg.png'},
        color: '#d61516'
    }))
}

export async function leave(event: CommandEvent) {
    if (music.getPlayerState(event.msg.guild.id) === 'DISCONNECTED') {
        return await event.send(new MessageEmbed({
            description: 'The bot is currently not connected to any voice channel',
            author: {name: 'Cannot disconnect bot', icon_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Forbidden_Symbol_Transparent.svg/1200px-Forbidden_Symbol_Transparent.svg.png'},
            color: '#d61516'
        }));
    }

    if (!music.getPlayerHost(event.msg.guild.id) || music.getPlayerHost(event.msg.guild.id).discord_id === event.msg.author.id) {
        await music.leaveGuild(event.msg.guild.id);
        
        return await event.send(new MessageEmbed({
            description: 'The bot has been disconnected',
            color: '#0773d6'
        }));
    }

    return await event.send(new MessageEmbed({
        description: 'The bot is currently being managed by someone else',
        author: {name: 'Cannot disconnect bot', icon_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Forbidden_Symbol_Transparent.svg/1200px-Forbidden_Symbol_Transparent.svg.png'},
        color: '#d61516'
    }));
}

export async function playing(event: CommandEvent) {
    if (music.getPlayerState(event.msg.guild.id) === 'DISCONNECTED') {
        return await event.send(new MessageEmbed({
            description: 'The bot is currently not connected to any voice channel',
            author: {name: 'Cannot get track info', icon_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Forbidden_Symbol_Transparent.svg/1200px-Forbidden_Symbol_Transparent.svg.png'},
            color: '#d61516'
        }));
    }

    const host = music.getPlayerHost(event.msg.guild.id);

    if (!host) {
        return await event.send(new MessageEmbed({
            description: 'The bot is currently not playing anything',
            author: {name: 'Cannot get track info', icon_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Forbidden_Symbol_Transparent.svg/1200px-Forbidden_Symbol_Transparent.svg.png'},
            color: '#d61516'
        }));
    }

    const [spotify_track, youtube_track] = music.getTrackInfo(event.msg.guild.id);

    const authors = spotify_track.metadata.authors.map((author) => author.name).join(', ');

    const dcUser = music.getDiscordUser(host.discord_id);

    return await event.send(new MessageEmbed({
        author: {name: 'Currently Playing', icon_url: 'https://www.freepnglogos.com/uploads/spotify-logo-png/file-spotify-logo-png-4.png'},
        title: `${authors} - ${spotify_track.metadata.name}`,
        url: `https://open.spotify.com/track/${spotify_track.metadata.uri.split(':')[2]}`,
        description: `Click **[here](${youtube_track.info.uri})** for the YouTube version`,
        footer: dcUser ? {text: `${dcUser.username}`, icon_url: dcUser.avatarURL()} : undefined,
        color: '#0773d6'
    }));
}