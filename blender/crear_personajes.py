"""
Modelado de los personajes y objetos del juego (Blender 4.5, modo headless):

  blender -b --python crear_personajes.py

Genera en public/models (frontend):  max.glb, enemigo.glb, idolo.glb, palmera.glb

Los humanos NO son piezas pegadas: son un cuerpo continuo y organico
  - Cuerpo: modificador Skin + Subdivision (musculos, hombros, entrepierna sin costuras)
  - Cabeza: esfera esculpida por codigo (nariz, cejas, cuencas, labios, menton, barba)
  - Ropa: pintada en colores de vertice + relieve (chaqueta, cuello, cinturon, correa, botas)
  - Pelo: casco de mechones con grosor
  - Esqueleto real (armature) con pesos automaticos; las mismas articulaciones se
    mueven desde Three.js: cadera, torso, cabeza, hombro_I/D, codo_I/D, muslo_I/D, rodilla_I/D
I = izquierda (+X en Three.js), D = derecha (-X). El frente mira a +Z en Three.js.
"""
import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector, noise

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cara import RX, RY, RZ, HS, CABEZA_Z, crear_cabeza   # cabeza esculpida y texturizada

RAIZ = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.environ.get(
    "SALIDA_MODELOS",
    os.path.normpath(os.path.join(RAIZ, "..", "frontend", "public", "models")))
PREVIEW = os.environ.get("PREVIEW_DIR")  # si existe, guarda imagenes de prueba


# ---------------------------------------------------------------- utilidades
def limpiar():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def sm(a, b, x):
    """smoothstep: 0 antes de a, 1 despues de b."""
    if a == b:
        return 0.0
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def g(x, s):
    """campana de Gauss (para rasgos de la cara)."""
    return math.exp(-0.5 * (x / s) ** 2)


def mezcla(c1, c2, t):
    return tuple(a + (b - a) * t for a, b in zip(c1, c2))


def lin(c):
    """color sRGB -> lineal (los colores de vertice de glTF son lineales)."""
    return tuple(v ** 2.2 for v in c)


def ruido(p, f=1.0):
    return noise.noise(Vector(p) * f) * 0.5 + 0.5


def material(nombre, color, rugoso=0.6, metalico=0.0, brillo=0.0):
    mat = bpy.data.materials.new(nombre)
    mat.use_nodes = True
    mat.diffuse_color = (*color, 1.0)
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = rugoso
    bsdf.inputs["Metallic"].default_value = metalico
    if brillo > 0:
        bsdf.inputs["Emission Color"].default_value = (*color, 1.0)
        bsdf.inputs["Emission Strength"].default_value = brillo
    return mat


def material_vertex(nombre, rugoso=0.7, metalico=0.0):
    """Material que toma el color de la capa de color de vertice 'Col'."""
    mat = bpy.data.materials.new(nombre)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rugoso
    bsdf.inputs["Metallic"].default_value = metalico
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def poner(obj, mat, nombre):
    obj.name = nombre
    obj.data.materials.append(mat)
    return obj


def atar(obj, padre):
    if padre is None:
        return
    bpy.context.view_layer.update()
    obj.parent = padre
    obj.matrix_parent_inverse = padre.matrix_world.inverted()


def terminar(obj, mat, nombre, padre=None, suave=True):
    poner(obj, mat, nombre)
    if suave:
        bpy.ops.object.shade_smooth()
    atar(obj, padre)
    return obj


def elip(nombre, pos, esc, mat, padre=None, rot=(0, 0, 0), seg=28, anillos=18):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=seg, ring_count=anillos, radius=1, location=pos, rotation=rot)
    o = bpy.context.object
    o.scale = esc
    bpy.ops.object.transform_apply(scale=True)
    return terminar(o, mat, nombre, padre)


def cono(nombre, a, b, r1, r2, mat, padre=None, vertices=24):
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices, radius1=r1, radius2=r2, depth=d.length, location=(a + b) / 2)
    o = bpy.context.object
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(rotation=True)
    return terminar(o, mat, nombre, padre)


def caja(nombre, pos, esc, mat, padre=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos, rotation=rot)
    o = bpy.context.object
    o.scale = esc
    bpy.ops.object.transform_apply(scale=True)
    return terminar(o, mat, nombre, padre, suave=False)


def fusionar():
    """Une las mallas que comparten padre y material (menos draw calls)."""
    grupos = {}
    for o in list(bpy.data.objects):
        if o.type == 'MESH' and o.data.materials:
            clave = (o.parent.name if o.parent else "", o.data.materials[0].name)
            grupos.setdefault(clave, []).append(o)
    for objs in grupos.values():
        if len(objs) < 2:
            continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()


