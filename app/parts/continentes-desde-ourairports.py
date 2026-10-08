"""De dónde sale CONTINENTE_DE_PAIS (VAL-79, ronda 2), para que se pueda verificar.

Uso, desde la raíz del repo:
    curl -sS -o /tmp/countries.csv https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/countries.csv
    python3 -I app/parts/continentes-desde-ourairports.py /tmp/countries.csv

Arma el mapa país → continente de OurAirports para los países que tiene el dato
de aeropuertos (AEROPUERTOS_PAISES) y lo compara con el que está en
app/valija.html. Sale 0 si coinciden; si no, imprime las diferencias.
"""
import csv, json, re, sys

cont = {r["code"]: r["continent"] for r in csv.DictReader(open(sys.argv[1], encoding="utf8"))}
html = open("app/valija.html", encoding="utf8").read()
paises = json.loads(re.search(r"var AEROPUERTOS_PAISES = (\{.*?\});", html).group(1))
esperado = {c: cont[c] for c in paises if c in cont}
en_app = json.loads(re.search(r"const CONTINENTE_DE_PAIS = (\{.*?\});", html).group(1))
dif = {c: (esperado.get(c), en_app.get(c)) for c in set(esperado) | set(en_app) if esperado.get(c) != en_app.get(c)}
print(f"países del dato: {len(paises)} · en OurAirports: {len(esperado)} · en la app: {len(en_app)} · diferencias: {len(dif)}")
for c, (e, a) in sorted(dif.items()):
    print(f"  {c}: OurAirports {e} · app {a}")
sys.exit(1 if dif else 0)
