import {youcam} from '@/lib/youcam';
import {HttpError} from './server';
export async function providerUpload(bytes:Uint8Array,type:string,name:string){
 const data=await youcam('/file','POST',{files:[{content_type:type,file_name:name,file_size:bytes.byteLength}]});
 const file=data.files?.[0];if(!file?.file_id||!file.requests?.length)throw new HttpError('YouCam did not provide an upload destination.',502);
 for(const upload of file.requests){const response=await fetch(upload.url,{method:upload.method,headers:upload.headers,body:Buffer.from(bytes),signal:AbortSignal.timeout(25000)});if(!response.ok)throw new HttpError('YouCam photo upload failed.',502);}
 return file.file_id as string;
}
export async function boundedImage(response:Response,max=15*1024*1024){
 if(!response.ok||!response.body)throw new HttpError('The preview image could not be downloaded.',502);
 const type=(response.headers.get('content-type')||'').split(';')[0];if(!['image/jpeg','image/png','image/webp'].includes(type))throw new HttpError('The provider did not return an image.',502);
 const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
 while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>max){await reader.cancel();throw new HttpError('This image is too large.',413);}chunks.push(part.value);}
 return{bytes:Buffer.concat(chunks),type};
}