def exportar(nombre, fusion=False):
    if fusion:
        fusionar()
    os.makedirs(SALIDA, exist_ok=True)
    ruta = os.path.join(SALIDA, nombre)
    bpy.ops.export_scene.gltf(
        filepath=ruta, export_format='GLB', export_apply=False, export_yup=True,
        export_animations=False, export_skins=True)
    print("Exportado:", ruta)


def previsualizar(nombre, objetivo=(0, 0, 0.95), dist=4.2, altura=1.2, angulo=-35, lente=70):
    if not PREVIEW:
        return
    os.makedirs(PREVIEW, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.color_type = 'VERTEX'
    sc.render.resolution_x, sc.render.resolution_y = 600, 800
    a = math.radians(angulo)
    pos = (objetivo[0] + math.sin(a) * dist, objetivo[1] - math.cos(a) * dist, altura)
    for o in list(bpy.data.objects):
        if o.type == 'CAMERA':
            bpy.data.objects.remove(o)
    bpy.ops.object.camera_add(location=pos)
    cam = bpy.context.object
    cam.rotation_euler = (Vector(objetivo) - Vector(pos)).to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = lente
    sc.camera = cam
    sc.render.filepath = os.path.join(PREVIEW, nombre + ".png")
    bpy.ops.render.render(write_still=True)


# ------------------------------------------------------------- CUERPO
def crear_cuerpo(cfg):
    """Cuerpo continuo: esqueleto de aristas -> Skin -> Subdivision -> ropa pintada."""
    V, E = [], []

    def v(pos, r):
        V.append((pos, r if isinstance(r, tuple) else (r, r)))
        return len(V) - 1

    def e(a, b):
        E.append((a, b))

    # columna
    # (el modificador Skin usa (profundidad, ancho) en la columna)
    pelvis = v((0, 0, 0.96), (0.110, 0.155))
    cintura = v((0, 0, 1.10), (0.100, 0.135))
    pecho_b = v((0, 0, 1.25), (0.112, 0.170))
    pecho_a = v((0, 0, 1.40), (0.110, 0.192))
    cuello_b = v((0, 0, 1.52), 0.068)
    cuello_a = v((0, 0.01, 1.64), 0.058)
    e(pelvis, cintura); e(cintura, pecho_b); e(pecho_b, pecho_a)
    e(pecho_a, cuello_b); e(cuello_b, cuello_a)

    for s in (1, -1):
        # hombros y brazo
        hombro = v((s * 0.200, 0, 1.46), 0.064)
        biceps = v((s * 0.226, 0, 1.33), 0.057)
        codo = v((s * 0.238, 0, 1.20), 0.049)
        anteb = v((s * 0.247, 0, 1.08), 0.046)
        muneca = v((s * 0.256, 0, 0.955), 0.038)
        e(pecho_a, hombro)
        e(hombro, biceps); e(biceps, codo); e(codo, anteb)
        e(anteb, muneca)        # la mano con dedos es una malla aparte (crear_manos)
        # pierna y pie
        cad = v((s * 0.095, 0, 0.95), 0.108)
        muslo = v((s * 0.095, 0, 0.72), 0.094)
        rod = v((s * 0.095, 0, 0.50), 0.076)
        panto = v((s * 0.095, 0.012, 0.32), 0.068)
        tobillo = v((s * 0.095, 0, 0.11), 0.052)
        pie = v((s * 0.095, -0.10, 0.052), (0.052, 0.042))
        punta = v((s * 0.095, -0.19, 0.040), (0.046, 0.033))
        e(pelvis, cad); e(cad, muslo); e(muslo, rod); e(rod, panto)
        e(panto, tobillo); e(tobillo, pie); e(pie, punta)

    mesh = bpy.data.meshes.new("cuerpo_m")
    mesh.from_pydata([p for p, _ in V], E, [])
    obj = bpy.data.objects.new("cuerpo", mesh)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.mesh.customdata_skin_add()
    for i, (_, r) in enumerate(V):
        mesh.skin_vertices[0].data[i].radius = r
    mesh.skin_vertices[0].data[pelvis].use_root = True

    sk = obj.modifiers.new("Skin", 'SKIN')
    sk.use_smooth_shade = True
    sk.branch_smoothing = 1.0
    sb = obj.modifiers.new("Sub", 'SUBSURF')
    sb.levels = 3
    sb.render_levels = 3
    bpy.ops.object.modifier_apply(modifier="Skin")
    bpy.ops.object.modifier_apply(modifier="Sub")
    # la malla del Skin sale algo asimetrica: copiamos un lado sobre el otro
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.symmetrize(direction='POSITIVE_X')
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.shade_smooth()

    vestir_cuerpo(obj, cfg)
    return obj


def crear_manos(cfg):
    """Manos con palma, cuatro dedos ligeramente curvados y pulgar (Skin + Subdivision).
    Una sola malla con las dos manos; cada mano sigue al hueso codo_I / codo_D."""
    V, E = [], []

    def v(pos, r):
        V.append((pos, r if isinstance(r, tuple) else (r, r)))
        return len(V) - 1

    raices = []
    for s in (1, -1):
        muneca = v((s * 0.256, 0, 0.945), (0.030, 0.036))
        raices.append(muneca)
        palma = v((s * 0.260, -0.003, 0.903), (0.024, 0.036))
        E.append((muneca, palma))
        largos = (0.92, 1.0, 0.95, 0.80)
        for i, y in enumerate((0.030, 0.010, -0.010, -0.030)):
            nudillo = v((s * 0.262, y * 0.9, 0.880), 0.0105)
            E.append((palma, nudillo))
            L = largos[i]
            f1 = v((s * 0.262, y - 0.004 - 0.010 * L, 0.880 - 0.034 * L), 0.0092)
            f2 = v((s * 0.258, y - 0.012 - 0.018 * L, 0.880 - 0.062 * L), 0.0082)
            f3 = v((s * 0.252, y - 0.018 - 0.030 * L, 0.880 - 0.082 * L), 0.0070)
            E.extend([(nudillo, f1), (f1, f2), (f2, f3)])
        # pulgar: nace en la base de la palma, hacia delante
        p0 = v((s * 0.250, -0.026, 0.915), 0.0150)
        p1 = v((s * 0.246, -0.048, 0.888), 0.0115)
        p2 = v((s * 0.240, -0.058, 0.860), 0.0095)
        E.extend([(palma, p0), (p0, p1), (p1, p2)])

    mesh = bpy.data.meshes.new("manos_m")
    mesh.from_pydata([p for p, _ in V], E, [])
    obj = bpy.data.objects.new("manos", mesh)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.ops.mesh.customdata_skin_add()
    for i, (_, r) in enumerate(V):
        mesh.skin_vertices[0].data[i].radius = r
    for r in raices:
        mesh.skin_vertices[0].data[r].use_root = True
    sk = obj.modifiers.new("Skin", 'SKIN')
    sk.use_smooth_shade = True
    sk.branch_smoothing = 1.0
    sb = obj.modifiers.new("Sub", 'SUBSURF')
    sb.levels = 2
    sb.render_levels = 2
    bpy.ops.object.modifier_apply(modifier="Skin")
    bpy.ops.object.modifier_apply(modifier="Sub")
    bpy.ops.object.shade_smooth()

    piel = lin(cfg["piel"])
    capa = mesh.color_attributes.new("Col", 'FLOAT_COLOR', 'POINT')
    for i, vt in enumerate(mesh.vertices):
        # sombra en las puntas y entre dedos, para dar volumen
        t = max(0.0, min(1.0, (0.90 - vt.co.z) / 0.12))
        k = 1.0 - 0.18 * t
        capa.data[i].color = (piel[0] * k, piel[1] * k * (1 - 0.05 * t), piel[2] * k * (1 - 0.05 * t), 1.0)
    return obj


def vestir_cuerpo(obj, cfg):
    """Pinta la ropa en colores de vertice y le da relieve (volumen) a cada prenda."""
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.normal_update()

    piel = lin(cfg["piel"])
    jaca = lin(cfg["chaqueta"])
    cami = lin(cfg["camisa"])
    pant = lin(cfg["pantalon"])
    bota = lin(cfg["bota"])
    cuero = lin(cfg["cuero"])
    mangas_cortas = cfg.get("mangas_cortas", False)
    manga_color = cami if mangas_cortas else jaca

    colores = []
    for vt in bm.verts:
        x, y, z = vt.co
        ax = abs(x)
        n = vt.normal

        brazo = sm(0.205, 0.235, ax) * sm(0.60, 0.80, z)  # 1 en el brazo, 0 en el torso/piernas
        zona_sup = sm(0.97, 1.0, z)                      # 1 sobre la cintura
        cuello_piel = (1 - sm(0.085, 0.13, ax)) * sm(1.515, 1.55, z)
        manga_cubre = sm(1.19, 1.23, z) if mangas_cortas else 1.0

        # V de la camisa (chaqueta abierta)
        frente = sm(-0.035, -0.075, y)
        medio_v = 0.022 + 0.042 * (1.52 - z) / 0.45
        v_camisa = (frente * (1 - sm(medio_v - 0.008, medio_v + 0.008, ax))
                    * sm(1.02, 1.07, z) * sm(1.60, 1.50, z) * (1 - brazo))

        mj = zona_sup * (1 - cuello_piel)                          # prenda superior
        mj_brazo = mj * brazo
        mj_torso = mj * (1 - brazo)
        mp = (1 - zona_sup) * (1 - brazo)                          # pantalon
        mb = (1 - sm(0.255, 0.285, z)) * (1 - brazo) * mp          # botas
        mano = brazo * (1 - zona_sup)                               # mano al descubierto

        # cinturon, correa, cuello alto de la chaqueta, puños, bota
        cinturon = g(z - 0.985, 0.017) * (1 - brazo)
        sx0, sz0, sx1, sz1 = -0.17, 1.48, 0.13, 1.04     # correa en diagonal (plano X-Z)
        dx, dz = sx1 - sx0, sz1 - sz0
        t = max(0.0, min(1.0, ((x - sx0) * dx + (z - sz0) * dz) / (dx * dx + dz * dz)))
        dist = math.hypot(x - (sx0 + dx * t), z - (sz0 + dz * t))
        correa = (sm(0.020, 0.012, dist) * (1 - brazo) * sm(1.0, 1.1, z)
                  * (1 - v_camisa) * (1 if cfg.get("correa", True) else 0))
        collar = (sm(1.46, 1.49, z) * sm(1.545, 1.515, z) * (1 - sm(0.115, 0.15, ax))
                  * (1 - frente * (1 - sm(0.028, 0.05, ax))))
        punos = g(z - 1.0, 0.012) * brazo
        borde_bota = g(z - 0.262, 0.011) * (1 - brazo)
        suela = sm(0.032, 0.018, z) * mb

        # ---- color
        c = piel
        c = mezcla(c, pant, mp)
        c = mezcla(c, bota, mb)
        c = mezcla(c, jaca, mj_torso)
        c = mezcla(c, manga_color, mj_brazo * manga_cubre)
        c = mezcla(c, cami, v_camisa * mj_torso)
        c = mezcla(c, jaca, collar)
        c = mezcla(c, cuero, max(cinturon, correa) * 0.95)
        c = mezcla(c, cuero, borde_bota * 0.8)
        c = mezcla(c, (0.02, 0.02, 0.02), suela)
        # variacion fina para que no se vea plano (tela, piel)
        var = 0.88 + 0.24 * ruido((x * 38, y * 38, z * 38))
        pliegue = 0.93 + 0.14 * ruido((x * 9, y * 9, z * 9))
        c = tuple(min(1.0, k * var * pliegue) for k in c)
        colores.append(c)

        # ---- relieve (cada prenda tiene grosor)
        d = (0.012 * mj * (manga_cubre if brazo > 0.5 else 1.0)
             + 0.020 * g(z - 1.0, 0.05) * mj_torso            # vuelo de la chaqueta
             + 0.007 * mp + 0.009 * mb
             + 0.010 * cinturon + 0.007 * correa
             + 0.004 * collar + 0.009 * punos + 0.011 * borde_bota
             - 0.006 * v_camisa * mj_torso)
        d += 0.004 * (ruido((x * 22, y * 22, z * 22)) - 0.5) * (mj + mp)
        # cuello: esternocleidomastoideos, nuez y union con los trapecios
        zc = (1 - sm(0.10, 0.15, ax)) * sm(1.50, 1.54, z) * sm(1.68, 1.63, z)
        de = sm(0.03, -0.03, y)
        d += zc * de * (0.008 * g(ax - 0.040, 0.013) * sm(1.60, 1.53, z)
                        + 0.006 * g(x, 0.011) * g(z - 1.585, 0.014))
        d += 0.006 * sm(0.07, 0.13, ax) * g(z - 1.50, 0.03) * (1 - brazo)   # trapecio
        vt.co += n * d

    bm.to_mesh(mesh)
    bm.free()
    capa = mesh.color_attributes.new("Col", 'FLOAT_COLOR', 'POINT')
    for i, c in enumerate(colores):
        capa.data[i].color = (*c, 1.0)
    obj.data.update()


def poner_color_uniforme_malla(me, color):
    capa = me.color_attributes.new("Col", 'FLOAT_COLOR', 'POINT')
    for i in range(len(me.vertices)):
        capa.data[i].color = (*color, 1.0)


# ---------------------------------------------------------------- PELO
def linea_pelo(phi, largo):
    """Altura (dz) a la que empieza el pelo segun el angulo alrededor de la cabeza (0 = frente)."""
    sp, cp = math.sin(phi), math.cos(phi)
    dy_b = -cp * 0.9
    t = sm(0.0, -0.8, dy_b)
    b = sm(0.1, 0.8, dy_b)
    u = (-0.10 - 0.30 * largo * b + 0.04 * (1 - largo)
         + (0.70 - 0.05 * (1 - largo)) * t)
    u += 0.05 * (1 - t) * (1 - b)
    u += 0.26 * sm(0.55, 0.95, abs(sp)) * (1 - 0.6 * b)     # laterales: el pelo termina sobre la oreja
    u += 0.05 * (ruido((phi * 2.5, 1.3, 0)) - 0.5)
    return u


def crear_hebras(cfg, cantidad=1700):
    """Mechones de pelo: cintas curvas que nacen en el cuero cabelludo y siguen el
    peinado (hacia atras y arriba; caen por los lados). Dan volumen y silueta de pelo real."""
    import numpy as np
    rng = np.random.default_rng(cfg.get("semilla", 5))
    largo = cfg.get("pelo_largo", 1.0)
    escala_l = 0.55 + 0.45 * largo
    base_c = lin(cfg["pelo"])
    S = 8
    verts, caras, cols = [], [], []

    def sup(d):
        return Vector((d.x * RX, d.y * RY, d.z * RZ)) * (1.04 * HS)

    def normal(p):
        return Vector((p.x / (RX * HS) ** 2, p.y / (RY * HS) ** 2, p.z / (RZ * HS) ** 2)).normalized()

    for _ in range(cantidad):
        phi = rng.uniform(0, 2 * math.pi)
        u0 = linea_pelo(phi, largo)
        dzv = rng.uniform(u0, 1.0)
        r = math.sqrt(max(0.0, 1 - dzv * dzv))
        d = Vector((math.sin(phi) * r, -math.cos(phi) * r, dzv))

        if dzv > 0.55:
            L = rng.uniform(0.07, 0.12)               # corona: mas largo
        elif d.y < -0.3:
            L = rng.uniform(0.05, 0.09)               # flequillo peinado hacia atras
        else:
            L = rng.uniform(0.028, 0.05)              # lados y nuca: corto
        L *= escala_l
        lift_f = rng.uniform(0.6, 1.4) * (1.0 if dzv > 0.4 else 0.4)
        w0 = rng.uniform(0.009, 0.016)
        wig = Vector(rng.normal(size=3)) * 0.22
        tono = rng.uniform(0.6, 1.45)

        pts, tans, nors = [], [], []
        dirv = d.copy()
        for k in range(S + 1):
            s = k / S
            p = sup(dirv)
            n = normal(p)
            f = Vector((0.30 * dirv.x, 1.0, 0.45)) + Vector((0, 0.3, -0.5)) * max(0.0, abs(dirv.x) - 0.4)
            if dirv.y < -0.2:
                f.z += 0.8 * (-dirv.y - 0.2)           # la parte delantera sube y se peina atras
            f += wig
            t = f - n * f.dot(n)
            t.normalize()
            pts.append(p + n * (0.002 + 0.016 * (s ** 1.4) * lift_f))
            tans.append(t)
            nors.append(n)
            dirv = (dirv + t * (L / S) / (0.10 * HS)).normalized()

        i0 = len(verts)
        for k in range(S + 1):
            s = k / S
            lat = tans[k].cross(nors[k]).normalized()
            w = w0 * (1 - 0.85 * s)
            verts.append(pts[k] - lat * (w / 2))
            verts.append(pts[k] + lat * (w / 2))
            c = tuple(min(1.0, q * tono * (0.42 + 0.58 * s ** 0.6)) for q in base_c)
            cols.extend([c, c])
        for k in range(S):
            a = i0 + 2 * k
            caras.append((a, a + 1, a + 3, a + 2))

    me = bpy.data.meshes.new("hebras_m")
    me.from_pydata([tuple(v) for v in verts], [], caras)
    capa = me.color_attributes.new("Col", 'FLOAT_COLOR', 'POINT')
    for i, c in enumerate(cols):
        capa.data[i].color = (*c, 1.0)
    obj = bpy.data.objects.new("hebras", me)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = (0, 0, CABEZA_Z)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True)
    bpy.ops.object.shade_smooth()
    return obj


