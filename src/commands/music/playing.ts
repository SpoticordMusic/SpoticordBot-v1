import { SlashCommandBuilder } from "@discordjs/builders";
import { ButtonInteraction, Message, MessageActionRow, MessageButton, MessageEmbed } from "discord.js";
import Spoticord, { ICommandExec } from "../../services/spoticord";
import { promisify } from "util";

const wait = promisify(setTimeout);

async function execute({ member, reply }: ICommandExec) {
  if (Spoticord.music_service.getPlayerState(member.guild.id) === "DISCONNECTED") {
    return await reply({
      embeds: [
        new MessageEmbed({
          description: "The bot is currently not connected to any voice channel",
          author: {
            name: "Cannot get track info",
            icon_url:
              "https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Forbidden_Symbol_Transparent.svg/1200px-Forbidden_Symbol_Transparent.svg.png",
          },
          color: "#d61516",
        }),
      ],
      ephemeral: true,
    });
  }

  const host = Spoticord.music_service.getPlayerHost(member.guild.id);

  if (!host) {
    return await reply({
      embeds: [
        new MessageEmbed({
          description: "The bot is currently not playing anything",
          author: {
            name: "Cannot get track info",
            icon_url:
              "https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Forbidden_Symbol_Transparent.svg/1200px-Forbidden_Symbol_Transparent.svg.png",
          },
          color: "#d61516",
        }),
      ],
      ephemeral: true,
    });
  }

  return await await reply(buildPlayingEmbed(member.guild.id, host.discord_id));
}

async function button(interaction: ButtonInteraction) {
  switch (interaction.customId) {
    case "playing::btn_previous_track":
      await previousTrack(interaction);
      break;

    case "playing::btn_pause_play":
      await pausePlayTrack(interaction);
      break;

    case "playing::btn_next_track":
      await nextTrack(interaction);
      break;
  }
}

async function previousTrack(interaction: ButtonInteraction) {
  const player = Spoticord.music_service.getPlayer(interaction.guildId);
  if (!player) return await interaction.update({ content: "idk what happened here" });
  if (
    !player.getHost() ||
    Spoticord.music_service.getPlayerState(interaction.guildId) === "DISCONNECTED" ||
    Spoticord.music_service.getPlayerState(interaction.guildId) === "INACTIVE"
  )
    return await interaction.update({ content: "idk what happened here (2)" });

  const host = player.getHost();
  if (interaction.user.id !== host.discord_id) {
    return await interaction.reply({
      ephemeral: true,
      content: "You must be the host to use the media buttons",
    });
  }

  if (await player.seek(0)) await updatePlayingMessage(interaction);
}

async function pausePlayTrack(interaction: ButtonInteraction) {
  const player = Spoticord.music_service.getPlayer(interaction.guildId);
  if (!player) return await interaction.update({ content: "idk what happened here" });
  if (
    !player.getHost() ||
    Spoticord.music_service.getPlayerState(interaction.guildId) === "DISCONNECTED" ||
    Spoticord.music_service.getPlayerState(interaction.guildId) === "INACTIVE"
  )
    return await interaction.update({ content: "idk what happened here (2)" });

  const host = player.getHost();
  if (interaction.user.id !== host.discord_id) {
    return await interaction.reply({
      ephemeral: true,
      content: "You must be the host to use the media buttons",
    });
  }

  if (player.getPlayerInfo().paused) {
    if (await player.resume()) await updatePlayingMessage(interaction);
  } else {
    if (await player.pause()) await updatePlayingMessage(interaction);
  }
}

async function nextTrack(interaction: ButtonInteraction) {
  const player = Spoticord.music_service.getPlayer(interaction.guild.id);
  if (!player) await interaction.deleteReply();
  if (
    !player.getHost() ||
    Spoticord.music_service.getPlayerState(interaction.guild.id) === "DISCONNECTED" ||
    Spoticord.music_service.getPlayerState(interaction.guild.id) === "INACTIVE"
  )
    return await interaction.deferUpdate();

  const host = player.getHost();
  if (interaction.user.id !== host.discord_id)
    return await interaction.reply({
      content: "You must be the host to use the media buttons",
      ephemeral: true,
    });

  if (await player.next()) {
    await interaction.deferUpdate();
    await wait(2500);
    await updatePlayingMessage(interaction, true);
  }
}

