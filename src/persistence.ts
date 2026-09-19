import {fresh,type State} from './game/game'
export const SAVE_KEY='synthesis-v1-save'
export function encode(s:State):string{return JSON.stringify(s)}
export function decode(raw:string):State {
 const s=JSON.parse(raw) as State
 if(s.version!==1||!Array.isArray(s.world)||!s.local||!Array.isArray(s.local.files)||!Array.isArray(s.access)||!s.known)throw new Error('Unsupported save')
 return s
}
export function load():{state:State;warning:string} {
 try{const raw=localStorage.getItem(SAVE_KEY);return {state:raw?decode(raw):fresh(),warning:''}}
 catch{return {state:fresh(),warning:'Saved progress could not be read. The original save is preserved; saving is paused.'}}
}
export function save(s:State):boolean {try{localStorage.setItem(SAVE_KEY,encode(s));return true}catch{return false}}
