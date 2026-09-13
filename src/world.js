import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {BLOCKS, PICKUPS, HALF} from './map.js';
export class World{
 constructor(canvas){
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#a4c5d0');this.scene.fog=new THREE.Fog('#a4c5d0',55,165);
  this.camera=new THREE.PerspectiveCamera(80,innerWidth/innerHeight,.06,240);this.camera.rotation.order='YXZ';this.scene.add(this.camera);
  this.scene.add(new THREE.HemisphereLight('#d7f0ff','#7d7769',2.5));
  const sun=new THREE.DirectionalLight('#ffdbad',3.5);sun.position.set(-25,42,18);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-36,right:36,top:36,bottom:-36,near:1,far:100});sun.shadow.bias=-.0004;sun.shadow.normalBias=.035;this.scene.add(sun);
  this.players=new Map();this.nades=new Map();this.effects=[];this.items=[];this.gun=new THREE.Group();this.kick=0;this.walk=0;
  this.build();this.makeGun();this.resize();window.addEventListener('resize',()=>this.resize());
 }
 material(color,extra={}){return new THREE.MeshStandardMaterial({color,roughness:.78,...extra});}
 box(w,h,d,x,y,z,mat,parent=this.scene){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 textTexture(text,bg='#224656',fg='#e6ece5',w=512,h=128){const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);ctx.fillStyle=fg;ctx.font='bold '+h*.55+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,w/2,h/2);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
 sign(text,x,y,z,w=6,h=1.5,rotation=0){const m=new THREE.MeshBasicMaterial({map:this.textTexture(text),side:THREE.DoubleSide});const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),m);mesh.position.set(x,y,z);mesh.rotation.y=rotation;this.scene.add(mesh);return mesh;}
 build(){
  const concrete=this.material('#a8afa8'),navy=this.material('#325366'),dark=this.material('#536875'),yellow=this.material('#e7c885');
  // Seeded concrete grain, produced locally without image downloads.
  const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');let seed=19;for(let y=0;y<256;y++)for(let x=0;x<256;x++){seed=(seed*1664525+1013904223)>>>0;const v=155+(seed%28);ctx.fillStyle=`rgb(${v},${v+4},${v})`;ctx.fillRect(x,y,1,1);}const texture=new THREE.CanvasTexture(c);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(28,28);texture.colorSpace=THREE.SRGBColorSpace;concrete.map=texture;
  this.box(170,.2,170,0,-.12,0,concrete);
  for(const z of [-25.8,25.8]){this.box(52,2.6,.35,0,1.3,z,concrete);this.box(52,.13,.48,0,2.63,z,navy);}
  for(const x of [-25.8,25.8]){this.box(.35,2.6,52,x,1.3,0,concrete);this.box(.48,.13,52,x,2.63,0,navy);}
  for(let i=-24;i<=24;i+=4){for(const z of [-25.8,25.8])this.box(.055,1.7,.055,i,3.45,z,dark);for(const x of [-25.8,25.8])this.box(.055,1.7,.055,x,3.45,i,dark);}
  // Chainlink: transparent grid texture on the fence planes.
  const fc=document.createElement('canvas');fc.width=fc.height=32;const fx=fc.getContext('2d');fx.strokeStyle='#7b9195';fx.lineWidth=1;fx.beginPath();fx.moveTo(0,0);fx.lineTo(32,32);fx.moveTo(32,0);fx.lineTo(0,32);fx.stroke();const ft=new THREE.CanvasTexture(fc);ft.wrapS=ft.wrapT=THREE.RepeatWrapping;ft.repeat.set(90,3);const fm=new THREE.MeshStandardMaterial({map:ft,transparent:true,side:THREE.DoubleSide,opacity:.6,depthWrite:false});
  for(let i=0;i<4;i++){const fence=new THREE.Mesh(new THREE.PlaneGeometry(52,1.65),fm);fence.position.set(i<2?0:(i===2?-25.8:25.8),3.45,i<2?(i===0?-25.8:25.8):0);fence.rotation.y=i<2?0:Math.PI/2;this.scene.add(fence);}
  for(let z=-22;z<=22;z+=4){this.box(.13,.013,1.5,-.9,.005,z,yellow);this.box(.13,.013,1.5,.9,.005,z,yellow);}
  for(const [x,z,w,d] of BLOCKS){for(const s of [-1,1])this.box(w+.9,.012,.07,x,.009,z+s*(d/2+.4),yellow);}
  const ring=new THREE.Mesh(new THREE.RingGeometry(3.2,3.25,64),new THREE.MeshBasicMaterial({color:'#dce0cc',side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.017;this.scene.add(ring);
  this.sign('제 7 훈 련 장',0,3.2,-25.5,9,1.5);this.sign('FLASH YARD',0,1.5,25.55,7,1.2,Math.PI);
  this.sign('07',-19,2,-10.91,2.2,1.25);this.sign('BUSAN FREIGHT',10,2.7,-11.92,5,.8);
  // Background freight skyline and gantry cranes, outside the playable boundary.
  for(let i=0;i<13;i++){const h=5+(i*7)%11;this.box(7,h,7,-62+i*10,h/2,-48-(i%3)*7,this.material(i%2?'#829eaa':'#688b9b'));}
  const crane=this.material('#cf7550');for(const x of [-38,35]){for(const z of [-39,-30])this.box(.8,20,.8,x,10,z,crane);this.box(.8,.9,39,x,20,-31,crane);this.box(8,.7,1,x,19.3,-31,crane);const cable=this.material('#536d79');this.box(.06,13,.06,x,13,-16,cable);this.box(4,.3,1.6,x,6.5,-16,crane);}
  const lamp=this.material('#485965');for(const [x,z] of [[-24,-10],[24,10],[-12,24],[12,-24]]){this.box(.13,8,.13,x,4,z,lamp);this.box(1.3,.2,.4,x,8,z,this.material('#ffdda1',{emissive:'#f5bd6f',emissiveIntensity:.6}));}
  for(const [i,p] of PICKUPS.entries()){
   const group=new THREE.Group();group.position.set(p.x,.7,p.z);const color=p.type==='frag'?'#ff9b55':p.type==='flash'?'#8de5f5':'#a6e8c6';
   const base=new THREE.Mesh(new THREE.TorusGeometry(.53,.025,6,32),new THREE.MeshBasicMaterial({color}));base.rotation.x=Math.PI/2;base.position.y=-.58;group.add(base);
   const item=this.nadeMesh(p.type);if(p.type==='health'){item.clear();this.box(.44,.12,.12,0,0,0,this.material(color),item);this.box(.12,.44,.12,0,0,0,this.material(color),item);}item.scale.setScalar(1.9);group.add(item);group.userData.item=item;this.scene.add(group);this.items[i]=group;
  }
  const loader=new GLTFLoader();
  this.ready=Promise.all([
   loader.loadAsync(import.meta.env.BASE_URL+'models/yard.glb').then(g=>{g.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});this.scene.add(g.scene);}),
   loader.loadAsync(import.meta.env.BASE_URL+'models/operator.glb').then(g=>{this.template=g.scene;this.template.traverse(o=>{if(o.isMesh)o.castShadow=true;});})
  ]);
 }
 makeGun(){
  const metal=this.material('#253946',{metalness:.65,roughness:.37}),accent=this.material('#ed794b'),black=this.material('#15242e');
  this.box(.12,.15,.55,.25,-.23,-.48,metal,this.gun);this.box(.13,.035,.32,.25,-.14,-.38,black,this.gun);this.box(.07,.1,.23,.25,-.27,-.78,metal,this.gun);this.box(.043,.05,.26,.25,-.21,-.92,black,this.gun);
  this.box(.1,.24,.12,.25,-.39,-.48,black,this.gun).rotation.x=-.2;this.box(.085,.08,.17,.25,-.21,-.47,accent,this.gun);
  this.box(.06,.065,.035,.25,-.10,-.64,black,this.gun);this.box(.012,.025,.01,.25,-.055,-.65,this.material('#a6e8c6',{emissive:'#a6e8c6'}),this.gun);
  this.box(.12,.12,.27,.28,-.41,-.2,this.material('#d99a6c'),this.gun).rotation.x=-.5;this.box(.16,.14,.3,.32,-.5,-.07,this.material('#33596a'),this.gun).rotation.x=-.5;
  this.box(.12,.1,.27,.13,-.36,-.62,this.material('#d99a6c'),this.gun).rotation.z=-.5;
  this.muzzle=new THREE.Mesh(new THREE.ConeGeometry(.07,.23,5),new THREE.MeshBasicMaterial({color:'#ffe5a0'}));this.muzzle.rotation.x=-Math.PI/2;this.muzzle.position.set(.25,-.21,-1.13);this.muzzle.visible=false;this.gun.add(this.muzzle);this.camera.add(this.gun);this.gun.visible=false;
 }
 nadeMesh(type){const g=new THREE.Group(),color=type==='frag'?'#79945b':'#c9e0df';const body=new THREE.Mesh(type==='frag'?new THREE.IcosahedronGeometry(.16,1):new THREE.CylinderGeometry(.095,.095,.3,10),this.material(color,{metalness:.35}));g.add(body);this.box(.065,.065,.07,0,.17,0,this.material('#364b54'),g);this.box(.055,.2,.035,.115,.1,0,this.material('#e8a966'),g);return g;}
 playerMesh(p){
  const g=this.template?this.template.clone(true):new THREE.Group();
  if(!this.template){this.box(.6,1.3,.4,0,.7,0,this.material('#f28b53'),g);}
  const label=new THREE.Sprite(new THREE.SpriteMaterial({map:this.textTexture(p.name,'#173343cc','#e4edf0',256,64),depthTest:true}));label.position.y=2.13;label.scale.set(1.9,.47,1);g.add(label);g.userData.legs=[];g.traverse(o=>{if(o.name.startsWith('Leg_')||o.name.startsWith('Boot_'))g.userData.legs.push({mesh:o,y:o.position.y});});this.scene.add(g);return g;
 }
 sync(state,id,dt,t){
  for(const p of Object.values(state.players))if(p.id!==id){let g=this.players.get(p.id);if(!g){g=this.playerMesh(p);g.position.set(p.x,p.y,p.z);this.players.set(p.id,g);}const previous=g.position.clone();g.position.lerp(new THREE.Vector3(p.x,p.y,p.z),Math.min(1,dt*16));g.rotation.y=p.yaw+Math.PI;g.visible=p.hp>0;const moving=previous.distanceTo(g.position)>.005;for(const [i,l] of g.userData.legs.entries())l.mesh.position.y=l.y+(moving?Math.sin(t*13+(i<2?0:Math.PI))*.06:0);}
  for(const [key,g] of this.players)if(!state.players[key]||key===id){this.scene.remove(g);const label=g.children.find(o=>o.isSprite);label?.material.map?.dispose();label?.material.dispose();this.players.delete(key);}
  for(const [i,g] of this.items.entries()){g.visible=state.items[i]?.ready<=state.time;g.userData.item.rotation.y=t*1.4;g.userData.item.position.y=Math.sin(t*2+i)*.1;}
  for(const n of state.grenades){let g=this.nades.get(n.id);if(!g){g=this.nadeMesh(n.type);this.scene.add(g);this.nades.set(n.id,g);}g.position.set(n.x,n.y,n.z);g.rotation.x=t*8;g.rotation.z=t*5;}
  for(const [key,g] of this.nades)if(!state.grenades.some(n=>n.id===key)){this.disposeObject(g);this.nades.delete(key);}
 }
 disposeObject(g){this.scene.remove(g);g.traverse(o=>{if(o.isMesh){o.geometry.dispose();if(!Array.isArray(o.material))o.material.dispose();}});}
 event(e,id){
  if(e.type==='shot'){
   const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(e.o.x,e.o.y-.07,e.o.z),new THREE.Vector3(e.end.x,e.end.y,e.end.z)]);const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:'#ffcf78',transparent:true,opacity:.85}));this.scene.add(line);this.effects.push({obj:line,life:.07,max:.07});
   if(e.id===id){this.kick=.07;this.muzzle.visible=true;}
  }
  if(e.type==='blast'){
   const flash=e.kind==='flash';const ball=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshBasicMaterial({color:flash?'#d6f0ee':'#ffac58',transparent:true,opacity:.8,wireframe:flash}));ball.position.set(e.x,e.y,e.z);this.scene.add(ball);this.effects.push({obj:ball,life:.5,max:.5,expand:true});
   for(let i=0;i<12;i++){const particle=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1),new THREE.MeshBasicMaterial({color:flash?'#e8fffb':'#ffc99a',transparent:true}));particle.position.copy(ball.position);this.scene.add(particle);this.effects.push({obj:particle,life:.65,max:.65,v:new THREE.Vector3((Math.random()-.5)*12,Math.random()*9,(Math.random()-.5)*12)});}
  }
 }
 draw({dt,t,active,player,input,reloading,locked}){
  if(active&&player){
   this.camera.position.set(player.x,player.y+1.55,player.z);this.camera.rotation.set(input.pitch,input.yaw,0,'YXZ');
   const moving=locked&&(input.forward||input.side)&&player.hp>0;this.walk+=dt*(input.sprint?15:10);
   const bob=moving?Math.sin(this.walk)*.025:0;this.camera.position.y+=bob;
   const targetFov=input.sprint&&moving?87:80;this.camera.fov+=(targetFov-this.camera.fov)*Math.min(1,dt*8);this.camera.updateProjectionMatrix();
   this.gun.visible=player.hp>0;this.gun.position.set(Math.cos(this.walk*.5)*(moving?.008:0),bob-this.kick*.2-(reloading?.25:0),this.kick);this.gun.rotation.x=reloading?-.45:this.kick;
  }else{
   const angle=.70+Math.sin(t*.035)*.1;this.camera.position.set(Math.cos(angle)*36,27,Math.sin(angle)*36);this.camera.lookAt(-3,0,-3);this.gun.visible=false;
   for(const [i,g] of this.items.entries()){g.rotation.y=t;g.position.y=.75+Math.sin(t*2+i)*.12;}
  }
  this.kick=Math.max(0,this.kick-dt*.5);if(this.kick<.045)this.muzzle.visible=false;
  for(const fx of this.effects){fx.life-=dt;fx.obj.material.opacity=Math.max(0,fx.life/fx.max);if(fx.expand)fx.obj.scale.setScalar(1+(1-fx.life/fx.max)*5);if(fx.v){fx.v.y-=dt*15;fx.obj.position.addScaledVector(fx.v,dt);}if(fx.life<=0){this.scene.remove(fx.obj);fx.obj.geometry.dispose();fx.obj.material.dispose();}}
  this.effects=this.effects.filter(f=>f.life>0);this.renderer.render(this.scene,this.camera);
 }
 resize(){this.renderer.setSize(innerWidth,innerHeight);this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();}
}
