export type Category = 'Top' | 'Jacket';
export type Participant = { id: string; name: string; adult: true };
export type Item = { id: string; eventId: string; ownerId: string; name: string; category: Category; size: string; condition: string; measurements: string; image: string; color?: string; status: 'available' | 'swapped' | 'withdrawn'; reservedBy?: string };
export type Preference = { giveId: string; receiveId: string; actorId: string };
export type Leg = { actorId: string; giveId: string; receiveId: string };
export type Proposal = { id: string; legs: Leg[]; status: 'proposed' | 'reserved' | 'cancelled' | 'expired' | 'completed'; accepted: string[]; handedOver: string[]; expiresAt: number; reason?: string };
export type EventState = { id: string; name: string; location: string; participants: Participant[]; items: Item[]; preferences: Preference[]; proposals: Proposal[]; processed: string[] };
export type Command =
 | { type: 'preference'; giveId: string; receiveId: string; selected: boolean }
 | { type: 'propose'; itemIds: string[]; proposalId: string }
 | { type: 'accept' | 'decline' | 'cancel' | 'handover'; proposalId: string; checklist?: boolean }
 | { type: 'add'; item: Item }
 | { type: 'withdraw'; itemId: string }
 | { type: 'expire' };
export class SwapError extends Error {}
function requireThat(condition: unknown, message: string): asserts condition { if (!condition) throw new SwapError(message); }
export function available(item: Item) { return item.status === 'available' && !item.reservedBy; }
function release(state: EventState, proposal: Proposal) { for (const item of state.items) if (item.reservedBy === proposal.id) delete item.reservedBy; }
export function expire(state: EventState, now: number): EventState {
 const next = structuredClone(state);
 for (const p of next.proposals) if (['proposed','reserved'].includes(p.status) && p.expiresAt <= now && p.handedOver.length === 0) { p.status='expired'; p.reason='The response window ended.'; release(next,p); }
 return next;
}
// A directed edge A → B means A's owner explicitly accepts B for A.
export function findCycles(state: EventState): string[][] {
 const items = state.items.filter(i => i.eventId === state.id && available(i)).sort((a,b)=>a.id.localeCompare(b.id));
 const edges = new Set(state.preferences.filter(p=>state.items.some(i=>i.id===p.giveId&&i.ownerId===p.actorId)).map(p=>`${p.giveId}:${p.receiveId}`));
 const result: string[][]=[];const seen=new Set<string>();
 function add(path:Item[]) { const key=[...path.map(i=>i.id)].sort().join(':');if(!seen.has(key)){seen.add(key);result.push(path.map(i=>i.id));} }
 for(const a of items)for(const b of items){if(a.ownerId===b.ownerId||!edges.has(`${a.id}:${b.id}`))continue;
  if(edges.has(`${b.id}:${a.id}`))add([a,b]);
  for(const c of items){if(new Set([a.ownerId,b.ownerId,c.ownerId]).size!==3)continue;if(edges.has(`${b.id}:${c.id}`)&&edges.has(`${c.id}:${a.id}`))add([a,b,c]);}
 }
 return result.sort((a,b)=>a.length-b.length||a.join(':').localeCompare(b.join(':')));
}
export function transition(input:EventState, actorId:string, command:Command, requestId:string, now=Date.now()):EventState {
 requireThat(input.participants.some(p=>p.id===actorId),'You are not a member of this event.');
 requireThat(typeof requestId==='string'&&requestId.length>0&&requestId.length<=100,'A request ID is required.');
 const state=expire(input,now);
 if(state.processed.includes(requestId))return state;
 const item=(id:string)=>{const found=state.items.find(i=>i.id===id&&i.eventId===state.id);requireThat(found,'That garment is not in this event.');return found;};
 if(command.type==='preference'){
  const give=item(command.giveId),receive=item(command.receiveId);
  requireThat(give.ownerId===actorId,'You can only offer your own garment.');requireThat(receive.ownerId!==actorId,'Choose someone else’s garment.');requireThat(available(give)&&available(receive),'A garment is reserved or unavailable.');
  requireThat(typeof command.selected==='boolean','Choose whether you would accept this exchange.');
  state.preferences=state.preferences.filter(p=>!(p.giveId===give.id&&p.receiveId===receive.id));
  if(command.selected)state.preferences.push({giveId:give.id,receiveId:receive.id,actorId});
  else for(const p of state.proposals)if(p.status==='proposed'&&p.legs.some(l=>l.giveId===give.id&&l.receiveId===receive.id)){p.status='cancelled';p.reason='An exchange preference was removed.';release(state,p);}
 }else if(command.type==='propose'){
  requireThat(Array.isArray(command.itemIds)&&[2,3].includes(command.itemIds.length),'An exchange needs two or three items.');
  requireThat(typeof command.proposalId==='string'&&command.proposalId.length>0&&command.proposalId.length<=100,'Invalid proposal ID.');
  const cycle=findCycles(state).find(c=>c.length===command.itemIds.length&&c.every(id=>command.itemIds.includes(id)));
  requireThat(cycle,'No mutually acceptable exchange is available.');requireThat(cycle.some(id=>item(id).ownerId===actorId),'You are not part of this exchange.');
  const existing=state.proposals.find(p=>['proposed','reserved'].includes(p.status)&&p.legs.length===cycle.length&&p.legs.every(l=>cycle.includes(l.giveId)));
  if(!existing){requireThat(!state.proposals.some(p=>p.id===command.proposalId),'Proposal ID already used.');state.proposals.push({id:command.proposalId,legs:cycle.map((id,index)=>({actorId:item(id).ownerId,giveId:id,receiveId:cycle[(index+1)%cycle.length]})),status:'proposed',accepted:[],handedOver:[],expiresAt:now+24*60*60*1000});}
 }else if(command.type==='add'){
  const i=command.item;requireThat(i&&i.ownerId===actorId&&i.eventId===state.id,'You can only add your own garment to this event.');
  requireThat(typeof i.id==='string'&&i.id.length>0&&!state.items.some(x=>x.id===i.id),'Invalid or duplicate garment.');
  requireThat(['Top','Jacket'].includes(i.category),'Start with a top or jacket.');
  for(const value of [i.name,i.size,i.condition])requireThat(typeof value==='string'&&value.trim().length>0&&value.length<=120,'Add a name, size, and condition (up to 120 characters each).');
  requireThat(typeof i.measurements==='string'&&i.measurements.length<=300,'Keep measurements under 300 characters.');
  requireThat(typeof i.image==='string'&&i.image.length>0,'Add a garment photo.');
  requireThat(i.color===undefined||(typeof i.color==='string'&&/^#[0-9a-f]{6}$/i.test(i.color)),'Garment color must be a hex value.');
  state.items.push({...i,...(i.color?{color:i.color.toLowerCase()}:{}),status:'available',reservedBy:undefined});
 }else if(command.type==='withdraw'){
  const i=item(command.itemId);requireThat(i.ownerId===actorId,'You can only withdraw your own garment.');requireThat(available(i),'Cancel its reservation before withdrawing this garment.');i.status='withdrawn';
  for(const p of state.proposals)if(p.status==='proposed'&&p.legs.some(l=>l.giveId===i.id)){p.status='cancelled';p.reason='A garment was withdrawn.';release(state,p);}
 }else if(command.type!=='expire'){
  requireThat(['accept','decline','cancel','handover'].includes(command.type),'Unknown exchange action.');
  const p=state.proposals.find(p=>p.id===command.proposalId);requireThat(p,'Exchange not found.');requireThat(p.legs.some(l=>l.actorId===actorId),'You are not a participant in this exchange.');
  if(command.type==='accept'){
   if(p.status==='reserved'&&p.accepted.includes(actorId))return state;
   requireThat(p.status==='proposed','This proposal is no longer open.');
   for(const leg of p.legs){const i=item(leg.giveId);requireThat(i.ownerId===leg.actorId&&i.status==='available'&&(!i.reservedBy||i.reservedBy===p.id),'A garment has been reserved by another exchange.');requireThat(state.preferences.some(w=>w.actorId===leg.actorId&&w.giveId===leg.giveId&&w.receiveId===leg.receiveId),'An exchange preference is no longer valid.');}
   for(const leg of p.legs)item(leg.giveId).reservedBy=p.id;
   if(!p.accepted.includes(actorId))p.accepted.push(actorId);
   if(p.accepted.length===p.legs.length)p.status='reserved';
   // Other proposals involving the newly reserved pieces cannot proceed.
   for(const other of state.proposals)if(other.id!==p.id&&other.status==='proposed'&&other.legs.some(l=>p.legs.some(k=>k.giveId===l.giveId))){other.status='cancelled';other.reason='A garment was reserved in another exchange.';release(state,other);}
  }else if(command.type==='handover'){
   if(p.status==='completed'&&p.handedOver.includes(actorId))return state;
   requireThat(p.status==='reserved','Everyone must accept before handover.');requireThat(command.checklist===true,'Confirm the fitting, condition, and physical handover checklist.');
   if(!p.handedOver.includes(actorId))p.handedOver.push(actorId);
   if(p.handedOver.length===p.legs.length){p.status='completed';for(const l of p.legs){const i=item(l.giveId);i.status='swapped';delete i.reservedBy;}}
  }else{
   if(p.status==='cancelled')return state;
   requireThat(['proposed','reserved'].includes(p.status),'This exchange is already closed.');requireThat(p.handedOver.length===0,'Handover has started. Finish confirming the exchange with everyone.');
   p.status='cancelled';p.reason=command.type==='decline'?'A participant declined.':'A participant cancelled.';release(state,p);
  }
 }
 state.processed=[...state.processed,requestId].slice(-250);
 return state;
}
