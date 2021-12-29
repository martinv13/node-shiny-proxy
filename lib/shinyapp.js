
import {spawn} from 'child_process';
import {v4 as uuid} from 'uuid';

import portsPool from './portspool.js';
import path from 'path';

const serverDir = process.env.SHINYPROXY_DIR_PATH || '.';

class ShinyAppInstance {

    constructor(config, id) {
        this.config = config;
        this.status = 'INIT';
        
        if (!id) {
            this.id = uuid();
        } else {
            this.id = id;
        }
        console.log(path.join(serverDir,  this.config.appDir));

    }

    async start () {
        return portsPool.getNext()
        .then(port => new Promise((resolve, reject) => {
            console.log(`spawning instance on port ${port}`);
            this.port = port;
            this.status = 'STARTING';
            if (this.child) this.child.kill();
            this.child = spawn(this.config.RscriptPath || '/usr/lib/R/bin/Rscript', 
            ['-e', 'Sys.setenv(\'INSTANCE_ID\'=\'' + this.id + 
            '\') && shiny::runApp(appDir=\'.\', port=' + this.port + ')'],
            {cwd: path.join(serverDir,  this.config.appDir)});
    
            this.child.on('close', exitCode => {
                if (this.status === 'STARTING') {
                    this.status = 'START_ERROR';
                    portsPool.free(port);
                    reject('R process exited with code ' + exitCode);
                } else {
                    this.status = 'STOPPED';
                    portsPool.free(port);
                    setTimeout(() => this.start(), 3000);
                }
            });

            this.child.on('error', err => {
                if (this.status === 'STARTING') {
                    this.status = 'START_ERROR';
                    portsPool.free(port);
                    reject('R process error:' + err);
                } else {
                    this.status = 'ERROR';
                    portsPool.free(port);
                    setTimeout(() => this.start(), 3000);
                }
            });

            this.child.stderr.on('data', data => {
                
                data=data.toString();
                console.log(data)
                if (this.status === 'STARTING' && data.includes('Listening on')) {
                    this.status = 'RUNNING';
                    resolve('Shiny app started');
                }
            });

        }))
        .catch((err) => {
            console.log('failed to start app');
            console.log(err);
        });
    }
}


export class ShinyApp {

    constructor(config) {
        this.config = config;
        this.config.path = this.config.path ? this.config.path.replace(/^(.+?)\/*?$/, "$1") : '/';
        this.children = [];
        this.sessions = {};
    }

    start () {
        let res = [];
        let workers = this.config.workers === 0 ? 0 : this.config.workers || 2;
        for (let i=0; i < workers; i++) {
            this.children[i] = new ShinyAppInstance(this.config);
            res.push(this.children[i].start().then(() => this.children[i].port));
        }
        return Promise.all(res);
    }

    getSession (id=null) {
        if (id) {
            if (this.sessions[id]) {
                if (this.sessions[id].instance.status === 'RUNNING') {
                    clearTimeout(this.sessions[id].timer);
                    this.sessions[id].timer = setTimeout(() => this.closeSession(id), 3600*1000);
                    return this.sessions[id];
                } else {
                    this.closeSession(id);
                }
            }
        } else {
            id = uuid();
            let instances = this.children.filter(e => e.status === 'RUNNING');
            if (instances.length > 0) {
                let instance = instances[Math.floor(Math.random() * instances.length)];
                this.sessions[id] = {
                    sessionId: id,
                    startedAt: (new Date()).getTime(),
                    path: this.config.path,
                    proxyUrl: `http://localhost:${instance.port}`,
                    closeTimer: setTimeout(() => this.closeSession(id), 1800*1000),
                    closeSession: () => this.closeSession(id),
                    instance
                };
                setTimeout(() => this.scale(), 100);
                return this.sessions[id];
            }
        }
    }

    closeSession (id) {
        if (this.sessions[id]) {
            if (this.sessions[id].closeTimer) {
                clearTimeout(this.sessions[id].closeTimer);
            }
            delete this.sessions[id];
            setTimeout(() => this.scale(), 100);
        }
    }

    scale () {
        //console.log("rescaling: %s current sessions", Object.keys(this.sessions).length);
    }

    pullGit () {
        // TODO: implement
    }

}