def crear_pelo(cfg):
    """Pelo completo = casquete oscuro (fondo del cuero cabelludo) + mechones encima."""
    casco = crear_casquete(cfg)
    hebras = crear_hebras(cfg)
    bpy.ops.object.select_all(action='DESELECT')
    casco.select_set(True)
    hebras.select_set(True)
    bpy.context.view_layer.objects.active = casco
    bpy.ops.object.join()
    return casco


def crear_casquete(cfg):
    """Casquete de pelo con mechones. Se construye como una malla (azimut x elevacion)
    cuyo borde inferior sigue la linea del cabello: hacia atras/largo o corto."""
    largo = cfg.get("pelo_largo", 1.0)
    pelo = tuple(k * 0.55 for k in lin(cfg["pelo"]))     # oscuro: hace de fondo bajo los mechones
    N, M = 128, 22
    posiciones, colores, caras = [], [], []

    def punto(d):
        x = d.x * RX * 1.07
        y = d.y * RY * 1.06
        z = d.z * RZ * 1.05
        z += 0.024 * sm(0.30, 1.0, d.z) * (0.4 + 0.6 * sm(0.4, -0.7, d.y))   # copete
        y += 0.010 * sm(0.2, 0.9, d.z) * largo                                # peinado hacia atras
        ang = math.atan2(d.x, -d.y)
        mech = 0.5 + 0.5 * math.sin(ang * 26 + d.z * 6 + 3 * ruido((d.x * 4, d.y * 4, d.z * 4)))
        r = 1 + 0.040 * mech + 0.025 * ruido((d.x * 12, d.y * 12, d.z * 12))
        tono = 0.55 + 0.9 * mech * (0.6 + 0.4 * ruido((d.x * 30, d.y * 30, d.z * 30)))
        return (Vector((x * r, y * r, z * r)) * HS,
                tuple(min(1.0, k * tono) for k in pelo))

    for i in range(N):
        phi = i / N * 2 * math.pi
        sp, cp = math.sin(phi), math.cos(phi)
        dy_b = -cp * 0.9
        t = sm(0.0, -0.8, dy_b)
        b = sm(0.1, 0.8, dy_b)
        umbral = linea_pelo(phi, largo)
        e0 = math.asin(max(-0.95, min(0.95, umbral)))
        for j in range(M):
            e = e0 + (math.pi / 2 - e0) * j / M
            d = Vector((sp * math.cos(e), -cp * math.cos(e), math.sin(e)))
            p, c = punto(d)
            posiciones.append(p)
            colores.append(c)
    posiciones.append(punto(Vector((0, 0, 1)))[0])
    colores.append(punto(Vector((0, 0, 1)))[1])
    top = len(posiciones) - 1
    for i in range(N):
        i2 = (i + 1) % N
        for j in range(M - 1):
            caras.append((i * M + j, i2 * M + j, i2 * M + j + 1, i * M + j + 1))
        caras.append((i * M + M - 1, i2 * M + M - 1, top))

    me = bpy.data.meshes.new("pelo_m")
    me.from_pydata(posiciones, [], caras)
    capa = me.color_attributes.new("Col", 'FLOAT_COLOR', 'POINT')
    for i, c in enumerate(colores):
        capa.data[i].color = (*c, 1.0)
    obj = bpy.data.objects.new("pelo_malla", me)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = (0, 0, CABEZA_Z)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True)
    sol = obj.modifiers.new("Grosor", 'SOLIDIFY')
    sol.thickness = 0.006
    sol.offset = 1
    bpy.ops.object.modifier_apply(modifier="Grosor")
    bpy.ops.object.shade_smooth()
    return obj


