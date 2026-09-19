export type Software = { name: string; probe?: number; trace?: number; tunnel?: boolean; rate?: number }
export type File = { id: string; path: string; bytes: number; software: Software }
export type Device = { id: string; name: string; role: string; mask: number; auth: number; firewall: boolean; files: File[] }
export type Observation = { scanned: boolean; name?: string; role?: string; auth?: number; firewall?: boolean; signal?: string; traceUsed?: number }
export type Access = { id: string; source: string; target: string; service: 'files'; method: 'keyprobe' }
export type Session = { id: string; accessId: string }
export type Transfer = { id: string; sessionId: string; source: string; destination: string; fileId: string; bytes: number; total: number }
export type State = { version: 1; world: Device[]; known: Record<string, Observation>; local: { id: string; files: File[]; installed: Software[] }; access: Access[]; session?: Session; transfer?: Transfer; serial: number; message: string }
export const packageFile = (id: string, software: Software, bytes = 1200000): File => ({id, path:`/packages/${id}.pkg`, bytes, software})
export function fresh(): State {
 const world: Device[] = [{id:'relay',name:'Cinder relay',role:'Community relay',mask:0,auth:1,firewall:false,files:[packageFile('keyprobe-2',{name:'KeyProbe 2',probe:2})]}]
 return {version:1,world,known:Object.fromEntries(world.map(d=>[d.id,{scanned:false}])),local:{id:'node-01',files:[],installed:[{name:'KeyProbe 1',probe:1},{name:'NodeScan 1',trace:1}]},access:[],serial:0,message:'Choose a signal. Scan to find your way in.'}
}
export function capability(s: Pick<State,'local'>) {
 return {probe:Math.max(0,...s.local.installed.map(x=>x.probe??0)),trace:Math.max(0,...s.local.installed.map(x=>x.trace??0)),tunnel:s.local.installed.some(x=>x.tunnel),rate:Math.max(800000,...s.local.installed.map(x=>x.rate??0))}
}
function copy(s:State):State {return structuredClone(s)}
export function scan(s:State,id:string):State {
 if(!s.known[id]) return s
 const d=s.world.find(d=>d.id===id);if(!d)return s
 const n=copy(s), trace=capability(s).trace
 n.known[id]={...n.known[id],scanned:true,traceUsed:trace,...(trace>=d.mask?{name:d.name,role:d.role,auth:d.auth,firewall:d.firewall,signal:d.files.map(f=>f.software.name).join(' / ')}:{})}
 n.message=trace>=d.mask?'Scan complete. Protection and package manifest observed.':'Identity masked. The file service is reachable; you can still attempt entry.'
 return n
}
/** Concrete KeyProbe authentication attempt. Masking never participates in resolution. */
export function probeCredentials(s:State,id:string):State {
 if(!s.known[id]||s.access.some(a=>a.target===id))return s
 const d=s.world.find(d=>d.id===id);if(!d)return s
 const n=copy(s),c=capability(s)
 if(d.firewall&&!c.tunnel){n.known[id].firewall=true;n.message='Connection rejected by packet filter. Tunnel software is required.';return n}
 if(d.auth>c.probe){n.known[id].auth=d.auth;n.message=`Authentication challenge observed: KeyProbe ${d.auth} required. Find a stronger package.`;return n}
 n.access.push({id:`access-${++n.serial}`,source:n.local.id,target:id,service:'files',method:'keyprobe'})
 n.message='ACCESS GRANTED. Connect to inspect the remote files.';return n
}
export function connect(s:State,id:string):State {
 const a=s.access.find(a=>a.target===id&&a.source===s.local.id);if(!a||s.transfer)return s
 const n=copy(s);n.session={id:`session-${++n.serial}`,accessId:a.id};n.message='Connected. Remote packages are ready to take.';return n
}
export function disconnect(s:State):State {const n=copy(s);delete n.session;delete n.transfer;n.message='Disconnected. Access retained; reconnect whenever you want.';return n}
export function remote(s:State):Device|undefined {
 const a=s.access.find(a=>a.id===s.session?.accessId&&a.source===s.local.id)
 return a?s.world.find(d=>d.id===a.target):undefined
}
export function take(s:State,fileId:string):State {
 const d=remote(s),f=d?.files.find(f=>f.id===fileId)
 if(!d||!f||!s.session||s.transfer||s.local.files.some(x=>x.id===f.id))return s
 const n=copy(s);n.transfer={id:`transfer-${++n.serial}`,sessionId:s.session.id,source:d.id,destination:n.local.id,fileId,bytes:0,total:f.bytes};n.message='Transferring to /downloads…';return n
}
export function advanceTransfer(s:State,ms:number):State {
 if(!s.transfer||!Number.isFinite(ms)||ms<=0)return s
 const d=remote(s),f=d?.files.find(f=>f.id===s.transfer?.fileId)
 if(!d||!f||d.id!==s.transfer.source||s.transfer.sessionId!==s.session?.id)return s
 const n=copy(s),t=n.transfer!;t.bytes=Math.min(t.total,t.bytes+capability(s).rate*ms/1000)
 if(t.bytes===t.total){n.local.files.push({...copyFile(f),path:`/downloads/${f.id}.pkg`});delete n.transfer;n.message=`${f.software.name} acquired. Install it to change your capabilities.`}return n
}
function copyFile(f:File):File{return structuredClone(f)}
export function install(s:State,fileId:string):State {
 const f=s.local.files.find(f=>f.id===fileId);if(!f||s.local.installed.some(x=>x.name===f.software.name))return s
 const n=copy(s);n.local.installed.push({...f.software});n.message=`${f.software.name} installed. ${effect(f.software)}`;return n
}
export function effect(p:Software):string {
 if(p.probe)return `Opens authentication challenges up to ${p.probe}.`
 if(p.trace)return `Reveals identities and manifests through masking up to ${p.trace}.`
 if(p.tunnel)return 'Passes packet filters. Authentication still requires KeyProbe.'
 if(p.rate)return `Transfers at ${(p.rate/1000000).toFixed(1)} MB/s.`
 return ''
}
/** This projection cannot accept hidden world truth. */
export function targets(s:Pick<State,'known'|'local'|'access'|'session'>) {
 const c=capability(s)
 return Object.entries(s.known).map(([id,o],index)=>({id,label:o.name??`Signal ${String(index+1).padStart(2,'0')}`,observation:o,access:s.access.some(a=>a.target===id),ready:o.auth!==undefined&&o.firewall!==undefined?o.auth<=c.probe&&(!o.firewall||c.tunnel):undefined}))
}
