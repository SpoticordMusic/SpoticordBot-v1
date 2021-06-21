import EventEmitter from "events";
import * as Discord from 'discord.js';
import { DB } from "../db";
import ConfigManager from "../config";
import { MessageOptions } from "node:child_process";

export declare interface CommandEmitter {
    on(event: string | symbol, listener: (event: CommandEvent) => void);
}

export interface CommandEvent {
    reply(
        content: Discord.APIMessageContentResolvable | (Discord.MessageOptions & { split?: false }) | Discord.MessageAdditions,
    ): Promise<Discord.Message> | null,
    reply(options: Discord.MessageOptions & { split: true | Discord.SplitOptions }): Promise<Discord.Message[]> | null,
    reply(options: Discord.MessageOptions | Discord.APIMessage): Promise<Discord.Message | Discord.Message[]> | null,
    reply(
        content: Discord.StringResolvable,
        options: (Discord.MessageOptions & { split?: false }) | Discord.MessageAdditions,
    ): Promise<Discord.Message> | null,
    reply(
        content: Discord.StringResolvable,
        options: Discord.MessageOptions & { split: true | Discord.SplitOptions },
    ): Promise<Discord.Message[]> | null,
    send(
        content: Discord.APIMessageContentResolvable | (MessageOptions & { split?: false }) | Discord.MessageAdditions,
      ): Promise<Discord.Message>;
    send(options: MessageOptions & { split: true | Discord.SplitOptions }): Promise<Discord.Message[]>;
    send(options: MessageOptions | Discord.APIMessage): Promise<Discord.Message | Discord.Message[]>;
    send(content: Discord.StringResolvable, options: (MessageOptions & { split?: false }) | Discord.MessageAdditions): Promise<Discord.Message>;
    send(content: Discord.StringResolvable, options: MessageOptions & { split: true | Discord.SplitOptions }): Promise<Discord.Message[]>;
    send(content: Discord.StringResolvable, options: MessageOptions): Promise<Discord.Message | Discord.Message[]>;
    send(
        content: Discord.APIMessageContentResolvable | (MessageOptions & { split?: false }) | Discord.MessageAdditions,
        options: any
    ): Promise<Discord.Message>;
    args: string[],
    msg: Discord.Message,
    config: ConfigManager,
    db: DB
    [key: string]: any
}

export class CommandEmitter extends EventEmitter {
    constructor(private config: ConfigManager, private dbEngine: DB) {
        super();
    }

    public emit(event: string | symbol, args: string[], msg: Discord.Message, v?: object): boolean {
        const botPerms = msg.guild.member(msg.client.user).permissionsIn(msg.channel);
        if (!botPerms.has('VIEW_CHANNEL') || !botPerms.has('SEND_MESSAGES')) {
            return false;
        }

        if (!botPerms.has('EMBED_LINKS')) {
            msg.channel.send('I require the `EMBED_LINKS` permission to be able to respond to commands.').catch(() => {});
            return false;
        }
        
        var obj: CommandEvent = {
            reply: null, 
            send: null,
            args,
            msg,
            config: this.config,
            db: this.dbEngine,
            ...v
        };

        if (msg) {
            obj.reply = msg.reply.bind(msg);
            obj.send = msg.channel.send.bind(msg.channel)
        }

        return super.emit(event, obj);
    }

    public addCommandHandler(command: string, listener: (eventArgs: CommandEvent) => any, ...aliases: string[]) {
        this.on(command.toLowerCase(), listener);
    
        aliases.forEach((alias) => this.on(alias.toLowerCase(), listener))
    }
}