def crear_gorra(cfg):
    color = lin(cfg["gorra"])
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=32, radius=1)
    borrar = [f for f in bm.faces if f.calc_center_median().z < 0.05]
    bmesh.ops.delete(bm, geom=borrar, context='FACES')
    for vt in bm.verts:
        vt.co = Vector((vt.co.x * RX * 1.14, vt.co.y * RY * 1.12 + 0.004, vt.co.z * RZ * 1.12))
    # visera
    bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=0.085, radius2=0.075, depth=0.008,
                          matrix=__import__("mathutils").Matrix.Translation((0, -0.115, 0.035)))
    for vt in bm.verts:
        if vt.co.y < -0.06 and vt.co.z < 0.05:
            vt.co.y = vt.co.y * 1.0
    me = bpy.data.meshes.new("gorra_m")
    bm.to_mesh(me)
    bm.free()
    poner_color_uniforme_malla(me, color)
    obj = bpy.data.objects.new("gorra_malla", me)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = (0, 0, CABEZA_Z + 0.025)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True)
    sol = obj.modifiers.new("Grosor", 'SOLIDIFY')
    sol.thickness = 0.005
    bpy.ops.object.modifier_apply(modifier="Grosor")
    bpy.ops.object.shade_smooth()
    return obj


# ------------------------------------------------------------ ESQUELETO
def crear_esqueleto():
    bpy.ops.object.armature_add(location=(0, 0, 0))
    arm = bpy.context.object
    arm.name = "esqueleto"
    arm.data.name = "esqueleto_d"
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.data.edit_bones
    for b in list(eb):
        eb.remove(b)

    def hueso(nombre, cab, col, padre=None):
        b = eb.new(nombre)
        b.head = cab
        b.tail = col
        if padre:
            b.parent = eb[padre]
        return b

    hueso("cadera", (0, 0, 0.95), (0, 0, 1.03))
    hueso("torso", (0, 0, 1.03), (0, 0, 1.50), "cadera")
    hueso("cabeza", (0, 0, 1.52), (0, 0, 1.86), "torso")
    for s, l in ((1, "I"), (-1, "D")):
        hueso("hombro_" + l, (s * 0.200, 0, 1.46), (s * 0.238, 0, 1.20), "torso")
        hueso("codo_" + l, (s * 0.238, 0, 1.20), (s * 0.256, 0, 0.95), "hombro_" + l)
        hueso("muslo_" + l, (s * 0.095, 0, 0.95), (s * 0.095, 0, 0.50), "cadera")
        hueso("rodilla_" + l, (s * 0.095, 0, 0.50), (s * 0.095, 0, 0.10), "muslo_" + l)
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


