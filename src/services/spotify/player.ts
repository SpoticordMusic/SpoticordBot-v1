import { Client, MessageEmbed, TextChannel, VoiceChannel } from "discord.js";
import { Player, Track as LavaTrack, TrackEndEvent, Manager } from "erela.js";
import EventEmitter from "events";
import { DB } from "../../db";
import MusicPlayerService from "../music";
import { Track } from "./state";
import { SpotifyUser } from "./user";

interface PlayerInfo {
    // Track info values
    spotify_track: Track;
    youtube_track: LavaTrack;

    // Player state values
    position: number;
    positionTimer: NodeJS.Timeout;
    repeat: 'OFF' | 'PLAYLIST' | 'SONG'; // TODO
    shuffle: boolean; // TODO
    paused: boolean;

    // Timeout values
    is_247: boolean;
    leave_timeout: NodeJS.Timeout
}

export class SpotifyPlayer extends EventEmitter {
    protected player: Player;
    protected player_info: PlayerInfo = {
        is_247: false,
        leave_timeout: null,

        spotify_track: null,
        youtube_track: null,

        position: 0,
        positionTimer: null,
        repeat: 'OFF',
        shuffle: false,
        paused: false
    };

    private manager: Manager;

    private host: SpotifyUser;

    // Spoticord users who are in the same call as the bot
    private users: Map<string, SpotifyUser> = new Map<string, SpotifyUser>();

    // Spoticord users who are in the same call AND have their Spotify set to Spoticord
    private controllers: Map<string, SpotifyUser> = new Map<string, SpotifyUser>();

    constructor(public guild_id: string, public voice_channel: VoiceChannel, public text_channel: TextChannel, public client: Client, public music: MusicPlayerService, private db: DB) {
        super();

        this.onPlayerEnd = this.onPlayerEnd.bind(this);

        this.startPlayerKickTimeout = this.startPlayerKickTimeout.bind(this);
        this.stopPlayerKickTimeout = this.stopPlayerKickTimeout.bind(this);

        this.manager = music.getLavaManager();
    }

    public async join() {
        this.player = await this.manager.create({
            voiceChannel: this.voice_channel.id,
            textChannel: this.text_channel.id,
            guild: this.guild_id,
            node: this.manager.nodes.first().options.identifier,
            selfDeafen: true
        });

        this.player.connect();
        
        // Remove redundant onend event handlers (idk how the lavalink lib works but without the 'off' it breaks the bot after moving it)
        this.manager.off('queueEnd', this.onPlayerEnd).on('queueEnd', this.onPlayerEnd);

        await this.player.setVolume(40);

        const members = this.voice_channel.members;
    
        for (const [member] of members) {
            await this.createUser(member);
        }

        this.updatePlayerKickTimeout();
    }

    public async leave() {
        await this.player.destroy();

        this.stopPlayerKickTimeout();
        this.destroyAllUsers();
    }

    public async updateChannel(channel: VoiceChannel) {
        await this.player.destroy();

        this.destroyAllUsers();

        this.voice_channel = channel;
        return await this.join();
    }

    public userLeft(user_id: string) {
        if (this.users.has(user_id)) {
            this.music.destroyUser(user_id);
        }

        this.users.delete(user_id);

        if (!this.player_info.is_247 && this.voice_channel.members.size != 2) {
            this.updatePlayerKickTimeout();
        }
    }

    public async userJoined(user_id: string) {
        if (this.users.has(user_id)) return;

        await this.createUser(user_id);

        this.updatePlayerKickTimeout();
    }

    public toggle247(): boolean {
        this.player_info.is_247 = !this.player_info.is_247;

        this.updatePlayerKickTimeout();

        return this.player_info.is_247;
    }

    public getUsers() {
        return this.users.values();
    }

    public getHost(): SpotifyUser | null {
        return this.host;
    }

    public getTrackInfo(): [Track, LavaTrack] {
        return [this.player_info.spotify_track, this.player_info.youtube_track];
    }

    public getPlayerInfo(): PlayerInfo {
        return this.player_info;
    }

    public async seek(position: number): Promise<boolean> {
        return await this.host.seekPlayback(position);
    }

    public async pause(): Promise<boolean> {
        return await this.host.pausePlayback();
    }
    
    public async resume(): Promise<boolean> {
        return await this.host.resumePlayback();
    }

