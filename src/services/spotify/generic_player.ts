import { Guild, GuildChannel, GuildMember, StageChannel, VoiceChannel } from "discord.js";
import LavalinkMusicPlayer from "../../providers/lavalink/LavalinkMusicPlayer";
import LavalinkMusicProvider from "../../providers/lavalink/LavalinkMusicProvider";
import { ISCProvider } from "../provider";
import Spoticord from "../spoticord";
import { SDC, TokenManager } from 'nodesdc';

export default class GenericPlayer {
  private constructor(private readonly guildId: string, private readonly voiceId: string) {}

  private _guild: Guild;
  private _voice: VoiceChannel | StageChannel;

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

  private async instantiateMember(member: GuildMember) {
    const token = await Spoticord.database.getToken(member.id);
    if (!token) return;
    
    const dealer = new SDC(TokenManager.create().setAccessToken(token.access_token).setRefreshToken(token.refresh_token).setClientCredentials(
      Spoticord.config.get('spotify_client_id'), Spoticord.config.get('spotify_client_secret')
    ));

    await dealer.connect();
  }

  public static create(guild: string, voice: string): GenericPlayer {
    const player = new GenericPlayer(guild, voice);

    player.instantiateMembers();

    return player;
  }
}