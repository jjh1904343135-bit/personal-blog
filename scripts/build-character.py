"""Reproducible Blender 4.5 LTS scene. No photos projected onto the character.

blender --background --factory-startup --python scripts/build-character.py
The .blend stays private; only the evaluated GLB and its poster are shipped.
"""
from pathlib import Path
import math
import json
import random
import struct
import zlib
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/public/models'
SOURCE = ROOT / 'person/about-3d'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)
random.seed(19043)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color, rough=.55, metal=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    return m

skin = material('Warm porcelain skin', (.67, .36, .23), .62)
ear_skin = material('Ear and lip warmth', (.53, .22, .16), .65)
hair = material('Soft black hair', (.014, .011, .012), .78)
hair_light = material('Hair sculpt ridges', (.022, .016, .015), .80)
for m in [hair,hair_light]:m.node_tree.nodes.get('Principled BSDF').inputs['Specular IOR Level'].default_value=.22
suit = material('Midnight wool', (.025, .033, .049), .85)
lapel = material('Tailored lapels', (.040, .051, .070), .70)
white = material('Ivory shirt', (.87, .87, .82), .72)
tie = material('Navy silk', (.035, .063, .125), .44)
silver = material('Brushed silver glasses', (.46, .51, .55), .30, .72)
eye_white = material('Eye whites', (.89, .86, .78), .37)
iris = material('Chestnut irises', (.12, .060, .036), .33)
black = material('Pupils and details', (.006, .008, .012), .3)
shine = material('Eye catchlights', (1, .99, .94), .2)
mouth = material('Smile interior', (.075, .016, .018), .8)
lip = material('Soft lip', (.40, .12, .085), .67)
pink = material('Coral sticker', (.83, .14, .17), .65)
blue = material('Ink blue sticker', (.055, .13, .30), .7)
green = material('Little dinosaur green', (.095, .40, .22), .75)
bear = material('Bear biscuit', (.34, .17, .105), .7)
cream = material('Sticker paper', (.96, .92, .80), .8)
gold = material('Sticker peach', (.91, .48, .16), .75)

def empty(name, loc=(0, 0, 0), parent=None):
    ob = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(ob)
    ob.location = loc
    ob.parent = parent
    return ob

root = empty('OkzuCharacter')
neck = empty('NeckPivot', (0, 0, 2.03), root)
head = empty('HeadPivot', (0, 0, .38), neck)
head.scale=(1.12,1.12,1.12)

def attach(ob, name, loc, mat, parent=root):
    ob.name = name
    ob.location = loc
    ob.parent = parent
    if mat:
        ob.data.materials.append(mat)
    for poly in ob.data.polygons:
        poly.use_smooth = True
    return ob

def sphere(name, loc, scale, mat, parent=root, seg=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings)
    ob = bpy.context.object
    attach(ob, name, loc, mat, parent)
    # Bake scale, so child eyeball pivots retain spherical rotation axes.
    for vertex in ob.data.vertices:
        vertex.co.x *= scale[0]
        vertex.co.y *= scale[1]
        vertex.co.z *= scale[2]
    return ob

def mesh(name, verts, faces, mat, parent=root):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    return attach(ob, name, (0, 0, 0), mat, parent)

def tube(name, points, radii, mat, parent=root, sides=8, flatten=1):
    verts, faces = [], []
    for i, p in enumerate(points):
        tangent = Vector(points[min(i+1,len(points)-1)]) - Vector(points[max(0,i-1)])
        tangent.normalize()
        a = tangent.cross(Vector((0, 1, 0)))
        if a.length < .01:
            a = tangent.cross(Vector((0, 0, 1)))
        a.normalize()
        b = tangent.cross(a).normalized()
        for j in range(sides):
            angle = j * math.tau / sides
            v = Vector(p) + a * math.cos(angle) * radii[i] + b * math.sin(angle) * radii[i] * flatten
            verts.append(tuple(v))
        if i:
            for j in range(sides):
                prev=(i-1)*sides+j; here=i*sides+j
                faces.append((prev,(i-1)*sides+(j+1)%sides,i*sides+(j+1)%sides,here))
    faces += [tuple(reversed(range(sides))), tuple((len(points)-1)*sides+j for j in range(sides))]
    return mesh(name, verts, faces, mat, parent)

