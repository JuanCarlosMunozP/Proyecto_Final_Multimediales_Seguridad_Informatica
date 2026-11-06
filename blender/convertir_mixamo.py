"""Convierte un personaje de Mixamo (.fbx) a .glb con los nombres de hueso que usa el juego.

Uso: blender -b --python blender/convertir_mixamo.py -- <entrada.fbx> <salida.glb>
"""
import math
import random
import sys
import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

entrada, salida = sys.argv[sys.argv.index("--") + 1:][:2]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=entrada)

# nombres de Mixamo -> nombres de articulaciones de personaje.js
NOMBRES = {
    "Hips": "cadera", "Spine1": "torso", "Head": "cabeza",
    "LeftArm": "hombro_I", "LeftForeArm": "codo_I",
    "RightArm": "hombro_D", "RightForeArm": "codo_D",
    "LeftUpLeg": "muslo_I", "LeftLeg": "rodilla_I",
    "RightUpLeg": "muslo_D", "RightLeg": "rodilla_D",
}

arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
mallas = [o for o in bpy.data.objects if o.type == 'MESH']

# sin animaciones: el juego anima los huesos por codigo
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)
if arm.animation_data:
    arm.animation_data_clear()

# la pose queda en reposo; se aplican escala/rotacion del FBX (cm -> m)
bpy.ops.object.select_all(action='DESELECT')
for o in [arm] + mallas:
    o.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

for b in arm.data.bones:
    corto = b.name.split(":")[-1]
    if corto in NOMBRES:
        b.name = NOMBRES[corto]               # Blender renombra tambien los grupos de vertices

# el casco tapa el pelo y la cara
for m in list(mallas):
    if "helmet" in m.name.lower():
        bpy.data.objects.remove(m)
        mallas.remove(m)



def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def linea_pelo(phi, largo=0.5):
    """Altura (seno de la elevacion) a la que empieza el pelo segun el angulo (0 = frente)."""
    sp, cp = math.sin(phi), math.cos(phi)
    dy_b = -cp * 0.9
    t = smooth(0.0, -0.8, dy_b)
    b = smooth(0.1, 0.8, dy_b)
    u = -0.10 - 0.30 * largo * b + 0.50 * t + 0.05 * (1 - t) * (1 - b)
    u += 0.26 * smooth(0.55, 0.95, abs(sp)) * (1 - 0.6 * b)   # laterales: termina sobre la oreja
    return u + 0.04 * math.sin(phi * 7.0)


