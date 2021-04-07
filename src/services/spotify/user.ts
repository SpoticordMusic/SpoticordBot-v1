import EventEmitter from "events";
import { DB, DBToken } from "../../db";
import axios from 'axios';
import WebSocket from 'ws';

export class SpotifyUser extends EventEmitter {
    private initialized: boolean = false;
    private connection_id: string = null;
    private device_id: string = '';
    private socket: WebSocket;
    private token: DBToken;
    private state_manager: SpotifyStateManager;

    private pingInterval: NodeJS.Timeout;

    constructor(public discord_id: string, private db: DB, private client_id: string, private client_secret: string) {
        super();

        for (var i = 0; i < 40; i++) {
            this.device_id += 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(Math.random() * 62));
        }
    }

    public async initialize(): Promise<boolean> {
        if (this.initialized) return false;

        this.token = await this.db.getToken(this.discord_id);
        if (!this.token) {
            throw new Error('User does not have Spotify linked');
        }

        if (!await SpotifyWebHelper.checkScope(this.token)) {
            return false;
        }

        this.socket = new WebSocket(`wss://gew-dealer.spotify.com/?access_token=${this.token.access_token}`);

        this.socket.onopen = this.wsOnOpen.bind(this);
        this.socket.onclose = this.wsOnClose.bind(this);
        this.socket.onmessage = this.wsOnMessage.bind(this);
        this.socket.onerror = this.wsOnError.bind(this);

        return true;
    }

    protected wsOnOpen(event: WebSocket.OpenEvent) {
        this.pingInterval = setInterval(() => {
            this.socket.send(JSON.stringify({type: 'ping'}));
        }, 30000)
    }

    protected async wsOnMessage(event: WebSocket.MessageEvent) {
        try { JSON.parse(event.data.toString()) } catch { return; }

        const data = JSON.parse(event.data.toString());

        if (data.type === 'pong') return;

        if (!this.connection_id) {
            if (data.type === 'message' && data.method === 'PUT' && data.headers['Spotify-Connection-Id']) {
                this.connection_id = data.headers['Spotify-Connection-Id'];

                let params = new URLSearchParams();
                params.append('connection_id', this.connection_id);

                let response = await axios.put(`https://api.spotify.com/v1/me/notifications/user?${params}`, null, {
                    headers: {
                        Authorization: `Bearer ${this.token.access_token}`
                    },
                    validateStatus: () => true
                });

                if (response.status >= 400) {
                    console.error(`[ERROR] /notifications/user failed`);
                    
                    return;
                }

                let postData: any = {
                    client_version: 'harmony:3.19.1-441cc8f',
                    connection_id: this.connection_id,
                    device: {
                        brand: 'public_js-sdk',
                        capabilities: {
                            audio_podcasts: true,
                            change_volume: true,
                            disable_connect: false,
                            enable_play_token: true,
                            manifest_formats: ['file_urls_mp3', 'file_urls_external', 'file_ids_mp4', 'file_ids_mp4_dual'],
                            play_token_lost_bheavior: 'pause'
                        },
                        device_id: this.device_id,
                        device_type: 'speaker',
                        metadata: {},
                        model: 'harmony-chrome.86-windows',
                        name: await this.db.getDeviceName(this.token.discord_id)
                    },
                    previous_session_state: null,
                    volume: 65535
                };

                response = await axios.post('https://api.spotify.com/v1/track-playback/v1/devices', postData, {
                    headers: {
                        Authorization: `Bearer ${this.token.access_token}`
                    },
                    validateStatus: () => true
                });

                if (response.status >= 400) {
                    console.error(`[ERROR] Device creation failed`);
                    
                    return;
                }

                this.state_manager = new SpotifyStateManager(this.device_id, response.data.initial_seq_num, this.token, this.client_id, this.client_secret);
            
                postData = {
                    seq_num: null,
                    command_id: '',
                    volume: 65535
                };

                await axios.post(`https://api.spotify.com/v1/track-playback/v1/devices/${this.device_id}/volume`, postData, {
                    validateStatus: () => true,
                    headers: {
                        Authorization: `Bearer ${this.token.access_token}`
                    }
                });
            }

            return;
        }
    }

    protected wsOnClose(event: WebSocket.CloseEvent) {
        console.log(`[INFO] WebSocket close: ${event.reason}`);
    }

    protected wsOnError(event: WebSocket.ErrorEvent) {
        console.error(`[ERROR] WebSocket open failed: ${event.message}`);
    }
}

export class SpotifyWebHelper {
    private static db: DB;
    private static client_id: string;
    private static client_secret: string;
    
    static init(db: DB, client_id: string, client_secret: string) {
        this.db = db;
        this.client_id = client_id;
        this.client_secret = client_secret;
    }

    static async checkScope(token: DBToken): Promise<boolean> {
        let response = await axios.get('https://api.spotify.com/v1/melody/v1/check_scope?scope=web-playback', {
            headers: {
                Authorization: `Bearer ${token.access_token}`
            },
            validateStatus: () => true   
        });

        if (response.status >= 400) {
            if (!await this.refreshAccessToken(token)) {
                await this.db.deleteToken(token.discord_id);

                return false;
            }

            response = await axios.get('https://api.spotify.com/v1/melody/v1/check_scope?scope=web-playback', {
                headers: {
                    Authorization: `Bearer ${token.access_token}`
                },
                validateStatus: () => true   
            });

            if (response.status >= 400) {
                return false;
            }
        }

        return true;
    }

    static async refreshAccessToken(token: DBToken): Promise<boolean> {
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', token.refresh_token);

        const response = await axios.post('https://accounts.spotify.com/api/token', params.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${Buffer.from(`${this.client_id}:${this.client_secret}`).toString('base64')}`
            },
            validateStatus: () => true
        });

        if (response.status >= 400) return false;

        const access_token = response.data.access_token;

        await this.db.updateAccessToken(token.discord_id, access_token);
        token.access_token = access_token;
        
        return true;
    }
}

class SpotifyStateManager {
    constructor(protected device_id: string, protected seq: number, protected token: DBToken, protected client_id: string, protected client_secret: string) {}
}