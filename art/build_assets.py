"""Original low-poly Flash Yard assets. Run with Blender --background --python."""
import bpy, math, json, os
from mathutils import Vector
ROOT=os.path.dirname(os.path.abspath(__file__))
OUT=os.path.join(ROOT,'..','public','models')
os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def mat(name,color,metal=0):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=.65
 return m
blue=mat('Harbor blue',(.14,.39,.49),.3); coral=mat('Faded vermilion',(.68,.25,.14),.2)
steel=mat('Steel hardware',(.22,.29,.32),.65); wood=mat('Pallet wood',(.51,.37,.21)); edge=mat('Edge highlights',(.57,.64,.63),.3)
navy=mat('Operator navy',(.055,.14,.19)); orange=mat('Rescue orange',(.97,.35,.12)); visor=mat('Black glass',(.015,.05,.07),.75)
def box(name,loc,scale,m,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.name=name; o.dimensions=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(m)
 if bevel:
  mod=o.modifiers.new('Machined edges','BEVEL');mod.width=bevel;mod.segments=1
  bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
def export(name):
 bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,name+'.blend'))
 bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'),export_format='GLB',use_selection=False,export_animations=False)
blocks=json.load(open(os.path.join(ROOT,'map.json')))
for i,(x,z,w,d,h,c) in enumerate(blocks):
 y=-z; m=[blue,coral,wood][c]
 box('Container' if c<2 else 'Crate',(x,y,h/2),(w,d,h),m,.06)
 if c<2:
  for sy in [-1,1]:
   for k in range(int(w/.55)):
    box('Corrugated rib',(x-w/2+.3+k*.55,y+sy*(d/2+.025),h/2),(.07,.065,h-.18),m)
   for sz in [.12,h-.12]:box('Frame rail',(x,y+sy*(d/2+.05),sz),(w,.12,.14),steel)
  for sx in [-1,1]:
   box('Door seam',(x+sx*(w/2+.04),y,h/2),(.09,.05,h-.25),steel)
   for dy in [-d*.28,d*.28]:
    box('Locking rod',(x+sx*(w/2+.065),y+dy,h/2),(.09,.055,h-.3),edge)
  # High-visibility freight decal on upper front.
  box('Freight patch',(x-w*.32,y-d/2-.071,h*.73),(min(2,w*.45),.02,.42),edge)
 else:
  for off in [-.35,.35]:box('Cargo strap',(x+off*w,y,h/2),(.11,d+.025,h+.025),steel)
# Combine static meshes by material to keep draw calls low.
for material in [blue,coral,wood,steel,edge]:
 bpy.ops.object.select_all(action='DESELECT')
 objs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.active_material==material]
 if objs:
  for o in objs:o.select_set(True)
  bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join()
export('yard')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
# Blender Z up, facing Blender -Y / glTF +Z.
box('Body',(0,0,1.04),(.57,.35,.64),navy,.09)
box('Vest',(0,-.19,1.1),(.49,.12,.44),orange,.035)
for x in [-.14,.14]:box('Magazine',(x,-.27,1.0),(.10,.07,.19),steel,.01)
box('Helmet',(0,0,1.62),(.43,.4,.36),orange,.09)
box('Visor',(0,-.202,1.63),(.35,.075,.16),visor,.035)
for s in [-1,1]:
 box('Leg_'+str(s),(s*.17,0,.37),(.23,.26,.69),navy,.035)
 box('Boot_'+str(s),(s*.17,-.06,.09),(.26,.4,.18),steel,.025)
 arm=box('Arm_'+str(s),(s*.38,-.075,1.04),(.19,.25,.58),navy,.035);arm.rotation_euler.x=.38
 box('Glove_'+str(s),(s*.38,-.2,.8),(.18,.2,.17),steel,.025)
box('Training rifle',(.24,-.44,1.02),(.15,.65,.16),steel,.02)
box('Muzzle',(.24,-.84,1.04),(.065,.22,.07),visor)
export('operator')
print('Exported original yard and operator assets to',OUT)
