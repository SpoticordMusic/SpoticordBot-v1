import { Client } from "discord.js";
import MusicPlayerService from "./music";
import express, { Express, Request, Response } from 'express';
import {json} from 'body-parser';
import Spoticord from "./spoticord";

export default class SpoticordRealtime {
  private static app: Express;

  public static startRealtimeService(port: number, host: string): void {
    this.app = express();

    this.app.use(json({limit: '5mb'}));

    this.app.get('/servercount', this.getServerCount.bind(this));
    this.app.get('/servers', this.getServers.bind(this));
    this.app.get('/server/:id', this.getServer.bind(this));

    this.app.get('/playercount', this.getPlayerCount.bind(this));

    this.app.post('/broadcast', this.broadcastMessage.bind(this));

    this.app.listen(port, host);
  }

  private static getServerCount(req: Request, res: Response) {
    res.json({
      count: Spoticord.client.guilds.cache.size
    });
  }

  private static getServers(req: Request, res: Response) {
    res.json({
      servers: Spoticord.client.guilds.cache.map(guild => guild.id)
    });
  }

  private static getServer(req: Request, res: Response) {
    if (!req.params.id) return res.status(400).json({error: 'Invalid request'});

    const guild = Spoticord.client.guilds.cache.get(req.params.id);
    res.status(guild ? 200 : 404).json(guild ?? {error: 'Guild not found'});
  }

  private static getPlayerCount(req: Request, res: Response) {
    res.json({
      count: Spoticord.music_service.getPlayers().length
    });
  }

  private static async broadcastMessage(req: Request, res: Response) {
    if (!req.body.content) return res.status(400).json({error: 'Invalid body'});

    let success = []
    let fail = []

    for (const player of Spoticord.music_service.getPlayers()) {
      try {
        if (typeof req.body.content === 'string') {
          await player.text?.send(req.body.content);
        } else if (typeof req.body.content === 'object') {
          await player.text?.send(req.body.content);
        } else return res.status(400).json({error: 'Invalid body'});

        success.push(player.guildId);
      } catch {
        fail.push(player.guildId);
      }
    }

    res.json({ success, fail });
  }
}