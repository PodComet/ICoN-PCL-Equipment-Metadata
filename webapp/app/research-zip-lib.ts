/** Small, dependency-free ZIP (STORE) writer for bounded research packages. */
export function crc32(bytes:Uint8Array){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
export function researchZip(entries:{name:string;bytes:Uint8Array}[]){
 if(entries.length>30||entries.reduce((n,e)=>n+e.bytes.length,0)>50*1024*1024)throw new Error('Package exceeds the bounded export size.');
 const parts:Uint8Array[]=[],central:Uint8Array[]=[],names=new Set<string>();let offset=0,size=0;
 const header=(length:number)=>{const bytes=new Uint8Array(length);return {bytes,view:new DataView(bytes.buffer)}};
 for(const e of entries){if(!e.name||e.name.startsWith('/')||e.name.split('/').some(p=>!p||p==='..'||p==='.')||/[\\\x00-\x1f]/.test(e.name)||names.has(e.name))throw new Error('Unsafe or duplicate package filename.');names.add(e.name);const name=new TextEncoder().encode(e.name);if(name.length>65535)throw new Error('Package filename is too long.');const crc=crc32(e.bytes),local=header(30);local.view.setUint32(0,0x04034b50,true);local.view.setUint16(4,20,true);local.view.setUint16(6,0x800,true);local.view.setUint32(14,crc,true);local.view.setUint32(18,e.bytes.length,true);local.view.setUint32(22,e.bytes.length,true);local.view.setUint16(26,name.length,true);parts.push(local.bytes,name,e.bytes);
  local.view.setUint16(12,0x21,true); // ZIP's minimum date, not acquisition time.
  const c=header(46);c.view.setUint32(0,0x02014b50,true);c.view.setUint16(4,20,true);c.view.setUint16(6,20,true);c.view.setUint16(8,0x800,true);c.view.setUint16(14,0x21,true);c.view.setUint32(16,crc,true);c.view.setUint32(20,e.bytes.length,true);c.view.setUint32(24,e.bytes.length,true);c.view.setUint16(28,name.length,true);c.view.setUint32(42,offset,true);central.push(c.bytes,name);offset+=30+name.length+e.bytes.length;size+=46+name.length;
 }
 const end=header(22);end.view.setUint32(0,0x06054b50,true);end.view.setUint16(8,entries.length,true);end.view.setUint16(10,entries.length,true);end.view.setUint32(12,size,true);end.view.setUint32(16,offset,true);const result=new Uint8Array(offset+size+22);let at=0;for(const p of [...parts,...central,end.bytes]){result.set(p,at);at+=p.length;}return result;
}
