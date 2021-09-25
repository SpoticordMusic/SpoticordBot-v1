import { SlashCommandBuilder } from '@discordjs/builders'
import { MessageEmbed } from 'discord.js'
import Spoticord, { ICommandExec } from '../../services/spoticord'

async function execute({user, reply}: ICommandExec)
{
  if (!await Spoticord.database.getToken(user.id))
  {
    await reply({
      embeds: [new MessageEmbed({
        description: 'You cannot unlink your Spotify account if you haven\'t linked one.',
        color: '#D61516'
      })],
      ephemeral: true
    });

    return;
  }

  Spoticord.music_service.destroyUser(user.id);
  await Spoticord.database.deleteToken(user.id);

  await reply({
    embeds: [new MessageEmbed({
      description: 'Successfully unlinked your Spotify account',
      color: '#0773D6'
    })],
    ephemeral: true
  })
}

export default {
  data: new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink your Spotify and Discord account from Spoticord'),
  execute
}