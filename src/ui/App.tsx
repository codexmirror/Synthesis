import {useEffect,useState} from 'react'
import {advanceTransfer,capability,connect,disconnect,effect,install,probeCredentials,remote,scan,take,targets,type State} from '../game/game'
import {load,save} from '../persistence'
export function App(){
 const [initial]=useState(load),[s,set]=useState(initial.state),[selected,select]=useState(Object.keys(initial.state.known)[0]),[warning,setWarning]=useState(initial.warning)
 useEffect(()=>{if(!initial.warning&&!save(s))setWarning('Storage unavailable. Keep this tab open; progress is not saved.')},[s,initial.warning])
 useEffect(()=>{const timer=setInterval(()=>set(s=>advanceTransfer(s,100)),100);return()=>clearInterval(timer)},[])
 const list=targets(s),t=list.find(t=>t.id===selected)!,r=remote(s),c=capability(s)
 const act=(f:(s:State)=>State)=>set(f)
 return <main><header><b>NODE-OS</b> / SYNTHESIS <span>V1 · LOCAL WORLD</span></header>
 <h1>Find a way in.</h1><p>Take their tools. Reach further.</p>
 {warning&&<p role="alert">{warning}</p>}
 <aside><h2>Known signals</h2>{list.map(t=><button key={t.id} onClick={()=>select(t.id)}>{t.label}{t.access?' · Access retained':''}</button>)}</aside>
 <section><h2>{t.label}</h2><p>{t.observation.role??'Unidentified file service'}</p>
 <p>{t.observation.auth?`Authentication ${t.observation.auth}`:'Protection unknown'} · {t.observation.firewall===undefined?'Filter unknown':t.observation.firewall?'Packet filter':'No packet filter'}</p>
 {t.observation.signal&&<p>Package manifest: {t.observation.signal}</p>}
 <button onClick={()=>act(s=>scan(s,t.id))}>SCAN</button> {!t.access?<button onClick={()=>act(s=>probeCredentials(s,t.id))}>HACK</button>:<button onClick={()=>act(s=>connect(s,t.id))}>CONNECT</button>}
 <p role="status">{s.message}</p>
 {r&&<article><h3>Connected / {r.name}</h3><button onClick={()=>act(disconnect)}>Disconnect</button>{r.files.map(f=><div key={f.id}><h4>{f.software.name}</h4><p>{f.path} · {(f.bytes/1000000).toFixed(1)} MB</p><p>{effect(f.software)}</p>{!s.local.files.some(x=>x.id===f.id)?<button disabled={!!s.transfer} onClick={()=>act(s=>take(s,f.id))}>TAKE {f.software.name}</button>:!s.local.installed.some(x=>x.name===f.software.name)?<button onClick={()=>act(s=>install(s,f.id))}>INSTALL {f.software.name}</button>:<b>Installed</b>}</div>)}</article>}
 {s.transfer&&<progress aria-label="File transfer" value={s.transfer.bytes} max={s.transfer.total}/>}
 </section><section><h2>My tools</h2><p>KeyProbe {c.probe} · Trace {c.trace} · {c.tunnel?'Tunnel installed':'No tunnel'}</p>{s.local.files.filter(f=>!s.local.installed.some(x=>x.name===f.software.name)).map(f=><button key={f.id} onClick={()=>act(s=>install(s,f.id))}>INSTALL {f.software.name}</button>)}</section></main>
}
