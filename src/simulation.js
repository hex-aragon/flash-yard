import {BLOCKS, HALF, SPAWNS, PICKUPS} from './map.js';
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const direction=(yaw,pitch=0)=>({x:-Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)});
export const distance=(a,b)=>Math.hypot(a.x-b.x,(a.y??0)-(b.y??0),a.z-b.z);
export const boxes=BLOCKS.map(([x,z,w,d,h])=>({min:{x:x-w/2,y:0,z:z-d/2},max:{x:x+w/2,y:h,z:z+d/2}}));
export function rayBox(o,d,b){
 let lo=0,hi=Infinity;
 for(const k of ['x','y','z']){
  if(Math.abs(d[k])<1e-8){if(o[k]<b.min[k]||o[k]>b.max[k])return Infinity;}
  else{let a=(b.min[k]-o[k])/d[k],c=(b.max[k]-o[k])/d[k];if(a>c)[a,c]=[c,a];lo=Math.max(lo,a);hi=Math.min(hi,c);if(hi<lo)return Infinity;}
 }
 return lo;
}
export function wallDistance(o,d){return Math.min(...boxes.map(b=>rayBox(o,d,b)));}
export function lineClear(a,b){const l=distance(a,b);if(!l)return true;return wallDistance(a,{x:(b.x-a.x)/l,y:(b.y-a.y)/l,z:(b.z-a.z)/l})>=l-.12;}
export function blocked(x,z,y=0,r=.34){return Math.abs(x)>HALF-r||Math.abs(z)>HALF-r||boxes.some(b=>y<b.max.y&&y+1.7>b.min.y&&x+r>b.min.x&&x-r<b.max.x&&z+r>b.min.z&&z-r<b.max.z);}
export function move(p,input,dt){
 if(p.hp<=0)return;
 p.yaw=Number.isFinite(input.yaw)?input.yaw:p.yaw;p.pitch=clamp(Number.isFinite(input.pitch)?input.pitch:0,-1.45,1.45);
 const f=clamp(input.forward||0,-1,1),s=clamp(input.side||0,-1,1),n=Math.max(1,Math.hypot(f,s));
 const speed=input.sprint?10:6.7;
 const dx=(-Math.sin(p.yaw)*f+Math.cos(p.yaw)*s)*speed*dt/n;
 const dz=(-Math.cos(p.yaw)*f-Math.sin(p.yaw)*s)*speed*dt/n;
 if(!blocked(p.x+dx,p.z,p.y))p.x+=dx;if(!blocked(p.x,p.z+dz,p.y))p.z+=dz;
 if(input.jump&&p.y<=.001)p.vy=6.7;
 p.vy-=19*dt;const next=p.y+p.vy*dt;
 let floor=0;
 for(const b of boxes)if(p.x+.3>b.min.x&&p.x-.3<b.max.x&&p.z+.3>b.min.z&&p.z-.3<b.max.z&&p.y>=b.max.y-.05)floor=Math.max(floor,b.max.y);
 p.y=Math.max(floor,next);if(p.y===floor)p.vy=0;
}
export class Match{
 constructor(){this.time=0;this.players={};this.inputs={};this.grenades=[];this.items=PICKUPS.map((p,id)=>({...p,id,ready:0}));this.events=[];this.seq=0;this.duration=300;}
 add(id,name,bot=false){
  if(this.players[id])return this.players[id];
  const p={id,name:String(name||'요원').slice(0,16),bot,x:0,y:0,z:0,vy:0,yaw:0,pitch:0,hp:100,kills:0,deaths:0,ammo:30,frag:2,flash:2,reload:0,shot:0,throwAt:0,respawn:0,invulnerable:0};
  this.players[id]=p;this.spawn(p);return p;
 }
 spawn(p){
  const enemies=Object.values(this.players).filter(q=>q.id!==p.id&&q.hp>0);
  const locations=[...SPAWNS].sort((a,b)=>Math.min(100,...enemies.map(q=>Math.hypot(b[0]-q.x,b[1]-q.z)))-Math.min(100,...enemies.map(q=>Math.hypot(a[0]-q.x,a[1]-q.z))));
  const [x,z]=locations[enemies.length?0:Math.floor(Math.random()*locations.length)];
  Object.assign(p,{x,z,y:0,vy:0,hp:100,ammo:30,frag:2,flash:2,reload:0,yaw:Math.atan2(x,z),pitch:0,invulnerable:this.time+2});
 }
 remove(id){delete this.players[id];delete this.inputs[id];}
 emit(type,data){this.events.push({eid:++this.seq,type,...data});}
 damage(v,amount,owner,weapon){
  if(v.hp<=0||v.invulnerable>this.time)return;
  v.hp=Math.max(0,v.hp-Math.round(amount));this.emit('hurt',{id:v.id,amount,owner});
  if(v.hp===0){v.deaths++;v.respawn=this.time+3;const p=this.players[owner];if(p&&p.id!==v.id)p.kills++;this.emit('kill',{victim:v.name,killer:p?.name||'환경',weapon});}
 }
 act(id,kind){
  const p=this.players[id];if(!p||p.hp<=0||this.time>=this.duration)return;
  if(kind==='reload'){if(!p.reload&&p.ammo<30)p.reload=this.time+1.55;return;}
  if(kind==='fire'){
   if(p.shot>this.time||p.reload||p.ammo<=0)return;
   p.ammo--;p.shot=this.time+.115;
   const o={x:p.x,y:p.y+1.5,z:p.z},d=direction(p.yaw,p.pitch);let nearest=Math.min(85,wallDistance(o,d)),victim=null;
   for(const q of Object.values(this.players))if(q.id!==id&&q.hp>0){const t=rayBox(o,d,{min:{x:q.x-.38,y:q.y,z:q.z-.38},max:{x:q.x+.38,y:q.y+1.84,z:q.z+.38}});if(t<nearest){nearest=t;victim=q;}}
   if(victim)this.damage(victim,o.y+d.y*nearest>victim.y+1.48?55:27,id,'rifle');
   this.emit('shot',{id,o,end:{x:o.x+d.x*nearest,y:o.y+d.y*nearest,z:o.z+d.z*nearest},hit:victim?.id});return;
  }
  if((kind==='frag'||kind==='flash')&&p[kind]>0&&p.throwAt<=this.time){
   p[kind]--;p.throwAt=this.time+.55;const d=direction(p.yaw,p.pitch);
   this.grenades.push({id:++this.seq,owner:id,type:kind,x:p.x,y:p.y+1.45,z:p.z,vx:d.x*14,vy:d.y*14+4,vz:d.z*14,fuse:this.time+(kind==='frag'?1.8:1.35)});
  }
 }
 step(dt){
  this.time+=dt;if(this.time>=this.duration)return;
  for(const p of Object.values(this.players)){
   if(p.hp<=0){if(this.time>=p.respawn)this.spawn(p);continue;}
   if(p.reload&&this.time>=p.reload){p.reload=0;p.ammo=30;}
   if(p.bot)this.bot(p);
   move(p,this.inputs[p.id]||{},dt);
   if(this.inputs[p.id]?.fire)this.act(p.id,'fire');
   for(const item of this.items)if(item.ready<=this.time&&Math.hypot(p.x-item.x,p.z-item.z)<1.25&&p.y<1.3){
    if(item.type==='health'){if(p.hp>=100)continue;p.hp=Math.min(100,p.hp+40);}
    else{if(p[item.type]>=5)continue;p[item.type]++;}
    item.ready=this.time+9;this.emit('pickup',{id:p.id,item:item.type});
   }
  }
  for(const g of this.grenades){
   g.vy-=13*dt;
   for(const [axis,vel] of [['x','vx'],['z','vz'],['y','vy']]){
    const n={x:g.x,y:g.y,z:g.z};n[axis]+=g[vel]*dt;
    const collision=n.y<.13||Math.abs(n.x)>HALF-.15||Math.abs(n.z)>HALF-.15||boxes.some(b=>n.x>b.min.x-.1&&n.x<b.max.x+.1&&n.z>b.min.z-.1&&n.z<b.max.z+.1&&n.y<b.max.y+.1);
    if(collision){g[vel]*=-.48;if(axis==='y'){g.vx*=.78;g.vz*=.78;}}else g[axis]=n[axis];
   }
   if(g.fuse<=this.time){
    this.emit('blast',{x:g.x,y:g.y,z:g.z,kind:g.type});
    for(const p of Object.values(this.players))if(p.hp>0){
     const eye={x:p.x,y:p.y+1.5,z:p.z},l=distance(g,eye);if(!lineClear(g,eye))continue;
     if(g.type==='frag'&&l<8)this.damage(p,115*(1-l/8),g.owner,'frag');
     if(g.type==='flash'&&l<17){const look=direction(p.yaw,p.pitch);const dot=(look.x*(g.x-eye.x)+look.y*(g.y-eye.y)+look.z*(g.z-eye.z))/Math.max(.01,l);this.emit('flash',{id:p.id,strength:clamp((1-l/19)*(dot>.25?1:.28),.1,1)});}
    }
   }
  }
  this.grenades=this.grenades.filter(g=>g.fuse>this.time);
 }
 bot(p){
  const targets=Object.values(this.players).filter(q=>q.id!==p.id&&q.hp>0).sort((a,b)=>distance(a,p)-distance(b,p));const q=targets[0];if(!q)return;
  const visible=lineClear({x:p.x,y:1.5,z:p.z},{x:q.x,y:q.y+1.1,z:q.z});
  const yaw=visible?Math.atan2(p.x-q.x,p.z-q.z):p.yaw+Math.sin(this.time*.8+p.id.length)*.04;
  const input={yaw,pitch:0,forward:visible&&distance(q,p)<9?0:1,side:visible?Math.sin(this.time+p.x)*.7:0,sprint:!visible,fire:visible&&Math.sin(this.time*2+p.z)>.6};
  if(blocked(p.x-Math.sin(yaw)*.8,p.z-Math.cos(yaw)*.8))input.yaw+=1.5;
  this.inputs[p.id]=input;if(p.ammo===0)this.act(p.id,'reload');
 }
 snapshot(){return {time:this.time,players:structuredClone(this.players),grenades:structuredClone(this.grenades),items:structuredClone(this.items),events:this.events.splice(0)};}
}
