import * as child from 'child_process';
import {Connection, Event, Transport} from 'lean-client-js-core';
import * as readline from 'readline';

export class ProcessTransport implements Transport {
    executablePath: string;
    workingDirectory: string;
    options: string[];

    constructor(executablePath: string, workingDirectory: string, options: string[]) {
        this.executablePath = executablePath || 'lean';
        this.workingDirectory = workingDirectory;
        this.options = options;
    }

    connect(): Connection {
        // Note: on Windows the PATH variable must be set since
        // the standard msys2 installation paths are not added to the
        // Windows Path by msys2. We could instead people to set the
        // path themselves but it seems like a lot of extra friction.
        //
        // This is also tricky since there is very little way to give
        // feedback when shelling out to Lean fails. Node.js appears
        // fail to start without writing any output to standard error.
        //
        // For now we just set the path with low priority and invoke the process.

        const process = child.spawn(this.executablePath, ['--server'].concat(this.options),
            { cwd: this.workingDirectory, env: this.getEnv() });
        const conn = new ProcessConnection(process);

        process.stderr.on('data', (chunk) => conn.stderr.fire(chunk.toString()));
        readline.createInterface({
            input: process.stdout,
            terminal: false,
        }).on('line', (line) => {
             try {
                 conn.jsonMessage.fire(JSON.parse(line));
             } catch (e) {
                 conn.jsonMessage.fire({response: 'error', message: `cannot parse: ${line}`});
             }
        });

        return conn;
    }

    private getEnv() {
        const env = Object.create(process.env);
        if (process.platform === 'win32') {
            env.Path = env.Path + ';C:\\msys64\\mingw64\\bin;C:\\msys64\\usr\\local\\bin;'
            + 'C:\\msys64\\usr\\bin;C:\\msys64\\bin;C:\\msys64\\opt\\bin;';
        }
        return env;
    }
}

export class ProcessConnection implements Connection {
    stderr: Event<string> = new Event();
    jsonMessage: Event<any> = new Event();

    process: child.ChildProcess;

    constructor(process: child.ChildProcess) {
        this.process = process;
    }

    send(msg: any) {
        this.process.stdin.write(JSON.stringify(msg) + '\n');
    }

    close() {
        this.process.kill();
    }
}