def atar_hueso(obj, arm, hueso):
    """Pieza rigida: todo el objeto sigue a un solo hueso."""
    vg = obj.vertex_groups.new(name=hueso)
    vg.add(list(range(len(obj.data.vertices))), 1.0, 'REPLACE')
    m = obj.modifiers.new("Armature", 'ARMATURE')
    m.object = arm
    obj.parent = arm


def construir_humano(cfg):
    n = cfg["nombre"]
    mat_vc = material_vertex(n + "_cuerpo", rugoso=0.72)
    mat_pelo = material_vertex(n + "_pelo", rugoso=0.55)
    mat_met = material(n + "_metal", (0.75, 0.65, 0.35), rugoso=0.3, metalico=1.0)

    cuerpo = crear_cuerpo(cfg)
    cuerpo.data.materials.append(mat_vc)
    cabeza, ojos_obj = crear_cabeza(cfg, res=cfg.get("res_cabeza", (160, 120)))
    pelo = crear_pelo(cfg)
    pelo.data.materials.append(mat_pelo)
    manos = crear_manos(cfg)
    manos.data.materials.append(mat_vc)

    # hebilla del cinturon
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.118, 0.985))
    hebilla = bpy.context.object
    hebilla.scale = (0.036, 0.010, 0.026)
    bpy.ops.object.transform_apply(scale=True)
    hebilla.name = "hebilla"
    hebilla.data.materials.append(mat_met)

    extras = []
    if cfg.get("gorra"):
        gorra = crear_gorra(cfg)
        gorra.data.materials.append(mat_pelo)
        extras.append(gorra)

    # el pelo y la gorra comparten material: se unen en una sola malla
    if extras:
        bpy.ops.object.select_all(action='DESELECT')
        for o in [pelo] + extras:
            o.select_set(True)
        bpy.context.view_layer.objects.active = pelo
        bpy.ops.object.join()

    arm = crear_esqueleto()

    # cuerpo: pesos automaticos
    bpy.ops.object.select_all(action='DESELECT')
    cuerpo.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')

    for o in (cabeza, ojos_obj, pelo):
        atar_hueso(o, arm, "cabeza")
    # manos: cada una sigue a su antebrazo
    vi = manos.vertex_groups.new(name="codo_I")
    vd = manos.vertex_groups.new(name="codo_D")
    vi.add([vt.index for vt in manos.data.vertices if vt.co.x > 0], 1.0, 'REPLACE')
    vd.add([vt.index for vt in manos.data.vertices if vt.co.x <= 0], 1.0, 'REPLACE')
    mm = manos.modifiers.new("Armature", 'ARMATURE')
    mm.object = arm
    manos.parent = arm
    atar_hueso(hebilla, arm, "cadera")
    arm.name = "personaje"
    return arm


