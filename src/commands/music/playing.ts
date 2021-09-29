import { SlashCommandBuilder } from "@discordjs/builders";
import { ButtonInteraction, Message, MessageActionRow, MessageButton, MessageEmbed } from "discord.js";
import Spoticord, { ICommand, ICommandExec } from "../../services/spoticord";
import { promisify } from "util";

const wait = promisify(setTimeout);

async function execute({ member, reply }: ICommandExec) {
  if (!Spoticord.music_service.playerIsOnline(member.guild.id)) {
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

  const host = Spoticord.music_service.getPlayer(member.guild.id).getHost();

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

  return await await reply(await buildPlayingEmbed(member.guild.id, host.userId));
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
  if (!player.getHost() || !Spoticord.music_service.playerIsOnline(interaction.guildId))
    return await interaction.update({ content: "idk what happened here (2)" });

  const host = player.getHost();
  if (interaction.user.id !== host.userId) {
    return await interaction.reply({
      ephemeral: true,
      content: "You must be the host to use the media buttons",
    });
  }

  if (await host.seekPlayback(0)) await updatePlayingMessage(interaction);
}

async function pausePlayTrack(interaction: ButtonInteraction) {
  const player = Spoticord.music_service.getPlayer(interaction.guildId);
  if (!player) return await interaction.update({ content: "idk what happened here" });
  if (!player.getHost() || !Spoticord.music_service.playerIsOnline(interaction.guildId))
    return await interaction.update({ content: "idk what happened here (2)" });

  const host = player.getHost();
  if (interaction.user.id !== host.userId) {
    return await interaction.reply({
      ephemeral: true,
      content: "You must be the host to use the media buttons",
    });
  }

  if (player.isPaused()) {
    if (await host.resumePlayback()) await updatePlayingMessage(interaction);
  } else {
    if (await host.pausePlayback()) await updatePlayingMessage(interaction);
  }
}

async function nextTrack(interaction: ButtonInteraction) {
  const player = Spoticord.music_service.getPlayer(interaction.guild.id);
  if (!player) await interaction.deleteReply();
  if (!player.getHost() || !Spoticord.music_service.playerIsOnline(interaction.guild.id))
    return await interaction.deferUpdate();

  const host = player.getHost();
  if (interaction.user.id !== host.userId)
    return await interaction.reply({
      content: "You must be the host to use the media buttons",
      ephemeral: true,
    });

  player.advanceNext();
  await interaction.deferUpdate();
  await wait(2500);
  await updatePlayingMessage(interaction, true);
}

async function updatePlayingMessage(button: ButtonInteraction, dont_defer: boolean = false) {
  try {
    const message = button.message as Message;
    if (!message.editable) return;

    if (!Spoticord.music_service.playerIsOnline(message.guild.id)) {
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

    const host = Spoticord.music_service.getPlayer(message.guild.id).getHost();

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

    return await message.edit(await buildPlayingEmbed(message.guild.id, host.userId));
  } catch (ex) {
    console.debug(ex);
  } finally {
    if (dont_defer) return;
    try {
      await button.deferUpdate();
    } catch {}
  }
}

async function buildPlayingEmbed(guild: string, host: string) {
  const track = Spoticord.music_service.getPlayer(guild).getTrack();
  const authors = track.metadata.authors.map((author) => author.name).join(", ");

  const dcUser = Spoticord.client.users.cache.get(host);
  const player = Spoticord.music_service.getPlayer(guild);

  const position = await player.getPosition();
  const isPaused = player.isPaused();

  const quadrant = Math.floor((position / track.metadata.duration) * 20) ?? -1;

  let positionText = "";

  for (var i = 0; i < 20; i++) {
    positionText += i === quadrant ? "🔵" : "▬";
  }

  positionText = `${isPaused ? "⏸️" : "▶️"} ${positionText}\n ${_strtime(Math.floor(position / 1000))} / ${_strtime(
    Math.floor(track.metadata.duration / 1000)
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
        title: `${authors} - ${track.metadata.name}`,
        url: `https://open.spotify.com/track/${track.metadata.uri.split(":")[2]}`,
        description: positionText,
        footer: dcUser ? { text: `${dcUser.username}`, icon_url: dcUser.avatarURL() } : undefined,
        color: "#0773d6",
        thumbnail: {
          url: track.metadata.images.sort((a, b) => -(a.width * a.height - b.width * b.height))[0].url,
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
  requires: ["guild"],
} as ICommand;
