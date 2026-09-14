import './style.css';
import {World} from './world.js';
import {TouchControls} from './touch-controls.js';
import {Match, move, clamp} from './simulation.js';
import {Room, randomCode} from './network.js';
import {BLOCKS, HALF} from './map.js';
const $=id=>document.getElementById(id);
let world;
try{world=new World($('game'));}catch(error){$('status').textContent='3D 그래픽을 시작하지 못했어요. 브라우저의 하드웨어 가속을 켜고 새로고침해 주세요.';throw error;}
let room=null,match=null,state=null,myId='',active=false,practice=false,locked=false,ready=false,code='',predicted=null,ended=false;
let accumulator=0,networkClock=0,hudClock=0,last=performance.now(),elapsed=0,flashTime=0,flashPower=0,hurtTime=0,hitTime=0,toastUntil=0,lastState=0;
const keys=new Set();let firing=false,yaw=0,pitch=0,mouseScale=1;
const blank=()=>({forward:0,side:0,sprint:false,jump:false,fire:false,yaw,pitch});let input=blank();
let audio=null,master=null,dragMode=false;const feed=[];
let screenMode = navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches;
$('touch-mode').checked = screenMode;
const touch = new TouchControls({
 stick: $('joystick'), thumb: $('joystick-thumb'), look: $('look-zone'),
 buttons: {fire: $('touch-fire'), jump: $('touch-jump'), reload: $('touch-reload'), frag: $('touch-frag'), flash: $('touch-flash')},
 enabled: () => screenMode && active && locked && !ended && $('scoreboard').hidden,
 onLook: (dx,dy) => {yaw -= dx * .004 * mouseScale;pitch = clamp(pitch - dy * .004 * mouseScale,-1.45,1.45);},
 onAction: kind => act(kind),
});
function syncControls() {
 document.body.classList.toggle('screen-mode', screenMode);
 document.body.classList.toggle('playing', active);
 $('screen-controls').hidden = !screenMode || !active || !locked || ended;
}
function pauseGame() {
 if(!active) return;
 locked = false;resetInput();
 if(document.pointerLockElement) document.exitPointerLock();
 $('pause').hidden = false;$('scoreboard').hidden = true;
 $('pause-title').textContent = ended ? '오늘 훈련, 끝!' : '잠깐 작전 회의';
 $('pause-copy').textContent = practice ? '준비되면 다시 뛰어보세요.' : '친구들의 전투는 계속됩니다.';
 $('resume').textContent = '전장으로 돌아가기';syncControls();
}
function toggleScore() {
 resetInput();$('scoreboard').hidden = !$('scoreboard').hidden;scoreboard();
 $('touch-score').textContent = $('scoreboard').hidden ? '순위' : '닫기';
 if(ended) {$('pause').hidden = !$('scoreboard').hidden;$('screen-controls').hidden = $('scoreboard').hidden;}
}
syncControls();
function sound(kind,volume=1){
 if(!audio)return;
 const now=audio.currentTime,gain=audio.createGain();gain.connect(master);gain.gain.setValueAtTime(volume*.13,now);
 if(kind==='shot'||kind==='blast'){
  const length=kind==='blast'?.55:.12,buffer=audio.createBuffer(1,audio.sampleRate*length,audio.sampleRate),a=buffer.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=(Math.random()*2-1)*(1-i/a.length);
  const source=audio.createBufferSource();source.buffer=buffer;const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=kind==='blast'?650:2300;source.connect(filter);filter.connect(gain);gain.gain.exponentialRampToValueAtTime(.001,now+length);source.start();source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
 }else{const osc=audio.createOscillator();osc.type='sine';osc.frequency.setValueAtTime(kind==='pickup'?620:kind==='hit'?220:440,now);osc.frequency.exponentialRampToValueAtTime(kind==='pickup'?1000:120,now+.14);osc.connect(gain);gain.gain.exponentialRampToValueAtTime(.001,now+.16);osc.start();osc.stop(now+.17);osc.onended=()=>{osc.disconnect();gain.disconnect();};}
}
function enableAudio(){if(!audio){audio=new AudioContext();master=audio.createGain();master.gain.value=.55;master.connect(audio.destination);}audio.resume().catch(()=>{});}
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
function busy(value){for(const id of ['host','join','practice'])$(id).disabled=value||!ready;}
function toast(message){$('toast').textContent=message;toastUntil=elapsed+2.6;}
function resetInput(){touch.reset();keys.clear();firing=false;input=blank();if(match&&myId)match.inputs[myId]=input;room?.send({type:'input',input});}
function enter(id,isPractice){
 myId=id;practice=isPractice;active=true;ended=false;dragMode=false;locked=false;$('drag-mode').hidden=true;accumulator=0;networkClock=0;predicted=null;feed.length=0;flashTime=0;flashPower=0;hurtTime=0;hitTime=0;toastUntil=0;
 $('lobby').hidden=true;$('hud').hidden=false;$('pause').hidden=false;$('pause-title').textContent='준비됐으면, 뛰어!';$('pause-copy').textContent='아래 버튼을 누르면 게임을 시작합니다.';$('resume').textContent='전장으로 들어가기';$('resume').hidden=false;
 $('copy-link').hidden=isPractice;$('room-badge').textContent=isPractice?'연습 모드':`방 ${code} · 초대 링크 복사`;$('mode-label').textContent=isPractice?'봇 3명과 몸풀기':'자유 전투 / 최대 8명';
 $('scoreboard').hidden=true;$('pause-score').hidden=true;resetInput();syncControls();busy(false);lastState=performance.now();
}
function setAngles(p){if(!p)return;yaw=p.yaw;pitch=p.pitch;input.yaw=yaw;input.pitch=pitch;}
function practiceStart(){if(!ready)return;enableAudio();room?.close();room=null;code='';match=new Match();const p=match.add('local',$('nickname').value);for(let i=1;i<=3;i++)match.add('bot-'+i,['','말년병장 봇','택배왔어요 봇','눈감고돌격 봇'][i],true);enter('local',true);state=match.snapshot();setAngles(p);}
function connect(host){
 if(!ready)return;const roomCode=host?randomCode():$('room-code').value.trim().toUpperCase();
 if(!/^[A-Z0-9]{6}$/.test(roomCode)){status('영문과 숫자로 된 6자리 방 코드를 입력해 주세요.',true);return;}
 enableAudio();busy(true);status(host?'훈련장을 준비하고 있어요…':'친구의 훈련장에 연결하고 있어요…');room?.close();code=roomCode;match=host?new Match():null;
 const newRoom=new Room({
  onReady:id=>{if(host){const p=match.add(id,$('nickname').value);enter(id,false);state=match.snapshot();setAngles(p);}else enter(id,false);},
  onState:s=>{if(!s?.players?.[myId])return;lastState=performance.now();const old=state?.players?.[myId];state=s;const p=s.players[myId];if(!predicted||(!old?.hp&&p.hp>0)||Math.hypot(predicted.x-p.x,predicted.z-p.z)>4){predicted={...p};setAngles(p);}else{predicted.x+=(p.x-predicted.x)*.35;predicted.z+=(p.z-predicted.z)*.35;predicted.y=p.y;predicted.vy=p.vy;predicted.hp=p.hp;}consume(s.events);},
  onInput:(id,data)=>{
   if(!match?.players[id]||!data||typeof data!=='object')return;
   if(data.type==='input'&&data.input&&typeof data.input==='object'){
    const i=data.input;match.inputs[id]={forward:clamp(Number(i.forward)||0,-1,1),side:clamp(Number(i.side)||0,-1,1),yaw:Number.isFinite(i.yaw)?i.yaw:0,pitch:clamp(Number(i.pitch)||0,-1.45,1.45),sprint:i.sprint===true,jump:i.jump===true,fire:i.fire===true};
   }else if(data.type==='action'&&['fire','frag','flash','reload'].includes(data.kind))match.act(id,data.kind);
  },
  onJoin:(id,name)=>{match.add(id,name);toast(`${String(name||'요원').slice(0,16)} 님이 입장했습니다`);},onLeave:id=>{match.remove(id);toast('친구가 훈련장을 나갔습니다');},
  onError:message=>{if(room!==newRoom)return;leave();status(message,true);}
 });room=newRoom;room.open(host,roomCode,$('nickname').value);
}
function leave(){
 room?.close();room=null;match=null;active=false;dragMode=false;locked=false;state=null;predicted=null;myId='';resetInput();if(document.pointerLockElement)document.exitPointerLock();$('lobby').hidden=false;$('hud').hidden=true;$('pause').hidden=true;$('death').hidden=true;syncControls();busy(false);
 for(const g of world.players.values())world.scene.remove(g);world.players.clear();for(const g of world.nades.values())world.disposeObject(g);world.nades.clear();for(const g of world.items)g.visible=true;
 status('방을 만들고 초대 링크를 친구에게 보내세요.');
}
async function lock(){
 if(!active||ended)return;enableAudio();if(screenMode||dragMode){locked=true;$('pause').hidden=true;syncControls();if(screenMode)toast('왼쪽 조이스틱 이동 · 오른쪽 드래그 조준');return;}
 try{await $('game').requestPointerLock();}catch{$('pause-copy').textContent='마우스 고정을 허용하거나 아래 드래그 모드를 선택해 주세요.';$('drag-mode').hidden=false;}
}
function act(kind){if(!active||!locked||ended)return;input.yaw=yaw;input.pitch=pitch;if(match){match.inputs[myId]=input;const p=match.players[myId];if(p){p.yaw=yaw;p.pitch=pitch;}match.act(myId,kind);}else{room?.send({type:'input',input});room?.send({type:'action',kind});}}
async function copyLink(){
 if(practice){toast('친구와 하려면 로비에서 방을 만들어 주세요.');return;}
 const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('room',code);
 try{await navigator.clipboard.writeText(url.href);toast('초대 링크를 복사했어요');$('pause-copy').textContent=`방 코드 ${code} · 초대 링크를 복사했어요.`;}catch{$('pause-copy').textContent=`주소창 링크 뒤에 ?room=${code} 를 붙여 보내세요.`;toast(`방 코드: ${code}`);}
}
function consume(events=[]){for(const e of events){
 world.event(e,myId);
 if(e.type==='shot'){
  const p=state?.players?.[myId];const volume=e.id===myId?1:Math.max(.04,1-Math.hypot((p?.x||0)-e.o.x,(p?.z||0)-e.o.z)/40)*.5;sound('shot',volume);
  if(e.id===myId&&e.hit){hitTime=.16;sound('hit',.5);}
 }
 if(e.type==='blast'){const p=state?.players?.[myId];sound(e.kind==='frag'?'blast':'hit',Math.max(.1,1-Math.hypot((p?.x||0)-e.x,(p?.z||0)-e.z)/40));}
 if(e.type==='flash'&&e.id===myId){flashTime=Math.max(flashTime,e.strength*3.7);flashPower=Math.max(flashPower,e.strength);}
 if(e.type==='hurt'&&e.id===myId)hurtTime=.38;
 if(e.type==='pickup'&&e.id===myId){toast({frag:'수류탄 +1 · G 키로 투척',flash:'섬광탄 +1 · F 키로 투척',health:'체력 +40'}[e.item]);sound('pickup',.7);}
 if(e.type==='kill'){feed.unshift({text:`${e.killer}  ${e.weapon==='frag'?'◈':'⌁'}  ${e.victim}`,until:elapsed+6});feed.splice(5);}
}}
function scoreboard(){
 if(!state)return;const rows=Object.values(state.players).sort((a,b)=>b.kills-a.kills||a.deaths-b.deaths);$('score-rows').replaceChildren(...rows.map(p=>{const row=document.createElement('div');row.className='score-row'+(p.id===myId?' me':'');for(const value of [p.name+(p.id===myId?' (나)':''),p.kills,p.deaths]){const span=document.createElement('span');span.textContent=value;row.append(span);}return row;}));
}
function updateHud(){
 if(!state)return;const p=state.players[myId];if(!p)return;
 $('mode-label').textContent=practice?'봇 3명과 몸풀기':`자유 전투 / ${Object.keys(state.players).length}명 접속`;$('hp').textContent=p.hp;$('health-bar').style.width=p.hp+'%';$('ammo').textContent=p.ammo;$('frag-count').textContent=p.frag;$('flash-count').textContent=p.flash;$('touch-frag-count').textContent=p.frag;$('touch-flash-count').textContent=p.flash;
 $('weapon-label').textContent=p.reload?'재장전 중…':p.ammo===0?(screenMode?'재장전 버튼을 누르세요':'R 키로 재장전'):'FY-30 / 자동소총';
 const sec=Math.max(0,Math.ceil(300-state.time));$('timer').textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
 $('death').hidden=p.hp>0||ended;$('respawn').textContent=Math.max(0,Math.ceil(p.respawn-state.time));
 $('feed').replaceChildren(...feed.filter(f=>f.until>elapsed).map(f=>{const d=document.createElement('div');d.textContent=f.text;return d;}));
 if(!$('scoreboard').hidden)scoreboard();
 const mini=$('minimap'),c=mini.getContext('2d'),scale=160/(HALF*2);c.clearRect(0,0,180,180);c.save();c.beginPath();c.arc(90,90,85,0,Math.PI*2);c.clip();
 c.fillStyle='#315061';for(const [x,z,w,d] of BLOCKS)c.fillRect(90+(x-w/2)*scale,90+(z-d/2)*scale,w*scale,d*scale);
 for(const item of state.items)if(item.ready<=state.time){c.fillStyle=item.type==='frag'?'#ffc18b':item.type==='flash'?'#a9e8f4':'#a6e8c6';c.fillRect(88+item.x*scale,88+item.z*scale,4,4);}
 c.translate(90+p.x*scale,90+p.z*scale);c.rotate(-yaw);c.fillStyle='#fff';c.beginPath();c.moveTo(0,-6);c.lineTo(-4,4);c.lineTo(4,4);c.closePath();c.fill();c.restore();
 if(state.time>=300&&!ended){ended=true;pauseGame();if(document.pointerLockElement)document.exitPointerLock();$('pause').hidden=false;$('pause-title').textContent='오늘 훈련, 끝!';$('pause-copy').textContent='Tab 키로 성적표를 볼 수 있어요. 로비에서 새 방을 만들어 다시 만나요.';$('resume').hidden=true;$('pause-score').hidden=false;}
}
$('host').addEventListener('click',()=>connect(true));$('join').addEventListener('click',()=>connect(false));$('practice').addEventListener('click',practiceStart);$('resume').addEventListener('click',lock);$('leave').addEventListener('click',leave);$('copy-link').addEventListener('click',copyLink);$('room-badge').addEventListener('click',copyLink);$('drag-mode').addEventListener('click',()=>{dragMode=true;locked=true;$('pause').hidden=true;toast('우클릭 드래그로 조준 · 좌클릭 발사 · Esc 메뉴');});
$('room-code').addEventListener('keydown',e=>{if(e.key==='Enter'&&!$('join').disabled)connect(false);});$('sensitivity').addEventListener('input',e=>mouseScale=Number(e.target.value));
document.addEventListener('pointerlockchange',()=>{if(dragMode||screenMode)return;locked=document.pointerLockElement===$('game');if(active){$('pause').hidden=locked;if(!locked){resetInput();$('pause-title').textContent=ended?'오늘 훈련, 끝!':'잠깐 작전 회의';$('pause-copy').textContent=ended?'Tab 키로 성적표를 보거나 로비에서 새 판을 시작하세요.':'친구들의 전투는 계속됩니다. 준비되면 돌아오세요.';$('resume').textContent='전장으로 돌아가기';}}});
document.addEventListener('pointerlockerror',()=>{if(active){$('pause-copy').textContent='이 창에서는 마우스 고정이 지원되지 않아요. 드래그 모드나 일반 Chrome 창에서 플레이하세요.';$('drag-mode').hidden=false;}});
document.addEventListener('mousemove',e=>{if(!screenMode&&locked&&!ended&&(!dragMode||(e.buttons&2))){yaw-=e.movementX*.002*mouseScale;pitch=clamp(pitch-e.movementY*.002*mouseScale,-1.45,1.45);}});
document.addEventListener('keydown',e=>{
 if(!active)return;
 if(e.code==='Escape'&&(dragMode||screenMode)){pauseGame();return;}
 if(['Tab','Space','KeyW','KeyA','KeyS','KeyD','KeyG','KeyF','KeyR'].includes(e.code))e.preventDefault();
 if(e.code==='Tab'){$('scoreboard').hidden=false;scoreboard();if(ended)$('pause').hidden=true;return;}
 if(!locked||ended)return;keys.add(e.code);if(e.repeat)return;
 if(e.code==='KeyG')act('frag');if(e.code==='KeyF')act('flash');if(e.code==='KeyR')act('reload');
});
document.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='Tab'){$('scoreboard').hidden=true;if(ended)$('pause').hidden=false;}});
document.addEventListener('mousedown',e=>{if(!screenMode&&locked&&e.button===0){firing=true;act('fire');}});document.addEventListener('mouseup',e=>{if(e.button===0)firing=false;});
$('game').addEventListener('contextmenu',e=>e.preventDefault());window.addEventListener('blur',()=>screenMode?pauseGame():resetInput());document.addEventListener('visibilitychange',()=>{if(document.hidden){if(screenMode)pauseGame();else resetInput();}});window.addEventListener('resize',resetInput);window.addEventListener('pagehide',()=>room?.close());
$('touch-mode').addEventListener('change', e => {screenMode=e.target.checked;resetInput();syncControls();});
$('touch-menu').addEventListener('click',pauseGame);
$('touch-score').addEventListener('click',toggleScore);
$('pause-score').addEventListener('click',toggleScore);
const invited=new URLSearchParams(location.search).get('room');if(invited){$('room-code').value=invited.slice(0,6).toUpperCase();status('초대받은 훈련장이에요. 호출명을 정하고 입장하세요.');}
busy(true);world.ready.then(()=>{ready=true;busy(false);}).catch(error=>{console.error(error);status('맵 파일을 불러오지 못했어요. 새로고침해 주세요.',true);});
function frame(now){
 const dt=Math.min((now-last)/1000,.06);last=now;elapsed+=dt;
 const stick = touch.read();
 const controlling = locked && !ended && $('scoreboard').hidden;
 input={forward:controlling?clamp(Number(keys.has('KeyW'))-Number(keys.has('KeyS'))+stick.forward,-1,1):0,side:controlling?clamp(Number(keys.has('KeyD'))-Number(keys.has('KeyA'))+stick.side,-1,1):0,sprint:controlling&&(keys.has('ShiftLeft')||keys.has('ShiftRight')||stick.sprint),jump:controlling&&(keys.has('Space')||stick.jump),fire:controlling&&(firing||stick.fire),yaw,pitch};
 if(active&&state){
  if(match){
   const wasDead=match.players[myId]?.hp<=0;match.inputs[myId]=input;accumulator+=practice&&!locked?0:dt;while(accumulator>=1/60){match.step(1/60);accumulator-=1/60;}
   state={time:match.time,players:match.players,items:match.items,grenades:match.grenades};
   if(wasDead&&match.players[myId]?.hp>0)setAngles(match.players[myId]);
   networkClock+=dt;if(networkClock>=1/20){networkClock=0;const snap=match.snapshot();room?.broadcast(snap);consume(snap.events);}
  }else{
   if(predicted&&!ended)move(predicted,input,dt);
   networkClock+=dt;if(networkClock>=1/30){networkClock=0;room?.send({type:'input',input});}
   if(performance.now()-lastState>15000){room?.fail('방장과의 연결이 오래 멈췄어요. 방장이 게임 창을 열어두었는지 확인해 주세요.');}
  }
  if(state){world.sync(state,myId,dt,elapsed);hudClock+=dt;if(hudClock>.1){hudClock=0;updateHud();}}
 }
 flashTime=Math.max(0,flashTime-dt);hurtTime=Math.max(0,hurtTime-dt);hitTime=Math.max(0,hitTime-dt);
 if(!flashTime)flashPower=0;$('flash').style.opacity=flashTime>0?Math.min(1,flashTime)*Math.max(.6,flashPower):0;$('flash').style.background=$('soft-flash').checked?'#789198':'#f2f7f1';$('hurt').style.opacity=hurtTime*1.8;$('hitmarker').style.opacity=hitTime>0?1:0;$('toast').style.opacity=toastUntil>elapsed?1:0;
 const p=state?.players[myId];world.draw({dt,t:elapsed,active,player:predicted&&p?{...predicted,hp:p.hp}:p,input,reloading:!!p?.reload,locked});requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
