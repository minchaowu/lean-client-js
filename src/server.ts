import {Transport, Connection} from './transport';
import {Request, ErrorResponse, CommandResponse, SyncRequest, CompleteRequest, CompleteResponse,
    InfoRequest, InfoResponse, AllMessagesResponse, AdditionalMessageResponse,
    CurrentTasksResponse, Message} from './commands';

interface SentRequestInfo {
    resolve: (CommandResponse) => void;
    reject: (any) => void;
}

class SentRequestsMap { [seqNum: number]: SentRequestInfo }

export class Server {
    currentSeqNum: number;
    private sentRequests: SentRequestsMap;
    transport: Transport;
    conn?: Connection;
    currentMessages: Message[];
    
    onError: (any) => void;
    onAllMessages: (AllMessagesResponse) => void;
    onCurrentTasks: (CurrentTasksResponse) => void;

    constructor(transport: Transport, onError: (any) => void,
            onAllMessages: (AllMessagesResponse) => void,
            onCurrentTasks: (CurrentTasksResponse) => void) {
        this.currentSeqNum = 0;
        this.onError = onError;
        this.onAllMessages = onAllMessages;
        this.onCurrentTasks = onCurrentTasks;
        this.sentRequests = new SentRequestsMap;
        this.transport = transport;
        this.currentMessages = [];
    }

    connect() {
        this.conn = this.transport.connect((msg) => this.onMessage(msg));
    }

    // TODO(gabriel): restore roi & files on restart?
    restart() {
        this.close();
        this.connect();
    }

    send(req: Request): Promise<CommandResponse> {
        req.seq_num = this.currentSeqNum++;
        let promise = new Promise((resolve, reject) =>
            this.sentRequests[req.seq_num] = { resolve: resolve, reject: reject });
        this.conn.send(req);
        return promise;
    }

    sync(req: SyncRequest): Promise<CommandResponse> {
        return this.send(req);
    }

    info(req: InfoRequest): Promise<InfoResponse> {
        return this.send(req);
    }

    complete(req: InfoRequest): Promise<CompleteResponse> {
        return this.send(req);
    }

    close() {
        if (this.conn) this.conn.close();
    }

    private onMessage(msg: any) {
        let reqInfo = this.sentRequests[msg.seq_num]; // undefined if msg.seq_num does not exist
        if (reqInfo !== undefined) {
            delete this.sentRequests[msg.seq_num];
            if (msg.response == 'ok') {
                reqInfo.resolve(msg);
            } else {
                reqInfo.reject(msg.message || msg);
            }
        } else if (msg.response == "all_messages") {
            let msg_ = msg as AllMessagesResponse;
            this.currentMessages = msg_.messages;
            this.onAllMessages(msg_);
        } else if (msg.response == "additional_message") {
            let msg_ = msg as AdditionalMessageResponse;
            this.currentMessages = this.currentMessages.concat([msg_.msg]);
            this.onAllMessages({
                response: 'all_messages',
                messages: this.currentMessages,
            } as AllMessagesResponse);
        } else if (msg.reponse == "current_tasks") {
            this.onCurrentTasks(msg);
        } else {
            // unrelated error
            this.onError(msg.message || msg);
        }
    }
}