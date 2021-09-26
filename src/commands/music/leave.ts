import { SlashCommandBuilder } from "@discordjs/builders";
import { MessageEmbed } from "discord.js";
import Spoticord, { ICommand, ICommandExec } from "../../services/spoticord";

async function execute({ member, reply }: ICommandExec) {
  if (Spoticord.music_service.getPlayerState(member.guild.id) === "DISCONNECTED") {
    return await reply({
      embeds: [
        new MessageEmbed({
          description: "The bot is currently not connected to any voice channel",
          author: {
            name: "Cannot disconnect bot",
            icon_url:
              "https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Forbidden_Symbol_Transparent.svg/1200px-Forbidden_Symbol_Transparent.svg.png",
          },
          color: "#d61516",
        }),
      ],
      ephemeral: true,
    });
  }

  if (
    !Spoticord.music_service.getPlayerHost(member.guild.id) ||
    Spoticord.music_service.getPlayerHost(member.guild.id).discord_id === member.id
  ) {
    await Spoticord.music_service.leaveGuild(member.guild.id);

    return await reply({
      embeds: [
        new MessageEmbed({
          description: "The bot has been disconnected",
          color: "#0773d6",
        }),
      ],
    });
  }

  return await reply({
    embeds: [
      new MessageEmbed({
        description: "The bot is currently being managed by someone else",
        author: {
          name: "Cannot disconnect bot",
          icon_url:
            "https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Forbidden_Symbol_Transparent.svg/1200px-Forbidden_Symbol_Transparent.svg.png",
        },
        color: "#d61516",
      }),
    ],
    ephemeral: true,
  });
}

export default {
  data: new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Request the bot to leave the voice channel it is currently in"),
  execute,
  requires: ['guild']
} as ICommand;
