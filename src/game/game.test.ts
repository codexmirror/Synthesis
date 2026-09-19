// @vitest-environment node
import {expect,test} from 'vitest'
import {fresh,scan,probeCredentials,connect,remote,take,advanceTransfer,install,capability,disconnect,targets} from './game'
import {encode,decode} from '../persistence'
test('one real target: observation → access → session → transfer → possession → installation → reload',()=>{
 let s=fresh();expect(JSON.stringify(targets(s))).not.toContain('Cinder');s=scan(s,'relay');expect(targets(s)[0].label).toBe('Cinder relay')
 expect(connect(s,'relay').session).toBeUndefined();s=probeCredentials(s,'relay');expect(s.access).toHaveLength(1);expect(s.session).toBeUndefined()
 s=connect(s,'relay');expect(remote(s)?.id).toBe('relay');s=take(s,'keyprobe-2');s=advanceTransfer(s,500);expect(s.local.files).toHaveLength(0)
 s=advanceTransfer(s,2000);expect(s.local.files[0].path).toBe('/downloads/keyprobe-2.pkg');expect(capability(s).probe).toBe(1)
 s=install(s,'keyprobe-2');expect(capability(s).probe).toBe(2);s=decode(encode(s));expect(capability(s).probe).toBe(2)
 s=disconnect(s);expect(s.session).toBeUndefined();expect(s.access).toHaveLength(1);expect(connect(s,'relay').session).toBeDefined()
})