def bezier(a,b,c,d,n=20):
    return [tuple((1-t)**3*a[k]+3*(1-t)**2*t*b[k]+3*(1-t)*t*t*c[k]+t**3*d[k] for k in range(3)) for t in [i/(n-1) for i in range(n)]]

def shape(ob, name, transform):
    if not ob.data.shape_keys:
        ob.shape_key_add(name='Basis')
    key=ob.shape_key_add(name=name)
    for vertex in key.data:
        vertex.co = transform(vertex.co.copy())
    return key

# A continuous cheek/jaw cranium, rather than a stack of intersecting balls.
verts=[]; faces=[]
for i in range(49):
    phi=.001+(math.pi-.002)*i/48
    z=math.cos(phi)
    cheek=1+.07*math.exp(-((z+.22)/.27)**2)-.16*max(0,-z-.22)
    for j in range(64):
        theta=j*math.tau/64
        verts.append((.91*math.sin(phi)*math.cos(theta)*cheek,.67*math.sin(phi)*math.sin(theta),.75+1.03*z))
        if i:
            a=(i-1)*64+j; b=(i-1)*64+(j+1)%64
            faces.append((i*64+j,i*64+(j+1)%64,b,a))
face=mesh('Face',verts,faces,skin,head)
shape(face,'Smile',lambda v: Vector((v.x,v.y,v.z+.028*math.exp(-((abs(v.x)-.5)/.25)**2)*math.exp(-((v.z-.35)/.3)**2))))
shape(face,'MouthOpen',lambda v: Vector((v.x,v.y,v.z-.045*max(0,(.35-v.z)/.65))))
sphere('Neck',(0,0,2.1),(.29,.28,.35),skin)
for sign in [-1,1]:
    sphere('Ear',(sign*.87,.015,.68),(.19,.13,.29),skin,head)
    sphere('Inner ear',(sign*.975,-.065,.68),(.055,.065,.16),ear_skin,head,16,12)
sphere('Button nose',(0,-.72,.55),(.145,.16,.12),skin,head)
for sign in [-1,1]:
    sphere('Nose wing',(sign*.105,-.664,.505),(.075,.085,.065),skin,head,16,12)

# Independent real eyeballs: iris, pupil and glints rotate with their pivot.
for sign, side in [(-1,'L'),(1,'R')]:
    eye=empty(f'Eye_{side}',(sign*.375,-.566,.81),head)
    sphere('Sclera',(0,0,0),(.276,.160,.252),eye_white,eye,32,20)
    sphere('Iris',(0,-.153,0),(.123,.020,.128),iris,eye,24,16)
    sphere('Pupil',(0,-.170,0),(.078,.009,.084),black,eye,24,16)
    sphere('Catchlight',(-.036,-.180,.046),(.025,.005,.027),shine,eye,12,8)
    sphere('Soft glint',(.035,-.180,-.034),(.009,.004,.010),shine,eye,8,6)
    brow_points=bezier((sign*.12,-.634,1.16),(sign*.29,-.69,1.26),(sign*.50,-.63,1.24),(sign*.65,-.53,1.15),18)
    brow=tube('Eyebrow',brow_points,[.026*math.sin(math.pi*i/17)**.3+.006 for i in range(18)],hair,head)
    shape(brow,'BrowRaise',lambda v:Vector((v.x,v.y,v.z+.09*(1-.45*abs(v.x)))))

# Silver rounded-square spectacle frames, bridge and temple arms.
for sign in [-1,1]:
    points=[]
    for j in range(65):
        t=j*math.tau/64; c=math.cos(t); s=math.sin(t)
        points.append((sign*.375+.318*math.copysign(abs(c)**.55,c),-.839+.045*abs(c),.81+.274*math.copysign(abs(s)**.55,s)))
    tube('Silver rim',points,[.015]*len(points),silver,head,8)
    points=bezier((sign*.685,-.78,.86),(sign*.86,-.59,.92),(sign*.94,-.05,.88),(sign*.94,.14,.78),16)
    tube('Temple arm',points,[.014]*16,silver,head)
points=bezier((-.065,-.83,.87),(-.04,-.92,.94),(.04,-.92,.94),(.065,-.83,.87),16)
tube('Bridge',points,[.014]*16,silver,head)

