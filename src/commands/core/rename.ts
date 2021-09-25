import { SlashCommandBuilder } from "@discordjs/builders";
import { MessageEmbed } from "discord.js";
import Spoticord, { ICommandExec } from "../../services/spoticord";

async function execute({user, options, reply}: ICommandExec) {
  const name = options.get('name') as string;

  if (!name || name.trim().length == 0) {
    return await reply({
      embeds: [new MessageEmbed({
        description: 'An empty device name is not allowed',
        color: '#D61516'
      })],
      ephemeral: true
    });
  }

  if (name.length > 16) {
    return await reply({
      embeds: [new MessageEmbed({
        description: 'Device name may not be longer than 16 characters',
        color: '#D61516'
      })],
      ephemeral: true
    })
  }

  await Spoticord.database.setDeviceName(user.id, name);

  await reply({
    embeds: [new MessageEmbed({
      description: `Successfully changed the Spotify device name to **${escape(name)}**`,
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
    .setName("rename")
    .setDescription("Set a new device name that is displayed in Spotify")
    .addStringOption(option => option.setName("name").setDescription("The new device name").setRequired(true)),
  execute
};
