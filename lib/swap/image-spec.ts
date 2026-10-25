// Read only the bounded image header; decoding remains the provider's responsibility.
export function imageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length >= 24 && [137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value) && String.fromCharCode(...bytes.slice(12,16))==='IHDR') {
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    return {width:view.getUint32(16),height:view.getUint32(20)};
  }
  if(bytes[0]!==255||bytes[1]!==216)return null;
  let offset=2;
  while(offset+4<=bytes.length){
    if(bytes[offset]!==255)return null;
    while(bytes[offset]===255)offset++;
    const marker=bytes[offset++];
    if(marker===0xd9||marker===0xda)return null;
    if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
    if(offset+2>bytes.length)return null;
    const length=(bytes[offset]<<8)|bytes[offset+1];
    if(length<2||offset+length>bytes.length)return null;
    if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
      if(length<7)return null;
      return{height:(bytes[offset+3]<<8)|bytes[offset+4],width:(bytes[offset+5]<<8)|bytes[offset+6]};
    }
    offset+=length;
  }
  return null;
}
export function supportedDimensions(bytes:Uint8Array){const size=imageDimensions(bytes);return !!size&&Math.max(size.width,size.height)>=512&&Math.min(size.width,size.height)>=384&&Math.max(size.width,size.height)<=4096;}
