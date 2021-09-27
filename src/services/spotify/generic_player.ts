import { Guild, GuildMember, StageChannel, VoiceChannel } from "discord.js";
import Spoticord from "../spoticord";
import { SDC, TokenManager, Track as SDCTrack } from '@spoticord/nodesdc';
import { ISCPlayer } from "../provider";
import GenericUser from "./generic_user";

// TODO:
//  - Communicate with music service
//  - Add 24/7 (stay) toggle
//  - Add kick timeout
//  - Probably some other shit
//  - I am tired

export default class GenericPlayer {
  private constructor(public readonly guildId: string, public readonly voiceId: string, public readonly textId: string) {}

  private _guild: Guild;
  private _voice: VoiceChannel | StageChannel;
  
  private player: ISCPlayer;
  private users = new Map<string, GenericUser>();
  private host: GenericUser;

  private get guild() {
    if (this._guild) return this._guild;
    this._guild = Spoticord.client.guilds.cache.get(this.guildId);
    return this._guild;
  }

  private get voice() {
    if (this._voice) return this._voice;
    this._voice = this.guild.channels.cache.get(this.voiceId) as VoiceChannel | StageChannel;
    return this._voice;
  }

  private instantiateMembers() {
    for (const member of this.voice.members.values()) {
      this.instantiateMember(member);
    }
  }

  private async createPlayer() {
    this.player = await Spoticord.provider.createPlayer(this);
  }

  private async instantiateMember(member: GuildMember) {
    const token = await Spoticord.database.getToken(member.id);
    if (!token) return;
    
    const tokenMan = TokenManager.create().setAccessToken(token.access_token).setRefreshToken(token.refresh_token).setClientCredentials(
      Spoticord.config.get('spotify_client_id'), Spoticord.config.get('spotify_client_secret')
    )

    const dealer = new SDC(tokenMan);

    tokenMan.on('token', async (token: string) => {
      await Spoticord.database.updateAccessToken(member.id, token);
    });

    dealer.on('ready', async () => {
      const deviceName = await Spoticord.database.getDeviceName(member.id) || 'Spoticord';
      
      if (!await dealer.createDevice(deviceName)) {        
        dealer.close();
        return;
      }

      this.users.get(member.id).state = 'IDLE';
    });

    dealer.on('close', () => {
      if (this.host.userId === member.id) {
        // Clear host & set new host (if other is applicable)
        this.host = [...this.users.values()].filter(u => u.userId !== this.host.userId && u.state === 'ACTIVE')[0];
      }

      // TODO: Notify music service that user has gone offline

      this.users.delete(member.id);
    });

    const user = new GenericUser(member.id, dealer, 'CONNECTING');

    dealer.on('activate', this.onDeviceActivate.bind(this, user));
    dealer.on('play', this.onPlayTrack.bind(this, user));
    dealer.on('pause', this.onPause.bind(this, user));
    dealer.on('resume', this.onResume.bind(this, user));
    dealer.on('seek', this.onSeek.bind(this, user));
    dealer.on('stop', this.onStop.bind(this, user));
    dealer.on('fetch-pos', this.onFetchPosition.bind(this, user));

    // TODO: Notify music service that user has come online

    this.users.set(member.id, user);

    await dealer.connect();
  }

  public static async create(guild: string, voice: string, text: string): Promise<GenericPlayer> {
    const player = new GenericPlayer(guild, voice, text);

    player.instantiateMembers();
    await player.createPlayer();

    return player;
  }

  // START AREA: Event Handlers

  private onDeviceActivate(user: GenericUser) {
    user.state = 'ACTIVE';
    
    if (this.host) return;

    this.host = user;
  }

  private onPlayTrack(user: GenericUser, {position, paused, track}: {position: number, paused: boolean, track: SDCTrack}) {
    if (!user || this.host !== user) return;

    this.getActiveUsers(true).forEach(u => u.playTrack(track.metadata.uri));

    this.player.play(track, position, paused);
  }

  private onPause(user: GenericUser) {
    if (!user || this.host !== user) return;

    this.getActiveUsers(true).forEach(u => u.pausePlayback());
  
    this.player.pause();
  }

  private onResume(user: GenericUser) {
    if (!user || this.host !== user) return;

    this.getActiveUsers(true).forEach(u => u.resumePlayback());

    this.player.resume();
  }

  private onSeek(user: GenericUser, position: number) {
    if (!user || this.host !== user) return;

    this.getActiveUsers(true).forEach(u => u.seekPlayback(position));
  
    this.player.seek(position);
  }

  private onStop(user: GenericUser) {
    user.state = 'IDLE';

    if (!user || this.host !== user) return;

    this.getActiveUsers(true).forEach(u => u.pausePlayback());

    this.player.stop();
  }

  private onFetchPosition(user: GenericUser, resolve: (pos: number) => void) {
    this.player.getPosition().then(resolve);  
  }

  private getActiveUsers(nohost = false) {
    return [...this.users.values()].filter(u => (nohost || u.userId !== this.host.userId) && u.state === 'ACTIVE');
  }

  public advanceNext() {
    if (!this.host) return;

    this.host.dealer.nextTrack(false);
  }
}