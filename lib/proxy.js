import { createProxyMiddleware } from 'http-proxy-middleware';
import { ShinyApp } from './shinyapp.js';
import portsPool from './portspool.js';

/** Class managing Shiny apps instances */
class ShinyProxy {
    /**
     * Create a new ShinyProxy object from a configuration object.
     * @param {*} config 
     */
    constructor (config) {
        if (config.portRangeStart) portsPool.init(config.portRangeStart, config.portRangeEnd);
        this.shinyApps = config.apps
        .sort((a, b) => a.path.startsWith(b.path) ? -1 : 1)
        .map(appConfig => {
            let shinyApp = new ShinyApp(appConfig);
            shinyApp.start();
            return shinyApp;
        });
        this.appsByPath = this.shinyApps.reduce((a, e) => ({...a, [e.config.path]: e}), {});
        this.findSession = (req) => {
            // find app with home url or SHINYAPP_PATH
            let url = req.url.replace(/^(.+?)\/*?$/, "$1");
            let session, app = this.appsByPath[url];
            if (app) {
                session = app.getSession();
            } else if (req.headers && req.headers.cookie) {
                let cookies = ShinyProxy.parseCookies(req.headers.cookie);
                app = cookies.SHINYAPP_PATH && this.appsByPath[cookies.SHINYAPP_PATH];
                if (app) {
                    session = app.getSession(cookies.SHINYAPP_SESSION);
                }
            }
            if (session) {
                req.shinyAppSession = session;
            }
            return req
        };
        const routerMiddleware = (req, res, next) => {
            this.findSession(req);
            if (req.shinyAppSession) {
                next();
            } else {
                if (config.redirect404) {
                    res.redirect(config.redirect404);
                } else {
                    res.status(404).end('The page you requested cannot be found.');
                }
            }
        };
        const proxyOptions = {
            target: 'http://localhost:3001',
            changeOrigin: true,
            ws: true        
        };
        proxyOptions.router = (req) => {
            if (!req.shinyAppSession) this.findSession(req);
            if (req.shinyAppSession) {
                return req.shinyAppSession.proxyUrl;
            }
        };
        proxyOptions.pathRewrite = this.shinyApps.reduce((a, e) => ({
            ...a, 
            [`^${e.config.path.replace(/^(.+?)\/*?$/, "$1")}`]: ''
        }), {});
        proxyOptions.onError = (err, req, res) => {
            if (res.writeHead) {
                res.writeHead(500, {
                    'Content-Type': 'text/plain'
                }).end('An error occured.');
            }
        };
        proxyOptions.onProxyRes = (proxyRes, req, res) => {
            if (req.shinyAppSession) {
                proxyRes.headers['Set-Cookie'] = [`SHINYAPP_PATH=${req.shinyAppSession.path}`,
                                                  `SHINYAPP_SESSION=${req.shinyAppSession.sessionId}`];
            }
        };
        proxyOptions.onProxyReqWs = (proxyReq, req, socket, options, head) => {
            if (req.shinyAppSession) {
                socket.on('close', () => req.shinyAppSession.closeSession());    
            }
        };
        this.wsProxy = createProxyMiddleware(proxyOptions);
        this.middleware = [routerMiddleware, this.wsProxy];
    }

    /** 
     * Parse a cookies string into an object.
    */
    static parseCookies(str) {
        return str.split(';').map(e => e.split('='))
        .reduce((a, e) => ({
            ...a,
            [decodeURIComponent(e[0].trim())]: decodeURIComponent(e[1].trim())
        }), {});
    }

    /**
     * Pull new version of a Shiny app from a Git repository.
     * @param {*} appId The id of the app to pull
     */
    pullGit(appId) {
        
    }

}

export default ShinyProxy;