AXEL = dict(
    nombre="axel",
    piel=(0.90, 0.68, 0.55),
    pelo=(0.20, 0.11, 0.07),
    barba=0.78,
    barba_color=(0.36, 0.22, 0.13),
    chaqueta=(0.60, 0.27, 0.11),
    camisa=(0.16, 0.15, 0.14),
    pantalon=(0.30, 0.30, 0.16),
    bota=(0.17, 0.11, 0.07),
    cuero=(0.30, 0.16, 0.08),
    pelo_largo=1.0,
)

ENEMIGO = dict(
    nombre="enemigo",
    piel=(0.72, 0.52, 0.41),
    pelo=(0.07, 0.07, 0.07),
    barba=0.4,
    barba_color=(0.10, 0.09, 0.09),
    chaqueta=(0.22, 0.25, 0.21),       # chaleco tactico
    camisa=(0.50, 0.08, 0.07),
    pantalon=(0.14, 0.17, 0.14),
    bota=(0.06, 0.06, 0.06),
    cuero=(0.10, 0.08, 0.06),
    gorra=(0.08, 0.08, 0.10),
    mangas_cortas=True,
    correa=False,
    iris=(0.10, 0.07, 0.05),
    pelo_largo=0.0,
)


# ---------------------------------------------------------------- idolo
def construir_idolo():
    oro = material("oro", (1.0, 0.72, 0.12), rugoso=0.25, metalico=1.0, brillo=0.6)
    piedra = material("piedra_idolo", (0.32, 0.30, 0.27), rugoso=0.95)
    caja("base_idolo", (0, 0, 0.04), (0.26, 0.26, 0.08), piedra)
    cono("cuerpo_idolo", (0, 0, 0.08), (0, 0, 0.42), 0.12, 0.07, oro)
    elip("cabeza_idolo", (0, 0, 0.52), (0.07, 0.065, 0.085), oro)
    elip("tocado_idolo", (0, 0, 0.6), (0.085, 0.03, 0.045), oro)
    for s in (1, -1):
        cono("brazo_idolo", (s * 0.08, 0, 0.38), (s * 0.15, -0.03, 0.22), 0.025, 0.02, oro)
        elip("ojo_idolo", (s * 0.03, -0.055, 0.53), (0.014, 0.008, 0.014),
             material("rubi", (0.9, 0.05, 0.05), rugoso=0.2, brillo=2.0))
    bpy.ops.object.select_all(action='SELECT')