    public async next(): Promise<boolean> {
        return await this.host.nextTrack();
    }

    protected destroyAllUsers() {
        this.host = null;
        for (const [player] of this.users) {
            this.music.destroyUser(player);
        }
        this.users.clear();
    }

    protected async createUser(user_id: string) {
        if (user_id === this.client.user.id) return;

        if (!await this.db.getToken(user_id)) return;
        if (this.music.getUserState(user_id) === 'ACTIVE') return;

        const spotifyUser = this.music.createUser(user_id);

        spotifyUser.removeAllListeners();

        this.users.set(user_id, spotifyUser);

        spotifyUser.on('volume', (volume) => {
            this.onVolume(spotifyUser, volume);
        });

        spotifyUser.on('playback-lost', () => {
            this.onPlaybackLost(spotifyUser);
        });

        spotifyUser.on('playback-update-pre', () => {
            this.onPlaybackPre(spotifyUser);
        });

        spotifyUser.on('pause-playback', (e) => {
            this.onPausePlayback(spotifyUser, e);
        });

        spotifyUser.on('seek-playback', (e) => {
            this.onSeekPlayback(spotifyUser, e);
        });

        spotifyUser.on('modify-playback', (e) => {
            this.onModifyPlayback(spotifyUser, e);
        });

        spotifyUser.on('play-track', (e) => {
            this.onPlayTrack(spotifyUser, e.paused, e.position, e.track);
        });

        spotifyUser.on('state-conflict', (e) => {
            this.onStateConflict(spotifyUser, e);
        })

        await spotifyUser.initialize();
    }

    protected async onPlayerEnd(player: Player, track: LavaTrack, data: TrackEndEvent) {
        console.debug('PLAYER END', player.guild, this.guild_id)
        
        if (player.guild !== this.guild_id) return;

        if (data.reason === 'REPLACED') return;
        if (data.reason === 'CLEANUP') return;
        if (data.reason === 'STOPPED') {
            this.player_info.position = 0;
            this.player_info.spotify_track = null;
            this.player_info.youtube_track = null;
            return;
        }

        if (!this.host || !this.player) return;

        // Advance to next state
        this.host.advanceNext();
    }

    protected async onVolume(user: SpotifyUser, volume: number) {
        volume = Math.min(150, Math.max(0, volume / 65535 * 40));
        
        if (this.host?.discord_id === user.discord_id) {
            await this.player.setVolume(volume);
            console.debug(`volume = ${volume}`);
        }
    }

    // Triggered when the user switched away from the Spoticord device
    protected async onPlaybackLost(user: SpotifyUser) {
        this.controllers.delete(user.discord_id);

        if (this.host?.discord_id === user.discord_id) {
            this.host = null;

            if (this.controllers.size < 1 && this.player.playing) {
                await this.player.stop();

                this.startPlayerKickTimeout();
                
                clearInterval(this.player_info.positionTimer);
                this.player_info.spotify_track = null;
                this.player_info.youtube_track = null;
            } else {
                this.host = this.controllers[0];
            }
        }

        console.debug(`playback-lost`);
    }

    // Before playing the track
    protected onPlaybackPre(user: SpotifyUser) {
        if (!this.controllers.has(user.discord_id)) {
            this.controllers.set(user.discord_id, user);
        }

        if (!this.host) {
            console.debug(`playback-update-pre`);
    
            this.host = user;
        }
    }

    // On pause / resume of playback
    protected async onPausePlayback(user: SpotifyUser, e) {
        e.setPosition(this.yt_to_spotify(this.player_info.position));

        if (e.paused) clearInterval(this.player_info.positionTimer);
        else this.startPositionTimer();

        this.player_info.paused = e.paused;
        this.player_info.position = e.paused ? this.player.position : this.player_info.position;

        if (this.host?.discord_id === user.discord_id) {
            this.player.pause(e.paused);

            for (const [_, user] of this.users) {
                if (user.discord_id === this.host.discord_id) continue;

                await (e.paused ? user.pausePlayback() : user.resumePlayback());
            }

            if (e.paused) this.startPlayerKickTimeout();
            else this.stopPlayerKickTimeout();

            console.debug(`pause-playback = ${e.paused}`);
        }
    }

