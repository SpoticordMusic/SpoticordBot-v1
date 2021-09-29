import { MessageEmbed, VoiceState } from "discord.js";
import Spoticord from "./spoticord";
import GenericPlayer from "./generic/generic_player";

export default class MusicPlayerService {
  private generic_players: Map<string, GenericPlayer> = new Map<string, GenericPlayer>();
  private generic_users: Map<string, GenericPlayer> = new Map<string, GenericPlayer>();

  //private update_ignore: Map<string, boolean> = new Map<string, boolean>();

  constructor() {
    Spoticord.client.on("voiceStateUpdate", this.onVoiceStateUpdate.bind(this));
  }

  protected async onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    if (oldState.id === Spoticord.client.user.id) {
      // if (this.update_ignore.has(oldState.guild.id) && this.update_ignore.get(oldState.guild.id)) {
      //     this.update_ignore.set(oldState.guild.id, false);
      //     return;
      // }

      if (oldState.channelId && !newState.channelId) {
        // Bot LEFT voice channel
        if (this.generic_players.has(oldState.guild.id)) {
          await this.generic_players.get(oldState.guild.id).destroy();

          this.generic_players.delete(oldState.guild.id);
        }
      } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        // Bot MOVED voice channel
        // Due to a bug in a library used for the Lavalink provider moving the bot is not yet supported

        // TODO: Move player instead of killing it
        await this.generic_players.get(newState.guild.id).destroy();
      }

      return;
    }

    if (this.generic_players.has(oldState.guild.id)) {
      // Old state was in a guild where music is playing
      const player = this.generic_players.get(oldState.guild.id);

      if (player.voiceId === oldState.channelId && player.voiceId !== newState.channelId) {
        // User got out of channel with bot
        player.onUserVoiceLeft(oldState.id);
      }
    }

    if (this.generic_players.has(newState.guild.id)) {
      const player = this.generic_players.get(newState.guild.id);

      if (player.voiceId === newState.channelId && player.voiceId !== oldState.channelId) {
        await player.onUserVoiceJoined(newState.id);
      }
    }
  }

  public onUserOnline(user: string, player: GenericPlayer) {
    this.generic_users.set(user, player);
  }

  public onUserOffline(user: string) {
    this.generic_users.delete(user);
  }

  public async onDeviceRenamed(user: string, name: string) {
    const player = this.generic_users.get(user);
    if (!player) return;

    const gUser = player.getUser(user);
    if (!gUser || gUser.state !== "ACTIVE") await gUser.dealer.createDevice(name);
  }

  public userIsOnline(user: string) {
    return this.generic_users.has(user);
  }

  public playerIsOnline(guild: string) {
    return this.generic_players.has(guild);
  }

  public getPlayer(guild: string): GenericPlayer | undefined {
    return this.generic_players.get(guild) || undefined;
  }

  public getPlayers() {
    return [...this.generic_players.values()];
  }

  public async playerUserJoin(guild: string, user: string) {
    const player = this.generic_players.get(guild);
    if (!player) return;

    await player.onUserVoiceJoined(user);
  }

  public playerUserLeft(user: string) {
    const player = this.generic_users.get(user);
    if (!player) return;

    player.onUserVoiceLeft(user);
  }

  public async leaveGuild(guild: string, afk: boolean = false) {
    const player = this.generic_players.get(guild);
    if (!player) return;

    await player.destroy();

    if (afk) {
      try {
        await player.text.send({
          embeds: [
            new MessageEmbed({
              description: "I left the voice channel because of inactivity",
              author: { name: "Left voice channel" },
              color: "#d61516",
            }),
          ],
        });
      } catch (ex) {}
    }
  }

  public async joinWithProvider(guild: string, voice: string, text: string) {
    if (this.generic_players.has(guild)) return this.generic_players.get(guild);

    const player = await GenericPlayer.create(guild, voice, text);

    this.generic_players.set(guild, player);

    return player;
  }
}
