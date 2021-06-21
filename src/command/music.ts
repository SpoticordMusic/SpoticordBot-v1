import { Client, Message, MessageEmbed, TextChannel } from "discord.js";
import MusicPlayerService from "../services/music";
import { CommandEvent } from "./emitter";
import { MessageButton } from 'discord.js-buttons';

export default class MusicCommands {
    constructor(private music: MusicPlayerService) {
        this.join = this.join.bind(this);
        this.leave = this.leave.bind(this);
        this.playing = this.playing.bind(this);
        this.stay = this.stay.bind(this);
    }

    async join(event: CommandEvent) {
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

        // Check if user is already using bot in another guild
        if (this.music.getUserState(event.msg.author.id) === 'ACTIVE') {
            return await event.send(new MessageEmbed({
                description: 'Spoticord is already active on your Discord account somewhere else',
                author: { name: 'Cannot join voice channel', icon_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Forbidden_Symbol_Transparent.svg/1200px-Forbidden_Symbol_Transparent.svg.png' },
                color: '#D61516'
            }))
        }
    
        if (this.music.getPlayerState(event.msg.guild.id) === 'DISCONNECTED') {
            await this.music.joinChannel(event.msg.guild.id, event.msg.member.voice.channel, <TextChannel>event.msg.channel);
    
            return await event.send(new MessageEmbed({
                description: `Come listen along in <#${event.msg.member.voice.channelID}>`,
                author: {name: 'Connected to voice channel', icon_url: 'https://images.emojiterra.com/mozilla/512px/1f50a.png'},
                color: '#0773d6'
            }));
        }
    
        if (this.music.getPlayerChannel(event.msg.guild.id).id === event.msg.member.voice.channelID) {
            await this.music.playerUserJoin(event.msg.guild.id, event.msg.author.id);
    
            return await event.send(new MessageEmbed({
                description: `You have joined the listening party, check your Spotify!`,
                color: '#0773d6'
            }));
        }
    
        if (!this.music.getPlayerHost(event.msg.guild.id)) {
            await this.music.leaveGuild(event.msg.guild.id);
            await this.music.joinChannel(event.msg.guild.id, event.msg.member.voice.channel, <TextChannel>event.msg.channel);
    
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
    
    async leave(event: CommandEvent) {
        if (this.music.getPlayerState(event.msg.guild.id) === 'DISCONNECTED') {
            return await event.send(new MessageEmbed({
                description: 'The bot is currently not connected to any voice channel',
                author: {name: 'Cannot disconnect bot', icon_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Forbidden_Symbol_Transparent.svg/1200px-Forbidden_Symbol_Transparent.svg.png'},
                color: '#d61516'
            }));
        }
    
        if (!this.music.getPlayerHost(event.msg.guild.id) || this.music.getPlayerHost(event.msg.guild.id).discord_id === event.msg.author.id) {
            await this.music.leaveGuild(event.msg.guild.id);
            
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
    
    async playing(event: CommandEvent) {
        if (this.music.getPlayerState(event.msg.guild.id) === 'DISCONNECTED') {
            return await event.send(new MessageEmbed({
                description: 'The bot is currently not connected to any voice channel',
                author: {name: 'Cannot get track info', icon_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Forbidden_Symbol_Transparent.svg/1200px-Forbidden_Symbol_Transparent.svg.png'},
                color: '#d61516'
            }));
        }
    
        const host = this.music.getPlayerHost(event.msg.guild.id);
    
        if (!host) {
            return await event.send(new MessageEmbed({
                description: 'The bot is currently not playing anything',
                author: {name: 'Cannot get track info', icon_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Forbidden_Symbol_Transparent.svg/1200px-Forbidden_Symbol_Transparent.svg.png'},
                color: '#d61516'
            }));
        }
    
        return await event.send('', this.buildPlayingEmbed(event.msg.guild.id, host.discord_id));
    }

    async stay(event: CommandEvent) {
        if (this.music.getPlayerState(event.msg.guild.id) === 'DISCONNECTED') {
            return await event.send(new MessageEmbed({
                description: 'The bot is currently not connected to any voice channel',
                author: {name: 'Cannot get track info', icon_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Forbidden_Symbol_Transparent.svg/1200px-Forbidden_Symbol_Transparent.svg.png'},
                color: '#d61516'
            }));
        }

        const isEnabled = this.music.toggle247(event.msg.guild.id);

        return await event.send(new MessageEmbed({
            description: isEnabled ? 'The bot will stay in this call indefinitely' : 'The bot will leave the call if it\'s been inactive for too long',
            author: {name: `${isEnabled ? 'Enabled' : 'Disabled'} 24/7 mode`}
        }));
    }

    private buildPlayingEmbed(guild: string, host: string) {
        const [spotify_track, youtube_track] = this.music.getTrackInfo(guild);    
        const authors = spotify_track.metadata.authors.map((author) => author.name).join(', ');

        const dcUser = this.music.getDiscordUser(host);
        
        const player_info = this.music.getPlayer(guild)?.getPlayerInfo();
        const isPaused = player_info?.paused ?? true;
        
        const quadrant = Math.floor(player_info?.position / player_info?.youtube_track.info.length * 20) ?? -1;

        let positionText = '';

        for (var i = 0; i < 20; i++) {
            positionText += i === quadrant ? '🔵' : '▬';
        }

        positionText = `${isPaused ? '⏸️' : '▶️'} ${positionText} ${_strtime(Math.floor(player_info.position / 1000))} / ${_strtime(Math.floor(player_info.youtube_track.info.length / 1000))}`;

        const prev_button = new MessageButton()
            .setStyle('green')
            .setLabel('<<')
            .setID('btn_previous_track');

        const pause_resume_button = new MessageButton()
            .setStyle('gray')
            .setLabel(isPaused ? 'Play' : 'Pause')
            .setID('btn_pause_play');

        const next_button = new MessageButton()
            .setStyle('green')
            .setLabel('>>')
            .setID('btn_next_track');            
    
        return {
            embed: {
                author: {name: 'Currently Playing', icon_url: 'https://www.freepnglogos.com/uploads/spotify-logo-png/file-spotify-logo-png-4.png'},
                title: `${authors} - ${spotify_track.metadata.name}`,
                url: `https://open.spotify.com/track/${spotify_track.metadata.uri.split(':')[2]}`,
                description: `Click **[here](${youtube_track.info.uri})** for the YouTube version\n\n${positionText}`,
                footer: dcUser ? {text: `${dcUser.username}`, icon_url: dcUser.avatarURL()} : undefined,
                color: '#0773d6'
            },
            buttons: [
                prev_button, pause_resume_button, next_button
            ]
        }
    }

    // Previous track button clicked (go to position 0 in current song)
    async previousTrack(button) {
        const player = this.music.getPlayer(button.guild.id);
        if (!player) await button.reply.delete();
        if (!player.getHost() || this.music.getPlayerState(button.guild.id) === 'DISCONNECTED' ||
            this.music.getPlayerState(button.guild.id) === 'INACTIVE') return await button.defer();

        const host = player.getHost();
        if (button.clicker['user']['id'] !== host.discord_id) return; // Cause an "interaction failed" as there isn't an "error reply" function yet

        if (await player.seek(0)) await this.updatePlayingMessage(button);
    }

    // Pause or resume track button clicked
    async pausePlayTrack(button) {
        const player = this.music.getPlayer(button.guild.id);
        if (!player) await button.reply.delete();
        if (!player.getHost() || this.music.getPlayerState(button.guild.id) === 'DISCONNECTED' ||
            this.music.getPlayerState(button.guild.id) === 'INACTIVE') return await button.defer();

        const host = player.getHost();
        if (button.clicker['user']['id'] !== host.discord_id) return; // Cause an "interaction failed" as there isn't an "error reply" function yet

        if (player.getPlayerInfo().paused) {
            if (await player.resume()) await this.updatePlayingMessage(button);
        } else {
            if (await player.pause()) await this.updatePlayingMessage(button);
        }
    }

    // Next track button clicked
    async nextTrack(button) {
        const player = this.music.getPlayer(button.guild.id);
        if (!player) await button.reply.delete();
        if (!player.getHost() || this.music.getPlayerState(button.guild.id) === 'DISCONNECTED' ||
            this.music.getPlayerState(button.guild.id) === 'INACTIVE') return await button.defer();

        const host = player.getHost();
        if (button.clicker['user']['id'] !== host.discord_id) return; // Cause an "interaction failed" as there isn't an "error reply" function yet

        if (await player.next()) {
            await button.defer();
            await new Promise(r => setTimeout(r, 2500)); // Spotify -> WebSocket -> Lavalink -> Bot may take while, so wait 2.5s to be sure the track updates
            await this.updatePlayingMessage(button, true);
        }
    }

    async updatePlayingMessage(button, dont_defer=false) {
        try {
            const message = button.message as Message;
            if (!message.editable) return;
            
            if (this.music.getPlayerState(message.guild.id) === 'DISCONNECTED') {
                return await message.edit(new MessageEmbed({
                    description: 'The bot is currently not connected to any voice channel',
                    author: {name: 'Cannot get track info', icon_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Forbidden_Symbol_Transparent.svg/1200px-Forbidden_Symbol_Transparent.svg.png'},
                    color: '#d61516'
                }));
            }
        
            const host = this.music.getPlayerHost(message.guild.id);
        
            if (!host) {
                return await message.edit(new MessageEmbed({
                    description: 'The bot is currently not playing anything',
                    author: {name: 'Cannot get track info', icon_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Forbidden_Symbol_Transparent.svg/1200px-Forbidden_Symbol_Transparent.svg.png'},
                    color: '#d61516'
                }));
            }

            return await message.edit('', this.buildPlayingEmbed(message.guild.id, host.discord_id));
        } catch {
        } finally {
            if (dont_defer) return;
            try { await button.defer(); } catch {}
        }
    }

    attachButtonHandlers(client: Client) {
        client.on('clickButton', async (button) => {
            if (button.id === 'btn_previous_track') await this.previousTrack(button);
            if (button.id === 'btn_pause_play') await this.pausePlayTrack(button);
            if (button.id === 'btn_next_track') await this.nextTrack(button);
        });
    }
}

function _strtime(time: number): string {
    const HOUR = 3600;
    const MIN = 60;

    if (time / HOUR >= 1) {
        return `${Math.floor(time / HOUR)}h${Math.floor((time % HOUR) / MIN)}m${time % HOUR % MIN}s`;
    } else if (time / MIN >= 1) {
        return `${Math.floor(time / MIN)}m${time % MIN}s`;
    } else {
        return `${time}s`
    }
}