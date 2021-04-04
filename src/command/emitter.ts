import EventEmitter from "events";
import * as Discord from 'discord.js';

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
        content: Discord.APIMessageContentResolvable | (Discord.MessageOptions & { split?: false }) | Discord.MessageAdditions,
    ): Promise<Discord.Message> | null,
    send(options: Discord.MessageOptions & { split: true | Discord.SplitOptions }): Promise<Discord.Message[]> | null,
    send(options: Discord.MessageOptions | Discord.APIMessage): Promise<Discord.Message | Discord.Message[]> | null,
    send(content: Discord.StringResolvable, options: (Discord.MessageOptions & { split?: false }) | Discord.MessageAdditions): Promise<Discord.Message> | null,
    send(content: Discord.StringResolvable, options: Discord.MessageOptions & { split: true | Discord.SplitOptions }): Promise<Discord.Message[]> | null,
    send(content: Discord.StringResolvable, options: Discord.MessageOptions): Promise<Discord.Message | Discord.Message[]> | null,
    args: string[],
    msg: Discord.Message
    [key: string]: any
}

export class CommandEmitter extends EventEmitter {
    public emit(event: string | symbol, args: string[], msg: Discord.Message, v?: object): boolean {

        var obj: CommandEvent = {
            reply: null, 
            send: null,
            args,
            msg,
            ...v
        };

        if (msg) {
            obj.reply = msg.reply.bind(msg);
            obj.send = msg.channel.send.bind(msg.channel)
        }

        return super.emit(event, obj);
    }
}