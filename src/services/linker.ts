import express, {Express, Request, Response} from 'express';
import ConfigManager from '../config';
import { DB, DBRequest } from '../db';
import fetch from 'node-fetch';

export default class LinkerService {
    private app: Express;
    private dbEngine: DB;

    private client_id: string;
    private client_secret: string;
    private redir_url: string;

    constructor() {
        this.onLinkPage = this.onLinkPage.bind(this);
        this.onGrantPage = this.onGrantPage.bind(this);
    }
    
    public initialize(config: ConfigManager, dbEngine: DB): Promise<boolean> {
        this.app = express();
        this.dbEngine = dbEngine;
        
        this.app.get('/:token', this.onLinkPage);
        this.app.get('/', this.onGrantPage);

        this.client_id = config.get('spotify_client_id');
        this.client_secret = config.get('spotify_client_secret');
        this.redir_url = config.get('spotify_redirect_url') || 'http://localhost:4481/';

        return new Promise((resolve) => {
            try {
                
                // Listen on the 'linker_port' config OR 4481 port
                //      & on the 'linker_hostname' config OR localhost interface

                this.app.listen(config.get('linker_port') || 4481, config.get('linker_hostname') || '127.0.0.1', () => {
                    resolve(true);
                });
            } catch {
                resolve(false);
            }
        });
    }

    protected async onLinkPage(req: Request, res: Response) {
        if (typeof req.params.token !== 'string') {
            res.status(404).send('<h2 style="font-family: \'Segoe UI\';">The link token you submitted is invalid, please request another.</h2>');
            return;
        }

        const link: DBRequest = await this.dbEngine.getLink(req.params.token);

        if (!link) {
            res.status(404).send('<h2 style="font-family: \'Segoe UI\';">The link token you submitted is invalid, please request another.</h2>');
            return;
        }

        res.redirect(`https://accounts.spotify.com/authorize?client_id=${this.client_id}` + 
        `&response_type=code&redirect_uri=${this.redir_url}&state=${req.params.token}` + 
        `&scope=${encodeURI('streaming user-read-email user-read-private')}&show_dialog=true`);
    }

    protected async onGrantPage(req: Request, res: Response) {
        if (!req.query.state) {
            res.status(404).send('<h2 style="font-family: \'Segoe UI\';">The link token you submitted is invalid, please request another.</h2>');
            return;
        }

        const link: DBRequest = await this.dbEngine.getLink(<string>req.query.state);

        if (!link) {
            res.status(404).send('<h2 style="font-family: \'Segoe UI\';">The link token you submitted is invalid, please request another.</h2>');
            return;
        }

        await this.dbEngine.deleteLink(link.token);
    
        if (req.query.error) {
            res.status(403).send('<h2 style="font-family: \'Segoe UI\';">The authorization request was denied.</h2><p>You need to request another link before you can try again.</p>');
            return;
        }

        const auth_code = <string>req.query.code;

        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', auth_code);
        params.append('redirect_uri', this.redir_url);

        const response = await fetch('https://accounts.spotify.com/api/token', {
            headers: {
                Authorization: `Basic ${Buffer.from(`${this.client_id}:${this.client_secret}`, 'utf-8').toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            method: 'POST',
            body: params.toString()
        });

        if (response.status !== 200) return res.status(response.status)
            .send(`<h2 style="font-family: \'Segoe UI\';">Spotify grant error.</h2>` +
                  `<p>Something went wrong while trying to validate the code with the Spotify servers.</p>` +
                  `<p><code>${JSON.stringify(await response.json())}</code></p>`);
        
        const body = await response.json();

        const access_token = body.access_token;
        const refresh_token = body.refresh_token;
        const discord_id = link.discord_id;

        const me_response = await fetch('https://api.spotify.com/v1/me', {
            headers: {
                Authorization: `Bearer ${access_token}`
            },
            method: 'GET'
        });

        if (me_response.status !== 200) return res.status(me_response.status)
        .send(`<h2 style="font-family: \'Segoe UI\';">Spotify grant error.</h2>` +
              `<p>Something went wrong while trying to validate the code with the Spotify servers.</p>` +
              `<p><code>${JSON.stringify(await me_response.json())}</code></p>`);

        const me_body = await me_response.json();

        // Check if account is a Spotify Premium account
        if (me_body.product !== 'premium') {
            return res.status(401).send('<h2 style="font-family: \'Segoe UI\';">A Spotify Premium account is required.</h2>');
        }

        await this.dbEngine.insertToken(discord_id, access_token, refresh_token);

        return res.status(200).send('<h2 style="font-family: \'Segoe UI\';">Authorization succeeded</h2><p>You can now use Spoticord</p>');
    }
}