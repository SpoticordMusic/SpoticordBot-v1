import { SlashCommandBuilder } from '@discordjs/builders'
import { MessageEmbed } from 'discord.js'
import Spoticord, { ICommandExec } from '../../services/spoticord'

async function execute({user, reply, source}: ICommandExec)
{
  const link_url = Spoticord.linker_service.getRedirectURL();

  if (await Spoticord.database.getToken(user.id)) {
    await reply({
      embeds: [new MessageEmbed({
        description: 'You have already linked your Spotify account.',
        color: '#0773D6'
      })],
      ephemeral: true
    });

    return;
  }

  const link_id = await Spoticord.database.initializeLink(user.id);

  if (source === 'chat') {
    try {
      await user.send({
        embeds: [new MessageEmbed({
          author: {name: 'Link your Spotify account', icon_url: 'https://spoticord.com/img/spotify-logo.png'},
          description: `Go to [this link](${link_url}${link_id}) to connect your Spotify account.`,
          footer: {text: `This message was requested by the /link command`},
          color: '#0773D6'
        })]
      })
    } catch {
      await reply({
        embeds: [new MessageEmbed({
          description: 'You must allow direct messages from server members to use this command\n(You can disable it afterwards)',
          color: '#D61516'
        })]
      });
    }
  } else if (source === 'interaction') {
    await reply({
      embeds: [new MessageEmbed({
        author: {name: 'Link your Spotify account', icon_url: 'https://spoticord.com/img/spotify-logo.png'},
        description: `Go to [this link](${link_url}${link_id}) to connect your Spotify account.`,
        footer: {text: `This message was requested by the /link command`},
        color: '#0773D6'
      })],
      ephemeral: true
    });
  }
}

export default {
  data: new SlashCommandBuilder()
      .setName('link')
      .setDescription('Links your Discord and Spotify account to Spoticord'),
  execute
}