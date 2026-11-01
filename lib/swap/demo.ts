import type { EventState } from './engine';
export const demoParticipants = [{id:'maya',name:'Maya',adult:true},{id:'sara',name:'Sara',adult:true},{id:'lina',name:'Lina',adult:true}] as const;
export function seedDemo():EventState {
 return { id:'demo',name:'The Friday night swap',location:'The living room · a fictional event',participants:demoParticipants.map(p=>({...p})),items:[
  {id:'denim',eventId:'demo',ownerId:'maya',name:'The lived-in denim jacket',category:'Jacket',size:'M',condition:'Very good · softly faded',measurements:'Chest 104 cm · length 58 cm',image:'/garments/denim.png',color:'#6f8fb0',status:'available'},
  {id:'blouse',eventId:'demo',ownerId:'sara',name:'The Sunday blouse',category:'Top',size:'M',condition:'Like new · worn twice',measurements:'Chest 100 cm · length 62 cm',image:'/garments/blouse.png',color:'#efe6d4',status:'available'},
  {id:'cardigan',eventId:'demo',ownerId:'lina',name:'The just-one-more-layer knit',category:'Jacket',size:'M',condition:'Good · light pilling at cuffs',measurements:'Chest 108 cm · length 60 cm',image:'/garments/cardigan.png',color:'#5b6236',status:'available'},
 ],preferences:[{actorId:'maya',giveId:'denim',receiveId:'blouse'},{actorId:'sara',giveId:'blouse',receiveId:'cardigan'},{actorId:'lina',giveId:'cardigan',receiveId:'denim'}],proposals:[],processed:[] };
}
