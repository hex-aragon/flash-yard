import test from 'node:test';
import assert from 'node:assert/strict';
import {TouchControls, joystickVector} from '../src/touch-controls.js';
import {move} from '../src/simulation.js';
class Target extends EventTarget {
 constructor(){super();this.style={};this.captures=new Set();this.classList={add(){},remove(){},toggle(){}};}
 getBoundingClientRect(){return {left:0,top:0,width:144,height:144};}
 setPointerCapture(id){this.captures.add(id);}
 hasPointerCapture(id){return this.captures.has(id);}
 releasePointerCapture(id){this.captures.delete(id);}
 pointer(type,id,x=72,y=72){const event=new Event(type,{cancelable:true});Object.assign(event,{pointerId:id,clientX:x,clientY:y,pointerType:'touch',button:0});this.dispatchEvent(event);}
}
function setup(){const stick=new Target(),look=new Target(),buttons=Object.fromEntries(['fire','jump','frag','flash','reload'].map(k=>[k,new Target()]));const aim=[],actions=[];let enabled=true;const controls=new TouchControls({stick,look,buttons,thumb:new Target(),enabled:()=>enabled,onLook:(...d)=>aim.push(d),onAction:k=>actions.push(k)});return {stick,look,buttons,aim,actions,controls,disable:()=>{enabled=false;controls.reset();}};}
test('joystick moves a player and releasing stops movement',()=>{const {stick,controls}=setup();const p={x:0,y:0,z:0,hp:100,vy:0,yaw:0};stick.pointer('pointerdown',1);stick.pointer('pointermove',1,72,22);for(let i=0;i<30;i++)move(p,controls.read(),1/60);assert.ok(p.z < -4);stick.pointer('pointerup',1);const stopped=p.z;for(let i=0;i<20;i++)move(p,controls.read(),1/60);assert.equal(p.z,stopped);});
test('three fingers can move, aim and fire independently',()=>{const {stick,look,buttons,controls,aim,actions}=setup();stick.pointer('pointerdown',1,110,72);look.pointer('pointerdown',2,500,200);buttons.fire.pointer('pointerdown',3);look.pointer('pointermove',2,525,180);assert.deepEqual(aim,[[25,-20]]);assert.ok(controls.read().side>0);assert.ok(controls.read().fire);assert.deepEqual(actions,['fire']);look.pointer('pointerup',2);assert.ok(controls.read().side>0);assert.ok(controls.read().fire);buttons.fire.pointer('pointercancel',3);assert.equal(controls.read().fire,false);assert.ok(controls.read().side>0);});
test('a second finger cannot steal the stick and lost capture clears it',()=>{const {stick,controls}=setup();stick.pointer('pointerdown',1,72,22);stick.pointer('pointerdown',2,20,72);stick.pointer('pointermove',2,0,72);assert.equal(controls.read().side,0);assert.ok(controls.read().forward>0);stick.pointer('lostpointercapture',1);assert.equal(controls.read().forward,0);});
test('menu/visibility reset clears movement and held actions and ignores stale fingers',()=>{const {stick,look,buttons,controls,disable,aim}=setup();stick.pointer('pointerdown',1,72,20);buttons.fire.pointer('pointerdown',2);buttons.jump.pointer('pointerdown',3);look.pointer('pointerdown',4);disable();stick.pointer('pointermove',1,72,0);look.pointer('pointermove',4,100,100);assert.deepEqual(controls.read(),{forward:0,side:0,sprint:false,fire:false,jump:false});assert.deepEqual(aim,[]);});
test('short jump taps survive until the next frame and grenade taps send one action',()=>{const {buttons,controls,actions}=setup();buttons.jump.pointer('pointerdown',1);buttons.jump.pointer('pointerup',1);assert.ok(controls.read().jump);buttons.frag.pointer('pointerdown',2);buttons.frag.pointer('pointerup',2);assert.deepEqual(actions,['frag']);controls.reset();assert.equal(controls.read().jump,false);});
test('analog deadzone, diagonal limit and full-stroke sprint',()=>{assert.equal(joystickVector(1,1,50).forward,0);const d=joystickVector(100,-100,50);assert.ok(d.sprint);assert.ok(Math.abs(Math.hypot(d.forward,d.side)-1)<1e-9);assert.ok(!joystickVector(0,-20,50).sprint);});
