#!/bin/sh
#
# Ajusta los permisos del volumen ANTES de bajar privilegios.
#
# Railway (como cualquier orquestador) monta el volumen encima de /app/data en
# tiempo de ejecución, y el punto de montaje pertenece a root. El `chown` que
# hace el Dockerfile ocurre durante el build, sobre un directorio que el montaje
# después tapa: por eso el proceso, corriendo como `node`, no podía abrir la
# base y better-sqlite3 fallaba con SQLITE_CANTOPEN.
#
# El contenedor arranca como root solo para este ajuste y ejecuta la aplicación
# como `node`. Un servidor web público no debe correr como root.
set -e

DATA_DIR="$(dirname "${DATABASE_PATH:-/app/data/database.sqlite}")"

mkdir -p "$DATA_DIR"
chown -R node:node "$DATA_DIR"

exec gosu node "$@"
