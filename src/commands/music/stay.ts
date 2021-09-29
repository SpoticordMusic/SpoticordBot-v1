import { SlashCommandBuilder } from "@discordjs/builders";
import { MessageEmbed } from "discord.js";
import Spoticord, { ICommand, ICommandExec } from "../../services/spoticord";

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

  const isEnabled = Spoticord.music_service.getPlayer(member.guild.id).toggleStay();

  return await reply({
    embeds: [
      new MessageEmbed({
        description: isEnabled
          ? "The bot will stay in this call indefinitely"
          : "The bot will leave the call if it's been inactive for too long",
        author: { name: `${isEnabled ? "Enabled" : "Disabled"} 24/7 mode` },
      }),
    ],
  });
}

export default {
  data: new SlashCommandBuilder().setName("stay").setDescription("Request the bot to stay in the call indefinitely"),
  execute,
  requires: ['guild']
} as ICommand;