# ------------------------------------------------------------- palmera
def construir_palmera():
    tronco = material("tronco", (0.36, 0.25, 0.14), rugoso=0.95)
    hoja = material("hoja", (0.12, 0.42, 0.1), rugoso=0.7)
    coco = material("coco", (0.22, 0.14, 0.07), rugoso=0.6)
    pts = []
    tramos = 9
    for i in range(tramos + 1):
        t = i / tramos
        pts.append(Vector((math.sin(t * 1.1) * 0.7, math.sin(t * 0.8) * 0.15, t * 4.6)))
    for i in range(tramos):
        r1 = 0.2 - 0.09 * (i / tramos)
        r2 = 0.2 - 0.09 * ((i + 1) / tramos)
        cono(f"tronco_{i}", pts[i], pts[i + 1], r1, r2, tronco, vertices=12)
    cima = pts[-1]
    for k in range(9):
        a = k / 9 * math.pi * 2
        direccion = Vector((math.cos(a), math.sin(a), 0))
        for j in range(4):
            p = cima + direccion * (0.35 + j * 0.42) + Vector((0, 0, 0.25 - j * j * 0.07))
            # la hoja es una elipse aplastada: con pocos segmentos se ve igual y pesa 9 veces menos
            # (32 palmeras en pantalla: de 1.1 millones de triangulos a unos 120 mil)
            elip(f"hoja_{k}_{j}", p, (0.34, 0.12, 0.025), hoja,
                 rot=(0, math.radians(-12 - j * 16), a), seg=10, anillos=6)
    for k in range(3):
        a = k * 2.1
        elip(f"coco_{k}", cima + Vector((math.cos(a) * 0.18, math.sin(a) * 0.18, -0.2)),
             (0.11, 0.11, 0.11), coco, seg=12, anillos=8)
    bpy.ops.object.select_all(action='SELECT')


