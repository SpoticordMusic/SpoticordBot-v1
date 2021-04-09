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
    private players: SpotifyUser[] = [];

    private current_spotify_track: Track;
    private current_youtube_track: LavaTrackInfo;

    constructor(public guild_id: string, public channel_id: string, public client: Client, public music: MusicPlayerService, private db: DB) {
        super();

        this.onPlayerEnd = this.onPlayerEnd.bind(this);

        this.manager = music.getLavaManager();
    }

    public async join() {
        this.player = await this.manager.join({
            channel: this.channel_id,
            guild: this.guild_id,
            node: this.manager.idealNodes[0].id
        }, { selfdeaf: true });

        this.player.on('end', this.onPlayerEnd);

        await this.player.volume(20);

        const members = this.client.guilds.cache.get(this.guild_id).channels.cache.get(this.channel_id).members;
    
        for (const member of members) {
            if (member[0] === this.client.user.id) continue;

            if (!await this.db.getToken(member[0])) continue;
            if (this.music.getUserState(member[0]) === 'ACTIVE') continue;

            const spotifyUser = this.music.createUser(member[0]);

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
    }

    protected async onPlayerEnd(data: LavalinkEvent) {
        if (data.reason === 'REPLACED') return console.debug('[REPLACED]');
        if (data.reason === 'CLEANUP') return console.debug('[CLEANUP]');
        if (data.reason === 'STOPPED') return console.debug('[STOPPED]');
        
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
        this.players.splice(this.players.indexOf(user), 1);

        if (this.host?.discord_id === user.discord_id) {
            this.host = null;

            if (this.players.length < 1 && this.player.playing) {
                await this.player.stop();
            } else {
                this.host = this.players[0];
            }
        }

        console.debug(`playback-lost`);
    }

    protected onPlaybackPre(user: SpotifyUser) {
        if (!this.players.includes(user)) {
            this.players.push(user);
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

            console.debug(`pause-playback = ${e.paused}`);
        }
    }

    protected async onSeekPlayback(user: SpotifyUser, e) {
        e.setPosition(this.yt_to_spotify(this.player.state.position));

        if (this.host?.discord_id === user.discord_id) {
            await this.player.seek(this.spotify_to_yt(e.position));

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

            const track_list = await this.manager.getSongs(query);

            if (track_list.length < 1) {
                console.debug(`No track found for ${search}`);
                return;
            }

            this.current_youtube_track = track_list[0];
            this.current_spotify_track = track;

            console.debug(`play-track = paused = ${paused}, position = ${position}, name = ${search}`);

            await this.player.play(track_list[0].track, {pause: paused, startTime: this.spotify_to_yt(position)});
        }
    }

    protected spotify_to_yt(position: number): number {
        return (position / this.current_spotify_track.metadata.duration) * this.current_youtube_track.info.length;
    }

    protected yt_to_spotify(position: number): number {
        return (position / this.current_youtube_track.info.length) * this.current_spotify_track.metadata.duration;
    }
}