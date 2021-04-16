import { Client } from "discord.js";
import { LavalinkEvent, Player } from "@lavacord/discord.js";
import EventEmitter from "events";
import { DB } from "../../db";
import { LavaManager, LavaTrackInfo } from "../lava";
import MusicPlayerService from "../music";
import { Track } from "./state";
import { SpotifyUser } from "./user";

export class SpotifyPlayer extends EventEmitter {
    protected player: Player;

    private manager: LavaManager;

    private host: SpotifyUser;
    private players: Map<string, SpotifyUser> = new Map<string, SpotifyUser>();

    private current_spotify_track: Track;
    private current_youtube_track: LavaTrackInfo;

    private player_leave_timeout: NodeJS.Timeout;
    private should_kick: boolean = false; // Indicates wether the bot SHOULD have been kicked, but was NOT kicked because of certain criteria

    private is_247: boolean = false;

    constructor(public guild_id: string, public voice_channel: string, public text_channel: string, public client: Client, public music: MusicPlayerService, private db: DB) {
        super();

        this.onPlayerEnd = this.onPlayerEnd.bind(this);

        this.startPlayerKickTimeout = this.startPlayerKickTimeout.bind(this);
        this.stopPlayerKickTimeout = this.stopPlayerKickTimeout.bind(this);

        this.manager = music.getLavaManager();
    }

    public async join() {
        this.player = await this.manager.join({
            channel: this.voice_channel,
            guild: this.guild_id,
            node: this.manager.idealNodes[0].id
        }, { selfdeaf: true });
        
        // Remove redundant onend event handlers (idk how the lavalink lib works but without the 'off' it breaks the bot after moving it)
        this.player.off('end', this.onPlayerEnd).on('end', this.onPlayerEnd);

        await this.player.volume(20);

        const members = this.client.guilds.cache.get(this.guild_id).channels.cache.get(this.voice_channel).members;
    
        for (const member of members) {
            await this.createUser(member[0]);
        }

        this.updatePlayerKickTimeout();
    }

    public async leave() {
        await this.player.destroy();
        await this.manager.leave(this.guild_id);

        this.stopPlayerKickTimeout();
        this.destroyAllUsers();
    }

    public async updateChannel(channel_id: string) {
        await this.player.destroy();

        this.destroyAllUsers();

        this.voice_channel = channel_id;
        return await this.join();
    }

    public userLeft(user_id: string) {
        if (this.players.has(user_id)) {
            this.music.destroyUser(user_id);
        }

        if (!this.is_247 && this.client.guilds.cache.get(this.guild_id).channels.cache.get(this.voice_channel).members.size != 2) {
            this.updatePlayerKickTimeout();
        }
    }

    public async userJoined(user_id: string) {
        if (this.players.has(user_id)) return;

        await this.createUser(user_id);

        this.updatePlayerKickTimeout();
    }

    public toggle247(): boolean {
        this.is_247 = !this.is_247;

        this.updatePlayerKickTimeout();

        return this.is_247
    }

    public getUsers() {
        return this.players.values();
    }

    public getHost(): SpotifyUser | null {
        return this.host;
    }

    public getTrackInfo(): [Track, LavaTrackInfo] {
        return [this.current_spotify_track, this.current_youtube_track];
    }

    protected destroyAllUsers() {
        this.host = null;
        for (const player of this.players) {
            this.music.destroyUser(player[0]);
        }
        this.players.clear();
    }

    protected async createUser(user_id: string) {
        if (user_id === this.client.user.id) return;

        if (!await this.db.getToken(user_id)) return;
        if (this.music.getUserState(user_id) === 'ACTIVE') return;

        const spotifyUser = this.music.createUser(user_id);

        spotifyUser.removeAllListeners();

        this.players.set(user_id, spotifyUser);

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

        await spotifyUser.initialize();
    }

    protected async onPlayerEnd(data: LavalinkEvent) {
        if (data.reason === 'REPLACED') return;
        if (data.reason === 'CLEANUP') return;
        if (data.reason === 'STOPPED') return;

        if (!this.host || !this.player) return;

        this.host.advanceNext();
    }

    protected async onVolume(user: SpotifyUser, volume: number) {
        
        volume = Math.min(150, Math.max(0, volume / 65535 * 20));
        
        if (this.host?.discord_id === user.discord_id) {
            await this.player.volume(volume);
            console.debug(`volume = ${volume}`);
        }
    }

