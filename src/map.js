export const HALF = 26;
// x, z, width, depth, height, palette index. Used by Blender, rendering, and physics.
export const BLOCKS = [
 [-14,-13,12,4,3.6,0],[10,-14,12,4,3.6,1],[-14,13,12,4,3.6,1],[10,14,12,4,3.6,0],
 [-19,0,4,10,3.6,0],[19,0,4,10,3.6,1],[-5,-3,4,9,3.6,0],[5,3,4,9,3.6,1],
 [-12,3,2.4,2.4,1.8,2],[12,-3,2.4,2.4,1.8,2],[0,-18,3,3,1.8,2],[0,18,3,3,1.8,2],
 [-22,-21,3,3,2.2,2],[22,21,3,3,2.2,2]
];
export const SPAWNS = [[-21,-8],[21,8],[-9,21],[9,-21],[-10,-7],[10,7],[-21,20],[21,-20]];
export const PICKUPS = [
 {x:0,z:0,type:'frag'},{x:-11,z:7,type:'flash'},{x:11,z:-7,type:'flash'},
 {x:-9,z:-20,type:'frag'},{x:9,z:20,type:'frag'},{x:-22,z:8,type:'flash'},{x:22,z:-8,type:'frag'},
 {x:0,z:11,type:'health'},{x:0,z:-11,type:'health'}
];
