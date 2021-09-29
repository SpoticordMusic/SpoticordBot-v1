import { Manager, NodeOptions } from "erela.js";
import { ISCProvider } from "../../services/provider";
import Spoticord from "../../services/spoticord";
import GenericPlayer from "../../services/generic/generic_player";
import LavalinkMusicPlayer from "./LavalinkMusicPlayer";

export default class LavalinkMusicProvider implements ISCProvider {
  public readonly manager: Manager;
  
  public constructor() {
    this.manager = new Manager({
      nodes: Spoticord.config.get("nodes") as NodeOptions[],
      send: (id, payload) => {
        const guild = Spoticord.client.guilds.cache.get(id);
        guild && guild.shard.send(payload);
      },
      shards: 1,
    });

    this.manager.init(Spoticord.client.user.id);
    Spoticord.client.on("raw", (d) => this.manager.updateVoiceState(d));
  }

  private players = new Map<string, LavalinkMusicPlayer>();

  public createPlayer(generic: GenericPlayer) {
    const player = new LavalinkMusicPlayer(this, generic);
    this.players.set(generic.guildId, player);

    return Promise.resolve(player);
  }
}