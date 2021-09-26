export interface ISCProvider {
  join(guild: string, voice: string, text: string): Promise<ISCPlayer>
}

export interface ISCPlayer {
  
}