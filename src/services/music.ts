import { Client, MessageEmbed, TextChannel, User, VoiceChannel, VoiceState } from "discord.js";
import ConfigManager from "../config";
import { DB } from "../db";
import { SpotifyPlayer } from "./spotify/player";
import { Track } from "./spotify/state";
import { SpotifyUser } from "./spotify/user";
import { Track as LavaTrack, Manager } from 'erela.js';
import Spoticord from "./spoticord";
import GenericPlayer from "./spotify/generic_player";

type MusicPlayerState = 'DISCONNECTED' | 'INACTIVE' | 'PAUSED' | 'PLAYING';
type UserState = 'INACTIVE' | 'INITIALIZED' | 'ACTIVE';

export default class MusicPlayerService {
    private spotify_client_id: string;
    private spotify_client_secret: string;
    private botID: string;

    private players: Map<string, SpotifyPlayer> = new Map<string, SpotifyPlayer>();
    private generic_players: Map<string, GenericPlayer> = new Map<string, GenericPlayer>();
    private users: Map<string, SpotifyUser> = new Map<string, SpotifyUser>();
    private update_ignore: Map<string, boolean> = new Map<string, boolean>();

    constructor() {
        this.spotify_client_id = Spoticord.config.get('spotify_client_id');
        this.spotify_client_secret = Spoticord.config.get('spotify_client_secret');
        this.botID = Spoticord.client.user.id;
        
        Spoticord.client.on('voiceStateUpdate', this.onVoiceStateUpdate.bind(this));
    }

    protected async onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
        if (oldState.id === this.botID) {
            if (this.update_ignore.has(oldState.guild.id) && this.update_ignore.get(oldState.guild.id)) {
                this.update_ignore.set(oldState.guild.id, false);
                return;
            }

            if (oldState.channelId && !newState.channelId) {
                // Bot LEFT voice channel
                if (this.players.has(oldState.guild.id)) {
                    await this.players.get(oldState.guild.id).leave();

                    this.players.delete(oldState.guild.id);
                }
            } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
                // Bot MOVED voice channel
                
                await this.players.get(newState.guild.id).updateChannel(newState.channel as VoiceChannel);
            }

            return;
        }

        if (this.players.has(oldState.guild.id)) { // Old state was in a guild where music is playing
            const player = this.players.get(oldState.guild.id);

            if (player.voice_channel.id === oldState.channelId && player.voice_channel.id !== newState.channelId) { // User got out of channel with bot
                player.userLeft(oldState.id);
            }
        }

        if (this.players.has(newState.guild.id)) {
            const player = this.players.get(newState.guild.id);

            if (player.voice_channel.id === newState.channelId && player.voice_channel.id !== oldState.channelId) {
                await player.userJoined(newState.id);
            }
        }
    }

    public getPlayerState(guild_id: string): MusicPlayerState {
        if (!this.players.has(guild_id)) return 'DISCONNECTED';
        
        return 'PLAYING';
    }

    public getPlayerChannel(guild_id: string): VoiceChannel | null {
        if (!this.players.has(guild_id)) return null;

        return this.players.get(guild_id).voice_channel;
    }

    public getPlayerHost(guild_id: string): SpotifyUser | null {
        if (!this.players.has(guild_id)) return null;

        return this.players.get(guild_id).getHost();
    }

    public getUser(user_id: string): SpotifyUser | null {
        if (!this.users.has(user_id)) return null;

        return this.users.get(user_id);
    }

    public getUserState(user_id: string): UserState {
        return this.users.has(user_id) ? this.users.get(user_id).getState() : 'INACTIVE';
    }

    public toggle247(guild_id: string): boolean {
        if (!this.players.has(guild_id)) return false;

        const player = this.players.get(guild_id);
        return player.toggle247();
    }

    public async playerUserJoin(guild_id: string, user_id: string) {
        if (!this.players.has(guild_id)) return;

        const player = this.players.get(guild_id);
        await player.userJoined(user_id);
    }

    public createUser(user_id: string): SpotifyUser {
        if (this.users.has(user_id)) return this.users.get(user_id);

        const spotifyUser = new SpotifyUser(user_id, Spoticord.database, this.spotify_client_id, this.spotify_client_secret);
    
        this.users.set(user_id, spotifyUser);

        return spotifyUser;
    }

    public destroyUser(user_id: string) {
        if (!this.users.has(user_id)) return;

        const user = this.users.get(user_id);

        user.destroy();

        this.users.delete(user_id);
    }

    public async joinChannel(guild_id: string, voice_channel: VoiceChannel, text_channel: TextChannel): Promise<SpotifyPlayer> {
        if (this.players.has(guild_id)) return this.players.get(guild_id);

        const player = new SpotifyPlayer(guild_id, voice_channel, text_channel);

        await player.join();

        this.players.set(guild_id, player);

        return player;
    }

    public async joinWithProvider(guild: string, voice: string, text: string) {
        if (this.generic_players.has(guild)) return this.generic_players.get(guild);

        const player = await GenericPlayer.create(guild, voice, text);
    
        this.generic_players.set(guild, player);

        return player;
    }

    public async leaveGuild(guild_id: string, afk: boolean = false) {
        if (!this.players.has(guild_id)) return;

        // Prevent race condition with the onVoiceStateUpdate cb
        this.update_ignore.set(guild_id, true);

        const player = this.players.get(guild_id);
        await player.leave();

        this.players.delete(guild_id);

        if (afk) {
            try {
                await player.text_channel.send({
                    embeds: [new MessageEmbed({
                        description: 'I left the voice channel because of inactivity',
                        author: {name: 'Left voice channel'},
                        color: '#d61516'
                    })]
                });
            } catch (ex) {}
        }
    }

    public getTrackInfo(guild_id: string): [Track, LavaTrack] | null {
        if (!this.players.has(guild_id)) return null;

        const player = this.players.get(guild_id);
        return player.getTrackInfo();
    }

    public getDiscordUser(discord_id: string): User | null {
        return Spoticord.client.users.cache.get(discord_id)
    }

    public getPlayers(): SpotifyPlayer[] {
        return Array.from(this.players.values());
    }

    public getPlayer(guild_id: string): SpotifyPlayer {
        return this.players.get(guild_id) || null;
    }
}