async function updatePlayingMessage(button: ButtonInteraction, dont_defer: boolean = false) {
  try {
    const message = button.message as Message;
    if (!message.editable) return;

    if (Spoticord.music_service.getPlayerState(message.guild.id) === "DISCONNECTED") {
      return await message.edit({
        embeds: [
          new MessageEmbed({
            description: "The bot is currently not connected to any voice channel",
            author: {
              name: "Cannot get track info",
              icon_url:
                "https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Forbidden_Symbol_Transparent.svg/1200px-Forbidden_Symbol_Transparent.svg.png",
            },
            color: "#d61516",
          }),
        ],
      });
    }

    const host = Spoticord.music_service.getPlayerHost(message.guild.id);

    if (!host) {
      return await message.edit({
        embeds: [
          new MessageEmbed({
            description: "The bot is currently not playing anything",
            author: {
              name: "Cannot get track info",
              icon_url:
                "https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Forbidden_Symbol_Transparent.svg/1200px-Forbidden_Symbol_Transparent.svg.png",
            },
            color: "#d61516",
          }),
        ],
      });
    }

    return await message.edit(buildPlayingEmbed(message.guild.id, host.discord_id));
  } catch (ex) {
    console.debug(ex);
  } finally {
    if (dont_defer) return;
    try {
      await button.deferUpdate();
    } catch {}
  }
}

function buildPlayingEmbed(guild: string, host: string) {
  const [spotify_track, youtube_track] = Spoticord.music_service.getTrackInfo(guild);
  const authors = spotify_track.metadata.authors.map((author) => author.name).join(", ");

  const dcUser = Spoticord.music_service.getDiscordUser(host);

  const player_info = Spoticord.music_service.getPlayer(guild)?.getPlayerInfo();
  const isPaused = player_info?.paused ?? true;

  const quadrant = Math.floor((player_info?.position / player_info?.youtube_track.duration) * 20) ?? -1;

  let positionText = "";

  for (var i = 0; i < 20; i++) {
    positionText += i === quadrant ? "🔵" : "▬";
  }

  positionText = `${isPaused ? "⏸️" : "▶️"} ${positionText}\n ${_strtime(Math.floor(player_info.position / 1000))} / ${_strtime(
    Math.floor(player_info.youtube_track.duration / 1000)
  )}`;

  const prev_button = new MessageButton().setStyle("PRIMARY").setLabel("<<").setCustomId("playing::btn_previous_track");

  const pause_resume_button = new MessageButton()
    .setStyle("SECONDARY")
    .setLabel(isPaused ? "Play" : "Pause")
    .setCustomId("playing::btn_pause_play");

  const next_button = new MessageButton().setStyle("PRIMARY").setLabel(">>").setCustomId("playing::btn_next_track");

  const actionRow = new MessageActionRow().addComponents(prev_button, pause_resume_button, next_button);

  return {
    embeds: [
      new MessageEmbed({
        author: {
          name: "Currently Playing",
          icon_url: "https://www.freepnglogos.com/uploads/spotify-logo-png/file-spotify-logo-png-4.png",
        },
        title: `${authors} - ${spotify_track.metadata.name}`,
        url: `https://open.spotify.com/track/${spotify_track.metadata.uri.split(":")[2]}`,
        description: `Click **[here](${youtube_track.uri})** for the YouTube version\n\n${positionText}`,
        footer: dcUser ? { text: `${dcUser.username}`, icon_url: dcUser.avatarURL() } : undefined,
        color: "#0773d6",
        thumbnail: {
          url: spotify_track.metadata.images.sort((a, b) => -(a.width * a.height - b.width * b.height))[0].url,
        },
      }),
    ],
    components: [actionRow],
  };
}

function _strtime(time: number): string {
  const HOUR = 3600;
  const MIN = 60;

  if (time / HOUR >= 1) {
    return `${Math.floor(time / HOUR)}h${Math.floor((time % HOUR) / MIN)}m${(time % HOUR) % MIN}s`;
  } else if (time / MIN >= 1) {
    return `${Math.floor(time / MIN)}m${time % MIN}s`;
  } else {
    return `${time}s`;
  }
}

export default {
  data: new SlashCommandBuilder().setName("playing").setDescription("Display which song is currently being played"),
  execute,
  button,
};
