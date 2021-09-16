import EventEmitter from "events";
import * as Discord from "discord.js";
import { DB } from "../db";
import ConfigManager from "../config";

export declare interface CommandEmitter {
  on(event: string | symbol, listener: (event: CommandEvent) => void);
}

export interface CommandEvent {
  send(options: string | Discord.MessageOptions | Discord.MessagePayload): Promise<Discord.Message>;
  args: string[];
  msg: Discord.Message;
  config: ConfigManager;
  db: DB;
  [key: string]: any;
}

export class CommandEmitter extends EventEmitter {
  constructor(private config: ConfigManager, private dbEngine: DB) {
    super();
  }

  public emit(event: string | symbol, args: string[], msg: Discord.Message, v?: object): boolean {
    const botPerms = msg.guild.members.cache
      .get(msg.client.user.id)
      .permissionsIn(msg.channel as Discord.GuildChannelResolvable);
    if (!botPerms.has("VIEW_CHANNEL") || !botPerms.has("SEND_MESSAGES")) {
      return false;
    }

    if (!botPerms.has("EMBED_LINKS")) {
      msg.channel.send("I require the `EMBED_LINKS` permission to be able to respond to commands.").catch(() => {});
      return false;
    }

    var obj: CommandEvent = {
      reply: null,
      send: null,
      args,
      msg,
      config: this.config,
      db: this.dbEngine,
      ...v,
    };

    if (msg) {
      obj.reply = msg.reply.bind(msg);
      obj.send = msg.channel.send.bind(msg.channel);
    }

    return super.emit(event, obj);
  }

  public addCommandHandler(command: string, listener: (eventArgs: CommandEvent) => any, ...aliases: string[]) {
    this.on(command.toLowerCase(), listener);

    aliases.forEach((alias) => this.on(alias.toLowerCase(), listener));
  }
}
