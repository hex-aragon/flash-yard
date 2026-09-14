// Each finger owns one control until release; aiming never steals movement.
export function joystickVector(dx, dy, radius) {
 const length = Math.hypot(dx, dy);
 const strength = Math.min(1, length / radius);
 const speed = strength < .12 ? 0 : (strength - .12) / .88;
 return {
  side: speed ? dx / length * speed : 0,
  forward: speed ? -dy / length * speed : 0,
  sprint: strength > .88,
  x: length ? dx / length * Math.min(length, radius) : 0,
  y: length ? dy / length * Math.min(length, radius) : 0,
 };
}
export class TouchControls {
 constructor({stick, thumb, look, buttons, enabled, onLook, onAction}) {
  Object.assign(this, {stick, thumb, enabled, onLook, onAction});
  this.state = {forward: 0, side: 0, sprint: false, fire: false, jump: false};
  this.owners = new Map();
  this.stickId = null;
  this.lookId = null;
  this.jumpUntil = 0;
  this.bind(stick, {
   down: e => {
    if(this.stickId !== null) return false;
    this.stickId = e.pointerId;
    const r = stick.getBoundingClientRect();
    this.center = {x: r.left + r.width / 2, y: r.top + r.height / 2};
    this.radius = r.width * .34;
    this.moveStick(e);
   },
   move: e => {if(e.pointerId === this.stickId) this.moveStick(e);},
   up: e => {if(e.pointerId === this.stickId) this.resetStick();},
  });
  this.bind(look, {
   down: e => {
    if(this.lookId !== null) return false;
    this.lookId = e.pointerId;
    this.lastLook = {x: e.clientX, y: e.clientY};
   },
   move: e => {
    if(e.pointerId !== this.lookId) return;
    this.onLook(e.clientX - this.lastLook.x, e.clientY - this.lastLook.y);
    this.lastLook = {x: e.clientX, y: e.clientY};
   },
   up: e => {if(e.pointerId === this.lookId) this.lookId = null;},
  });
  for(const [kind, button] of Object.entries(buttons)) {
   this.bind(button, {
    down: e => {
     if([...this.owners.values()].some(o => o.kind === kind)) return false;
     this.owners.set(e.pointerId, {kind, button});
     button.classList.add('pressed');
     if(kind === 'fire') this.state.fire = true;
     if(kind === 'jump') {this.state.jump = true;this.jumpUntil = performance.now() + 100;}
     else this.onAction(kind);
    },
    up: e => {
     const owned = this.owners.get(e.pointerId);
     if(!owned) return;
     this.owners.delete(e.pointerId);
     owned.button.classList.remove('pressed');
     if(owned.kind === 'fire') this.state.fire = false;
     if(owned.kind === 'jump') this.state.jump = false;
    },
   });
  }
 }
 bind(element, handlers) {
  element.addEventListener('pointerdown', e => {
   if(!this.enabled() || (e.pointerType === 'mouse' && e.button !== 0)) return;
   e.preventDefault();
   if(handlers.down?.(e) === false) return;
   element.setPointerCapture(e.pointerId);
  });
  element.addEventListener('pointermove', e => {
   if(!this.enabled() || !element.hasPointerCapture(e.pointerId)) return;
   e.preventDefault();handlers.move?.(e);
  });
  const release = e => {
   handlers.up?.(e);
   if(element.hasPointerCapture(e.pointerId)) element.releasePointerCapture(e.pointerId);
  };
  for(const type of ['pointerup', 'pointercancel', 'lostpointercapture']) element.addEventListener(type, release);
  element.addEventListener('contextmenu', e => e.preventDefault());
 }
 moveStick(e) {
  const v = joystickVector(e.clientX - this.center.x, e.clientY - this.center.y, this.radius);
  Object.assign(this.state, {forward: v.forward, side: v.side, sprint: v.sprint});
  this.thumb.style.transform = `translate(${v.x}px, ${v.y}px)`;
  this.stick.classList.toggle('sprinting', v.sprint);
 }
 resetStick() {
  this.stickId = null;
  Object.assign(this.state, {forward: 0, side: 0, sprint: false});
  this.thumb.style.transform = 'translate(0px, 0px)';
  this.stick.classList.remove('sprinting');
 }
 read() {return {...this.state, jump: this.state.jump || performance.now() < this.jumpUntil};}
 reset() {
  this.resetStick();this.lookId = null;this.jumpUntil = 0;
  this.state.fire = false;this.state.jump = false;
  for(const {button} of this.owners.values()) button.classList.remove('pressed');
  this.owners.clear();
 }
}