# A curved lip and modeled mouth cavity, with genuine morph targets.
points=[]
for i in range(49):
    t=i*math.tau/48
    x=.285*math.cos(t); z=.205+.045*math.sin(t)+.045*(x/.285)**2
    points.append((x,-.593+.045*(x/.285)**2,z))
lower=tube('Lip',points,[.012]*len(points),lip,head)
shape(lower,'Smile',lambda v:Vector((v.x*1.06,v.y,v.z+.055*(v.x/.30)**2)))
shape(lower,'MouthOpen',lambda v:Vector((v.x,v.y-.007,.205+(v.z-.205)*2.1)))
cavity=sphere('Mouth interior',(0,-.581,.225),(.276,.022,.040),mouth,head,32,12)
shape(cavity,'Smile',lambda v:Vector((v.x*1.06,v.y,v.z+.05*(v.x/.29)**2)))
shape(cavity,'MouthOpen',lambda v:Vector((v.x,v.y,v.z*2.5)))

# Hair cap and swept tapered locks: sculpted volumes, not alpha cards.
verts=[];faces=[]
for i in range(22):
    for j in range(56):
        t=j*math.tau/56
        phi=.002+(1.52-.48*max(0,-math.sin(t)))*i/21
        z=1.13+.83*math.cos(phi)
        verts.append((.97*math.sin(phi)*math.cos(t),.72*math.sin(phi)*math.sin(t)+.045,z))
        if i:
            a=(i-1)*56+j; faces.append((i*56+j,i*56+(j+1)%56,(i-1)*56+(j+1)%56,a))
mesh('Hair foundation',verts,faces,hair,head)
for i in range(17):
    f=i/16
    points=bezier((-.60+1.25*f,.15,1.74),(-.25+1.18*f,-.10,2.28+.12*math.sin(math.pi*f)),(-1.08+1.72*f,-.65,1.85+.13*math.sin(math.pi*f)),(-.94+1.78*f,-.57+.12*abs(2*f-1),1.22+.34*math.sin(math.pi*f)),28)
    radius=[(.12+.025*math.sin(math.pi*j/27))*math.sin(math.pi*j/27)**.55+.006 for j in range(28)]
    tube('Swept fringe',points,radius,hair if i%5 else hair_light,head,12,.72)
for i in range(9):
    f=i/8
    points=bezier((.58,.12+f*.18,1.80),(1.04,.06+f*.16,1.70),(1.04,-.27+f*.20,1.42),(.91,-.28+f*.16,1.07),20)
    tube('Right sweep',points,[.09*(.18+math.sin(math.pi*(j+.5)/20)**.7) for j in range(20)],hair,head,8,.75)

# Tailored rounded torso and separate lapel/collar surfaces.
verts=[];faces=[]
levels=[(.0,.79,.37),(.18,.88,.43),(.85,.93,.46),(1.55,1.04,.44),(1.82,.98,.39),(2.01,.50,.30),(2.09,.30,.25)]
for i,(z,rx,ry) in enumerate(levels):
    for j in range(48):
        t=j*math.tau/48;verts.append((rx*math.cos(t),ry*math.sin(t),z))
        if i:
            a=(i-1)*48+j;faces.append((a,(i-1)*48+(j+1)%48,i*48+(j+1)%48,i*48+j))