    // When position of song was changed
    protected async onSeekPlayback(user: SpotifyUser, e) {
        e.setPosition(this.yt_to_spotify(this.player.position));
        this.player_info.position = this.spotify_to_yt(e.position);

        if (this.host?.discord_id === user.discord_id) {
            await this.player.seek(this.spotify_to_yt(e.position));

            for (const [_, user] of this.users) {
                if (user.discord_id === this.host.discord_id) continue;

                await user.seekPlayback(e.position);
            }

            console.debug(`seek-playback = ${e.position}`);
        }
    }

    // I dont remember
    protected onModifyPlayback(user: SpotifyUser, e) {
        e.setPosition(this.yt_to_spotify(this.player.position));
        this.player_info.position = this.player.position;

        console.debug(`modify-playback`);
    }

    // I hate this, I don't know whats happening
    protected onStateConflict(user: SpotifyUser, e) {
        e.setPosition(this.yt_to_spotify(this.player.position));

        console.debug(`state-conflict`);
    }

    // When a new track is played
    protected async onPlayTrack(user: SpotifyUser, paused: boolean, position: number, track: Track) {
        if (this.host?.discord_id === user.discord_id) {
            const search = `${track.metadata.authors.map((author_name) => author_name.name).join(', ')} - ${track.metadata.name}`;
            const query = `ytsearch:${search}`;

            let track_list: LavaTrack[];

            for (var i = 0; i < 3; i++) {
                const result = await this.manager.search(search);
                track_list = result.tracks;

                if (track_list.length > 0) break;
            }

            if (track_list.length < 1) {
                await this.text_channel.send({
                    embeds: [new MessageEmbed({
                        description: `No track found for ${search}`,
                        color: '#D61516'
                    })]
                });

                console.debug(`No track found for ${search}`);

                await user.advanceNext();

                return;
            }

            this.player_info.youtube_track = track_list[0];
            this.player_info.spotify_track = track;
            this.player_info.position =  this.spotify_to_yt(position);
            this.player_info.paused = paused;

            for (const [_, user] of this.users) {
                if (user.discord_id === this.host.discord_id) continue;

                await user.playTrack(this.player_info.spotify_track.metadata.uri, position);
            }

            if (!paused) this.stopPlayerKickTimeout();
            else if (!this.player_info.leave_timeout) this.startPlayerKickTimeout();

            console.debug(`play-track = paused = ${paused}, position = ${position} (${this.player_info.position}), name = ${search}`);

            await this.player.play(track_list[0], {startTime: this.spotify_to_yt(position)});

            if (!paused) this.startPositionTimer();
            else clearInterval(this.player_info.positionTimer);

            if (paused) setTimeout(() => this.player.pause(true), 100);
        }
    }

    protected startPositionTimer() {
        clearInterval(this.player_info.positionTimer);
        this.player_info.positionTimer = setInterval((() => {
            if (!this.host) {
                clearInterval(this.player_info.positionTimer);
                return;
            }

            this.player_info.position += 1000;
        }).bind(this), 1000);
    }

    // Convert the Spotify song position to the YouTube song position
    protected spotify_to_yt(position: number): number {
        return (position / this.player_info.spotify_track?.metadata.duration) * this.player_info.youtube_track?.duration;
    }

    // Convert the YouTube song position to the Spotify song position
    protected yt_to_spotify(position: number): number {
        return (position / this.player_info.youtube_track?.duration) * this.player_info.spotify_track?.metadata.duration;
    }

    // Triggers when the "do not kick" criteria no applies
    protected updatePlayerKickTimeout() {
        if (this.player_info.is_247 || this.voice_channel.members.size == 2) {
            this.stopPlayerKickTimeout();
        } else {
            this.startPlayerKickTimeout();
        }
    }

    // Start the player kick timer
    protected startPlayerKickTimeout() {
        if (this.player_info.leave_timeout) {
            clearTimeout(this.player_info.leave_timeout);
        }

        this.player_info.leave_timeout = setTimeout((() => {
            if (this.voice_channel.members.size == 2)
                return;

            if (this.player_info.is_247)
                return;

            this.music.leaveGuild(this.guild_id, true);
        }).bind(this), 5 * 60 * 1000);
    }

    // Cancel the player kick timer
    protected stopPlayerKickTimeout() { 
        if (!this.player_info.leave_timeout) return;

        clearTimeout(this.player_info.leave_timeout);
        this.player_info.leave_timeout = null;
    }
}
