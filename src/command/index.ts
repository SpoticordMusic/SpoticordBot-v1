import { DB } from "../db";
import { CommandEmitter } from "./emitter";

export function Initialize(emitter: CommandEmitter, db: DB) {
    emitter.on('test', async e => {
        await e.send(e.args.join('+'));
    });

    emitter.on('link', async e => {
        await e.send(await db.initializeLink(e.msg.author.id));
    })
}