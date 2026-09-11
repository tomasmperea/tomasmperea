# Extractor mínimo de la capa de texto de un PDF: descomprime los streams de
# contenido y saca lo que dibujan los operadores Tj / TJ. No toca imágenes.
import sys, re, zlib

def extraer(ruta):
    d = open(ruta, "rb").read()
    trozos = []
    for m in re.finditer(rb"stream\r?\n(.*?)\r?\nendstream", d, re.S):
        raw = m.group(1)
        try: s = zlib.decompress(raw)
        except Exception: continue
        if b"BT" not in s: continue          # sin bloque de texto no es contenido
        for bt in re.findall(rb"BT(.*?)ET", s, re.S):
            for op in re.finditer(rb"\[(.*?)\]\s*TJ|\((?:\\.|[^\\()])*\)\s*Tj", bt, re.S):
                frag = op.group(0)
                for lit in re.findall(rb"\((?:\\.|[^\\()])*\)", frag):
                    v = lit[1:-1]
                    v = v.replace(rb"\(", b"(").replace(rb"\)", b")").replace(rb"\\", b"\\")
                    trozos.append(v.decode("latin-1"))
                trozos.append(" ")
    return "".join(trozos)

for f in sys.argv[1:]:
    t = re.sub(r"[ ]{2,}", " ", extraer(f)).strip()
    print("===", f.split("/")[-1][:55])
    print("  caracteres:", len(t))
    print("  texto:", t[:900] if t else "(NINGUNO — es un PDF escaneado o de imagen pura)")
    print()