    protected async onPlaybackLost(user: SpotifyUser) {
        this.players.delete(user.discord_id);

        if (this.host?.discord_id === user.discord_id) {
            this.host = null;

            if (this.players.size < 1 && this.player.playing) {
                await this.player.stop();

                this.startPlayerKickTimeout();
            } else {
                this.host = this.players[0];
            }
        }

        console.debug(`playback-lost`);
    }

    protected onPlaybackPre(user: SpotifyUser) {
        if (!this.players.has(user.discord_id)) {
            this.players.set(user.discord_id, user);
        }

        if (!this.host) {
            console.debug(`playback-update-pre`);
    
            this.host = user;
        }
    }

    protected async onPausePlayback(user: SpotifyUser, e) {
        e.setPosition(this.yt_to_spotify(this.player.state.position));

        if (this.host?.discord_id === user.discord_id) {
            await this.player.pause(e.paused);

            for (const player of this.players) {
                if (player[1].discord_id === this.host.discord_id) continue;

                await (e.paused ? player[1].pausePlayback() : player[1].resumePlayback());
            }

            if (e.paused) this.startPlayerKickTimeout();
            else this.stopPlayerKickTimeout();

            console.debug(`pause-playback = ${e.paused}`);
        }
    }

    protected async onSeekPlayback(user: SpotifyUser, e) {
        e.setPosition(this.yt_to_spotify(this.player.state.position));

        if (this.host?.discord_id === user.discord_id) {
            await this.player.seek(this.spotify_to_yt(e.position));

            for (const player of this.players) {
                if (player[1].discord_id === this.host.discord_id) continue;

                await player[1].seekPlayback(e.position);
            }

            console.debug(`seek-playback = ${e.position}`);
        }
    }

    protected onModifyPlayback(user: SpotifyUser, e) {
        e.setPosition(this.yt_to_spotify(this.player.state.position));

        console.debug(`modify-playback`);
    }

    protected async onPlayTrack(user: SpotifyUser, paused: boolean, position: number, track: Track) {
        if (this.host?.discord_id === user.discord_id) {
            const search = `${track.metadata.authors.map((author_name) => author_name.name).join(', ')} - ${track.metadata.name}`;
            const query = `ytsearch:${search}`;

            let track_list: LavaTrackInfo[];

            for (var i = 0; i < 3; i++) {
                track_list = await this.manager.getSongs(query);

                if (track_list.length > 0) break;
            }

            if (track_list.length < 1) {
                console.debug(`No track found for ${search}`);

                await user.advanceNext();

                return;
            }

            this.current_youtube_track = track_list[0];
            this.current_spotify_track = track;

            for (const player of this.players) {
                if (player[1].discord_id === this.host.discord_id) continue;

                await player[1].playTrack(this.current_spotify_track.metadata.uri, position);
            }

            if (!paused) this.stopPlayerKickTimeout();
            else if (!this.player_leave_timeout) this.startPlayerKickTimeout();

            console.debug(`play-track = paused = ${paused}, position = ${position}, name = ${search}`);

            await this.player.play(track_list[0].track, {pause: paused, startTime: this.spotify_to_yt(position)});
        }
    }

    protected spotify_to_yt(position: number): number {
        return (position / this.current_spotify_track?.metadata.duration) * this.current_youtube_track?.info.length;
    }

    protected yt_to_spotify(position: number): number {
        return (position / this.current_youtube_track?.info.length) * this.current_spotify_track?.metadata.duration;
    }

    // Triggers when the "do not kick" criteria no applies
    protected updatePlayerKickTimeout() {
        if (this.is_247 || this.client.guilds.cache.get(this.guild_id).channels.cache.get(this.voice_channel).members.size == 2) {
            this.stopPlayerKickTimeout();
        } else {
            this.startPlayerKickTimeout();
        }
    }

    protected startPlayerKickTimeout() {
        if (this.player_leave_timeout) {
            clearTimeout(this.player_leave_timeout);
        }

        this.player_leave_timeout = setTimeout((() => {
            if (this.client.guilds.cache.get(this.guild_id).channels.cache.get(this.voice_channel).members.size == 2)
                return;

            if (this.is_247)
                return;

            this.music.leaveGuild(this.guild_id, true);
        }).bind(this), 5 * 60 * 1000);
    }

    protected stopPlayerKickTimeout() {
        this.should_kick = false;
 
        if (!this.player_leave_timeout) return;

        clearTimeout(this.player_leave_timeout);
        this.player_leave_timeout = null;
    }
}