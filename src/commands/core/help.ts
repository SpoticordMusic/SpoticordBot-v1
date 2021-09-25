import { SlashCommandBuilder } from "@discordjs/builders";
import { MessageEmbed } from "discord.js";
import { ICommandExec } from "../../services/spoticord";

async function execute({reply}: ICommandExec)
{
  await reply({
    embeds: [new MessageEmbed({
      author: { name: 'Spoticord Help', icon_url: 'https://spoticord.com/img/spoticord-logo-clean.png' },
      title: 'These following links might help you out',
      description: 
          'If you need help setting Spoticord up you can check out the **[Documentation](https://spoticord.com/documentation)** page on the Spoticord website.\n' +
          '(This bot is unofficial, so setup might differ from the official documentation)\n\n' +
          'If you want to build your own Spoticord you can check out the official [Github Repository](https://github.com/SpoticordMusic/Spoticord)',
      color: '#43B581'
    })]
  });
}

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Shows the help message'),
  execute
}