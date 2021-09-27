import { Track } from "@spoticord/nodesdc";
import GenericPlayer from "./spotify/generic_player";

export interface ISCProvider {
  createPlayer(generic: GenericPlayer): Promise<ISCPlayer>
}

export interface ISCPlayer {
  play(track: Track, position?: number, paused?: boolean);
  pause();
  resume();
  seek(position: number);
  stop();
  
  getPosition(): Promise<number>
}