export interface DBToken {
    access_token: string,
    refresh_token: string,
    discord_id: string,
    [key: string]: any
}

export interface DBRequest {
    discord_id: string,
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
     * @param discord_id The user (Discord ID) of which to initialize a link
     */
    initializeLink(discord_id: string): Promise<string>,

    /**
     * Gets the link object for a user trying to connect his Spotify account
     * 
     * @param token The token assigned to the link object
     */
    getLink(token: string): Promise<DBRequest | null>,

    /**
     * 
     * 
     * @param token The token assigned to the link object
     */
    deleteLink(token: string): Promise<void>,

    /**
     * Insert a Spotify access and refresh token linked with a Discord account into the database
     * 
     * @param discord_id The associated Discord ID
     * @param access_token The Spotify access token
     * @param refresh_token The Spotify refresh token
     */
    insertToken(discord_id: string, access_token: string, refresh_token: string): Promise<void>,

    /**
     * Update a users Spotify access token
     * 
     * @param discord_id The user (Discord ID)
     * @param access_token The Spotify access token
     */
    updateAccessToken(discord_id: string, access_token: string): Promise<void>,

    /**
     * Get all tokens stored in the database
     * 
     * @returns All tokens
     */
    getStoredTokens(): Promise<DBToken[]>,

    /**
     * Get the token attached to the given user
     * 
     * @param discord_id The user (Discord ID)
     */
    getToken(discord_id: string): Promise<DBToken | null>,

    /**
     * Delete the token attached to the given user
     * 
     * @param discord_id The user (Discord ID)
     */
    deleteToken(discord_id: string): Promise<void>,

    /**
     * Get the Spotify device display name from the given user
     * 
     * @param discord_id The user (Discord ID)
     */
    getDeviceName(discord_id: string): Promise<string>,

    /**
     * Set the Spotify device display name for the given user
     * 
     * @param discord_id The user (Discord ID)
     * @param display_name The Spotify display name
     */
    setDeviceName(discord_id: string, display_name: string): Promise<void>
}