def agregar_pelo(cuerpo, cantidad=3200, color=(0.035, 0.018, 0.010)):
    """Mechones de pelo (cintas) que nacen de la superficie real de la cabeza y la siguen,
    peinados hacia atras. Se ata al hueso 'cabeza'."""
    rng = random.Random(5)
    huesos = arm.data.bones

    def hueso(corto):
        return next(b for b in huesos if b.name.split(":")[-1] == corto)

    hb = huesos["cabeza"].head_local.copy()
    top = hueso("HeadTop_End").head_local.copy()
    largo_cab = (top - hb).length
    c = hb + (top - hb) * 0.55                       # centro aproximado del craneo
    sc = largo_cab / 0.22                            # escala respecto a una cabeza normal
    pie, dedo = hueso("LeftFoot").head_local, hueso("LeftToeBase").head_local
    fwd = Vector((dedo.x - pie.x, dedo.y - pie.y, 0))
    fwd = fwd.normalized() if fwd.length > 1e-4 else Vector((0, -1, 0))
    up = Vector((0, 0, 1))
    lat = up.cross(fwd).normalized()
    back = -fwd

    bm = bmesh.new()
    bm.from_mesh(cuerpo.data)
    bm.transform(cuerpo.matrix_world)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.faces.ensure_lookup_table()
    arbol = BVHTree.FromBMesh(bm)

    cand, pesos = [], []
    for f in bm.faces:
        ce = f.calc_center_median()
        d = ce - c
        if d.length > largo_cab * 0.95 or d.length < 1e-6:
            continue
        d.normalize()
        phi = math.atan2(d.dot(lat), d.dot(fwd))
        if d.z > linea_pelo(phi):
            cand.append(f)
            pesos.append(f.calc_area())
    print("PELO: caras candidatas", len(cand), "de", len(bm.faces), "escala", round(sc, 2))

    S = 8
    verts, caras, cols = [], [], []
    for f in rng.choices(cand, weights=pesos, k=cantidad):
        a, b, cc = rng.random(), rng.random(), None
        if a + b > 1:
            a, b = 1 - a, 1 - b
        v0, v1, v2 = [v.co for v in f.verts]
        p = v0 + (v1 - v0) * a + (v2 - v0) * b
        n = f.normal.copy()
        if n.dot(p - c) < 0:
            n.negate()
        d = (p - c).normalized()
        x_lat, x_fwd = d.dot(lat), d.dot(fwd)
        if d.z > 0.55:
            L = rng.uniform(0.07, 0.12)              # corona: mas largo
        elif x_fwd > 0.3:
            L = rng.uniform(0.05, 0.09)              # flequillo peinado hacia atras
        else:
            L = rng.uniform(0.028, 0.05)             # lados y nuca: corto
        L *= sc * 0.8
        lift = rng.uniform(0.6, 1.4) * (1.0 if d.z > 0.4 else 0.4)
        w0 = rng.uniform(0.009, 0.016) * sc
        wig = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1))) * 0.22
        tono = rng.uniform(0.6, 1.45)

        pts, tans, nors = [], [], []
        for k in range(S + 1):
            s = k / S
            fl = (back * 1.0 + lat * (0.3 * x_lat) + up * 0.45
                  - up * 0.5 * max(0.0, abs(x_lat) - 0.4)
                  + up * 0.8 * max(0.0, x_fwd - 0.2) + wig)
            t = fl - n * fl.dot(n)
            t.normalize()
            pts.append(p + n * (0.002 * sc + 0.016 * sc * (s ** 1.4) * lift))
            tans.append(t)
            nors.append(n.copy())
            p = p + t * (L / S)
            loc, nor, _, _ = arbol.find_nearest(p)
            if loc is not None:
                p = loc
                n = nor.copy()
                if n.dot(p - c) < 0:
                    n.negate()
        i0 = len(verts)
        for k in range(S + 1):
            s = k / S
            ancho = tans[k].cross(nors[k]).normalized() * (w0 * (1 - 0.85 * s) / 2)
            verts.append(pts[k] - ancho)
            verts.append(pts[k] + ancho)
            col = tuple(min(1.0, q * tono * (0.42 + 0.58 * s ** 0.6)) for q in color)
            cols.extend([col, col])
        for k in range(S):
            i = i0 + 2 * k
            caras.append((i, i + 1, i + 3, i + 2))
    bm.free()

    me = bpy.data.meshes.new("Ch17_Pelo")
    me.from_pydata([tuple(v) for v in verts], [], caras)
    capa = me.color_attributes.new("Col", 'FLOAT_COLOR', 'POINT')
    for i, col in enumerate(cols):
        capa.data[i].color = (*col, 1.0)
    obj = bpy.data.objects.new("Ch17_Pelo", me)
    bpy.context.scene.collection.objects.link(obj)

    mat = bpy.data.materials.new("Ch17_Pelo")
    mat.use_nodes = True
    nodos, enlaces = mat.node_tree.nodes, mat.node_tree.links
    pr = nodos["Principled BSDF"]
    pr.inputs["Roughness"].default_value = 0.55
    at = nodos.new("ShaderNodeVertexColor")
    at.layer_name = "Col"
    enlaces.new(at.outputs["Color"], pr.inputs["Base Color"])
    mat.use_backface_culling = False
    me.materials.append(mat)
    for p_ in me.polygons:
        p_.use_smooth = True

    obj.vertex_groups.new(name="cabeza").add(list(range(len(me.vertices))), 1.0, 'REPLACE')
    mod = obj.modifiers.new("Armature", 'ARMATURE')
    mod.object = arm
    obj.parent = arm
    return obj


agregar_pelo(next(m for m in mallas if m.name.lower().endswith("body")))

# texturas mas ligeras para la web
for img in bpy.data.images:
    if img.size[0] > 1024 or img.size[1] > 1024:
        img.scale(1024, 1024)

alto = max((m.dimensions.z for m in mallas), default=0)
print("ALTURA", alto, "HUESOS", [b.name for b in arm.data.bones if b.name in NOMBRES.values()])

bpy.ops.export_scene.gltf(
    filepath=salida, export_format='GLB', export_apply=False, export_yup=True,
    export_animations=False, export_skins=True)
print("Exportado:", salida)
