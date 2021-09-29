import { MessageEmbed, TextChannel } from "discord.js";
import { Player, Track as LavaTrack, TrackEndEvent } from "erela.js";
import { Track } from "@spoticord/nodesdc";
import { ISCPlayer } from "../../services/provider";
import Spoticord from "../../services/spoticord";
import GenericPlayer from "../../services/generic/player";
import LavalinkMusicProvider from "./LavalinkMusicProvider";

export default class LavalinkMusicPlayer implements ISCPlayer {
  private readonly player: Player;

  private current_youtube_track: LavaTrack;
  private current_spotify_track: Track;

  private overridePosition: number = -1;

  public constructor(
    private readonly provider: LavalinkMusicProvider,
    private readonly generic: GenericPlayer
  ) {
    this.player = provider.manager.create({
      guild: generic.guildId,
      textChannel: generic.textId,
      voiceChannel: generic.voiceId,
      selfDeafen: true,
      node: provider.manager.nodes.first().options.identifier,
    });

    this.player.connect();

    this.onPlayerEnd = this.onPlayerEnd.bind(this);

    provider.manager.on("queueEnd", this.onPlayerEnd);

    this.player.setVolume(40);
  }

  public async play(track: Track, position = 0, paused = false) {
    const search = `${track.metadata.authors.map((author_name) => author_name.name).join(", ")} - ${track.metadata.name}`;

    let track_list: LavaTrack[];

    for (var i = 0; i < 3; i++) {
      const result = await this.provider.manager.search(search);
      track_list = result.tracks;

      if (track_list.length > 0) break;
    }

    if (track_list.length < 1) {
      await (Spoticord.client.guilds.cache.get(this.generic.guildId).channels.cache.get(this.generic.textId) as TextChannel).send({
        embeds: [
          new MessageEmbed({
            description: `No track found for ${search}`,
            color: "#D61516",
          }),
        ],
      });

      this.generic.advanceNext();

      return;
    }

    this.current_youtube_track = track_list[0];
    this.current_spotify_track = track;

    await this.player.play(this.current_youtube_track, { startTime: this.spotify_to_yt(position) });

    if (paused) {
      this.overridePosition = this.spotify_to_yt(position);
      setTimeout(() => this.player.pause(true), 100);
    }
  }

  public pause() {
    this.player.pause(true);
  }

  public resume() {
    this.player.pause(false);
  }

  public seek(position: number) {
    this.player.seek(this.spotify_to_yt(position));
  }

  public stop() {
    this.player.stop();
  }

  public getPosition() {
    let position = this.player.position;
    if (this.overridePosition > -1 && !position) {
      position = this.overridePosition;
      this.overridePosition = -1;
    }

    return Promise.resolve(this.yt_to_spotify(position));
  }

  public destroy() {
    this.player.destroy();
    this.provider.manager.off("queueEnd", this.onPlayerEnd);
  
    return Promise.resolve();
  }

  private onPlayerEnd(player: Player, track: LavaTrack, data: TrackEndEvent) {
    if (player.guild !== this.generic.guildId) return;

    if (data.reason === "REPLACED") return;
    if (data.reason === "CLEANUP") return;
    if (data.reason === "STOPPED") {
      this.current_spotify_track = null;
      this.current_youtube_track = null;
      return;
    }

    // if (!this.host || !this.player) return;

    this.generic.advanceNext();
  }

  // Convert the Spotify song position to the YouTube song position
  private spotify_to_yt(position: number): number {
    return (position / this.current_spotify_track?.metadata.duration) * this.current_youtube_track?.duration;
  }

  // Convert the YouTube song position to the Spotify song position
  private yt_to_spotify(position: number): number {
    return (position / this.current_youtube_track?.duration) * this.current_spotify_track?.metadata.duration;
  }
}
