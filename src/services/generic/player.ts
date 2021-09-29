import { Guild, StageChannel, TextChannel, VoiceChannel } from "discord.js";
import Spoticord from "../spoticord";
import { SDC, TokenManager, Track as SDCTrack, Track } from "@spoticord/nodesdc";
import { ISCPlayer } from "../provider";
import GenericUser from "./user";

export default class GenericPlayer {
  private constructor(public readonly guildId: string, public readonly voiceId: string, public readonly textId: string) {}

  private _guild: Guild;
  private _voice: VoiceChannel | StageChannel;
  private _text: TextChannel;

  private player: ISCPlayer;
  private users = new Map<string, GenericUser>();
  private host: GenericUser;

  private currentTrack: Track;
  private paused: boolean;

  private kickTimeout: NodeJS.Timeout;
  private stayForever: boolean = false;

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

  public get text() {
    if (this._text) return this._text;
    this._text = this.guild.channels.cache.get(this.textId) as TextChannel;
    return this._text;
  }

  private instantiateMembers() {
    for (const member of this.voice.members.values()) {
      this.instantiateMember(member.id);
    }
  }

  private async createPlayer() {
    this.player = await Spoticord.provider.createPlayer(this);

    this.tryStartPlayerKickTimeout();
  }

  private async instantiateMember(member: string) {
    const token = await Spoticord.database.getToken(member);
    if (!token) return;

    const tokenMan = TokenManager.create()
      .setAccessToken(token.access_token)
      .setRefreshToken(token.refresh_token)
      .setClientCredentials(Spoticord.config.get("spotify_client_id"), Spoticord.config.get("spotify_client_secret"));

    const dealer = new SDC(tokenMan);

    tokenMan.on("token", async (token: string) => {
      await Spoticord.database.updateAccessToken(member, token);
    });

    dealer.on("ready", async () => {
      const deviceName = (await Spoticord.database.getDeviceName(member)) || "Spoticord";

      if (!(await dealer.createDevice(deviceName))) {
        dealer.close();
        return;
      }

      this.users.get(member).state = "IDLE";
    });

    const user = new GenericUser(member, dealer, "CONNECTING");

    dealer.on("close", () => {
      if (this.host === user) {
        // Clear host & set new host (if other is applicable)
        this.host = [...this.users.values()].filter((u) => u.userId !== this.host.userId && u.state === "ACTIVE")[0];
      }

      if (!this.host) {
        // If no new host was found we should stop the player
        this.getActiveUsers().forEach((u) => u.pausePlayback());

        this.paused = true;
        this.player.stop();
      }

      Spoticord.music_service.onUserOffline(user.userId);

      this.users.delete(member);
    });

    dealer.on("activate", this.onDeviceActivate.bind(this, user));
    dealer.on("play", this.onPlayTrack.bind(this, user));
    dealer.on("pause", this.onPause.bind(this, user));
    dealer.on("resume", this.onResume.bind(this, user));
    dealer.on("seek", this.onSeek.bind(this, user));
    dealer.on("stop", this.onStop.bind(this, user));
    dealer.on('volume', this.onVolumeChanged.bind(this, user));
    dealer.on("fetch-pos", this.onFetchPosition.bind(this, user));

    Spoticord.music_service.onUserOnline(user.userId, this);

    this.users.set(member, user);

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
    user.state = "ACTIVE";

    if (this.host) return;

    this.host = user;
  }

  private onPlayTrack(user: GenericUser, { position, paused, track }: { position: number; paused: boolean; track: SDCTrack }) {
    if (!user || this.host !== user) return;

    this.currentTrack = track;

    this.getActiveUsers(true).forEach((u) => u.playTrack(track.metadata.uri));

    this.paused = paused;
    this.player.play(track, position, paused);

    paused ? this.tryStartPlayerKickTimeout() : this.stopPlayerKickTimeout();
  }

  private onPause(user: GenericUser) {
    if (!user || this.host !== user) return;

    this.getActiveUsers(true).forEach((u) => u.pausePlayback());

    this.paused = true;
    this.player.pause();

    this.tryStartPlayerKickTimeout();
  }

  private onResume(user: GenericUser) {
    if (!user || this.host !== user) return;

    this.getActiveUsers(true).forEach((u) => u.resumePlayback());

    this.paused = false;
    this.player.resume();

    this.stopPlayerKickTimeout();
  }

  private onSeek(user: GenericUser, position: number) {
    if (!user || this.host !== user) return;

    this.getActiveUsers(true).forEach((u) => u.seekPlayback(position));

    this.player.seek(position);
  }

  private onStop(user: GenericUser) {
    user.state = "IDLE";

    if (this.host === user) {
      // Clear host & set new host (if other is applicable)
      this.host = [...this.users.values()].filter((u) => u.userId !== this.host.userId && u.state === "ACTIVE")[0];
    }

    if (!this.host) {
      // If no new host was found we should stop the player
      this.getActiveUsers().forEach((u) => u.pausePlayback());

      this.paused = true;
      this.player.stop();

      this.tryStartPlayerKickTimeout();
    }
  }

  private onVolumeChanged(user: GenericUser, volume: number) {
    if (!user || this.host !== user) return;

    this.player.setVolume(volume);
  }

  private onFetchPosition(user: GenericUser, resolve: (pos: number) => void) {
    this.player.getPosition().then(resolve);
  }

  // END AREA: Event handlers

  // START AREA: Timeout handler

  // Start the player kick timer
  protected tryStartPlayerKickTimeout() {
    if (this.stayForever || this.voice.members.size === 2) {
      this.stopPlayerKickTimeout();
      return;
    }

    if (this.kickTimeout) return;

    this.kickTimeout = setTimeout(() => {
      if (this.voice.members.size === 2) return;

      if (this.stayForever) return;

      Spoticord.music_service.leaveGuild(this.guildId, 'AFK');
    }, 5 * 60 * 1000);
  }

  // Cancel the player kick timer
  private stopPlayerKickTimeout() {
    if (!this.kickTimeout) return;

    clearTimeout(this.kickTimeout);
    this.kickTimeout = null;
  }

  // END AREA: Timeout handler

  private getActiveUsers(nohost = false) {
    return [...this.users.values()].filter((u) => nohost && u.userId !== this.host?.userId && u.state === "ACTIVE");
  }

  public advanceNext(skipped: boolean = false) {
    if (!this.host) return;

    this.host.dealer.nextTrack(skipped);
  }

  public advancePrevious() {
    if (!this.host) return;

    this.host.dealer.previousTrack();
  }

  public async destroy() {
    await this.player.destroy();

    // TODO: Stop kick timer
    this.users.forEach((v) => v.dealer.close());
  }

  public async onUserVoiceJoined(user: string) {
    await this.instantiateMember(user);

    this.tryStartPlayerKickTimeout();
  }

  public onUserVoiceLeft(user: string) {
    const users = [...this.users.values()];
    users.find((u) => u.userId === user)?.dealer.close();

    this.tryStartPlayerKickTimeout();
  }

  public getHost() {
    return this.host;
  }

  public isPaused() {
    return this.paused;
  }

  public getTrack() {
    return this.currentTrack;
  }

  public async getPosition() {
    return await this.player.getPosition();
  }

  public toggleStay() {
    this.stayForever = !this.stayForever;
    this.stayForever ? this.stopPlayerKickTimeout() : this.tryStartPlayerKickTimeout();

    return this.stayForever;
  }

  public getUser(user: string): GenericUser | undefined {
    return this.users.get(user);
  }
}