torso=mesh('Jacket body',verts,faces,suit)
sub=torso.modifiers.new('Rounded tailoring','SUBSURF');sub.levels=2
bpy.context.view_layer.objects.active=torso;bpy.ops.object.modifier_apply(modifier=sub.name)
mesh('Shirt front',[(-.32,-.31,2.04),(.32,-.31,2.04),(.30,-.48,1.43),(0,-.49,.8),(-.30,-.48,1.43)],[(0,1,2,3,4)],white)
for sign in [-1,1]:
    mesh('Lapel',[(sign*.28,-.34,2.04),(sign*.78,-.39,1.75),(sign*.60,-.50,1.45),(sign*.69,-.49,1.27),(sign*.09,-.51,.78),(sign*.33,-.50,1.66)],[(0,1,2,3,4,5)],lapel)
    mesh('Shirt collar',[(sign*.04,-.37,2.07),(sign*.30,-.33,2.04),(sign*.35,-.45,1.78),(sign*.13,-.52,1.84)],[(0,1,2,3)],white)
    # Bent arms and cream cuffs; fixed hands remain in the reference's lapel pose.
    points=bezier((sign*.72,.04,1.63),(sign*1.13,.02,1.55),(sign*1.17,-.23,.54),(sign*.78,-.50,.71),20)
    tube('Sleeve',points,[.23-.045*j/19 for j in range(20)],suit,root,16)
    cuff=sphere('Cuff',(sign*.71,-.59,.82),(.225,.20,.13),white)
    palm=sphere('Hand',(sign*.63,-.65,1.02),(.23,.21,.28),skin)
    for j in range(4):
        sphere('Curled finger',(sign*(.66+.014*j),-.837,1.20-.105*j),(.175-.012*j,.09,.069),skin,root,20,12)
    thumb=sphere('Thumb',(sign*.455,-.84,1.07),(.105,.095,.21),skin)
    thumb.rotation_euler.y=sign*-.43
sphere('Tie knot',(0,-.433,1.9),(.105,.09,.117),tie)
mesh('Tie blade',[(0,-.49,1.86),(.09,-.51,1.72),(.135,-.54,1.07),(0,-.55,.89),(-.135,-.54,1.07),(-.09,-.51,1.72)],[(0,1,2,3,4,5)],tie)

# Tiny sculpted paper stickers follow the head's surface normal.
def sticker_base(name,x,z,size):
    surface_y=-.67*math.sqrt(max(.10,1-(x/.91)**2-((z-.75)/1.03)**2))
    pos=Vector((x,surface_y,z)); normal=Vector((x/.91**2,surface_y/.67**2,(z-.75)/1.03**2)).normalized()
    group=empty(name,tuple(pos+normal*.018),head)
    group.rotation_mode='QUATERNION';group.rotation_quaternion=Vector((0,-1,0)).rotation_difference(normal)
    sphere('Sticker edge',(0,0,0),(size,.018,size),cream,group,24,12)
    return group

def teddy(group,size):
    for sign in [-1,1]:
        sphere('Bear ear',(sign*size*.62,-.025,size*.53),(size*.32,.018,size*.34),bear,group,12,8)
    sphere('Bear face',(0,-.027,0),(size*.79,.025,size*.73),bear,group,20,12)
    sphere('Bear muzzle',(0,-.056,-size*.22),(size*.41,.01,size*.29),cream,group,16,8)
    for sign in [-1,1]:sphere('Bear eye',(sign*size*.31,-.056,size*.11),(size*.070,.007,size*.09),black,group,8,6)
    sphere('Bear nose',(0,-.07,-size*.10),(size*.11,.008,size*.08),black,group,8,6)

teddy(sticker_base('Cheek bear',-.54,.39,.19),.17)
teddy(sticker_base('Forehead bear',.43,1.27,.14),.12)
g=sticker_base('Dinosaur sticker',.59,.34,.18)
sphere('Dinosaur body',(.015,-.026,-.02),(.085,.017,.125),green,g,20,12)
sphere('Dinosaur head',(-.035,-.03,.087),(.108,.02,.075),green,g,20,12)
sphere('Dinosaur eye',(-.069,-.053,.109),(.012,.005,.013),black,g,8,6)
for i in range(4):sphere('Dinosaur spine',(.09,-.026,.085-i*.052),(.025,.009,.030),gold,g,10,6)
for x in [-.038,.055]:sphere('Dinosaur foot',(x,-.033,-.13),(.049,.017,.024),green,g,12,8)
g=sticker_base('Coral heart',-.64,.10,.09)
heartverts=[(0,-.027,-.062)]
for i in range(33):
    t=i*math.tau/32;heartverts.append((.0043*16*math.sin(t)**3,-.03,.0043*(13*math.cos(t)-5*math.cos(2*t)-2*math.cos(3*t)-math.cos(4*t))))
