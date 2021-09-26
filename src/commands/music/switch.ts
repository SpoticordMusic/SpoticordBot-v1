import { SlashCommandBuilder } from '@discordjs/builders'
import { MessageEmbed } from 'discord.js'
import Spoticord, { ICommand, ICommandExec } from '../../services/spoticord'

async function execute({ guild, member, reply }: ICommandExec) {
  if (Spoticord.music_service.getPlayerState(guild.id) === "DISCONNECTED") {
    return await reply({
      embeds: [
        new MessageEmbed({
          description: "The bot is currently not connected to any voice channel",
          author: {
            name: "Cannot switch player",
            icon_url:
              "https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Forbidden_Symbol_Transparent.svg/1200px-Forbidden_Symbol_Transparent.svg.png",
          },
          color: "#d61516",
        }),
      ],
      ephemeral: true,
    });
  }

  const user = Spoticord.music_service.getUser(member.user.id);
  if (!user) {
    return await reply({
      embeds: [
        new MessageEmbed({
          description: "Spoticord is currently not activated on your Spotify",
          author: {
            name: "Cannot switch player",
            icon_url:
              "https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Forbidden_Symbol_Transparent.svg/1200px-Forbidden_Symbol_Transparent.svg.png",
          },
          color: "#d61516",
        }),
      ],
      ephemeral: true,
    });
  }

  if (!await user.setSpoticordDevice()) {
    return await reply({
      embeds: [
        new MessageEmbed({
          description: "Unable to switch to the Spoticord player",
          author: {
            name: "Cannot switch player",
            icon_url:
              "https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Forbidden_Symbol_Transparent.svg/1200px-Forbidden_Symbol_Transparent.svg.png",
          },
          color: "#d61516",
        })
      ],
      ephemeral: true
    });
  }

  const deviceName = await Spoticord.database.getDeviceName(member.user.id);

  return await reply({
    embeds: [new MessageEmbed({
      description: `Successfully set the Spotify device to **${escape(deviceName)}**`,
      color: '#0773D6'
    })],
    ephemeral: true
  })
}

const RX_SLASH = /\\/g;
const RX_WILDCARD = /\*/g;
const RX_UNDERSCORE = /\_/g;
const RX_TILDE = /\~/g;
const RX_COMMA = /\`/g;

function escape(text: string): string {
  return text
    .replace(RX_SLASH, '\\\\')
    .replace(RX_WILDCARD, '\\*')
    .replace(RX_UNDERSCORE, '\\_')
    .replace(RX_TILDE, '\\~')
    .replace(RX_COMMA, '\\`');
}

export default {
  data: new SlashCommandBuilder()
    .setName("switch")
    .setDescription("Switch your Spotify playback to Spoticord"),
  execute,
  requires: ['guild']
} as ICommand;