# ------------------------------------------------------------------ main
def poses_de_prueba(arm):
    """Dobla brazos y piernas en Blender para comprobar que los pesos deforman bien."""
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='POSE')
    for n, (x, y, z) in {"hombro_D": (-1.3, 0, 0), "codo_D": (-1.6, 0, 0),
                         "hombro_I": (0.6, 0, 0), "muslo_I": (-0.8, 0, 0),
                         "rodilla_I": (1.2, 0, 0)}.items():
        pb = arm.pose.bones[n]
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = (x, y, z)
    bpy.ops.object.mode_set(mode='OBJECT')


def reposo(arm):
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='POSE')
    for pb in arm.pose.bones:
        pb.rotation_euler = (0, 0, 0)
    bpy.ops.object.mode_set(mode='OBJECT')


if __name__ == "__main__":
    limpiar()
    arm = construir_humano(AXEL)
    previsualizar("axel_frente", angulo=0)
    previsualizar("axel_3_4", angulo=-40)
    previsualizar("axel_cara", objetivo=(0, 0, 1.73), dist=0.7, altura=1.75, angulo=-20, lente=85)
    previsualizar("axel_cara_frente", objetivo=(0, 0, 1.73), dist=0.7, altura=1.75, angulo=0, lente=85)
    if PREVIEW:
        poses_de_prueba(arm)
        previsualizar("axel_pose", angulo=-50)
        reposo(arm)
    exportar("max.glb")

    limpiar()
    construir_humano(ENEMIGO)
    previsualizar("enemigo_3_4", angulo=-40)
    exportar("enemigo.glb")

    limpiar()
    construir_idolo()
    exportar("idolo.glb", fusion=True)

    limpiar()
    construir_palmera()
    exportar("palmera.glb", fusion=True)
