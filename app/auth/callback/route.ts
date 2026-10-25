import {NextResponse} from 'next/server';
import {authClient} from '@/lib/swap/server';
export async function GET(request:Request){
 const url=new URL(request.url);const code=url.searchParams.get('code');
 if(code){try{const auth=await authClient();const {error}=await auth.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL('/?auth=confirmed',url.origin));}catch{}}
 return NextResponse.redirect(new URL('/?auth=signin',url.origin));
}
