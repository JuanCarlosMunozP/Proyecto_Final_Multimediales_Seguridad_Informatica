"""
Cabeza humana: geometria esculpida por codigo + texturas pintadas por codigo.

  - forma_np():   superficie de la cabeza (craneo, mandibula, nariz, cejas, labios...)
  - pintar_*():   textura de color (poros, rubor, cejas, barba, labios) y mapa de normales
                  (arrugas de la frente, patas de gallo, surcos, poros, vello)
  - crear_cabeza(): devuelve la cabeza (con orejas y parpados) y los ojos como objetos de Blender

Todo usa las mismas coordenadas faciales (fx, fz) para que geometria y textura coincidan.
"""
import bpy
import bmesh
import math
import os
import tempfile
import numpy as np
from mathutils import Vector

RX, RY, RZ = 0.087, 0.103, 0.113   # radios del craneo (m)
HS = 1.12                          # escala final de la cabeza
CABEZA_Z = 1.725                   # altura del centro de la cabeza

_TMP = tempfile.mkdtemp(prefix="axel_tex_")


# ------------------------------------------------------------- utilidades
def nsm(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def ng(x, s=1.0):
    """campana de Gauss; con un solo argumento, x ya viene dividido por la anchura."""
    return np.exp(-0.5 * (x / s) ** 2)


def mix(a, b, t):
    return a * (1 - t[..., None]) + b * t[..., None]


def vnoise(h, w, gh, gw, seed):
    """Ruido de valor (bilineal) de gh x gw celdas, escalado a h x w pixeles."""
    rng = np.random.default_rng(seed)
    grid = rng.random((gh + 2, gw + 2)).astype(np.float32)
    ys = np.linspace(0, gh, h, endpoint=False)
    xs = np.linspace(0, gw, w, endpoint=False)
    y0, x0 = ys.astype(int), xs.astype(int)
    fy = ((ys - y0) ** 2 * (3 - 2 * (ys - y0)))[:, None].astype(np.float32)
    fx = ((xs - x0) ** 2 * (3 - 2 * (xs - x0)))[None, :].astype(np.float32)
    a = grid[y0][:, x0]
    b = grid[y0][:, x0 + 1]
    c = grid[y0 + 1][:, x0]
    d = grid[y0 + 1][:, x0 + 1]
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy


def fbm(h, w, base, seed, octavas=3):
    total, amp, norm = 0, 1.0, 0
    for o in range(octavas):
        g = base * (2 ** o)
        total = total + amp * vnoise(h, w, max(2, g * h // w), g, seed + o)
        norm += amp
        amp *= 0.5
    return total / norm


# ------------------------------------------------------------- la forma
def forma_np(dx, dy, dz):
    """Punto de la cabeza (antes de escalar) para direcciones unitarias.
    Devuelve x, y, z, fx, fz, wf (wf = cuanto es 'cara' en ese punto)."""
    t = nsm(-0.15, -0.95, dz)
    j = nsm(-0.5, -1.0, dz)
    x = dx * RX * (1 - 0.27 * j - 0.05 * nsm(-0.1, -0.5, dz))
    y = dy * RY * (1 - 0.10 * t)
    z = dz * RZ * (1 - 0.05 * t)
    y = np.where(dy < 0, y - 0.012 * t * (-dy), y)   # menton adelantado
    fx, fz = x, z
    ax = np.abs(fx)
    wf = nsm(0.35, -0.55, dy)      # los rasgos se desvanecen poco a poco hacia las sienes

    f = 0
    # nariz: puente, punta, alas, base
    f = f + ng(fx, 0.011) * ng(fz - 0.012, 0.030) * 0.014
    f = f + ng(fx, 0.013) * ng(fz + 0.028, 0.013) * 0.024
    f = f + ng(ax - 0.017, 0.008) * ng(fz + 0.030, 0.011) * 0.011
    f = f - ng(fx, 0.012) * ng(fz + 0.046, 0.006) * 0.008
    # cejas (mas fuertes hacia dentro: gesto serio), cuencas, parpados
    zb = 0.031 + 0.010 * np.clip((ax - 0.012) / 0.05, 0, 1)
    f = f + ng(ax - 0.034, 0.024) * ng(fz - zb, 0.009) * 0.016
    f = f - ng(ax - 0.036, 0.014) * ng(fz - 0.012, 0.010) * 0.010
    f = f + ng(ax - 0.037, 0.012) * ng(fz - 0.021, 0.004) * 0.004
    f = f + ng(ax - 0.037, 0.014) * ng(fz + 0.003, 0.004) * 0.003
    # pomulos y mejillas huecas
    f = f + ng(ax - 0.054, 0.018) * ng(fz + 0.010, 0.018) * 0.008
    f = f - ng(ax - 0.052, 0.020) * ng(fz + 0.042, 0.020) * 0.006
    # labios, surcos y menton
    f = f + ng(fx, 0.024) * ng(fz + 0.062, 0.005) * 0.008
    f = f + ng(fx, 0.022) * ng(fz + 0.073, 0.006) * 0.009
    f = f - ng(fx, 0.024) * ng(fz + 0.0675, 0.0025) * 0.006
    f = f - ng(ax - 0.007, 0.003) * ng(fz + 0.048, 0.008) * 0.002   # filtrum
    f = f + ng(fx, 0.020) * ng(fz + 0.100, 0.012) * 0.010
    f = f - ng(fx, 0.0035) * ng(fz + 0.098, 0.008) * 0.002           # hoyuelo
    f = f - ng(dist_segmento(ax, fz, 0.024, -0.030, 0.034, -0.066), 0.004) * 0.003 * wf
    y = y - f * wf * 1.5
    return x, y, z, fx, fz, wf


def dist_segmento(px, pz, x0, z0, x1, z1):
    vx, vz = x1 - x0, z1 - z0
    t = np.clip(((px - x0) * vx + (pz - z0) * vz) / (vx * vx + vz * vz), 0, 1)
    return np.hypot(px - (x0 + vx * t), pz - (z0 + vz * t))


def mascara_barba(fx, fz, y, dz, dens):
    ax = np.abs(fx)
    limite = -0.034 + 0.034 * nsm(0.062, 0.085, ax)       # patillas hasta la oreja
    zona = nsm(limite + 0.010, limite - 0.010, fz) * nsm(0.075, 0.0, y)   # la patilla llega hasta la oreja
    zona = zona + nsm(-0.65, -0.85, dz) * 0.35            # bajo la mandibula
    hueco = ng(fx, 0.020) * ng(fz + 0.0675, 0.009) * 0.85  # la boca queda libre
    return np.clip(zona - hueco, 0, 1) * dens


# ------------------------------------------------------------ la textura
def pintar_cabeza(cfg, W=2048, H=1024):
    u = (np.arange(W) + 0.5) / W
    v = (np.arange(H) + 0.5) / H
    PHI, TH = np.meshgrid((u - 0.5) * 2 * np.pi, (v - 0.5) * np.pi)
    dx, dy, dz = np.sin(PHI) * np.cos(TH), -np.cos(PHI) * np.cos(TH), np.sin(TH)
    x, y, z, fx, fz, wf = [a.astype(np.float32) for a in forma_np(dx, dy, dz)]
    ax = np.abs(fx)

    piel = np.array(cfg["piel"], np.float32)
    pelo = np.array(cfg["pelo"], np.float32)
    barba_c = np.array(cfg.get("barba_color", cfg["pelo"]), np.float32)
    labios_c = piel * np.array([0.92, 0.55, 0.52], np.float32)

    # ---- piel: manchas suaves, rubor, sombras
    S = np.ones((H, W, 3), np.float32) * piel
    S = S * (0.90 + 0.20 * fbm(H, W, 6, 11))[..., None]
    rub = (0.40 * ng(fx, 0.02) * ng(fz + 0.028, 0.028) + 0.22 * ng(ax - 0.052, 0.02) * ng(fz + 0.012, 0.02)) * wf
    S = mix(S, S * np.array([1.06, 0.78, 0.74], np.float32), np.clip(rub, 0, 1))
    S = S * (1 - 0.30 * ng(ax - 0.037, 0.016) * ng(fz - 0.014, 0.011) * wf)[..., None]    # cuenca
    S = S * (1 - 0.20 * ng(ax - 0.038, 0.016) * ng(fz + 0.004, 0.005) * wf)[..., None]    # ojera

    # ---- poros y granulado fino
    poros = vnoise(H, W, H // 2, W // 2, 21)
    S = S * (1 - 0.17 * nsm(0.72, 0.95, poros) * (0.4 + 0.6 * wf))[..., None]
    S = S * (0.965 + 0.07 * vnoise(H, W, H // 4, W // 4, 22))[..., None]

    alt = np.zeros((H, W), np.float32)       # relieve total (para el mapa de normales)
    arrugas = np.zeros((H, W), np.float32)   # profundidad de arrugas (oscurece el color)
    alt += -0.35 * nsm(0.72, 0.95, poros)
    alt += 0.12 * (vnoise(H, W, H // 3, W // 3, 23) - 0.5)

    frente = nsm(0.075, 0.05, ax) * nsm(0.043, 0.053, fz) * nsm(0.098, 0.083, fz) * wf
    for k, z0 in enumerate((0.056, 0.067, 0.078)):
        arrugas += ng((fz - z0 - 0.0016 * np.sin(fx * 70 + k)) / 0.0015) * frente * 0.40
    arrugas += ng((ax - 0.0085) / 0.0018) * nsm(0.012, 0.022, fz) * nsm(0.052, 0.040, fz) * wf     # entrecejo
    r = np.hypot(fz - 0.010, ax - 0.060)
    ang = np.arctan2(fz - 0.010, ax - 0.060)
    for a0 in (-0.55, 0.0, 0.55):                                                                   # patas de gallo
        arrugas += ng(((ang - a0) * r) / 0.0016) * nsm(0.034, 0.014, r) * nsm(0.006, 0.011, r) * nsm(0.056, 0.064, ax) * 0.45 * wf
    arrugas += ng(dist_segmento(ax, fz, 0.024, -0.030, 0.034, -0.066) / 0.0022) * wf * 0.9         # surcos de la nariz
    arrugas += ng((fz + 0.009) / 0.0014) * ng((ax - 0.038) / 0.015) * 0.6 * wf                     # bolsa bajo el ojo
    arrugas = np.clip(arrugas, 0, 1)
    alt -= arrugas
    S = S * (1 - 0.18 * arrugas)[..., None]

    # ---- cejas: trazos densos, mas bajas por dentro
    zb = 0.031 + 0.010 * np.clip((ax - 0.012) / 0.05, 0, 1)
    grosor = 0.0075 - 0.0025 * np.clip((ax - 0.012) / 0.05, 0, 1)
    ceja = ng((fz - zb) / grosor) * nsm(0.064, 0.054, ax) * nsm(0.006, 0.013, ax) * wf
    trazo = vnoise(H, W, H, W // 16, 31)
    ceja_m = np.clip(ceja * (0.6 + 0.9 * trazo), 0, 1)
    ceja_m = nsm(0.18, 0.5, ceja_m)
    pelo_v = pelo * (0.7 + 0.6 * vnoise(H, W, H // 2, W // 2, 32))[..., None]
    S = mix(S, pelo_v, ceja_m * 0.95)
    alt += 0.35 * ceja_m

    # ---- labios
    lab = np.clip(ng(fx, 0.022) * (ng(fz + 0.062, 0.0068) + ng(fz + 0.073, 0.0078)) * wf, 0, 1)
    S = mix(S, labios_c, lab)
    boca = ng(fx, 0.021) * ng(fz + 0.0675, 0.0022) * wf
    S = mix(S, np.array([0.18, 0.06, 0.06], np.float32), np.clip(boca, 0, 1))
    alt += 0.16 * np.sin(fx * 520 + 4 * vnoise(H, W, 20, 40, 33)) * lab - 1.0 * boca

    # ---- barba / barba de varios dias
    dens = cfg.get("barba", 0.0)
    if dens > 0:
        zona = mascara_barba(fx, fz, y, dz, dens)
        S = mix(S, S * 0.68 + barba_c * 0.30, np.clip(zona * 0.80, 0, 1))     # sombra de barba bajo la piel
        punto = vnoise(H, W, H // 2, W // 2, 41)
        h = nsm(zona * 0.95 + 0.04, zona * 0.95 - 0.06, punto)                # vello visible
        hv = barba_c * (0.55 + 0.9 * vnoise(H, W, H // 2, W // 2, 42))[..., None]
        S = mix(S, hv, h * 0.95)
        alt += 0.45 * h

    S = np.clip(S, 0, 1)

    # ---- mapa de normales (a mitad de resolucion para que pese menos)
    alt2 = alt.reshape(H // 2, 2, W // 2, 2).mean(axis=(1, 3))
    hx = np.gradient(alt2, axis=1)
    hy = np.gradient(alt2, axis=0)
    K = 2.4
    n = np.stack([-hx * K, -hy * K, np.ones_like(hx)], axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return S, n * 0.5 + 0.5


def pintar_ojo(cfg, W=512, H=256):
    u = (np.arange(W) + 0.5) / W
    v = (np.arange(H) + 0.5) / H
    PHI, TH = np.meshgrid((u - 0.5) * 2 * np.pi, (v - 0.5) * np.pi)
    dx, dy, dz = np.sin(PHI) * np.cos(TH), -np.cos(PHI) * np.cos(TH), np.sin(TH)
    ang = np.arccos(np.clip(-dy, -1, 1))
    az = np.arctan2(dz, dx)

    esclera = np.array([0.93, 0.90, 0.86], np.float32)
    iris_c = np.array(cfg.get("iris", (0.30, 0.18, 0.08)), np.float32)
    C = np.ones((H, W, 3), np.float32) * esclera
    # venitas rojas hacia las esquinas
    C = mix(C, np.array([0.85, 0.45, 0.42], np.float32), 0.25 * nsm(0.9, 1.4, ang) * vnoise(H, W, 12, 24, 51))
    # sombra del parpado arriba
    C = C * (1 - 0.40 * nsm(0.1, 0.8, dz))[..., None]
    # iris con fibras radiales
    fibras = vnoise(H, W, 6, 80, 52)
    iris = iris_c * (0.55 + 0.9 * fibras)[..., None]
    iris = mix(iris, iris_c * 1.5, 0.5 * nsm(0.30, 0.20, ang))     # anillo claro alrededor de la pupila
    en_iris = nsm(0.56, 0.50, ang)
    C = mix(C, iris, en_iris)
    C = C * (1 - 0.55 * ng((ang - 0.53) / 0.035))[..., None]       # borde oscuro del iris
    C = mix(C, np.array([0.01, 0.01, 0.01], np.float32), nsm(0.235, 0.205, ang))   # pupila
    # brillo (punto de luz)
    brillo = ng(np.hypot(dx - 0.30, dz - 0.30) / 0.07)
    C = mix(C, np.array([1, 1, 1], np.float32), np.clip(brillo * 1.2, 0, 1) * nsm(0.9, 0.4, ang))
    return np.clip(C, 0, 1)


# ------------------------------------------------- imagenes y materiales
def imagen(nombre, arr, srgb=True, jpeg=False):
    H, W, _ = arr.shape
    img = bpy.data.images.new(nombre, W, H, alpha=False)
    # el espacio de color se fija ANTES de cargar los pixeles (si no, la imagen se reinicia a negro)
    img.colorspace_settings.name = 'sRGB' if srgb else 'Non-Color'
    rgba = np.ones((H, W, 4), np.float32)
    rgba[..., :3] = arr
    img.pixels.foreach_set(rgba.ravel())
    ext = "jpg" if jpeg else "png"
    img.filepath_raw = os.path.join(_TMP, f"{nombre}.{ext}")
    img.file_format = 'JPEG' if jpeg else 'PNG'
    bpy.context.scene.render.image_settings.quality = 92
    img.save()
    return img


def material_textura(nombre, img_color, img_normal=None, rugoso=0.6):
    mat = bpy.data.materials.new(nombre)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rugoso
    t1 = nt.nodes.new("ShaderNodeTexImage")
    t1.image = img_color
    nt.links.new(t1.outputs["Color"], bsdf.inputs["Base Color"])
    if img_normal is not None:
        t2 = nt.nodes.new("ShaderNodeTexImage")
        t2.image = img_normal
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(t2.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


# --------------------------------------------------------- mallas esfericas
def malla_esfera(nombre, N, M, posicion_fn, uv_fijo=None, quitar=None):
    """Esfera UV (N x M) con UV equirectangulares (frente = u 0.5).
    posicion_fn(dx,dy,dz) -> (x,y,z) arrays. quitar(dx,dy,dz) -> mascara de caras a borrar."""
    phis = -np.pi + 2 * np.pi * np.arange(N) / N
    ths = -np.pi / 2 + np.pi * np.arange(1, M) / M
    PHI, TH = np.meshgrid(phis, ths)
    dx, dy, dz = np.sin(PHI) * np.cos(TH), -np.cos(PHI) * np.cos(TH), np.sin(TH)
    D = np.stack([dx.ravel(), dy.ravel(), dz.ravel()], axis=1)
    D = np.vstack([D, [0, 0, -1], [0, 0, 1]])
    pb, pt = len(D) - 2, len(D) - 1
    px, py, pz = posicion_fn(D[:, 0], D[:, 1], D[:, 2])
    U = np.concatenate([np.tile(np.arange(N) / N, M - 1), [0.5, 0.5]])
    V = np.concatenate([np.repeat(ths / np.pi + 0.5, N), [0.0, 1.0]])

    bm = bmesh.new()
    vs = [bm.verts.new((px[i], py[i], pz[i])) for i in range(len(D))]
    caras = []
    for j in range(M - 2):
        for i in range(N):
            i2 = (i + 1) % N
            caras.append((j * N + i, j * N + i2, (j + 1) * N + i2, (j + 1) * N + i))
    for i in range(N):
        i2 = (i + 1) % N
        caras.append((pb, i2, i))
        caras.append(((M - 2) * N + i, (M - 2) * N + i2, pt))
    for c in caras:
        if quitar is not None:
            cd = D[list(c)].mean(axis=0)
            cd = cd / np.linalg.norm(cd)
            if quitar(cd[0], cd[1], cd[2]):
                continue
        try:
            bm.faces.new([vs[k] for k in c])
        except ValueError:
            pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.verts.index_update()
    uvl = bm.loops.layers.uv.new("UV")
    for f in bm.faces:
        ids = [l.vert.index for l in f.loops]
        real = [k for k in ids if k not in (pb, pt)]
        base = [U[k] for k in real] or [0.5]
        if max(base) - min(base) > 0.5:
            fix = {k: (U[k] + 1 if U[k] < 0.5 else U[k]) for k in real}
        else:
            fix = {k: U[k] for k in real}
        mu = sum(fix.values()) / len(fix) if fix else 0.5
        for l, k in zip(f.loops, ids):
            if uv_fijo is not None:
                l[uvl].uv = uv_fijo
            else:
                l[uvl].uv = (fix.get(k, mu), V[k])
    me = bpy.data.meshes.new(nombre + "_m")
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(nombre, me)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def _activar(obj):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)


# ------------------------------------------------------- cabeza completa
def crear_cabeza(cfg, res=(160, 120)):
    """Devuelve (cabeza, ojos). Cabeza incluye orejas y parpados."""
    n = cfg["nombre"]
    dens = cfg.get("barba", 0.0)

    def pos_cabeza(dx, dy, dz):
        x, y, z, fx, fz, wf = forma_np(dx, dy, dz)
        zona = mascara_barba(fx, fz, y, dz, dens) if dens > 0 else 0 * x
        r = zona * 0.006
        x, y, z = x + dx * r, y + dy * r, z + dz * r
        return x * HS, y * HS, z * HS

    cabeza = malla_esfera(n + "_cabeza", res[0], res[1], pos_cabeza)

    col, nrm = pintar_cabeza(cfg)
    mat_cab = material_textura(
        n + "_piel", imagen(n + "_piel_color", col, True, True),
        imagen(n + "_piel_normal", nrm, False, False), rugoso=0.58)
    cabeza.data.materials.append(mat_cab)

    # orejas y parpados: comparten el material de la piel (UV fijo en la sien)
    sien = (0.57, 0.62)
    objs = [cabeza]
    for s in (1, -1):
        def pos_oreja(dx, dy, dz, s=s):
            # oreja con el centro hundido (concha) y borde alto (helix)
            hondo = np.clip(1 - (dy ** 2 + dz ** 2) * 1.5, 0, 1) * (dx * s > 0)
            x = dx * 0.012 * HS - s * 0.0085 * hondo
            return (x, dy * 0.022 * HS, dz * 0.034 * HS)
        o = malla_esfera(n + "_oreja", 20, 14, pos_oreja, uv_fijo=sien)
        o.location = (s * 0.100, 0.009, CABEZA_Z - 0.004)
        o.rotation_euler = (0, 0, s * 0.25)
        objs.append(o)
        for arriba in (True, False):
            R = 0.0124
            q = (lambda dx, dy, dz: dz < 0.32) if arriba else (lambda dx, dy, dz: dz > -0.72)
            def pos_lid(dx, dy, dz): return (dx * R, dy * R, dz * R)
            l = malla_esfera(n + "_parpado", 24, 16, pos_lid, uv_fijo=sien, quitar=q)
            l.location = (s * 0.039, -0.089, CABEZA_Z + 0.013 + (0.0003 if arriba else -0.0003))
            objs.append(l)
    for o in objs:
        if o is not cabeza:
            o.data.materials.append(mat_cab)
    for o in objs:
        o.select_set(False)
    # posicionar la cabeza y unir todo
    cabeza.location = (0, 0, CABEZA_Z)
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = cabeza
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    bpy.ops.object.shade_smooth()
    cabeza = bpy.context.view_layer.objects.active
    cabeza.name = "cabeza_malla"

    # ojos (dos esferas con textura de iris)
    img_ojo = imagen(n + "_ojo", (pintar_ojo(cfg)), True, False)
    mat_ojo = material_textura(n + "_ojo", img_ojo, None, rugoso=0.08)
    ojos = []
    for s in (1, -1):
        def pos_ojo(dx, dy, dz): return (dx * 0.0115, dy * 0.0115, dz * 0.0115)
        o = malla_esfera(n + "_ojo", 40, 28, pos_ojo)
        o.data.materials.append(mat_ojo)
        o.location = (s * 0.039, -0.089, CABEZA_Z + 0.013)
        ojos.append(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in ojos:
        o.select_set(True)
    bpy.context.view_layer.objects.active = ojos[0]
    bpy.ops.object.transform_apply(location=True)
    bpy.ops.object.join()
    ojos_obj = bpy.context.view_layer.objects.active
    ojos_obj.name = "ojos_malla"
    bpy.ops.object.shade_smooth()
    return cabeza, ojos_obj
