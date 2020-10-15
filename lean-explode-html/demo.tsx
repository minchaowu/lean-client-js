/// <reference types="monaco-editor" />
import { InfoRecord, LeanJsOpts, Message } from 'lean-client-js-browser';
import * as lean from './src';
import * as React from 'react';
import * as ReactDOM from "react-dom";


interface MessageWidgetProps {
  msg: Message;
}
function MessageWidget({msg}: MessageWidgetProps) {
  const colorOfSeverity = {
    information: 'green',
    warning: 'orange',
    error: 'red',
  };
    // TODO: links and decorations on hover
    console.log(msg.text);
  return (
    <div style={{paddingBottom: '1em'}}>
      <div className='info-header' style={{ color: colorOfSeverity[msg.severity] }}>
        {msg.pos_line}:{msg.pos_col}: {msg.severity}: {msg.caption}</div>
	  <div className='code-block' dangerouslySetInnerHTML={{__html:"<pre>"+msg.text+"</pre>"}}/>
    </div>
  );
}

interface NameFormProps {
    server: lean.Server;
}

interface NameFormState {
    name: string;
}

class NameForm extends React.Component<NameFormProps, NameFormState> {
  constructor(props) {
    super(props);
    this.state = {name: ''};

    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleChange(event) {
    this.setState({name: event.target.value});
  }

    handleSubmit(event) {
	
	const testfile2 = ''
	    + 'import tactic.explode\n'
	    + '#check nat\n'
	    + '#explode '
	    + this.state.name + '\n'
	    + '#print "end of file!"\n';

	this.props.server.sync('test.lean', testfile2)
            .catch((err) => console.log('error while syncing file:', err));
	
    event.preventDefault();
  }

  render() {
      return (
	  <div className="displayer">
	  <div className="input-form">
      <form onSubmit={this.handleSubmit}>
        <label>
          Name:
          <input type="text" value={this.state.name} onChange={this.handleChange} />
        </label>
        <input type="submit" value="Submit" />
	      </form>
	      </div>
	<div className="board-row">
	<InfoView file="test.lean" server={this.props.server}/>
	      </div>
	      </div>
	    
    );
  }
}

let allMessages: lean.Message[] = [];

interface InfoViewProps {
    file: string;
    server: lean.Server;
}
interface InfoViewState {
  messages: Message[];
}
class InfoView extends React.Component<InfoViewProps, InfoViewState> {

  constructor(props: InfoViewProps) {
    super(props);
    this.state = {
      messages: [],
    };
  }
  componentWillMount() {
    this.updateMessages(this.props);
    let timer = null; // debounce
      this.props.server.allMessages.on((allMsgs) => {
	  allMessages = allMsgs.msgs;
        if (timer) { clearTimeout(timer); }
          timer = setTimeout(() => {
              this.updateMessages(this.props);
        }, 100);
      })
  }
    
  componentWillReceiveProps(nextProps) {
    this.updateMessages(nextProps);
  }
    
    updateMessages(nextProps) {
	// console.log(this.state.messages)
	// console.log(allMessages)
    this.setState({
      messages: allMessages.filter((v) => v.file_name === this.props.file),
    });
  }

  render() {
    const msgs = this.state.messages.map((msg, i) =>
      (<div key={i}>{MessageWidget({msg})}</div>));
    return (
      <div style={{overflow: 'auto', height: '100%'}}>
        {msgs}
      </div>
    );
  }
}


window.onload = () => {
    const p = document.createElement('p');
    p.innerText = 'Look at the output in the console.';
    document.body.appendChild(p);

    // const prefix = window.location.origin;
    const prefix = '.';
    const opts: lean.LeanJsOpts = {
        // javascript: 'https://leanprover.github.io/lean.js/lean3.js',
        javascript: prefix + '/lean_js_js.js',
        webassemblyJs: prefix + '/lean_js_wasm.js',
        webassemblyWasm: prefix + '/lean_js_wasm.wasm',
        libraryZip: prefix + '/library.zip',
        // Uncomment to test optional fields
        // libraryMeta: prefix + '/library.info.json',
        // libraryOleanMap: prefix + '/library.olean_map.json',
        // dbName: 'leanlib2',
        // libraryKey: 'lib'
    };

    const transport = new lean.WebWorkerTransport(opts);
        // (window as any).Worker ?
        //     new lean.WebWorkerTransport(opts) :
        //     new lean.BrowserInProcessTransport(opts);
    const server = new lean.Server(transport);
    server.error.on((err) => console.log('error:', err));
			      
    server.tasks.on((currentTasks) => console.log('tasks:', currentTasks.tasks));

    (self as any).server = server; // allow debugging from the console

    server.connect();

    ReactDOM.render(<NameForm server={server}/>, document.getElementById("output"));

};
