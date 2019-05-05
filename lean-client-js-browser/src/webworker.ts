import {Connection, Event, Transport, TransportError} from 'lean-client-js-core';
import {LeanJsOpts} from './inprocess';
import {ErrorRes, Req, Res, StartWorkerReq} from './webworkertypes';

export class WebWorkerTransport implements Transport {
    opts: LeanJsOpts;
    conn: WebWorkerConnection;

    constructor(opts: LeanJsOpts) {
        this.opts = opts;
    }

    connect(): WebWorkerConnection {
        const worker = new (require('worker-loader!./webworkerscript'))();
        worker.postMessage({
            command: 'start-webworker',
            opts: this.opts,
        } as StartWorkerReq);
        this.conn = new WebWorkerConnection(worker);
        worker.onmessage = (e) => {
            const res = e.data as Res;
            switch (res.response) {
                case 'error': this.conn.error.fire((res as ErrorRes).error); break;
                default: this.conn.jsonMessage.fire(res);
            }
        };
        return this.conn;
    }
}

export class WebWorkerConnection implements Connection {
    error: Event<TransportError> = new Event();
    jsonMessage: Event<any> = new Event();
    alive: boolean = true;

    worker: Worker;

    constructor(worker: Worker) {
        this.worker = worker;
    }

    send(msg: any) {
        this.worker.postMessage(msg);
    }

    dispose() {
        this.worker.terminate();
        this.alive = false;
    }
}
