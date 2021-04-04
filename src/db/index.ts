export interface DBToken {
    spotifyAccessToken: string,
    spotifyRefreshToken: string,
    discordID: string,
    [key: string]: any
}

export interface DBRequest {
    discordID: string,
    token: string
}

export interface DB {
    /**
     * Initializes the database engine
     * 
     * @returns true if succeeded, false on error
     */
    initialize(): Promise<boolean>,

    /**
     * Initialize a link for the user to connect their Spotify and Discord account
     * 
     * @param discordID The user (Discord ID) of which to initialize a link
     */
    initializeLink(discordID: string): Promise<string>,

    /**
     * Update a users Spotify access token
     * 
     * @param discordID The user (Discord ID)
     * @param accessToken The Spotify access token
     */
    updateAccessToken(discordID: string, accessToken: string): Promise<void>,

    /**
     * Get all tokens stored in the database
     * 
     * @returns All tokens
     */
    getStoredTokens(): Promise<DBToken[]>,

    /**
     * Get the token attached to the given user
     * 
     * @param discordID The user (Discord ID)
     */
    getToken(discordID: string): Promise<DBToken | null>,

    /**
     * Delete the token attached to the given user
     * 
     * @param discordID The user (Discord ID)
     */
    deleteToken(discordID: string): Promise<void>,

    /**
     * Get the Spotify device display name from the given user
     * 
     * @param discordID The user (Discord ID)
     */
    getDeviceName(discordID: string): Promise<string>,

    /**
     * Set the Spotify device display name for the given user
     * 
     * @param discordID The user (Discord ID)
     * @param displayName The Spotify display name
     */
    setDeviceName(discordID: string, displayName: string): Promise<void>
}