import { ISCProvider } from "../../services/provider";
import LavalinkMusicPlayer from "./LavalinkMusicPlayer";

export default class LavalinkMusicProvider implements ISCProvider {
  public async join(guild: string, voice: string, text: string) {
    return new LavalinkMusicPlayer();
  }
}