import { SlashCommandBuilder } from "@discordjs/builders";
import { MessageEmbed, TextChannel, VoiceChannel } from "discord.js";
import Spoticord, { ICommand, ICommandExec } from "../../services/spoticord";

async function execute({member, user, channel, reply, defer, update}: ICommandExec)
{
  if (!member.voice.channel) {
    return await reply({
      embeds: [new MessageEmbed({
        description: 'You need to connect to a voice channel',
        author: { name: 'Cannot join voice channel', icon_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Forbidden_Symbol_Transparent.svg/1200px-Forbidden_Symbol_Transparent.svg.png' },
        color: '#D61516'
      })],
      ephemeral: true
    })
  }

  if (!await Spoticord.database.getToken(user.id)) {
    return await reply({
      embeds: [new MessageEmbed({
        description: `You need to link your Spotify account with the bot using the "/link" command`,
        author: { name: 'Cannot join voice channel', icon_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Forbidden_Symbol_Transparent.svg/1200px-Forbidden_Symbol_Transparent.svg.png' },
        color: '#D61516'
      })],
      ephemeral: true
    })
  }

  const botPerms = member.guild.members.cache.get(Spoticord.client.user.id).permissionsIn(member.voice.channel);
  if (!botPerms.has('CONNECT') || !botPerms.has('SPEAK')) {
    return await reply({
      embeds: [new MessageEmbed({
        description: 'I don\'t have the appropriate permissions to play music in that channel',
        author: { name: 'Cannot join voice channel', icon_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Forbidden_Symbol_Transparent.svg/1200px-Forbidden_Symbol_Transparent.svg.png' },
        color: '#D61516'
      })]
    });
  }

  // Check if user is already using bot in another guild
  if (Spoticord.music_service.userIsOnline(user.id)) {
    return await reply({
      embeds: [new MessageEmbed({
        description: 'Spoticord is already active on your Discord account somewhere else',
        author: { name: 'Cannot join voice channel', icon_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Forbidden_Symbol_Transparent.svg/1200px-Forbidden_Symbol_Transparent.svg.png' },
        color: '#D61516'
      })],
      ephemeral: true
    });
  }

  if (!Spoticord.music_service.playerIsOnline(member.guild.id)) {
    await defer();
    await Spoticord.music_service.joinWithProvider(member.guild.id, member.voice.channelId, channel.id);

    return await update({
      embeds: [new MessageEmbed({
        description: `Come listen along in <#${member.voice.channelId}>`,
        author: {name: 'Connected to voice channel', icon_url: 'https://images.emojiterra.com/mozilla/512px/1f50a.png'},
        color: '#0773d6'
      })]
    });
  }

  if (Spoticord.music_service.getPlayer(member.guild.id).voiceId === member.voice.channelId) {
    await Spoticord.music_service.playerUserJoin(member.guild.id, user.id);

    return await reply({
      embeds: [new MessageEmbed({
        description: `You have joined the listening party, check your Spotify!`,
        color: '#0773d6'
      })],
      ephemeral: true
    });
  }

  if (!Spoticord.music_service.getPlayer(member.guild.id).getHost())
  {
    await defer();

    await Spoticord.music_service.leaveGuild(member.guild.id);
    await new Promise(resolve => setTimeout(resolve, 500));
    await Spoticord.music_service.joinWithProvider(member.guild.id, member.voice.channelId, channel.id);

    return await update({
      embeds: [new MessageEmbed({
        description: `Come listen along in <#${member.voice.channelId}>`,
        author: {name: 'Connected to voice channel', icon_url: 'https://images.emojiterra.com/mozilla/512px/1f50a.png'},
        color: '#0773d6'
      })]
    });
  }

  return await reply({
    embeds: [new MessageEmbed({
      description: `The bot is currently being used in another voice channel`,
      author: {name: 'Cannot join voice channel', icon_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Forbidden_Symbol_Transparent.svg/1200px-Forbidden_Symbol_Transparent.svg.png'},
      color: '#d61516'
    })],
    ephemeral: true
  })
}

export default {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('Request the bot to join the current voice channel'),
  execute,
  requires: ['guild']
} as ICommand;