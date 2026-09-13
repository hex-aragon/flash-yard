import Peer from 'peerjs';
const PREFIX='flash-yard-v1-';
export class Room{
 constructor({onState,onInput,onJoin,onLeave,onError,onReady}){Object.assign(this,{onState,onInput,onJoin,onLeave,onError,onReady});this.connections=new Map();this.peer=null;this.host=false;this.code='';this.id='';this.closed=false;this.timer=null;}
 open(host,code,name){
  this.host=host;this.code=code;this.name=name;
  this.peer=host?new Peer(PREFIX+code):new Peer();
  this.timer=setTimeout(()=>this.fail('연결 시간이 초과됐어요. 다른 네트워크에서 다시 시도해 주세요.'),18000);
  this.peer.on('open',id=>{
   this.id=id;
   if(host){clearTimeout(this.timer);this.onReady(id);}
   else{
    const c=this.peer.connect(PREFIX+code,{reliable:true,metadata:{name,version:1}});this.server=c;
    c.on('data',data=>{
     if(data?.type==='full')return this.fail('방이 가득 찼어요. 최대 8명까지 입장할 수 있습니다.');
     if(data?.type==='state'){
      if(!this.ready){clearTimeout(this.timer);this.ready=true;this.onReady(id);}
      this.onState(data.state);
     }
    });
    c.on('close',()=>{if(!this.closed)this.fail('방장이 방을 종료했거나 연결이 끊겼어요. 새 방을 만들어 주세요.');});
    c.on('error',()=>this.fail('친구와 연결하지 못했어요. 방 코드와 네트워크를 확인해 주세요.'));
   }
  });
  this.peer.on('connection',c=>{
   if(!host){c.close();return;}
   c.on('open',()=>{
    if(this.connections.size>=7){c.send({type:'full'});setTimeout(()=>c.close(),250);return;}
    this.connections.set(c.peer,c);this.onJoin(c.peer,c.metadata?.name);
   });
   c.on('data',data=>{if(this.connections.has(c.peer))this.onInput(c.peer,data);});
   const remove=()=>{if(this.connections.delete(c.peer))this.onLeave(c.peer);};c.on('close',remove);c.on('error',remove);
  });
  this.peer.on('error',e=>{
   const messages={'unavailable-id':'이 방 코드는 이미 사용 중이에요. 방 만들기를 다시 눌러주세요.','peer-unavailable':'방을 찾지 못했어요. 친구가 방을 열었는지 코드를 확인해 주세요.','network':'연결 서버에 닿지 못했어요. 인터넷 연결을 확인해 주세요.','browser-incompatible':'이 브라우저에서는 멀티플레이를 지원하지 않아요. 최신 Chrome을 사용해 주세요.'};
   this.fail(messages[e.type]||'멀티플레이 연결에 실패했어요. 잠시 후 다시 시도해 주세요.');
  });
  this.peer.on('disconnected',()=>{if(!this.closed)this.peer.reconnect();});
 }
 fail(message){if(this.closed)return;this.close();this.onError(message);}
 send(data){if(this.server?.open)this.server.send(data);}
 broadcast(state){for(const c of this.connections.values())if(c.open)c.send({type:'state',state});}
 close(){this.closed=true;clearTimeout(this.timer);this.connections.forEach(c=>c.close());this.connections.clear();this.peer?.destroy();}
}
export function randomCode(){const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>a[n%a.length]).join('');}
