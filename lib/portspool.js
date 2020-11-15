import tcpPortUsed from 'tcp-port-used';
import AsyncLock from 'async-lock';

class PortsPool {

    constructor() {
        this.rangeStart = 3001;
        this.rangeStop = 4000;
        this.inUse = new Set();
        this.lock = new AsyncLock();
    }

    init(rangeStart, rangeStop) {
        this.rangeStart = rangeStart;
        this.rangeStop = rangeStop || (rangeStart + 1000);
    }

    async getNext() {
        const nextPort = await this.lock.acquire('nextport', async () => {
            var port;
            for (port = this.rangeStart; port < this.rangeStop; port++){
                if (!this.inUse.has(port)) {
                    let inUse = await tcpPortUsed.check(port);
                    if (!inUse) break;
                }
            }
            this.inUse.add(port);
            return port;
        });
        return nextPort;
    }

    free(port) {
        this.inUse.delete(port);
    }

}

const portPool = new PortsPool();
export default portPool;