mesh('Heart',heartverts,[(0,i,i+1) for i in range(1,33)],pink,g)
g=sticker_base('Good boy label',-.23,1.36,.22)
# Text is actual extruded mesh; the sticker does not contain a facial photograph.
bpy.ops.object.text_add()
text=bpy.context.object;text.name='GOOD BOY lettering';text.parent=g;text.location=(-.135,-.035,-.074)
text.rotation_euler=(math.pi/2,0,0);text.data.body='GOOD\nBOY';text.data.size=.112;text.data.align_x='LEFT';text.data.space_line=.8;text.data.extrude=.001;text.data.materials.append(blue)
bpy.context.view_layer.objects.active=text;bpy.ops.object.convert(target='MESH')

# Reduce draw calls by merging only static meshes sharing a parent and material.
groups={}
for ob in list(bpy.context.scene.objects):
    if ob.type=='MESH' and not ob.data.shape_keys:
        key=(ob.parent.name if ob.parent else '',ob.data.materials[0].name if ob.data.materials else '')
        groups.setdefault(key,[]).append(ob)
for objects in groups.values():
    if len(objects)<2:continue
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects:ob.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()

scene=bpy.context.scene
scene.world.color=(.12,.12,.12)
scene.render.engine='CYCLES';scene.cycles.samples=32
scene.render.resolution_x=900;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.view_settings.view_transform='Standard'
scene.view_settings.look='Medium High Contrast' if 'Medium High Contrast' in [i.name for i in bpy.types.ColorManagedViewSettings.bl_rna.properties['look'].enum_items] else 'None'

def point_at(ob,point):ob.rotation_euler=(Vector(point)-ob.location).to_track_quat('-Z','Y').to_euler()
def area(name,loc,power,size,color):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
    ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob);ob.location=loc;point_at(ob,(0,0,2.6))
area('Large softbox',(-3,-4,7),520,5,(1,.89,.78))
area('Cool fill',(3,-2,4),350,4,(.75,.84,1))
area('Hair rim',(2,2,6),650,3,(.84,.90,1))
bpy.ops.object.camera_add(location=(0,-10,2.65))
camera=bpy.context.object;camera.name='PortraitCamera';camera.data.type='ORTHO';camera.data.ortho_scale=4.5
point_at(camera,(0,0,2.65));scene.camera=camera

# Validate geometry and the explicit browser control contract before export.
triangles=sum(sum(len(p.vertices)-2 for p in ob.data.polygons) for ob in scene.objects if ob.type=='MESH')
assert triangles<=80000, f'Triangle budget exceeded: {triangles}'
for name in ['HeadPivot','NeckPivot','Eye_L','Eye_R','Face']:assert bpy.data.objects.get(name),name
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'okzu-character.blend'))
bpy.ops.object.select_all(action='DESELECT')
for ob in scene.objects:
    if ob.type in {'MESH','EMPTY'}:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'okzu-character.glb'),export_format='GLB',use_selection=True,export_animations=False,export_morph=True,export_morph_normal=True,export_yup=True)
assert (OUT/'okzu-character.glb').stat().st_size<8*1024*1024
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
scene.render.filepath=str(SOURCE/'okzu-character-blender-reference.png')
bpy.ops.render.render(write_still=True)
poster=SOURCE/'okzu-character-blender-reference.png'
origin='Original Blender 4.5 LTS Cycles render of the procedural mesh in scripts/build-character.py. User-authorized cartoon likeness; no photo-card textures or external image-generation service. Transparent orthographic portrait.'
data=b'impeccable:prompt\x00'+origin.encode('utf-8')
chunk=struct.pack('>I',len(data))+b'tEXt'+data+struct.pack('>I',zlib.crc32(b'tEXt'+data)&0xffffffff)
pixels=poster.read_bytes()
poster.write_bytes(pixels[:-12]+chunk+pixels[-12:])
(OUT/'okzu-character.json').write_text(json.dumps({'generator':'Blender '+bpy.app.version_string,'source':'scripts/build-character.py','triangles':triangles,'license':'Original procedural character created for ok俎; likeness based on user-authorized references.','controls':['HeadPivot','NeckPivot','Eye_L','Eye_R'],'morphTargets':['Smile','BrowRaise','MouthOpen'],'orthographicSize':4.5,'centerHeight':2.65},ensure_ascii=False,indent=2),encoding='utf-8')
print('CHARACTER_COMPLETE',triangles,(OUT/'okzu-character.glb').stat().st_size)
